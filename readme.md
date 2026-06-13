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

## Manutencao do banco de dados

### Excluir lancamentos por data

Para remover lancamentos de datas especificas, use o SQLite diretamente no arquivo `plataforma/backend/financas.db`.

**Passo 1 — visualizar as ultimas datas antes de excluir:**

```powershell
cd plataforma/backend
& "C:\Users\alanf\.local\bin\python3.12.exe" -c "
import sqlite3
from datetime import datetime
conn = sqlite3.connect('financas.db')
conn.row_factory = sqlite3.Row
hoje = datetime.now().strftime('%Y%m%d')
rows = conn.execute('''
    SELECT DISTINCT data FROM lancamentos
    WHERE SUBSTR(data,7,4)||SUBSTR(data,4,2)||SUBSTR(data,1,2) <= ?
    ORDER BY SUBSTR(data,7,4) DESC, SUBSTR(data,4,2) DESC, SUBSTR(data,1,2) DESC
    LIMIT 10
''', (hoje,)).fetchall()
for r in rows:
    n = conn.execute('SELECT COUNT(*) as c FROM lancamentos WHERE data=?', (r['data'],)).fetchone()['c']
    print(r['data'], '--', n, 'lancamentos')
conn.close()
"
```

**Passo 2 — excluir uma data especifica:**

```powershell
& "C:\Users\alanf\.local\bin\python3.12.exe" -c "
import sqlite3
conn = sqlite3.connect('financas.db')
n = conn.execute('SELECT COUNT(*) FROM lancamentos WHERE data=?', ('DD/MM/YYYY',)).fetchone()[0]
print('Lancamentos a excluir:', n)
conn.execute('DELETE FROM lancamentos WHERE data=?', ('DD/MM/YYYY',))
conn.commit()
conn.close()
print('Excluido.')
"
```

Substitua `DD/MM/YYYY` pela data desejada (ex: `12/06/2026`).

**Passo 3 — excluir os N ultimos dias (sem apagar datas futuras):**

```powershell
& "C:\Users\alanf\.local\bin\python3.12.exe" -c "
import sqlite3
from datetime import datetime
N = 2  # altere para o numero de dias desejado
conn = sqlite3.connect('financas.db')
conn.row_factory = sqlite3.Row
hoje = datetime.now().strftime('%Y%m%d')
datas = conn.execute('''
    SELECT DISTINCT data FROM lancamentos
    WHERE SUBSTR(data,7,4)||SUBSTR(data,4,2)||SUBSTR(data,1,2) <= ?
    ORDER BY SUBSTR(data,7,4) DESC, SUBSTR(data,4,2) DESC, SUBSTR(data,1,2) DESC
    LIMIT ?
''', (hoje, N)).fetchall()
for r in datas:
    conn.execute('DELETE FROM lancamentos WHERE data=?', (r['data'],))
    print('Excluida data:', r['data'])
conn.commit()
conn.close()
"
```

**Importante:**
- O banco nao tem backup automatico. Copie `financas.db` antes de excluir.
- Datas estao no formato `DD/MM/YYYY` (ex: `05/12/2024`).
- O filtro `SUBSTR(data,7,4)||SUBSTR(data,4,2)||SUBSTR(data,1,2) <= hoje` garante que datas futuras nao sejam incluidas.
- Apos exclusoes grandes, rode `GET /verificar` para checar integridade da base.

## Cuidados para IAs futuras

- Trate `plataforma/backend/financas.db` como dado local do usuario. Nao apagar, resetar ou recriar sem pedido explicito.
- O projeto tem arquivos com acentos corrompidos por encoding em alguns codigos e no README antigo. Ao editar, prefira UTF-8 limpo, mas nao refatore textos sem necessidade.
- Nao documente nem altere dependencias vendorizadas ou geradas (`node_modules`, `.venv`, `.venv312`, `__pycache__`).
- O backend e o frontend usam strings de tipo como `Debito`/`Credito` com acentos em alguns pontos do codigo atual. Antes de alterar comparacoes, confira o valor real salvo no banco.
- O frontend usa URLs fixas para `http://127.0.0.1:8000`; se mudar porta/base URL, atualize todas as telas que declaram `API`.
