'use strict';
/* Operador: liga o Brain a totens reais.
   Recebe os eventos de spot (docs/EVENTOS.md) e as leituras em tempo real, e devolve o criativo a exibir.
   Não depende de navegador nem do simulador, só de util.js, eventos.js e brain.js.
   Funciona no navegador (Operador) e no Node (require). Uso e limites em docs/OPERACAO.md.

     const op = Operador.criar({ cadastro, rng })
     op.decidir({ totem, leitura, quando })   →  { criativo, esperado, segunda, periodo, mixEsperado }
     op.registrar(evento)                     →  { aceito, motivo?, avisos? }
     op.exportar() / Operador.criar({ cadastro, estado })   para guardar e retomar o aprendizado */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./util.js'),require('./eventos.js'),require('./brain.js'));
  else root.Operador=factory(root.Util,root.Eventos,root.Brain);
})(typeof self!=='undefined'?self:globalThis,function(U,Eventos,Brain){
  const {PERFIS}=Eventos,NS=PERFIS.length;
  const MEIA_VIDA_MIN=150;            // exposição esquecida pela metade a cada 150 min, como no simulador
  const MAX_VISTOS=100000;            // spots lembrados para descartar duplicatas
  const VISTOS_SALVOS=20000;
  const horaLocal=iso=>{const m=/T(\d{2}):/.exec(iso);return m?+m[1]:0;};   // hora do relógio do próprio totem
  const periodoDe=iso=>Math.floor(horaLocal(iso)/3);

  /* devolve a lista de problemas do cadastro de totens e criativos (vazia se estiver certo) */
  function validarCadastro(cad){
    const erros=[];
    if(!cad||!Array.isArray(cad.totens)||!Array.isArray(cad.criativos))return ['o cadastro precisa de totens e criativos, em listas'];
    if(!cad.totens.length)erros.push('o cadastro não tem totens');
    if(!cad.criativos.length)erros.push('o cadastro não tem criativos');
    const ids=new Set();
    for(const t of cad.totens){
      if(!(t&&typeof t.id==='string'&&/^T-\d{2,}$/.test(t.id)))erros.push(`totem com id fora do padrão: ${t&&t.id}`);
      else if(ids.has(t.id))erros.push(`totem repetido: ${t.id}`);
      else ids.add(t.id);
      if(!(t&&typeof t.zona==='string'&&t.zona))erros.push(`totem ${t&&t.id} sem zona`);
    }
    const cri=new Set();
    for(const c of cad.criativos){
      if(!(c&&typeof c.id==='string'&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)))erros.push(`criativo com id fora do padrão: ${c&&c.id}`);
      else if(cri.has(c.id))erros.push(`criativo repetido: ${c.id}`);
      else cri.add(c.id);
    }
    return erros;
  }

  /* opt.cadastro  {totens:[{id,nome,zona}], criativos:[{id,nome}]}
     opt.rng       função aleatória em [0,1) (padrão Math.random)
     opt.params    parâmetros do Brain (kz, kt, rest, forget, corrige, estima, contexto, kp)
     opt.estado    resultado de exportar(), para retomar o aprendizado */
  function criar(opt){
    const cad=opt.cadastro,erros=validarCadastro(cad);
    if(erros.length)throw new Error('cadastro inválido: '+erros.join('; '));
    const zonas=[...new Set(cad.totens.map(t=>t.zona))];
    const iTotem=new Map(cad.totens.map((t,i)=>[t.id,i])),iCri=new Map(cad.criativos.map((c,i)=>[c.id,i]));
    const NC=cad.criativos.length,ativos=new Array(NC).fill(true);
    const params=Object.assign({},Brain.DEFAULTS,(opt.estado&&opt.estado.params)||{},opt.params||{});
    const brain=Brain.create({nSeg:NS,nCre:NC,nZones:zonas.length,nPeriods:8,zoneOf:cad.totens.map(t=>zonas.indexOf(t.zona)),
      rng:opt.rng||Math.random,params,active:ativos});

    let relogio=null;                                                  // fim do evento mais recente, em ms
    const vistos=new Set();
    const mix=cad.totens.map(()=>new Float64Array(NS));                // perfis vistos recentemente em cada totem
    const c={aceitos:0,porSpot:0,rejeitados:0,duplicados:0,desconhecidos:0,atrasados:0};
    const ETA=opt.etaRepartir??0.1;
    const beta=cad.criativos.map(()=>new Float64Array(NS).fill(0.03));   // taxa de interação por perfil, só para repartir totais

    if(opt.estado){
      const s=opt.estado;
      brain.importar(s.brain);
      relogio=s.relogio??null;
      Object.assign(c,s.contadores||{});
      (s.vistos||[]).forEach(id=>vistos.add(id));
      (s.mix||[]).forEach((m,i)=>{if(mix[i])mix[i].set(m);});
      (s.beta||[]).forEach((b,k)=>{if(beta[k])beta[k].set(b);});
      (s.ativos||[]).forEach((a,k)=>{if(k<NC)ativos[k]=a;});
    }

    /* perfil médio de quem passa no totem; sem histórico, todos os perfis iguais */
    function mixEsperado(i){
      const m=mix[i],t=m.reduce((a,b)=>a+b,0),out=new Float64Array(NS);
      for(let s=0;s<NS;s++)out[s]=t>0?m[s]/t:1/NS;
      return out;
    }

    /* o relógio é o fim do evento mais recente; o tempo que passa esvazia a exposição, e a cada hora o algoritmo esquece um pouco */
    function avancarRelogio(fim){
      if(relogio===null){relogio=fim;return;}
      if(fim<=relogio)return;
      brain.decay(Math.exp(-Math.LN2*((fim-relogio)/60000)/MEIA_VIDA_MIN));
      const horas=Math.floor(fim/3600000)-Math.floor(relogio/3600000);
      for(let h=0;h<Math.min(horas,48);h++)brain.forget();
      relogio=fim;
    }

    /* interações sem perfil: reparte o total entre os perfis presentes, proporcional à audiência vezes a taxa de cada
       perfil. Essa taxa é ajustada a cada evento por mínimos quadrados online (o total observado contra a soma de
       audiência × taxa), o que separa os perfis quando a mistura de pessoas varia de um spot para outro.
       Interações além do número de pessoas contadas são descartadas. */
    function repartir(i,k,aud,total,interacoes){
      const hits=new Array(NS).fill(0);
      if(!(total>0))return hits;
      const b=beta[k];
      let pred=0,nn=0;
      for(let s=0;s<NS;s++){pred+=aud[s]*b[s];nn+=aud[s]*aud[s];}
      const err=interacoes-pred;
      for(let s=0;s<NS;s++)b[s]=Math.max(1e-3,b[s]+ETA*err*aud[s]/(nn+1));
      if(!(interacoes>0))return hits;
      const w=aud.map((n,s)=>n*b[s]),soma=w.reduce((a,v)=>a+v,0);
      for(let s=0;s<NS;s++)hits[s]=Math.min(aud[s],interacoes*w[s]/soma);
      return hits;
    }

    function registrar(ev){
      const v=Eventos.validar(ev);
      if(!v.ok){c.rejeitados++;return {aceito:false,motivo:'formato',erros:v.erros};}
      const i=iTotem.get(ev.totem),k=iCri.get(ev.criativo);
      if(i===undefined){c.desconhecidos++;return {aceito:false,motivo:'totem fora do cadastro'};}
      if(k===undefined){c.desconhecidos++;return {aceito:false,motivo:'criativo fora do cadastro'};}
      if(vistos.has(ev.spot)){c.duplicados++;return {aceito:false,motivo:'duplicado'};}
      vistos.add(ev.spot);
      if(vistos.size>MAX_VISTOS)vistos.delete(vistos.values().next().value);
      const fim=Date.parse(ev.inicio)+ev.duracao_s*1000;
      if(relogio!==null&&fim<relogio-30000)c.atrasados++;
      avancarRelogio(fim);
      const per=periodoDe(ev.inicio),aud=PERFIS.map(p=>ev.audiencia[p]),total=aud.reduce((a,b)=>a+b,0);
      const porPerfil=typeof ev.interacoes==='object';
      const hits=porPerfil?PERFIS.map(p=>ev.interacoes[p]):repartir(i,k,aud,total,ev.interacoes);
      for(let s=0;s<NS;s++)if(aud[s]>0)brain.learnLote(i,s,k,aud[s],hits[s],per);
      brain.expose(i,k,total);
      for(let s=0;s<NS;s++)mix[i][s]=mix[i][s]*0.98+aud[s];
      c.aceitos++;if(!porPerfil)c.porSpot++;
      return {aceito:true,avisos:v.avisos};
    }

    /* p.totem: id do totem · p.leitura: pessoas à frente agora, por perfil (objeto com os perfis ou lista de 8) · p.quando: hora, ISO 8601 */
    function decidir(p){
      const i=iTotem.get(p&&p.totem);
      if(i===undefined)throw new Error(`totem desconhecido: ${p&&p.totem}`);
      const aud=new Float64Array(NS),L=p.leitura||{};
      let total=0;
      PERFIS.forEach((nome,s)=>{const v=Array.isArray(L)?L[s]:L[nome];const n=Number.isFinite(v)&&v>0?Math.round(v):0;aud[s]=n;total+=n;});
      let usouMix=false;
      if(total===0){aud.set(mixEsperado(i));total=1;usouMix=true;}
      const per=p.quando?periodoDe(p.quando):undefined;
      const d=brain.choose(i,aud,total,null,per);
      return {criativo:cad.criativos[d.c].id,esperado:d.exp,segunda:cad.criativos[d.run].id,periodo:per??null,mixEsperado:usouMix};
    }

    function campanha(id,ativa){
      const k=iCri.get(id);
      if(k===undefined)throw new Error(`criativo desconhecido: ${id}`);
      if(!ativa&&ativos[k]&&ativos.filter(Boolean).length<=1)throw new Error('pelo menos um criativo precisa ficar ativo');
      ativos[k]=!!ativa;
    }

    /* taxa de interação que o algoritmo estima, em toda a rede, para cada perfil e criativo */
    function aprendido(){
      const media=PERFIS.map((_,s)=>cad.criativos.map((_,k)=>brain.globalMean(s,k)));
      const melhor=Object.fromEntries(PERFIS.map((p,s)=>{
        let b=-1;media[s].forEach((v,k)=>{if(ativos[k]&&(b<0||v>media[s][b]))b=k;});
        return [p,cad.criativos[b].id];
      }));
      return {perfis:PERFIS.slice(),criativos:cad.criativos.map(x=>x.id),media,melhor};
    }

    function estado(){
      return {eventos:Object.assign({},c),relogio:relogio===null?null:new Date(relogio).toISOString(),
        totens:cad.totens.length,criativos:cad.criativos.map((x,k)=>({id:x.id,ativo:ativos[k]}))};
    }

    function exportar(){
      return {versao:1,cadastro:cad,params:Object.assign({},params),brain:brain.exportar(),relogio,contadores:Object.assign({},c),
        vistos:[...vistos].slice(-VISTOS_SALVOS),mix:mix.map(m=>Array.from(m)),beta:beta.map(b=>Array.from(b)),ativos:ativos.slice()};
    }

    return {decidir,registrar,campanha,aprendido,estado,exportar,brain,cadastro:cad};
  }

  return {criar,validarCadastro};
});
