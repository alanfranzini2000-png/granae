import re
import os
import json
import urllib.request

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
    'CA': ['BOLETO OUTROS BANCOS','ELETROPAULO','SANEAMENTO','SABESP','ENELSP',
           'FLEXPAG*ENEL','GRPQA','JOAO ANTONIO DE VASCONCEL','JOAO ANTONIO V GLOEDEN',
           'FLAVIA PEREIRA','FABIO BRAZIL XAVIER','CLAUDIONOR TORRES'],
    'S':  ['RAIA','DROGARIA','DROGASIL','FARMACONDESA','FARMACONDE','FARMACIA',
           'FARMACIAPAGUE','OLIVIA GIANNELLA','CELITA ACACIO','CELITA ACACIA',
           'GONCALVES MEDICINA','DEMERGE','MR TITO','RDSAUDE','MAZZA E MARTINS'],
    'E':  ['PAULA SOUZA DIAS','ASSOCIACAO DOS ANALISTAS','ANTONINO TRIPODI'],
    'A':  ['GOOGLE ONE','GOOGLE HBO','GOOGLE PRODUTOS','GOOGLE WM','DL*GOOGLE',
           'NETFLIX','OPENAI','CHATGPT','HBO MAX','AMAZON PRIME','AMAZON DIGITAL',
           'AMAZON KINDLE','CLARO FLEX','PAG*STEAM','STEAM','EDITORA O GLOBO',
           'IOF DESPESA NO EXTERIOR','99INAPPPAYMENTCAPTURE','MP *MELIMAIS','MELIMAIS',
           'GOOGLE BUMBLE','BUMBLE','THE NEW YORK TIMES','AMAZON BR','AMAZONPRIMEBR',
           'VIVO SP','IOF DESPESA EXTERIOR','IFOOD CLUB','IFOOD *CLUBE',
           'IFD*IFOOD CLUB','IFOOD*CLUBE'],
    'T':  ['99APP','UBER','AUTOPASS','LOCALIZA','METRO SAO PAULO','METRO RJ',
           'PRODATA','TAMOIOS','WHOOSH','TAXI','SHELL','POSTO','99FOOD','99 FOOD',
           'POP ','LATAM','EUCATUR','MULTA - FOCO'],
    'M':  ['MAMBO','SUPERMERCADO','MINI EXTRA','CARREFOUR','PAO DE ACUCAR','OXXO',
           'CORIOLANO','SACOLAO','OBA HORTIFRUTI','MINUTO PA','AVICOLA',
           'MERCADO CIPRIANI','MERCADO VITORIA','MERCADO SANTANA','MERCADO VIZEU',
           'MERCEARIA','ST MARCHE','JDM COMERCIO DE ALIM','MERCADO O PIONEIRO',
           'BOM GOSTO EMPORIO','COMERCIALDE'],
    'C':  ['KEETA','RAPPI','IFOOD','IFD*','FOOD TO SAVE','PADARIA','PANIFICACAO',
           'RESTAURANTE','SUBWAY','MCDONALD','BACIO DI LATTE','CAS RESTAURANTE',
           'PAPILA','BRASILCAFE','HERA VEGGIE','CAJOOKIE','PARADA OBRIGATORIA',
           'MUCHEN','QUINTALBUTIA','JOAO HENRIQUE MASUTTI','LANCHONETE',
           'AR FOODS','CONVENIENCIA','CAFE COM CACAU','DONA TEREZA BONELA',
           'POINT DO SURF','MAIA OLIVEIRA PANIFICA'],
    'B':  ['MERCADOLIVRE','MERCADO LIVRE','PIX MARKETPLACE','ANIS RAZUK',
           'VETSTECNOLOGIA','KALUNGA','MERCADOPAGO *BOEINGIN'],
    'O':  ['SAQUE DINHEIRO','TARIFA TEDELETRONICO','GILLES YVES CHATTON'],
    'R':  ['YLMR FRANCO','MODA MUNDIAL','VILA ROMANA','NOVADONNACAROLINA'],
    'L':  ['BANCA','ZIG','PICCO','PIZZARIA','SORVETERIA','LIBANINHO','RANCHINHO',
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
           'MANO DO CEU','BRASS BREW','PAG*SHINEBAR','QUITANDINHA','MOACIR BAR',
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

def categorizar_por_regra(descricao):
    d = descricao.upper()
    for p in PERGUNTAR_SEMPRE:
        if p.upper() in d:
            return None, 'perguntar'
    for cat in ORDEM:
        for kw in KEYWORDS.get(cat, []):
            if kw.upper() in d:
                return cat, 'regra'
    return None, 'sem_regra'


# ── CATEGORIZAÇÃO POR IA ──────────────────────────────────────────────────

def categorizar_por_ia(descricao, valor, tipo):
    """Chama a API da Anthropic para categorizar um lançamento ambíguo."""

    prompt = f"""Você é um categorizador de gastos financeiros pessoais de um brasileiro em São Paulo.

Categorize o seguinte lançamento bancário em UMA das categorias abaixo:

SA - Salário/renda
I  - Investimentos
F  - Fatura de cartão (ignorado nos cálculos)
CA - Casa (aluguel, condomínio, água, luz, serviços domésticos)
S  - Saúde (farmácia, médico, psicólogo, academia)
E  - Estudo (cursos, aulas, livros educacionais)
A  - Assinaturas (streaming, apps, planos recorrentes)
T  - Transporte (Uber, metrô, ônibus, pedágio, combustível, passagem)
M  - Mercado (supermercado, mercearia, hortifruti)
C  - Comida (restaurante, delivery, lanchonete, padaria, café)
B  - Bens (compras online, eletrônicos, produtos físicos)
R  - Roupa (roupas, calçados, acessórios)
L  - Lazer (bar, show, evento, ingresso, cinema, passeio, presente)
O  - Outros

Lançamento:
- Descrição: {descricao}
- Valor: R$ {abs(valor):.2f}
- Tipo: {tipo}

Responda APENAS com JSON sem markdown:
{{"categoria": "X", "confianca": "alta|media|baixa", "motivo": "explicação breve"}}"""

    try:
        payload = json.dumps({
            "model": "claude-sonnet-4-6",
            "max_tokens": 150,
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
            texto = re.sub(r'```json|```', '', data['content'][0]['text']).strip()
            resultado = json.loads(texto)
            cat = resultado.get('categoria', '?').strip().upper()
            confianca = resultado.get('confianca', 'baixa')
            return cat, confianca

    except Exception:
        return None, 'erro'


# ── FUNÇÃO PRINCIPAL ──────────────────────────────────────────────────────

def categorizar(descricao, valor=0, tipo="Débito", usar_ia=True, is_pix=False):
    """
    Retorna (categoria, confianca, fonte).

    confianca: 'verde' | 'amarelo' | 'vermelho'
    fonte:     'regra' | 'ia' | 'pix' | None

    verde   → regra fixa ou IA com alta confiança
    amarelo → IA com média confiança, ou PIX de valor pequeno (≤ R$100) sem regra
    vermelho → PIX de valor alto sem regra, sem categoria, ou PERGUNTAR_SEMPRE
    """
    # 1. Tentar regra fixa
    cat, status = categorizar_por_regra(descricao)

    if status == 'regra':
        return cat, 'verde', 'regra'

    if status == 'perguntar':
        return None, 'vermelho', None

    # 2. Tentar IA se habilitada
    if usar_ia and ANTHROPIC_API_KEY:
        cat_ia, confianca = categorizar_por_ia(descricao, valor, tipo)
        if cat_ia and confianca == 'alta':
            return cat_ia, 'verde', 'ia'
        elif cat_ia and confianca == 'media':
            return cat_ia, 'amarelo', 'ia'

    # 3. PIX sem regra e sem IA conclusiva
    if is_pix:
        if abs(valor) <= PIX_VALOR_PEQUENO:
            return 'L', 'amarelo', 'pix'
        else:
            return 'L', 'vermelho', 'pix'

    # 4. Sem categoria
    return None, 'vermelho', None


# ── UTILITÁRIOS ───────────────────────────────────────────────────────────

def limpar_desc(desc):
    """Limpa prefixos desnecessários da descrição."""
    desc = re.sub(r'^COMPRA CARTAO DEB MC \d{2}/\d{2}\s+', '', desc, flags=re.IGNORECASE)
    desc = re.sub(r'^PIX (ENVIADO|RECEBIDO)\s+', '', desc, flags=re.IGNORECASE)
    desc = re.sub(r'^PAGAMENTO DE BOLETO\s+', 'BOLETO ', desc, flags=re.IGNORECASE)
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
