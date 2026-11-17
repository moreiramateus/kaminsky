const { createHash, timingSafeEqual } = require('node:crypto');
module.exports = function autenticar(apiKey) {
  if (typeof apiKey !== 'string' || !/^[\x21-\x7e]{32,256}$/.test(apiKey)) {
    throw new Error('Configure API_KEY com 32 a 256 caracteres ASCII sem espaços.');
  }
  const hash = valor => createHash('sha256').update(valor).digest();
  const esperado = hash(apiKey);
  return req => {
    const chave = req.headers['x-api-key'];
    const ocorrencias = req.rawHeaders.filter((_, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === 'x-api-key').length;
    return ocorrencias === 1 && typeof chave === 'string' && chave.length <= 256 && timingSafeEqual(hash(chave), esperado);
  };
};
