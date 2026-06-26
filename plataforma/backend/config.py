"""Configuração local do app, fora da pasta de instalação.

Guarda a chave da Anthropic (BYOK: cada pessoa cadastra a própria, ou recebe a
do distribuidor manualmente) num arquivo de config FORA do código-fonte, na
pasta de dados do usuário do sistema operacional — assim ela não vai junto
com o instalador/executável nem é exposta de dentro do pacote distribuído.

Prioridade de leitura da chave:
1) config.json local (gravado pela tela de Configurações do app);
2) variável de ambiente / backend/.env (uso em desenvolvimento).
"""
import os
import json
from pathlib import Path

APP_NAME = "Granae"


def _app_data_dir():
    if os.name == "nt":
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
    else:
        base = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    d = Path(base) / APP_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


APP_DATA_DIR = _app_data_dir()
CONFIG_PATH = APP_DATA_DIR / "config.json"


def _load():
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save(cfg):
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")


def get_api_key():
    """Retorna a chave Anthropic configurada (local) ou, na ausência dela,
    a do ambiente/.env (fallback útil em desenvolvimento)."""
    chave = (_load().get("anthropic_api_key") or "").strip()
    if chave:
        return chave
    return os.environ.get("ANTHROPIC_API_KEY", "").strip()


def set_api_key(chave):
    cfg = _load()
    cfg["anthropic_api_key"] = (chave or "").strip()
    _save(cfg)


def limpar_api_key():
    cfg = _load()
    cfg.pop("anthropic_api_key", None)
    _save(cfg)


def tem_api_key():
    return bool(get_api_key())


def fonte_api_key():
    """'local' (configurada na tela do app), 'ambiente' (.env/dev) ou None."""
    if (_load().get("anthropic_api_key") or "").strip():
        return "local"
    if os.environ.get("ANTHROPIC_API_KEY", "").strip():
        return "ambiente"
    return None
