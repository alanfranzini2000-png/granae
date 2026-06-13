# Documentacao de `plataforma/frontend/src/pages`

Telas principais do app.

## Upload.jsx

Tela de envio de PDFs. Mantem lista local de arquivos, aceita drag-and-drop e seletor de arquivos, filtra por `application/pdf` e evita duplicidade por nome.

Ao enviar:

- cria `FormData`;
- adiciona todos os arquivos no campo `files`;
- chama `POST /upload`;
- em sucesso, dispara evento GOGO `upload` e chama `onUploadSuccess(data)`;
- em erro, mostra mensagem e dispara evento GOGO `erro`.

Contrato esperado do backend: resposta com `upload_id`, `itens`, `sem_categoria` e dados auxiliares.

## Revisao.jsx

Tela de revisao do resultado de upload. Recebe `uploadData` de `App.jsx`.

Responsabilidades:

- listar itens retornados pelo staging;
- abrir popup obrigatorio para itens sem categoria;
- permitir alterar categoria;
- permitir excluir/restaurar item localmente antes de incorporar;
- perguntar se houve viagem no periodo;
- salvar viagem via `POST /viagens`;
- incorporar via `POST /incorporar`.

Categorias disponiveis: `SA`, `I`, `F`, `CA`, `S`, `E`, `A`, `T`, `M`, `C`, `B`, `R`, `L`, `O`.

Eventos GOGO disparados: `gasto_salvo`, `catalogado`, `incorporado`.

Observacao importante: a viagem criada nao e aplicada automaticamente aos lancamentos no corpo de `/incorporar`; atualmente ela apenas cadastra o periodo/destino.

## Dashboard.jsx

Tela de metricas e visualizacoes.

Dados consumidos:

- `GET /dashboard?meses=N`;
- `GET /viagens`.

Recursos:

- indice de saude financeira;
- cards do ultimo mes completo;
- grafico historico com Chart.js carregado via CDN;
- selecao de series base e categorias;
- composicao mensal por categoria;
- media por categoria;
- cards de viagens com imagens de `/viagens`.

Periodos aceitos na UI: `6m`, `12m`, `18m`, `24m`, `YTD`, `Max`. Atenção: a UI monta `?ytd=true` para YTD, mas o backend atual nao declara parametro `ytd`; na pratica o backend deve ignorar esse parametro e usar o default `meses=6` se nada mais mudar.

## Cuidados ao alterar

- Preserve o contrato `uploadData.itens` entre Upload e Revisao.
- Se alterar categorias, atualize os mapas `CATS_NOME`, `CATS_COR`, `CATS_GRAFICO` e a verificacao no backend.
- Se adicionar destinos de viagem, atualizar `VIAGEM_IMAGENS` e colocar imagem correspondente em `public/viagens`.
