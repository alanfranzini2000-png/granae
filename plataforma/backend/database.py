import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "financas.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.executescript("""
    -- Lançamentos definitivos (fonte da verdade)
    CREATE TABLE IF NOT EXISTS lancamentos (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        mes        TEXT    NOT NULL,
        data       TEXT    NOT NULL,
        descricao  TEXT    NOT NULL,
        credito    REAL,
        debito     REAL,
        valor      REAL    NOT NULL,
        categoria  TEXT,
        tipo       TEXT    NOT NULL,
        viagem     TEXT,
        revisado   INTEGER DEFAULT 1,
        origem     TEXT    DEFAULT 'upload',
        fonte      TEXT    DEFAULT 'regra',
        created_at TEXT    DEFAULT (datetime('now'))
    );

    -- Área temporária: lançamentos aguardando revisão
    CREATE TABLE IF NOT EXISTS staging (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        upload_id  INTEGER,
        mes        TEXT    NOT NULL,
        data       TEXT    NOT NULL,
        descricao  TEXT    NOT NULL,
        credito    REAL,
        debito     REAL,
        valor      REAL    NOT NULL,
        categoria  TEXT,
        tipo       TEXT    NOT NULL,
        fonte      TEXT,
        duplicata  INTEGER DEFAULT 0,
        created_at TEXT    DEFAULT (datetime('now'))
    );

    -- Períodos de viagem
    CREATE TABLE IF NOT EXISTS viagens (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        destino     TEXT NOT NULL,
        data_inicio TEXT NOT NULL,
        data_fim    TEXT NOT NULL,
        created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Registro de uploads realizados
    CREATE TABLE IF NOT EXISTS uploads (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo                TEXT NOT NULL,
        nome_arquivo        TEXT NOT NULL,
        periodo_inicio      TEXT,
        periodo_fim         TEXT,
        total_lancamentos   INTEGER,
        incorporado         INTEGER DEFAULT 0,
        created_at          TEXT DEFAULT (datetime('now'))
    );

    -- Status da base: última linha única, atualizada a cada incorporação
    CREATE TABLE IF NOT EXISTS status_base (
        id                   INTEGER PRIMARY KEY CHECK (id = 1),
        ultimo_dado_debito   TEXT,
        ultimo_dado_credito  TEXT,
        ultima_atualizacao   TEXT
    );

    -- Garantir que existe sempre uma linha no status_base
    INSERT OR IGNORE INTO status_base (id) VALUES (1);
    """)

    conn.commit()
    conn.close()


def atualizar_status_base(conn, tipo):
    """
    Atualiza status_base após incorporação.
    tipo: 'debito' ou 'credito'
    """
    if tipo == 'debito':
        row = conn.execute("""
            SELECT MAX(data) as ultima FROM lancamentos
            WHERE tipo = 'Débito' AND origem = 'upload'
        """).fetchone()
        if row and row['ultima']:
            conn.execute("""
                UPDATE status_base SET
                    ultimo_dado_debito = ?,
                    ultima_atualizacao = datetime('now')
                WHERE id = 1
            """, (row['ultima'],))

    elif tipo == 'credito':
        row = conn.execute("""
            SELECT MAX(data) as ultima FROM lancamentos
            WHERE tipo = 'Crédito' AND origem = 'upload'
        """).fetchone()
        if row and row['ultima']:
            conn.execute("""
                UPDATE status_base SET
                    ultimo_dado_credito = ?,
                    ultima_atualizacao = datetime('now')
                WHERE id = 1
            """, (row['ultima'],))


if __name__ == "__main__":
    init_db()
    print("Banco inicializado!")
