const { createHash, timingSafeEqual } = require('node:crypto');
module.exports = function autenticar({ readApiKey, adminApiKey }) {
  for (const [nome, chave] of Object.entries({ API_KEY_READ: readApiKey, API_KEY_ADMIN: adminApiKey })) {
    if (typeof chave !== 'string' || !/^[\x21-\x7e]{32,256}$/.test(chave)) throw new Error(`Configure ${nome} com 32 a 256 caracteres ASCII sem espaços.`);
  }
  if (readApiKey === adminApiKey) throw new Error('API_KEY_READ e API_KEY_ADMIN devem ser diferentes.');
  const hash = valor => createHash('sha256').update(valor).digest();
  const leitura = hash(readApiKey), admin = hash(adminApiKey);
  return req => {
    const chave = req.headers['x-api-key'];
    const ocorrencias = req.rawHeaders.filter((_, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === 'x-api-key').length;
    if (ocorrencias !== 1 || typeof chave !== 'string' || chave.length > 256) return null;
    const recebido = hash(chave);
    const ehAdmin = timingSafeEqual(recebido, admin), ehLeitura = timingSafeEqual(recebido, leitura);
    return ehAdmin ? 'admin' : ehLeitura ? 'read' : null;
  };
};
