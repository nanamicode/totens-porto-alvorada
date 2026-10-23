'use strict';
/* Várias sementes: roda N cidades novas com a configuração de agora e mostra o ganho médio e a variação.
   A simulação ao vivo fica parada durante a execução e volta exatamente como estava.
   As sementes são 1 a N, as mesmas de `npm run avaliar`, então os números batem. */
let emLote=false,cancelarLote=false,ultimoLote=null;

const estat=v=>{
  const n=v.length,media=v.reduce((a,b)=>a+b,0)/n;
  const dp=n>1?Math.sqrt(v.reduce((a,b)=>a+(b-media)**2,0)/(n-1)):0;
  return {n,media,dp,min:Math.min(...v),max:Math.max(...v),meia:n>1?1.96*dp/Math.sqrt(n):0};
};

function resumoDaSemente(seed,r){
  const [alg,rot,orc]=r.interacoes;
  return {seed,ganho:alg/rot-1,efAlgoritmo:alg/orc,efRotacao:rot/orc,
    acertos:r.melhor.filter((c,s)=>c===r.verdade[s]).length,perfis:r.melhor.length,olhares:r.olhares};
}

/* opt.sementes, opt.passos (spots de 30 s), opt.aoProgredir(fração, semente atual) */
async function rodarLote(opt){
  const salvo={S,brain,rW,rB,sel,playing};
  emLote=true;cancelarLote=false;sel=-1;playing=false;
  const linhas=[];
  try{
    for(let seed=1;seed<=opt.sementes&&!cancelarLote;seed++){
      init(seed);
      let k=0;
      while(k<opt.passos&&!cancelarLote){
        const t0=performance.now();
        while(k<opt.passos&&performance.now()-t0<30){step();k++;}
        if(opt.aoProgredir)opt.aoProgredir((seed-1+k/opt.passos)/opt.sementes,seed);
        await new Promise(r=>setTimeout(r,0));
      }
      if(!cancelarLote)linhas.push(resumoDaSemente(seed,resumirMundo()));
    }
  }finally{
    S=salvo.S;brain=salvo.brain;rW=salvo.rW;rB=salvo.rB;sel=salvo.sel;
    emLote=false;setPlaying(salvo.playing);
  }
  return linhas;
}

/* o que está diferente do padrão, para o resultado dizer com que configuração foi obtido */
function descricaoDaConfiguracao(){
  const partes=[];
  for(const k of Object.keys(DEF))if(PRM[k]!==DEF[k])partes.push(`${k}=${PRM[k]}`);
  for(const k of Object.keys(EV))if(EV[k])partes.push(EVN[k]);
  CON.forEach((x,c)=>{if(!x)partes.push(`${CRE[c].nome} pausada`);});
  return partes.length?partes.join(' · '):'padrão';
}

function desenharGraficoSementes(){
  const cv=$('chSem');if(!cv||!ultimoLote)return;
  const linhas=ultimoLote.linhas,g=linhas.map(l=>l.ganho),e=estat(g);
  const r=cv.getBoundingClientRect(),w=Math.max(260,r.width),h=200,d=Math.min(2,window.devicePixelRatio||1);
  cv.width=Math.round(w*d);cv.height=Math.round(h*d);
  const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
  const ink=css('--ink'),mut=css('--muted'),line=css('--line'),acc=css('--accent');
  const L=44,R=16,T=14,B=26,pw=w-L-R,ph=h-T-B;
  const lo=Math.min(e.min,e.media-e.meia)-.02,hi=Math.max(e.max,e.media+e.meia)+.02;
  const y=v=>T+ph*(1-(v-lo)/(hi-lo)),x=k=>L+pw*(linhas.length>1?k/(linhas.length-1):.5);
  c.font='11px "DM Mono",monospace';c.textBaseline='middle';
  const passo=[.005,.01,.02,.05,.1].find(p=>(hi-lo)/p<=6)||.1;
  for(let v=Math.ceil(lo/passo)*passo;v<=hi;v+=passo){
    c.strokeStyle=line;c.lineWidth=1;c.beginPath();c.moveTo(L,y(v));c.lineTo(L+pw,y(v));c.stroke();
    c.fillStyle=mut;c.textAlign='right';c.fillText((v*100).toFixed(passo<.01?1:0)+'%',L-6,y(v));
  }
  c.globalAlpha=.18;c.fillStyle=acc;c.fillRect(L,y(e.media+e.meia),pw,y(e.media-e.meia)-y(e.media+e.meia));c.globalAlpha=1;
  c.strokeStyle=acc;c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.moveTo(L,y(e.media));c.lineTo(L+pw,y(e.media));c.stroke();c.setLineDash([]);
  linhas.forEach((l,k)=>{
    c.fillStyle=ink;c.beginPath();c.arc(x(k),y(l.ganho),4.2,0,6.3);c.fill();
    c.fillStyle=mut;c.textAlign='center';c.fillText(String(l.seed),x(k),h-9);
  });
  if(ultimoLote.aoVivo!=null){
    c.strokeStyle=mut;c.lineWidth=1;c.setLineDash([2,3]);c.beginPath();c.moveTo(L,y(ultimoLote.aoVivo));c.lineTo(L+pw,y(ultimoLote.aoVivo));c.stroke();c.setLineDash([]);
  }
}

function renderSementes(){
  const el=$('loteRes');if(!ultimoLote)return;
  const {linhas,passos,config,aoVivo,segundos}=ultimoLote;
  const g=estat(linhas.map(l=>l.ganho)),ea=estat(linhas.map(l=>l.efAlgoritmo)),er=estat(linhas.map(l=>l.efRotacao)),ac=estat(linhas.map(l=>l.acertos));
  const sg=v=>(v>=0?'+':'')+pc(v);
  const rows=linhas.map(l=>`<tr><td>${l.seed}</td><td>${sg(l.ganho)}</td><td>${pc(l.efAlgoritmo)}</td><td>${pc(l.efRotacao)}</td><td>${l.acertos}/${l.perfis}</td><td>${fmt(l.olhares)}</td></tr>`);
  rows.push(`<tr class="pick"><td>Média</td><td>${sg(g.media)}</td><td>${pc(ea.media)}</td><td>${pc(er.media)}</td><td>${f2(ac.media,1)}/${linhas[0].perfis}</td><td></td></tr>`);
  el.innerHTML=`
    <p class="lote-sum"><b>Ganho médio ${sg(g.media)}</b> sobre a rotação fixa, com intervalo de 95% da média de ${sg(g.media-g.meia)} a ${sg(g.media+g.meia)}.
      Entre as ${g.n} sementes, o desvio é de ${f2(g.dp*100,1)} ponto, e o ganho vai de ${sg(g.min)} a ${sg(g.max)}.</p>
    <p class="hint">${g.n} sementes de ${f2(passos/120,0)} h simuladas · configuração: ${config} · levou ${f2(segundos,0)} s${aoVivo!=null?` · a simulação ao vivo está em ${sg(aoVivo)} (linha pontilhada)`:''}.</p>
    <canvas id="chSem" role="img" aria-label="Ganho de cada semente, com a média e o intervalo de 95%"></canvas>
    <p class="hint">Cada ponto é uma semente. A linha tracejada é a média e a faixa é o intervalo de 95% da média.</p>
    <div class="tablewrap">${table(['Semente','Ganho','Eficiência algoritmo','Eficiência rotação','Melhor criativo certo','Olhares'],rows)}</div>`;
  desenharGraficoSementes();
  $('btnLoteCsv').hidden=false;
}

async function iniciarLote(){
  if(emLote)return;
  const sementes=+$('selSem').value,horas=+$('selDur').value,passos=horas*120;
  $('btnLote').disabled=true;$('btnLoteCancel').hidden=false;$('btnLoteCsv').hidden=true;
  $('selSem').disabled=true;$('selDur').disabled=true;
  const prog=$('loteProg');prog.hidden=false;prog.value=0;
  const aoVivo=S.tot.e[1]>0&&S.tot.v>2000?S.tot.e[0]/S.tot.e[1]-1:null;
  const config=descricaoDaConfiguracao(),t0=performance.now();
  $('loteMsg').textContent='Preparando…';
  const linhas=await rodarLote({sementes,passos,aoProgredir:(f,seed)=>{
    prog.value=f;$('loteMsg').textContent=`Semente ${seed} de ${sementes} · ${Math.round(f*100)}%. A simulação ao vivo fica parada até terminar.`;
  }});
  prog.hidden=true;$('btnLote').disabled=false;$('btnLoteCancel').hidden=true;$('selSem').disabled=false;$('selDur').disabled=false;
  if(linhas.length<2){$('loteMsg').textContent=cancelarLote?'Cancelado. Rode pelo menos 2 sementes para ver a variação.':'Sem resultado.';return;}
  $('loteMsg').textContent=cancelarLote?`Cancelado depois de ${linhas.length} sementes.`:'';
  ultimoLote={linhas,passos,config,aoVivo,segundos:(performance.now()-t0)/1000};
  renderSementes();renderUI(performance.now());
}

function csvDoLote(){
  const l=ultimoLote.linhas,x=(v,d=4)=>Number(v).toFixed(d);
  return 'semente,ganho,eficiencia_algoritmo,eficiencia_rotacao,perfis_certos,perfis,olhares\n'+
    l.map(r=>[r.seed,x(r.ganho),x(r.efAlgoritmo),x(r.efRotacao),r.acertos,r.perfis,r.olhares].join(',')).join('\n')+'\n';
}

$('btnLote').addEventListener('click',iniciarLote);
$('btnLoteCancel').addEventListener('click',()=>{cancelarLote=true;});
$('btnLoteCsv').addEventListener('click',()=>{if(ultimoLote)copyText(csvDoLote(),$('loteCsvArea'));});
window.addEventListener('resize',()=>desenharGraficoSementes());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>setTimeout(desenharGraficoSementes,60));
