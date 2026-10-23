'use strict';
/* Interface: painel do totem, indicadores, tabela de aprendizado, registro de trocas e gráfico de eficiência. */
/* ---------- Interface ---------- */
const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString('pt-BR');
const pc=(x,d=1)=>(x*100).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
const per1k=(e,v)=>v>0?(1000*e/v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}):'–';
function qrURL(seed){
  const r=mulberry32(seed*97+3);let s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9" shape-rendering="crispEdges"><rect width="9" height="9" fill="#fff"/>';
  const fin=(x,y)=>`<rect x="${x}" y="${y}" width="3" height="3" fill="#111"/><rect x="${x+.5}" y="${y+.5}" width="2" height="2" fill="#fff"/><rect x="${x+1}" y="${y+1}" width="1" height="1" fill="#111"/>`;
  s+=fin(.5,.5)+fin(5.5,.5)+fin(.5,5.5);
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){const inF=(x<4&&y<4)||(x>4&&y<4)||(x<4&&y>4);if(!inF&&r()<.5)s+=`<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`;}
  return 'url("data:image/svg+xml,'+encodeURIComponent(s+'</svg>')+'")';
}
function buildSelect(){
  const el=$('selTotem');el.innerHTML='';
  ZONES.forEach((z,zi)=>{const og=document.createElement('optgroup');og.label=z.nome;
    S.totems.filter(t=>t.zi===zi).forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.nome;og.appendChild(o);});el.appendChild(og);});
  el.value=sel;$('dSel').innerHTML=el.innerHTML;$('dSel').value=sel;
}
function select(i){sel=i;viewStep=null;S.traces.length=0;$('selTotem').value=i;$('dSel').value=i;renderPanel();}
$('selTotem').addEventListener('change',e=>select(+e.target.value));

function renderPanel(){
  const tt=S.totems[sel],z=ZONES[tt.zi],c=tt.cur[0],cr=CRE[c];
  $('pName').textContent=tt.nome;
  $('pMeta').textContent=`T-${String(tt.id+1).padStart(2,'0')} · ${z.nome} · ${fmt(tt.views)} olhares`;
  const scr=$('scr');scr.style.setProperty('--c1',cr.cor);scr.style.setProperty('--c2','#101820');
  $('scrN').textContent=cr.nome;$('scrT').textContent=cr.tag;$('scrQ').style.backgroundImage=qrURL(c+1);
  $('pAud').textContent=tt.lastN===0?'ninguém olhando':`${tt.lastN} ${tt.lastN===1?'pessoa':'pessoas'}`;
  const e=brain.exposure(tt.id)[c],des=brain.wear(tt.id,c);
  $('pFat').style.width=(des*100)+'%';
  $('pFatT').textContent=`Desgaste estimado do criativo atual: ${Math.round(des*100)}% (exposição recente: ${fmt(e)} olhares)`;
  let tot=0;for(let s=0;s<NS;s++)tot+=tt.recent[s];
  $('pDemo').innerHTML=Array.from({length:NS},(_,s)=>{const p=tot>0?tt.recent[s]/tot:0;
    return `<span class="l">${segLabel(s)}</span><span class="b"><i style="width:${Math.min(100,p*250)}%"></i></span><span class="v">${Math.round(p*100)}%</span>`;}).join('');
  const hv=[];let mx=.01;for(let h=0;h<24;h++){const v=tt.hrCnt[h]>0?tt.hrSum[h]/tt.hrCnt[h]:0;hv.push(v);if(v>mx)mx=v;}
  const hn=Math.floor((S.t/3600)%24);
  $('pHours').innerHTML=hv.map((v,h)=>`<i class="${h===hn?'now':''}" style="height:${Math.max(4,v/mx*100)}%" title="${h}h · ${v.toLocaleString('pt-BR',{maximumFractionDigits:1})}"></i>`).join('');
  const order=Array.from({length:NS},(_,s)=>s).sort((a,b)=>tt.recent[b]-tt.recent[a]).slice(0,3);
  $('pLearn').innerHTML=order.map(s=>{let bc=0,bm=-1;for(let k=0;k<NC;k++){const m=brain.mean(tt.id,s,k);if(m>bm){bm=m;bc=k;}}
    return `<div><i style="background:${CRE[bc].cor}"></i><span>${segLabel(s)} → ${CRE[bc].nome}</span><b>${pc(bm)}</b></div>`;}).join('');
  $('pA').textContent=per1k(tt.eng[0],tt.views);$('pR').textContent=per1k(tt.eng[1],tt.views);
}
function renderKPIs(){
  const T=S.tot,day=Math.floor(S.t/86400);
  $('clkDay').textContent=DIAS[day%7]+' · dia '+(day+1);
  $('clkTime').textContent=String(Math.floor((S.t/3600)%24)).padStart(2,'0')+':'+String(Math.floor(S.t/60%60)).padStart(2,'0');
  $('kViews').textContent=fmt(T.v);
  $('kA').textContent=fmt(T.e[0]);$('kAs').textContent=per1k(T.e[0],T.v)+' por 1.000 olhares';
  $('kR').textContent=fmt(T.e[1]);$('kRs').textContent=per1k(T.e[1],T.v)+' por 1.000 olhares';
  const g=T.e[1]>0?T.e[0]/T.e[1]-1:0;
  $('kG').textContent=(g>=0?'+':'')+(g*100).toLocaleString('pt-BR',{maximumFractionDigits:0})+'%';
  const eff=effSeries(0),n=eff.length;
  $('kE').textContent=n?pc(eff[n-1],0):'–';
}
function effSeries(p){
  const b=S.bins,out=[],WIN=12;
  for(let k=WIN-1;k<b.length;k++){let a=0,o=0;for(let j=k-WIN+1;j<=k;j++){a+=b[j].e[p];o+=b[j].e[2];}out.push(o>0?a/o:0);}
  return out;
}
function renderHeat(){
  const G=brain.cells.G,rows=[],truth=s=>c=>{const cr=CRE[c];let m=0;ZONES.forEach(z=>m+=cr.zone[z.id]??1);return cr.base*cr.age[s&3]*cr.gen[s>>2]*m/ZONES.length;};
  let mx=.001;const val=[];
  for(let s=0;s<NS;s++){val.push([]);for(let c=0;c<NC;c++){const k=s*NC+c,v=(G.a[k]+.2)/(G.n[k]+10);val[s].push(v);if(v>mx)mx=v;}}
  let h='<table class="heat"><thead><tr><th></th>'+CRE.map(c=>`<th><i style="background:${c.cor}"></i>${c.nome.split(' ')[0]}</th>`).join('')+'</tr></thead><tbody>';
  for(let s=0;s<NS;s++){
    let bi=0;for(let c=1;c<NC;c++)if(val[s][c]>val[s][bi])bi=c;
    const tr=truth(s);let ti=0;for(let c=1;c<NC;c++)if(tr(c)>tr(ti))ti=c;
    h+=`<tr><th>${segLabel(s)}</th>`;
    for(let c=0;c<NC;c++){
      const v=val[s][c],a=Math.round(8+70*Math.pow(v/mx,1.6));
      h+=`<td class="${c===bi?'best':''}" style="background:color-mix(in srgb,var(--accent) ${a}%,transparent)">${(v*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}${showTruth?`<small>${c===ti?'★ ':''}${(tr(c)*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}</small>`:''}</td>`;
    }
    h+='</tr>';
  }
  $('heatWrap').innerHTML=h+'</tbody></table>';
}
function renderLog(){
  const l=S.log.slice(-9).reverse();
  $('log').innerHTML=l.length?l.map(e=>`<li><i style="background:${CRE[e.c].cor}"></i><div><b>${e.tt}</b> passou a exibir <b>${CRE[e.c].nome}</b><small>${e.t} · ${e.n} pessoas${e.dom>=0?`, ${e.pct}% ${segLabel(e.dom)}`:''} · esperado ${pc(e.exp)} · 2ª opção ${CRE[e.runner].nome}</small></div></li>`).join(''):'<li><div>Aguardando as primeiras trocas…</div></li>';
}
const ch=$('chart'),cx=ch.getContext('2d');
function renderChart(){
  const r=ch.getBoundingClientRect(),w=Math.max(260,r.width),h=210,d=Math.min(2,window.devicePixelRatio||1);
  if(ch.width!==Math.round(w*d)){ch.width=Math.round(w*d);ch.height=Math.round(h*d);}
  cx.setTransform(d,0,0,d,0,0);cx.clearRect(0,0,w,h);
  const L=36,Rr=104,T=18,Bt=26,pw=w-L-Rr,ph=h-T-Bt,ink=css('--ink'),mut=css('--muted'),line=css('--line'),acc=css('--accent');
  const y=v=>T+ph*(1-(v-.3)/.75);
  cx.font='11px "DM Mono",monospace';cx.textBaseline='middle';
  [.4,.6,.8,1].forEach(v=>{cx.strokeStyle=line;cx.lineWidth=1;cx.beginPath();cx.moveTo(L,y(v));cx.lineTo(L+pw,y(v));cx.stroke();cx.fillStyle=mut;cx.textAlign='right';cx.fillText(Math.round(v*100)+'%',L-6,y(v));});
  const A=effSeries(0),R=effSeries(1),n=Math.max(A.length,96),x=k=>L+pw*(k/(n-1));
  cx.setLineDash([4,4]);cx.strokeStyle=ink;cx.globalAlpha=.55;cx.beginPath();cx.moveTo(L,y(1));cx.lineTo(L+pw,y(1));cx.stroke();cx.setLineDash([]);cx.globalAlpha=1;
  cx.fillStyle=mut;cx.textAlign='left';cx.textAlign='right';cx.fillText('oráculo',L+pw,y(1)-8);cx.textAlign='left';
  const plot=(s,col,wd)=>{if(s.length<2)return;cx.strokeStyle=col;cx.lineWidth=wd;cx.lineJoin='round';cx.beginPath();s.forEach((v,k)=>{k?cx.lineTo(x(k),y(clamp(v,.3,1.05))):cx.moveTo(x(k),y(clamp(v,.3,1.05)));});cx.stroke();
    const k=s.length-1;cx.fillStyle=col;cx.beginPath();cx.arc(x(k),y(clamp(s[k],.3,1.05)),3.5,0,6.3);cx.fill();};
  plot(R,mut,2);plot(A,acc,2.6);
  cx.textAlign='left';
  if(A.length){cx.fillStyle=acc;cx.fillText('algoritmo '+Math.round(A[A.length-1]*100)+'%',x(A.length-1)+8,y(clamp(A[A.length-1],.3,1)) - (R.length&&Math.abs(A[A.length-1]-R[R.length-1])<.06?7:0));}
  if(R.length){cx.fillStyle=mut;cx.fillText('rotação '+Math.round(R[R.length-1]*100)+'%',x(R.length-1)+8,y(clamp(R[R.length-1],.3,1))+(A.length&&Math.abs(A[A.length-1]-R[R.length-1])<.06?7:0));}
  if(!A.length){cx.fillStyle=mut;cx.textAlign='center';cx.fillText('reunindo as primeiras 3 horas de dados…',L+pw/2,T+ph/2);}
  cx.fillStyle=mut;cx.textAlign='center';
  const total=n; for(let dd=0;dd*96+72<total+12;dd++){const k=dd*96+72-12;if(k<0||k>=total)continue;cx.fillText(DIAS[(dd+1)%7],x(k),h-9);}
  cx.textAlign='left';cx.fillText('Seg 06h',L,h-9);
}
let lastUI=0,lastHeat=0;
function renderUI(now){
  renderKPIs();renderLegend();renderPanel();renderLog();renderChart();renderDrawer(false);
  if(now-lastHeat>900){renderHeat();renderNet();lastHeat=now;}
}
