'use strict';
/* Simulação: passo de 30 s que une mundo, algoritmo, rotação fixa e oráculo, com rastreio dos cálculos. */
/* ---------- Passo da simulação: 30 s ---------- */
const DE=Math.exp(-Math.LN2*.5/150),DS=Math.exp(-Math.LN2*.5/180);
/* eventos que um totem real enviaria ao fim de cada spot (docs/EVENTOS.md); só são gerados quando `ativo` */
const EVENTOS={ativo:false,lista:[],max:300,total:0};
function emitirEvento(tt,c,t,hE){
  const ev=Eventos.criar({totem:tt.id,t,duracao:30,criativo:CRE_ID[c],audiencia:ne,interacoes:hE});
  EVENTOS.total++;EVENTOS.lista.push(ev);
  if(EVENTOS.lista.length>EVENTOS.max)EVENTOS.lista.shift();
}
function registroDoMundo(){
  return {totens:S.totems.map(t=>({id:Eventos.idTotem(t.id),nome:t.nome,zona:ZONES[t.zi].id})),criativos:CRE.map((c,k)=>({id:CRE_ID[k],nome:c.nome})).filter((c,k)=>k!==RES||S.lanc)};
}
function stampOf(t){const day=Math.floor(t/86400),s=t%86400;return DIAS[day%7]+' '+String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s/60%60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function pushLine(k,x){S.lines.push({k,t:stampOf(S.t),x});if(S.lines.length>500)S.lines.shift();}
/* Conversão com atraso (docs/ALGORITMO.md). Com PRM.atraso > 0, cada interação converte com a chance cv do criativo e a
   conversão chega depois (atraso exponencial, média PRM.atraso minutos). O algoritmo passa a aprender com as conversões:
   espera=k>0 conta o olhar e o resultado juntos quando a janela (k × a média) fecha; espera=0 conta o olhar já como falha
   e soma o acerto quando a conversão chega. Com atraso 0 nada disso roda e o sorteio de rC não é usado. */
function processarConversoes(){
  const k=S.step,q=S.convQ.get(k);
  if(q){
    S.convQ.delete(k);
    for(const x of q){
      S.conv[x.p]++;S.convPend[x.p]--;
      const r=x.rec;
      if(r){if(r.modo){if(!r.fim)r.k[x.seg]++;}else brain.credit(r.i,x.seg,r.c,r.per,r.e);}
    }
  }
  const m=S.recQ.get(k);
  if(m){
    S.recQ.delete(k);
    for(const r of m){r.fim=true;for(let s=0;s<NS;s++)if(r.n[s]>0)brain.learnLote(r.i,s,r.c,r.n[s],r.k[s],r.per,r.e);}
  }
}
function agendar(mapa,passo,x){const l=mapa.get(passo);if(l)l.push(x);else mapa.set(passo,[x]);}
/* Criativo novo no meio da operação (docs/ALGORITMO.md): o criativo RES entra em campo sem nenhuma contagem aprendida.
   S.lanc acompanha o que importa: em quanto tempo o algoritmo o testa e, se o oráculo o escolhe, em quanto tempo o adota.
   Janela de 60 passos (30 min): adotado = o algoritmo o exibe em pelo menos 80% dos spots em que o oráculo o exibe. */
const JANELA_LANC=60;
function iniciarLancamento(){
  if(S.lanc)return;
  S.totems.forEach(tt=>{for(let h=0;h<24;h++)for(let s=0;s<NS;s++){const k=(h*NS+s)*NC+RES;tt.P[k]=Math.min(.09,tt.P[k]*PRM.qnovo);}});
  S.lanc={passo:S.step,t:S.t,sa:0,so:0,anel:[],wa:0,wo:0,totens:0,testadoEm:null,adotadoEm:null,oraculoUsa:false,oraculoJa:false};
}
function acompanharLancamento(){
  const L=S.lanc,dec=S.step+1-L.passo;
  L.anel.push([L.sa,L.so]);L.wa+=L.sa;L.wo+=L.so;L.sa=0;L.so=0;
  if(L.anel.length>JANELA_LANC){const [a,o]=L.anel.shift();L.wa-=a;L.wo-=o;}
  L.totens=S.totems.reduce((n,t)=>n+(t.shows[RES]>0?1:0),0);
  if(L.testadoEm===null&&L.totens*2>=S.totems.length)L.testadoEm=dec;
  L.oraculoUsa=L.anel.length>=JANELA_LANC&&L.wo>=30;
  if(L.oraculoUsa)L.oraculoJa=true;
  if(L.adotadoEm===null&&L.oraculoUsa&&L.wa>=.8*L.wo)L.adotadoEm=dec;
}
function step(){
  const t=S.t,hour=(t/3600)%24,hI=hour|0,day=Math.floor(t/86400),we=(day%7)>=5||EV.feriado;
  const atrasoOn=PRM.atraso>0,mediaP=PRM.atraso*2,janela=Math.ceil(PRM.espera*mediaP);
  if(S.convQ.size||S.recQ.size)processarConversoes();
  const hAbs=Math.floor(t/3600);
  if(hAbs!==S.hAbs){
    if(S.hAbs!==undefined){brain.forget();pushLine('esq',`Esquecimento: todas as contagens (a, n) multiplicadas por ${f2(PRM.forget,3)} em ${(S.totems.length+ZONES.length+1)*NS*NC} células`);}
    S.hAbs=hAbs;
    if(hI===0)pushLine('marco',`Começa ${DIAS[day%7]} (dia ${day+1})${we?' · fim de semana':''}`);
  }
  brain.decay(DE);
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
    const per=(hI/3)|0;
    if(TR)TR.per=per;
    const dec=brain.choose(i,aud,tot,TR,per),cA=dec.c,runner=dec.run,expA=dec.exp;
    const cR=act[(S.step+i*3)%act.length];
    let cO=0,ov=-1;const oV=[],oF=[];
    for(let c=0;c<NC;c++){
      if(!CON[c]){oV.push(0);oF.push(1);continue;}
      let v=0;const f=fatT(tt.r,tt.E[2][c]+lam*PRM.look);
      for(let s=0;s<NS;s++){const n=N>0?nt[s]:w[s];if(n>0)v+=n*tt.P[(hI*NS+s)*NC+c];}
      v*=f*(atrasoOn?CRE[c].cv:1);oV.push(v/tot);oF.push(f);if(v>ov){ov=v;cO=c;}
    }
    const ch=[cA,cR,cO],fa=[0,0,0],hp=[0,0,0];
    if(S.lanc){if(cA===RES)S.lanc.sa++;if(cO===RES)S.lanc.so++;}
    for(let p=0;p<3;p++)fa[p]=fatT(tt.r,tt.E[p][ch[p]]);
    const upd={},hE=EVENTOS.ativo?new Array(NS).fill(0):null;
    let rec=null;
    if(atrasoOn&&N>0){
      rec={i,c:cA,per,e:brain.exposure(i)[cA],modo:PRM.espera>0?1:0,n:new Float64Array(NS),k:new Float64Array(NS),fim:false};
      if(rec.modo)agendar(S.recQ,S.step+janela,rec);
    }
    for(let v=0;v<N;v++){
      const base=(hI*NS+vT[v])*NC,u=vR[v];
      for(let p=0;p<3;p++){
        const hit=u<tt.P[base+ch[p]]*fa[p];
        if(hit){tt.eng[p]++;S.tot.e[p]++;S.bin.e[p]++;hp[p]++;if(p===0&&hE)hE[vU[v]]++;}
        if(atrasoOn&&hit&&rC()<CRE[ch[p]].cv){
          agendar(S.convQ,S.step+Math.max(1,Math.ceil(-Math.log(1-rC())*mediaP*CRE[ch[p]].dl)),{p,rec:p===0?rec:null,seg:vU[v]});
          S.convPend[p]++;
        }
        if(p===0){
          let inc=0;
          if(!rec)inc=brain.learn(i,vU[v],cA,hit,per);
          else{rec.n[vU[v]]++;if(!rec.modo)inc=brain.learn(i,vU[v],cA,false,per,rec.e);}
          if(TR){
            const u2=upd[vU[v]]||(upd[vU[v]]={n:0,hit:0,a:0});u2.n++;u2.a+=inc;if(hit)u2.hit++;
            if(TR.rows.length<16)TR.rows.push({ts:vT[v],us:vU[v],u,p:tt.P[base+ch[0]]*fa[0],hit});
          }
        }
      }
    }
    brain.expose(i,cA,N);
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
      for(const s in upd){const m=[];for(let c=0;c<NC;c++)m.push(brain.mean(i,+s,c));TR.post[s]=m;}
      S.traces.push(TR);if(S.traces.length>150)S.traces.shift();
      pushLine('dec',`${tt.nome} · λ=${f2(lam)} N=${N} (câmera errou ${err}) · escolhe ${CRE[cA].nome} (esperado ${pc(expA)}; 2ª ${CRE[runner].nome}) · rotação=${CRE[cR].nome} · oráculo=${CRE[cO].nome} · interações A/R/O = ${hp[0]}/${hp[1]}/${hp[2]}`);
    }
    tt.cur[0]=cA;tt.cur[1]=cR;tt.cur[2]=cO;
    if(hE)emitirEvento(tt,cA,t,hE);
    if(hp[0]>0&&S.pulses.length<80)S.pulses.push({i,t0:performance.now()});
  }
  if(S.lanc)acompanharLancamento();
  S.t+=30;S.step++;
  if(S.t-S.binT>=900){S.bins.push(S.bin);S.bin={v:0,e:[0,0,0]};S.binT+=900;}
}

/* Resumo do mundo atual: interações por política, séries de 15 min, aprendizado e desgaste.
   Usado pela avaliação com várias sementes, no navegador e no Node. */
function resumirMundo(){
  const G=brain.cells.G,melhor=[],verdade=[];
  for(let s=0;s<NS;s++){
    let b=0,tb=0,vb=-1,vt=-1;
    for(let c=0;c<NC;c++){
      const k=s*NC+c,v=(G.a[k]+.2)/(G.n[k]+10);
      if(CON[c]&&v>vb){vb=v;b=c;}
      const cr=CRE[c];
      let m=0;ZONES.forEach(z=>{m+=cr.zone[z.id]??1;});
      const t=cr.base*cr.age[s&3]*cr.gen[s>>2]*m/ZONES.length;
      if(CON[c]&&t>vt){vt=t;tb=c;}
    }
    melhor.push(b);verdade.push(tb);
  }
  return {
    olhares:S.tot.v,interacoes:S.tot.e.slice(),conversoes:S.conv.slice(),conversoesPendentes:S.convPend.slice(),
    bins:S.bins.map(b=>b.e),binsOlhares:S.bins.map(b=>b.v),
    porCriativo:S.cs.map(c=>({olhares:Array.from(c.v),interacoes:Array.from(c.e),spots:Array.from(c.s)})),
    zonas:ZONES.map((z,zi)=>({id:z.id,interacoes:[0,1,2].map(p=>S.totems.filter(t=>t.zi===zi).reduce((a,t)=>a+t.eng[p],0))})),
    desgaste:S.totems.map(t=>({zona:t.zi,real:t.r,estimado:brain.rest(t.id)})),
    melhor,verdade,totens:S.totems.length,lancamento:S.lanc?{passo:S.lanc.passo,testadoEm:S.lanc.testadoEm,adotadoEm:S.lanc.adotadoEm,oraculoUsa:S.lanc.oraculoUsa,oraculoJa:S.lanc.oraculoJa,totens:S.lanc.totens,fatiaAlgoritmo:S.lanc.wa/(JANELA_LANC*S.totems.length),fatiaOraculo:S.lanc.wo/(JANELA_LANC*S.totems.length)}:null,
  };
}

/* ---------- Cenários: histórico de mudanças e reprodução do zero (docs/CENARIOS.md) ---------- */
/* a configuração que influencia a simulação: parâmetros, cenários ligados e campanhas pausadas */
function configAtual(){
  return {params:Object.assign({},PRM),eventos:Object.assign({},EV),campanhasPausadas:CON.map((v,k)=>v?-1:k).filter(k=>k>=0&&k!==RES)};
}
/* o que não vier no cenário volta ao padrão: parâmetros ao DEF, cenários desligados, campanhas ativas */
function aplicarConfig(c){
  Object.assign(PRM,DEF,c.params||{});
  Object.keys(EV).forEach(k=>{EV[k]=!!(c.eventos&&c.eventos[k]);});
  CON.fill(true);CON[RES]=false;
  (c.campanhasPausadas||[]).forEach(k=>{if(k>=0&&k<RES)CON[k]=false;});
}
/* quem muda a configuração durante a simulação avisa aqui, para a sessão poder ser reproduzida */
function registrarMudanca(tipo,chave,valor){
  const h=S.historico,u=h[h.length-1];
  if(u&&u.passo===S.step&&u.tipo===tipo&&u.chave===chave){u.valor=valor;return;}   // arrastar um controle vale uma mudança só
  h.push({passo:S.step,tipo,chave,valor});
}
function aplicarMudanca(m){
  if(m.tipo==='param')PRM[m.chave]=m.valor;
  else if(m.tipo==='evento')EV[m.chave]=!!m.valor;
  else if(m.tipo==='campanha'){CON[m.chave]=!!m.valor;if(m.chave===RES&&m.valor)iniciarLancamento();}
}
function cenarioAtual(nome){
  return {versao:1,nome:nome||'',semente:S.semente,passos:S.step,config0:S.config0,mudancas:S.historico.slice(),
    resultado:{olhares:S.tot.v,interacoes:S.tot.e.slice()}};
}
/* refaz a sessão do zero, um passo por vez (quem chama decide quanto tempo gastar em cada fatia) */
function* reproduzirPassos(c){
  aplicarConfig(c.config0||{});
  init(c.semente);
  const ms=c.mudancas||[];let m=0;
  const aplicarAte=k=>{while(m<ms.length&&ms[m].passo<=k){aplicarMudanca(ms[m]);registrarMudanca(ms[m].tipo,ms[m].chave,ms[m].valor);m++;}};
  for(let k=0;k<c.passos;k++){aplicarAte(k);step();yield k+1;}
  aplicarAte(c.passos);
}
