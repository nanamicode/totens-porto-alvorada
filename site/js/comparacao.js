'use strict';
/* Comparação pareada de duas configurações do algoritmo: receitas, campos editáveis e estatística da diferença.
   As duas configurações rodam nas mesmas sementes, então enfrentam exatamente a mesma audiência, e a diferença
   de cada semente é o que se analisa. Sem dependência de navegador: usada pelo site e por tools/comparar.js. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.Comparacao=factory();
})(typeof self!=='undefined'?self:globalThis,function(){
  /* valores padrão do simulador (os mesmos de config.js e brain.js) */
  const PADRAO={acc:.86,kz:40,kt:60,rest:.4,forget:.985,corrige:1,estima:1,contexto:0,kp:10};

  const CAMPOS=[
    {k:'acc',nome:'Acerto da câmera',min:.5,max:.99,step:.01},
    {k:'kz',nome:'Prior da zona',min:0,max:200,step:5},
    {k:'kt',nome:'Prior do totem',min:0,max:200,step:5},
    {k:'rest',nome:'Desgaste assumido',min:0,max:1,step:.05},
    {k:'forget',nome:'Esquecimento por hora',min:.95,max:1,step:.001},
    {k:'corrige',nome:'Corrigir pelo desgaste',min:0,max:1,step:1,sim:true},
    {k:'estima',nome:'Estimar o desgaste',min:0,max:1,step:1,sim:true},
    {k:'contexto',nome:'Período do dia',min:0,max:1,step:1,sim:true},
    {k:'kp',nome:'Prior do horário',min:0,max:100,step:1},
  ];

  /* receitas prontas; "atual" (a configuração do menu Cálculos) é montada pelo site */
  const PRESETS=[
    {id:'padrao',nome:'Padrão',params:{}},
    {id:'sem-compartilhar',nome:'Sem compartilhar o aprendizado',params:{kz:0,kt:0}},
    {id:'sem-desgaste',nome:'Sem tratar o desgaste',params:{corrige:0,estima:0}},
    {id:'desgaste-zero',nome:'Desgaste assumido em zero',params:{rest:0,estima:0}},
    {id:'com-horario',nome:'Com o período do dia',params:{contexto:1}},
    {id:'camera-ruim',nome:'Câmera de 60% de acerto',params:{acc:.6}},
    {id:'nunca-esquece',nome:'Nunca esquece',params:{forget:1}},
  ];

  const paramsDe=p=>Object.assign({},PADRAO,p||{});

  /* receita pelo id, ou lista "kz=0,kt=0" aplicada sobre o padrão; devolve {nome, params} ou lança erro */
  function ler(texto){
    const t=String(texto??'padrao').trim();
    const pre=PRESETS.find(p=>p.id===t);
    if(pre)return {nome:pre.nome,params:paramsDe(pre.params)};
    const params={};
    for(const par of t.split(',').map(s=>s.trim()).filter(Boolean)){
      const [k,v]=par.split('=');
      if(!CAMPOS.some(c=>c.k===k)||v===undefined||!Number.isFinite(Number(v)))throw new Error(`configuração inválida: "${par}". Use uma receita (${PRESETS.map(p=>p.id).join(', ')}) ou campos como kz=0,kt=0.`);
      params[k]=Number(v);
    }
    return {nome:Object.keys(params).length?Object.entries(params).map(([k,v])=>`${k}=${v}`).join(', '):'Padrão',params:paramsDe(params)};
  }

  /* o que difere entre duas configurações, como [{k, a, b}] */
  const diferencas=(a,b)=>CAMPOS.filter(c=>a[c.k]!==b[c.k]).map(c=>({k:c.k,nome:c.nome,a:a[c.k],b:b[c.k]}));

  function estat(v){
    const n=v.length,media=n?v.reduce((a,b)=>a+b,0)/n:0;
    const dp=n>1?Math.sqrt(v.reduce((a,b)=>a+(b-media)**2,0)/(n-1)):0;
    const ep=n>1?dp/Math.sqrt(n):0;
    return {n,media,dp,ep,meia:1.96*ep,min:n?Math.min(...v):0,max:n?Math.max(...v):0};
  }

  /* A e B: listas de resultados por semente, na mesma ordem, com ganho, efAlgoritmo, acertos, interacoes e custo */
  function pareadas(A,B){
    const n=Math.min(A.length,B.length);
    const campo=f=>{
      const a=A.slice(0,n).map(f),b=B.slice(0,n).map(f),d=b.map((x,i)=>x-a[i]);
      return {A:estat(a),B:estat(b),dif:Object.assign(estat(d),{
        melhorB:d.filter(x=>x>0).length,piorB:d.filter(x=>x<0).length,iguais:d.filter(x=>x===0).length,valores:d}),
        a,b};
    };
    return {n,ganho:campo(r=>r.ganho),efAlgoritmo:campo(r=>r.efAlgoritmo),acertos:campo(r=>r.acertos),
      interacoes:campo(r=>r.interacoes),custo:campo(r=>r.custo)};
  }

  /* conclusão sobre uma diferença: tipo = poucas | igual | ruido | melhor | pior (de B em relação a A) */
  function veredito(dif){
    if(dif.n<3)return {tipo:'poucas'};
    if(dif.iguais===dif.n)return {tipo:'igual'};
    if(Math.abs(dif.media)<2*dif.ep)return {tipo:'ruido'};
    return {tipo:dif.media>0?'melhor':'pior'};
  }

  /* a conclusão em português. fmt(x, comSinal) formata uma diferença na unidade de quem chama (por exemplo, pontos de ganho). */
  function frase(dif,fmt){
    const v=veredito(dif);
    if(v.tipo==='poucas')return 'Poucas sementes para concluir. Use pelo menos 3, de preferência 8 ou mais.';
    if(v.tipo==='igual')return 'As duas configurações deram exatamente o mesmo resultado em todas as sementes.';
    if(v.tipo==='ruido')return `Sem diferença clara: a diferença média (${fmt(dif.media,true)}, erro padrão ${fmt(dif.ep,false)}) está dentro do ruído.`;
    return `B é ${v.tipo==='melhor'?'melhor':'pior'} que A: ${fmt(dif.media,true)} de ganho sobre a rotação (erro padrão ${fmt(dif.ep,false)}), com B à frente em ${dif.melhorB} de ${dif.n} sementes.`;
  }

  return {PADRAO,CAMPOS,PRESETS,paramsDe,ler,diferencas,estat,pareadas,veredito,frase};
});
