'use strict';
/* Cérebro: Thompson Sampling contextual hierárquico (escolha do criativo, aprendizado e esquecimento).
   Não depende de navegador, de mundo simulado nem de interface: só de util.js.
   Funciona no navegador (Brain.create) e no Node (require('./brain.js').create).

   O que o cérebro recebe, e nada além disso:
     choose(totem, audiência por perfil, total de pessoas)  →  criativo a exibir
     learn(totem, perfil visto, criativo, interagiu?)       →  atualiza as contagens
   Ele nunca lê a taxa verdadeira, a zona (além do índice) nem o horário. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./util.js'));
  else root.Brain=factory(root.Util);
})(typeof self!=='undefined'?self:globalThis,function(U){
  const {betaS}=U;
  const DEFAULTS={kz:40,kt:60,rest:.4,forget:.985};

  /* opt.nSeg, opt.nCre   número de perfis e de criativos
     opt.zoneOf           zona de cada totem (array de índices)
     opt.nZones           número de zonas
     opt.rng              função aleatória em [0,1)
     opt.params           kz, kt (força dos priors), rest (desgaste assumido), forget (esquecimento por hora);
                          pode ser um objeto compartilhado e alterado em tempo real
     opt.active           array de campanhas ativas (opcional, compartilhado) */
  function create(opt){
    const NS=opt.nSeg,NC=opt.nCre,rng=opt.rng,zoneOf=opt.zoneOf,P=opt.params||Object.assign({},DEFAULTS);
    const active=opt.active||new Array(NC).fill(true);
    const mk=()=>({a:new Float64Array(NS*NC),n:new Float64Array(NS*NC)});
    const T=zoneOf.map(mk),Z=Array.from({length:opt.nZones},mk),G=mk();
    const E=zoneOf.map(()=>new Float64Array(NC));       // olhares recentes de cada criativo em cada totem
    const score=new Float64Array(NC);

    const wearOf=(e)=>1-Math.exp(-P.rest*e/600);          // desgaste estimado, de 0 a 1
    const fatOf=e=>.35+.65*Math.exp(-P.rest*e/600);       // fator multiplicativo sobre a taxa

    function mean(i,s,c){
      const k=s*NC+c,Zc=Z[zoneOf[i]],t=T[i];
      const gm=(G.a[k]+.2)/(G.n[k]+10),zm=(Zc.a[k]+P.kz*gm)/(Zc.n[k]+P.kz);
      return (t.a[k]+P.kt*zm)/(t.n[k]+P.kt);
    }

    /* aud: audiência por perfil (contagens) · tot: total que divide a audiência · rec: objeto opcional que recebe cada cálculo */
    function choose(i,aud,tot,rec){
      const t=T[i],Zc=Z[zoneOf[i]],e=E[i];
      score.fill(0);
      for(let s=0;s<NS;s++){
        const n=aud[s];if(!(n>0))continue;
        if(rec)rec.cells[s]=[];
        for(let c=0;c<NC;c++){
          if(!active[c]){if(rec)rec.cells[s][c]={gm:0,zm:0,a:0,b:0,th:0,gn:0,zn:0,tn:0};continue;}
          const k=s*NC+c;
          const gm=(G.a[k]+.2)/(G.n[k]+10),zm=(Zc.a[k]+P.kz*gm)/(Zc.n[k]+P.kz);
          const a=t.a[k]+P.kt*zm,b=t.n[k]-t.a[k]+P.kt*(1-zm),th=betaS(a,b,rng);
          score[c]+=n*th;
          if(rec)rec.cells[s][c]={gm,zm,a,b,th,gn:G.n[k],zn:Zc.n[k],tn:t.n[k]};
        }
      }
      let b=-1,bv=-1,s2=-1,sv=-1;
      if(rec){rec.raw=[];rec.E=[];rec.fe=[];rec.v=[];}
      for(let c=0;c<NC;c++){
        const fe=fatOf(e[c]),v=active[c]?score[c]/tot*fe:0;
        if(rec){rec.raw.push(score[c]);rec.E.push(e[c]);rec.fe.push(fe);rec.v.push(v);}
        if(!active[c])continue;
        if(v>bv){s2=b;sv=bv;b=c;bv=v;}else if(v>sv){s2=c;sv=v;}
      }
      if(s2<0)s2=b;
      return {c:b,run:s2,exp:bv};
    }

    /* seg: perfil visto pela câmera · c: criativo exibido · hit: a pessoa interagiu */
    function learn(i,seg,c,hit){
      const k=seg*NC+c,t=T[i],Zc=Z[zoneOf[i]];
      t.n[k]++;Zc.n[k]++;G.n[k]++;
      if(hit){t.a[k]++;Zc.a[k]++;G.a[k]++;}
    }

    /* chamar uma vez por hora */
    function forget(){
      const f=P.forget;
      const dec=m=>{for(let k=0;k<m.a.length;k++){m.a[k]*=f;m.n[k]*=f;}};
      T.forEach(dec);Z.forEach(dec);dec(G);
    }

    /* exposição: o totem sabe o que exibiu e para quantas pessoas */
    function expose(i,c,n){E[i][c]+=n;}
    function decay(f){for(let i=0;i<E.length;i++){const e=E[i];for(let c=0;c<NC;c++)e[c]*=f;}}

    return {choose,learn,forget,mean,expose,decay,
      wear:(i,c)=>wearOf(E[i][c]),exposure:i=>E[i],active,cells:{T,Z,G},params:P};
  }
  return {create,DEFAULTS};
});
