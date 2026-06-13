# Documentacao de `plataforma/backend`

Backend FastAPI do app Granae. Ele recebe PDFs financeiros, extrai lancamentos, categoriza, controla revisao, persiste em SQLite e fornece dados agregados para o dashboard.

## Arquivos principais

- `main.py`: API FastAPI e endpoints.
- `database.py`: conexao SQLite, criacao de tabelas e atualizacao de status.
- `parser.py`: extracao de texto e parser de extrato/fatura.
- `categorizer.py`: regras de categoria, limpeza de descricao e categorizacao opcional por IA.
- `carregar_historico.py`: importa `historico_definitivo.xlsx` para o banco.
- `limpar_base.py`: identifica/remove descricoes sujas via dry-run ou `--apply`.
- `requirements.txt`: dependencias Python.
- `financas.db`: banco SQLite local. E dado do usuario.

## Banco de dados

`database.py` cria as tabelas:

- `lancamentos`: fonte da verdade dos registros incorporados.
- `staging`: area temporaria de lancamentos aguardando revisao.
- `viagens`: periodos de viagem cadastrados.
- `uploads`: historico de arquivos/processamentos.
- `status_base`: linha unica com ultimas datas conhecidas de debito/credito.

Campos centrais de `lancamentos`: `mes`, `data`, `descricao`, `credito`, `debito`, `valor`, `categoria`, `tipo`, `viagem`, `revisado`, `origem`, `fonte`.

Formato de data usado nos registros: `DD/MM/YYYY`. Formato de mes: `M/YYYY` ou `MM/YYYY` dependendo da origem.

## Endpoints

- `GET /`: health check simples.
- `POST /upload`: recebe `files` com um ou mais PDFs. Retorna `upload_id`, totais, duplicatas removidas, contagem sem categoria, itens de staging e erros por arquivo.
- `POST /incorporar`: recebe `upload_id` e itens revisados. Move itens de `staging` para `lancamentos`, ignora duplicatas e limpa o staging daquele upload.
- `POST /regras`: salva regra em `regras_categorias`.
- `GET /regras`: lista regras em `regras_categorias`.
- `GET /verificar`: checa problemas de qualidade na base.
- `GET /status`: retorna ultimas datas de debito e credito em `lancamentos`.
- `GET /lancamentos`: lista registros filtrando por `mes`, `revisado` e/ou `categoria`.
- `PATCH /lancamentos/{lid}`: atualiza `categoria`, `viagem` e/ou `revisado`.
- `GET /viagens`: lista viagens com total e gastos por categoria.
- `POST /viagens`: cria viagem por destino e datas.
- `GET /dashboard`: agrega metricas mensais dos ultimos `meses`.
- `GET /exportar`: gera XLSX com historico de lancamentos.

## Fluxo de upload

`main.py` chama `_processar_arquivo` para cada PDF:

1. `parser.processar_pdf` retorna tipo (`debito`/`credito`) e lancamentos brutos.
2. `categorizer.limpar_desc` normaliza descricoes.
3. Pagamento de fatura vindo de extrato de debito e ignorado.
4. `categorizer.categorizar(..., usar_ia=False)` tenta categorizar por regras locais.
5. O backend calcula `credito`, `debito`, `valor` e marca duplicata se ja existir `(data, descricao, valor)` em `lancamentos`.
6. Tudo vai para `staging`; duplicatas sao apagadas do staging antes de retornar ao frontend.

## Parser de PDF

`parser.py` primeiro tenta `pdftotext -layout`, que depende de Poppler instalado no sistema. Se falhar, usa `pdfplumber`.

Deteccao de layout:

- tenta IA Anthropic se `ANTHROPIC_API_KEY` existir;
- fallback por palavras-chave: `EXTRATO DE CONTA CORRENTE` para debito e `DETALHAMENTO DA FATURA`/`DETALHAMENTO DE FATURA` para credito.

Debito: usa linhas iniciadas por `DD/MM/YYYY`, ancora pelo numero do documento e descarta saldo. Credito: processa secoes de parcelamentos/despesas e suporta layout de duas colunas.

## Categorizacao

`categorizer.py` define `KEYWORDS`, `PERGUNTAR_SEMPRE`, `ORDEM` e regras de PIX. A funcao principal retorna `(categoria, confianca)`, onde `confianca` e:

- `verde`: regra confiavel ou IA alta;
- `amarelo`: IA media ou PIX pequeno;
- `vermelho`: sem regra, PIX alto ou item que deve perguntar sempre.

No fluxo atual de upload, `usar_ia=False`, entao a IA nao e chamada para categorizar lancamentos.

## Pontos de atencao

- `main.py` usa a tabela `regras_categorias`, mas `database.py` nao cria essa tabela no schema atual. Se endpoints `/regras` forem usados, criar/migrar a tabela antes.
- `atualizar_status_base` usa `MAX(data)` sobre texto `DD/MM/YYYY`, o que pode nao refletir a data mais recente em todos os casos. O endpoint `/status` usa ordenacao por substrings e e mais confiavel.
- Evite apagar `financas.db`; scripts de limpeza devem rodar em dry-run primeiro.
- Se alterar parser, teste com PDFs reais de debito e credito, porque pequenas mudancas de layout quebram extracao.
