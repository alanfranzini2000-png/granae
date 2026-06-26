import sqlite3
import os
import re
import shutil
from contextvars import ContextVar

import config as _config

BASE_DIR = os.path.dirname(__file__)
# Dados ficam FORA da pasta de instalação (sobrevivem a updates/reinstalação e
# não viajam junto com o pacote distribuído para outras pessoas).
DATA_DIR = os.path.join(str(_config.APP_DATA_DIR), "data")  # uma base .db por usuário
LEGACY_DB = os.path.join(BASE_DIR, "financas.db")  # base única antiga (pré-multiusuário)
LEGACY_DATA_DIR = os.path.join(BASE_DIR, "data")   # pasta antiga (dentro do projeto)
USUARIO_PADRAO = "principal"


def _migrar_bases_legadas():
    """Primeira execução após mover os dados para fora da pasta do projeto:
    copia as bases antigas (backend/data/*.db) para a nova pasta, sem
    sobrescrever nada que já exista no destino."""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        if os.path.isdir(LEGACY_DATA_DIR):
            for f in os.listdir(LEGACY_DATA_DIR):
                if f.endswith(".db"):
                    destino = os.path.join(DATA_DIR, f)
                    origem = os.path.join(LEGACY_DATA_DIR, f)
                    if not os.path.exists(destino):
                        shutil.copy2(origem, destino)
    except Exception:
        pass


_migrar_bases_legadas()

# Usuário da requisição corrente (setado pelo middleware/dependency do main.py).
_usuario_atual = ContextVar("usuario_atual", default=USUARIO_PADRAO)


def sanitizar_usuario(nome):
    """Normaliza o nome do usuário e impede path traversal (só [a-z0-9_-])."""
    nome = (nome or "").strip().lower()
    nome = re.sub(r"[^a-z0-9_-]", "", nome)
    return nome or USUARIO_PADRAO


def set_usuario(nome):
    _usuario_atual.set(sanitizar_usuario(nome))


def get_usuario():
    return _usuario_atual.get()


def db_path(usuario=None):
    u = sanitizar_usuario(usuario) if usuario else _usuario_atual.get()
    return os.path.join(DATA_DIR, f"{u}.db")


def get_conn(usuario=None):
    conn = sqlite3.connect(db_path(usuario))
    conn.row_factory = sqlite3.Row
    return conn


def init_db(usuario=None):
    os.makedirs(DATA_DIR, exist_ok=True)
    u = sanitizar_usuario(usuario) if usuario else _usuario_atual.get()
    caminho = os.path.join(DATA_DIR, f"{u}.db")

    # Migração única: a primeira vez que o usuário padrão é inicializado, herda
    # a base legada (financas.db) — preserva todo o histórico já existente.
    if u == USUARIO_PADRAO and not os.path.exists(caminho) and os.path.exists(LEGACY_DB):
        shutil.copy2(LEGACY_DB, caminho)

    conn = sqlite3.connect(caminho)
    conn.row_factory = sqlite3.Row
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
        confianca  TEXT,
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
        confianca  TEXT,
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

    -- Regras de categorização definidas pelo usuário
    CREATE TABLE IF NOT EXISTS regras_categorias (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        palavra_chave TEXT NOT NULL UNIQUE,
        categoria   TEXT NOT NULL,
        created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Apelidos: nome "fantasia" que substitui o nome real do gasto na exibição.
    -- chave = descricao_real (nome como vem na fatura, já passado por limpar_desc).
    CREATE TABLE IF NOT EXISTS apelidos (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao_real TEXT NOT NULL UNIQUE,
        apelido        TEXT NOT NULL,
        created_at     TEXT DEFAULT (datetime('now'))
    );

    -- Insights ignorados pelo usuário (suprimidos até o fim do mês corrente).
    -- chave = "tipo|categoria|mes" (ex.: "atencao_consecutivo|C|6/2026").
    CREATE TABLE IF NOT EXISTS insights_ignorados (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        chave        TEXT NOT NULL UNIQUE,
        ignorado_ate TEXT NOT NULL,
        created_at   TEXT DEFAULT (datetime('now'))
    );

    -- Metas financeiras (uma base por usuário → sem coluna 'usuario': a posse
    -- é o próprio arquivo .db). tipos: 'limite','reducao','superavit','acumulo'.
    CREATE TABLE IF NOT EXISTS metas (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo            TEXT    NOT NULL,
        categoria       TEXT,                      -- código p/ limite e reducao; NULL p/ superavit e acumulo
        valor_alvo      REAL    NOT NULL,
        reducao_modo    TEXT,                      -- 'absoluto'|'percentual' (só reducao)
        acumulo_meses   INTEGER,                   -- nº de meses do período (só acumulo, >=2)
        acumulo_mes_fim TEXT,                      -- 'M/AAAA' mês final do período fixo (só acumulo)
        ativa           INTEGER NOT NULL DEFAULT 1,
        criada_em       TEXT    NOT NULL DEFAULT (date('now'))
    );

    -- Garantir que existe sempre uma linha no status_base
    INSERT OR IGNORE INTO status_base (id) VALUES (1);
    """)

    for tbl in ('lancamentos', 'staging'):
        try:
            c.execute(f"ALTER TABLE {tbl} ADD COLUMN confianca TEXT")
        except Exception:
            pass
        # Guarda o nome ORIGINAL da fatura quando um apelido substitui a descrição.
        try:
            c.execute(f"ALTER TABLE {tbl} ADD COLUMN descricao_real TEXT")
        except Exception:
            pass

    # Card (imagem de capa) escolhido para a viagem.
    try:
        c.execute("ALTER TABLE viagens ADD COLUMN card TEXT")
    except Exception:
        pass

    conn.commit()
    conn.close()


def buscar_apelido(conn, descricao_real):
    """Retorna o apelido cadastrado para um nome real, ou None."""
    row = conn.execute(
        "SELECT apelido FROM apelidos WHERE descricao_real=?", (descricao_real,)
    ).fetchone()
    return row['apelido'] if row else None


def atualizar_status_base(conn, tipo):
    """
    Atualiza status_base após incorporação.
    tipo: 'debito' ou 'credito'
    """
    if tipo == 'debito':
        row = conn.execute("""
            SELECT data as ultima FROM lancamentos
            WHERE tipo = 'Débito' AND origem = 'upload'
            ORDER BY SUBSTR(data,7,4) DESC,
                     SUBSTR(data,4,2) DESC,
                     SUBSTR(data,1,2) DESC
            LIMIT 1
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
            SELECT data as ultima FROM lancamentos
            WHERE tipo = 'Crédito' AND origem = 'upload'
            ORDER BY SUBSTR(data,7,4) DESC,
                     SUBSTR(data,4,2) DESC,
                     SUBSTR(data,1,2) DESC
            LIMIT 1
        """).fetchone()
        if row and row['ultima']:
            conn.execute("""
                UPDATE status_base SET
                    ultimo_dado_credito = ?,
                    ultima_atualizacao = datetime('now')
                WHERE id = 1
            """, (row['ultima'],))


# ── GERENCIAMENTO DE USUÁRIOS (bases) ─────────────────────────────────────

def listar_usuarios():
    """Lista as bases existentes (arquivos .db em data/), garantindo o padrão."""
    os.makedirs(DATA_DIR, exist_ok=True)
    nomes = {f[:-3] for f in os.listdir(DATA_DIR) if f.endswith(".db")}
    nomes.add(USUARIO_PADRAO)
    return sorted(nomes)


def criar_usuario(nome, origem=None):
    """Cria uma base nova para o usuário.

    Se 'origem' for uma base existente, a nova base nasce como CÓPIA dela
    (mesmos lançamentos, viagens e regras) e a partir daí evolui de forma
    independente — é a "base mestre" de onde o perfil parte. Sem 'origem',
    nasce vazia (apenas o schema).
    """
    u = sanitizar_usuario(nome)
    destino = os.path.join(DATA_DIR, f"{u}.db")
    if origem:
        o = sanitizar_usuario(origem)
        caminho_origem = os.path.join(DATA_DIR, f"{o}.db")
        # Só clona se a origem existe, é diferente do destino e o destino ainda
        # não existe (nunca sobrescreve uma base já criada).
        if o != u and os.path.exists(caminho_origem) and not os.path.exists(destino):
            os.makedirs(DATA_DIR, exist_ok=True)
            shutil.copy2(caminho_origem, destino)
    init_db(u)  # garante schema/migrações mesmo em base clonada
    return u


def apagar_usuario(nome):
    """Remove a base do usuário (não permitido para a base padrão)."""
    u = sanitizar_usuario(nome)
    if u == USUARIO_PADRAO:
        raise ValueError("Não é possível apagar a base padrão.")
    caminho = os.path.join(DATA_DIR, f"{u}.db")
    if os.path.exists(caminho):
        os.remove(caminho)
    return u


def zerar_usuario(nome):
    """Esvazia a base do usuário (mantém o schema) — útil para testar
    a incorporação de uma base do zero."""
    u = sanitizar_usuario(nome)
    init_db(u)  # garante que existe e tem schema
    conn = get_conn(u)
    conn.executescript("""
        DELETE FROM lancamentos;
        DELETE FROM staging;
        DELETE FROM viagens;
        DELETE FROM uploads;
        DELETE FROM regras_categorias;
        UPDATE status_base SET
            ultimo_dado_debito = NULL,
            ultimo_dado_credito = NULL,
            ultima_atualizacao = NULL
        WHERE id = 1;
    """)
    conn.commit()
    conn.close()
    return u


if __name__ == "__main__":
    init_db(USUARIO_PADRAO)
    print(f"Banco do usuário '{USUARIO_PADRAO}' inicializado em {db_path(USUARIO_PADRAO)}")
