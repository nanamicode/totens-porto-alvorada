'use strict';
/* Comparar duas configurações: roda as mesmas cidades (mesmas sementes, mesma audiência) com duas configurações do
   algoritmo e mostra, semente por semente, quem rende mais. A estatística está em comparacao.js, testada no Node.
   A simulação ao vivo fica parada durante a execução e volta como estava. */
let ultimaComparacao=null;
const LADOS=['A','B'];

function rotuloPreset(id){return id==='atual'?'Configuração atual (menu Cálculos)':id==='pers'?'Personalizada':Comparacao.PRESETS.find(p=>p.id===id).nome;}

function montarLado(letra,presetInicial){
  const el=$('cmp'+letra);
  const opcoes=Comparacao.PRESETS.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('')+'<option value="atual">Configuração atual (menu Cálculos)</option><option value="pers" hidden>Personalizada</option>';
  const campos=Comparacao.CAMPOS.map(c=>c.sim
    ?`<label>${c.nome}<select data-k="${c.k}"><option value="0">Não</option><option value="1">Sim</option></select></label>`
    :`<label>${c.nome}<input type="number" data-k="${c.k}" min="${c.min}" max="${c.max}" step="${c.step}"></label>`).join('');
  el.innerHTML=`<h3><b>${letra}</b> Configuração ${letra}</h3><label class="cmp-receita">Receita <select data-preset>${opcoes}</select></label><div class="cmp-params">${campos}</div>`;
  const sel=el.querySelector('[data-preset]');
  sel.addEventListener('change',()=>escolherPreset(letra,sel.value));
  el.querySelectorAll('[data-k]').forEach(i=>i.addEventListener('input',()=>{sel.value='pers';}));
  escolherPreset(letra,presetInicial);
}

function paramsDoAtual(){const p={};Comparacao.CAMPOS.forEach(c=>{p[c.k]=PRM[c.k];});return p;}

function escolherPreset(letra,id){
  const el=$('cmp'+letra);
  const params=id==='atual'?Comparacao.paramsDe(paramsDoAtual()):Comparacao.paramsDe((Comparacao.PRESETS.find(p=>p.id===id)||{params:{}}).params);
  el.querySelector('[data-preset]').value=id;
  el.querySelectorAll('[data-k]').forEach(i=>{i.value=params[i.dataset.k];});
}

/* lê os campos do lado, limitando cada valor à faixa permitida */
function lerLado(letra){
  const p={};
  $('cmp'+letra).querySelectorAll('[data-k]').forEach(i=>{
    const c=Comparacao.CAMPOS.find(x=>x.k===i.dataset.k),v=Number(i.value);
    p[c.k]=Number.isFinite(v)?clamp(v,c.min,c.max):Comparacao.PADRAO[c.k];
    i.value=p[c.k];
  });
  return p;
}

/* opt: sementes, passos, cfg {A,B}, horario, desgaste, aoProgredir(fração, semente, lado) */
async function rodarComparacao(opt){
  const salvo={S,brain,rW,rB,sel,playing,prm:Object.assign({},PRM),tm:CRE.map(c=>c.tm)};
  emLote=true;cancelarLote=false;sel=-1;playing=false;
  const res={A:[],B:[]};
  try{
    if(opt.horario!==1)CRE.forEach((cr,k)=>{const f=salvo.tm[k];cr.tm=h=>1+opt.horario*(f(h)-1);});
    const total=opt.sementes*2;let feito=0;
    for(let seed=1;seed<=opt.sementes&&!cancelarLote;seed++){
      for(const L of LADOS){
        Object.assign(PRM,opt.cfg[L]);
        init(seed);
        if(opt.desgaste!==1)S.totems.forEach(t=>{t.r*=opt.desgaste;});
        let k=0;
        while(k<opt.passos&&!cancelarLote){
          const t0=performance.now();
          while(k<opt.passos&&performance.now()-t0<30){step();k++;}
          if(opt.aoProgredir)opt.aoProgredir((feito+k/opt.passos)/total,seed,L);
          await new Promise(r=>setTimeout(r,0));
        }
        if(cancelarLote)break;
        const r=resumoDaSemente(seed,resumirMundo());
        res[L].push(Object.assign(r,{custo:salvo.prm.cpm*r.olhares/1000/r.interacoes}));
        feito++;
      }
    }
  }finally{
    S=salvo.S;brain=salvo.brain;rW=salvo.rW;rB=salvo.rB;sel=salvo.sel;
    Object.assign(PRM,salvo.prm);CRE.forEach((cr,k)=>{cr.tm=salvo.tm[k];});
    emLote=false;setPlaying(salvo.playing);
  }
  return res;
}

const pts=(x,sinal)=>(sinal&&x>=0?'+':'')+f2(x*100,2)+' pontos';
const reais=(x,sinal)=>(sinal&&x>=0?'+':'')+'R$ '+f2(x,3);

function desenharGraficoComparacao(){
  const cv=$('chCmp');if(!cv||!ultimaComparacao)return;
  const P=ultimaComparacao.P,n=P.n;
  const r=cv.getBoundingClientRect(),w=Math.max(260,r.width),h=210,d=Math.min(2,window.devicePixelRatio||1);
  cv.width=Math.round(w*d);cv.height=Math.round(h*d);
  const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
  const ink=css('--ink'),mut=css('--muted'),line=css('--line'),cA=css('--amber'),cB=css('--accent');
  const L=46,R=16,T=14,B=26,pw=w-L-R,ph=h-T-B;
  const todos=P.ganho.a.concat(P.ganho.b),lo=Math.min(...todos)-.02,hi=Math.max(...todos)+.02;
  const y=v=>T+ph*(1-(v-lo)/(hi-lo)),x=k=>L+pw*(n>1?k/(n-1):.5);
  c.font='11px "JetBrains Mono",monospace';c.textBaseline='middle';
  const passo=[.01,.02,.05,.1].find(p=>(hi-lo)/p<=6)||.1;
  for(let v=Math.ceil(lo/passo)*passo;v<=hi;v+=passo){
    c.strokeStyle=line;c.lineWidth=1;c.beginPath();c.moveTo(L,y(v));c.lineTo(L+pw,y(v));c.stroke();
    c.fillStyle=mut;c.textAlign='right';c.fillText((v*100).toFixed(0)+'%',L-6,y(v));
  }
  [[P.ganho.A.media,cA],[P.ganho.B.media,cB]].forEach(([m,cor])=>{
    c.strokeStyle=cor;c.lineWidth=1.6;c.setLineDash([5,4]);c.beginPath();c.moveTo(L,y(m));c.lineTo(L+pw,y(m));c.stroke();c.setLineDash([]);
  });
  for(let k=0;k<n;k++){
    c.strokeStyle=mut;c.lineWidth=1.4;c.beginPath();c.moveTo(x(k),y(P.ganho.a[k]));c.lineTo(x(k),y(P.ganho.b[k]));c.stroke();
    c.lineWidth=2.2;c.strokeStyle=cA;c.fillStyle=css('--panel');c.beginPath();c.arc(x(k),y(P.ganho.a[k]),4.6,0,6.3);c.fill();c.stroke();
    c.fillStyle=cB;c.beginPath();c.arc(x(k),y(P.ganho.b[k]),4.6,0,6.3);c.fill();
    c.fillStyle=mut;c.textAlign='center';c.fillText(String(k+1),x(k),h-9);
  }
}

function renderComparacao(){
  const el=$('cmpRes');if(!ultimaComparacao)return;
  const {P,desc,seg}=ultimaComparacao,C=Comparacao;
  const sg=v=>(v>=0?'+':'')+pc(v);
  const card=(L,cor)=>{
    const g=P.ganho[L],e=P.efAlgoritmo[L],cu=P.custo[L],ac=P.acertos[L];
    return `<div class="cmp-card"><h3><i style="background:${cor}"></i>${L} · ${desc[L]}</h3>
      <dl><dt>Ganho sobre a rotação</dt><dd><b>${sg(g.media)}</b> <small>IC95% ${sg(g.media-g.meia)} a ${sg(g.media+g.meia)}</small></dd>
      <dt>Eficiência</dt><dd>${pc(e.media)}</dd>
      <dt>Custo por interação</dt><dd>R$ ${f2(cu.media,3)}</dd>
      <dt>Perfis certos</dt><dd>${f2(ac.media,1)} de 8</dd></dl></div>`;
  };
  const dg=P.ganho.dif,de=P.efAlgoritmo.dif,dc=P.custo.dif,da=P.acertos.dif;
  const linhas=P.ganho.a.map((a,k)=>`<tr><td>${k+1}</td><td>${sg(a)}</td><td>${sg(P.ganho.b[k])}</td><td>${pts(P.ganho.b[k]-a,true)}</td></tr>`);
  linhas.push(`<tr class="pick"><td>Média</td><td>${sg(P.ganho.A.media)}</td><td>${sg(P.ganho.B.media)}</td><td>${pts(dg.media,true)}</td></tr>`);
  el.innerHTML=`
    <p class="lote-sum"><b>${C.frase(dg,pts)}</b></p>
    <p class="hint">${P.n} sementes de ${f2(ultimaComparacao.passos/120,0)} h simuladas · ${ultimaComparacao.diferem} · levou ${f2(seg,0)} s. Cada semente roda as duas configurações com a mesma audiência.</p>
    <div class="cmp-cards">
      ${card('A',css('--amber'))}${card('B',css('--accent'))}
      <div class="cmp-card dif"><h3>B − A</h3>
        <dl><dt>Ganho</dt><dd><b>${pts(dg.media,true)}</b> <small>± ${f2(dg.ep*100,2)}</small></dd>
        <dt>Eficiência</dt><dd>${pts(de.media,true)} <small>± ${f2(de.ep*100,2)}</small></dd>
        <dt>Custo por interação</dt><dd>${reais(dc.media,true)} <small>± ${f2(dc.ep,3)}</small></dd>
        <dt>Perfis certos</dt><dd>${(da.media>=0?'+':'')+f2(da.media,2)} <small>± ${f2(da.ep,2)}</small></dd>
        <dt>Semente a semente</dt><dd>B à frente em ${dg.melhorB}, A em ${dg.piorB}${dg.iguais?`, ${dg.iguais} iguais`:''}</dd></dl></div>
    </div>
    <canvas id="chCmp" role="img" aria-label="Ganho de A e de B em cada semente, ligados por uma linha"></canvas>
    <p class="hint"><span style="color:var(--amber)">○ A</span> · <span style="color:var(--accent)">● B</span> · cada coluna é uma semente, a linha liga A a B e as tracejadas são as médias.</p>
    <div class="tablewrap">${table(['Semente','Ganho A','Ganho B','B − A'],linhas)}</div>`;
  desenharGraficoComparacao();
  $('btnCmpCsv').hidden=false;
}

async function iniciarComparacao(){
  if(emLote)return;
  const cfg={A:lerLado('A'),B:lerLado('B')};
  const sementes=+$('cmpSem').value,passos=+$('cmpDur').value*120,horario=+$('cmpHor').value,desgaste=+$('cmpDes').value;
  $('btnCmp').disabled=true;$('btnCmpCancel').hidden=false;$('btnCmpCsv').hidden=true;
  ['cmpSem','cmpDur','cmpHor','cmpDes'].forEach(id=>{$(id).disabled=true;});
  const prog=$('cmpProg');prog.hidden=false;prog.value=0;$('cmpMsg').textContent='Preparando…';
  const t0=performance.now();
  const res=await rodarComparacao({sementes,passos,cfg,horario,desgaste,aoProgredir:(f,seed,L)=>{
    prog.value=f;$('cmpMsg').textContent=`Semente ${seed} de ${sementes}, configuração ${L} · ${Math.round(f*100)}%. A simulação ao vivo fica parada até terminar.`;
  }});
  prog.hidden=true;$('btnCmp').disabled=false;$('btnCmpCancel').hidden=true;
  ['cmpSem','cmpDur','cmpHor','cmpDes'].forEach(id=>{$(id).disabled=false;});
  const n=Math.min(res.A.length,res.B.length);
  if(n<2){$('cmpMsg').textContent=cancelarLote?'Cancelado. Rode pelo menos 2 sementes completas para comparar.':'Sem resultado.';return;}
  $('cmpMsg').textContent=cancelarLote?`Cancelado depois de ${n} sementes completas.`:'';
  const P=Comparacao.pareadas(res.A,res.B);
  const dif=Comparacao.diferencas(cfg.A,cfg.B);
  const mundo=[];
  if(horario!==1)mundo.push(`horário ×${horario}`);
  if(desgaste!==1)mundo.push(`desgaste ×${f2(desgaste,1)}`);
  for(const k of Object.keys(EV))if(EV[k])mundo.push(EVN[k]);
  CON.forEach((x,c)=>{if(!x)mundo.push(`${CRE[c].nome} pausada`);});
  ultimaComparacao={P,passos,seg:(performance.now()-t0)/1000,
    desc:{A:rotuloPreset($('cmpA').querySelector('[data-preset]').value),B:rotuloPreset($('cmpB').querySelector('[data-preset]').value)},
    diferem:(dif.length?'diferem em '+dif.map(d=>`${d.k} ${d.a} → ${d.b}`).join(', '):'configurações iguais')+(mundo.length?' · mundo: '+mundo.join(', '):''),
    cfg,resultados:res};
  renderComparacao();renderUI(performance.now());
}

function csvDaComparacao(){
  const {P}=ultimaComparacao,x=(v,d=4)=>Number(v).toFixed(d);
  const A=ultimaComparacao.resultados.A,B=ultimaComparacao.resultados.B;
  return 'semente,ganho_A,ganho_B,diferenca,eficiencia_A,eficiencia_B,custo_A,custo_B\n'+
    P.ganho.a.map((g,k)=>[k+1,x(g),x(P.ganho.b[k]),x(P.ganho.b[k]-g),x(A[k].efAlgoritmo),x(B[k].efAlgoritmo),x(A[k].custo),x(B[k].custo)].join(',')).join('\n')+'\n';
}

montarLado('A','padrao');montarLado('B','sem-compartilhar');
$('btnCmp').addEventListener('click',iniciarComparacao);
$('btnCmpCancel').addEventListener('click',()=>{cancelarLote=true;});
$('btnCmpCsv').addEventListener('click',()=>{if(ultimaComparacao)copyText(csvDaComparacao(),$('cmpCsvArea'));});
window.addEventListener('resize',()=>desenharGraficoComparacao());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>setTimeout(desenharGraficoComparacao,60));
