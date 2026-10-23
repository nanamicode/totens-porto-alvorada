'use strict';
/* Cérebro: Thompson Sampling contextual hierárquico (escolha do criativo, aprendizado e esquecimento).
   Não depende de navegador, de mundo simulado nem de interface: só de util.js.
   Funciona no navegador (Brain.create) e no Node (require('./brain.js').create).

   O que o cérebro recebe, e nada além disso:
     choose(totem, audiência por perfil, total de pessoas)  →  criativo a exibir
     learn(totem, perfil visto, criativo, interagiu?)       →  atualiza as contagens
     learnLote / credit                                     →  o mesmo para resultados que chegam depois (docs/ALGORITMO.md)
   Ele nunca lê a taxa verdadeira, a zona (além do índice) nem o horário. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./util.js'));
  else root.Brain=factory(root.Util);
})(typeof self!=='undefined'?self:globalThis,function(U){
  const {betaS}=U;
  const DEFAULTS={kz:40,kt:60,rest:.4,forget:.985,corrige:1,estima:1,contexto:0,kp:10};
  const GRADE=[0,.1,.2,.3,.4,.5,.6,.7,.8,1,1.2,1.5,2];   // valores de r (taxa de desgaste) considerados na estimativa
  const fat=(r,e)=>.35+.65*Math.exp(-r*e/600);      // fator multiplicativo sobre a taxa, dada a exposição e
  const MIN_BETA=1e-3;     // evita Beta(0, b), que não existe, quando os priors são zerados e ainda não há dados

  /* opt.nSeg, opt.nCre   número de perfis e de criativos
     opt.zoneOf           zona de cada totem (array de índices)
     opt.nZones           número de zonas
     opt.nPeriods         número de períodos do dia usados como contexto (padrão 1: sem contexto de horário)
     opt.rng              função aleatória em [0,1)
     opt.params           kz, kt (força dos priors), rest (desgaste assumido, ou prior da estimativa), forget (esquecimento por hora),
                          corrige (1 = cada interação vale 1/f, medindo a taxa sem desgaste),
                          estima (1 = estima o desgaste de cada totem pelos dados);
                          pode ser um objeto compartilhado e alterado em tempo real
     opt.active           array de campanhas ativas (opcional, compartilhado)
     opt.peso             array de pesos por criativo (opcional, compartilhado, padrão 1): multiplica o valor esperado na hora de
                          escolher, para empurrar ou segurar uma campanha (metas de entrega). 0 tira a campanha da escolha. */
  function create(opt){
    const NS=opt.nSeg,NC=opt.nCre,rng=opt.rng,zoneOf=opt.zoneOf,P=opt.params||Object.assign({},DEFAULTS);
    const active=opt.active||new Array(NC).fill(true);
    const peso=opt.peso||new Array(NC).fill(1);
    const mk=()=>({a:new Float64Array(NS*NC),n:new Float64Array(NS*NC)});
    const T=zoneOf.map(mk),Z=Array.from({length:opt.nZones},mk),G=mk();
    const E=zoneOf.map(()=>new Float64Array(NC));       // olhares recentes de cada criativo em cada totem
    const score=new Float64Array(NC);

    /* período do dia: um multiplicador por criativo e período, comum a toda a rede, com média 1 por criativo.
       Mh soma as interações (já corrigidas pelo desgaste) e Mx soma o que a taxa média da rede previa. */
    const NP=opt.nPeriods||1;
    const Mh=new Float64Array(NP*NC),Mx=new Float64Array(NP*NC),Mn=new Float64Array(NP*NC).fill(1);
    let perFn=null;                                            // substitui a estimativa (só para experimentos)
    const mult=(c,per)=>perFn?perFn(c,per):(P.contexto&&NP>1&&per!=null?Mn[per*NC+c]:1);
    function refreshMult(){
      for(let c=0;c<NC;c++){
        let sum=0;
        for(let q=0;q<NP;q++){const k=q*NC+c;Mn[k]=(Mh[k]+P.kp)/(Mx[k]+P.kp);sum+=Mn[k];}
        const avg=sum/NP;for(let q=0;q<NP;q++)Mn[q*NC+c]/=avg;
      }
    }

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
    function choose(i,aud,tot,rec,per){
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
      let b=-1,bv=-1,s2=-1,sv=-1,eb=0;
      if(rec){rec.raw=[];rec.E=[];rec.fe=[];rec.v=[];rec.rEst=r;rec.mult=[];rec.peso=[];}
      for(let c=0;c<NC;c++){
        const fe=fat(r,e[c]),m=mult(c,per),v=active[c]?score[c]/tot*fe*m:0,vp=v*peso[c];
        if(rec){rec.mult.push(m);rec.raw.push(score[c]);rec.E.push(e[c]);rec.fe.push(fe);rec.v.push(v);rec.peso.push(peso[c]);}
        if(!active[c])continue;
        if(vp>bv){s2=b;sv=bv;b=c;bv=vp;eb=v;}else if(vp>sv){s2=c;sv=vp;}
      }
      if(s2<0)s2=b;
      return {c:b,run:s2,exp:eb};
    }

    /* seg: perfil visto pela câmera · c: criativo exibido · hit: a pessoa interagiu
       eSnap (opcional): a exposição do criativo no momento em que foi exibido, para quando o resultado é aprendido depois */
    function learn(i,seg,c,hit,per,eSnap){
      const k=seg*NC+c,t=T[i],Zc=Z[zoneOf[i]],e=eSnap!==undefined?eSnap:E[i][c],f=fat(rest(i),e),m=mult(c,per);
      /* com corrige, cada interação vale 1/f; com contexto, também 1/m: as contagens medem a taxa sem desgaste e sem efeito do horário */
      const inc=hit?1/((P.corrige?f:1)*m):0;
      t.n[k]++;Zc.n[k]++;G.n[k]++;
      t.a[k]+=inc;Zc.a[k]+=inc;G.a[k]+=inc;
      if(P.contexto&&NP>1&&per!=null&&!perFn){const q=per*NC+c;Mh[q]+=hit?(P.corrige?1/f:1):0;Mx[q]+=globalMean(seg,c);}
      if(P.estima){
        if(i!==mi||c!==mc||e!==me){mi=i;mc=c;me=e;for(let g=0;g<GRADE.length;g++)mf[g]=fat(GRADE[g],e);}
        const b=(G.a[k]+.2)/(G.n[k]+10),L=ll[i];
        for(let g=0;g<GRADE.length;g++){const p=Math.min(Math.max(b*m*mf[g],1e-4),.5);L[g]+=Math.log(hit?p:1-p);}
      }
      return inc;
    }

    /* varias pessoas de uma vez: n olhares do perfil seg, com `hits` interações (pode ser fracionário,
       quando só se sabe o total e a repartição entre perfis é estimada). Para n = 1 faz o mesmo que learn. */
    function learnLote(i,seg,c,n,hits,per,eSnap){
      if(!(n>0))return 0;
      hits=Math.min(Math.max(hits,0),n);
      const k=seg*NC+c,t=T[i],Zc=Z[zoneOf[i]],e=eSnap!==undefined?eSnap:E[i][c],f=fat(rest(i),e),m=mult(c,per);
      const inc=hits/((P.corrige?f:1)*m);
      t.n[k]+=n;Zc.n[k]+=n;G.n[k]+=n;
      t.a[k]+=inc;Zc.a[k]+=inc;G.a[k]+=inc;
      if(P.contexto&&NP>1&&per!=null&&!perFn){const q=per*NC+c;Mh[q]+=hits*(P.corrige?1/f:1);Mx[q]+=n*globalMean(seg,c);}
      if(P.estima){
        if(i!==mi||c!==mc||e!==me){mi=i;mc=c;me=e;for(let g=0;g<GRADE.length;g++)mf[g]=fat(GRADE[g],e);}
        const b=(G.a[k]+.2)/(G.n[k]+10),L=ll[i];
        for(let g=0;g<GRADE.length;g++){const p=Math.min(Math.max(b*m*mf[g],1e-4),.5);L[g]+=hits*Math.log(p)+(n-hits)*Math.log(1-p);}
      }
      return inc;
    }

    /* resultado que chegou depois da exibição (conversão com atraso): só soma o acerto, sem contar outro olhar.
       Serve a quem já contou o olhar como falha na hora da exibição (learn com hit=false); eSnap é a exposição daquela exibição. */
    function credit(i,seg,c,per,eSnap){
      const k=seg*NC+c,t=T[i],Zc=Z[zoneOf[i]],e=eSnap!==undefined?eSnap:E[i][c],f=fat(rest(i),e),m=mult(c,per);
      const inc=1/((P.corrige?f:1)*m);
      t.a[k]+=inc;Zc.a[k]+=inc;G.a[k]+=inc;
      return inc;
    }

    /* chamar uma vez por hora */
    function forget(){
      const f=P.forget;
      const dec=m=>{for(let k=0;k<m.a.length;k++){m.a[k]*=f;m.n[k]*=f;}};
      T.forEach(dec);Z.forEach(dec);dec(G);
      for(const L of ll)for(let g=0;g<L.length;g++)L[g]*=f;
      for(let q=0;q<Mh.length;q++){Mh[q]*=f;Mx[q]*=f;}
    }

    /* exposição: o totem sabe o que exibiu e para quantas pessoas */
    function expose(i,c,n){E[i][c]+=n;}
    function decay(f){
      for(let i=0;i<E.length;i++){const e=E[i];for(let c=0;c<NC;c++)e[c]*=f;}
      if(P.estima)refreshRest();
      if(P.contexto&&NP>1)refreshMult();
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

    /* tudo o que o algoritmo aprendeu, em listas simples (JSON). importar exige o mesmo número de totens, zonas, perfis e criativos. */
    const lista=a=>Array.from(a);
    function exportar(){
      const par=m=>({a:lista(m.a),n:lista(m.n)});
      return {versao:1,nSeg:NS,nCre:NC,nPeriods:NP,T:T.map(par),Z:Z.map(par),G:par(G),E:E.map(lista),ll:ll.map(lista),rHat:lista(rHat),Mh:lista(Mh),Mx:lista(Mx),Mn:lista(Mn)};
    }
    function importar(s){
      if(!s||s.versao!==1||s.nSeg!==NS||s.nCre!==NC||s.nPeriods!==NP||s.T.length!==T.length||s.Z.length!==Z.length)
        throw new Error('o estado salvo não combina com este Brain (totens, zonas, perfis, criativos ou períodos diferentes)');
      const poe=(m,o)=>{m.a.set(o.a);m.n.set(o.n);};
      s.T.forEach((o,i)=>poe(T[i],o));s.Z.forEach((o,z)=>poe(Z[z],o));poe(G,s.G);
      s.E.forEach((o,i)=>E[i].set(o));s.ll.forEach((o,i)=>ll[i].set(o));rHat.set(s.rHat);Mh.set(s.Mh);Mx.set(s.Mx);Mn.set(s.Mn);
    }

    return {choose,learn,learnLote,credit,forget,mean,globalMean,zoneMean,expose,decay,
      wear:(i,c)=>wearOf(i,E[i][c]),rest,setRest:fn=>{restFn=fn;},setPeriodFactor:fn=>{perFn=fn;},periodFactor:mult,periods:NP,exposure:i=>E[i],active,peso,cells:{T,Z,G},params:P,exportar,importar};
  }
  return {create,DEFAULTS};
});
