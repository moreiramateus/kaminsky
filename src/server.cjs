const { criarServidor } = require('./app.cjs');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const servidor = criarServidor();
servidor.listen(port, host, () => console.log(`Kaminsky: http://${host}:${port} | Swagger: /docs`));
servidor.on('error', erro => { console.error(erro.message); process.exitCode = 1; });
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => {
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
});
