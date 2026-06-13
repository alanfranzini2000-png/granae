# Documentacao de `plataforma/frontend/src/components`

Componentes compartilhados do frontend.

## StatusBar.jsx

Renderizado no topo por `App.jsx`.

Recebe `statusUploads` com:

- `ultimo_dado_debito`;
- `ultimo_dado_credito`.

Mostra alerta quando debito ou credito nunca tiveram dados. Tambem permite:

- chamar `GET /verificar` e exibir problemas de base;
- abrir download de `GET /exportar` via link.

Cuidados:

- O componente recebe prop `onStatusRefresh` em `App.jsx`, mas a assinatura atual nao usa essa prop.
- Alguns estilos referenciam variaveis `--color-*` e `--border-radius-*` que nao existem em `src/index.css`.

## Gogo.jsx

Gerenciador de feedback visual do personagem GOGO.

Escuta o evento global:

```js
window.dispatchEvent(new CustomEvent("gogo-trigger", { detail: "upload" }))
```

Tipos mapeados:

- `upload`: toast com arquivo lido;
- `incorporado`: popup central com base atualizada;
- `download`: toast de download;
- `gasto_salvo`: toast de gasto salvo;
- `catalogado`: slide-in lateral;
- `erro`: toast de erro.

As imagens ficam em `/gogo`, ou seja, `plataforma/frontend/public/gogo`.

Nota tecnica: `triggerGogo(tipo, extra)` espalha `extra` fora de `detail`, mas o listener le apenas `e.detail`. Para enviar mensagem de erro customizada, ajustar helper/listener juntos.

## CardMetrica.jsx

Componente simples de card de metrica com label, valor e badge opcional. Parece pouco usado ou legado, pois suas variaveis CSS (`--color-background-*`, `--color-text-*`) nao batem com a paleta atual.

## Cuidados ao alterar

- Para novos feedbacks do GOGO, adicione entrada em `MAPEAMENTO` e garanta que as imagens existem.
- Prefira padronizar tokens visuais antes de reutilizar `CardMetrica`.
