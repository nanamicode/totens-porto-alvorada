'use strict';
/* Mapa: desenho da cidade em canvas, pessoas andando, totens, dica de contexto e seleção por clique. */
/* ---------- Mapa ---------- */
const cvs=document.getElementById('map'),ctx=cvs.getContext('2d');
const stat=document.createElement('canvas');
let scale=1,dpr=1,hover=-1;
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let roadSeed;
function buildStatic(){
  const rect=cvs.parentElement.getBoundingClientRect();
  const cw=Math.max(280,Math.floor(rect.width));
  dpr=Math.min(2,window.devicePixelRatio||1);scale=cw/W;
  cvs.width=Math.round(cw*dpr);cvs.height=Math.round(H*scale*dpr);cvs.style.height=(H*scale)+'px';
  stat.width=cvs.width;stat.height=cvs.height;
  const g=stat.getContext('2d');g.setTransform(dpr*scale,0,0,dpr*scale,0,0);
  const r=mulberry32(7);
  g.fillStyle=css('--map-bg');g.fillRect(0,0,W,H);
  const RW=13;
  for(let j=0;j<YS.length-1;j++)for(let i=0;i<XS.length-1;i++){
    const x0=XS[i]+RW/2,y0=YS[j]+RW/2,x1=XS[i+1]-RW/2,y1=YS[j+1]-RW/2;
    const zi=nearestZone((x0+x1)/2,(y0+y1)/2),z=ZONES[zi];
    const park=z.id==='parque'&&((i+j)%2===0)||(z.id==='uni'&&i===1&&j===1);
    g.fillStyle=park?css('--map-park'):css('--map-block');g.fillRect(x0,y0,x1-x0,y1-y0);
    if(!park){
      g.fillStyle=css('--map-block2');
      const bw=(x1-x0-18)/2,bh=(y1-y0-18)/2;
      for(let a=0;a<2;a++)for(let b=0;b<2;b++){
        if(r()<.18)continue;
        g.globalAlpha=.55+r()*.45;g.fillRect(x0+6+a*(bw+6),y0+6+b*(bh+6),bw,bh);
      }
      g.globalAlpha=.1;g.fillStyle=z.tint;g.fillRect(x0,y0,x1-x0,y1-y0);g.globalAlpha=1;
    }
  }
  g.strokeStyle=css('--map-river');g.lineWidth=36;g.lineCap='round';
  g.beginPath();g.moveTo(-30,545);g.bezierCurveTo(200,640,360,500,560,600);g.bezierCurveTo(740,680,880,560,1010,620);g.stroke();
  g.strokeStyle=css('--map-road');g.lineCap='butt';
  XS.forEach((x,i)=>{g.lineWidth=(i===3)?20:RW;g.beginPath();g.moveTo(x,-5);g.lineTo(x,H+5);g.stroke();});
  YS.forEach((y,j)=>{g.lineWidth=(j===2)?20:RW;g.beginPath();g.moveTo(-5,y);g.lineTo(W+5,y);g.stroke();});
  if(cw>520){
    g.fillStyle=css('--map-label');g.textAlign='center';g.textBaseline='middle';
    g.font=`500 ${10.5/scale}px "DM Mono",monospace`;
    ZONES.forEach(z=>{
      const lab=z.nome.toUpperCase().split('').join(String.fromCharCode(8202));
      const ox=z.id==='parque'?-10:0,oy=z.id==='parque'?52:0;
      g.fillText(lab,z.cx+ox,z.cy+oy+(z.id==='resid'?28:z.id==='estacao'?-70:-82+ (z.id==='shopping'||z.id==='noite'||z.id==='uni'?64:0)));
    });
    g.save();g.translate(430,610);g.rotate(.06);g.globalAlpha=.9;g.fillText('R I O   A L V O R A D A',0,0);g.restore();
  }
}
function drawMap(now,dt){
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(stat,0,0);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
  const px=n=>n/scale,hI=Math.floor((S.t/3600)%24);
  if(mode==='flx'){
    for(const tt of S.totems){
      const rad=18+tt.ewma*7,gr=ctx.createRadialGradient(tt.x,tt.y,0,tt.x,tt.y,rad);
      gr.addColorStop(0,css('--accent'));gr.addColorStop(1,'transparent');
      ctx.globalAlpha=clamp(.2+tt.ewma/10,.2,.7);ctx.fillStyle=gr;ctx.beginPath();ctx.arc(tt.x,tt.y,rad,0,6.3);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  const cM=css('--dot-m'),cF=css('--dot-f');
  for(const tt of S.totems){
    const n=Math.min(16,Math.round(tt.ewma*1.5)),w=tt.wt[hI];
    for(let d=0;d<n;d++){
      const o=tt.dots[d];
      if(playing&&!reduceMotion)o.p+=o.v*dt;
      if(o.p>52||o.p<-52){o.v=-o.v;o.p=clamp(o.p,-52,52);
        let r=rW(),s=0,acc=0;for(;s<NS-1;s++){acc+=w[s];if(r<acc)break;}o.g=s>>2;o.a=s&3;}
      const x=tt.axis==='h'?tt.x+o.p:tt.x+o.o,y=tt.axis==='h'?tt.y+o.o:tt.y+o.p;
      ctx.fillStyle=o.g===0?cM:cF;ctx.globalAlpha=.85;ctx.beginPath();ctx.arc(x,y,px(1.3+o.a*.35)*Math.max(1,scale*1.6),0,6.3);ctx.fill();
    }
  }
  ctx.globalAlpha=1;
  S.pulses=S.pulses.filter(p=>now-p.t0<900);
  for(const p of S.pulses){const tt=S.totems[p.i],k=(now-p.t0)/900;
    ctx.strokeStyle=CRE[tt.cur[0]].cor;ctx.globalAlpha=1-k;ctx.lineWidth=px(2);
    ctx.beginPath();ctx.arc(tt.x,tt.y,px(8)+px(26)*k,0,6.3);ctx.stroke();}
  ctx.globalAlpha=1;
  const bg=css('--map-bg'),ink=css('--ink'),escuro=getComputedStyle(document.documentElement).colorScheme==='dark';
  for(const tt of S.totems){
    const on=tt.id===sel,hv=tt.id===hover,esc=Math.min(1,.5+scale*.6),r=px((on?9:hv?8:6.4)*esc);
    let fc,al=1;
    if(mode==='cri')fc=CRE[tt.cur[0]].cor;else if(mode==='flx')fc=css('--accent');
    else{const g=tt.eng[1]>25?tt.eng[0]/tt.eng[1]-1:null;fc=g==null?css('--muted'):g>=0?css('--good'):css('--bad');al=g==null?.6:.45+.55*Math.min(1,Math.abs(g)/.5);}
    if(escuro){      // a luz do totem acesa na noite
      const raio=px((on?34:26)*esc),gr=ctx.createRadialGradient(tt.x,tt.y,0,tt.x,tt.y,raio);
      gr.addColorStop(0,fc);gr.addColorStop(1,'transparent');
      ctx.globalAlpha=.34*al;ctx.fillStyle=gr;ctx.beginPath();ctx.arc(tt.x,tt.y,raio,0,6.3);ctx.fill();ctx.globalAlpha=1;
    }
    ctx.beginPath();ctx.arc(tt.x,tt.y,r+px(2.2),0,6.3);ctx.fillStyle=on?ink:bg;ctx.fill();
    ctx.beginPath();ctx.arc(tt.x,tt.y,r,0,6.3);
    ctx.globalAlpha=al;ctx.fillStyle=fc;ctx.fill();ctx.globalAlpha=1;
  }
}
function pickTotem(ev){
  const rect=cvs.getBoundingClientRect(),x=(ev.clientX-rect.left)/scale,y=(ev.clientY-rect.top)/scale;
  let b=-1,bd=(16/scale)**2;
  for(const tt of S.totems){const d=(tt.x-x)**2+(tt.y-y)**2;if(d<bd){bd=d;b=tt.id;}}
  return b;
}
const tip=document.getElementById('tip');
cvs.addEventListener('pointermove',ev=>{
  const i=pickTotem(ev);hover=i;
  if(i<0){tip.style.display='none';return;}
  const tt=S.totems[i],rect=cvs.parentElement.getBoundingClientRect();
  tip.innerHTML=`<b>${tt.nome}</b>${CRE[tt.cur[0]].nome} · ${tt.lastN} ${tt.lastN===1?'pessoa':'pessoas'}`;
  tip.style.display='block';
  tip.style.left=Math.min(ev.clientX-rect.left+12,rect.width-230)+'px';tip.style.top=(ev.clientY-rect.top+12)+'px';
});
cvs.addEventListener('pointerleave',()=>{hover=-1;tip.style.display='none';});
cvs.addEventListener('click',ev=>{const i=pickTotem(ev);if(i>=0)select(i);});
