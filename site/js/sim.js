'use strict';
/* Simulação: passo de 30 s que une mundo, algoritmo, rotação fixa e oráculo, com rastreio dos cálculos. */
/* ---------- Passo da simulação: 30 s ---------- */
const dbg={run:0,exp:0};
const DE=Math.exp(-Math.LN2*.5/150),DS=Math.exp(-Math.LN2*.5/180);
const f2=(x,d=2)=>Number(x).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
function stampOf(t){const day=Math.floor(t/86400),s=t%86400;return DIAS[day%7]+' '+String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s/60%60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function pushLine(k,x){S.lines.push({k,t:stampOf(S.t),x});if(S.lines.length>500)S.lines.shift();}
function step(){
  const t=S.t,hour=(t/3600)%24,hI=hour|0,day=Math.floor(t/86400),we=(day%7)>=5||EV.feriado;
  const hAbs=Math.floor(t/3600);
  if(hAbs!==S.hAbs){
    if(S.hAbs!==undefined){brainForget();pushLine('esq',`Esquecimento: todas as contagens (a, n) multiplicadas por ${f2(PRM.forget,3)} em ${(S.totems.length+ZONES.length+1)*NS*NC} células`);}
    S.hAbs=hAbs;
    if(hI===0)pushLine('marco',`Começa ${DIAS[day%7]} (dia ${day+1})${we?' · fim de semana':''}`);
  }
  const zpR=ZONES.map(z=>z.prof(hour,we)),zp=ZONES.map((z,k)=>(zpR[k]+.03)*evMul(z.id));
  const act=[];CON.forEach((x,c)=>{if(x)act.push(c);});
  const dh=Math.floor(t/60%60),stamp=String(hI).padStart(2,'0')+':'+String(dh).padStart(2,'0');
  for(const tt of S.totems){
    const i=tt.id,lam=tt.scale*13*zp[tt.zi],cw=tt.cw[hI],w=tt.wt[hI];
    const TR=(i===sel)?{id:S.step,t:stamp,stamp:stampOf(t),we,tot:tt.nome,zona:ZONES[tt.zi].nome,prof:zpR[tt.zi],ev:evMul(ZONES[tt.zi].id),scale:tt.scale,lam,r:tt.r,cells:{},rows:[]}:null;
    for(let p=0;p<3;p++){const E=tt.E[p];for(let c=0;c<NC;c++)E[c]*=DE;}
    for(let s=0;s<NS;s++)tt.recent[s]*=DS;
    const N=Math.min(40,poisson(lam,rW));
    ne.fill(0);nt.fill(0);let err=0;
    for(let v=0;v<N;v++){
      const r=rW();let ts=0;while(ts<NS-1&&r>cw[ts])ts++;
      let us=ts;const q=rW(),a=ts&3,g=ts>>2;
      if(q>PRM.acc){
        if(q<PRM.acc+(1-PRM.acc)*.75){let na=a;if(a===0)na=1;else if(a===3)na=2;else na=a+(rW()<.5?-1:1);us=g*4+na;}
        else us=(1-g)*4+a;
      }
      if(us!==ts)err++;
      vT[v]=ts;vU[v]=us;vR[v]=rW();nt[ts]++;ne[us]++;
    }
    if(TR){TR.N=N;TR.nt=Array.from(nt);TR.ne=Array.from(ne);TR.err=err;TR.w=Array.from(w);}
    const aud=N>0?ne:w,tot=N>0?N:1;
    const cA=brainChoose(i,aud,tot,dbg,TR),runner=dbg.run,expA=dbg.exp;
    const cR=act[(S.step+i*3)%act.length];
    let cO=0,ov=-1;const oV=[],oF=[];
    for(let c=0;c<NC;c++){
      if(!CON[c]){oV.push(0);oF.push(1);continue;}
      let v=0;const f=fatT(tt.r,tt.E[2][c]+lam*PRM.look);
      for(let s=0;s<NS;s++){const n=N>0?nt[s]:w[s];if(n>0)v+=n*tt.P[(hI*NS+s)*NC+c];}
      v*=f;oV.push(v/tot);oF.push(f);if(v>ov){ov=v;cO=c;}
    }
    const ch=[cA,cR,cO],fa=[0,0,0],hp=[0,0,0];
    for(let p=0;p<3;p++)fa[p]=fatT(tt.r,tt.E[p][ch[p]]);
    const upd={};
    for(let v=0;v<N;v++){
      const base=(hI*NS+vT[v])*NC,u=vR[v];
      for(let p=0;p<3;p++){
        const hit=u<tt.P[base+ch[p]]*fa[p];
        if(hit){tt.eng[p]++;S.tot.e[p]++;S.bin.e[p]++;hp[p]++;}
        if(p===0){
          brainLearn(i,vU[v],cA,hit);
          if(TR){
            const u2=upd[vU[v]]||(upd[vU[v]]={n:0,hit:0});u2.n++;if(hit)u2.hit++;
            if(TR.rows.length<16)TR.rows.push({ts:vT[v],us:vU[v],u,p:tt.P[base+ch[0]]*fa[0],hit});
          }
        }
      }
    }
    for(let p=0;p<3;p++){tt.E[p][ch[p]]+=N;const q=S.cs[p];q.v[ch[p]]+=N;q.e[ch[p]]+=hp[p];q.s[ch[p]]++;}
    tt.views+=N;S.tot.v+=N;S.bin.v+=N;
    for(let v=0;v<N;v++)tt.recent[vU[v]]++;
    tt.hrSum[hI]+=N;tt.hrCnt[hI]++;
    tt.ewma=tt.ewma*.9+N*.1;tt.lastN=N;tt.lastNe.set(ne);
    tt.shows[cA]++;
    if(cA!==tt.cur[0]&&N>0){
      let dom=-1,dv=0;for(let s=0;s<NS;s++)if(ne[s]>dv){dv=ne[s];dom=s;}
      S.log.push({t:stamp,tt:tt.nome,c:cA,runner,n:N,dom,pct:Math.round(100*dv/N),exp:expA});
      if(S.log.length>60)S.log.shift();
      pushLine('troca',`${tt.nome}: ${CRE[tt.cur[0]].nome} → ${CRE[cA].nome} (${N} pessoas${dom>=0?`, ${Math.round(100*dv/N)}% ${segLabel(dom)}`:''}, esperado ${pc(expA)})`);
    }
    if(TR){
      TR.choice=cA;TR.runner=runner;TR.exp=expA;TR.rot=cR;TR.oV=oV;TR.oF=oF;TR.orc=cO;
      TR.out=[0,1,2].map(p=>({c:ch[p],f:fa[p],hits:hp[p]}));TR.upd=upd;TR.post={};
      for(const s in upd){const m=[];for(let c=0;c<NC;c++)m.push(effMean(i,+s,c));TR.post[s]=m;}
      S.traces.push(TR);if(S.traces.length>150)S.traces.shift();
      pushLine('dec',`${tt.nome} · λ=${f2(lam)} N=${N} (câmera errou ${err}) · escolhe ${CRE[cA].nome} (esperado ${pc(expA)}; 2ª ${CRE[runner].nome}) · rotação=${CRE[cR].nome} · oráculo=${CRE[cO].nome} · interações A/R/O = ${hp[0]}/${hp[1]}/${hp[2]}`);
    }
    tt.cur[0]=cA;tt.cur[1]=cR;tt.cur[2]=cO;
    if(hp[0]>0&&S.pulses.length<80)S.pulses.push({i,t0:performance.now()});
  }
  S.t+=30;S.step++;
  if(S.t-S.binT>=900){S.bins.push(S.bin);S.bin={v:0,e:[0,0,0]};S.binT+=900;}
}
