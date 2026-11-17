// Carga simulada: não consulta WeatherLink nem banco real.
const {randomUUID}=require('node:crypto');
const {criarServidor}=require('../src/app.cjs');
const {memoryRepository}=require('../test/helpers/repository.cjs');
(async()=>{
  const repo=memoryRepository(),ids=[];let chamadas=0;
  const agora=new Date().toISOString();
  for(let i=0;i<100;i++){const id=randomUUID();ids.push(id);await repo.criar({id,weatherlink_id:randomUUID(),nome:'Simulada '+i,habilitada:true,criado_em:agora,atualizado_em:agora});}
  const chave='read-chave-exclusiva-para-carga-simulada';
  const s=criarServidor({repositorio:repo,readApiKey:chave,adminApiKey:chave+'-admin',ipLimit:5000,keyLimit:5000,consultar:async()=>{chamadas++;await new Promise(r=>setTimeout(r,10));return{ok:true,json:async()=>({sStation:'Simulada',dailyRain:'1',rainUnit:'mm',lastTimestamp:Math.floor(Date.now()/1000)})};}});
  await new Promise(r=>s.listen(0,'127.0.0.1',r));
  const inicio=performance.now(),cpu=process.cpuUsage();let erros=0;
  try{
    for(let rodada=0;rodada<2;rodada++)for(let i=0;i<ids.length;i+=4){await Promise.all(ids.slice(i,i+4).map(async id=>{
      const r=await fetch('http://127.0.0.1:'+s.address().port+'/estacoes/'+id+'/dados',{headers:{'X-API-Key':chave}});
      const body=await r.json();if(!r.ok||body.data?.chuva_dia_mm!==1)erros++;
    }));}
    const uso=process.cpuUsage(cpu);
    const resultado={tipo:'simulado_sem_weatherlink_ou_postgresql',estacoes:100,requisicoes:200,consultas_fonte_simulada:chamadas,erros,duracao_ms:Math.round(performance.now()-inicio),cpu_ms:Math.round((uso.user+uso.system)/1000),rss_mb:Math.round(process.memoryUsage().rss/1024/1024)};
    console.log(JSON.stringify(resultado,null,2));if(erros||chamadas!==100)process.exitCode=1;
  }finally{await new Promise(r=>s.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
