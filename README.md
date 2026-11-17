# Kaminsky Weather API

API Node.js para cadastrar estações WeatherLink com ID próprio e consultar temperatura, umidade, chuva do dia, vento, pressão e demais informações do card. Normaliza unidades e mantém acesso opcional ao JSON original.

## Executar

Requer Node.js 22 ou superior.

```sh
npm ci --ignore-scripts
# Configure API_KEY_READ e API_KEY_ADMIN no .env antes de iniciar
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

Copie `.env.example` para `.env` e defina API_KEY_READ e API_KEY_ADMIN aleatórias e diferentes. npm start carrega o .env automaticamente; variáveis já exportadas têm precedência.

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

- Duas chaves compartilhadas por perfil (leitura e administração). Use HTTPS e limites de uso antes de publicar. A configuração padrão é local.
- Cache de 15 minutos sob demanda, sem agendamento nem histórico. Dados com mais de 2 horas são sinalizados como atrasados e as medições são omitidas.
- O endpoint do WeatherLink é interno e não documentado, podendo mudar ou exigir autenticação. O acesso varia por estação.
- Chuva do dia não é acumulado móvel de 24 horas. Conversão de valores arredondados não recupera a precisão original.
- Nenhuma senha, sessão, cadastro real ou captura do celular está incluída no projeto.

## Autenticação e permissões

Envie uma única chave no cabeçalho `X-API-Key`:

| Configuração | Permissão |
|---|---|
| API_KEY_READ | Consultas GET de cadastros e medições |
| API_KEY_ADMIN | Consultas e cadastro, edição e exclusão |

As duas variáveis são obrigatórias e devem ter valores diferentes, com 32 a 256 caracteres ASCII sem espaços. A variável antiga API_KEY não é mais aceita. Chave ausente ou inválida retorna 401; chave de leitura tentando escrever retorna 403. A API recusa iniciar sem configuração válida.

Gere cada chave separadamente:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Guarde em `.env` (ignorado pelo Git), ou nos segredos da hospedagem. npm start carrega o .env. Nunca use chaves em URLs, logs ou código de frontend público. Use HTTPS fora do ambiente local.

Swagger: clique em Authorize e preencha apenas um dos perfis por vez. Ambos usam o mesmo cabeçalho; não autorize os dois simultaneamente. A chave administrativa também funciona em GET. O Swagger não persiste a chave entre recarregamentos.

`/`, `/health`, `/docs` e `/openapi.json` são públicos. Todas as rotas de estações, inclusive a rota antiga `/chuva`, exigem autenticação. Para revogar ou trocar uma chave, altere a variável correspondente e reinicie. Esta versão tem uma chave por perfil, sem usuários individuais ou auditoria por cliente.
