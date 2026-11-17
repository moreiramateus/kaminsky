const fs=require('node:fs');
const { StationRepository }=require('../src/repository.cjs');
(async()=>{
  const arquivo=process.argv[2];
  if(!arquivo)throw new Error('Informe o caminho do cadastro JSON anterior.');
  const dados=JSON.parse(fs.readFileSync(arquivo,'utf8').replace(/^\uFEFF/,''));
  if(!Array.isArray(dados))throw new Error('Cadastro inválido.');
  const repo=new StationRepository();let client;
  try {
    await repo.migrar();client=await repo.pool.connect();await client.query('BEGIN');
    for(const r of dados){
      const existe=(await client.query('SELECT * FROM estacoes WHERE id=$1 OR weatherlink_id=$2',[r.id,r.weatherlink_id])).rows;
      if(existe.length){if(existe.length!==1||existe[0].id!==r.id||existe[0].weatherlink_id!==r.weatherlink_id)throw new Error('Conflito de identificadores na importação.');continue;}
      await client.query('INSERT INTO estacoes (id,weatherlink_id,nome,habilitada,criado_em,atualizado_em) VALUES ($1,$2,$3,$4,$5,$6)',[r.id,r.weatherlink_id,r.nome,r.habilitada,r.criado_em,r.atualizado_em]);
    }
    await client.query('COMMIT');console.log('Importação concluída. IDs preservados; registros já existentes não foram alterados.');
  }catch(e){if(client)await client.query('ROLLBACK');throw e;}
  finally{if(client)client.release();await repo.fechar();}
})().catch(()=>{console.error('Falha na importação. Nenhuma alteração parcial foi mantida. Verifique conexão, arquivo e conflitos.');process.exitCode=1;});
