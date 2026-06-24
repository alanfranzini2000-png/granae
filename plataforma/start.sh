#!/bin/bash
# Sobe backend (FastAPI) e frontend (Vite).
# Usa explicitamente o venv .venv312 (o único com as dependências instaladas).
cd "$(dirname "$0")"

PY="backend/.venv312/Scripts/python.exe"   # Windows (Git Bash)
[ -f "$PY" ] || PY="backend/.venv312/bin/python"   # Linux/Mac
if [ ! -f "$PY" ]; then
  echo "ERRO: venv .venv312 não encontrado em backend/.venv312"
  echo "Crie com: python -m venv backend/.venv312 && \"$PY\" -m pip install -r backend/requirements.txt"
  exit 1
fi

echo "Iniciando backend (uvicorn --reload)..."
( cd backend && "../$PY" -m uvicorn main:app --reload --port 8000 ) &
BACK_PID=$!

echo "Iniciando frontend (vite)..."
( cd frontend && npm run dev ) &
FRONT_PID=$!

echo ""
echo "✓ Plataforma rodando!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo ""
echo "Ctrl+C para encerrar ambos."
trap "kill $BACK_PID $FRONT_PID 2>/dev/null" INT TERM
wait
