const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const normalizar = r => r && ({...r, criado_em:new Date(r.criado_em).toISOString(), atualizado_em:new Date(r.atualizado_em).toISOString()});
class StationRepository {
  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error('Configure DATABASE_URL para o PostgreSQL.');
    this.pool = new Pool({connectionString, max:5, connectionTimeoutMillis:5000, query_timeout:10000});
    this.pool.on('error', () => console.error('Conexão PostgreSQL indisponível.'));
  }
  async executar(sql, values=[]) {
    try { return await this.pool.query(sql, values); }
    catch(e) {
      if(e.code==='23505') throw Object.assign(new Error('Estação já cadastrada.'),{status:409});
      throw Object.assign(new Error('Cadastro temporariamente indisponível.'),{status:503});
    }
  }
  async migrar() { await this.executar(fs.readFileSync(path.join(__dirname,'../migrations/001_stations.sql'),'utf8')); }
  async verificar(){await this.executar('SELECT 1 FROM estacoes LIMIT 1');}
  async listar() { return (await this.executar('SELECT * FROM estacoes ORDER BY criado_em, id')).rows.map(normalizar); }
  async obter(id) { return normalizar((await this.executar('SELECT * FROM estacoes WHERE id=$1',[id])).rows[0]); }
  async criar(r) { return normalizar((await this.executar('INSERT INTO estacoes (id,weatherlink_id,nome,habilitada,criado_em,atualizado_em) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[r.id,r.weatherlink_id,r.nome,r.habilitada,r.criado_em,r.atualizado_em])).rows[0]); }
  async editar(id, d) {
    const campos=['weatherlink_id','nome','habilitada'].filter(k=>d[k]!==undefined);
    const valores=campos.map(k=>d[k]); valores.push(id);
    const sql='UPDATE estacoes SET '+campos.map((k,i)=>k+'=$'+(i+1)).concat('atualizado_em=now()').join(',')+' WHERE id=$'+valores.length+' RETURNING *';
    return normalizar((await this.executar(sql,valores)).rows[0]);
  }
  async excluir(id) { return (await this.executar('DELETE FROM estacoes WHERE id=$1',[id])).rowCount>0; }
  async fechar() { await this.pool.end(); }
}
module.exports={StationRepository};
