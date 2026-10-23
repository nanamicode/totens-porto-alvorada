'use strict';
/* Configuração: segmentos, criativos, zonas, parâmetros, cenários e funções de apoio do mundo simulado. */
const W=970,H=640,NC=7,NS=8;
const AGES=['18–24','25–34','35–49','50+'],GEN=['Homem','Mulher'];
const segLabel=s=>GEN[s>>2]+' '+AGES[s&3];
const DIAS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

/* ---------- Mundo (a verdade que o algoritmo nunca vê) ---------- */
const CRE=[
 {nome:'Pulse Academia',tag:'Primeira semana grátis',cor:'#ef6a3a',base:.030,age:[1.4,1.2,.7,.35],gen:[1.1,.95],zone:{uni:1.2,parque:1.3,centro:1,noite:.8},tm:h=>1+.25*pk(h,7.5,1.5)+.3*pk(h,18.5,1.8)},
 {nome:'Brasa Café',tag:'Café coado e pão na chapa',cor:'#1fb5a5',base:.026,age:[1,1.2,1.1,.8],gen:[1,1],zone:{centro:1.2,estacao:1.3,shopping:1,noite:.6},tm:h=>1+.5*pk(h,8,1.6)+.15*pk(h,15.5,1.5)},
 {nome:'Nuvem Cartão',tag:'Anuidade zero para sempre',cor:'#8b7cf6',base:.024,age:[.5,1.2,1.4,.9],gen:[1.05,.95],zone:{centro:1.4,estacao:1.1,uni:.7,noite:.6},tm:h=>1+.2*pk(h,12.5,2)},
 {nome:'Cine Aurora',tag:'Estreia hoje, sessão das 20h',cor:'#eab308',base:.032,age:[1.5,1.3,.7,.4],gen:[.95,1.05],zone:{shopping:1.3,noite:1.3,uni:1.1,centro:.8},tm:h=>1+.4*pk(h,20,2.5)},
 {nome:'Voa Idiomas',tag:'Aula experimental',cor:'#3b9ae1',base:.027,age:[1.5,1.2,.6,.3],gen:[.9,1.1],zone:{uni:1.4,centro:1,resid:.9},tm:h=>1+.2*pk(h,18.5,2)},
 {nome:'Vento Running',tag:'Tênis de corrida -30%',cor:'#e0508c',base:.030,age:[.9,1.3,1.1,.5],gen:[1.2,.85],zone:{parque:1.5,shopping:1.1,estacao:.9,noite:.6},tm:h=>1+.3*pk(h,7,1.3)+.2*pk(h,18,1.5)},
 {nome:'Clínica Bem Viver',tag:'Check-up completo',cor:'#6bbf59',base:.028,age:[.2,.5,1.2,1.8],gen:[.85,1.15],zone:{resid:1.4,centro:1,shopping:1.1,uni:.4,noite:.3},tm:h=>1+.25*pk(h,10,2.2)},
];
const ZONES=[
 {id:'uni',nome:'Campus',cx:150,cy:140,ageW:[.55,.27,.10,.08],gM:.47,fat:[.4,.6],sc:[.7,1.1],tint:'#3b9ae1',
  prof:(h,we)=>we?.12*pk(h,14,4):.85*pk(h,8,1.3)+.65*pk(h,12.7,1.3)+.9*pk(h,18.3,1.6)+.18*pk(h,15,5),
  names:['Portaria Principal','Biblioteca Central','Bandejão','Bloco de Engenharia','Ponto de Ônibus do Campus','Praça do Diretório']},
 {id:'centro',nome:'Centro',cx:470,cy:200,ageW:[.12,.36,.34,.18],gM:.54,fat:[.35,.55],sc:[.75,1.15],tint:'#8b7cf6',
  prof:(h,we)=>we?.25*pk(h,14,4):.8*pk(h,8.5,1.1)+pk(h,12.5,1.2)+.85*pk(h,18,1.4)+.2*pk(h,15,5),
  names:['Av. Brasil · Bolsa','Largo da Matriz','Rua do Comércio','Edifício Atlântico','Galeria Central','Praça do Relógio']},
 {id:'shopping',nome:'Comércio',cx:800,cy:150,ageW:[.2,.28,.30,.22],gM:.38,fat:[.15,.3],sc:[.7,1.15],tint:'#eab308',
  prof:(h,we)=>{const b=.9*pk(h,16,3.8)+.45*pk(h,12,2);return we?Math.min(1,b*1.3):b*.75;},
  names:['Shopping Vila Nova · Entrada','Praça de Alimentação','Rua das Lojas','Calçadão Leste','Boulevard Sul','Outlet Porto']},
 {id:'resid',nome:'Bairro',cx:310,cy:340,ageW:[.10,.22,.32,.36],gM:.45,fat:[.5,.7],sc:[.55,.9],tint:'#6bbf59',
  prof:(h,we)=>we?.6*pk(h,11,3)+.4*pk(h,18,2.5):.8*pk(h,7.5,1.2)+.8*pk(h,19,1.6)+.2*pk(h,13,3),
  names:['Mercado do Bairro','Praça das Flores','Escola Municipal','Posto de Saúde','Padaria da Esquina','Ponto da Linha 12']},
 {id:'estacao',nome:'Estação',cx:560,cy:440,ageW:[.2,.3,.3,.2],gM:.5,fat:[.55,.8],sc:[.85,1.2],tint:'#ef6a3a',
  prof:(h,we)=>we?.5*(.7*pk(h,9,2)+.7*pk(h,18,2)+.3*pk(h,14,4)):pk(h,7.6,1.1)+pk(h,18,1.3)+.35*pk(h,13,3),
  names:['Plataforma Norte','Plataforma Sul','Saguão Principal','Terminal de Ônibus','Bicicletário','Passarela Leste']},
 {id:'parque',nome:'Orla e Parque',cx:150,cy:470,ageW:[.15,.35,.32,.18],gM:.5,fat:[.2,.4],sc:[.6,1],tint:'#1fb5a5',
  prof:(h,we)=>we?.9*pk(h,9,1.8)+pk(h,16.5,2.2):.6*pk(h,6.8,1)+.7*pk(h,17.8,1.5)+.15*pk(h,12.5,2),
  names:['Entrada do Parque','Pista de Corrida','Lago','Quiosque da Orla','Ciclovia','Mirante do Rio']},
 {id:'noite',nome:'Noite',cx:810,cy:440,ageW:[.4,.4,.14,.06],gM:.52,fat:[.15,.3],sc:[.7,1.1],tint:'#e0508c',
  prof:(h,we)=>Math.min(1,(.95*pk(h,22.5,2.3)+.3*pk(h,13,2)*(we?.6:1))*(we?1.25:1)),
  names:['Rua do Bar','Praça da Música','Casa de Shows','Esquina Neon','Beco das Pizzas','Cine Teatro']},
];
const ZI={};ZONES.forEach((z,i)=>ZI[z.id]=i);
const HAGE=h=>h>=22||h<6?[1.6,1.5,.7,.25]:h<10?[.9,1,1.2,.9]:h<17?[.9,.9,1,1.4]:[1.1,1.1,1,.7];
const XS=[60,200,350,500,650,790,910],YS=[50,180,310,440,570];
const DEF={acc:.86,kz:40,kt:60,rest:.4,forget:.985,look:16,cpm:18,val:8};
const PRM=Object.assign({},DEF);   // acc: câmera · kz,kt: força dos priors · rest: desgaste assumido · forget: esquecimento/h · look: horizonte do oráculo · cpm,val: economia
const CON=new Array(NC).fill(true);   // campanhas ativas
const EV={chuva:false,show:false,greve:false,feriado:false};
const EVN={chuva:'Chuva forte',show:'Show na Praça da Música',greve:'Greve na estação',feriado:'Feriado'};
function evMul(z){let m=1;
  if(EV.chuva)m*={parque:.25,uni:.7,shopping:1.15,estacao:1.1,centro:.8,resid:.85,noite:.6}[z];
  if(EV.show)m*={noite:2.4,centro:1.1}[z]||1;
  if(EV.greve)m*={estacao:.3,centro:.85,resid:.9}[z]||1;
  return m;}
const fatT=(r,e)=>.35+.65*Math.exp(-r*e/600);

function nearestZone(x,y){let b=0,bd=1e9;for(let i=0;i<ZONES.length;i++){const d=Math.hypot(x-ZONES[i].cx,y-ZONES[i].cy);if(d<bd){bd=d;b=i;}}return b;}
