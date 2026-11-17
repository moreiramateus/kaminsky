function memoryRepository() {
  const rows=new Map();
  return {
    async listar(){return [...rows.values()];},
    async obter(id){return rows.get(id);},
    async criar(r){if([...rows.values()].some(x=>x.weatherlink_id===r.weatherlink_id))throw Object.assign(new Error('Estação já cadastrada.'),{status:409});rows.set(r.id,r);return r;},
    async editar(id,d){const r=rows.get(id);if(!r)return undefined;const n={...r,...d};if([...rows.values()].some(x=>x.id!==id&&x.weatherlink_id===n.weatherlink_id))throw Object.assign(new Error('Estação já cadastrada.'),{status:409});rows.set(id,n);return n;},
    async excluir(id){return rows.delete(id);}
  };
}
module.exports={memoryRepository};
