'use strict';
/* Cérebro: Thompson Sampling contextual hierárquico (escolha do criativo, aprendizado e esquecimento). */
/* ---------- Cérebro: Thompson Sampling contextual hierárquico ---------- */
function effMean(i,s,c){
  const k=s*NC+c,G=B.G,Zc=B.Z[S.totems[i].zi],T=B.T[i];
  const gm=(G.a[k]+.2)/(G.n[k]+10),zm=(Zc.a[k]+PRM.kz*gm)/(Zc.n[k]+PRM.kz);
  return (T.a[k]+PRM.kt*zm)/(T.n[k]+PRM.kt);
}
function brainChoose(i,aud,tot,out,rec){
  const T=B.T[i],Zc=B.Z[S.totems[i].zi],G=B.G,E=S.totems[i].E[0];
  scoreA.fill(0);
  for(let s=0;s<NS;s++){
    const n=aud[s];if(!(n>0))continue;
    if(rec)rec.cells[s]=[];
    for(let c=0;c<NC;c++){
      if(!CON[c]){if(rec)rec.cells[s][c]={gm:0,zm:0,a:0,b:0,th:0,gn:0,zn:0,tn:0};continue;}
      const k=s*NC+c;
      const gm=(G.a[k]+.2)/(G.n[k]+10),zm=(Zc.a[k]+PRM.kz*gm)/(Zc.n[k]+PRM.kz);
      const a=T.a[k]+PRM.kt*zm,b=T.n[k]-T.a[k]+PRM.kt*(1-zm),th=betaS(a,b,rB);
      scoreA[c]+=n*th;
      if(rec)rec.cells[s][c]={gm,zm,a,b,th,gn:G.n[k],zn:Zc.n[k],tn:T.n[k]};
    }
  }
  let b=-1,bv=-1,s2=-1,sv=-1;
  if(rec){rec.raw=[];rec.E=[];rec.fe=[];rec.v=[];}
  for(let c=0;c<NC;c++){
    const fe=.35+.65*Math.exp(-PRM.rest*E[c]/600),v=CON[c]?scoreA[c]/tot*fe:0;
    if(rec){rec.raw.push(scoreA[c]);rec.E.push(E[c]);rec.fe.push(fe);rec.v.push(v);}
    if(!CON[c])continue;
    if(v>bv){s2=b;sv=bv;b=c;bv=v;}else if(v>sv){s2=c;sv=v;}
  }
  if(s2<0)s2=b;
  out.run=s2;out.exp=bv;return b;
}
function brainLearn(i,us,c,hit){
  const k=us*NC+c,T=B.T[i],Zc=B.Z[S.totems[i].zi],G=B.G;
  T.n[k]++;Zc.n[k]++;G.n[k]++;
  if(hit){T.a[k]++;Zc.a[k]++;G.a[k]++;}
}
function brainForget(){
  const f=PRM.forget;
  const dec=m=>{for(let k=0;k<m.a.length;k++){m.a[k]*=f;m.n[k]*=f;}};
  B.T.forEach(dec);B.Z.forEach(dec);dec(B.G);
}
