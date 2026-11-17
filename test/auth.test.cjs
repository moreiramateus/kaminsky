const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/app.cjs');
const readApiKey = 'leitura-exclusiva-de-teste-com-mais-de-32';
const adminApiKey = 'admin-exclusiva-de-teste-com-mais-de-32';
test('perfis leitura e administrativo e configuração obrigatória', async () => {
  assert.throws(() => criarServidor({readApiKey:'',adminApiKey}), /API_KEY_READ/);
  assert.throws(() => criarServidor({readApiKey,adminApiKey:'curta'}), /API_KEY_ADMIN/);
  assert.throws(() => criarServidor({readApiKey,adminApiKey:readApiKey}), /diferentes/);
  const s = criarServidor({readApiKey,adminApiKey});
  await new Promise(r => s.listen(0,'127.0.0.1',r));
  const base = 'http://127.0.0.1:'+s.address().port;
  try {
    for (const method of ['GET','POST','PUT','PATCH','DELETE']) {
      assert.equal((await fetch(base+'/estacoes',{method})).status,401);
      assert.equal((await fetch(base+'/estacoes',{method,headers:{'X-API-Key':'errada'}})).status,401);
    }
    for (const method of ['POST','PUT','PATCH','DELETE']) {
      for (const route of ['/estacoes','/estacoes/id','/estacoes/id/dados','/estacoes/id/chuva']) {
        assert.equal((await fetch(base+route,{method,headers:{'X-API-Key':readApiKey}})).status,403);
      }
    }
    for (const key of [readApiKey,adminApiKey]) {
      assert.equal((await fetch(base+'/estacoes',{headers:{'x-api-key':key}})).status,200);
    }
    assert.equal((await fetch(base+'/estacoes',{method:'POST',headers:{'X-API-Key':adminApiKey,'Content-Type':'application/json'},body:'{}'})).status,400);
    assert.equal((await fetch(base+'/estacoes?api_key='+readApiKey)).status,401);
    assert.equal((await fetch(base+'/health')).status,200);
    assert.equal((await fetch(base+'/docs')).status,200);
    const spec=await(await fetch(base+'/openapi.json')).json();
    assert.equal(spec.components.securitySchemes.ReadApiKey.name,'X-API-Key');
    assert.deepEqual(spec.paths['/estacoes'].post.security,[{AdminApiKey:[]}]);
    assert.deepEqual(spec.paths['/health'].get.security,[]);
  } finally { await new Promise(r => s.close(r)); }
});
