# Kaminsky Weather API

API Node.js para cadastrar estações WeatherLink com ID próprio e consultar temperatura, umidade, chuva do dia, vento, pressão e demais informações do card. Normaliza unidades e mantém acesso opcional ao JSON original.

## Executar

Requer Node.js 22 ou superior.

```sh
npm ci --ignore-scripts
# Configure API_KEY no .env antes de iniciar
npm start
```

- Swagger interativo: http://127.0.0.1:3000/docs
- OpenAPI JSON: http://127.0.0.1:3000/openapi.json
- Saúde: http://127.0.0.1:3000/health

O Swagger UI é servido localmente pelo pacote instalado, sem CDN nem envio do contrato para validadores externos. A opção Try it out executa operações reais, inclusive exclusão.

## Configuração

| Variável | Padrão | Uso |
|---|---|---|
| HOST | 127.0.0.1 | Endereço de escuta |
| PORT | 3000 | Porta |
| DATA_FILE | data/estacoes.json | Arquivo persistente de cadastro |

Copie `.env.example` para `.env` e defina uma API_KEY aleatória. npm start carrega o .env automaticamente; variáveis já exportadas têm precedência.

## Uso

```sh
curl -X POST http://127.0.0.1:3000/estacoes \
  -H 'X-API-Key: SUA_CHAVE' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.weatherlink.com/map/0b4bc246-d54a-47a7-8abf-cbe8ad2d882b"}'
```

Copie o campo `id` retornado:

```sh
curl -H 'X-API-Key: SUA_CHAVE' http://127.0.0.1:3000/estacoes/ID_RETORNADO/dados
```

[Referência completa](docs/api.md) · [Contrato OpenAPI](docs/openapi.json)

## Estrutura

```text
src/server.cjs     Inicialização e encerramento do processo
src/app.cjs        HTTP, cache e integração WeatherLink
src/stations.cjs   Cadastro, persistência e normalização
src/swagger.cjs    Interface Swagger e assets locais
docs/             Referência e contrato OpenAPI
test/             Testes HTTP com fonte simulada
data/             Cadastros locais (ignorados pelo Git)
scripts/          Validação do contrato
```

## Verificação

```sh
npm test
npm run docs:validate
```

## Docker

```sh
docker build -t kaminsky .
docker run --rm --env-file .env -e HOST=0.0.0.0 -e DATA_FILE=/app/data/estacoes.json -p 127.0.0.1:3000:3000 -v kaminsky-data:/app/data kaminsky
```

Use uma única instância por arquivo de cadastro. Faça backup do volume antes de migrar.

## Limites atuais

- API Key compartilhada entre clientes autorizados. Use HTTPS e limites de uso antes de publicar. A configuração padrão é local.
- Cache de 15 minutos sob demanda, sem agendamento nem histórico. Dados com mais de 2 horas são sinalizados como atrasados e as medições são omitidas.
- O endpoint do WeatherLink é interno e não documentado, podendo mudar ou exigir autenticação. O acesso varia por estação.
- Chuva do dia não é acumulado móvel de 24 horas. Conversão de valores arredondados não recupera a precisão original.
- Nenhuma senha, sessão, cadastro real ou captura do celular está incluída no projeto.

## Autenticação

Todas as rotas de estações exigem `X-API-Key`, inclusive consultas, CRUD e a rota antiga `/chuva`. Chave ausente ou inválida retorna 401. Não envie a chave na URL. `/`, `/health`, `/docs` e `/openapi.json` são públicos.

Configure `API_KEY` no `.env` local com 32 a 256 caracteres ASCII sem espaços. Gere uma chave aleatória:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

No Swagger, clique em **Authorize**, informe somente a chave e confirme. A chave não é persistida pelo Swagger entre recarregamentos. Nunca publique o `.env` nem a chave no repositório. Para trocar a chave, altere API_KEY e reinicie o servidor; a chave anterior deixa de funcionar. Esta versão usa uma única chave compartilhada, sem usuários ou permissões por cliente. O processo recusa iniciar sem configuração válida.
