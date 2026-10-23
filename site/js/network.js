'use strict';
/* Painel da rede: anunciantes, melhor criativo por zona, ranking de totens, cenários, campanhas e atalhos. */
/* ---------- Painel da rede, cenários e campanhas ---------- */
const brl=x=>x==null?'–':'R$ '+f2(x,2);
let legKey='',netLast=0;
function renderLegend(){
  const cnt=new Array(NC).fill(0);S.totems.forEach(t=>cnt[t.cur[0]]++);
  const key=cnt.join(',')+CON.join('')+mode;if(key===legKey)return;legKey=key;
  const hint=mode==='gan'?'Verde: algoritmo acima da rotação neste totem · vermelho: abaixo · cinza: poucos dados':mode==='flx'?'O brilho cresce com o fluxo de pessoas':'';
  $('legend').innerHTML=CRE.map((c,k)=>`<button type="button" class="chip" data-c="${k}" aria-pressed="${CON[k]}" title="${CON[k]?'Clique para pausar esta campanha':'Clique para retomar esta campanha'}"><i style="background:${c.cor}"></i>${c.nome}<em>${cnt[k]}</em></button>`).join('')+
   '<span class="sep"></span><span class="people"><i style="background:var(--dot-m)"></i>Homens <i style="background:var(--dot-f);margin-left:8px"></i>Mulheres · o tamanho do ponto segue a idade · clique num criativo para pausar a campanha</span>'+(hint?'<span class="sep"></span><span class="people">'+hint+'</span>':'');
}
function zoneBest(){
  return ZONES.map((z,zi)=>{
    const sh=new Float64Array(NS);let tot=0;
    S.totems.forEach(t=>{if(t.zi===zi)for(let s=0;s<NS;s++){sh[s]+=t.recent[s];tot+=t.recent[s];}});
    if(tot<=0)return null;
    const Zc=brain.cells.Z[zi],G=brain.cells.G,sc=[];
    for(let c=0;c<NC;c++){let v=0;for(let s=0;s<NS;s++){v+=sh[s]/tot*brain.zoneMean(zi,s,c);}sc.push(v);}
    const order=[...sc.keys()].filter(c=>CON[c]).sort((a,b)=>sc[b]-sc[a]);
    let dom=0;for(let s=1;s<NS;s++)if(sh[s]>sh[dom])dom=s;
    return {z,best:order[0],second:order[1],v:sc[order[0]],v2:order[1]!=null?sc[order[1]]:0,dom,pct:sh[dom]/tot};
  });
}
function renderNet(){
  const cs=S.cs,T=S.tot,cpm=PRM.cpm,val=PRM.val;
  const inv=T.v*cpm/1000,retA=T.e[0]*val,retR=T.e[1]*val;
  const tot=p=>{let t=0;for(let c=0;c<NC;c++)t+=cs[p].s[c];return t;},tA=tot(0),tR=tot(1);
  const cpi=(p,c)=>cs[p].e[c]>0?cs[p].v[c]*cpm/1000/cs[p].e[c]:null;
  const rows=CRE.map((cr,c)=>`<tr${CON[c]?'':' class="alt"'}><td>${dotName(c)}${CON[c]?'':' (pausado)'}</td><td>${tA?pc(cs[0].s[c]/tA,0):'–'}</td><td>${per1k(cs[0].e[c],cs[0].v[c])}</td><td>${per1k(cs[1].e[c],cs[1].v[c])}</td><td>${brl(cpi(0,c))}</td><td>${brl(cpi(1,c))}</td></tr>`);
  const cA=T.e[0]>0?inv/T.e[0]:null,cR=T.e[1]>0?inv/T.e[1]:null;
  rows.push(`<tr class="pick"><td>Rede inteira</td><td>100%</td><td>${per1k(T.e[0],T.v)}</td><td>${per1k(T.e[1],T.v)}</td><td>${brl(cA)}</td><td>${brl(cR)}</td></tr>`);
  $('advBody').innerHTML=table(['Criativo','Fatia dos spots (algoritmo)','Interações /1.000 algoritmo','Interações /1.000 rotação','Custo por interação algoritmo','Custo por interação rotação'],rows);
  $('econSum').innerHTML=`Investimento estimado: <b>${brl(inv)}</b> (${fmt(T.v)} olhares a ${brl(cpm)} por mil). Retorno com o algoritmo: <b>${brl(retA)}</b> (${inv>0?f2(retA/inv,2):'–'}×). Com a rotação: <b>${brl(retR)}</b> (${inv>0?f2(retR/inv,2):'–'}×). `+(cA&&cR?`O algoritmo reduz o custo por interação em <b>${f2((1-cA/cR)*100,0)}%</b>.`:'');
  const zb=zoneBest();
  $('zoneBest').innerHTML=zb.map((r,zi)=>r?`<div><i style="background:${CRE[r.best].cor}"></i><span><b>${r.z.nome}</b> · ${CRE[r.best].nome}${r.second!=null?` <small style="color:var(--muted)">(2º ${CRE[r.second].nome.split(' ')[0]})</small>`:''}</span><b>${pc(r.v)}</b></div><div style="margin:-4px 0 2px 18px;color:var(--muted);font-size:12px">${Math.round(r.pct*100)}% ${segLabel(r.dom)}</div>`:`<div><span>${ZONES[zi].nome}: sem dados</span></div>`).join('');
  const eligible=S.totems.filter(t=>t.views>=300&&t.eng[1]>0).map(t=>({t,g:t.eng[0]/t.eng[1]-1})).sort((a,b)=>b.g-a.g);
  const rk=x=>`<button type="button" class="rk" data-t="${x.t.id}"><span>${x.t.nome}<small style="color:var(--muted)"> · ${ZONES[x.t.zi].nome}</small></span><b class="${x.g>=0?'up':'dn'}">${(x.g>=0?'+':'')+f2(x.g*100,0)}%</b></button>`;
  $('rankBody').innerHTML=eligible.length?'<h3 class="mini">Maiores ganhos</h3>'+eligible.slice(0,4).map(rk).join('')+'<h3 class="mini">Menores ganhos</h3>'+eligible.slice(-4).reverse().map(rk).join(''):'<p class="hint">Reunindo dados…</p>';
  const wear=[];
  S.totems.forEach(t=>{for(let c=0;c<NC;c++){const d=brain.wear(t.id,c);if(d>.25)wear.push({t,c,d});}});
  wear.sort((a,b)=>b.d-a.d);
  $('wearBody').innerHTML=wear.length?wear.slice(0,4).map(w=>`<button type="button" class="rk" data-t="${w.t.id}"><i class="dot" style="background:${CRE[w.c].cor}"></i><span>${w.t.nome} · ${CRE[w.c].nome}</span><b class="dn">${Math.round(w.d*100)}%</b></button>`).join(''):'<p class="hint">Nenhum criativo passa de 25% de desgaste.</p>';
}
function csvText(){
  const cs=S.cs,cpm=PRM.cpm,x=(v,d=2)=>Number(v).toFixed(d);
  let t='criativo,spots_algoritmo,olhares_algoritmo,interacoes_algoritmo,custo_interacao_algoritmo,spots_rotacao,olhares_rotacao,interacoes_rotacao,custo_interacao_rotacao\n';
  CRE.forEach((c,k)=>{const ca=cs[0].e[k]>0?cs[0].v[k]*cpm/1000/cs[0].e[k]:'',cr=cs[1].e[k]>0?cs[1].v[k]*cpm/1000/cs[1].e[k]:'';
    t+=[c.nome,cs[0].s[k],cs[0].v[k],cs[0].e[k],ca===''?'':x(ca),cs[1].s[k],cs[1].v[k],cs[1].e[k],cr===''?'':x(cr)].join(',')+'\n';});
  t+='\ntotem,zona,olhares,interacoes_algoritmo,interacoes_rotacao,interacoes_oraculo\n';
  S.totems.forEach(tt=>{t+=[tt.nome,ZONES[tt.zi].nome,tt.views,tt.eng[0],tt.eng[1],tt.eng[2]].join(',')+'\n';});
  return t;
}
$('legend').addEventListener('click',e=>{
  const b=e.target.closest('.chip');if(!b)return;const c=+b.dataset.c;
  if(CON[c]&&CON.filter(Boolean).length<=1)return;
  CON[c]=!CON[c];legKey='';pushLine('marco',`Campanha ${CRE[c].nome} ${CON[c]?'retomada':'pausada'}`);renderLegend();
});
document.addEventListener('click',e=>{const b=e.target.closest('.rk');if(b)select(+b.dataset.t);});
$('segEv').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const k=b.dataset.v;EV[k]=!EV[k];
  b.setAttribute('aria-pressed',String(EV[k]));pushLine('marco',`Cenário “${EVN[k]}” ${EV[k]?'ativado':'desativado'}`);
});
$('csvCopy').addEventListener('click',()=>copyText(csvText(),$('csvArea')));
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return;
  if(e.key==='c'||e.key==='C'){openDrawer(drawer.hidden);}
  else if(e.key==='n'||e.key==='N'){stepOnce();}
  else if(e.key===' '&&e.target===document.body){e.preventDefault();setPlaying(!playing);}
});
