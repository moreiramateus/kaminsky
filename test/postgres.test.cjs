const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {StationRepository}=require('../src/repository.cjs');
test('PostgreSQL: persistência, unicidade concorrente e edição parcial',{skip:!process.env.TEST_DATABASE_URL},async()=>{
  const repo=new StationRepository(process.env.TEST_DATABASE_URL);
  const id=randomUUID(),id2=randomUUID(),weatherlink_id=randomUUID();
  const registro={id,weatherlink_id,nome:'Teste',habilitada:true,criado_em:new Date().toISOString(),atualizado_em:new Date().toISOString()};
  try{
    await repo.migrar();
    const resultados=await Promise.allSettled([repo.criar(registro),repo.criar({...registro,id:id2})]);
    assert.equal(resultados.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(resultados.find(x=>x.status==='rejected').reason.status,409);
    const salvo=resultados.find(x=>x.status==='fulfilled').value;
    await Promise.all([repo.editar(salvo.id,{nome:'Editado'}),repo.editar(salvo.id,{habilitada:false})]);
    const outro=new StationRepository(process.env.TEST_DATABASE_URL);
    try{const r=await outro.obter(salvo.id);assert.equal(r.nome,'Editado');assert.equal(r.habilitada,false);}finally{await outro.fechar();}
    assert.equal(await repo.excluir(salvo.id),true);
    assert.equal(await repo.obter(salvo.id),undefined);
  }finally{await repo.excluir(id);await repo.excluir(id2);await repo.fechar();}
});
