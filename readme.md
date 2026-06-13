# Documentacao do repositorio

Este repositorio contem o app de financas pessoais "Granae" e alguns materiais auxiliares. A documentacao foi escrita para apoiar IAs e desenvolvedores que forem ler, alterar ou evoluir o codigo no futuro.

## Visao geral

O app principal esta em `plataforma/`. Ele combina:

- backend FastAPI em `plataforma/backend`;
- frontend React + Vite em `plataforma/frontend`;
- banco SQLite local em `plataforma/backend/financas.db`;
- assets visuais em `plataforma/frontend/public`.

O fluxo central e: o usuario envia PDFs de extrato/fatura, o backend extrai lancamentos, categoriza por regra, salva em uma area temporaria (`staging`), o frontend pede revisao humana quando necessario e, por fim, os registros aprovados entram na tabela definitiva `lancamentos`.

## Diretorios

- `plataforma/`: app em execucao. E o diretorio principal para novas features.
- `dados/`: codigos de prototipo/apoio historico. Nao parece ser o caminho usado pelo app atual.
- `visual/`: acervo de imagens fonte do personagem GOGO, falas e cartoes de viagens. Parte desses arquivos foi copiada para `plataforma/frontend/public`.
- `.git/`: metadados Git. Nao editar manualmente.

## Como rodar

No Windows, a forma mais integrada e:

```powershell
cd plataforma
python main.py
```

O script inicia backend em `http://127.0.0.1:8000` e frontend em `http://127.0.0.1:5173`.

Tambem e possivel rodar separadamente:

```powershell
cd plataforma/backend
python -m uvicorn main:app --reload --port 8000
```

```powershell
cd plataforma/frontend
npm run dev
```

## Regras financeiras

Categorias validas usadas pelo app:

- `SA`: salario/renda;
- `I`: investimentos;
- `F`: fatura do cartao, ignorada nos calculos;
- `CA`: casa;
- `S`: saude;
- `E`: estudo;
- `A`: assinaturas;
- `T`: transporte;
- `M`: mercado;
- `C`: comida;
- `B`: bens;
- `R`: roupa;
- `L`: lazer;
- `O`: outros.

Receita vem de `SA`. Despesas sao valores negativos fora de `SA`, `I` e `F`. Investimentos ficam separados. `F` nao deve entrar em dashboard/superavit.

## Cuidados para IAs futuras

- Trate `plataforma/backend/financas.db` como dado local do usuario. Nao apagar, resetar ou recriar sem pedido explicito.
- O projeto tem arquivos com acentos corrompidos por encoding em alguns codigos e no README antigo. Ao editar, prefira UTF-8 limpo, mas nao refatore textos sem necessidade.
- Nao documente nem altere dependencias vendorizadas ou geradas (`node_modules`, `.venv`, `.venv312`, `__pycache__`).
- O backend e o frontend usam strings de tipo como `Debito`/`Credito` com acentos em alguns pontos do codigo atual. Antes de alterar comparacoes, confira o valor real salvo no banco.
- O frontend usa URLs fixas para `http://127.0.0.1:8000`; se mudar porta/base URL, atualize todas as telas que declaram `API`.
