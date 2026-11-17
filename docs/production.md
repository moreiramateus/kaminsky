# Publicação e operação

O projeto está preparado para uma única VPS Linux com Docker Compose. A configuração de produção é **compose.production.yaml, usada sozinha**. Ela não publica as portas da API ou do PostgreSQL; apenas o Caddy recebe conexões nas portas 80 e 443. O banco usa volume persistente e a API acessa um usuário sem privilégios de superusuário.

## Antes de publicar

1. Contrate uma VPS Linux e configure acesso SSH por chave. Como ponto inicial para piloto, reserve 2 vCPU e 2–4 GB de RAM; o dimensionamento definitivo depende das medições reais.
2. Compre o domínio. Crie um registro DNS A para `api.seudominio.com` com o IPv4 da VPS. Só crie AAAA se o IPv6 estiver configurado.
3. Libere 80/TCP, 443/TCP e, opcionalmente, 443/UDP. Restrinja SSH ao administrador. Não abra 3000 ou 5432.
4. Instale Docker Engine e o plugin Compose pela distribuição oficial. Clone o repositório e configure `.env` com permissão 600.

```sh
git clone https://github.com/moreiramateus/kaminsky.git
cd kaminsky
cp .env.example .env
chmod 600 .env
```

Edite `.env`: configure DOMAIN e ACME_EMAIL reais, API_KEY_READ e API_KEY_ADMIN diferentes, POSTGRES_PASSWORD para o usuário da API e DB_ADMIN_PASSWORD para administração/backup do banco. Use valores aleatórios independentes, por exemplo 32 bytes em hexadecimal. Nunca publique esse arquivo nem envie as chaves em chats ou URLs.

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

A URL DATABASE_URL do exemplo só é usada ao rodar Node no host. O Compose de produção a monta com o hostname privado db. Use senha hexadecimal para evitar problemas de URL encoding. O usuário restrito é criado apenas ao iniciar um volume vazio; não reutilize o volume da configuração de desenvolvimento.

## Iniciar

```sh
docker compose -p kaminsky-prod -f compose.production.yaml up -d --build
docker compose -p kaminsky-prod -f compose.production.yaml ps
```

Com DNS e portas corretos, o Caddy emite e renova o certificado HTTPS. Nenhuma compra de certificado é necessária. Não use esse comando com domínio fictício para testar emissão.

```sh
curl https://api.seudominio.com/health
curl https://api.seudominio.com/ready
curl -H "X-API-Key: SUA_CHAVE_LEITURA" https://api.seudominio.com/estacoes
```

Confirme 401 sem chave e 403 em POST com a chave de leitura. Swagger fica em `/docs`; use Authorize com um perfil por vez. Uma chave com acesso de escrita pode alterar dados de verdade pelo Swagger.

## Importar cadastros antigos

O processo de produção usa banco separado. Para migrar um JSON legado ao PostgreSQL da VPS, rode `npm run db:import -- caminho/estacoes.json` em um ambiente com DATABASE_URL apontando de forma segura para o banco correto, ou via execução temporária em container na rede privada. Preserve os IDs e guarde o arquivo original até validar a migração. Não exponha o banco publicamente para importar. Não existe cópia automática de dados deste computador para a VPS.

Após copiar o arquivo legado de forma segura para a VPS Linux, também é possível importar por stdin, sem gravar arquivos no container:

```sh
cat caminho/estacoes.json | docker compose -p kaminsky-prod -f compose.production.yaml exec -T api node scripts/import-json.cjs /dev/stdin
```

## Limites de uso

RATE_LIMIT_IP: 300 requisições por minuto por IP. RATE_LIMIT_KEY: 1.200 por minuto por perfil/chave. Ambos configuráveis. Limite excedido retorna 429 e Retry-After. O limite por IP também protege tentativas sem autenticação. São janelas fixas de um minuto, com estado em memória e capacidade limitada; reiniciar zera os contadores. Em várias instâncias, cada instância conta separadamente: antes de escalar, use limitador compartilhado ou gateway.

TRUST_PROXY=1 é definido apenas no Compose de produção. O Caddy sobrescreve X-Forwarded-For com o IP da conexão; a API só é acessível na rede de containers. Se houver CDN ou outro proxy à frente do Caddy, revise essa cadeia antes de ativar. Ao rodar a API diretamente, mantenha TRUST_PROXY=0 para impedir falsificação do IP.

## Logs e monitoramento

Logs HTTP em JSON incluem request_id, rota resumida, status e duração. Não incluem corpo, query string nem API Key. X-Request-Id na resposta permite localizar a requisição. Eventos fonte_falha e banco_falha ajudam a identificar indisponibilidade. O Docker limita os arquivos de log a 3 de 10 MB por container.

```sh
docker compose -p kaminsky-prod -f compose.production.yaml logs --since=30m api backup
```

`/health` confirma o processo; `/ready` consulta PostgreSQL e retorna 503 se falhar. Os healthchecks Docker sinalizam saúde, **mas não enviam alertas nem reiniciam automaticamente um container apenas por estar unhealthy**. Após o servidor existir, configure um monitor externo em `/ready` (por exemplo a cada minuto) e notificação de falha. Configure também alerta de disco, memória e backup unhealthy. A resposta da fonte só é verificada quando uma estação é consultada; `/ready` não comprova disponibilidade do WeatherLink.

## Backup e restauração

O serviço backup produz um pg_dump em formato custom na inicialização e a cada 24 horas. Cada arquivo é restaurado automaticamente em **um banco temporário separado**, consultado para validar o cadastro e depois descartado. O banco da API não é sobrescrito. Um checksum acompanha o arquivo. last-success só é atualizado após restauração válida. Retenção local aproximada: 14 dias. O healthcheck acusa backup com mais de 25 horas sem sucesso.

```sh
# Backup adicional com teste de restauração, sem substituir o banco ativo:
docker compose -p kaminsky-prod -f compose.production.yaml exec backup sh /ops/backup-once.sh
```

Os backups ficam em volume no mesmo servidor: isso **não protege contra perda da VPS**. Antes do uso definitivo, configure uma cópia criptografada para armazenamento externo e monitore essa transferência. O destino depende do provedor escolhido. Retenção e cópia externa ainda precisam ser definidas na hospedagem.

Em um desastre: pare a API, preserve o banco/volume atual, restaure o arquivo em um banco novo com pg_restore --exit-on-error --no-owner, valide os registros e só então altere a conexão. Não use comandos de limpeza ou substituição do banco ativo sem revisar o destino. Nunca execute `docker compose down -v` para atualizar: apaga volumes.

## Atualizações e segredos

Faça backup antes de atualizar. Leia mudanças de schema; esta versão possui a migração inicial idempotente. Use git pull e up -d --build, sem apagar volumes. Para reverter uma atualização com alteração de schema, avalie compatibilidade do banco e o backup antes de trocar a imagem.

Para rotacionar chaves HTTP, altere as variáveis e recrie a API. A troca de POSTGRES_PASSWORD no .env não altera automaticamente a senha em um volume existente: altere primeiro o usuário no PostgreSQL e coordene a conexão da API. Não publique informações de conexão nos logs.

## Validação pendente na hospedagem

- DNS, certificado público, firewall e acesso externo.
- Alertas e destino externo dos backups.
- Lista de estações reais, permissões de acesso e teste da fonte com a carga desejada.
- Teste simulado de carga verifica apenas o software; não é benchmark do WeatherLink, da VPS ou do banco de produção.

Referências: [Caddy HTTPS](https://caddyserver.com/docs/automatic-https), [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
