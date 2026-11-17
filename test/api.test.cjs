const API_KEY = 'teste-local-chave-segura-com-32-caracteres';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/app.cjs');
const ID = '0b4bc246-d54a-47a7-8abf-cbe8ad2d882b';
test('dados originais, cache, atraso e erros HTTP', async () => {
  let tempo = 1800000000000, chamadas = 0, falhar = false;
  const servidor = criarServidor({ apiKey: API_KEY, agora: () => tempo, consultar: async () => {
    chamadas++;
    if (falhar) throw new Error('falha simulada');
    return { ok: true, json: async () => ({ sStation: 'Teste', dailyRain: '0.06', rainUnit: 'in', temperature: '78', temperatureUnit: '&deg;F', humidity: '69', lastTimestamp: 1799999900 }) };
  }});
  await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const rota = base + '/estacoes/' + ID + '/chuva';
  try {
    let d = await (await fetch(rota, { headers: { 'X-API-Key': API_KEY } })).json();
    assert.equal(d.ativa, true); assert.equal(d.cache, false);
    for (const campo of ['chuva_dia', 'temperatura', 'umidade']) assert.equal(Object.hasOwn(d, campo), false);
    assert.equal(d.data.sStation, 'Teste'); assert.equal(d.data.dailyRain, '0.06');
    d = await (await fetch(rota, { headers: { 'X-API-Key': API_KEY } })).json(); assert.equal(d.cache, true); assert.equal(chamadas, 1);
    tempo += 8000000;
    d = await (await fetch(rota, { headers: { 'X-API-Key': API_KEY } })).json(); assert.equal(d.ativa, false); assert.equal(chamadas, 2);
    for (const campo of ['chuva_dia', 'temperatura', 'umidade']) assert.equal(Object.hasOwn(d, campo), false);
    assert.equal(d.data, null);
    assert.equal((await fetch(base + '/estacoes/invalido/chuva', { headers: { 'X-API-Key': API_KEY } })).status, 400);
    assert.equal((await fetch(rota, { method: 'POST', headers: { 'X-API-Key': API_KEY } })).status, 405);
    tempo += 1000000; falhar = true;
    assert.equal((await fetch(rota, { headers: { 'X-API-Key': API_KEY } })).status, 502);
  } finally { await new Promise(resolve => servidor.close(resolve)); }
});

