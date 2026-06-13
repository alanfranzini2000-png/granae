# Documentacao de `visual`

Acervo visual fonte do projeto. Contem imagens do personagem GOGO, falas e cartoes de viagem. Parte dos assets daqui foi copiada para `plataforma/frontend/public`.

## Conteudo

- Arquivos `GG.*.PNG`: variantes recortadas/publicaveis do personagem.
- Arquivos `fala.*.PNG`: baloes/falas usados nos feedbacks.
- `gogo/`: imagens fonte/maiores do personagem e composicoes.
- `cartoes/`: artes de cartoes de viagem.

## Relacao com o frontend

O app em runtime nao le diretamente `visual/`. Ele usa assets dentro de `plataforma/frontend/public`. Se alterar algo aqui, copie/exporte a versao final para o diretorio publico correspondente.

## Observacoes

- Existe um `GG.normal.PNG` com tamanho `0` tambem listado no acervo raiz. Verifique antes de usar como fonte.
- Nomes de arquivo incluem espacos, acentos e maiusculas. Ao referenciar por codigo, prefira nomes normalizados sem espacos quando possivel.

## Cuidados ao alterar

- Nao comprimir/substituir os arquivos fonte sem manter backup quando forem artes originais.
- Ao criar novo asset para o app, documente o evento/tela onde sera usado e copie para `plataforma/frontend/public`.
