"""
Script para carregar o histórico definitivo no banco da plataforma.
Execute uma única vez: python carregar_historico.py
"""
import openpyxl
import os
from database import init_db, get_conn

def carregar():
    # Inicializar banco com estrutura e regras
    init_db()
    conn = get_conn()
    c = conn.cursor()

    # Verificar se já foi carregado
    total = c.execute("SELECT COUNT(*) FROM lancamentos WHERE origem='historico'").fetchone()[0]
    if total > 0:
        print(f"Histórico já carregado ({total} lançamentos). Abortando.")
        conn.close()
        return

    # Caminho do arquivo — ajuste se necessário
    arquivo = os.path.join(os.path.dirname(__file__), '..', '..', 'historico_definitivo.xlsx')
    if not os.path.exists(arquivo):
        arquivo = input("Caminho do historico_definitivo.xlsx: ").strip()

    wb = openpyxl.load_workbook(arquivo)
    ws = wb['Lançamentos']

    # Inserir viagens
    viagens = [
        ('Rio de Janeiro',          '14/11/2023', '18/11/2023'),
        ('Ilhabela',                '11/11/2024', '18/11/2024'),
        ('Praia do Rosa + Floripa', '27/12/2024', '10/01/2025'),
        ('Rio de Janeiro',          '16/02/2025', '18/02/2025'),
        ('Petar',                   '14/04/2025', '22/04/2025'),
        ('Ubatuba',                 '12/08/2025', '22/08/2025'),
        ('Camburi',                 '20/09/2025', '21/09/2025'),
        ('Itacaré',                 '01/11/2025', '10/11/2025'),
        ('Itaunas',                 '26/12/2025', '18/01/2026'),
        ('Carnaval Rio',            '13/02/2026', '22/02/2026'),
    ]
    for destino, inicio, fim in viagens:
        try:
            c.execute("INSERT OR IGNORE INTO viagens (destino, data_inicio, data_fim) VALUES (?,?,?)",
                      (destino, inicio, fim))
        except: pass

    # Inserir lançamentos
    inseridos = erros = 0
    for i, row in enumerate(ws.iter_rows(values_only=True), 1):
        if i == 1 or not row[0] or not row[1]: continue
        desc = str(row[2]).strip() if row[2] else ''
        if not desc or desc == 'None': continue

        mes  = str(row[0]).strip()
        data = str(row[1]).strip()
        try: cred = float(str(row[3]).replace(',','.')) if row[3] else None
        except: cred = None
        try: deb  = float(str(row[4]).replace(',','.')) if row[4] else None
        except: deb = None
        try: val  = float(str(row[5]).replace(',','.')) if row[5] else 0
        except: val = 0

        cat    = str(row[6]).strip() if row[6] else '?'
        tipo   = str(row[7]).strip() if row[7] else 'Débito'
        viagem = str(row[8]).strip() if row[8] and str(row[8]) != 'None' else None

        try:
            c.execute("""
                INSERT INTO lancamentos
                  (mes, data, descricao, credito, debito, valor, categoria, tipo, viagem, revisado, origem)
                VALUES (?,?,?,?,?,?,?,?,?,1,'historico')
            """, (mes, data, desc, cred, deb, val, cat, tipo, viagem))
            inseridos += 1
        except Exception as e:
            erros += 1

    # Registrar upload do histórico
    c.execute("""
        INSERT INTO uploads (tipo, nome_arquivo, periodo_inicio, periodo_fim, total_lancamentos)
        VALUES ('historico','historico_definitivo.xlsx','01/07/2023','30/04/2026',?)
    """, (inseridos,))

    conn.commit()
    conn.close()
    print(f"✓ Histórico carregado: {inseridos} lançamentos | {erros} erros")

if __name__ == '__main__':
    carregar()
