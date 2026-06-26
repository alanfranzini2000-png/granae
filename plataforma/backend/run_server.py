"""Ponto de entrada usado pelo binário compilado (Nuitka).

Diferente de `uvicorn main:app --reload` (usado em desenvolvimento), aqui o
servidor sobe direto, sem reload — é o que vira o sidecar do app empacotado.
"""
import uvicorn

from main import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
