'use strict';
/* Eventos do totem: formato, criação e validação do evento `spot` (versão 1).
   Especificação em docs/EVENTOS.md e docs/evento-spot.schema.json.
   Funciona no navegador (Eventos) e no Node (require). */
(function(root,factory){
  const E=factory();
  if(typeof module==='object'&&module.exports)module.exports=E;
  else root.Eventos=E;
})(typeof self!=='undefined'?self:globalThis,function(){
  /* mesma ordem dos perfis do algoritmo: índice = gênero × 4 + faixa etária (H = homem, M = mulher) */
  const PERFIS=['H18-24','H25-34','H35-49','H50+','M18-24','M25-34','M35-49','M50+'];
  const CHAVES=['versao','tipo','totem','spot','inicio','duracao_s','criativo','audiencia','interacoes'];
  const slug=nome=>nome.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const pad2=n=>String(n).padStart(2,'0');

  /* a simulação começa numa segunda-feira, 2026-01-05, no fuso de Brasília (-03:00); t = segundos desde 00:00 do dia 1 */
  const BASE=Date.UTC(2026,0,5,3,0,0);
  const instante=t=>new Date(BASE+t*1000-3*3600000).toISOString().slice(0,19)+'-03:00';
  const idTotem=i=>'T-'+pad2(i+1);

  const contagens=v=>Object.fromEntries(PERFIS.map((p,i)=>[p,Math.round(v[i]||0)]));

  /* o.totem: índice do totem · o.t: segundos desde o início · o.duracao: segundos · o.criativo: id do criativo
     o.audiencia: 8 contagens · o.interacoes: 8 contagens (por perfil) ou um total */
  function criar(o){
    const inicio=instante(o.t),totem=idTotem(o.totem);
    return {
      versao:1,tipo:'spot',totem,
      spot:totem+'-'+inicio.replace(/[-:]/g,'').slice(0,15),
      inicio,duracao_s:o.duracao,criativo:o.criativo,
      audiencia:contagens(o.audiencia),
      interacoes:typeof o.interacoes==='number'?Math.round(o.interacoes):contagens(o.interacoes),
    };
  }

  const inteiro=v=>Number.isInteger(v)&&v>=0;

  /* Evento `conversao` (docs/EVENTOS.md): um resultado que chegou depois do spot, ligado ao spot de origem.
     Sem código de cupom, sem identificador de cliente: só o spot, quando, quantas e, se o sistema souber, o perfil. */
  const CHAVES_CONVERSAO=['versao','tipo','conversao','spot','quando','quantidade'];
  const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  /* o.id: identificador único da conversão · o.spot: spot de origem · o.t: segundos desde o início · o.quantidade (padrão 1) · o.perfil (opcional) */
  function criarConversao(o){
    const ev={versao:1,tipo:'conversao',conversao:o.id,spot:o.spot,quando:instante(o.t),quantidade:o.quantidade??1};
    if(o.perfil!==undefined)ev.perfil=o.perfil;
    return ev;
  }
  function validarConversao(ev){
    const erros=[];
    if(ev===null||typeof ev!=='object'||Array.isArray(ev))return {ok:false,erros:['o evento deve ser um objeto']};
    for(const k of CHAVES_CONVERSAO)if(!(k in ev))erros.push(`falta o campo ${k}`);
    for(const k of Object.keys(ev))if(!CHAVES_CONVERSAO.includes(k)&&k!=='perfil')erros.push(`campo desconhecido: ${k}`);
    if('versao' in ev&&ev.versao!==1)erros.push('versao deve ser 1');
    if('tipo' in ev&&ev.tipo!=='conversao')erros.push('tipo deve ser "conversao"');
    if('conversao' in ev&&!(typeof ev.conversao==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(ev.conversao)))erros.push('conversao deve ser um identificador de até 80 letras, números ou _.:-');
    if('spot' in ev&&!(typeof ev.spot==='string'&&ev.spot.length>0))erros.push('spot deve ser um texto não vazio');
    if('quando' in ev&&!(typeof ev.quando==='string'&&ISO.test(ev.quando)&&!Number.isNaN(Date.parse(ev.quando))))erros.push('quando deve ser data e hora ISO 8601 com fuso');
    if('quantidade' in ev&&!(Number.isInteger(ev.quantidade)&&ev.quantidade>=1&&ev.quantidade<=1000))erros.push('quantidade deve ser um inteiro de 1 a 1000');
    if('perfil' in ev&&!PERFIS.includes(ev.perfil))erros.push(`perfil deve ser um de ${PERFIS.join(', ')}`);
    return {ok:erros.length===0,erros};
  }

  /* devolve {ok, erros, avisos}. Erros violam o formato; avisos são suspeitas de dado ruim. */
  function validar(ev){
    const erros=[],avisos=[];
    if(ev===null||typeof ev!=='object'||Array.isArray(ev))return {ok:false,erros:['o evento deve ser um objeto'],avisos};
    for(const k of CHAVES)if(!(k in ev))erros.push(`falta o campo ${k}`);
    for(const k of Object.keys(ev))if(!CHAVES.includes(k))erros.push(`campo desconhecido: ${k}`);
    if('versao' in ev&&ev.versao!==1)erros.push('versao deve ser 1');
    if('tipo' in ev&&ev.tipo!=='spot')erros.push('tipo deve ser "spot"');
    if('totem' in ev&&!(typeof ev.totem==='string'&&/^T-\d{2,}$/.test(ev.totem)))erros.push('totem deve seguir o padrão T-01');
    if('spot' in ev&&!(typeof ev.spot==='string'&&ev.spot.length>0))erros.push('spot deve ser um texto não vazio');
    if('inicio' in ev){
      const ok=typeof ev.inicio==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(ev.inicio)&&!Number.isNaN(Date.parse(ev.inicio));
      if(!ok)erros.push('inicio deve ser data e hora ISO 8601 com fuso');
    }
    if('duracao_s' in ev&&!(typeof ev.duracao_s==='number'&&ev.duracao_s>0))erros.push('duracao_s deve ser um número maior que zero');
    if('criativo' in ev&&!(typeof ev.criativo==='string'&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ev.criativo)))erros.push('criativo deve ser um identificador em minúsculas, como brasa-cafe');
    const checaContagens=(nome,v)=>{
      if(v===null||typeof v!=='object'||Array.isArray(v)){erros.push(`${nome} deve ser um objeto com os 8 perfis`);return false;}
      let ok=true;
      for(const p of PERFIS)if(!(p in v)){erros.push(`${nome}: falta o perfil ${p}`);ok=false;}
      for(const k of Object.keys(v))if(!PERFIS.includes(k)){erros.push(`${nome}: perfil desconhecido ${k}`);ok=false;}
      for(const p of PERFIS)if(p in v&&!inteiro(v[p])){erros.push(`${nome}.${p} deve ser um inteiro maior ou igual a zero`);ok=false;}
      return ok;
    };
    const audOk='audiencia' in ev&&checaContagens('audiencia',ev.audiencia);
    if('interacoes' in ev){
      if(typeof ev.interacoes==='number'){
        if(!inteiro(ev.interacoes))erros.push('interacoes deve ser um inteiro maior ou igual a zero');
        else if(audOk){
          const total=PERFIS.reduce((a,p)=>a+ev.audiencia[p],0);
          if(ev.interacoes>total)avisos.push(`mais interações (${ev.interacoes}) que pessoas contadas (${total})`);
        }
      }else if(checaContagens('interacoes',ev.interacoes)&&audOk){
        for(const p of PERFIS)if(ev.interacoes[p]>ev.audiencia[p])erros.push(`interacoes.${p} (${ev.interacoes[p]}) maior que audiencia.${p} (${ev.audiencia[p]})`);
      }
    }
    return {ok:erros.length===0,erros,avisos};
  }

  /* total de pessoas e de interações de um evento, qualquer que seja a atribuição */
  const totais=ev=>({
    pessoas:PERFIS.reduce((a,p)=>a+ev.audiencia[p],0),
    interacoes:typeof ev.interacoes==='number'?ev.interacoes:PERFIS.reduce((a,p)=>a+ev.interacoes[p],0),
  });

  return {PERFIS,CHAVES,CHAVES_CONVERSAO,slug,instante,idTotem,criar,validar,totais,criarConversao,validarConversao};
});
