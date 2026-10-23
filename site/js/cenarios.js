'use strict';
/* Cenários no site: salvar a sessão (JSON ou link) e refazê-la do zero com a mesma semente.
   O formato e a validação estão em cenario.js; refazer a sessão é reproduzirPassos, em sim.js. */
let cenarioSalvo=null;
const cenMsg=t=>{$('cenMsg').textContent=t;};
const descreverCenario=c=>`semente ${c.semente}, ${fmt(c.passos)} passos (${f2(c.passos/120,1)} h simuladas), ${c.mudancas.length} ${c.mudancas.length===1?'mudança':'mudanças'} no caminho`;

function salvarCenario(){
  if(emLote)return;
  const c=cenarioAtual($('cenNome').value.trim()),v=Cenario.validar(c);
  if(!v.ok){$('cenInfo').textContent='Não foi possível salvar: '+v.erros.slice(0,2).join('; ')+'.';return;}
  cenarioSalvo=c;
  const json=JSON.stringify(c,null,1),saida=$('cenSaida');
  saida.value=json;saida.hidden=false;
  const token=Cenario.codificar(c),cabe=token.length<=Cenario.MAX_LINK;
  $('cenCopiarJson').hidden=false;$('cenCopiarLink').hidden=!cabe;
  $('cenInfo').textContent=`Cenário salvo: ${descreverCenario(c)}.${cabe?'':' O link ficaria grande demais para o endereço: use o JSON.'}`;
}
function linkDoCenario(){return location.href.split('#')[0]+'#cenario.'+Cenario.codificar(cenarioSalvo);}

/* depois de refazer a sessão, a tela mostra o estado novo dos cenários, das campanhas e dos parâmetros */
function sincronizarTela(){
  Object.keys(EV).forEach(k=>{const b=$('segEv').querySelector(`[data-v="${k}"]`);if(b)b.setAttribute('aria-pressed',String(EV[k]));});
  legKey='';renderLegend();buildParams();renderFormulas();buildSelect();
  sel=Math.min(sel,S.totems.length-1);select(sel);
  ffTarget=0;lastHeat=0;renderUI(performance.now());
}

async function reproduzirNoSite(modo){
  if(emLote)return;
  let c;
  try{c=Cenario.ler($('cenEntrada').value);}catch(e){cenMsg(e.message+'.');return;}
  const v=Cenario.validar(c);
  if(!v.ok){cenMsg('Cenário inválido: '+v.erros.slice(0,3).join('; ')+'.');return;}
  const passos=modo==='config'?0:c.passos;
  const alvo=Object.assign({},c,{passos,mudancas:c.mudancas.filter(m=>m.passo<=passos)});
  emLote=true;cancelarLote=false;setPlaying(false);
  ['cenReproduzir','cenConfig','cenSalvar'].forEach(id=>{$(id).disabled=true;});$('cenCancelar').hidden=false;
  const prog=$('cenProg');prog.hidden=false;prog.value=0;
  let k=0,terminou=false;
  try{
    const g=reproduzirPassos(alvo);
    while(!terminou&&!cancelarLote){
      const t0=performance.now();
      while(performance.now()-t0<30){const x=g.next();if(x.done){terminou=true;break;}k=x.value;}
      prog.value=passos?k/passos:1;cenMsg(`Refazendo do zero: passo ${fmt(k)} de ${fmt(passos)}.`);
      await new Promise(r=>setTimeout(r,0));
    }
  }finally{
    emLote=false;prog.hidden=true;$('cenCancelar').hidden=true;
    ['cenReproduzir','cenConfig','cenSalvar'].forEach(id=>{$(id).disabled=false;});
  }
  sincronizarTela();
  if(!terminou){cenMsg(`Cancelado: a cidade ficou parada no passo ${fmt(S.step)} do cenário.`);return;}
  if(modo==='config'){cenMsg(`Configuração aplicada e cidade recomeçada do zero com a semente ${c.semente}. Está parada: aperte Continuar.`);return;}
  const r=c.resultado;
  if(!r){cenMsg('Refeito até o ponto salvo. O cenário não traz números para conferir. A cidade está parada: aperte Continuar para seguir.');return;}
  const bate=S.tot.v===r.olhares&&S.tot.e.every((x,i)=>x===r.interacoes[i]);
  cenMsg(bate
    ?`Refeito e conferido: os olhares (${fmt(S.tot.v)}) e as interações batem com as do cenário salvo. A cidade está parada: aperte Continuar para seguir.`
    :`Refeito, mas os números não batem com os salvos (olhares ${fmt(S.tot.v)} contra ${fmt(r.olhares)}). Isso é esperado se o cenário foi salvo em outro navegador, em outro computador ou numa versão diferente do simulador: a mesma semente só reproduz o mesmo dia no mesmo ambiente.`);
}

function carregarDoEndereco(){
  const m=/^#cenario\.([A-Za-z0-9_-]+)$/.exec(location.hash);
  if(!m)return;
  try{
    const c=Cenario.decodificar(m[1]),v=Cenario.validar(c);
    $('cenEntrada').value=JSON.stringify(c,null,1);
    cenMsg(v.ok?`Há um cenário no endereço desta página (${descreverCenario(c)}). Confira e aperte Reproduzir.`:'O cenário do endereço é inválido: '+v.erros.slice(0,2).join('; ')+'.');
    $('cenarios').scrollIntoView();
  }catch(e){cenMsg('O link do cenário no endereço não pôde ser lido: '+e.message+'.');}
}

$('cenEx').innerHTML='<option value="">Escolha um exemplo…</option>'+Cenario.exemplos().map(x=>`<option value="${x.id}">${x.nome}</option>`).join('');
$('cenEx').addEventListener('change',e=>{
  const x=Cenario.exemplos().find(y=>y.id===e.target.value);
  if(x){$('cenEntrada').value=JSON.stringify(x.cenario,null,1);cenMsg(`Exemplo carregado: ${descreverCenario(x.cenario)}.`);}
});
$('cenSalvar').addEventListener('click',salvarCenario);
$('cenCopiarJson').addEventListener('click',()=>{if(cenarioSalvo)copyText(JSON.stringify(cenarioSalvo,null,1),$('cenSaida'));});
$('cenCopiarLink').addEventListener('click',()=>{if(cenarioSalvo)copyText(linkDoCenario(),$('cenSaida'));});
$('cenReproduzir').addEventListener('click',()=>reproduzirNoSite('ponto'));
$('cenConfig').addEventListener('click',()=>reproduzirNoSite('config'));
$('cenCancelar').addEventListener('click',()=>{cancelarLote=true;});
window.addEventListener('hashchange',carregarDoEndereco);
carregarDoEndereco();
