import re
import os
import io
import json
import subprocess
import tempfile
import urllib.request
from datetime import datetime

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


# ── EXTRAÇÃO DE TEXTO ─────────────────────────────────────────────────────

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
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        cmd = ['pdftotext', '-layout']
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

    # Fallback: pdfplumber
    try:
        import pdfplumber
        texto = ""
        open_kwargs = {'password': senha} if senha else {}
        with pdfplumber.open(io.BytesIO(pdf_bytes), **open_kwargs) as pdf:
            for page in pdf.pages:
                texto += (page.extract_text() or "") + "\n"
        return texto
    except Exception as e:
        raise RuntimeError(f"Não foi possível extrair texto do PDF: {e}")


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

Retorne SOMENTE este JSON sem markdown:
{{
  "tipo": "debito ou credito",
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
    """Detecção por palavras-chave caso a IA falhe."""
    t = texto.upper()
    if 'EXTRATO DE CONTA CORRENTE' in t:
        return {"tipo": "debito"}
    if 'DETALHAMENTO DA FATURA' in t or 'DETALHAMENTO DE FATURA' in t:
        return {"tipo": "credito"}
    return None


# ── PARSER DE DÉBITO ──────────────────────────────────────────────────────

def parse_extrato_debito(texto):
    """
    Parseia extrato de conta corrente extraído via pdftotext -layout.

    Estratégia: usa o número do docto (5-6 dígitos isolado por espaços)
    como âncora para separar descrição (antes) dos valores (depois).
    Penúltimo valor = lançamento, último valor = saldo (descartado).
    Robusto a variações de largura de coluna entre páginas.
    """
    ignorar_desc = [
        'SALDO', 'LIMITE', 'SITUACAO', 'DOCTO', 'CREDITO (R$)',
        'DATA', 'DESCRICAO', 'PERIODO', 'SALDO ANTERIOR'
    ]

    lancamentos = []

    for linha in texto.split('\n'):
        # Linha deve começar com DD/MM/YYYY
        if not re.match(r'^\d{2}/\d{2}/\d{4}', linha):
            continue

        data_str = linha[0:10]
        resto = linha[10:].strip()

        if not resto:
            continue
        if any(ig in resto.upper() for ig in ignorar_desc):
            continue

        # Âncora: bloco de 5-6 dígitos isolado por espaços (número do docto)
        m_docto = re.search(r'\s+(\d{5,6})\s+', resto)
        if not m_docto:
            continue

        # Descrição: tudo antes do docto
        desc_raw = resto[:m_docto.start()].strip()

        # Valores: tudo após o docto — penúltimo=lançamento, último=saldo
        apos_docto = resto[m_docto.end():]
        valores = re.findall(r'-?\d{1,3}(?:\.\d{3})*,\d{2}', apos_docto)

        if len(valores) >= 2:
            valor_str = valores[-2]
        elif len(valores) == 1:
            valor_str = valores[0]
        else:
            continue

        valor = float(valor_str.replace('.', '').replace(',', '.'))

        desc = desc_raw.strip()

        if not desc:
            continue

        try:
            data = datetime.strptime(data_str, '%d/%m/%Y')
            mes = f"{data.month}/{data.year}"
        except ValueError:
            continue

        lancamentos.append({
            'mes': mes,
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

def processar_pdf(pdf_bytes, nome_arquivo="", senha=None):
    """
    Função principal chamada pelo main.py.
    Retorna (tipo, lancamentos) onde tipo é 'debito' ou 'credito'.
    """
    texto = extrair_texto_pdf(pdf_bytes, senha)
    layout = detectar_layout(texto)

    if not layout:
        raise ValueError("Não foi possível identificar o tipo do arquivo PDF.")

    tipo = layout.get('tipo')

    if tipo == 'debito':
        lancamentos = parse_extrato_debito(texto)
    elif tipo == 'credito':
        lancamentos = parse_fatura_credito(texto)
    else:
        raise ValueError(f"Tipo de documento não reconhecido: {tipo}")

    return tipo, lancamentos
