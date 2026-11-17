const {StationRepository}=require('../src/repository.cjs');
(async()=>{const r=new StationRepository();try{await r.migrar();console.log('Schema PostgreSQL pronto.');}finally{await r.fechar();}})().catch(()=>{console.error('Falha ao preparar schema PostgreSQL.');process.exitCode=1;});
