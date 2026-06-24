# Roadmap — Novas ferramentas do Granaê

> Documento de planejamento. Vamos anotando cada parte aqui e implementamos tudo de uma vez no final.
> Status: ✅ Features 1–5 implementadas (2026-06-13). Pendente: validação visual no navegador.

## Status de implementação
- ✅ **Feature 1** — Empilhar (%) no gráfico
- ✅ **Feature 2** — Composição + média + desvio fundidas
- ✅ **Feature 3** — Ordenação cronológica + cards/cartões clicáveis + mês em andamento *(3c será revisto pela Feature 8: cartão de viagem vira pop-up)*
- ✅ **Feature 4** — Painel de Insights (gatilho por desvio padrão)
- ✅ **Feature 5** — Meses clicáveis (mês de foco)
- ✅ **Feature 6** — Lançamentos: editar viagem + rascunho com "Salvar na base"
- ✅ **Feature 7** — Destacar a linha do zero no gráfico
- ✅ **Feature 8** — Pop-up "Depurar" (clique-direito) com edição e salvar

### Implementação 6/7/8 (2026-06-13)
- Novo componente compartilhado `frontend/src/components/TabelaLancamentos.jsx` (tabela editável, `MenuContexto`, `ModalDepurar`, `BarraRascunho`).
- Rascunho global vive no `App.jsx` (sobrevive à troca de aba); `salvarRascunho` dispara PATCH/DELETE e bumpa `versaoDados` → listas e Dashboard recarregam.
- Edição de viagem: texto livre + `<datalist>` de sugestões; `viagem=""` limpa (testado no backend).
- Cartão de viagem agora abre o pop-up Depurar (3c revisada). Cards do topo seguem navegando.
- Clique-direito: no gráfico (canvas `onContextMenu` + `_serie` nos datasets) e nas linhas da tabela.
- Linha do zero: `grid` scriptable no eixo Y (cor + lineWidth no tick 0), theme-aware.

### Decisões tomadas na implementação
- Composição: a coluna de **desvio %** fica oculta no modo "mês em andamento" (comparar mês parcial com média de meses cheios enganaria); nesse modo a barra vira "a completar".
- **Média/desvio padrão excluem o mês em andamento** (mês incompleto não entra nas estatísticas do período).
- Bônus: corrigido o filtro **YTD** no `/dashboard` (estava ignorado no backend) e a ordenação cronológica de `/lancamentos`.

### Anomalias de dado encontradas (NÃO são parte das features — limpeza futura)
- 1 valor de `mes` malformado: `2025-06-01 00:00:00` (backend já ignora).
- Categorias inválidas na base: `?`, `Ã`, `AS`, `ML` (válidas: SA,I,F,CA,S,E,A,T,M,C,B,R,L,O). Use a aba/endpoint `/verificar`.

### Arquivos alterados
- `backend/main.py` — ordenação (`/lancamentos`, `/viagens`), `/dashboard` (em_andamento, ytd, helpers `_parse_mes`/`_montar_metrica`)
- `frontend/src/App.jsx` — navegação com filtro entre abas
- `frontend/src/pages/Lancamentos.jsx` — filtro de viagem + `filtroInicial`
- `frontend/src/pages/Dashboard.jsx` — reescrita com as 5 features

---

---

## Contexto atual (já existe)
- **Abas**: Upload, Revisão, Dashboard, Lançamentos, Avaliação
- **Backend** (FastAPI): /upload, /incorporar, /regras, /verificar, /status, /lancamentos (CRUD), /viagens, /dashboard, /exportar, /avaliar
- **Categorização**: regra fixa → IA (Claude Sonnet 4.6) → PIX → vermelho (manual)
- **14 categorias**: SA, I, F, CA, S, E, A, T, M, C, B, R, L, O
- **Banco** (SQLite): lancamentos, staging, viagens, uploads, status_base, regras_categorias

---

## Features a implementar

### 1. Modo "Empilhar" no gráfico de Evolução Histórica (Dashboard)
**Onde:** [Dashboard.jsx](frontend/src/pages/Dashboard.jsx) — gráfico "Evolução histórica" (só frontend, sem backend).

**O que faz:**
- Novo toggle **"Empilhar"** (botão ao lado dos filtros de período/séries).
- No modo empilhado, as categorias de gasto viram **área empilhada em %** (eixo Y de 0 a 100%).
- **Denominador = total de gastos do mês** (soma de TODAS as 11 categorias de gasto do mês, fixo).
  - Logo, a pilha só chega a 100% quando todas as 11 categorias estão selecionadas.
  - Se só algumas selecionadas → a pilha vai até a soma percentual delas (ex.: 3 categorias = 45%).
- **Receita, Despesa e Superávit NUNCA empilham** — continuam como linhas normais por cima da área.

**Categorias que empilham:** CA, S, L, C, T, M, E, A, B, R, O (as 11 de `CATS_GRAFICO`).

**Decisão visual:** ✅ Área empilhada (%) — áreas preenchidas sobrepostas, eixo Y 0–100%.

**Notas de implementação (Chart.js):**
- Estado novo: `const [empilhar, setEmpilhar] = useState(false)`.
- Datasets das categorias: quando `empilhar`, usar `fill: true`, `stack: "gastos"`, e dados = `categoria_mes / total_gastos_mes * 100`.
- Receita/Despesa/Superávit: **escondidas automaticamente** no modo empilhado (não renderiza esses datasets). Ao desligar "Empilhar", voltam conforme a seleção anterior. Os botões delas podem ficar desabilitados/esmaecidos enquanto empilhado.
- Eixo Y de % com `min:0, max:100`, ticks com sufixo "%".
- Tooltip no modo empilhado mostra "%" (e idealmente o R$ entre parênteses).
- `total_gastos_mes` = soma de `Math.abs(m.categorias[cat])` para as 11 cats (independente do que está selecionado).

---

### 2. Fundir "Composição" + "Média por categoria" num painel só (Dashboard)
**Onde:** [Dashboard.jsx](frontend/src/pages/Dashboard.jsx) — hoje são dois cards lado a lado (`Composição — {mes}` e `Média por categoria ({periodo})`). Vira **um painel único**. Só frontend.

**O que faz:**
- Mantém o **layout atual da Composição** (linha por categoria de gasto do último mês: dot, nome, barra de %, % e valor R$, ordenado por valor desc).
- **Nova coluna ao lado do valor R$**: a **média daquela categoria** no período.
- A média respeita os **filtros gerais de período** da página (6m / 12m / 18m / 24m / YTD / Max) e é a **média do período selecionado**.
- **Nova coluna de desvio %**: desvio percentual da observação da Composição (valor do último mês) em relação à média do período → `(ultimo_val - media) / media * 100`. (É o `diff` que já existe no cálculo de `medias`.)
- Some o card separado de "Média por categoria" (a info migra pra cá).

**Gatilho de insight (desvio padrão) — preparação para IA, tratar depois:**
- Calcular o **desvio padrão** de cada categoria ao longo dos meses do período (`metricas[].categorias[cat]`).
- **Flag** quando o último valor for **superior a 1 desvio padrão** acima do comportamento do período (`ultimo_val > media + std`).
- Por enquanto: apenas **computar a flag** (e marcação visual sutil, ex. ícone/realce). Servirá de **trigger para a IA comentar** no futuro — comentário da IA fica para outro momento.

**Notas de implementação:**
- Já existe `cats_desp` (composição do último mês) e `medias` (média + `diff` por categoria no período). Mesclar pela `cat`.
- Linhas = categorias da composição (gastos do último mês). Buscar média/desvio correspondentes por `cat`.
- Std por categoria: sobre os valores mensais do período (`metricas.map(m => Math.abs(m.categorias?.[cat] || 0))`). Definir média e desvio padrão (populacional) com base nesse array.
- Layout de colunas (por linha): dot · nome · barra(%) · %composição · R$ valor · **média R$** · **desvio% vs média** · (marcador se > 1σ).

---

### 3. Ordenação cronológica, cards/cartões clicáveis e "Mês em andamento"
Pacote grande, mexe em **backend + frontend**. Subdividido abaixo.

#### 3a. Ordenação cronológica (últimos em cima) — Lançamentos e Viagens
- **Lançamentos:** hoje o backend faz `ORDER BY data DESC` em [main.py](backend/main.py) (`/lancamentos`), mas `data` é texto `dd/mm/yyyy` → ordena pelo DIA, não cronologicamente. **Bug.**
  - Corrigir para ordenação cronológica real (mesmo padrão de `/status` e `/exportar`):
    `ORDER BY SUBSTR(data,7,4) DESC, SUBSTR(data,4,2) DESC, SUBSTR(data,1,2) DESC`.
- **Viagens:** `/viagens` faz `ORDER BY data_inicio DESC` — verificar formato de `data_inicio` e aplicar ordenação cronológica (mais recentes primeiro). ⚠️ confirmar formato da data na tabela `viagens` ao implementar.

#### 3b. Cards do topo clicáveis → abrem Lançamentos filtrado
Cards "Receita", "Despesas" e "Investimentos" (NÃO o Superávit) viram clicáveis. Levam à aba **Lançamentos** já filtrada pelo mês exibido:
- **Receita** → `mes = mês exibido` + `categoria = SA`.
- **Investimentos** → `mes = mês exibido` + `categoria = I`.
- **Despesas** → `mes = mês exibido` + `tipo = Débito` (✅ decisão: todos os débitos do mês, inclui fatura se houver).

#### 3c. Cartão de viagem clicável
> ⚠️ **Revisado pela Feature 8:** o clique no cartão de viagem agora abre o **pop-up "Depurar"** (não navega mais pra aba). Implementado originalmente como navegação; será trocado por pop-up.
- ~~Clicar no cartão de viagem → aba Lançamentos com filtro `viagem = destino`.~~ (substituído pelo pop-up Depurar — ver Feature 8)
- ⚠️ **Lançamentos NÃO tem filtro de viagem hoje** → adicionar um `<select>` de viagem nos filtros de [Lancamentos.jsx](frontend/src/pages/Lancamentos.jsx).

**Mecânica de navegação (3b + 3c):**
- [App.jsx](frontend/src/App.jsx): novo estado `lancFiltro` + setter. Passar callback `onNavegar(filtro)` para `<Dashboard>`; ela seta o filtro e troca `tab` para "Lançamentos".
- `<Lancamentos>` recebe `filtroInicial` e aplica no mount (sobrescreve o `mesSel` default que hoje pega o mês mais recente).

#### 3d. Botão toggle "Adicionar mês em andamento"
Toggle no Dashboard. **Desligado (default):** comportamento atual (só meses fechados; exclui o mês corrente incompleto via lógica de `limite`). **Ligado:**
- O **último mês com gastos aparece** mesmo incompleto.
- ✅ Afeta **tudo: cards + composição + gráfico** (o mês em andamento vira um ponto parcial no gráfico de Evolução).
- **4 cards do topo:** comparam o mês em andamento contra o **mesmo período corrido do mês anterior** — dia 1 até hoje (ex.: 1–13/jun) vs dia 1 até o mesmo dia do mês anterior (1–13/mai). Backend precisa prorratear por dia (filtrar `data` por dia ≤ corte).
- **Composição "a ser completada":** ✅ cada categoria enche em direção ao gasto **DELA no mês anterior fechado** (meta por categoria = 100%). Se ultrapassar, transborda / muda de cor ("superou o mês anterior"). Visual: barra parcial + marcação de 100% (mês anterior).

**Notas de implementação backend (3d):**
- `/dashboard` ganha parâmetro tipo `em_andamento=true`.
- Quando ligado: incluir o mês corrente; e retornar bloco extra com, para o mês em andamento:
  - parciais por categoria (mês corrente até hoje),
  - comparativo "período corrido" do mês anterior (mesmos dias),
  - total por categoria do mês anterior **fechado** (alvo das barras da composição).
- A query atual do `/dashboard` seleciona só `mes, categoria, valor` — para prorratear por dia precisa considerar `data` (dia ≤ dia de hoje) no mês corrente e no anterior.

---

### 4. Painel de Insights (no espaço vago da antiga "Média por categoria")
**Onde:** [Dashboard.jsx](frontend/src/pages/Dashboard.jsx) — card da direita que ficou **vago** depois da Feature 2 (a média migrou pra Composição). Só frontend (reusa dados já carregados).

**Objetivo agora:** testar o **gatilho (trigger)** de insights baseado em desvio padrão. **SEM comentário de IA por enquanto** — só identificar e listar. A IA virá depois (ver Feature 2, gatilho já preparado).

**Métrica:** z-score por categoria = `(último mês fechado − média do período) / desvio padrão do período`.
- Período = filtros gerais da página (6m / 12m / … / Max).
- Observação = **último mês FECHADO** (mesmo que o toggle "mês em andamento" esteja ligado — insight não usa mês parcial).

**O que mostrar no painel:**
1. **Top 5 categorias que mais desviaram** (maior `|z|`), com:
   - nome da categoria,
   - desvio em **σ** (ex.: "+1,8σ" / "−1,2σ"), com sinal/cor indicando subiu (gasto acima) ou caiu (abaixo),
   - opcional: valor R$ do mês vs média.
2. **Contador geral**: quantas categorias (das de gasto) estão **estourando o limite de 1σ** (`|z| > 1`) — ex.: "3 categorias fora do padrão" ou "nenhuma fora do padrão".

**Limite/threshold:** ✅ **1 desvio padrão** (`|z| > 1`).

**Categorias consideradas:** as de gasto (CA, S, L, C, T, M, E, A, B, R, O).

**Notas de implementação / guardas:**
- Calcular média e **desvio padrão** (populacional) por categoria sobre `metricas.map(m => Math.abs(m.categorias?.[cat] || 0))` do período.
- **Guardas:** exigir mínimo de meses no período (sugestão: ≥ 3) e ignorar categorias com `std ≈ 0` (evita z-score infinito/falso). Categoria sem dados suficientes não entra no ranking nem no contador.
- Reaproveita o mesmo cálculo de desvio padrão da Feature 2 (gatilho `> 1σ`) — centralizar num único helper.

---

### 5. Meses clicáveis no gráfico de linha → reposicionam o dashboard
**Onde:** [Dashboard.jsx](frontend/src/pages/Dashboard.jsx). Só frontend.

**O que faz:** clicar num mês (ponto/label) do gráfico de Evolução Histórica define esse mês como **mês de referência (foco)**. Todo o resto da página se move como se ele fosse o último mês:
- **Cards do topo**: passam a mostrar os dados do mês focado.
- **Composição**: mostra a composição do mês focado.
- **Insights** (Feature 4): observação passa a ser o mês focado.
- **Índice/header**: rótulo do mês acompanha.

**Decisões:**
- ✅ **Janela de análise = mantém o período inteiro visível.** Média e desvio padrão das categorias seguem usando TODOS os meses do período (6m/12m/…), inclusive os posteriores ao mês focado. O clique só muda o foco; as estatísticas continuam do período todo.
- ✅ **Cards comparam contra o mês imediatamente anterior** (focado − 1). Rótulo "vs {mês}" atualiza. (Generaliza o atual `ultimo` vs `penult`.)
- ✅ **Foco no mês parcial (em andamento):** cards e composição focam o parcial normalmente, mas **Insights caem para o último mês FECHADO**, com aviso discreto ("baseado em {mês fechado}").

**Comportamento de seleção (default meu, ajustável):**
- Estado inicial: foco = último mês (comportamento atual).
- Clicar de novo no mês já focado → **desmarca** (volta ao último mês).
- Marcação visual do ponto focado no gráfico (destaque/raio maior).

**Notas de implementação:**
- Generalizar a lógica que hoje usa `ultimo`/`penult` em [Dashboard.jsx](frontend/src/pages/Dashboard.jsx): introduzir `mesFoco` (default = último). Cards, composição e insights derivam de `mesFoco` em vez de `ultimo` fixo.
- Chart.js: usar `onClick`/`getElementsAtEventForMode` pra detectar o índice do mês clicado e setar `mesFoco`.
- Médias/σ permanecem calculados sobre o período inteiro (independe de `mesFoco`).

---

### 6. Lançamentos: editar viagem + rascunho com "Salvar na base"
**Onde:** [Lancamentos.jsx](frontend/src/pages/Lancamentos.jsx) + [App.jsx](frontend/src/App.jsx). **Frontend-only** (reusa PATCH/DELETE existentes — não muda contrato de backend).

**6a — Editar a "viagem" (tag) do lançamento:**
- Coluna **Viagem** vira editável inline: campo de **texto livre** que aceita **vazio ou qualquer texto**, com **sugestões** das viagens já existentes (via `<datalist>` populado por `viagensDisponiveis`).
- Texto novo (que não é uma viagem cadastrada) é aceito como simples tag — NÃO cria linha na tabela `viagens`.
- Backend já suporta: `PATCH /lancamentos/{id}` aceita `viagem` (inclusive `""` para limpar).

**6b — Rascunho + "Salvar na base":**
- ✅ **Nenhuma alteração toca o banco antes do "Salvar na base"** — categoria, viagem E **exclusões** ficam em rascunho.
- ✅ **Rascunho sobrevive à troca de aba** → estado do rascunho mora no **App.jsx** (passado para Lançamentos por props). Só se perde ao recarregar a página.
- Botão **"Salvar na base"**: destaque, mostra contador de pendências, desabilitado quando não há nada. Ao clicar: dispara os `PATCH` (campos alterados) e `DELETE` (linhas marcadas), recarrega e limpa o rascunho.
- Botão **"Descartar"**: limpa o rascunho sem gravar.
- **Banner** "X alterações não salvas" enquanto houver rascunho.

**Notas de implementação:**
- Estrutura do rascunho (no App): `{ edits: { [id]: { categoria?, viagem? } }, exclusoes: [ids] }`.
- A tabela renderiza refletindo o rascunho: categoria/viagem sobrescritas pelo rascunho; linhas marcadas para exclusão aparecem riscadas/destacadas com opção de desfazer.
- Substituir as funções de gravação imediata atuais (`salvarCategoria` PATCH na hora, `excluir` DELETE na hora) por mutações no rascunho.
- "Salvar na base": iterar edits → `PATCH`; iterar exclusoes → `DELETE`; depois `carregar()` e limpar rascunho.

### 7. Destacar a linha do zero no gráfico principal
**Onde:** [Dashboard.jsx](frontend/src/pages/Dashboard.jsx) — gráfico "Evolução histórica". Só frontend.

**O que faz:** a linha de grade no valor **0** do eixo Y fica destacada (mais visível que as demais), já que meses de déficit deixam o superávit negativo e a referência do zero importa.

**Decisão:** cor **theme-aware** (branca/clara no modo escuro, escura no modo claro) para ficar visível nos dois temas. _(Se for usar só dark mode, pode ser branco fixo — confirmar.)_

**Notas de implementação (Chart.js v4):**
- `scales.y.grid.color` vira função scriptable: `ctx => ctx.tick.value === 0 ? corZero : gridColor`.
- Opcional: `scales.y.grid.lineWidth` scriptable, mais grosso (ex.: 2) no tick 0.
- No modo empilhar (eixo 0–100%) o zero fica na base — inofensivo.

### 8. Pop-up "Depurar" (clique-direito) com edição e salvar
**Onde:** [Dashboard.jsx](frontend/src/pages/Dashboard.jsx) (gráfico + cartões de viagem), [Lancamentos.jsx](frontend/src/pages/Lancamentos.jsx) (tabela) e novo componente de modal. **Frontend-only** — sem mudança de contrato de backend (o modal busca `/lancamentos` e filtra no cliente).

**O que faz:** clique-direito (`contextmenu`) em um ponto de dado abre um mini-menu **"Depurar"**; ao clicar, abre um **pop-up** com os lançamentos que compõem aquele agregado, editáveis, com botão de salvar.

**Gatilhos do clique-direito:**
- **Gráfico:** `onContextMenu` no canvas → `getElementsAtEventForMode` identifica o ponto → `{mes, série}`. Mapeia série→filtro (igual aos cards, Feature 3b):
  - categoria (ex.: Comida em 3/2026) → `{mes, categoria}`
  - Receita → `{mes, categoria:'SA'}` · Despesas → `{mes, tipo:'Débito'}` · Superávit → `{mes}` (todos)
- **Tabela** ([Lancamentos.jsx](frontend/src/pages/Lancamentos.jsx)): `onContextMenu` na linha → "Depurar" → pop-up filtrado por `{mes, categoria}` daquela linha (o "grupo" a que ela pertence).
- **Cartão de viagem:** ✅ clique abre o pop-up direto (`{viagem}`), **substituindo a navegação** da Feature 3c.

**Pop-up (modal):**
- Título mostra o filtro (ex.: "Comida · 3/2026" ou "Viagem: Ubatuba").
- Lista os lançamentos do filtro, **editáveis com os mesmos campos da aba Lançamentos** (categoria via select; viagem via texto livre + datalist; marcar exclusão).
- Botão **"Salvar dados"**.
- Busca os dados via `/lancamentos` (params suportados: mes/categoria) e aplica o resto do filtro (tipo/viagem) no cliente — **sem alterar o backend**.

**Modelo de salvar:** ✅ **rascunho único compartilhado** (o mesmo da Feature 6, no App.jsx). Edições no pop-up entram no rascunho global; "Salvar dados" = flush do rascunho (grava todas as pendências, do pop-up e da aba). Um único lugar de verdade.

**Reuso:** criar um **componente de edição de lançamentos compartilhado** (linha editável + marcação de exclusão ligadas ao rascunho global) usado por: (a) tabela da aba Lançamentos, (b) pop-up Depurar.

**Notas de implementação:**
- Menu de contexto custom: `e.preventDefault()` + posicionar no cursor; fecha ao clicar fora/ESC.
- O modal precisa dos lançamentos; como o Dashboard não carrega lançamentos individuais hoje, o modal faz seu próprio `fetch('/lancamentos')` ao abrir e filtra no cliente.
- Top-4 cards (Receita/Despesas/Investimentos) mantêm o clique-esquerdo navegando pra aba (Feature 3b); clique-direito "Depurar" neles é opcional/futuro.

---

## Decisões em aberto
- _(nenhuma)_
