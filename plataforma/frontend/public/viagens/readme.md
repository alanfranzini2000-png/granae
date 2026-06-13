# Documentacao de `plataforma/frontend/public/viagens`

Imagens de capa usadas nos cards de viagens do Dashboard.

## Arquivos atuais

- `chapada-diamantina.png`
- `florianopolis.png`
- `ilha-bela.png`
- `itacaré.png`
- `itaunas.png`
- `petar.png`
- `rio-de-janeiro.png`
- `ubatuba.png`

## Uso no codigo

`src/pages/Dashboard.jsx` contem o mapa `VIAGEM_IMAGENS`, que normaliza o destino da viagem e escolhe o arquivo correspondente.

## Cuidados ao alterar

- Se adicionar uma imagem, tambem adicionar ou ajustar chave em `VIAGEM_IMAGENS`.
- Ha uma possivel divergencia no codigo atual: `Dashboard.jsx` aponta algumas chaves de Itacare para `itacara.png`, mas o arquivo existente e `itacaré.png`. Corrija o mapa ou renomeie o asset com cuidado.
- Se uma imagem falhar, o card continua com fallback visual, mas perde a capa.
