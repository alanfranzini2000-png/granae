# Finanças Pessoais

## Como rodar localmente

### 1. Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

### 2. Frontend
cd frontend
npm install
npm run dev

### Acessar
Frontend: http://localhost:5173
API:      http://localhost:8000/docs

## Estrutura
backend/
  main.py          — API FastAPI
  database.py      — SQLite + regras de categorização
  categorizer.py   — lógica de catalogação automática
  parser.py        — leitura de PDFs (fatura e extrato)
  requirements.txt

frontend/
  src/
    App.jsx              — navegação entre abas
    pages/Upload.jsx     — upload de arquivos
    pages/Revisao.jsx    — revisão de lançamentos
    pages/Dashboard.jsx  — gráficos e insights
    components/
      StatusBar.jsx      — status débito/crédito
      CardMetrica.jsx    — card de métrica reutilizável

## Regras financeiras
- Receita = SA
- Despesas = tudo exceto SA, I e F
- Investimentos = I (separado, não entra no superávit)
- F (fatura do cartão) = sempre ignorado nos cálculos
