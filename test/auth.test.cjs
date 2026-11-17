const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/app.cjs');
test('autenticação obrigatória protege todas as operações de estações', async () => {
  assert.throws(() => criarServidor({apiKey:''}), /API_KEY/);
  assert.throws(() => criarServidor({apiKey:'curta'}), /API_KEY/);
  const apiKey = 'chave-exclusiva-de-teste-com-mais-de-32';
  const s = criarServidor({apiKey});
  await new Promise(r => s.listen(0,'127.0.0.1',r));
  const base = 'http://127.0.0.1:'+s.address().port;
  try {
    for (const method of ['GET','POST','PUT','PATCH','DELETE']) {
      assert.equal((await fetch(base+'/estacoes',{method})).status,401);
      assert.equal((await fetch(base+'/estacoes',{method,headers:{'X-API-Key':'errada'}})).status,401);
    }
    assert.equal((await fetch(base+'/estacoes?api_key='+apiKey)).status,401);
    assert.equal((await fetch(base+'/estacoes/id/dados')).status,401);
    assert.equal((await fetch(base+'/estacoes/id/chuva')).status,401);
    assert.equal((await fetch(base+'/estacoes',{headers:{'x-api-key':apiKey}})).status,200);
    assert.equal((await fetch(base+'/health')).status,200);
    assert.equal((await fetch(base+'/docs')).status,200);
    const spec=await(await fetch(base+'/openapi.json')).json();
    assert.equal(spec.components.securitySchemes.ApiKeyAuth.name,'X-API-Key');
    assert.deepEqual(spec.security,[{ApiKeyAuth:[]}]);
    assert.deepEqual(spec.paths['/health'].get.security,[]);
  } finally { await new Promise(r => s.close(r)); }
});
