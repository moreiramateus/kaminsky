# Kaminsky Weather API

API Node.js para cadastrar estações WeatherLink com ID próprio e consultar temperatura, umidade, chuva do dia, vento, pressão e demais informações do card. Normaliza unidades e mantém acesso opcional ao JSON original.

## Executar

Requer Node.js 22 ou superior.

```sh
npm ci --ignore-scripts
# Configure API_KEY_READ e API_KEY_ADMIN no .env antes de iniciar
docker compose up -d db
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
| DATABASE_URL | Obrigatória | Conexão PostgreSQL |
| POSTGRES_PASSWORD | Obrigatória no Compose | Senha do banco local |

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
src/stations.cjs   Rotas de cadastro e normalização
src/swagger.cjs    Interface Swagger e assets locais
docs/             Referência e contrato OpenAPI
test/             Testes HTTP com fonte simulada
src/repository.cjs Persistência PostgreSQL com queries parametrizadas
migrations/       Schema versionado
scripts/          Validação do contrato
```

## Verificação

```sh
npm test
npm run docs:validate
```

## Docker

```sh
docker compose up -d --build
```

O volume postgres_data mantém os cadastros. Não execute docker compose down -v se deseja preservá-los. Faça backup com pg_dump.

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

## PostgreSQL e migração

O cadastro usa PostgreSQL por meio de um pool `pg` com cinco conexões por instância. Há chave primária UUID e restrição UNIQUE no UUID WeatherLink. As queries recebem parâmetros separados do SQL. Edições parciais atualizam somente os campos enviados; o banco impede duplicação concorrente.

Configure DATABASE_URL e as duas API Keys no .env. Para o PostgreSQL do Compose, gere POSTGRES_PASSWORD hexadecimal e use a mesma senha em DATABASE_URL com host 127.0.0.1 e porta 54329. O Compose substitui o host por db dentro da rede dos containers. A porta do banco fica acessível apenas no computador local. Senhas com caracteres reservados precisam de URL encoding em DATABASE_URL.

```sh
docker compose up -d db
npm run db:migrate
npm run db:import -- data/estacoes.json
npm start
```

A importação do arquivo JSON anterior é opcional, transacional e preserva IDs e datas. Pode ser repetida: cadastros com os mesmos IDs são ignorados, sem sobrescrever alterações no banco. Conflitos de identificação abortam a importação inteira. O JSON original não é alterado e não é mais usado em tempo de execução.

A API prepara a tabela de cadastro ao iniciar; falha na conexão impede iniciar. Esta primeira migração é idempotente. Futuras alterações de schema devem usar novas migrações. Para hospedagem gerenciada, configure TLS com validação de certificado conforme o provedor, por exemplo sslmode=verify-full na URL, e um usuário com permissões restritas. O usuário criado pela imagem Docker é destinado ao ambiente local.

```sh
npm test
npm run test:db
npm run docs:validate
```

O teste de banco usa registros com UUIDs aleatórios e remove somente esses registros. O CI executa o teste em PostgreSQL real. Cache permanece em memória por instância, por 15 minutos; não há tabelas de medições nem histórico.

## Produção

[Guia de publicação e operação](docs/production.md): HTTPS, limites, logs, healthchecks, backup com restauração de teste e pendências da hospedagem. Use compose.production.yaml separadamente da configuração local. Execute npm run test:load para carga simulada, sem consultas à fonte real.
