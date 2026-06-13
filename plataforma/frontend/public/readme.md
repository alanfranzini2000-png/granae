# Documentacao de `plataforma/frontend/public`

Assets estaticos servidos diretamente pelo Vite.

## Diretorios

- `gogo/`: imagens do personagem GOGO e baloes/falas usados pelo app.
- `viagens/`: imagens de capa para cards de viagens no Dashboard.

## Como os assets sao referenciados

Qualquer arquivo em `public` fica disponivel a partir da raiz do servidor Vite. Exemplos:

- `public/gogo/GG.normal.PNG` vira `/gogo/GG.normal.PNG`;
- `public/viagens/ubatuba.png` vira `/viagens/ubatuba.png`.

## Cuidados ao alterar

- Renomear arquivos quebra referencias hardcoded em React.
- Preserve maiusculas/minusculas dos nomes; em alguns ambientes o sistema de arquivos diferencia caixa.
- Nao mova assets para `src` sem adaptar imports. O codigo atual usa caminhos publicos absolutos.
