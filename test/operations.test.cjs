const {test}=require('node:test');
const assert=require('node:assert/strict');
const {criarServidor}=require('../src/app.cjs');
const {memoryRepository}=require('./helpers/repository.cjs');
const readApiKey='read-operacional-com-mais-de-trinta-e-dois';
const adminApiKey='admin-operacional-com-mais-de-trinta-e-dois';
test('limites por IP, reset e logs sem cabeçalhos ou query',async()=>{
  let now=Date.now();const logs=[];
  const s=criarServidor({readApiKey,adminApiKey,repositorio:memoryRepository(),agora:()=>now,ipLimit:2,logger:e=>logs.push(e)});
  await new Promise(r=>s.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+s.address().port;
  try{
    assert.equal((await fetch(base+'/health?segredo=nao-logar',{headers:{'X-API-Key':readApiKey}})).status,200);
    assert.equal((await fetch(base+'/health')).status,200);
    const r=await fetch(base+'/health',{headers:{'X-Forwarded-For':'8.8.8.8'}});
    assert.equal(r.status,429);assert.ok(Number(r.headers.get('retry-after'))>0);
    now+=61000;assert.equal((await fetch(base+'/health')).status,200);
    assert.ok(logs.some(x=>x.status===429));assert.ok(!JSON.stringify(logs).includes(readApiKey));assert.ok(!JSON.stringify(logs).includes('nao-logar'));
  }finally{await new Promise(r=>s.close(r));}
});
test('limite por perfil e readiness do banco',async()=>{
  const repo=memoryRepository();let falha=false;repo.verificar=async()=>{if(falha)throw new Error('senha secreta');};
  const s=criarServidor({readApiKey,adminApiKey,repositorio:repo,ipLimit:100,keyLimit:1});
  await new Promise(r=>s.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+s.address().port;
  try{
    const options={headers:{'X-API-Key':readApiKey}};
    assert.equal((await fetch(base+'/estacoes',options)).status,200);
    assert.equal((await fetch(base+'/estacoes',options)).status,429);
    assert.equal((await fetch(base+'/estacoes',{headers:{'X-API-Key':adminApiKey}})).status,200);
    assert.equal((await fetch(base+'/ready')).status,200);falha=true;
    const r=await fetch(base+'/ready');assert.equal(r.status,503);assert.ok(!(await r.text()).includes('secreta'));
  }finally{await new Promise(r=>s.close(r));}
});
