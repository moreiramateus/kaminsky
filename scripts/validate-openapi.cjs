const parser = require('@apidevtools/swagger-parser');
parser.validate(require('node:path').join(__dirname, '../docs/openapi.json'))
  .then(() => console.log('OpenAPI válida.'))
  .catch(erro => { console.error(erro.message); process.exitCode = 1; });
