import re
import os
import json
import urllib.request
from pathlib import Path

# Carrega .env se existir (ANTHROPIC_API_KEY, etc.)
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# ── REGRAS FIXAS ─────────────────────────────────────────────────────────
KEYWORDS = {
    'SA': ['LIQUIDO DE VENCIMENTO','CREDITO DE SALARIO','SALARIO',
           'PAGAMENTO A FORNECEDORES','PAGAMENTO FORNECEDORES','FUNDACAO CESP'],
    'I':  ['REMUNERACAO APLICACAO','TED ENVIADA','TED RECEBIDA ALAN FRANZINI',
           'ALAN FRANZINI CHATTON','ESTORNO DE LANCAMENTO','RENDIMENTO'],
    'F':  ['PAGAMENTO CARTAO CREDITO','DEB AUTOM DE FATURA','ANUIDADE DIFERENCIADA',
           'PAGAMENTO FATURA','DEBITO FATURA','DEB AUT. FAT','CARTAO MASTER',
           'PAGAMENTO DE FATURA'],
    'CA': ['BOLETO OUTROS BANCOS','ELETROPAULO','SANEAMENTO','SABESP','ENEL',
           'GRPQA','JOAO ANTONIO DE VASCONCEL','JOAO ANTONIO V GLOEDEN',
           'FLAVIA PEREIRA','FABIO BRAZIL XAVIER','CLAUDIONOR TORRES'],
    'S':  ['RAIA','DROGARIA','DROGASIL','FARMACONDESA','FARMACONDE','FARMACIA',
           'FARMACIAPAGUE','OLIVIA GIANNELLA','CELITA ACACIO','CELITA ACACIA',
           'GONCALVES MEDICINA','DEMERGE','MR TITO','RDSAUDE','MAZZA E MARTINS'],
    'E':  ['PAULA SOUZA DIAS','ASSOCIACAO DOS ANALISTAS','ANTONINO TRIPODI'],
    'A':  ['GOOGLE','NETFLIX','OPENAI','CHATGPT','HBO MAX','AMAZON PRIME','AMAZON DIGITAL',
           'AMAZON KINDLE','CLARO FLEX','STEAM','EDITORA O GLOBO',
           'IOF DESPESA NO EXTERIOR','99INAPPPAYMENTCAPTURE','MELIMAIS',
           'BUMBLE','THE NEW YORK TIMES','AMAZON BR','AMAZONPRIMEBR',
           'VIVO SP','IOF DESPESA EXTERIOR','IFOOD CLUB','IFOOD CLUBE'],
    'T':  ['99APP','99 RIDE','UBER','AUTOPASS','LOCALIZA','METRO SAO PAULO','METRO RJ',
           'PRODATA','TAMOIOS','WHOOSH','TAXI','SHELL','POSTO',
           'POP ','LATAM','EUCATUR','MULTA - FOCO'],
    'M':  ['MAMBO','SUPERMERCADO','MINI EXTRA','CARREFOUR','PAO DE ACUCAR','OXXO',
           'CORIOLANO','SACOLAO','OBA HORTIFRUTI','MINUTO PA','AVICOLA',
           'MERCADO CIPRIANI','MERCADO VITORIA','MERCADO SANTANA','MERCADO VIZEU',
           'MERCEARIA','ST MARCHE','JDM COMERCIO DE ALIM','MERCADO O PIONEIRO',
           'BOM GOSTO EMPORIO','COMERCIALDE'],
    'C':  ['KEETA','RAPPI','IFOOD','99FOOD','99 FOOD','FOOD TO SAVE','PADARIA','PANIFICACAO',
           'RESTAURANTE','SUBWAY','MCDONALD','BACIO DI LATTE','CAS RESTAURANTE',
           'PAPILA','BRASILCAFE','HERA VEGGIE','CAJOOKIE','PARADA OBRIGATORIA',
           'MUCHEN','QUINTALBUTIA','JOAO HENRIQUE MASUTTI','LANCHONETE',
           'AR FOODS','CONVENIENCIA','CAFE COM CACAU','DONA TEREZA BONELA',
           'POINT DO SURF','MAIA OLIVEIRA PANIFICA'],
    'B':  ['MERCADOLIVRE','MERCADO LIVRE','PIX MARKETPLACE','ANIS RAZUK',
           'VETSTECNOLOGIA','KALUNGA','MERCADOPAGO *BOEINGIN'],
    'O':  ['SAQUE DINHEIRO','TARIFA TEDELETRONICO','GILLES YVES CHATTON'],
    'R':  ['YLMR FRANCO','MODA MUNDIAL','VILA ROMANA','NOVADONNACAROLINA','BAW'],
    'L':  ['BANCA','ZIG','BOTEQUIM','LUARDEPARATY','PICCO','PIZZARIA','SORVETERIA','LIBANINHO','RANCHINHO',
           'VELHO MACK','ALAMBIQUE','DIVINA FUMACA','SYMPLA','INGRESSE','INGRESSO',
           'PAGAR ME','TONKS','BOOK HOBBY','HRG 3 INVEST','SCP COMPLETO',
           'RODRIGO SAVAGLIA','JOAQUIM MUYLAERT','JOAQUIM FIGUEIREDO','RODRIGO CASTILHO',
           'RODRIGO DULCINE','PEDRO GAMA','JOAO SABINO','JOAO RENATO PACCE','CAUA FEDER',
           'LUCAS OLIVEIRA','GUILHERME ALEXANDRE','PAULO EDUARDO DE SOUZA',
           'JULIANA MAIA LIMA','ROSELI DE SOUZA','DLOCAL','VELOX TICKETS',
           'SUPERTICKET','CINEMA','HOPPIN','QUIOSQUE','LUZINETE','HOUS COFFEE',
           'TREELAB','DINAMITE','IMBURANAS','MEP VACARI','SPAZIO','MARIAGABRIEL',
           'FELIPE GOMES','HOSTEL','HOTEL','BAR ','NOSSA PRAIA','RAIMUNDADEMELODOS',
           'MDREVENTOS','ESPACOCULTURAL','REDECINE','SARAH VASCONCELOS','JOAQUIM MERKEL',
           'ANTONIO RIBEIRO DA LUZ','FABIO GOMES','SABRINA BISPO','MARCO AURELIO SANTOS',
           'MARINA DOLABELA','OHMADALENABAR','BECO DA USP','MA COQUETELARIA',
           'MANO DO CEU','BRASS BREW','SHINEBAR','QUITANDINHA','MOACIR BAR',
           'CARAMELO','SARAVA','MARE ALTA','BAR FAVELA','HOTEL PATIO','CABANAE',
           'RODOSNACK','MORADA DO SOL','SABIA DO PARQUE','SAL GAROPABA',
           'MATOSZKO','LAPAZA','EMPORIO ITAMAMBUCA','TOPSTOP','LOJA 26',
           'CANTINHO DO LEBLON','BELMONTE IPANEMA','KIS SHOW','MANOEL E JUAQUIM',
           'BURGER X','PANIF CONF GRAN RIO','LUIZ GUSTAVO EVENTOS','TAPIOCARIA',
           'VENDEDOR AMBULANTES','SP SPO AV PAULISTA','CHAVE DE OURO','AVENDINHA',
           'ESTACAO J GOURMET','SCP ESTACIONAMENTO','RPC REDE PONTO',
           'FERNANDOFERREIRA','NADIAPINHEIROLUZ','KASSIANE KEVELY',
           'LUIS ANTONIO DOS SANTOS'],
}

# Merchants que sempre vão para revisão manual
PERGUNTAR_SEMPRE = [
    'QUASAR SERVICOS', 'LUCILIA HELENA FRANZINI', 'BUS SERVICOS', 'MAGALUPAY'
]

# Ordem de prioridade na verificação de categorias
ORDEM = ['SA','I','F','CA','S','E','A','T','M','C','B','O','R','L']

# Conjunto de códigos válidos — usado para validar o retorno da IA
CATEGORIAS_VALIDAS = set(ORDEM)

# Categorias imunes à tag de viagem
IMUNES_VIAGEM = {'F', 'CA', 'SA', 'A', 'I'}
IMUNES_S_DESC = ['OLIVIA GIANNELLA', 'LIQUIDO DE VENCIMENTO', 'PAGAMENTO A FORNECEDORES']

# Limite de valor para PIX considerado pequeno
PIX_VALOR_PEQUENO = 100.0


# ── IMUNIDADE A VIAGEM ────────────────────────────────────────────────────

def eh_imune_viagem(categoria, descricao):
    if categoria in IMUNES_VIAGEM:
        return True
    if categoria == 'S':
        d = descricao.upper()
        return any(k in d for k in IMUNES_S_DESC)
    return False


# ── DETECÇÃO DE PIX ───────────────────────────────────────────────────────

def eh_pix(descricao):
    """Verifica se o lançamento é um PIX (enviado ou recebido)."""
    d = descricao.upper()
    return 'PIX' in d or d.startswith('ENVIADO ') or d.startswith('RECEBIDO ')


# ── CATEGORIZAÇÃO POR REGRA FIXA ─────────────────────────────────────────

def categorizar_por_regra(descricao, regras_usuario=None):
    """Regra fixa: primeiro o MAPA MENTAL do usuário (regras do perfil, que têm
    prioridade), depois os padrões do sistema (KEYWORDS).

    regras_usuario: lista de (palavra_chave, categoria) carregada do perfil ativo.
    """
    d = descricao.upper()
    # 1) Mapa mental do usuário — vence os padrões quando há conflito.
    if regras_usuario:
        for palavra, categoria in regras_usuario:
            if palavra and palavra.upper() in d:
                return categoria, 'regra'
    # 2) Merchants que sempre vão para revisão manual.
    for p in PERGUNTAR_SEMPRE:
        if p.upper() in d:
            return None, 'perguntar'
    # 3) Padrões do sistema.
    for cat in ORDEM:
        for kw in KEYWORDS.get(cat, []):
            if kw.upper() in d:
                return cat, 'regra'
    return None, 'sem_regra'


# ── CATEGORIZAÇÃO POR IA ──────────────────────────────────────────────────

# Corpo com as definições de categoria — compartilhado pelo prompt unitário e
# pelo prompt em lote (evita divergência entre os dois).
_REGRAS_CAT = (
    "O nome do estabelecimento já vem sem o prefixo da maquininha (Pg*, Mp*, Dl*, "
    "Ifd*, Zig*); use o nome restante como pista do tipo de comércio.\n"
    "Códigos de categoria válidos:\n"
    "SA=salário/renda do trabalho; I=investimento, transferência própria ou rendimento; "
    "F=fatura de cartão de crédito; CA=casa (aluguel, água, luz, gás, internet, prestadores do lar); "
    "S=saúde (farmácia, médico, exame, plano de saúde, suplemento); E=estudo (curso, escola, material); "
    "A=assinatura (streaming, apps, serviços recorrentes — Google, Netflix, Steam, iFood Clube); "
    "T=transporte (app de CORRIDA como 99 Ride/Uber, combustível/posto, ônibus, metrô, "
    "pedágio, estacionamento); "
    "M=mercado/supermercado/hortifruti/mercadinho/loja de conveniência (Oxxo, Pão de Açúcar, Mini Extra); "
    "C=comida (restaurante, lanche, DELIVERY de comida como iFood/Rappi/99food, padaria, "
    "café, tapioca, pizzaria, hamburgueria); "
    "B=bens (eletrônicos, papelaria, marketplace de produtos); R=roupa/vestuário/calçado; "
    "L=lazer (bar, boteco, balada, viagem, cinema, ingresso/evento, hotel, hostel, barbearia); "
    "O=outros (saque, tarifa bancária, imposto, juros — gastos identificáveis que não cabem nas demais).\n"
    "Dica importante: app que faz CORRIDA é T, mas DELIVERY de comida é C "
    "(ex.: '99 Ride'=T, '99food'=C). 'Botequim', 'Bar', 'Balsabar', 'Brewery' = L. "
    "Posto/Auto Posto = T. Nomes terminados em 'bar' geralmente são L.\n"
    "REGRA IMPORTANTE: se a descrição for genérica, ambígua, ou não houver informação "
    "suficiente para escolher uma categoria com segurança, responda exatamente "
    "{\"categoria\":null,\"confianca\":\"inconclusivo\"}. "
    "EXCEÇÃO: se a descrição for apenas o nome de uma pessoa física (transferência ou PIX) "
    "E o valor for de até R$100, classifique como L (Lazer) com \"confianca\":\"media\" — "
    "transferências pequenas para pessoas costumam ser lazer. "
    "Mas se for nome de pessoa e o valor passar de R$100, devolva null para o usuário decidir. "
    "É melhor devolver null e deixar o usuário cadastrar manualmente do que arriscar uma categoria errada. "
    "Use \"baixa\" apenas quando tiver um palpite real; use null quando não tiver palpite nenhum."
)

_SYSTEM_PROMPT = (
    "Você categoriza lançamentos bancários de um brasileiro que mora em São Paulo. "
    "Responda APENAS com um JSON válido, sem nenhum texto fora dele, no formato: "
    "{\"categoria\":\"CODIGO\",\"confianca\":\"alta|media|baixa\"}.\n"
    + _REGRAS_CAT
)

# Prompt para categorizar VÁRIOS lançamentos numa única chamada (lote).
_SYSTEM_PROMPT_LOTE = (
    "Você categoriza lançamentos bancários de um brasileiro que mora em São Paulo. "
    "Você recebe uma lista numerada de lançamentos e responde APENAS com um array "
    "JSON, sem nenhum texto fora dele, um objeto por lançamento, na MESMA ORDEM e "
    "com o MESMO tamanho da lista, no formato: "
    "[{\"i\":0,\"categoria\":\"CODIGO_ou_null\",\"confianca\":\"alta|media|baixa|inconclusivo\"}, ...]. "
    "O campo \"i\" é o número do lançamento na lista.\n"
    + _REGRAS_CAT
)

def categorizar_por_ia(descricao, valor, tipo):
    """Chama a API da Anthropic para categorizar um lançamento ambíguo.

    Retorna (categoria, confianca). A categoria é None quando a IA não
    consegue identificar com segurança (resposta inconclusiva, código
    inválido ou erro de chamada) — nesse caso o lançamento deve ser
    enviado para cadastro manual do usuário.
    """

    prompt = f"Descrição: {descricao}\nValor: R${abs(valor):.2f} ({tipo})"

    try:
        payload = json.dumps({
            "model": "claude-sonnet-4-6",
            "max_tokens": 60,
            "system": _SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": prompt}],
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
            texto = re.sub(r'```json|```', '', data['content'][0]['text']).strip()
            resultado = json.loads(texto)

            cat_raw = resultado.get('categoria')
            confianca = (resultado.get('confianca') or 'baixa').strip().lower()

            # Normaliza: só aceita string com um código válido; senão é None
            cat = cat_raw.strip().upper() if isinstance(cat_raw, str) else None
            if cat not in CATEGORIAS_VALIDAS:
                cat = None

            return cat, confianca

    except Exception:
        return None, 'erro'


def categorizar_por_ia_lote(itens):
    """Categoriza N lançamentos em UMA chamada à IA (em vez de N chamadas).

    itens: lista de dicts {descricao, valor, tipo}.
    Retorna lista de (categoria, confianca) ALINHADA com 'itens'. Em erro,
    devolve (None, 'erro') para todos — o chamador trata como vermelho.
    """
    if not itens:
        return []

    linhas = "\n".join(
        f"{i}. {it.get('descricao','')} | R${abs(it.get('valor',0) or 0):.2f} ({it.get('tipo','Débito')})"
        for i, it in enumerate(itens)
    )
    try:
        payload = json.dumps({
            "model": "claude-sonnet-4-6",
            "max_tokens": min(40 * len(itens) + 300, 16000),
            "system": _SYSTEM_PROMPT_LOTE,
            "messages": [{"role": "user", "content": linhas}],
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

        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        texto = re.sub(r'```json|```', '', data['content'][0]['text']).strip()
        arr = json.loads(texto)

        # Mapeia por índice 'i' (robusto a reordenação/omissões da IA)
        por_i = {}
        for obj in arr if isinstance(arr, list) else []:
            try:
                idx = int(obj.get('i'))
            except (TypeError, ValueError):
                continue
            cat_raw = obj.get('categoria')
            conf = (obj.get('confianca') or 'baixa').strip().lower()
            cat = cat_raw.strip().upper() if isinstance(cat_raw, str) else None
            if cat not in CATEGORIAS_VALIDAS:
                cat = None
            por_i[idx] = (cat, conf)
        return [por_i.get(i, (None, 'erro')) for i in range(len(itens))]

    except Exception:
        return [(None, 'erro')] * len(itens)


def categorizar_lote(itens, regras_usuario=None, usar_ia=True):
    """Categoriza uma lista de lançamentos com UMA chamada de IA em lote.

    itens: lista de dicts {descricao, valor, tipo, is_pix}.
    Retorna lista de (categoria, confianca, fonte) alinhada — mesma semântica de
    `categorizar`. Primeiro aplica as regras (grátis) e só manda à IA, em lote,
    os que ficaram 'sem_regra'.
    """
    resultados = [None] * len(itens)
    para_ia = []   # [(idx, item)]

    for i, it in enumerate(itens):
        cat, status = categorizar_por_regra(it.get('descricao', ''), regras_usuario)
        if status == 'regra':
            resultados[i] = (cat, 'verde', 'regra')
        elif status == 'perguntar':
            resultados[i] = (None, 'vermelho', None)
        else:
            para_ia.append((i, it))

    if para_ia and usar_ia and ANTHROPIC_API_KEY:
        preds = categorizar_por_ia_lote([it for _, it in para_ia])
        for (i, it), (cat_ia, confianca) in zip(para_ia, preds):
            if cat_ia is None:
                resultados[i] = (None, 'vermelho', 'ia')
            elif confianca == 'alta':
                resultados[i] = (cat_ia, 'verde', 'ia')
            else:
                resultados[i] = (cat_ia, 'amarelo', 'ia')
    else:
        # Sem IA: PIX pequeno p/ pessoa vira L; o resto, vermelho.
        for i, it in para_ia:
            if it.get('is_pix') and abs(it.get('valor', 0) or 0) <= PIX_VALOR_PEQUENO:
                resultados[i] = ('L', 'amarelo', 'pix')
            else:
                resultados[i] = (None, 'vermelho', None)

    return resultados


# ── FUNÇÃO PRINCIPAL ──────────────────────────────────────────────────────

def categorizar(descricao, valor=0, tipo="Débito", usar_ia=True, is_pix=False, regras_usuario=None):
    """
    Retorna (categoria, confianca, fonte).

    confianca: 'verde' | 'amarelo' | 'vermelho'
    fonte:     'regra' | 'ia' | 'pix' | None

    verde   → regra fixa ou IA com alta confiança
    amarelo → IA com confiança média/baixa, ou PIX pequeno (≤ R$100) p/ pessoa física
    vermelho → SEMPRE com categoria nula: o usuário precisa definir manualmente
               (IA não identificou, PIX de valor alto sem regra, ou PERGUNTAR_SEMPRE)

    Invariante: confianca == 'vermelho' implica categoria None — todo vermelho
    vai para a definição do usuário na revisão.

    Fluxo: regra fixa → IA (quando sem regra). A IA classifica PIX pequeno para
    pessoa física como Lazer; o que ela não identificar vira vermelho → usuário.
    """
    # 1. Tentar regra fixa (mapa do usuário + padrões)
    cat, status = categorizar_por_regra(descricao, regras_usuario)

    if status == 'regra':
        return cat, 'verde', 'regra'

    if status == 'perguntar':
        return None, 'vermelho', None

    # 2. Sem regra fixa → tentar IA
    ia_tentou = False
    if usar_ia and ANTHROPIC_API_KEY:
        ia_tentou = True
        cat_ia, confianca = categorizar_por_ia(descricao, valor, tipo)

        # IA não conseguiu identificar → cadastro manual pelo usuário
        if cat_ia is None:
            return None, 'vermelho', 'ia'

        # IA retornou uma categoria → cor conforme a confiança declarada
        if confianca == 'alta':
            return cat_ia, 'verde', 'ia'
        # média ou baixa: é um palpite, sugere mas sinaliza para conferência
        return cat_ia, 'amarelo', 'ia'

    # 3. PIX sem regra e sem IA conclusiva
    if is_pix:
        fonte_pix = 'ia' if ia_tentou else 'pix'
        if abs(valor) <= PIX_VALOR_PEQUENO:
            return 'L', 'amarelo', fonte_pix
        # PIX de valor alto: vermelho sempre sem categoria → o usuário define
        return None, 'vermelho', fonte_pix

    # 4. Sem categoria
    return None, 'vermelho', 'ia' if ia_tentou else None


# ── UTILITÁRIOS ───────────────────────────────────────────────────────────

def limpar_desc(desc):
    """Limpa prefixos desnecessários e padroniza a descrição.

    Além de remover o cabeçalho do lançamento (COMPRA CARTAO/PIX) e o número do
    docto ao final, remove o prefixo da maquininha/adquirente que não faz parte
    do nome do estabelecimento. Esses prefixos seguem o padrão "<código>* nome":
        'Dl*99 Ride'        -> '99 Ride'
        'Mp *Quintalbutia'  -> 'Quintalbutia'
        'Ifd*Burger X'      -> 'Burger X'
        'Pg *Nuvem Balsa'   -> 'Nuvem Balsa'
        'Jim.Com* Entr3pos' -> 'Entr3pos'
        'MP .Cafedamargem'  -> 'Cafedamargem'  (variação com ponto)
    """
    desc = re.sub(r'^COMPRA CARTAO DEB MC \d{2}/\d{2}\s+', '', desc, flags=re.IGNORECASE)
    desc = re.sub(r'^PIX (ENVIADO|RECEBIDO)\s+', '', desc, flags=re.IGNORECASE)
    # Máscara do cartão que algumas faturas colocam antes do nome (ex.: Nubank
    # '•••• 3776 Botequim' -> 'Botequim'). Cobre vários glifos de "bolinha" que o
    # pdftotext pode emitir (•, ·, ∙, ●, ◦, °) e '*'.
    desc = re.sub(r'^[•·∙●◦°\*]{2,}\s*\d{2,6}\s*', '', desc).strip()
    desc = re.sub(r'^PAGAMENTO DE BOLETO\s+', 'BOLETO ', desc, flags=re.IGNORECASE)
    # Prefixo de adquirente: token curto (≤10 chars) seguido de '*' e o nome real.
    desc = re.sub(r'^[A-Za-z0-9][\w.]{0,9}\s?\*\s*', '', desc)
    # Variação com ponto, só para códigos de adquirente conhecidos (evita comer
    # nomes legítimos que comecem com abreviação + ponto).
    desc = re.sub(r'^(?:mp|pg|pag|dl|cie|pp)\s*\.\s*', '', desc, flags=re.IGNORECASE)
    desc = re.sub(r'\s+\d{6,}\s*$', '', desc).strip()
    return desc


def eh_fatura(desc):
    """Verifica se é pagamento de fatura (deve ser ignorado nos cálculos)."""
    keywords = [
        'PAGAMENTO CARTAO CREDITO', 'DEB AUTOM DE FATURA',
        'ANUIDADE DIFERENCIADA', 'PAGAMENTO FATURA',
        'DEBITO FATURA', 'DEB AUT. FAT', 'CARTAO MASTER'
    ]
    d = desc.upper()
    return any(k in d for k in keywords)
