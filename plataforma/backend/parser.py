import re
import os
import io
import json
import shutil
import subprocess
import tempfile
import urllib.request
import urllib.error
from datetime import datetime

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


# ── EXTRAÇÃO DE TEXTO ─────────────────────────────────────────────────────

# Localizações comuns do pdftotext quando ele não está no PATH do processo
# (ex.: servidor iniciado pelo PowerShell não enxerga o /mingw64/bin do Git Bash).
_PDFTOTEXT_CANDIDATOS = [
    r"C:\Program Files\Git\mingw64\bin\pdftotext.exe",
    r"C:\Program Files (x86)\Git\mingw64\bin\pdftotext.exe",
    r"C:\msys64\mingw64\bin\pdftotext.exe",
    r"C:\Program Files\poppler\bin\pdftotext.exe",
    r"C:\poppler\bin\pdftotext.exe",
    "/mingw64/bin/pdftotext.exe",
    "/usr/bin/pdftotext",
    "/usr/local/bin/pdftotext",
]

_pdftotext_cache = None  # None = ainda não procurou; "" = procurou e não achou


def _achar_pdftotext():
    """Retorna o caminho do pdftotext (PATH, env PDFTOTEXT_PATH ou locais conhecidos)."""
    global _pdftotext_cache
    if _pdftotext_cache is not None:
        return _pdftotext_cache or None

    override = os.environ.get("PDFTOTEXT_PATH")
    candidatos = ([override] if override else []) + _PDFTOTEXT_CANDIDATOS
    achado = shutil.which("pdftotext")
    if not achado:
        for c in candidatos:
            if c and os.path.exists(c):
                achado = c
                break

    _pdftotext_cache = achado or ""
    return achado

def pdf_esta_encriptado(pdf_bytes):
    """Retorna True se o PDF estiver protegido por senha."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            _ = len(pdf.pages)
            return False
    except Exception as e:
        tipo = type(e).__name__
        msg = str(e).lower()
        if tipo in ('PDFPasswordIncorrect', 'PDFEncryptionError') or \
           any(k in msg for k in ('password', 'encrypt', 'incorrect', 'decrypt')):
            return True
        return False


def extrair_texto_pdf(pdf_bytes, senha=None):
    """
    Extrai texto do PDF usando pdftotext -layout (poppler-utils).
    Preserva posicionamento espacial das colunas.
    Fallback para pdfplumber se pdftotext não estiver disponível.
    """
    pdftotext = _achar_pdftotext()
    if pdftotext:
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                tmp.write(pdf_bytes)
                tmp_path = tmp.name

            cmd = [pdftotext, '-layout']
            if senha:
                cmd += ['-upw', senha]
            cmd += [tmp_path, '-']

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode == 0 and result.stdout.strip():
                return result.stdout
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            pass
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    # Fallback: pdfplumber com layout=True (preserva colunas, como o pdftotext -layout).
    # Essencial quando o pdftotext não está disponível — os parsers dependem do
    # alinhamento espacial das colunas.
    try:
        import pdfplumber
        texto = ""
        open_kwargs = {'password': senha} if senha else {}
        with pdfplumber.open(io.BytesIO(pdf_bytes), **open_kwargs) as pdf:
            for page in pdf.pages:
                try:
                    t = page.extract_text(layout=True)
                except Exception:
                    t = page.extract_text()
                texto += (t or "") + "\n"
        return texto
    except Exception as e:
        raise RuntimeError(f"Não foi possível extrair texto do PDF: {e}")


# ── PRÉ-FILTRO DE JANELA ─────────────────────────────────────────────────
#
# Cada tipo de documento tem marcadores textuais que delimitam onde os
# lançamentos reais começam e terminam. Extrair apenas essa janela antes
# de chamar a IA elimina 60-80% dos tokens sem perder nenhum dado útil.
#
# Estratégia: detecta o tipo pelo cabeçalho (palavras-chave, custo zero),
# localiza os marcadores de início/fim e devolve só o trecho relevante.
# Se nenhum marcador for encontrado, devolve o texto original intacto —
# a IA ainda funciona, só com custo um pouco maior.

def _detectar_tipo_rapido(texto):
    """Detecta débito/crédito por palavras-chave no texto. Custo: zero."""
    t = texto[:3000].upper()           # só cabeçalho, não precisa ler tudo
    score_deb = sum(1 for kw in [
        'EXTRATO DE CONTA CORRENTE', 'CONTA CORRENTE', 'SALDO ANTERIOR',
        'SALDO DISPONIVEL', 'SALDO DISPONÍVEL',
    ] if kw in t)
    score_cred = sum(1 for kw in [
        'DETALHAMENTO DA FATURA', 'DETALHAMENTO DE FATURA', 'FATURA',
        'LIMITE DE CREDITO', 'LIMITE DE CRÉDITO', 'VENCIMENTO DA FATURA',
        'CARTAO DE CREDITO', 'CARTÃO DE CRÉDITO', 'PAGAMENTO MINIMO',
        'PAGAMENTO MÍNIMO', 'TRANSAÇÕES DE',
    ] if kw in t)
    if score_deb > score_cred:
        return 'debito'
    if score_cred > score_deb:
        return 'credito'
    return None


# ── CATÁLOGO DE BANCOS ────────────────────────────────────────────────────
# Identifica o banco/layout por palavras-chave no cabeçalho e diz como extrair:
#   'regex'      → parser por posição (Santander débito), sem custo de IA
#   'ia_texto'   → janela + IA (faturas de crédito com texto)
#   'ocr_regex'  → PDF-imagem: OCR + parser dedicado (XP)
# Bancos novos sem entrada aqui caem na IA genérica (também ótima).
_CATALOGO_BANCOS = {
    'santander_debito': {
        'detectar': ['EXTRATO DE CONTA CORRENTE'],
        'extracao': 'regex', 'pdf_tipo': 'texto', 'tipo_lancamento': 'debito',
    },
    'santander_credito': {
        'detectar': ['SANTANDER ELITE', 'DETALHAMENTO DA FATURA'],
        'extracao': 'ia_texto', 'pdf_tipo': 'texto', 'tipo_lancamento': 'credito',
    },
    'nubank': {
        'detectar': ['NU PAGAMENTOS', 'TRANSAÇÕES DE'],
        'extracao': 'ia_texto', 'pdf_tipo': 'texto', 'tipo_lancamento': 'credito',
    },
    'xp': {
        'detectar': ['BANCO XP', 'XP VISA', 'CARTÃO XP', 'CARTAO XP', 'XP INVESTIMENTOS',
                     'VISA INFINITE ONE', 'INVESTBACK', 'APP XP', 'CARTÃO XP', 'SEU CARTAO XP'],
        'extracao': 'ocr_regex', 'pdf_tipo': 'imagem', 'tipo_lancamento': 'credito',
    },
}


def _detectar_banco(texto):
    """Retorna a chave do banco no catálogo cujas palavras-chave aparecem no
    texto; None se nenhuma casar (→ IA genérica). Varre um trecho generoso
    porque em PDF-imagem (OCR) o cabeçalho às vezes sai ruim e o nome do banco
    só aparece nas páginas internas."""
    t = (texto or "")[:8000].upper()
    for banco, cfg in _CATALOGO_BANCOS.items():
        if any(kw.upper() in t for kw in cfg['detectar']):
            return banco
    return None


# Marcadores por tipo: lista de (padrão_início, padrão_fim).
# Para cada tipo, tenta os padrões em ordem; usa o primeiro que casar.
# padrão_fim=None significa "até o fim do documento".
_MARCADORES = {
    'debito': [
        # Santander Internet Banking — cabeçalho da tabela → "Saldo anterior"
        (r'Data\s+Descrição.+?Docto', r'Saldo anterior'),
    ],
    'credito': [
        # Nubank — "TRANSAÇÕES DE DD MÊS A DD MÊS" (pode aparecer várias vezes)
        (r'TRANSAÇÕES DE\s+\d{2}\s+\w+\s+A\s+\d{2}', r'Em cumprimento à regulação'),
        # Santander Detalhamento
        (r'Detalhamento da Fatura', r'Resumo da Fatura'),
    ],
}


def _extrair_janela(texto, tipo):
    """
    Retorna o trecho do texto que contém os lançamentos.

    Percorre os marcadores do tipo detectado e usa o primeiro par
    início/fim que encontrar no texto. Mantém linhas com conteúdo;
    remove linhas completamente vazias dentro da janela.

    Se nenhum marcador casar, devolve o texto original (fallback seguro).
    """
    linhas = texto.split('\n')
    marcadores = _MARCADORES.get(tipo, [])

    for pat_ini, pat_fim in marcadores:
        ini = fim = None
        for i, linha in enumerate(linhas):
            if ini is None and re.search(pat_ini, linha, re.IGNORECASE):
                ini = i
            elif ini is not None and pat_fim and re.search(pat_fim, linha, re.IGNORECASE):
                fim = i
                break

        if ini is None:
            continue  # este par não casou, tenta o próximo

        janela = linhas[ini: fim]  # fim=None → até o final
        # Remove linhas puramente vazias mas preserva estrutura das demais
        janela_limpa = [l for l in janela if l.strip()]
        if janela_limpa:
            return '\n'.join(janela_limpa)

    # Nenhum marcador casou — devolve o texto original sem filtro
    return texto


# ── DETECÇÃO DE TIPO E LAYOUT VIA IA ─────────────────────────────────────

def detectar_layout(texto):
    """
    Envia as primeiras 20 linhas para a IA identificar tipo e formato.
    Custo: ~300 tokens por chamada.
    """
    primeiras_linhas = "\n".join(
        [l for l in texto.split('\n') if l.strip()][:20]
    )

    prompt = f"""Analise o cabeçalho deste documento financeiro brasileiro e retorne APENAS um JSON.

Cabeçalho:
{primeiras_linhas}

O campo "tipo" deve ser EXATAMENTE uma palavra: "debito" (extrato de conta corrente)
ou "credito" (fatura de cartão). Nunca responda "debito e credito" nem "debito ou credito".

Retorne SOMENTE este JSON sem markdown:
{{
  "tipo": "debito",
  "data": "descrição de onde fica a data, ex: início da linha no formato DD/MM/YYYY",
  "descricao": "descrição de onde fica o nome do lançamento",
  "valor": "descrição de onde fica o valor, ex: coluna débito negativa, ou última coluna antes do saldo"
}}"""

    try:
        payload = json.dumps({
            "model": "claude-sonnet-4-6",
            "max_tokens": 200,
            "messages": [{"role": "user", "content": prompt}]
        }).encode('utf-8')

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=payload,
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            texto_resp = data['content'][0]['text'].strip()
            texto_resp = re.sub(r'```json|```', '', texto_resp).strip()
            return json.loads(texto_resp)

    except Exception:
        return _detectar_layout_fallback(texto)


def _detectar_layout_fallback(texto):
    """Detecção por palavras-chave caso a IA falhe ou seja ambígua.

    Usa pontuação: conta indícios de débito (extrato de conta corrente) vs
    crédito (fatura de cartão) e escolhe o maior.
    """
    t = (texto or "").upper()

    deb_kw = [
        'EXTRATO DE CONTA CORRENTE', 'CONTA CORRENTE', 'SALDO ANTERIOR',
        'SALDO DISPONIVEL', 'SALDO DISPONÍVEL', 'EXTRATO',
    ]
    cred_kw = [
        'DETALHAMENTO DA FATURA', 'DETALHAMENTO DE FATURA', 'FATURA',
        'LIMITE DE CREDITO', 'LIMITE DE CRÉDITO', 'VENCIMENTO DA FATURA',
        'CARTAO DE CREDITO', 'CARTÃO DE CRÉDITO', 'PAGAMENTO MINIMO', 'PAGAMENTO MÍNIMO',
    ]
    deb = sum(1 for k in deb_kw if k in t)
    cred = sum(1 for k in cred_kw if k in t)

    if cred > deb:
        return {"tipo": "credito"}
    if deb > cred:
        return {"tipo": "debito"}
    return None


def _resolver_tipo(layout, texto):
    """Normaliza o 'tipo' da IA para 'debito' | 'credito' | None.

    A IA às vezes devolve valores não canônicos ("debito e credito",
    "débito", etc.). Quando não for um valor limpo, decide pelo conteúdo
    do texto via detecção por palavra-chave.
    """
    t = ((layout or {}).get('tipo') or '').strip().lower()
    t = t.replace('é', 'e').replace('í', 'i')  # débito→debito, crédito→credito

    if t == 'debito':
        return 'debito'
    if t == 'credito':
        return 'credito'

    # Valor ambíguo/inesperado → decide pelo texto
    fb = _detectar_layout_fallback(texto)
    if fb:
        return fb['tipo']

    # Último recurso: se só uma das palavras aparece na resposta, usa ela
    tem_deb = 'debito' in t
    tem_cred = 'credito' in t
    if tem_deb and not tem_cred:
        return 'debito'
    if tem_cred and not tem_deb:
        return 'credito'
    return None


# ── EXTRAÇÃO DE LANÇAMENTOS VIA IA ────────────────────────────────────────

# Limite de caracteres do texto enviado à IA (evita custo/erro em PDFs enormes)
_MAX_CHARS_IA = 120000

# O system prompt é idêntico em todas as chamadas — candidato perfeito para
# prompt caching da Anthropic (cache_control: ephemeral). Tokens em cache
# custam ~10x menos que tokens normais no input.
_SYSTEM_EXTRACAO_TEXTO = (
    "Você extrai TODOS os lançamentos de um documento financeiro brasileiro, "
    "que pode ser um extrato de conta corrente OU uma fatura de cartão de crédito "
    "(de qualquer banco/layout). Responda APENAS com JSON válido, sem nenhum texto "
    "fora dele, exatamente neste formato:\n"
    '{"tipo":"debito|credito","lancamentos":[{"data":"DD/MM/AAAA","descricao":"...","valor":-123.45}]}\n'
    "Regras:\n"
    "- \"tipo\": \"debito\" se for extrato de conta corrente; \"credito\" se for fatura de cartão.\n"
    "- Extraia somente LANÇAMENTOS reais. IGNORE cabeçalhos, linhas de saldo, "
    "\"saldo anterior\", totais, resumos e páginas de contato/telefones.\n"
    "- \"data\": sempre DD/MM/AAAA. Se o ano não aparecer na linha, infira pelo "
    "período/vencimento do documento.\n"
    "- \"descricao\": o NOME do estabelecimento/lançamento como aparece, sem limpar, "
    "abreviar ou traduzir (mantenha prefixos como 'PIX ENVIADO', "
    "'COMPRA CARTAO DEB MC 28/05', 'TED ENVIADA', etc.). NÃO inclua na descrição a "
    "máscara/identificação do cartão (ex.: '•••• 3776', '···· 1234', 'final 4326') "
    "nem o número do docto — isso identifica o cartão, não o gasto. A descrição é "
    "sempre o nome do comércio (ex.: de '•••• 3776 Botequim Paulista' use 'Botequim Paulista').\n"
    "- \"valor\": número decimal. Saídas/débitos/despesas NEGATIVOS; "
    "entradas/créditos/recebimentos POSITIVOS.\n"
    "- COMPLETUDE: faturas de cartão têm VÁRIAS seções (ex.: 'Parcelamentos', "
    "'Despesas') e às vezes MAIS DE UM cartão (uma 2ª linha de titular/numeração, "
    "ex.: '@ ALAN ... 5428 ...'). Extraia de TODAS as seções e de TODOS os cartões — "
    "não pare na primeira seção. Não pule nenhuma linha de compra.\n"
    "- Ignore um número de PARCELA solto antes da data (ex.: um '3' ou '2' isolado, "
    "que indica compra em 3x/2x) — ele não faz parte da descrição nem do valor.\n"
    "- Compras internacionais têm duas colunas de valor (R$ e US$): use SEMPRE o valor "
    "em R$ (reais), NUNCA o valor em US$. 'COTAÇÃO DOLAR' é só a taxa de câmbio e NÃO é "
    "lançamento; já 'IOF' é uma cobrança real e DEVE ser extraído.\n"
    "- NÃO extraia o pagamento da própria fatura como lançamento: linhas como "
    "'PAGAMENTO DE FATURA', 'PAGAMENTO RECEBIDO', 'PAGAMENTO INTERNET' ou 'Pagamento em "
    "DD MMM' são quitações da fatura, não compras — ignore-as. (Em EXTRATO de conta, "
    "'PAGAMENTO CARTAO CREDITO'/'DEBITO AUT FAT' É um lançamento real e deve entrar.)\n"
    "- Ignore linhas de anuidade com valor 0,00 e quaisquer totais/subtotais ('VALOR TOTAL').\n"
    "- NÃO invente lançamentos; extraia apenas o que está no texto."
)

# Formato com cache_control para a API (lista de blocos de sistema)
_SYSTEM_EXTRACAO = [
    {
        "type": "text",
        "text": _SYSTEM_EXTRACAO_TEXTO,
        "cache_control": {"type": "ephemeral"},   # reutilizado entre chamadas
    }
]


def _ano_referencia(texto):
    """Ano de referência do documento (vencimento/período), para datar lançamentos
    que vêm só com DD/MM. Procura no início do texto, onde fica o cabeçalho."""
    t = (texto or "")[:4000]
    m = re.search(r'vencimento[^\d]{0,25}\d{2}/\d{2}/(\d{4})', t, re.IGNORECASE)
    if m: return m.group(1)
    m = re.search(r'per[ií]odo[^\d]{0,40}\d{2}/\d{2}/(\d{4})', t, re.IGNORECASE)
    if m: return m.group(1)
    m = re.search(r'\b(\d{2})\s+[A-Za-zçÇ]{3,}\s+(\d{4})\b', t)   # "09 DEZ 2025"
    if m: return m.group(2)
    m = re.search(r'\d{2}/\d{2}/(\d{4})', t)
    if m: return m.group(1)
    m = re.search(r'\b(20\d{2})\b', t)
    if m: return m.group(1)
    return None


def extrair_lancamentos_ia(texto, ano_ref=None):
    """Extrai os lançamentos do extrato/fatura usando a IA (robusto a layouts variados).

    Recebe o texto já pré-filtrado pela janela de lançamentos. `ano_ref` é o ano
    de referência calculado a partir do texto COMPLETO (a janela pode cortar o
    cabeçalho com o vencimento) — usado para datar lançamentos só com DD/MM.
    Retorna (tipo, lancamentos) no mesmo formato dos parsers por regex.
    Levanta exceção se a chamada falhar — o chamador trata o fallback.
    """
    # Remove a máscara do cartão (ex.: '•••• 3776') ANTES de enviar à IA. Sem
    # isso, em faturas como a do Nubank a IA às vezes confunde o identificador do
    # cartão com o nome do estabelecimento e devolve a descrição como '•••• 3776'.
    texto = re.sub(r'[•·∙●◦°]{2,}\s*\d{3,6}', ' ', texto)

    # Injeta o ano de referência no USER message (não no system, para preservar o
    # prompt cache). Resolve o caso em que a IA "chuta" o ano de datas só DD/MM.
    # Prioriza o ano vindo do texto completo (ano_ref); só recalcula se não veio.
    ano = ano_ref or _ano_referencia(texto)
    prefixo = (
        f"ANO DE REFERÊNCIA do documento: {ano}. Use {ano} como ano das datas que "
        f"vierem só com DD/MM, EXCETO parcelas cujo mês seja claramente de um ano "
        f"anterior ao período da fatura.\n\n"
    ) if ano else ""
    conteudo = prefixo + texto[:_MAX_CHARS_IA]
    # Sanitiza caracteres de CONTROLE (mantém \t \n \r). O OCR (Tesseract) às vezes
    # emite bytes de controle/NUL que a API rejeita com HTTP 400.
    conteudo = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', ' ', conteudo)
    if not conteudo.strip():
        raise RuntimeError("texto vazio após extração/OCR — nada para enviar à IA")

    payload = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": 16000,
        "system": _SYSTEM_EXTRACAO,          # lista com cache_control
        "messages": [{"role": "user", "content": conteudo}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Surfaca a mensagem REAL da API (o "400 Bad Request" cru não diz a causa)
        try:
            corpo = e.read().decode("utf-8", "replace")[:600]
        except Exception:
            corpo = ""
        raise RuntimeError(f"API {e.code}: {corpo or e.reason}")

    texto_resp = re.sub(r'```json|```', '', data['content'][0]['text']).strip()
    # A IA às vezes escreve texto explicativo antes/depois do JSON — extrai o
    # objeto {...} pelo primeiro '{' e o último '}'.
    ini, fim = texto_resp.find('{'), texto_resp.rfind('}')
    if ini != -1 and fim != -1 and fim > ini:
        texto_resp = texto_resp[ini:fim + 1]
    obj = json.loads(texto_resp)

    # Normaliza o tipo do documento; se vier inconclusivo, decide pelo texto
    t = (obj.get('tipo') or '').strip().lower().replace('é', 'e').replace('í', 'i')
    tipo = 'debito' if 'debito' in t else ('credito' if 'credito' in t else None)
    if not tipo:
        fb = _detectar_layout_fallback(texto)
        tipo = fb['tipo'] if fb else 'debito'
    tipo_lanc = 'Débito' if tipo == 'debito' else 'Crédito'

    lancamentos = []
    for item in obj.get('lancamentos', []) or []:
        d = str(item.get('data') or '').strip()
        if not re.match(r'^\d{2}/\d{2}/\d{4}$', d):
            continue
        desc = str(item.get('descricao') or '').strip()
        if not desc:
            continue
        try:
            valor = float(item.get('valor'))
            dt = datetime.strptime(d, '%d/%m/%Y')
        except (TypeError, ValueError):
            continue
        lancamentos.append({
            'mes': f"{dt.month}/{dt.year}",
            'data': d,
            'descricao': desc,
            'valor': valor,
            'tipo': tipo_lanc,
        })

    return tipo, lancamentos


# ── PARSER DE DÉBITO ──────────────────────────────────────────────────────

def parse_extrato_debito(texto):
    """
    Parseia extrato de conta corrente extraído via pdftotext -layout.

    Estratégia:
      1. Âncora pelo DOCTO (5-6 dígitos isolado por espaços) para separar a
         descrição (antes) dos valores (depois).
      2. O extrato Santander traz as colunas [Crédito | Débito | Saldo] após o
         docto, sempre nessa ordem da esquerda para a direita. Em cada linha de
         lançamento aparecem 2 valores: o do lançamento (crédito OU débito) e o
         saldo. O lançamento é SEMPRE o PRIMEIRO valor (mais à esquerda) e o
         saldo é SEMPRE o ÚLTIMO (mais à direita) — este é descartado.
      3. Sinal: o próprio valor já traz o sinal correto no texto
         (débitos vêm como -136,05; créditos como 0,01 ou 1.743,61).

    Usar a ORDEM das colunas (e não a contagem nem a posição absoluta do
    caractere) torna a leitura robusta a indentação e a variações de largura
    de coluna entre páginas/extratos.
    """
    ignorar_desc = [
        'SALDO', 'LIMITE', 'SITUACAO', 'DOCTO', 'CREDITO (R$)',
        'DATA', 'DESCRICAO', 'PERIODO', 'SALDO ANTERIOR'
    ]

    lancamentos = []

    for linha in texto.split('\n'):
        # Linha deve começar com DD/MM/YYYY (tolera espaços à esquerda da indentação)
        m_data = re.match(r'\s*(\d{2}/\d{2}/\d{4})', linha)
        if not m_data:
            continue

        data_str = m_data.group(1)
        resto = linha[m_data.end():]

        if not resto.strip():
            continue
        if any(ig in resto.upper() for ig in ignorar_desc):
            continue

        # Âncora: bloco de 5-6 dígitos isolado por espaços (número do docto)
        m_docto = re.search(r'\s+(\d{5,6})\s+', resto)
        if not m_docto:
            continue

        # Descrição: tudo antes do docto
        desc = resto[:m_docto.start()].strip()
        if not desc:
            continue

        # Valores após o docto, na ordem da esquerda para a direita.
        # 1º valor = lançamento (coluna crédito/débito); último = saldo (descartado).
        apos_docto = resto[m_docto.end():]
        valores = re.findall(r'-?\d{1,3}(?:\.\d{3})*,\d{2}', apos_docto)
        if not valores:
            continue
        valor_str = valores[0]

        try:
            valor = float(valor_str.replace('.', '').replace(',', '.'))
            data = datetime.strptime(data_str, '%d/%m/%Y')
        except ValueError:
            continue

        lancamentos.append({
            'mes': f"{data.month}/{data.year}",
            'data': data_str,
            'descricao': desc,
            'valor': valor,
            'tipo': 'Débito'
        })

    return lancamentos


# ── PARSER DE CRÉDITO ─────────────────────────────────────────────────────

def parse_fatura_credito(texto, ano_fatura=None):
    """
    Parseia fatura de cartão de crédito extraída via pdftotext -layout.
    Suporta layout de duas colunas do Santander.
    """
    if not ano_fatura:
        m = re.search(r'Vencimento\s+\d{2}/\d{2}/(\d{4})', texto)
        ano_fatura = int(m.group(1)) if m else datetime.now().year

    ignorar_desc = [
        'DEB AUTOM', 'COTACAO', 'COTAÇÃO', 'IOF DESPESA',
        'COMPRA', 'DATA', 'DESCRI', 'PARCELA',
        'PAGAMENTO E DEMAIS', 'PARCELAMENTOS', 'DESPESAS',
        'RESUMO', 'VALOR TOTAL', 'SALDO', 'JUROS'
    ]

    lancamentos = []
    vistos = set()
    em_secao = False

    for linha in texto.split('\n'):
        ls = linha.strip()
        if not ls:
            continue

        # Controle de seção
        if re.search(r'\b(Parcelamentos|Despesas)\b', ls):
            em_secao = True
            continue
        if re.match(r'^(Resumo|VALOR TOTAL|Juros|Saldo)', ls):
            em_secao = False
            continue
        if not em_secao:
            continue

        if re.search(r'Compra\s+Data\s+Descri|R\$\s+US\$', ls):
            continue

        # Encontrar todas as posições de DD/MM na linha (suporte a 2 colunas)
        posicoes = [m.start() for m in re.finditer(r'\d{2}/\d{2}(?!\d)', ls)]
        if not posicoes:
            continue

        for i, pos in enumerate(posicoes):
            if i + 1 < len(posicoes):
                prox = posicoes[i + 1]
                m_pref = re.search(r'\s+[\d@]{1,2}\s+$', ls[:prox])
                fim = m_pref.start() if m_pref else prox
            else:
                fim = len(ls)

            trecho = ls[pos:fim].strip()
            item = _parse_trecho_credito(trecho, ano_fatura, ignorar_desc)
            if item:
                chave = (item['data'], item['descricao'], item['valor'])
                if chave not in vistos:
                    vistos.add(chave)
                    lancamentos.append(item)

    return lancamentos


def _parse_trecho_credito(trecho, ano_fatura, ignorar_desc):
    """Parseia um trecho 'DD/MM DESC [XX/YY] VALOR' da fatura de crédito."""
    m = re.match(
        r'^(\d{2}/\d{2})\s+'
        r'(.+?)\s+'
        r'(?:(\d{2}/\d{2})\s+)?'
        r'(-?\d{1,3}(?:\.\d{3})*,\d{2})'
        r'(?:\s+\d{1,3}(?:\.\d{3})*,\d{2})?\s*$',
        trecho.strip()
    )
    if not m:
        return None

    data_curta = m.group(1)
    desc = m.group(2).strip()
    parcela = m.group(3)
    valor_str = m.group(4)

    desc_upper = desc.upper()
    if any(ig in desc_upper for ig in ignorar_desc):
        return None
    if desc_upper in ['DESCRIÇÃO', 'DESCRICAO', 'DATA', 'COMPRA']:
        return None
    if 'ANUIDADE' in desc_upper and valor_str in ['0,00', '-0,00']:
        return None

    try:
        valor = -float(valor_str.replace('.', '').replace(',', '.'))
        mes_num = int(data_curta.split('/')[1])
        ano = ano_fatura if mes_num <= (datetime.now().month + 2) else ano_fatura - 1
        return {
            'data': f"{data_curta}/{ano}",
            'mes': f"{mes_num}/{ano}",
            'descricao': f"{desc} ({parcela})" if parcela else desc,
            'valor': valor,
            'tipo': 'Crédito'
        }
    except Exception:
        return None


# ── ENTRADA PRINCIPAL ─────────────────────────────────────────────────────

def _reconstruir_linhas_pdfplumber(pdf_bytes, senha=None):
    """Reconstrói as linhas do PDF agrupando as palavras pela coordenada Y (top).

    Necessário porque o pdftotext -layout, em alguns extratos Santander, agrupa
    as colunas em linhas trocadas (o crédito de um lançamento cai na linha de
    outro). As palavras têm a posição correta — basta agrupá-las por Y e ordenar
    por X para remontar cada linha fielmente. Retorna o texto (uma linha por
    'top') ou None se falhar.
    """
    try:
        import pdfplumber
        linhas = []
        open_kwargs = {'password': senha} if senha else {}
        with pdfplumber.open(io.BytesIO(pdf_bytes), **open_kwargs) as pdf:
            for pg in pdf.pages:
                palavras = pg.extract_words(use_text_flow=False, keep_blank_chars=False)
                grupo = []
                for w in sorted(palavras, key=lambda w: w['top']):
                    if grupo and abs(w['top'] - grupo[0]['top']) <= 5:
                        grupo.append(w)
                    else:
                        if grupo:
                            linhas.append(grupo)
                        grupo = [w]
                if grupo:
                    linhas.append(grupo)
        out = []
        for r in linhas:
            r.sort(key=lambda w: w['x0'])
            out.append(' '.join(w['text'] for w in r))
        return '\n'.join(out) if out else None
    except Exception:
        return None


# ── OCR (PDFs baseados em imagem, ex.: XP) ────────────────────────────────

_TESSERACT_CANDIDATOS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe",
    "/usr/bin/tesseract", "/usr/local/bin/tesseract",
]


def _achar_tesseract():
    """Localiza o binário do Tesseract (PATH, env TESSERACT_PATH ou locais conhecidos)."""
    achado = shutil.which("tesseract") or os.environ.get("TESSERACT_PATH")
    if achado and os.path.exists(achado):
        return achado
    for c in _TESSERACT_CANDIDATOS:
        c = os.path.expandvars(c)
        if os.path.exists(c):
            return c
    return None


def _extrair_texto_ocr(pdf_bytes, senha=None):
    """Extrai texto de PDF-imagem via OCR (PyMuPDF renderiza + Tesseract lê).

    Degrada com clareza: se faltarem as libs Python ou o binário do Tesseract,
    levanta um erro acionável (em vez de quebrar genericamente). Assim os PDFs
    com texto continuam 100%, e só o caso de imagem (XP) exige o OCR instalado.
    """
    try:
        import fitz                       # PyMuPDF
        import pytesseract
        from PIL import Image
    except ImportError as e:
        raise RuntimeError(
            "Este PDF parece ser baseado em imagem (sem texto extraível) e precisa "
            "de OCR. Instale as dependências no backend: "
            "pip install pymupdf pytesseract Pillow. "
            f"(faltando: {e})"
        )

    tess = _achar_tesseract()
    if not tess:
        raise RuntimeError(
            "PDF baseado em imagem: é necessário o Tesseract OCR instalado. No Windows, "
            "baixe o instalador (UB Mannheim) incluindo o idioma Português, ou aponte a "
            "variável de ambiente TESSERACT_PATH para o tesseract.exe."
        )
    pytesseract.pytesseract.tesseract_cmd = tess

    # Idioma: prefere Português. Se houver um por.traineddata local (backend/
    # tessdata/ — não precisa de admin), usa via --tessdata-dir. Senão, tenta o
    # 'por' do sistema; se nem isso, cai para 'eng' (o conteúdo é quase todo
    # numérico/ASCII, então o inglês ainda lê bem).
    config = '--psm 6'
    lang = 'por'
    _local_tessdata = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tessdata')
    if os.path.exists(os.path.join(_local_tessdata, 'por.traineddata')):
        # TESSDATA_PREFIX é a forma robusta de apontar a pasta (o --tessdata-dir
        # via config-string do pytesseract quebra com barras/aspas no Windows).
        os.environ['TESSDATA_PREFIX'] = _local_tessdata
    else:
        try:
            if 'por' not in set(pytesseract.get_languages(config='')):
                lang = 'eng'
        except Exception:
            pass

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if senha:
        doc.authenticate(str(senha))

    texto = ""
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(3, 3))   # 3x zoom ~216 DPI
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        texto += pytesseract.image_to_string(img, lang=lang, config=config) + "\n"
    return texto


def _valor_br(s):
    """Converte um valor monetário BR para float, tolerante a variações do OCR.

    O ÚLTIMO separador (',' ou '.') é o decimal; os anteriores são de milhar e
    são removidos. Cobre '1.051,79', '1,051,79', '601,80'. Sem separador, o OCR
    grudou os centavos (ex.: '16910' = 169,10) → divide por 100.
    Mantém o sinal ('-99,99' → -99.99). Retorna None se não for número.
    """
    s = (s or "").strip()
    neg = s.startswith('-')
    s = s.lstrip('-').strip()
    m = re.search(r'[.,](\d{2})$', s)
    try:
        if m:
            inteiro = re.sub(r'\D', '', s[:m.start()]) or '0'
            val = float(f"{inteiro}.{m.group(1)}")
        else:
            digitos = re.sub(r'\D', '', s)
            if not digitos:
                return None
            val = float(digitos) / 100        # centavos grudados pelo OCR
    except ValueError:
        return None
    return -val if neg else val


def parse_fatura_xp(texto_ocr):
    """Parser dedicado à fatura XP (PDF-imagem) já passada por OCR.

    Formato: DD/MM/YY  Descrição  R$  [US$]. No texto o valor de saída é
    POSITIVO (vira negativo aqui); entradas vêm com '-' explícito (viram +).
    """
    ignorar_kw = {
        'subtotal', 'pagamento de fatura', 'pagamentos/créditos', 'pagamentos / créditos',
        'saldo financiado', 'saldo credor', 'despesas até', 'total da fatura',
        'valor total devido', 'fatura fechada', 'próximo fechamento', 'melhor dia',
        'resumo da sua', 'limite total', 'limite utilizado', 'as informações',
        'data', 'descrição', 'lançamentos',
    }
    # O valor casa tanto o formato normal (1.234,56) quanto um valor "grudado"
    # pelo OCR (ex.: 16910 = 169,10), corrigido logo abaixo.
    PAT = re.compile(
        r'^(\d{2}/\d{2}/\d{2})\s+'
        r'(.+?)\s+'
        r'(-?(?:\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d{3,}))\s*'
        r'(?:-?(?:\d+[.,]\d{2}|\d{3,}))?\s*$'
    )
    lancamentos = []
    for linha in texto_ocr.split('\n'):
        ls = linha.strip()
        if not ls or any(ig in ls.lower() for ig in ignorar_kw):
            continue
        m = PAT.match(ls)
        if not m:
            continue
        data_str, desc, valor_str = m.group(1), m.group(2).strip(), m.group(3)
        desc = re.sub(r'\s*-\s*Parcela\s+\d+/\d+', '', desc, flags=re.IGNORECASE).strip()
        try:
            d = datetime.strptime(data_str, '%d/%m/%y')
        except ValueError:
            continue
        v = _valor_br(valor_str)
        if v is None:
            continue
        # No texto XP a saída é POSITIVA (vira negativa); estorno vem com '-'
        # (vira positiva).
        valor = -v
        lancamentos.append({
            'mes':       f"{d.month}/{d.year}",
            'data':      d.strftime('%d/%m/%Y'),
            'descricao': desc,
            'valor':     round(valor, 2),
            'tipo':      'Crédito',
        })
    return lancamentos


def processar_pdf(pdf_bytes, nome_arquivo="", senha=None):
    """
    Função principal chamada pelo main.py.
    Retorna (tipo, lancamentos) onde tipo é 'debito' ou 'credito'.

    Fluxo otimizado:
      1. Extrai texto do PDF (pdftotext ou pdfplumber)
      2. Detecta tipo (débito/crédito) por palavras-chave — custo zero
      3. Débito Santander → regex direto (100% de acerto, sem custo de API)
      4. Qualquer outro caso → pré-filtro de janela + IA
         • pré-filtro corta 60-80% dos tokens antes de enviar à IA
         • system prompt com cache_control reduz custo das chamadas repetidas
      5. Sem chave de API → fallback por regex best-effort
    """
    # ── Passo 1: extrai texto; se vier vazio é PDF-imagem → OCR ───────────
    texto = extrair_texto_pdf(pdf_bytes, senha)
    via_ocr = False
    if not texto or len(texto.strip()) < 40:
        texto = _extrair_texto_ocr(pdf_bytes, senha)   # erro acionável se faltar OCR
        via_ocr = True

    # ── Passo 2: detecta o banco/layout pelo cabeçalho (grátis) ───────────
    banco = _detectar_banco(texto)
    cfg = _CATALOGO_BANCOS.get(banco, {})
    tipo_lancamento = cfg.get('tipo_lancamento') or _detectar_tipo_rapido(texto) or 'credito'

    # ── Passo 3a: Santander Débito → reconstrução por coordenada + regex ──
    # O pdftotext -layout embaralha as colunas; reconstruindo pela coordenada Y
    # (pdfplumber) o regex por posição acerta 100% — sem custo de API. Cobre tb
    # o débito identificado só pelo tipo (sem banco no catálogo).
    if banco == 'santander_debito' or (banco is None and tipo_lancamento == 'debito'):
        for candidato in (_reconstruir_linhas_pdfplumber(pdf_bytes, senha), texto):
            if not candidato:
                continue
            lancs_regex = parse_extrato_debito(candidato)
            if lancs_regex:
                return 'debito', lancs_regex

    # ── Passo 3b: XP / qualquer fatura-imagem → parser dedicado pós-OCR ────
    # Em PDF-imagem (via OCR) tentamos o parser XP mesmo SEM detectar o banco: o
    # cabeçalho costuma sair ruim no OCR (logo XP é imagem), mas o corpo
    # (DD/MM/YY ... valor) casa. Se não casar nada, cai para a IA.
    if banco == 'xp' or via_ocr:
        lancs_xp = parse_fatura_xp(texto)
        if lancs_xp:
            return 'credito', lancs_xp

    # ── Passo 3c: todo o resto → pré-filtro de janela + IA ────────────────
    if ANTHROPIC_API_KEY:
        texto_filtrado = _extrair_janela(texto, tipo_lancamento)
        # Ano vem do texto COMPLETO: a janela pode ter cortado o cabeçalho com o
        # vencimento (ex.: Santander Elite), e sem isso a IA chuta o ano.
        ano_ref = _ano_referencia(texto)

        ultimo_erro = None
        for _ in range(2):  # 1 tentativa + 1 retry (cobre blips de rede)
            try:
                tipo_ia, lancs_ia = extrair_lancamentos_ia(texto_filtrado, ano_ref=ano_ref)
                if lancs_ia:
                    return tipo_ia, lancs_ia
                ultimo_erro = "a IA não retornou lançamentos"
            except Exception as e:
                ultimo_erro = str(e)
        raise RuntimeError(f"Falha ao extrair lançamentos via IA: {ultimo_erro}")

    # ── Sem chave de API → fallback por regex (best-effort) ───────────────
    if tipo_lancamento == 'debito':
        return 'debito', parse_extrato_debito(texto)
    return 'credito', parse_fatura_credito(texto)
