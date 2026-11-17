const {randomUUID}=require('node:crypto');
const {isIP}=require('node:net');
function limite(valor,padrao){const n=Number(valor??padrao);if(!Number.isInteger(n)||n<1)throw new Error('Limites de requisição devem ser inteiros positivos.');return n;}
function operacao({agora=Date.now,logger=()=>{},ipLimit=process.env.RATE_LIMIT_IP,keyLimit=process.env.RATE_LIMIT_KEY,trustProxy=process.env.TRUST_PROXY==='1'}={}){
  const ipMax=limite(ipLimit,300),keyMax=limite(keyLimit,1200),buckets=new Map();
  function consumir(chave,max){
    const now=agora();let b=buckets.get(chave);
    if(!b||now>=b.ate){
      if(buckets.size>=10000){for(const [k,v]of buckets)if(now>=v.ate)buckets.delete(k);if(buckets.size>=10000&&!buckets.has(chave))return 60;}
      b={n:0,ate:now+60000};buckets.set(chave,b);
    }
    b.n++;return b.n>max?Math.max(1,Math.ceil((b.ate-now)/1000)):0;
  }
  return {
    evento(evento,dados={}){try{logger({instante:new Date(agora()).toISOString(),evento,...dados});}catch{}},
    iniciar(req,res){
      const inicio=performance.now();const id=randomUUID();res.setHeader('X-Request-Id',id);
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
      res.on('finish',()=>{
        let rota;try{rota=new URL(req.url,'http://localhost').pathname;}catch{rota='/invalida';}
        rota=rota.replace(/\/estacoes\/[^/]+/,'/estacoes/:id');
        if(!['/','/health','/ready','/docs','/docs/','/openapi.json','/docs/swagger-ui.css','/docs/swagger-ui-bundle.js'].includes(rota)&&!rota.startsWith('/estacoes'))rota='/desconhecida';
        this.evento('http',{request_id:id,metodo:req.method,rota,status:res.statusCode,duracao_ms:Math.round(performance.now()-inicio)});
      });
      const encaminhado=req.headers['x-forwarded-for'];
      const ip=trustProxy&&typeof encaminhado==='string'&&isIP(encaminhado)?encaminhado:req.socket.remoteAddress||'desconhecido';
      return consumir('ip:'+ip,ipMax);
    },
    perfil(perfil){return consumir('perfil:'+perfil,keyMax);}
  };
}
module.exports={operacao};
