# API WeatherLink — documentação

API local com cadastro persistente e consulta de dados do card. Requer Node.js 22+. Instale as dependências com npm ci --ignore-scripts.

## Iniciar

```powershell
npm start
```

Base: `http://127.0.0.1:3000`. Variáveis opcionais: `HOST`, `PORT`. Sem autenticação nesta versão; mantenha local até adicionar autenticação e limites por cliente.

## Rotas

| Método | Caminho | Função |
|---|---|---|
| GET | `/health` | Saúde do processo, não verifica a fonte |
| POST | `/estacoes` | Cadastrar e gerar um ID próprio |
| GET | `/estacoes` | Listar: `{data: [...], total: N}` |
| GET | `/estacoes/{id}` | Consultar cadastro |
| PATCH | `/estacoes/{id}` | Editar campos enviados |
| PUT | `/estacoes/{id}` | Alias de edição parcial nesta versão |
| DELETE | `/estacoes/{id}` | Excluir cadastro local; responde `{id, excluida: true}` |
| GET | `/estacoes/{id}/dados` | Consultar dados normalizados pelo ID próprio |
| GET | `/estacoes/{id}/dados?original=1` | Incluir JSON original em `original` |
| GET | `/estacoes/{weatherlink_uuid}/chuva` | Rota antiga, independente do cadastro; dados originais em `data` |

`id` é o UUID gerado pela API. `weatherlink_id` é o UUID da estação no site: são identificadores diferentes.

## Cadastrar uma estação

```http
POST /estacoes
Content-Type: application/json

{
  "url": "https://www.weatherlink.com/map/0b4bc246-d54a-47a7-8abf-cbe8ad2d882b",
  "nome": "São Vicente",
  "habilitada": true
}
```

Pode substituir `url` por `weatherlink_id`. Aceita UUID ou link HTTPS `www.weatherlink.com/map/{uuid}` ou `/bulletin/{uuid}`. Se enviar URL e UUID, devem corresponder. Nome é opcional (1 a 150 caracteres); quando omitido, vem da fonte. `habilitada` é booleano, padrão true. A API verifica os dados antes de cadastrar; uma origem duplicada retorna 409. Uma estação atrasada ainda pode ser cadastrada.

Resposta 201, com campos:

```json
{
  "id": "70baf8c0-3d50-4afa-9883-03cadf8aef00",
  "weatherlink_id": "0b4bc246-d54a-47a7-8abf-cbe8ad2d882b",
  "nome": "São Vicente",
  "habilitada": true,
  "criado_em": "2026-11-17T18:00:00.000Z",
  "atualizado_em": "2026-11-17T18:00:00.000Z"
}
```

ID e horários acima são ilustrativos. Use os retornados pelo POST.

## Fluxo completo no PowerShell

```powershell
$base = 'http://127.0.0.1:3000'
$body = @{ weatherlink_id = '0b4bc246-d54a-47a7-8abf-cbe8ad2d882b' } | ConvertTo-Json
$estacao = Invoke-RestMethod "$base/estacoes" -Method Post -ContentType 'application/json' -Body $body
$idEstacao = $estacao.id
Invoke-RestMethod "$base/estacoes"
Invoke-RestMethod "$base/estacoes/$idEstacao"
Invoke-RestMethod "$base/estacoes/$idEstacao/dados" | ConvertTo-Json -Depth 6
Invoke-RestMethod "$base/estacoes/$idEstacao/dados?original=1" | ConvertTo-Json -Depth 6
Invoke-RestMethod "$base/estacoes/$idEstacao" -Method Patch -ContentType 'application/json' -Body '{"habilitada":false}'
# Para excluir, execute:
# Invoke-RestMethod "$base/estacoes/$idEstacao" -Method Delete
```

PATCH/PUT aceitam somente `nome`, `url`, `weatherlink_id`, `habilitada`. O ID próprio é preservado ao alterar a origem. Campos desconhecidos e corpo vazio são rejeitados. Consultar dados de cadastro desabilitado retorna 409.

## Resposta de /dados

No nível principal: `id`, `nome`, `weatherlink_id`, `ativa`, `atualizado_em`, `consultado_em`, `idade_segundos`, `cache`, `data`. Com `original=1`, inclui também `original`.

| Campo dentro de data | Significado |
|---|---|
| temperatura_c | Temperatura em Celsius |
| umidade_pct | Umidade entre 0 e 100% |
| chuva_dia_mm | Chuva do dia em mm; não é janela móvel de 24h |
| vento_ms | Vento em m/s |
| vento_direcao_graus | Direção de 0 a 360 graus |
| pressao_hpa | Pressão em hPa |
| pressao_tendencia_codigo | Código original, sem interpretação textual |
| latitude, longitude | Coordenadas em graus decimais |
| qualidade_ar | Objeto com indice, tipo e severidade originais |
| conversao_aproximada | Sinaliza conversões principais de números já arredondados pela fonte |

Converte temperatura de Fahrenheit, chuva de polegadas, vento de mph/km/h/knots e pressão de in Hg/inHg/mb/kPa. Unidades já normalizadas também são aceitas. Resultados convertidos têm até quatro casas decimais, sem aumentar a precisão original. Valores inválidos, ausentes ou com unidades desconhecidas viram null. O JSON original preserva todos os campos fornecidos pelo WeatherLink. Horários ISO da API são UTC.

## Cache e atividade

Cache em memória de 15 minutos por UUID de origem, atualizado sob demanda após expirar. Não existe coleta periódica nem histórico. A idade principal considera o tempo no cache; `original` mantém os valores recebidos no instante de `consultado_em`.

Mais de 2 horas sem medição: `ativa: false`, `data: null` e `original: null`, se solicitado. Horário desconhecido: `ativa: null`. `habilitada` é configuração do cadastro, e `ativa` é um indicador calculado de atraso. A rota antiga `/chuva` continua independente do cadastro e da opção habilitada.

## Persistência

Cadastros ficam em `estacoes.json`, gravado via arquivo temporário e substituição. Reiniciar perde apenas o cache. Preserve esse arquivo ao migrar. Execute uma única instância com esse arquivo; múltiplos processos escritores não são suportados. DELETE remove apenas o cadastro local.

## Erros

Formato: `{"erro":"Descrição"}`.

| HTTP | Motivo |
|---|---|
| 400 | JSON, campo, UUID ou URL inválido |
| 404 | Cadastro, rota ou estação da fonte não encontrado |
| 405 | Método não permitido |
| 409 | Duplicação, coleta desabilitada ou conflito de cadastro |
| 413 | Corpo acima de 16 KB |
| 415 | Envie application/json nas escritas |
| 502 | Fonte indisponível ou resposta inválida |
| 503 | Quatro consultas simultâneas à fonte em andamento |
| 504 | Fonte excedeu 15 segundos |

## Testar

```powershell
npm test
```

O endpoint interno do WeatherLink não é uma API pública documentada: pode mudar ou exigir autenticação no futuro. O acesso deve ser validado para cada estação.

Swagger interativo: /docs. Contrato OpenAPI: /openapi.json. Consulte o README da raiz para configuração e estrutura.
