const { criarServidor } = require('./app.cjs');
const { StationRepository } = require('./repository.cjs');
const repositorio = new StationRepository();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const servidor = criarServidor({ repositorio });
repositorio.migrar().then(() => servidor.listen(port, host, () => console.log(`Kaminsky: http://${host}:${port} | Swagger: /docs`))).catch(async () => { console.error('Não foi possível inicializar o PostgreSQL.'); await repositorio.fechar(); process.exitCode = 1; });
servidor.on('error', erro => { console.error(erro.message); process.exitCode = 1; });
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => {
  servidor.close(async () => { await repositorio.fechar(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
