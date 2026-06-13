import os
import io
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database import init_db, get_conn, atualizar_status_base
from categorizer import categorizar, limpar_desc, eh_fatura, eh_imune_viagem
from parser import processar_pdf, pdf_esta_encriptado

app = FastAPI(title="Finanças Pessoais API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
init_db()


# ── MODELS ────────────────────────────────────────────────────────────────

class IncorporarItem(BaseModel):
    id: int
    categoria: Optional[str] = None
    excluir: Optional[bool] = False

class IncorporarBody(BaseModel):
    upload_id: int
    itens: List[IncorporarItem]

class NovaViagem(BaseModel):
    destino: str
    data_inicio: str
    data_fim: str

class AtualizarLancamento(BaseModel):
    categoria: Optional[str] = None
    viagem: Optional[str] = None
    revisado: Optional[int] = None

class NovaRegra(BaseModel):
    palavra_chave: str
    categoria: str


# ── HELPERS ───────────────────────────────────────────────────────────────

def _processar_arquivo(conteudo, nome_arquivo, conn, upload_id, senha=None):
    tipo, lancamentos_raw = processar_pdf(conteudo, nome_arquivo, senha)
    staging = []
    for l in lancamentos_raw:
        # is_pix lê a descrição BRUTA (antes de limpar_desc remover o prefixo)
        is_pix = 'PIX ENVIADO' in l['descricao'].upper() or 'PIX RECEBIDO' in l['descricao'].upper()
        desc = limpar_desc(l['descricao'])
        if tipo == 'debito' and eh_fatura(desc):
            continue
        valor = l['valor']
        cat, confianca, fonte = categorizar(desc, valor, l['tipo'], usar_ia=True, is_pix=is_pix)
        credito = valor if valor > 0 else None
        debito  = abs(valor) if valor < 0 else None

        dup = conn.execute("""
            SELECT COUNT(*) as n FROM lancamentos
            WHERE data=? AND descricao=? AND valor=?
        """, (l['data'], desc, valor)).fetchone()['n']

        cur = conn.execute("""
            INSERT INTO staging
              (upload_id, mes, data, descricao, credito, debito, valor,
               categoria, tipo, fonte, confianca, duplicata)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (upload_id, l['mes'], l['data'], desc,
              credito, debito, valor,
              cat, l['tipo'], fonte or 'desconhecido', confianca or 'vermelho', 1 if dup > 0 else 0))

        staging.append({
            'id':        cur.lastrowid,
            'mes':       l['mes'],
            'data':      l['data'],
            'descricao': desc,
            'valor':     valor,
            'categoria': cat,
            'tipo':      l['tipo'],
            'confianca': confianca or 'vermelho',
            'fonte':     fonte or 'desconhecido',
            'duplicata': dup > 0,
            'arquivo':   tipo,
        })
    return tipo, staging


# ── UPLOAD → STAGING (múltiplos arquivos) ─────────────────────────────────

@app.post("/upload")
async def upload_arquivos(
    files: List[UploadFile] = File(...),
    senhas: str = Form(default="{}")
):
    """
    Aceita 1 ou mais PDFs. Detecta tipo automaticamente para cada um.
    Duplicatas são removidas dos itens retornados mas contabilizadas.
    PDFs com senha: retorna arquivos_com_senha para o frontend pedir a senha.
    """
    try:
        senhas_dict = json.loads(senhas)
    except Exception:
        senhas_dict = {}

    # Lê todos os arquivos primeiro para poder verificar criptografia
    arquivos_dados = []
    for file in files:
        conteudo = await file.read()
        arquivos_dados.append((file.filename, conteudo))

    # Verifica quais PDFs estão protegidos e sem senha fornecida
    precisam_senha = [
        nome for nome, conteudo in arquivos_dados
        if pdf_esta_encriptado(conteudo) and nome not in senhas_dict
    ]
    if precisam_senha:
        return {"arquivos_com_senha": precisam_senha}

    conn = get_conn()

    cur = conn.execute("""
        INSERT INTO uploads (tipo, nome_arquivo, periodo_inicio, periodo_fim, total_lancamentos, incorporado)
        VALUES (?,?,?,?,?,0)
    """, ('multiplo', ' + '.join(n for n, _ in arquivos_dados), None, None, 0))
    upload_id = cur.lastrowid

    todos_staging = []
    erros = []

    for nome, conteudo in arquivos_dados:
        senha = senhas_dict.get(nome)
        try:
            tipo, staging = _processar_arquivo(conteudo, nome, conn, upload_id, senha)
            todos_staging.extend(staging)
        except Exception as e:
            erros.append(f"{nome}: {str(e)}")

    # Separar duplicatas dos itens a mostrar
    itens_limpos    = [s for s in todos_staging if not s['duplicata']]
    total_duplicatas = sum(1 for s in todos_staging if s['duplicata'])

    # Remover do staging as duplicatas (não precisam de revisão)
    ids_dup = [s['id'] for s in todos_staging if s['duplicata']]
    if ids_dup:
        conn.execute(f"DELETE FROM staging WHERE id IN ({','.join('?'*len(ids_dup))})", ids_dup)

    total = len(itens_limpos)
    conn.execute("UPDATE uploads SET total_lancamentos=? WHERE id=?", (total, upload_id))
    conn.commit()
    conn.close()

    return {
        "upload_id":        upload_id,
        "total":            total,
        "duplicatas_removidas": total_duplicatas,
        "sem_categoria":    sum(1 for s in itens_limpos if not s['categoria']),
        "itens":            itens_limpos,
        "erros":            erros,
    }


# ── INCORPORAR ────────────────────────────────────────────────────────────

@app.post("/incorporar")
async def incorporar(body: IncorporarBody):
    conn = get_conn()
    incorporados = 0
    ignorados_duplicata = 0
    tipos_incorporados = set()

    for item in body.itens:
        if item.excluir or not item.categoria:
            continue
        row = conn.execute("SELECT * FROM staging WHERE id=?", (item.id,)).fetchone()
        if not row:
            continue
        ja_existe = conn.execute("""
            SELECT COUNT(*) as n FROM lancamentos
            WHERE data=? AND descricao=? AND valor=?
        """, (row['data'], row['descricao'], row['valor'])).fetchone()['n']
        if ja_existe:
            ignorados_duplicata += 1
            continue
        conn.execute("""
            INSERT INTO lancamentos
              (mes, data, descricao, credito, debito, valor,
               categoria, tipo, revisado, origem, fonte, confianca)
            VALUES (?,?,?,?,?,?,?,?,1,'upload',?,?)
        """, (row['mes'], row['data'], row['descricao'],
              row['credito'], row['debito'], row['valor'],
              item.categoria, row['tipo'], row['fonte'], row['confianca']))
        tipos_incorporados.add(row['tipo'])
        incorporados += 1

    conn.execute("DELETE FROM staging WHERE upload_id=?", (body.upload_id,))
    conn.execute("UPDATE uploads SET incorporado=1 WHERE id=?", (body.upload_id,))

    if 'Débito' in tipos_incorporados:
        atualizar_status_base(conn, 'debito')
    if 'Crédito' in tipos_incorporados:
        atualizar_status_base(conn, 'credito')

    conn.commit()
    conn.close()
    return {"ok": True, "incorporados": incorporados, "ignorados_duplicata": ignorados_duplicata}


# ── REGRAS (aprendizado) ──────────────────────────────────────────────────

@app.post("/regras")
def adicionar_regra(body: NovaRegra):
    """Salva nova regra fixa: palavra_chave → categoria."""
    conn = get_conn()
    conn.execute("""
        INSERT OR REPLACE INTO regras_categorias (palavra_chave, categoria)
        VALUES (?, ?)
    """, (body.palavra_chave.upper().strip(), body.categoria))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/regras")
def listar_regras():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM regras_categorias ORDER BY categoria, palavra_chave").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── VERIFICAÇÃO DE BASE ───────────────────────────────────────────────────

@app.get("/verificar")
def verificar_base():
    """Roda checagem de qualidade na base de lançamentos."""
    conn = get_conn()
    problemas = []

    CATS_VALIDAS = {'SA','I','F','CA','S','E','A','T','M','C','B','R','L','O'}

    # 1. Sem categoria
    n = conn.execute("SELECT COUNT(*) as n FROM lancamentos WHERE categoria IS NULL OR categoria=''").fetchone()['n']
    if n: problemas.append({"tipo": "sem_categoria", "quantidade": n, "descricao": f"{n} lançamentos sem categoria"})

    # 2. Categoria inválida
    rows = conn.execute("SELECT DISTINCT categoria FROM lancamentos").fetchall()
    cats_invalidas = [r['categoria'] for r in rows if r['categoria'] and r['categoria'] not in CATS_VALIDAS]
    if cats_invalidas:
        problemas.append({"tipo": "categoria_invalida", "quantidade": len(cats_invalidas), "descricao": f"Categorias inválidas: {', '.join(cats_invalidas)}"})

    # 3. Duplicatas exatas
    n = conn.execute("""
        SELECT COUNT(*) as n FROM (
            SELECT data, descricao, valor, COUNT(*) as c
            FROM lancamentos GROUP BY data, descricao, valor HAVING c > 1
        )
    """).fetchone()['n']
    if n: problemas.append({"tipo": "duplicatas", "quantidade": n, "descricao": f"{n} grupos com lançamentos duplicados"})

    # 4. Datas inválidas
    n = conn.execute("""
        SELECT COUNT(*) as n FROM lancamentos
        WHERE data NOT LIKE '__/__/____'
    """).fetchone()['n']
    if n: problemas.append({"tipo": "data_invalida", "quantidade": n, "descricao": f"{n} lançamentos com data inválida"})

    # 5. Valores zerados (exceto F e I)
    n = conn.execute("""
        SELECT COUNT(*) as n FROM lancamentos
        WHERE valor=0 AND categoria NOT IN ('F','I')
    """).fetchone()['n']
    if n: problemas.append({"tipo": "valor_zero", "quantidade": n, "descricao": f"{n} lançamentos com valor zero"})

    # 6. Mês inconsistente com data
    inconsistentes = conn.execute("""
        SELECT COUNT(*) as n FROM lancamentos
        WHERE mes != (CAST(SUBSTR(data,4,2) AS INTEGER) || '/' || SUBSTR(data,7,4))
    """).fetchone()['n']
    if inconsistentes: problemas.append({"tipo": "mes_inconsistente", "quantidade": inconsistentes, "descricao": f"{inconsistentes} lançamentos com mês inconsistente com a data"})

    conn.close()
    return {
        "ok": len(problemas) == 0,
        "total_problemas": len(problemas),
        "problemas": problemas
    }


# ── STATUS ────────────────────────────────────────────────────────────────

@app.get("/status")
def status_base():
    """
    Retorna sempre as datas mais recentes de débito e crédito
    direto da tabela lancamentos — inclui histórico carregado.
    """
    conn = get_conn()

    r_deb = conn.execute("""
        SELECT data as ultima FROM lancamentos
        WHERE tipo='Débito'
        ORDER BY SUBSTR(data,7,4) DESC,
                 SUBSTR(data,4,2) DESC,
                 SUBSTR(data,1,2) DESC
        LIMIT 1
    """).fetchone()

    r_cred = conn.execute("""
        SELECT data as ultima FROM lancamentos
        WHERE tipo='Crédito'
        ORDER BY SUBSTR(data,7,4) DESC,
                 SUBSTR(data,4,2) DESC,
                 SUBSTR(data,1,2) DESC
        LIMIT 1
    """).fetchone()

    conn.close()

    return {
        "ultimo_dado_debito":  r_deb['ultima']  if r_deb  else None,
        "ultimo_dado_credito": r_cred['ultima'] if r_cred else None,
    }

# ── LANÇAMENTOS ───────────────────────────────────────────────────────────

@app.get("/lancamentos")
def listar_lancamentos(mes: Optional[str]=None, revisado: Optional[int]=None, categoria: Optional[str]=None):
    conn = get_conn()
    q = "SELECT * FROM lancamentos WHERE 1=1"
    params = []
    if mes:       q += " AND mes=?";       params.append(mes)
    if revisado is not None: q += " AND revisado=?"; params.append(revisado)
    if categoria: q += " AND categoria=?"; params.append(categoria)
    q += " ORDER BY data DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.patch("/lancamentos/{lid}")
def atualizar_lancamento(lid: int, body: AtualizarLancamento):
    conn = get_conn()
    fields, params = [], []
    if body.categoria is not None: fields.append("categoria=?"); params.append(body.categoria)
    if body.viagem is not None:    fields.append("viagem=?");    params.append(body.viagem)
    if body.revisado is not None:  fields.append("revisado=?");  params.append(body.revisado)
    if not fields: raise HTTPException(400, "Nada para atualizar")
    params.append(lid)
    conn.execute(f"UPDATE lancamentos SET {','.join(fields)} WHERE id=?", params)
    conn.commit(); conn.close()
    return {"ok": True}

@app.delete("/lancamentos/{lid}")
def excluir_lancamento(lid: int):
    conn = get_conn()
    conn.execute("DELETE FROM lancamentos WHERE id=?", (lid,))
    conn.commit(); conn.close()
    return {"ok": True}


# ── VIAGENS ───────────────────────────────────────────────────────────────

@app.get("/viagens")
def listar_viagens():
    conn = get_conn()
    viagens = conn.execute("SELECT * FROM viagens ORDER BY data_inicio DESC").fetchall()
    result = []
    for v in viagens:
        lancamentos = conn.execute("SELECT * FROM lancamentos WHERE viagem=? ORDER BY data", (v['destino'],)).fetchall()
        gastos_cat = {}; total = 0
        for l in lancamentos:
            cat = l['categoria'] or 'O'
            if cat not in ('SA','I','F'):
                gastos_cat[cat] = gastos_cat.get(cat, 0) + abs(l['valor'])
                total += abs(l['valor'])
        result.append({**dict(v), 'total': round(total,2), 'por_categoria': {k: round(v2,2) for k,v2 in gastos_cat.items()}, 'num_lancamentos': len(lancamentos)})
    conn.close()
    return result

@app.post("/viagens")
def criar_viagem(body: NovaViagem):
    conn = get_conn()
    conn.execute("INSERT OR IGNORE INTO viagens (destino, data_inicio, data_fim) VALUES (?,?,?)", (body.destino, body.data_inicio, body.data_fim))
    conn.commit(); conn.close()
    return {"ok": True}


# ── DASHBOARD ─────────────────────────────────────────────────────────────

@app.get("/dashboard")
def dashboard(meses: int = 6):
    conn = get_conn()
    rows = conn.execute("""
        SELECT mes, categoria, valor FROM lancamentos
        WHERE categoria != 'F' AND categoria IS NOT NULL ORDER BY mes
    """).fetchall()

    hoje  = datetime.now()
    # Último mês completo = mês anterior ao atual
    if hoje.month == 1:
        limite = (hoje.year - 1, 12)
    else:
        limite = (hoje.year, hoje.month - 1)

    def sort_mes(m):
        try: p = m.split('/'); return (int(p[1]), int(p[0]))
        except: return (0,0)

    por_mes = {}
    for r in rows:
        m, cat = r['mes'], r['categoria']
        try:
            p = m.split('/')
            if (int(p[1]), int(p[0])) > limite: continue
        except: continue
        if m not in por_mes: por_mes[m] = {}
        por_mes[m][cat] = por_mes[m].get(cat, 0) + r['valor']

    meses_ord = sorted(por_mes.keys(), key=sort_mes)
    ultimos   = meses_ord[-meses:] if len(meses_ord) >= meses else meses_ord

    metricas = []
    for m in ultimos:
        d = por_mes[m]
        receita = d.get('SA', 0)
        investimentos = d.get('I', 0)
        despesas = sum(v for k,v in d.items() if k not in ('SA','I','F') and v < 0)
        metricas.append({
            'mes': m, 'receita': round(receita,2),
            'despesas': round(abs(despesas),2),
            'investimentos': round(abs(investimentos),2),
            'superavit': round(receita+despesas,2),
            'categorias': {k: round(v,2) for k,v in d.items()},
        })

    ultimo    = metricas[-1] if metricas else {}
    positivos = sum(1 for m in metricas if m['superavit'] > 0)
    indice    = round((positivos/len(metricas))*100) if metricas else 0
    conn.close()
    return {"indice_saude": indice, "metricas_mensais": metricas, "ultimo_mes": ultimo}


# ── EXPORTAR ──────────────────────────────────────────────────────────────

@app.get("/exportar")
def exportar_historico():
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    from datetime import date as date_type

    conn = get_conn()
    rows = conn.execute("""
        SELECT mes, data, descricao, credito, debito, valor, categoria, tipo, viagem
        FROM lancamentos
        ORDER BY SUBSTR(data,7,4) DESC, SUBSTR(data,4,2) DESC, SUBSTR(data,1,2) DESC
    """).fetchall()
    conn.close()

    wb = Workbook(); ws = wb.active; ws.title = "Lançamentos"
    headers = ['Mês','Data','Descrição','Crédito(R$)','Débito(R$)','Valor','Categoria','Tipo','Viagem']
    hf = PatternFill('solid', start_color='1F4E79')
    for col, h in enumerate(headers, 1):
        c = ws.cell(row=1, column=col, value=h)
        c.fill = hf; c.font = Font(bold=True, color='FFFFFF', name='Arial', size=10)
        c.alignment = Alignment(horizontal='center')
    for col, w in enumerate([10,12,45,14,14,14,12,10,20], 1):
        ws.column_dimensions[get_column_letter(col)].width = w

    for ri, row in enumerate(rows, 2):
        try:
            p = row['data'].split('/')
            dv = date_type(int(p[2]), int(p[1]), int(p[0]))
        except: dv = row['data']
        vals = [row['mes'], dv, row['descricao'], row['credito'], row['debito'],
                row['valor'], row['categoria'], row['tipo'], row['viagem']]
        for ci, v in enumerate(vals, 1):
            cell = ws.cell(row=ri, column=ci, value=v)
            if ci == 2 and isinstance(dv, date_type): cell.number_format = 'DD/MM/YYYY'
            if ci in [4,5,6]: cell.number_format = '#,##0.00'
        if ri % 2 == 0:
            for ci in range(1,10): ws.cell(row=ri, column=ci).fill = PatternFill('solid', start_color='EBF3FB')

    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = f"A1:I{len(rows)+1}"
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    nome = f"historico_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename={nome}"})


# ── ROOT ──────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "app": "Finanças Pessoais"}
