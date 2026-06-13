# Documentacao de `plataforma/frontend`

Frontend React + Vite do app Granae. Consome a API local FastAPI em `http://127.0.0.1:8000`.

## Arquivos

- `package.json`: scripts `dev`, `build` e `preview`; dependencias React/Vite.
- `package-lock.json`: lockfile npm.
- `vite.config.js`: configuracao Vite com plugin React.
- `index.html`: HTML base com `#root`.
- `index.css`: copia de estilos globais; o app importa `src/index.css`.
- `src/`: codigo React.
- `public/`: assets servidos estaticamente por Vite.

## Scripts

```powershell
npm run dev
npm run build
npm run preview
```

Durante desenvolvimento, o app costuma rodar em `http://127.0.0.1:5173`.

## Convencoes

- O codigo usa CSS inline em componentes, apoiado por variaveis CSS globais em `src/index.css`.
- As telas declaram `const API = "http://127.0.0.1:8000"` localmente.
- Assets publicos sao referenciados por caminho absoluto, por exemplo `/gogo/GG.normal.PNG` e `/viagens/ubatuba.png`.
- O dashboard carrega Chart.js por CDN em runtime. Isso exige internet no navegador do usuario.

## Cuidados ao alterar

- Se adicionar variaveis CSS, colocar em `src/index.css`.
- Se adicionar assets usados em runtime, preferir `public/` e caminhos absolutos.
- Se remover ou renomear imagens do GOGO, atualizar `src/components/Gogo.jsx`, `src/App.jsx` e `src/pages/Dashboard.jsx`.
- Se trocar a URL da API, atualize todas as ocorrencias de `const API`.
