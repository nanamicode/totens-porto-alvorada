'use strict';
/* Cenário: o formato salvo de uma sessão (semente, configuração inicial e mudanças ao longo do tempo), a validação,
   o link e os exemplos. Refazer a sessão do zero é com reproduzirPassos, em sim.js. Especificação: docs/CENARIOS.md.
   Funciona no navegador (Cenario) e no Node (require). */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.Cenario=factory();
})(typeof self!=='undefined'?self:globalThis,function(){
  const PARAMS=['acc','kz','kt','rest','forget','look','cpm','val','corrige','estima','contexto','kp'];
  const EVENTOS=['chuva','show','greve','feriado'];
  const N_CRIATIVOS=7,MAX_PASSOS=43200,MAX_MUDANCAS=2000,MAX_LINK=6000;
  const inteiro=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;

  /* devolve {ok, erros}; um cenário válido pode ser refeito com reproduzirPassos */
  function validar(c){
    const e=[];
    if(c===null||typeof c!=='object'||Array.isArray(c))return {ok:false,erros:['o cenário deve ser um objeto']};
    if(c.versao!==1)e.push('versao deve ser 1');
    if(c.nome!==undefined&&!(typeof c.nome==='string'&&c.nome.length<=80))e.push('nome deve ser um texto de até 80 letras');
    if(!inteiro(c.semente,0,4294967295))e.push('semente deve ser um inteiro entre 0 e 4294967295');
    if(!inteiro(c.passos,0,MAX_PASSOS))e.push(`passos deve ser um inteiro entre 0 e ${MAX_PASSOS}`);
    const k0=c.config0;
    if(k0===null||typeof k0!=='object'||Array.isArray(k0))e.push('config0 deve ser um objeto');
    else{
      if(k0.params!==undefined){
        if(k0.params===null||typeof k0.params!=='object')e.push('config0.params deve ser um objeto');
        else for(const [k,v] of Object.entries(k0.params)){
          if(!PARAMS.includes(k))e.push(`config0.params: parâmetro desconhecido ${k}`);
          else if(!(typeof v==='number'&&Number.isFinite(v)&&v>=0))e.push(`config0.params.${k} deve ser um número maior ou igual a zero`);
        }
      }
      if(k0.eventos!==undefined){
        if(k0.eventos===null||typeof k0.eventos!=='object')e.push('config0.eventos deve ser um objeto');
        else for(const [k,v] of Object.entries(k0.eventos)){
          if(!EVENTOS.includes(k))e.push(`config0.eventos: cenário desconhecido ${k}`);
          else if(typeof v!=='boolean')e.push(`config0.eventos.${k} deve ser verdadeiro ou falso`);
        }
      }
      if(k0.campanhasPausadas!==undefined){
        const p=k0.campanhasPausadas;
        if(!Array.isArray(p)||!p.every(k=>inteiro(k,0,N_CRIATIVOS-1)))e.push(`config0.campanhasPausadas deve ser uma lista de índices de 0 a ${N_CRIATIVOS-1}`);
        else if(new Set(p).size!==p.length)e.push('config0.campanhasPausadas tem índices repetidos');
        else if(p.length>=N_CRIATIVOS)e.push('pelo menos uma campanha precisa ficar ativa');
      }
    }
    const ms=c.mudancas;
    if(!Array.isArray(ms))e.push('mudancas deve ser uma lista');
    else if(ms.length>MAX_MUDANCAS)e.push(`mudancas passa de ${MAX_MUDANCAS}`);
    else{
      let ant=0;
      ms.forEach((m,i)=>{
        const rot=`mudancas[${i}]`;
        if(m===null||typeof m!=='object'){e.push(`${rot} deve ser um objeto`);return;}
        if(!inteiro(m.passo,0,Number.isInteger(c.passos)?c.passos:MAX_PASSOS))e.push(`${rot}.passo deve ser um inteiro de 0 até o total de passos`);
        else if(m.passo<ant)e.push(`${rot}.passo vem antes da mudança anterior`);
        else ant=m.passo;
        if(m.tipo==='param'){
          if(!PARAMS.includes(m.chave))e.push(`${rot}: parâmetro desconhecido ${m.chave}`);
          else if(!(typeof m.valor==='number'&&Number.isFinite(m.valor)&&m.valor>=0))e.push(`${rot}.valor deve ser um número maior ou igual a zero`);
        }else if(m.tipo==='evento'){
          if(!EVENTOS.includes(m.chave))e.push(`${rot}: cenário desconhecido ${m.chave}`);
          else if(typeof m.valor!=='boolean')e.push(`${rot}.valor deve ser verdadeiro ou falso`);
        }else if(m.tipo==='campanha'){
          if(!inteiro(m.chave,0,N_CRIATIVOS-1))e.push(`${rot}.chave deve ser o índice de uma campanha`);
          else if(typeof m.valor!=='boolean')e.push(`${rot}.valor deve ser verdadeiro ou falso`);
        }else e.push(`${rot}.tipo deve ser param, evento ou campanha`);
      });
    }
    if(c.resultado!==undefined){
      const r=c.resultado;
      if(!(r&&typeof r==='object'&&inteiro(r.olhares,0,Number.MAX_SAFE_INTEGER)&&Array.isArray(r.interacoes)&&r.interacoes.length===3&&r.interacoes.every(v=>inteiro(v,0,Number.MAX_SAFE_INTEGER))))
        e.push('resultado deve trazer olhares e as 3 contagens de interações');
    }
    return {ok:e.length===0,erros:e};
  }

  /* o cenário num texto curto que cabe num endereço: base64 sem símbolos especiais */
  function codificar(c){
    const bytes=new TextEncoder().encode(JSON.stringify(c));
    let bin='';bytes.forEach(b=>{bin+=String.fromCharCode(b);});
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function decodificar(token){
    if(!/^[A-Za-z0-9_-]+$/.test(token))throw new Error('o texto do link não é válido');
    let bin;
    try{bin=atob(token.replace(/-/g,'+').replace(/_/g,'/'));}catch(e){throw new Error('o texto do link não é válido');}
    const bytes=Uint8Array.from(bin,ch=>ch.charCodeAt(0));
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch(e){throw new Error('o link não contém um cenário legível');}
  }

  /* aceita o JSON do cenário, um link com #cenario.TOKEN ou só cenario.TOKEN; devolve o objeto ou lança erro */
  function ler(texto){
    const t=String(texto??'').trim();
    if(!t)throw new Error('cole o JSON ou o link de um cenário');
    const m=/cenario\.([A-Za-z0-9_-]+)/.exec(t);
    if(m&&!t.startsWith('{'))return decodificar(m[1]);
    try{return JSON.parse(t);}catch(e){throw new Error('o texto não é JSON nem um link de cenário');}
  }

  const exemplos=()=>[
    {id:'dia-normal',nome:'Dia normal (semente 1, 12 horas)',cenario:{versao:1,nome:'Dia normal',semente:1,passos:1440,config0:{},mudancas:[]}},
    {id:'chuva',nome:'Chuva forte o tempo todo (semente 2, 12 horas)',cenario:{versao:1,nome:'Chuva forte',semente:2,passos:1440,config0:{eventos:{chuva:true}},mudancas:[]}},
    {id:'greve-9h',nome:'Greve na estação a partir das 9h (semente 3, 12 horas)',cenario:{versao:1,nome:'Greve às 9h',semente:3,passos:1440,config0:{},mudancas:[{passo:360,tipo:'evento',chave:'greve',valor:true}]}},
    {id:'sem-compartilhar',nome:'Sem compartilhar o aprendizado (semente 1, 12 horas)',cenario:{versao:1,nome:'Sem compartilhar o aprendizado',semente:1,passos:1440,config0:{params:{kz:0,kt:0}},mudancas:[]}},
  ];

  return {PARAMS,EVENTOS,N_CRIATIVOS,MAX_PASSOS,MAX_LINK,validar,codificar,decodificar,ler,exemplos};
});
