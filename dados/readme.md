# Documentacao de `dados`

Este diretorio guarda codigos auxiliares e versoes anteriores/prototipos do app financeiro. Ele nao parece ser o caminho principal usado em producao local hoje; o app atual esta em `plataforma/`.

## Papel do diretorio

Use `dados/` como referencia historica para entender decisoes antigas, comparar fluxos e recuperar trechos se necessario. Para novas features, correcoes de API ou mudancas de UI, altere primeiro `plataforma/`.

## Arquivos

- `main.py`: versao anterior da API FastAPI. Aceita upload unico em `/upload`, processa PDF com `pdfplumber`, salva em `staging`, incorpora em `lancamentos`, lista/atualiza lancamentos, gerencia viagens e retorna dashboard.
- `categorizer.py`: versao anterior do categorizador por palavras-chave e IA. Contem regras de categorias e funcao `limpar_desc`.
- `carregar_historico.py`: script antigo para importar `historico_definitivo.xlsx` para SQLite.
- `Revisao.jsx`: tela React antiga de revisao de lancamentos ja persistidos, diferente do fluxo atual de revisao pos-upload em `plataforma/frontend/src/pages/Revisao.jsx`.

## Dependencias implicitas

Os arquivos daqui importam `database` e `parser`, mas esses modulos nao existem neste diretorio. Isso reforca que a pasta e um recorte/prototipo e nao deve ser executada isoladamente sem ajustes.

## Cuidados ao alterar

- Nao propague mudancas daqui para o app atual sem comparar com `plataforma/backend` e `plataforma/frontend`.
- Se esta pasta for mantida, documente explicitamente se ela e "arquivo morto", "laboratorio" ou "ferramenta ativa".
- Evite colocar segredos reais em `ANTHROPIC_API_KEY`; a versao atual do backend le a chave de variavel de ambiente.
