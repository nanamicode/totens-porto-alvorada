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
  const DEFAULTS={kz:40,kt:60,rest:.4,forget:.985,corrige:1,estima:1};
  const GRADE=[0,.1,.2,.3,.4,.5,.6,.7,.8,1,1.2,1.5,2];   // valores de r (taxa de desgaste) considerados na estimativa
  const fat=(r,e)=>.35+.65*Math.exp(-r*e/600);      // fator multiplicativo sobre a taxa, dada a exposição e
  const MIN_BETA=1e-3;     // evita Beta(0, b), que não existe, quando os priors são zerados e ainda não há dados

  /* opt.nSeg, opt.nCre   número de perfis e de criativos
     opt.zoneOf           zona de cada totem (array de índices)
     opt.nZones           número de zonas
     opt.rng              função aleatória em [0,1)
     opt.params           kz, kt (força dos priors), rest (desgaste assumido, ou prior da estimativa), forget (esquecimento por hora),
                          corrige (1 = cada interação vale 1/f, medindo a taxa sem desgaste),
                          estima (1 = estima o desgaste de cada totem pelos dados);
                          pode ser um objeto compartilhado e alterado em tempo real
     opt.active           array de campanhas ativas (opcional, compartilhado) */
  function create(opt){
    const NS=opt.nSeg,NC=opt.nCre,rng=opt.rng,zoneOf=opt.zoneOf,P=opt.params||Object.assign({},DEFAULTS);
    const active=opt.active||new Array(NC).fill(true);
    const mk=()=>({a:new Float64Array(NS*NC),n:new Float64Array(NS*NC)});
    const T=zoneOf.map(mk),Z=Array.from({length:opt.nZones},mk),G=mk();
    const E=zoneOf.map(()=>new Float64Array(NC));       // olhares recentes de cada criativo em cada totem
    const score=new Float64Array(NC);

    /* desgaste: r por totem. Com params.estima ligado, é estimado pelos dados; senão vale params.rest */
    const ll=zoneOf.map(()=>new Float64Array(GRADE.length));   // log-verossimilhança de cada r, por totem
    const rHat=new Float64Array(zoneOf.length).fill(P.rest);
    let restFn=null;                                           // substitui a estimativa (só para experimentos)
    const rest=i=>restFn?restFn(i):(P.estima?rHat[i]:P.rest);
    const wearOf=(i,e)=>1-Math.exp(-rest(i)*e/600);            // desgaste estimado, de 0 a 1
    let mi=-1,mc=-1,me=-1;const mf=new Float64Array(GRADE.length);   // memória do fator de cada r para a última exposição

    /* média de toda a rede, com um prior fraco de 2% */
    const globalMean=(s,c)=>{const k=s*NC+c;return (G.a[k]+.2)/(G.n[k]+10);};
    /* média da zona, puxada para a da rede com força kz; sem dados e sem prior, vale a da rede */
    const zoneMean=(z,s,c)=>{const k=s*NC+c,gm=(G.a[k]+.2)/(G.n[k]+10),d=Z[z].n[k]+P.kz;return d>0?(Z[z].a[k]+P.kz*gm)/d:gm;};

    function mean(i,s,c){
      const k=s*NC+c,t=T[i],zm=zoneMean(zoneOf[i],s,c);
      const d=t.n[k]+P.kt;
      return d>0?(t.a[k]+P.kt*zm)/d:zm;      // sem prior e sem dados, vale a média da zona
    }

    /* aud: audiência por perfil (contagens) · tot: total que divide a audiência · rec: objeto opcional que recebe cada cálculo */
    function choose(i,aud,tot,rec){
      const t=T[i],Zc=Z[zoneOf[i]],e=E[i],r=rest(i);
      score.fill(0);
      for(let s=0;s<NS;s++){
        const n=aud[s];if(!(n>0))continue;
        if(rec)rec.cells[s]=[];
        for(let c=0;c<NC;c++){
          if(!active[c]){if(rec)rec.cells[s][c]={gm:0,zm:0,a:0,b:0,th:0,gn:0,zn:0,tn:0};continue;}
          const k=s*NC+c;
          const gm=globalMean(s,c),zm=zoneMean(zoneOf[i],s,c);
          const a=Math.max(t.a[k]+P.kt*zm,MIN_BETA),b=Math.max(t.n[k]-t.a[k]+P.kt*(1-zm),MIN_BETA),th=betaS(a,b,rng);
          score[c]+=n*th;
          if(rec)rec.cells[s][c]={gm,zm,a,b,th,gn:G.n[k],zn:Zc.n[k],tn:t.n[k]};
        }
      }
      let b=-1,bv=-1,s2=-1,sv=-1;
      if(rec){rec.raw=[];rec.E=[];rec.fe=[];rec.v=[];rec.rEst=r;}
      for(let c=0;c<NC;c++){
        const fe=fat(r,e[c]),v=active[c]?score[c]/tot*fe:0;
        if(rec){rec.raw.push(score[c]);rec.E.push(e[c]);rec.fe.push(fe);rec.v.push(v);}
        if(!active[c])continue;
        if(v>bv){s2=b;sv=bv;b=c;bv=v;}else if(v>sv){s2=c;sv=v;}
      }
      if(s2<0)s2=b;
      return {c:b,run:s2,exp:bv};
    }

    /* seg: perfil visto pela câmera · c: criativo exibido · hit: a pessoa interagiu */
    function learn(i,seg,c,hit){
      const k=seg*NC+c,t=T[i],Zc=Z[zoneOf[i]],e=E[i][c];
      /* com corrige, cada interação vale 1/f: as contagens passam a medir a taxa sem desgaste */
      const inc=hit?(P.corrige?1/fat(rest(i),e):1):0;
      t.n[k]++;Zc.n[k]++;G.n[k]++;
      t.a[k]+=inc;Zc.a[k]+=inc;G.a[k]+=inc;
      if(P.estima){
        if(i!==mi||c!==mc||e!==me){mi=i;mc=c;me=e;for(let g=0;g<GRADE.length;g++)mf[g]=fat(GRADE[g],e);}
        const b=(G.a[k]+.2)/(G.n[k]+10),L=ll[i];
        for(let g=0;g<GRADE.length;g++){const p=Math.min(Math.max(b*mf[g],1e-4),.5);L[g]+=Math.log(hit?p:1-p);}
      }
      return inc;
    }

    /* chamar uma vez por hora */
    function forget(){
      const f=P.forget;
      const dec=m=>{for(let k=0;k<m.a.length;k++){m.a[k]*=f;m.n[k]*=f;}};
      T.forEach(dec);Z.forEach(dec);dec(G);
      for(const L of ll)for(let g=0;g<L.length;g++)L[g]*=f;
    }

    /* exposição: o totem sabe o que exibiu e para quantas pessoas */
    function expose(i,c,n){E[i][c]+=n;}
    function decay(f){
      for(let i=0;i<E.length;i++){const e=E[i];for(let c=0;c<NC;c++)e[c]*=f;}
      if(P.estima)refreshRest();
    }
    /* r de cada totem = média da distribuição a posteriori sobre a grade, com prior centrado em params.rest */
    function refreshRest(){
      const w=new Float64Array(GRADE.length);
      for(let i=0;i<ll.length;i++){
        let mx=-1e300;
        for(let g=0;g<GRADE.length;g++){const d=(GRADE[g]-P.rest)/.3;w[g]=ll[i][g]-.5*d*d;if(w[g]>mx)mx=w[g];}
        let sw=0,sr=0;
        for(let g=0;g<GRADE.length;g++){const x=Math.exp(w[g]-mx);sw+=x;sr+=x*GRADE[g];}
        rHat[i]=sr/sw;
      }
    }

    return {choose,learn,forget,mean,globalMean,zoneMean,expose,decay,
      wear:(i,c)=>wearOf(i,E[i][c]),rest,setRest:fn=>{restFn=fn;},exposure:i=>E[i],active,cells:{T,Z,G},params:P};
  }
  return {create,DEFAULTS};
});
