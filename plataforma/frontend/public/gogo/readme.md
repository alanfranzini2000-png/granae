# Documentacao de `plataforma/frontend/public/gogo`

Imagens publicas do personagem GOGO e das falas usadas em feedbacks da UI.

## Familias de arquivos

- `GG.certo*`: sucesso/incorporacao.
- `GG.descolado*`: download ou estado positivo.
- `GG.ostentando*`: upload/superavit.
- `GG.poupando*`: regra/gasto salvo.
- `GG.suave*`: variantes positivas/brand.
- `GG.surpreso*`: erro, deficit ou estado vazio.
- `GG.nasty.PNG`: usado no evento `catalogado`.
- `fala.*.PNG`: imagens de balao/fala para eventos.

## Uso no codigo

- `src/components/Gogo.jsx` mapeia eventos para imagens.
- `src/App.jsx` usa `/gogo/GG.normal.PNG` no logo.
- `src/pages/Dashboard.jsx` sorteia familias para cards/estados.
- `src/pages/Revisao.jsx` usa `/gogo/GG.normal.PNG` quando nao ha upload carregado.

## Observacoes

- `GG.normal.PNG` esta com tamanho `0` neste diretorio. Isso pode fazer o logo/estado vazio nao aparecer. Verifique o arquivo fonte em `visual/` antes de substituir.
- Os nomes usam acentos e maiusculas em alguns casos; mantenha os caminhos exatamente iguais aos usados no React.
