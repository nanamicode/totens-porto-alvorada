'use strict';
/* Menu de cálculos: último spot, posterior, zonas, registro, fórmulas e parâmetros. */
/* ---------- Menu de cálculos ---------- */
const drawer=$('drawer'),TABS=['spot','post','zonas','log','eventos','formulas','params'];
let tab='spot',lastDraw=0;
const n2=(x,d=2)=>f2(x,d);
const dotName=c=>`<i class="dot" style="background:${CRE[c].cor}"></i>${CRE[c].nome}`;
function table(head,rows,cls=''){return `<div class="tablewrap"><table class="ct ${cls}"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
function setPlaying(v){playing=v;$('btnPlay').textContent=v?'Pausar':'Continuar';$('dPause').textContent=v?'Pausar':'Continuar';}
function openDrawer(open){drawer.hidden=!open;if(open)setPlaying(false);$('btnCalc').setAttribute('aria-expanded',String(open));if(open){syncDrawerSel();renderDrawer(true);}}
function syncDrawerSel(){const d=$('dSel');if(!d.options.length)d.innerHTML=$('selTotem').innerHTML;d.value=sel;}

let spotKey='';
function renderSpot(force){
  const arr=S.traces,el=$('spotBody');
  if(!arr.length){el.innerHTML='<p class="hint">Aguardando o próximo spot do totem selecionado. Com a simulação pausada, use “+1 spot”.</p>';$('trPos').textContent='–';return;}
  let idx=viewStep==null?arr.length-1:arr.findIndex(x=>x.id===viewStep);if(idx<0)idx=0;
  const tr=arr[idx];
  const key=tr.id+'|'+JSON.stringify(PRM);
  $('trPos').textContent=`${tr.stamp} · spot ${idx+1}/${arr.length}${viewStep==null?' · ao vivo':''}`;
  if(key===spotKey&&!force)return;
  spotKey=key;
  $('trPos').textContent=`${tr.stamp} · spot ${idx+1}/${arr.length}${viewStep==null?' · ao vivo':''}`;
  const N=tr.N,tot=N>0?N:1,auds=[];
  for(let s=0;s<NS;s++)if(tr.cells[s])auds.push(s);
  auds.sort((a,b)=>(N>0?tr.ne[b]-tr.ne[a]:tr.w[b]-tr.w[a]));
  let h='';
  h+=`<section class="calc"><h3><b>1</b>Chegada de pessoas</h3><pre>${tr.tot} · ${tr.zona} · ${tr.stamp}${tr.we?' (fim de semana)':''}
λ = escala_totem × 13 × (perfil_zona(hora) + 0,03) × evento
  = ${n2(tr.scale)} × 13 × (${n2(tr.prof)} + 0,03) × ${n2(tr.ev)} = ${n2(tr.lam)} olhares por spot de 30 s
N ~ Poisson(${n2(tr.lam)})  →  N = ${N}${N===0?'  (ninguém olhando: o algoritmo usa o perfil esperado deste horário como audiência)':''}</pre></section>`;
  h+=`<section class="calc"><h3><b>2</b>Câmera: perfil verdadeiro contra o que ela estimou</h3>${table(['Perfil','Verdadeiro','Câmera viu','Diferença'],
    Array.from({length:NS},(_,s)=>`<tr><td>${segLabel(s)}</td><td>${tr.nt[s]}</td><td>${tr.ne[s]}</td><td>${tr.ne[s]-tr.nt[s]>0?'+':''}${tr.ne[s]-tr.nt[s]}</td></tr>`))}
    <p class="hint">Acerto configurado: ${pc(PRM.acc,0)} por faixa etária. Neste spot a câmera errou ${tr.err} de ${N} classificações. O algoritmo só vê a coluna “Câmera viu”.</p></section>`;
  h+=`<section class="calc"><h3><b>3</b>Priors hierárquicos e Beta de cada perfil × criativo</h3><pre>μ_rede = (a_rede + 0,2) / (n_rede + 10)
μ_zona = (a_zona + K_zona·μ_rede) / (n_zona + K_zona)          K_zona = ${PRM.kz}
a = a_totem + K_totem·μ_zona
b = (n_totem − a_totem) + K_totem·(1 − μ_zona)                 K_totem = ${PRM.kt}
θ ~ Beta(a, b)     (aproximação normal quando a + b > 60)</pre>`;
  auds.forEach((s,k)=>{
    const rows=tr.cells[s].map((c,ci)=>`<tr${ci===tr.choice?' class="pick"':''}><td>${dotName(ci)}</td><td>${pc(c.gm,2)}</td><td>${fmt(c.gn)}</td><td>${pc(c.zm,2)}</td><td>${fmt(c.zn)}</td><td>${n2(c.a)}</td><td>${n2(c.b)}</td><td>${pc(c.a/(c.a+c.b),2)}</td><td>${pc(c.th,2)}</td><td>${n2((N>0?tr.ne[s]:tr.w[s])*c.th,3)}</td></tr>`);
    h+=`<details class="sd"${k<2?' open':''}><summary>${segLabel(s)} · n_s = ${N>0?tr.ne[s]:n2(tr.w[s],3)}${N===0?' (esperado)':''}</summary>${table(['Criativo','μ rede','n rede','μ zona','n zona','a','b','média','θ sorteado','n_s·θ'],rows)}</details>`;
  });
  h+='</section>';
  h+=`<section class="calc"><h3><b>4</b>Pontuação e escolha (Thompson Sampling)</h3><pre>score_c = ( Σ_s n_s·θ_s,c / N ) × f̂_c × m_c,período            f̂_c = 0,35 + 0,65·exp(−r̂·E_c / 600)      r̂ do totem = ${n2(tr.rEst)}
período do dia: ${PERIODOS[tr.per]??'–'}${PRM.contexto?'':'  (contexto de horário desligado: m = 1)'}
escolhido = argmax score_c = ${CRE[tr.choice].nome}   (esperado ${pc(tr.exp,2)})</pre>
    ${table(['Criativo','Σ n_s·θ','÷ N','Exposição E','Desgaste f̂','Horário m','Score'],tr.raw.map((r,c)=>`<tr class="${c===tr.choice?'pick':c===tr.runner?'alt':''}"><td>${dotName(c)}${c===tr.choice?' ✔':c===tr.runner?' (2ª)':''}</td><td>${n2(r,3)}</td><td>${pc(r/tot,2)}</td><td>${fmt(tr.E[c])}</td><td>${n2(tr.fe[c],3)}</td><td>${n2(tr.mult[c],3)}</td><td>${pc(tr.v[c],2)}</td></tr>`))}</section>`;
  h+=`<section class="calc"><h3><b>5</b>Referências: rotação fixa e oráculo</h3><pre>rotação: criativo = (spot + 3·índice_totem) mod nº de campanhas ativas  →  ${CRE[tr.rot].nome}
oráculo: usa a taxa verdadeira e a audiência verdadeira, com desgaste projetado ${PRM.look} spots à frente  →  ${CRE[tr.orc].nome}</pre>
    ${table(['Criativo','Taxa esperada do oráculo','Desgaste projetado'],tr.oV.map((v,c)=>`<tr class="${c===tr.orc?'pick':''}"><td>${dotName(c)}${c===tr.orc?' ✔':''}</td><td>${pc(v,2)}</td><td>${n2(tr.oF[c],3)}</td></tr>`))}</section>`;
  const pn=['Algoritmo','Rotação fixa','Oráculo'];
  h+=`<section class="calc"><h3><b>6</b>Resultado do spot</h3><pre>p = taxa_base(criativo, perfil real, zona, hora) × desgaste_real(r=${n2(tr.r)}, E)
interação  ⇔  u < p        (o mesmo sorteio u vale para os três, então a comparação é justa)</pre>
    ${table(['Política','Criativo','Desgaste real','Interações'],tr.out.map((o,p)=>`<tr><td>${pn[p]}</td><td>${dotName(o.c)}</td><td>${n2(o.f,3)}</td><td>${o.hits}</td></tr>`))}
    ${tr.rows.length?table(['Pessoa','Perfil real','Câmera viu','u','p (algoritmo)','Resultado'],tr.rows.map((r,k)=>`<tr><td>#${k+1}</td><td>${segLabel(r.ts)}</td><td>${segLabel(r.us)}${r.us!==r.ts?' ✗':''}</td><td>${n2(r.u,3)}</td><td>${pc(r.p,2)}</td><td class="${r.hit?'hit':'miss'}">${r.hit?'interagiu':'ignorou'}</td></tr>`)):''}</section>`;
  const ks=Object.keys(tr.upd);
  h+=`<section class="calc"><h3><b>7</b>Aprendizado depois do spot</h3><pre>para cada pessoa: n[perfil visto pela câmera, criativo] += 1 ;  a[...] += ${PRM.corrige||PRM.contexto?'1/('+(PRM.corrige?'f̂':'1')+(PRM.contexto?'·m':'')+') (a taxa sem desgaste'+(PRM.contexto?' e sem efeito do horário':'')+')':'1'} se interagiu
atualiza o totem, a zona e a rede ao mesmo tempo.  A cada hora: a, n ×= ${n2(PRM.forget,3)}</pre>
    ${ks.length?table(['Perfil visto','Criativo exibido','Olhares +n','Interações +a','Nova média do totem'],ks.map(s=>`<tr><td>${segLabel(+s)}</td><td>${dotName(tr.choice)}</td><td>+${tr.upd[s].n}</td><td>+${tr.upd[s].hit}${PRM.corrige&&tr.upd[s].hit?` (vale ${n2(tr.upd[s].a)})`:''}</td><td>${pc(tr.post[s][tr.choice],2)}</td></tr>`)):'<p class="hint">Sem olhares, sem aprendizado neste spot.</p>'}</section>`;
  el.innerHTML=h;
}
const PERIODOS=Array.from({length:8},(_,q)=>`${q*3}–${q*3+3}h`);
function renderPost(){
  const tt=S.totems[sel],lvl=$('postLvl').value,G=brain.cells.G,Zc=brain.cells.Z[tt.zi],T=brain.cells.T[sel];
  let mx=.001;const cell=[];
  for(let s=0;s<NS;s++){cell.push([]);for(let c=0;c<NC;c++){
    const k=s*NC+c,gm=brain.globalMean(s,c),zm=brain.zoneMean(tt.zi,s,c);
    let m,sd,n;
    if(lvl==='rede'){m=gm;n=G.n[k];sd=Math.sqrt(m*(1-m)/(n+10));}
    else if(lvl==='zona'){m=zm;n=Zc.n[k];sd=Math.sqrt(m*(1-m)/Math.max(n+PRM.kz,1));}
    else{const a=T.a[k]+PRM.kt*zm,b=T.n[k]-T.a[k]+PRM.kt*(1-zm);m=a/(a+b);sd=Math.sqrt(a*b/((a+b)*(a+b)*(a+b+1)));n=T.n[k];}
    cell[s].push({m,sd,n});if(m>mx)mx=m;}}
  const rows=cell.map((r,s)=>{let bi=0;r.forEach((x,c)=>{if(x.m>r[bi].m)bi=c;});
    return `<tr><td>${segLabel(s)}</td>${r.map((x,c)=>`<td style="background:color-mix(in srgb,var(--accent) ${Math.round(6+55*Math.pow(x.m/mx,1.6))}%,transparent);${c===bi?'font-weight:700;outline:2px solid var(--ink);outline-offset:-2px':''}">${pc(x.m,2)}<br><span style="color:var(--muted)">±${n2(x.sd*100,2)} · ${fmt(x.n)}</span></td>`).join('')}</tr>`;});
  $('postBody').innerHTML=table(['Perfil',...CRE.map(c=>`<i class="dot" style="background:${c.cor}"></i>${c.nome.split(' ')[0]}`)],rows)+
    `<p class="hint">Célula = média ± desvio · olhares acumulados (com esquecimento). Totem inspecionado: ${tt.nome}.</p>`+
    `<h3 class="mini">Efeito do horário aprendido, igual para toda a rede</h3>`+
    table(['Período',...CRE.map(c=>`<i class="dot" style="background:${c.cor}"></i>${c.nome.split(' ')[0]}`)],
      PERIODOS.map((p,q)=>`<tr><td>${p}</td>${CRE.map((_,c)=>{const m=brain.periodFactor(c,q);return `<td style="${m>1.08?'font-weight:700;color:var(--good)':m<.92?'color:var(--bad)':''}">×${n2(m,2)}</td>`;}).join('')}</tr>`))+
    `<p class="hint">Multiplica a taxa de cada criativo em cada período do dia. ${PRM.contexto?'':'O contexto de horário está desligado, então todos valem 1.'}</p>`;
}
function renderZonas(){
  const rows=ZONES.map((z,zi)=>{let v=0,e=[0,0,0],n=0;S.totems.forEach(t=>{if(t.zi===zi){n++;v+=t.views;for(let p=0;p<3;p++)e[p]+=t.eng[p];}});
    const g=e[1]>0?e[0]/e[1]-1:0;
    return `<tr><td>${z.nome}</td><td>${n}</td><td>${fmt(v)}</td><td>${per1k(e[0],v)}</td><td>${per1k(e[1],v)}</td><td>${per1k(e[2],v)}</td><td class="${g>=0?'hit':''}">${(g>=0?'+':'')+f2(g*100,0)}%</td></tr>`;});
  $('zonasBody').innerHTML=table(['Zona','Totens','Olhares','Algoritmo /1.000','Rotação /1.000','Oráculo /1.000','Ganho sobre rotação'],rows);
}
/* um campo por linha; os objetos de contagens ficam numa linha só */
function formatarEvento(e){
  const linhas=Eventos.CHAVES.map(k=>{
    const v=e[k],txt=typeof v==='object'?JSON.stringify(v).replace(/,"/g,', "').replace(/":/g,'": '):JSON.stringify(v);
    return `  "${k}": ${txt}`;
  });
  return ['{',linhas.join(',\n'),'}'].join('\n');
}
function renderEventos(){
  let l=EVENTOS.lista;
  if($('evSo').checked){const id=Eventos.idTotem(sel);l=l.filter(e=>e.totem===id);}
  const ult=l.slice(-40).reverse();
  const invalidos=ult.filter(e=>!Eventos.validar(e).ok).length;
  $('evInfo').textContent=`${fmt(EVENTOS.total)} eventos gerados · mostrando ${ult.length}, ${invalidos?invalidos+' inválidos':'todos válidos'}`;
  $('evUlt').textContent=ult.length?formatarEvento(ult[0]):'Sem eventos ainda. Continue a simulação ou use “+1 spot”.';
  $('evBox').innerHTML=ult.map(e=>`<div>${JSON.stringify(e)}</div>`).join('')||'<div>Sem eventos ainda.</div>';
}
function renderLogTab(){
  const on={dec:$('fDec').checked,troca:$('fTroca').checked,esq:$('fEsq').checked,marco:$('fMarco').checked};
  const box=$('logBox'),stick=box.scrollTop+box.clientHeight>=box.scrollHeight-40;
  box.innerHTML=S.lines.filter(l=>on[l.k]).slice(-220).map(l=>`<div class="${l.k}"><span class="t">${l.t}</span> <span class="k">${l.k}</span> ${l.x}</div>`).join('')||'<div>Sem registros ainda.</div>';
  if(stick)box.scrollTop=box.scrollHeight;
}
function renderFormulas(){
  $('tab-formulas').innerHTML=`
  <div class="fgroup"><h3>Mundo simulado (o que o algoritmo não vê)</h3><div class="formula">fluxo:       N ~ Poisson( escala × 13 × (perfil_zona(hora, fim de semana) + 0,03) × evento )
perfil:      w_s ∝ idade_zona × modificador_hora × gênero_zona          s = gênero × faixa etária (8 perfis)
câmera:      acerta a faixa com prob. ${pc(PRM.acc,0)}; erra para a faixa vizinha (75% dos erros) ou troca o gênero
taxa real:   p = base_c × afin_idade × afin_gênero × afin_zona × afin_hora        (máx. 9%)
desgaste:    f = 0,35 + 0,65·exp(−r·E / 600)            E = olhares recentes do criativo no totem, meia-vida de 150 min
interação:   u ~ U(0,1);  interagiu ⇔ u < p × f</div></div>
  <div class="fgroup"><h3>Cérebro: Thompson Sampling contextual hierárquico</h3><div class="formula">contexto:    perfil estimado pela câmera de cada pessoa em frente à tela
prior rede:  μ_rede = (a_rede + 0,2) / (n_rede + 10)
prior zona:  μ_zona = (a_zona + ${PRM.kz}·μ_rede) / (n_zona + ${PRM.kz})
posterior:   a = a_totem + ${PRM.kt}·μ_zona ;   b = (n_totem − a_totem) + ${PRM.kt}·(1 − μ_zona)
amostra:     θ_s,c ~ Beta(a, b)
audiência:   score_c = ( Σ_s n_s·θ_s,c / N ) × f̂_c × m_c,p ,     f̂_c = 0,35 + 0,65·exp(−r̂_totem·E_c / 600)
decisão:     c* = argmax_c score_c
aprendizado: n[s,c*] += 1 ; a[s,c*] += ${PRM.corrige||PRM.contexto?'1/('+(PRM.corrige?'f̂':'1')+(PRM.contexto?'·m':'')+')':'1'} se interagiu  (totem, zona e rede)${PRM.atraso>0?`
             com atraso de conversão: "interagiu" passa a ser "converteu"; ${PRM.espera>0?`n e a entram juntos, ${n2(PRM.espera,1)} × ${PRM.atraso} min depois da exibição (conversão que chega depois da janela não conta)`:'n entra na hora e a só quando a conversão chega'}`:''}
horário:     m_c,p = (H_c,p + ${PRM.kp}) / (X_c,p + ${PRM.kp}), normalizado para média 1 em cada criativo
             H = interações (corrigidas pelo desgaste), X = interações que a taxa média da rede previa, em 8 períodos de 3 h
desgaste:    ${PRM.estima?'r̂_totem = média a posteriori de r numa grade de 0 a 2, com prior centrado em '+n2(PRM.rest)+' e verossimilhança Π Bernoulli( interagiu | μ_rede(s,c)·f(E; r) )':'r̂ = '+n2(PRM.rest)+' para todos os totens'}
memória:     a, n ×= ${n2(PRM.forget,3)} a cada hora</div></div>
  <div class="fgroup"><h3>Referências e métrica</h3><div class="formula">rotação fixa: c = campanha ativa número (spot + 3·totem) mod nº de ativas
oráculo:      argmax_c Σ_s n_s,real·p_s,c × f(E_c + λ·${PRM.look}) , com a audiência e a taxa verdadeiras
eficiência:   Σ interações_política / Σ interações_oráculo , janela móvel de 3 h
ganho:        interações_algoritmo / interações_rotação − 1</div></div>`;
}
const PARAMS=[
  {k:'acc',l:'Acerto da câmera por faixa etária',min:.6,max:.99,step:.01,f:v=>pc(v,0),n:'Mundo simulado. Com menos acerto, o algoritmo aprende com rótulos mais ruidosos.'},
  {k:'kz',l:'Força do prior da zona (K_zona)',min:0,max:200,step:5,f:v=>v,n:'Quanto o conhecimento da rede pesa sobre o da zona. 0 = zona aprende sozinha.'},
  {k:'kt',l:'Força do prior do totem (K_totem)',min:0,max:200,step:5,f:v=>v,n:'Quanto o conhecimento da zona pesa sobre um totem novo. 0 = cada totem aprende sozinho.'},
  {k:'forget',l:'Fator de esquecimento por hora',min:.95,max:1,step:.001,f:v=>n2(v,3),n:'1,000 = nunca esquece. Valores menores acompanham mudanças, mas guardam menos dados.'},
  {k:'rest',l:'Desgaste assumido pelo algoritmo (r̂)',min:0,max:1,step:.05,f:v=>n2(v),n:'Valor fixo, ou prior da estimativa quando ela está ligada. 0 = ignora o desgaste.'},
  {k:'corrige',l:'Corrigir o aprendizado pelo desgaste',min:0,max:1,step:1,f:v=>v?'ligado':'desligado',n:'Ligado, cada interação vale 1/f nas contagens, que passam a medir a taxa sem desgaste.'},
  {k:'contexto',l:'Usar o período do dia como contexto',min:0,max:1,step:1,f:v=>v?'ligado':'desligado',n:'Ligado, o algoritmo aprende um multiplicador por criativo e período do dia (8 períodos de 3 h).'},
  {k:'estima',l:'Estimar o desgaste de cada totem',min:0,max:1,step:1,f:v=>v?'ligado':'desligado',n:'Ligado, o algoritmo ajusta r̂ de cada totem aos dados. Desligado, usa o valor fixo.'},
  {k:'atraso',l:'Atraso médio da conversão (minutos)',min:0,max:480,step:15,f:v=>v?v+' min':'desligado',n:'Ligado, cada interação converte com a chance do criativo e a conversão chega depois. O algoritmo passa a aprender com as conversões, não com o toque.'},
  {k:'espera',l:'Esperar o resultado antes de aprender (× atraso)',min:0,max:6,step:.5,f:v=>v?'janela de '+n2(v,1)+' × o atraso':'conta já como falha',n:'0: o olhar entra na hora como falha e o acerto é somado quando chega. Acima de 0: o olhar e o resultado entram juntos depois da janela. Só vale com o atraso ligado.'},
  {k:'qnovo',l:'Qualidade do criativo novo (× a taxa)',min:.2,max:1.5,step:.1,f:v=>'× '+n2(v,1),n:'Vale só na hora do lançamento: multiplica a taxa verdadeira do criativo novo. 1 = ele é bom; abaixo disso tende a não valer a adoção.'},
  {k:'look',l:'Horizonte do oráculo (spots)',min:0,max:40,step:1,f:v=>v,n:'Só afeta a referência de 100%: quanto o oráculo antecipa o desgaste.'},
  {k:'cpm',l:'Preço por 1.000 olhares (R$)',min:5,max:60,step:1,f:v=>'R$ '+v,n:'Economia. Só afeta custo por interação e retorno no painel Anunciantes.'},
  {k:'val',l:'Valor de uma interação para o anunciante (R$)',min:1,max:30,step:1,f:v=>'R$ '+v,n:'Economia. Usado no retorno sobre o investimento.'},
];
function buildParams(){
  $('paramList').innerHTML=PARAMS.map(p=>`<div class="prm"><label for="pr_${p.k}">${p.l}</label><output id="po_${p.k}">${p.f(PRM[p.k])}</output><input type="range" id="pr_${p.k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${PRM[p.k]}"><small>${p.n}</small></div>`).join('');
  PARAMS.forEach(p=>$('pr_'+p.k).addEventListener('input',e=>{PRM[p.k]=+e.target.value;registrarMudanca('param',p.k,PRM[p.k]);$('po_'+p.k).textContent=p.f(PRM[p.k]);renderFormulas();}));
}
function renderDrawer(force){
  EVENTOS.ativo=!drawer.hidden&&tab==='eventos';      // só gera eventos enquanto alguém os está vendo
  if(drawer.hidden)return;
  if(tab==='spot')renderSpot(force);else if(tab==='post')renderPost();else if(tab==='zonas')renderZonas();else if(tab==='log')renderLogTab();else if(tab==='eventos')renderEventos();
  if(force&&tab==='formulas')renderFormulas();
}
function copyText(text,fallbackEl){
  const fb=()=>{if(fallbackEl){fallbackEl.hidden=false;fallbackEl.value=text;fallbackEl.select();}};
  try{navigator.clipboard.writeText(text).catch(fb);}catch(e){fb();}
}
$('btnCalc').addEventListener('click',()=>openDrawer(drawer.hidden));
$('dClose').addEventListener('click',()=>openDrawer(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden)openDrawer(false);});
$('dTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;tab=b.dataset.tab;
  [...$('dTabs').children].forEach(x=>x.setAttribute('aria-selected',String(x===b)));TABS.forEach(t=>$('tab-'+t).hidden=t!==tab);renderDrawer(true);});
$('dSel').addEventListener('change',e=>select(+e.target.value));
$('dPause').addEventListener('click',()=>setPlaying(!playing));
$('dStep').addEventListener('click',()=>stepOnce());
$('btnStep').addEventListener('click',()=>stepOnce());
function stepOnce(){if(emLote)return;setPlaying(false);step();viewStep=null;renderUI(performance.now());}
$('trPrev').addEventListener('click',()=>{const a=S.traces;if(!a.length)return;let i=viewStep==null?a.length-1:a.findIndex(x=>x.id===viewStep);if(i<0)i=0;viewStep=a[Math.max(0,i-1)].id;renderSpot();});
$('trNext').addEventListener('click',()=>{const a=S.traces;if(!a.length||viewStep==null)return;const i=a.findIndex(x=>x.id===viewStep);if(i<0||i>=a.length-1){viewStep=null;}else viewStep=a[i+1].id;renderSpot();});
$('trLive').addEventListener('click',()=>{viewStep=null;renderSpot();});
$('trCopy').addEventListener('click',()=>{const a=S.traces;if(!a.length)return;const i=viewStep==null?a.length-1:Math.max(0,a.findIndex(x=>x.id===viewStep));copyText(JSON.stringify(a[i],null,1),$('copyArea'));});
$('postLvl').addEventListener('change',renderPost);
$('evSo').addEventListener('change',renderEventos);
$('evCopy').addEventListener('click',()=>{
  let l=EVENTOS.lista;if($('evSo').checked){const id=Eventos.idTotem(sel);l=l.filter(e=>e.totem===id);}
  if(l.length)copyText(l.slice(-40).map(e=>JSON.stringify(e)).join('\n'),$('evArea'));
});
['fDec','fTroca','fEsq','fMarco'].forEach(id=>$(id).addEventListener('change',renderLogTab));
$('logCopy').addEventListener('click',()=>{const t=[...$('logBox').children].map(d=>d.textContent).join('\n');copyText(t,null);
  const rg=document.createRange();rg.selectNodeContents($('logBox'));const s=getSelection();s.removeAllRanges();s.addRange(rg);});
$('paramReset').addEventListener('click',()=>{for(const k of Object.keys(DEF))if(PRM[k]!==DEF[k]){PRM[k]=DEF[k];registrarMudanca('param',k,DEF[k]);}buildParams();renderFormulas();});
buildParams();renderFormulas();
