'use strict';
/* Mundo simulado: estado global, criação da cidade e dos totens (a verdade que o algoritmo nunca vê). */
let S,brain,rW,rB;       // estado do mundo, cérebro (Brain), geradores aleatórios
let viewStep=null,sel=0,playing=true,speed=10,mode='cri',ffTarget=0,showTruth=false;
const ne=new Float64Array(NS),nt=new Float64Array(NS);
const vT=new Int8Array(64),vU=new Int8Array(64),vR=new Float64Array(64);

function init(seed){
  rW=mulberry32(seed);rB=mulberry32(seed^0x9e3779b9);
  const totems=[];
  ZONES.forEach((z,zi)=>{
    let tries=0,count=0;
    while(count<6&&tries<8000){
      tries++;
      const horiz=rW()<.5;let x,y;
      if(horiz){const j=(rW()*YS.length)|0,i=(rW()*(XS.length-1))|0;y=YS[j];x=XS[i]+(XS[i+1]-XS[i])*(.22+rW()*.56);}
      else{const i=(rW()*XS.length)|0,j=(rW()*(YS.length-1))|0;x=XS[i];y=YS[j]+(YS[j+1]-YS[j])*(.22+rW()*.56);}
      if(nearestZone(x,y)!==zi)continue;
      if(Math.hypot(x-z.cx,y-z.cy)>(tries<3000?150:240))continue;
      if(totems.some(t=>Math.hypot(t.x-x,t.y-y)<(tries<5000?62:48)))continue;
      const k=totems.length;
      const ageW=z.ageW.map(v=>v*Math.exp(norm(rW)*.25));
      const gM=clamp(z.gM+norm(rW)*.05,.2,.8);
      const wt=[],cw=[];
      for(let h=0;h<24;h++){
        const hm=HAGE(h),w=new Float64Array(NS);let sum=0;
        for(let s=0;s<NS;s++){w[s]=ageW[s&3]*hm[s&3]*((s>>2)===0?gM:1-gM);sum+=w[s];}
        let acc=0;const c=new Float64Array(NS);
        for(let s=0;s<NS;s++){w[s]/=sum;acc+=w[s];c[s]=acc;}
        wt.push(w);cw.push(c);
      }
      const r=z.fat[0]+rW()*(z.fat[1]-z.fat[0]);
      const P=new Float32Array(24*NS*NC);
      for(let h=0;h<24;h++)for(let s=0;s<NS;s++)for(let c=0;c<NC;c++){
        const cr=CRE[c];
        P[(h*NS+s)*NC+c]=Math.min(.09,cr.base*cr.age[s&3]*cr.gen[s>>2]*(cr.zone[z.id]??1)*cr.tm(h));
      }
      const dots=[];
      for(let d=0;d<16;d++)dots.push({p:(rW()-.5)*100,v:(6+rW()*8)*(rW()<.5?-1:1),o:(rW()-.5)*9,g:0,a:0});
      totems.push({id:k,zi,x,y,axis:horiz?'h':'v',nome:z.names[count],r,scale:z.sc[0]+rW()*(z.sc[1]-z.sc[0]),wt,cw,P,dots,
        E:[new Float64Array(NC),new Float64Array(NC),new Float64Array(NC)],
        recent:new Float64Array(NS),hrSum:new Float64Array(24),hrCnt:new Float64Array(24),
        cur:[0,0,0],lastN:0,ewma:0,views:0,eng:[0,0,0],shows:new Float64Array(NC),lastNe:new Float64Array(NS)});
      count++;
    }
  });
  const mk=n=>({a:new Float64Array(n),n:new Float64Array(n)});
  brain=Brain.create({nSeg:NS,nCre:NC,nZones:ZONES.length,nPeriods:8,zoneOf:totems.map(t=>t.zi),rng:rB,params:PRM,active:CON});
  S={t:6*3600,step:0,totems,tot:{v:0,e:[0,0,0]},bins:[],bin:{v:0,e:[0,0,0]},binT:6*3600,hour:6,log:[],pulses:[],lines:[],traces:[],cs:[0,1,2].map(()=>({v:new Float64Array(NC),e:new Float64Array(NC),s:new Float64Array(NC)}))};
  S.semente=seed;S.historico=[];S.config0=configAtual();
}
