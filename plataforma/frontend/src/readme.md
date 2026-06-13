# Documentacao de `plataforma/frontend/src`

Codigo-fonte React do frontend.

## Arquivos

- `main.jsx`: ponto de entrada. Renderiza `<App />` em `#root` dentro de `React.StrictMode`.
- `App.jsx`: componente raiz, navegacao por abas e estado de upload/status.
- `index.css`: reset, tokens visuais e estilos globais.
- `pages/`: telas principais.
- `components/`: componentes compartilhados.

## App.jsx

`App.jsx` controla:

- aba ativa (`Dashboard`, `Upload`, `Revisao`);
- resultado de upload (`uploadData`);
- status das ultimas datas de debito/credito.

Fluxo:

1. Ao montar, chama `GET /status`.
2. Upload bem-sucedido chama `handleUploadSuccess`, guarda `uploadData` e troca para aba Revisao.
3. Incorporacao concluida limpa `uploadData`, atualiza status e volta ao Dashboard.

Tambem renderiza `GogoManager`, a barra superior, tabs e `StatusBar`.

## Estilos globais

`index.css` define tokens como:

- cores base: `--bg`, `--surface`, `--primary`, `--gold`, `--danger`;
- textos: `--text`, `--text-muted`, `--text-faint`;
- popup: `--popup-bg`, `--popup-surface`, `--popup-text`;
- raios: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`.

Alguns componentes antigos ainda referenciam variaveis `--color-*` e `--border-radius-*` que nao estao definidas neste CSS. Se esses componentes forem usados/alterados, padronize para os tokens atuais ou recrie os tokens faltantes.

## Cuidados ao alterar

- A navegacao e stateful, nao usa React Router.
- Nao existe camada central de cliente HTTP; cada tela chama `fetch` diretamente.
- Eventos visuais do GOGO usam `window.dispatchEvent(new CustomEvent("gogo-trigger", { detail: tipo }))`.
