# Documentacao de `plataforma`

Este e o diretorio do app principal. Ele contem o backend, o frontend e scripts de inicializacao.

## Estrutura

- `main.py`: inicializador Windows/Python que sobe backend e frontend juntos.
- `start.sh`: inicializador shell para ambientes Unix-like.
- `README.md`: instrucoes antigas de uso e estrutura.
- `backend/`: API FastAPI, banco SQLite, parser de PDF e regras de categorizacao.
- `frontend/`: app React + Vite.

## Inicializacao integrada

`main.py` define:

- `ROOT`: pasta `plataforma`;
- `BACKEND_DIR`: `plataforma/backend`;
- `FRONTEND_DIR`: `plataforma/frontend`.

Ele procura `backend/.venv312/Scripts/python.exe`; se existir, usa esse Python para o backend. Caso contrario usa o Python atual. Para o frontend, procura `npm.cmd` ou `npm` no `PATH`.

Processos iniciados:

- backend: `python -m uvicorn main:app --reload --port 8000`, rodando dentro de `backend/`;
- frontend: `npm run dev -- --host 127.0.0.1`, rodando dentro de `frontend/`.

O script faz streaming dos logs prefixando linhas com `[backend]` e `[frontend]`. Ao pressionar `Ctrl+C`, encerra os subprocessos.

## Fluxo funcional

1. Usuario acessa o frontend.
2. Aba Upload envia um ou mais PDFs para `POST /upload`.
3. Backend detecta tipo de cada PDF, extrai lancamentos, categoriza e grava em `staging`.
4. Frontend abre Revisao com os itens retornados.
5. Usuario corrige categorias, exclui itens se necessario e informa/pula viagem.
6. Frontend chama `POST /incorporar`.
7. Backend move itens validos de `staging` para `lancamentos`.
8. Dashboard consulta `/dashboard`, `/viagens`, `/status`, `/verificar` e `/exportar`.

## Contratos importantes

- Backend esperado em `http://127.0.0.1:8000`.
- Frontend esperado em `http://127.0.0.1:5173`.
- Banco principal: `backend/financas.db`.
- A API habilita CORS amplo (`allow_origins=["*"]`) para uso local.

## Cuidados ao alterar

- Se mudar a porta do backend, atualizar os `const API` no frontend.
- Se mudar nomes/codigos de categoria, atualizar backend, Revisao, Dashboard e verificacao de base juntos.
- `start.sh` instala dependencias sempre que roda; `main.py` nao instala, apenas inicia.
