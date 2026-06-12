from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import pdfplumber, io
from datetime import datetime

from database import init_db, get_conn
from categorizer import categorizar, limpar_desc, eh_fatura, eh_imune_viagem
from parser import parse_extrato_debito, parse_fatura_credito_tabela, detectar_tipo_arquivo

app = FastAPI(title="Finanças Pessoais API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
init_db()

# ── MODELS ───────────────────────────────────────────────────────────────
class AtualizarStaging(BaseModel):
    id: int
    categoria: Optional[str] = None
    excluir: Optional[bool] = False

class IncorporarBody(BaseModel):
    upload_id: int
    itens: List[dict]  # [{id, categoria}]

class NovaViagem(BaseModel):
    destino: str
    data_inicio: str
    data_fim: str

class AtualizarLancamento(BaseModel):
    categoria: Optional[str] = None
    viagem: Optional[str] = None
    revisado: Optional[int] = None

# ── UPLOAD → STAGING ─────────────────────────────────────────────────────
@app.post("/upload")
async def upload_arquivo(file: UploadFile = File(...)):
    conteudo = await file.read()
    texto = ""
    try:
        with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
            for page in pdf.pages:
                texto += (page.extract_text() or "") + "\n"
    except Exception as e:
        raise HTTPException(400, f"Erro ao ler PDF: {str(e)}")

    tipo = detectar_tipo_arquivo(texto)
    if tipo == 'desconhecido':
        raise HTTPException(400, "Não foi possível identificar o tipo de arquivo")

    if tipo == 'debito':
        lancamentos_raw = parse_extrato_debito(texto)
    else:
        lancamentos_raw = parse_fatura_credito_tabela(conteudo)

    conn = get_conn()

    # Registrar upload
    datas = [l['data'] for l in lancamentos_raw if 'data' in l]
    cur = conn.execute("""
        INSERT INTO uploads (tipo, nome_arquivo, periodo_inicio, periodo_fim, total_lancamentos, incorporado)
        VALUES (?,?,?,?,?,0)
    """, (tipo, file.filename,
          min(datas) if datas else None,
          max(datas) if datas else None,
          len(lancamentos_raw)))
    upload_id = cur.lastrowid

    # Processar e salvar no staging
    staging = []
    for l in lancamentos_raw:
        desc_limpa = limpar_desc(l['descricao'])

        # Ignorar pagamento de fatura no débito
        if tipo == 'debito' and eh_fatura(desc_limpa):
            continue

        valor = l['valor']
        cat, fonte = categorizar(desc_limpa, valor, l['tipo'], usar_ia=False)

        credito = valor if valor > 0 else None
        debito = abs(valor) if valor < 0 else None

        # Checar duplicata
        dup = conn.execute("""
            SELECT COUNT(*) as n FROM lancamentos
            WHERE data=? AND descricao=? AND valor=?
        """, (l['data'], desc_limpa, valor)).fetchone()['n']

        cur2 = conn.execute("""
            INSERT INTO staging (upload_id, mes, data, descricao, credito, debito, valor, categoria, tipo, fonte, duplicata)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (upload_id, l['mes'], l['data'], desc_limpa,
              credito, debito, valor, cat, l['tipo'], fonte or 'sem_regra', 1 if dup > 0 else 0))

        staging.append({
            'id': cur2.lastrowid,
            'mes': l['mes'], 'data': l['data'],
            'descricao': desc_limpa, 'valor': valor,
            'categoria': cat, 'tipo': l['tipo'],
            'fonte': fonte or 'sem_regra',
            'duplicata': dup > 0
        })

    conn.commit()
    conn.close()

    return {
        "upload_id": upload_id,
        "tipo": tipo,
        "total": len(staging),
        "duplicatas": sum(1 for s in staging if s['duplicata']),
        "sem_categoria": sum(1 for s in staging if not s['categoria']),
        "itens": staging
    }

# ── INCORPORAR DO STAGING → BANCO PRINCIPAL ──────────────────────────────
@app.post("/incorporar")
async def incorporar(body: IncorporarBody):
    conn = get_conn()

    incorporados = 0
    for item in body.itens:
        if item.get('excluir'):
            continue
        conn.execute("""
            INSERT INTO lancamentos
              (mes, data, descricao, credito, debito, valor, categoria, tipo, revisado, origem, fonte)
            SELECT mes, data, descricao, credito, debito, valor, ?, tipo, 1, 'upload', fonte
            FROM staging WHERE id=?
        """, (item['categoria'], item['id']))
        incorporados += 1

    # Limpar staging desse upload
    conn.execute("DELETE FROM staging WHERE upload_id=?", (body.upload_id,))
    conn.execute("UPDATE uploads SET incorporado=1 WHERE id=?", (body.upload_id,))
    conn.commit()
    conn.close()

    return {"ok": True, "incorporados": incorporados}

# ── LANÇAMENTOS ──────────────────────────────────────────────────────────
@app.get("/lancamentos")
def listar_lancamentos(mes: Optional[str] = None, revisado: Optional[int] = None,
                        categoria: Optional[str] = None):
    conn = get_conn()
    q = "SELECT * FROM lancamentos WHERE 1=1"
    params = []
    if mes:       q += " AND mes=?";       params.append(mes)
    if revisado is not None:
                  q += " AND revisado=?";  params.append(revisado)
    if categoria: q += " AND categoria=?"; params.append(categoria)
    q += " ORDER BY data DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.patch("/lancamentos/{lid}")
def atualizar_lancamento(lid: int, body: AtualizarLancamento):
    conn = get_conn()
    fields, params = [], []
    if body.categoria is not None:
        fields.append("categoria=?"); params.append(body.categoria)
    if body.viagem is not None:
        fields.append("viagem=?");    params.append(body.viagem)
    if body.revisado is not None:
        fields.append("revisado=?");  params.append(body.revisado)
    if not fields:
        raise HTTPException(400, "Nada para atualizar")
    params.append(lid)
    conn.execute(f"UPDATE lancamentos SET {','.join(fields)} WHERE id=?", params)
    conn.commit()
    conn.close()
    return {"ok": True}

# ── VIAGENS ──────────────────────────────────────────────────────────────
@app.get("/viagens")
def listar_viagens():
    conn = get_conn()
    viagens = conn.execute("SELECT * FROM viagens ORDER BY data_inicio DESC").fetchall()
    result = []
    for v in viagens:
        lancamentos = conn.execute(
            "SELECT * FROM lancamentos WHERE viagem=? ORDER BY data", (v['destino'],)).fetchall()
        gastos_cat = {}
        total = 0
        for l in lancamentos:
            cat = l['categoria'] or 'O'
            if cat not in ('SA','I','F'):
                gastos_cat[cat] = gastos_cat.get(cat, 0) + abs(l['valor'])
                total += abs(l['valor'])
        result.append({**dict(v), 'total': total,
                       'por_categoria': gastos_cat,
                       'num_lancamentos': len(lancamentos)})
    conn.close()
    return result

@app.post("/viagens")
def criar_viagem(body: NovaViagem):
    conn = get_conn()
    conn.execute("INSERT OR IGNORE INTO viagens (destino, data_inicio, data_fim) VALUES (?,?,?)",
                 (body.destino, body.data_inicio, body.data_fim))
    conn.commit()
    conn.close()
    return {"ok": True}

# ── DASHBOARD ────────────────────────────────────────────────────────────
@app.get("/dashboard")
def dashboard(meses: int = 6):
    conn = get_conn()
    rows = conn.execute("""
        SELECT mes, categoria, valor FROM lancamentos
        WHERE categoria != 'F' AND categoria IS NOT NULL
        ORDER BY mes
    """).fetchall()

    from datetime import datetime as dt
    hoje = dt.now()
    # Usar mês anterior como limite (mês atual ainda incompleto)
    if hoje.month == 1:
        mes_limite = (hoje.year - 1, 12)
    else:
        mes_limite = (hoje.year, hoje.month - 1)

    limite = mes_limite

    def sort_mes(m):
        try: p = m.split('/'); return (int(p[1]), int(p[0]))
        except: return (0,0)

    por_mes = {}
    for r in rows:
        m, cat = r['mes'], r['categoria']
        try:
            p = m.split('/')
            if (int(p[1]), int(p[0])) > limite:
                continue  # ignora meses futuros e mês atual incompleto
        except: continue
        if m not in por_mes: por_mes[m] = {}
        por_mes[m][cat] = por_mes[m].get(cat, 0) + r['valor']

    meses_ord = sorted(por_mes.keys(), key=sort_mes)
    ultimos = meses_ord[-meses:] if len(meses_ord) >= meses else meses_ord

    metricas = []
    for m in ultimos:
        d = por_mes[m]
        receita = d.get('SA', 0)
        investimentos = d.get('I', 0)
        despesas = sum(v for k,v in d.items() if k not in ('SA','I','F') and v < 0)
        metricas.append({
            'mes': m,
            'receita': round(receita, 2),
            'despesas': round(abs(despesas), 2),
            'investimentos': round(abs(investimentos), 2),
            'superavit': round(receita + despesas, 2),
            'categorias': {k: round(v, 2) for k,v in d.items()}
        })

    ultimo = metricas[-1] if metricas else {}
    positivos = sum(1 for m in metricas if m['superavit'] > 0)
    indice = round((positivos / len(metricas)) * 100) if metricas else 0

    ultimo_debito = conn.execute(
        "SELECT periodo_fim, created_at FROM uploads WHERE tipo='debito' AND incorporado=1 ORDER BY created_at DESC LIMIT 1"
    ).fetchone()
    ultimo_credito = conn.execute(
        "SELECT periodo_fim, created_at FROM uploads WHERE tipo='credito' AND incorporado=1 ORDER BY created_at DESC LIMIT 1"
    ).fetchone()

    conn.close()
    return {
        "indice_saude": indice,
        "metricas_mensais": metricas,
        "ultimo_mes": ultimo,
        "status_uploads": {
            "debito":  dict(ultimo_debito)  if ultimo_debito  else None,
            "credito": dict(ultimo_credito) if ultimo_credito else None,
        }
    }

@app.get("/")
def root():
    return {"status": "ok", "app": "Finanças Pessoais"}

