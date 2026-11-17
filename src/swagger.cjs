const fs = require('node:fs');
const path = require('node:path');
const spec = require('../docs/openapi.json');
const assets = require('swagger-ui-dist').getAbsoluteFSPath();
const arquivos = { 'swagger-ui.css': 'text/css', 'swagger-ui-bundle.js': 'application/javascript' };
module.exports = function swagger(req, url, res) {
  const asset = url.pathname.startsWith('/docs/') && url.pathname.slice(6);
  if (!['/docs', '/docs/', '/openapi.json'].includes(url.pathname) && !Object.hasOwn(arquivos, asset)) return false;
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return true; }
  if (url.pathname === '/openapi.json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(spec));
  } else if (Object.hasOwn(arquivos, asset)) {
    res.writeHead(200, { 'Content-Type': arquivos[asset], 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(path.join(assets, asset)).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kaminsky API — Swagger</title><link rel="stylesheet" href="/docs/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="/docs/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:"/openapi.json",dom_id:"#swagger-ui",validatorUrl:null,persistAuthorization:false});</script></body></html>');
  }
  return true;
};
