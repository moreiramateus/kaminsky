const { randomUUID } = require('node:crypto');
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function erro(status, mensagem) { return Object.assign(new Error(mensagem), { status }); }
function origem(valor) {
  if (typeof valor !== 'string') throw erro(400, 'Informe weatherlink_id ou url.');
  if (UUID.test(valor)) return valor.toLowerCase();
  try {
    const u = new URL(valor);
    const m = u.pathname.match(/^\/(?:map|bulletin)\/([0-9a-f-]+)\/?$/i);
    if (u.protocol === 'https:' && u.hostname === 'www.weatherlink.com' && !u.username && !u.password && m && UUID.test(m[1])) return m[1].toLowerCase();
  } catch {}
  throw erro(400, 'Use um UUID ou link HTTPS de estação do WeatherLink.');
}
function normalizar(f) {
  const num = x => (typeof x === 'number' || typeof x === 'string') && /^-?\d+(?:\.\d+)?$/.test(String(x).trim()) && Number.isFinite(Number(x)) ? Number(x) : null;
  const round = x => x === null ? null : Number(x.toFixed(4));
  const converter = (v, u, tabela) => { const n = num(v); return n === null || !Object.hasOwn(tabela, u) ? null : round(tabela[u](n)); };
  const tempUnit = String(f.temperatureUnit || '').replace(/&deg;|&#176;|&#x0*b0;/gi, '°');
  const hum = num(f.humidity), lat = num(f.lat), lon = num(f.lng), dir = num(f.windDirection);
  return {
    temperatura_c: converter(f.temperature, tempUnit, { '°F': n => (n-32)*5/9, '°C': n => n, F: n => (n-32)*5/9, C: n => n }),
    umidade_pct: hum !== null && hum >= 0 && hum <= 100 ? hum : null,
    chuva_dia_mm: converter(f.dailyRain, f.rainUnit, { in: n => n*25.4, mm: n => n }),
    vento_ms: converter(f.windSpeed, f.windSpeedUnit, { mph: n => n*0.44704, 'm/s': n => n, 'km/h': n => n/3.6, knots: n => n*0.514444 }),
    vento_direcao_graus: dir !== null && dir >= 0 && dir <= 360 ? dir : null,
    pressao_hpa: converter(f.barometer, f.barometerUnit, { 'in Hg': n => n*33.8638866667, inHg: n => n*33.8638866667, hPa: n => n, mb: n => n, kPa: n => n*10 }),
    pressao_tendencia_codigo: num(f.barometerTrend),
    latitude: lat !== null && Math.abs(lat) <= 90 ? lat : null,
    longitude: lon !== null && Math.abs(lon) <= 180 ? lon : null,
    qualidade_ar: { indice: num(f.aqi), tipo: f.aqiType ?? null, severidade: f.aqseverity ?? null },
    conversao_aproximada: tempUnit === '°F' || f.rainUnit === 'in' || f.barometerUnit === 'in Hg'
  };
}
async function corpo(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw erro(415, 'Envie Content-Type: application/json.');
  const partes = []; let tamanho = 0;
  for await (const parte of req) { tamanho += parte.length; if (tamanho > 16384) throw erro(413, 'Corpo excede 16 KB.'); partes.push(parte); }
  const texto = Buffer.concat(partes).toString('utf8');
  try { const d = JSON.parse(texto); if (!d || typeof d !== 'object' || Array.isArray(d)) throw 0; return d; } catch { throw erro(400, 'JSON inválido.'); }
}
function cadastro({ repositorio, obter, agora }) {
  return async (req, url, enviar) => {
    const m = url.pathname.match(/^\/estacoes(?:\/([^/]+)(?:\/(dados))?)?\/?$/);
    if (!m) return false;
    const id = m[1], consulta = m[2];
    if (id && !UUID.test(id)) throw erro(404, 'Estação cadastrada não encontrada.');
    const registro = id && await repositorio.obter(id);
    if (id && !registro) throw erro(404, 'Estação cadastrada não encontrada.');
    if (consulta) {
      if (req.method !== 'GET') throw erro(405, 'Use GET para consultar dados.');
      if (!registro.habilitada) throw erro(409, 'Coleta desabilitada no cadastro.');
      const r = await obter(registro.weatherlink_id);
      const idade = r.dados.idade_na_consulta === null ? null : r.dados.idade_na_consulta + Math.max(0, Math.floor((agora()-r.instante)/1000));
      const ativa = idade === null ? null : idade <= 7200;
      const saida = { id: registro.id, nome: registro.nome, weatherlink_id: registro.weatherlink_id, ativa, atualizado_em: r.dados.atualizado_em, consultado_em: r.dados.consultado_em, idade_segundos: idade, cache: r.cache, data: ativa === false ? null : normalizar(r.dados.data) };
      if (url.searchParams.get('original') === '1') saida.original = ativa === false ? null : r.dados.data;
      enviar(200, saida); return true;
    }
    if (req.method === 'GET') { const lista = id ? null : await repositorio.listar(); enviar(200, id ? registro : { data: lista, total: lista.length }); return true; }
    if (req.method === 'DELETE' && id) { if (!await repositorio.excluir(id)) throw erro(404, 'Estação cadastrada não encontrada.'); enviar(200, { id, excluida: true }); return true; }
    if ((req.method === 'POST' && !id) || (req.method === 'PATCH' && id) || (req.method === 'PUT' && id)) {
      const d = await corpo(req);
      const permitidos = ['nome','url','weatherlink_id','habilitada'];
      if (!Object.keys(d).length || Object.keys(d).some(k => !permitidos.includes(k))) throw erro(400, 'Campos permitidos: nome, url, weatherlink_id, habilitada.');
      if (d.nome !== undefined && (typeof d.nome !== 'string' || !d.nome.trim() || d.nome.length > 150)) throw erro(400, 'Nome deve ter entre 1 e 150 caracteres.');
      if (d.habilitada !== undefined && typeof d.habilitada !== 'boolean') throw erro(400, 'habilitada deve ser booleano.');
      const novoId = d.weatherlink_id !== undefined || d.url !== undefined ? origem(d.weatherlink_id ?? d.url) : registro?.weatherlink_id;
      if (!novoId) throw erro(400, 'Informe weatherlink_id ou url.');
      if (d.url !== undefined && d.weatherlink_id !== undefined && origem(d.url) !== origem(d.weatherlink_id)) throw erro(400, 'URL e weatherlink_id divergentes.');
      let nomeFonte;
      if (!registro || novoId !== registro.weatherlink_id) nomeFonte = (await obter(novoId)).dados.nome;
      const instante = new Date(agora()).toISOString();
      let novo;
      if (registro) {
        const alteracoes = {};
        if (d.url !== undefined || d.weatherlink_id !== undefined) alteracoes.weatherlink_id = novoId;
        if (d.nome !== undefined) alteracoes.nome = d.nome.trim();
        if (d.habilitada !== undefined) alteracoes.habilitada = d.habilitada;
        novo = await repositorio.editar(id, alteracoes);
        if (!novo) throw erro(404, 'Estação cadastrada não encontrada.');
      } else {
        novo = await repositorio.criar({ id: randomUUID(), weatherlink_id: novoId, nome: d.nome?.trim() ?? nomeFonte, habilitada: d.habilitada ?? true, criado_em: instante, atualizado_em: instante });
      }
      enviar(registro ? 200 : 201, novo); return true;
    }
    throw erro(405, 'Método não permitido para esta rota.');
  };
}
module.exports = { cadastro, normalizar };
