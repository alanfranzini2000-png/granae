#!/bin/bash
echo "Iniciando backend..."
cd backend
pip install -r requirements.txt -q
python -m uvicorn main:app --reload --port 8000 &

echo "Iniciando frontend..."
cd ../frontend
npm install -q
npm run dev &

echo ""
echo "✓ Plataforma rodando!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
