const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/app.cjs');
test('Swagger, assets locais e contrato OpenAPI', async () => {
  const s = criarServidor();
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + s.address().port;
  try {
    const spec = await (await fetch(base + '/openapi.json')).json();
    assert.equal(spec.openapi, '3.0.3');
    assert.ok(spec.paths['/estacoes/{id}/dados']);
    const html = await (await fetch(base + '/docs')).text();
    assert.match(html, /SwaggerUIBundle/);
    assert.match(html, /validatorUrl:null/);
    const asset = await fetch(base + '/docs/swagger-ui-bundle.js');
    assert.equal(asset.status, 200); await asset.text();
    assert.equal((await fetch(base + '/openapi.json', {method:'POST'})).status,405);
  } finally { await new Promise(r => s.close(r)); }
});
