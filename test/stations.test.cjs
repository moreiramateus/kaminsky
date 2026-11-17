const API_KEY = 'teste-local-chave-segura-com-32-caracteres';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarServidor } = require('../src/app.cjs');
const { normalizar } = require('../src/stations.cjs');
test('CRUD persistente e consulta pelo ID próprio', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chuva-test-'));
  const arquivo = path.join(dir, 'estacoes.json');
  const fonte = { sStation:'Teste', windSpeed:'10', windSpeedUnit:'mph', lastTimestamp:Date.now()/1000 };
  const config = { arquivo, consultar: async () => ({ok:true,json:async()=>fonte}) };
  let s=criarServidor({ ...config, adminApiKey: API_KEY, readApiKey: API_KEY + '-read' });
  const iniciar=async()=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+s.address().port;};
  let base=await iniciar();
  const call=(rota,method='GET',body)=>fetch(base+rota,{method,headers:{'Content-Type':'application/json','X-API-Key':API_KEY},...(body?{body:JSON.stringify(body)}:{})});
  try {
    const body={weatherlink_id:'0b4bc246-d54a-47a7-8abf-cbe8ad2d882b'};
    let r=await call('/estacoes','POST',body);assert.equal(r.status,201);const e=await r.json();assert.notEqual(e.id,body.weatherlink_id);
    assert.equal((await call('/estacoes','POST',body)).status,409);
    assert.equal((await(await call('/estacoes/'+e.id+'/dados')).json()).data.vento_ms,4.4704);
    assert.equal((await call('/estacoes/'+e.id,'PATCH',{nome:'Novo'})).status,200);
    await new Promise(r=>s.close(r));s=criarServidor({ ...config, adminApiKey: API_KEY, readApiKey: API_KEY + '-read' });base=await iniciar();
    assert.equal((await(await call('/estacoes/'+e.id)).json()).nome,'Novo');
    await call('/estacoes/'+e.id,'PATCH',{habilitada:false});assert.equal((await call('/estacoes/'+e.id+'/dados')).status,409);
    assert.equal((await call('/estacoes','POST',{url:'https://example.com/map/'+e.id})).status,400);
    assert.equal((await call('/estacoes/'+e.id,'DELETE')).status,200);assert.equal((await call('/estacoes/'+e.id)).status,404);
    assert.equal(normalizar({temperature:'--',humidity:''}).temperatura_c,null);
  } finally {await new Promise(r=>s.close(r));fs.rmSync(dir,{recursive:true});}
});
