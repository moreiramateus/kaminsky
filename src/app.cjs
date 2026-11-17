const http = require('node:http');
const { StationRepository } = require('./repository.cjs');
const { cadastro } = require('./stations.cjs');
const swagger = require('./swagger.cjs');
const autenticar = require('./auth.cjs');
const { operacao } = require('./operations.cjs');
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TTL = 15 * 60 * 1000;

function criarServidor({ consultar = fetch, agora = Date.now, readApiKey = process.env.API_KEY_READ, adminApiKey = process.env.API_KEY_ADMIN, repositorio = new StationRepository(), logger, ipLimit, keyLimit, trustProxy } = {}) {
  const autorizado = autenticar({ readApiKey, adminApiKey });
  const ops=operacao({agora,logger,ipLimit,keyLimit,trustProxy});
  const cache = new Map();
  const pendentes = new Map();
  async function obter(id) {
    const salvo = cache.get(id);
    if (salvo && agora() - salvo.instante < TTL) return { ...salvo, cache: true };
    if (pendentes.has(id)) return pendentes.get(id);
    if (pendentes.size >= 4) throw Object.assign(new Error('Consultas em andamento. Tente novamente.'), { status: 503 });
    const inicioFonte=performance.now();
    const tarefa = (async () => {
      const url = new URL('https://www.weatherlink.com/map/data/station/' + id);
      url.searchParams.set('aqiSchemeId', '1');
      url.searchParams.set('woodsmokeEnabled', 'false');
      const resposta = await consultar(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
      if (!resposta.ok) {
        const erro = new Error('A fonte não disponibilizou os dados da estação.');
        erro.status = resposta.status === 404 ? 404 : 502;
        throw erro;
      }
      const fonte = await resposta.json();
      if (!fonte || typeof fonte.sStation !== 'string' || !fonte.sStation.trim()) throw new Error('Resposta inválida da fonte.');
      const instante = agora();
      const timestamp = Number.isFinite(fonte.lastTimestamp) && fonte.lastTimestamp > 0 && fonte.lastTimestamp < 8640000000000 ? fonte.lastTimestamp : null;
      const idade = timestamp !== null ? Math.max(0, Math.floor(instante / 1000 - timestamp)) : Number.isFinite(fonte.ageInSeconds) && fonte.ageInSeconds >= 0 ? fonte.ageInSeconds : null;
      const item = { instante, cache: false, dados: {
        estacao_id: id, nome: fonte.sStation,
        data: fonte,
        atualizado_em: timestamp === null ? null : new Date(timestamp * 1000).toISOString(),
        consultado_em: new Date(instante).toISOString(), idade_na_consulta: idade
      }};
      // Limita memória mesmo com consultas a muitos identificadores distintos.
      if (cache.size >= 1000) cache.delete(cache.keys().next().value);
      cache.set(id, item);
      return item;
    })();
    pendentes.set(id, tarefa);
    try { const r=await tarefa;ops.evento('fonte_ok',{duracao_ms:Math.round(performance.now()-inicioFonte)});return r; }
    catch(e){ops.evento('fonte_falha',{status:e.status||502,tipo:e.name==='TimeoutError'?'timeout':'resposta_ou_conexao'});throw e;}
    finally { pendentes.delete(id); }
  }
  const gerenciar = cadastro({ repositorio, obter, agora });
  const servidor=http.createServer(async (req, res) => {
    const enviar = (status, dados) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(dados, null, 2));
    };
    const limitar=segundos=>{res.setHeader('Retry-After',String(segundos));enviar(429,{erro:'Limite de requisições excedido. Tente novamente após Retry-After.'});};
    const excedido=ops.iniciar(req,res);
    if(excedido)return limitar(excedido);
    try {
      const url = new URL(req.url, 'http://localhost');
      const publica = ['/', '/health', '/ready', '/docs', '/docs/', '/openapi.json', '/docs/swagger-ui.css', '/docs/swagger-ui-bundle.js'].includes(url.pathname);
      if (!publica) {
        const perfil = autorizado(req);
        if (!perfil) {
          res.setHeader('WWW-Authenticate', 'ApiKey realm="kaminsky"');
          return enviar(401, { erro: 'API Key ausente ou inválida. Envie X-API-Key.' });
        }
        if (perfil === 'read' && req.method !== 'GET') return enviar(403, { erro: 'Esta operação exige a chave administrativa.' });
        const excessoPerfil=ops.perfil(perfil);if(excessoPerfil)return limitar(excessoPerfil);
      }
      if (swagger(req, url, res)) return;
      if (await gerenciar(req, url, enviar)) return;
      if (req.method !== 'GET') return enviar(405, { erro: 'Método não permitido.' });
      if (url.pathname === '/health') return enviar(200, { status: 'ok' });
      if (url.pathname === '/ready') {
        try{await repositorio.verificar();return enviar(200,{status:'ok',banco:'ok'});}
        catch{ops.evento('banco_falha');return enviar(503,{status:'indisponivel'});}
      }
      if (url.pathname === '/') return enviar(200, { descricao: 'Kaminsky Weather API', documentacao: '/docs', openapi: '/openapi.json', estacoes: '/estacoes', cache_segundos: TTL / 1000 });
      const match = url.pathname.match(/^\/estacoes\/([^/]+)\/chuva\/?$/);
      if (!match) return enviar(404, { erro: 'Rota não encontrada.' });
      const id = match[1].toLowerCase();
      if (!UUID.test(id)) return enviar(400, { erro: 'Identificador da estação deve ser um UUID válido.' });
      if (!cache.has(id) && !pendentes.has(id) && pendentes.size >= 4) return enviar(503, { erro: 'Consultas em andamento. Tente novamente em instantes.' });
      const resultado = await obter(id);
      const decorrido = Math.max(0, Math.floor((agora() - resultado.instante) / 1000));
      const { idade_na_consulta, ...dados } = resultado.dados;
      const idade = idade_na_consulta === null ? null : idade_na_consulta + decorrido;
      const ativa = idade === null ? null : idade <= 7200;
      if (ativa === false) return enviar(200, { estacao_id: id, nome: dados.nome, ativa: false, idade_segundos: idade, atualizado_em: dados.atualizado_em, data: null, motivo: 'Última atualização há mais de 2 horas.', cache: resultado.cache });
      return enviar(200, { ...dados, ativa, idade_segundos: idade, cache: resultado.cache });
    } catch (erro) {
      const timeout = erro.name === 'TimeoutError' || erro.name === 'AbortError';
      enviar(timeout ? 504 : erro.status || 502, { erro: timeout ? 'Tempo limite ao consultar WeatherLink.' : erro.status ? erro.message : 'Não foi possível obter dados válidos do WeatherLink.' });
    }
  });
  servidor.requestTimeout=20000;
  servidor.headersTimeout=10000;
  servidor.keepAliveTimeout=65000;
  return servidor;
}
module.exports = { criarServidor };
