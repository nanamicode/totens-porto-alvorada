'use strict';
/* Vista 3D: a mesma cidade em volume, com Three.js (r128, carregado da internet só quando alguém pede o 3D).
   Usa o estado do simulador (totens, pessoas, pulsos de interação) e as mesmas cores do mapa 2D.
   Arraste para girar, role ou aperte as setas e +/− para aproximar, clique num totem para abri-lo. */
const THREE_URL='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const K3=0.1;                                   // 1 unidade 3D = 10 pixels do mapa 2D
let vista3d=false,G3=null,carregandoThree=null,hover3d=-1;
const cv3=$('map3d');

function carregarThree(){
  if(window.THREE)return Promise.resolve();
  if(!carregandoThree)carregandoThree=new Promise((ok,erro)=>{
    const s=document.createElement('script');
    s.src=THREE_URL;s.onload=ok;s.onerror=()=>{carregandoThree=null;erro(new Error('falha ao carregar o Three.js'));};
    document.head.appendChild(s);
  });
  return carregandoThree;
}

const X3=x=>(x-W/2)*K3,Z3=y=>(y-H/2)*K3;

/* textura de janelas acesas, para as paredes dos prédios */
function texturaJanelas(){
  const c=document.createElement('canvas');c.width=64;c.height=128;
  const g=c.getContext('2d'),r=mulberry32(11);
  g.fillStyle='#000';g.fillRect(0,0,64,128);
  for(let y=6;y<124;y+=10)for(let x=6;x<58;x+=10){
    if(r()<.42){g.fillStyle=r()<.8?'#ffffff':'#9ff3ea';g.globalAlpha=.55+r()*.45;g.fillRect(x,y,5,6);}
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,1);
  return t;
}

function brilho(){
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}

function montarCena(){
  const T=THREE,cena=new T.Scene();
  const camera=new T.PerspectiveCamera(45,1.5,1,400);
  const render=new T.WebGLRenderer({canvas:cv3,antialias:true});
  const g={cena,camera,render,cam:{az:-0.62,el:0.9,dist:100},zoomUsuario:false,mats:{},hit:[],totens:[],pulsos:[],ultimoG:new Int8Array(S.totems.length*16).fill(-1)};

  const luzAmb=new T.AmbientLight(0xffffff,.6),sol=new T.DirectionalLight(0xffffff,.6);
  sol.position.set(-40,80,30);cena.add(luzAmb,sol);g.luzAmb=luzAmb;g.sol=sol;

  const janelas=texturaJanelas();
  g.mats.chao=new T.MeshLambertMaterial({color:0x070b10});
  g.mats.predio=new T.MeshLambertMaterial({color:0x1a2736});
  g.mats.predioLado=new T.MeshLambertMaterial({color:0x1a2736,emissiveMap:janelas,emissive:0xffb547});
  g.mats.parque=new T.MeshLambertMaterial({color:0x10312b});
  g.mats.rio=new T.MeshLambertMaterial({color:0x0f2c47});

  const chao=new T.Mesh(new T.PlaneGeometry(W*K3+40,H*K3+40),g.mats.chao);
  chao.rotation.x=-Math.PI/2;cena.add(chao);

  /* quarteirões, divididos em 4 prédios de alturas diferentes */
  const rnd=mulberry32(7),RW=13;
  const alt={uni:3.4,centro:6.6,shopping:4.6,resid:2.4,estacao:4,parque:1,noite:4.6};
  for(let j=0;j<YS.length-1;j++)for(let i=0;i<XS.length-1;i++){
    const x0=XS[i]+RW/2,y0=YS[j]+RW/2,x1=XS[i+1]-RW/2,y1=YS[j+1]-RW/2;
    const z=ZONES[nearestZone((x0+x1)/2,(y0+y1)/2)];
    const parque=z.id==='parque'&&((i+j)%2===0)||(z.id==='uni'&&i===1&&j===1);
    if(parque){
      const m=new T.Mesh(new T.BoxGeometry((x1-x0)*K3,.3,(y1-y0)*K3),g.mats.parque);
      m.position.set(X3((x0+x1)/2),.15,Z3((y0+y1)/2));cena.add(m);continue;
    }
    const w=(x1-x0)/2-3,d=(y1-y0)/2-3;
    for(let a=0;a<2;a++)for(let b=0;b<2;b++){
      const h=Math.max(1,alt[z.id]*(.55+rnd()*.95));
      const mats=[g.mats.predioLado,g.mats.predioLado,g.mats.predio,g.mats.predio,g.mats.predioLado,g.mats.predioLado];
      const m=new T.Mesh(new T.BoxGeometry(w*K3,h,d*K3),mats);
      m.position.set(X3(x0+3+w/2+a*(w+6)),h/2,Z3(y0+3+d/2+b*(d+6)));cena.add(m);
    }
  }

  /* rio: uma fita seguindo a curva do mapa 2D */
  const curva=(t,p)=>{const u=1-t;return u*u*u*p[0]+3*u*u*t*p[1]+3*u*t*t*p[2]+t*t*t*p[3];};
  const pts=[];
  const seg1=[[-30,545],[200,640],[360,500],[560,600]],seg2=[[560,600],[740,680],[880,560],[1010,620]];
  for(const sg of [seg1,seg2])for(let n=0;n<=24;n++){const t=n/24;pts.push([curva(t,sg.map(q=>q[0])),curva(t,sg.map(q=>q[1]))]);}
  const pos=[],idx=[];
  pts.forEach((p,n)=>{
    const q=pts[Math.min(n+1,pts.length-1)],o=pts[Math.max(n-1,0)];
    let tx=q[0]-o[0],ty=q[1]-o[1];const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;
    pos.push(X3(p[0]-ty*19),.08,Z3(p[1]+tx*19),X3(p[0]+ty*19),.08,Z3(p[1]-tx*19));
    if(n<pts.length-1){const a=n*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  });
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
  const rio=new T.Mesh(geo,g.mats.rio);rio.material.side=T.DoubleSide;cena.add(rio);

  /* totens: pilar, tela acesa, brilho e área de clique */
  const texBrilho=brilho();
  S.totems.forEach(tt=>{
    const grupo=new T.Group();grupo.position.set(X3(tt.x),0,Z3(tt.y));
    const pilar=new T.Mesh(new T.CylinderGeometry(.22,.3,1,10),new T.MeshLambertMaterial({color:0x2a3a4c}));
    const tela=new T.Mesh(new T.BoxGeometry(1.1,1.9,.22),new T.MeshBasicMaterial({color:0xffffff}));
    const lum=new T.Sprite(new T.SpriteMaterial({map:texBrilho,color:0xffffff,blending:T.AdditiveBlending,transparent:true,depthWrite:false}));
    const caixa=new T.Mesh(new T.CylinderGeometry(1.5,1.5,11,8),new T.MeshBasicMaterial({visible:false}));
    caixa.position.y=5.5;caixa.userData.id=tt.id;
    if(tt.axis==='v')tela.rotation.y=Math.PI/2;
    grupo.add(pilar,tela,lum,caixa);cena.add(grupo);
    g.totens.push({grupo,pilar,tela,lum});g.hit.push(caixa);
  });
  g.anel=new T.Mesh(new T.TorusGeometry(1.7,.09,8,40),new T.MeshBasicMaterial({color:0xffffff}));
  g.anel.rotation.x=-Math.PI/2;g.anel.position.y=.15;cena.add(g.anel);

  /* pessoas: uma esfera instanciada por ponto */
  g.pessoas=new T.InstancedMesh(new T.SphereGeometry(.4,8,8),new T.MeshBasicMaterial({color:0xffffff}),S.totems.length*16);
  g.pessoas.instanceMatrix.setUsage(T.DynamicDrawUsage);cena.add(g.pessoas);
  g.obj=new T.Object3D();g.cor=new T.Color();

  /* pulsos de interação */
  for(let n=0;n<24;n++){
    const m=new T.Mesh(new T.RingGeometry(.55,.75,32),new T.MeshBasicMaterial({color:0xffffff,transparent:true,side:T.DoubleSide,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.visible=false;cena.add(m);g.pulsos.push(m);
  }
  G3=g;aplicarTema3d();ajustarTamanho3d();
}

/* cores do tema atual (claro ou escuro), lidas dos mesmos tokens do mapa 2D */
function aplicarTema3d(){
  if(!G3)return;
  const T=THREE,escuro=getComputedStyle(document.documentElement).colorScheme==='dark',g=G3;
  g.cena.background=new T.Color(css('--map-bg'));
  g.cena.fog=new T.Fog(css('--map-bg'),95,230);
  g.mats.chao.color.set(css('--map-road'));
  g.mats.predio.color.set(css('--map-block'));
  g.mats.predioLado.color.set(css('--map-block'));
  g.mats.predioLado.emissive.set(escuro?0xffb547:0x000000);
  g.mats.predioLado.emissiveIntensity=escuro?.75:0;
  g.mats.parque.color.set(css('--map-park'));
  g.mats.rio.color.set(css('--map-river'));
  g.luzAmb.color.set(escuro?0x8aa2c4:0xffffff);g.luzAmb.intensity=escuro?.7:.85;
  g.sol.color.set(escuro?0xa9c2ff:0xffffff);g.sol.intensity=escuro?.55:.7;
  g.anel.material.color.set(css('--ink'));
  g.totens.forEach(t=>{t.lum.material.opacity=escuro?.9:.35;});
  g.pessoas.userData.cores=[css('--dot-m'),css('--dot-f')];g.ultimoG.fill(-1);
}

function ajustarTamanho3d(){
  if(!G3)return;
  const caixa=$('canvases'),w=Math.max(280,Math.floor(caixa.clientWidth)),h=Math.round(w*(w<640?.85:H/W));
  G3.render.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  G3.render.setSize(w,h,false);cv3.style.height=h+'px';
  G3.camera.aspect=w/h;G3.camera.updateProjectionMatrix();
  if(!G3.zoomUsuario)G3.cam.dist=100*Math.pow(Math.max(1,(W/H)/G3.camera.aspect),.75);   // em tela estreita, afasta para a cidade caber
}

function desenhar3d(now,dt){
  const T=THREE,g=G3,hI=Math.floor((S.t/3600)%24);
  /* câmera */
  const c=g.cam,cp=Math.cos(c.el);
  g.camera.position.set(Math.sin(c.az)*cp*c.dist,Math.sin(c.el)*c.dist,Math.cos(c.az)*cp*c.dist);
  g.camera.lookAt(0,0,0);
  /* totens */
  const ink=css('--ink');
  S.totems.forEach((tt,i)=>{
    const o=g.totens[i],on=tt.id===sel;
    let cor,fator=1;
    if(mode==='cri')cor=CRE[tt.cur[0]].cor;
    else if(mode==='flx'){cor=css('--accent');fator=.7+Math.min(1.8,tt.ewma*.18);}
    else{const gn=tt.eng[1]>25?tt.eng[0]/tt.eng[1]-1:null;cor=gn==null?css('--muted'):gn>=0?css('--good'):css('--bad');}
    o.grupo.position.set(X3(tt.x),0,Z3(tt.y));o.tela.rotation.y=tt.axis==='v'?Math.PI/2:0;
    const alt=6.2*fator;
    o.pilar.scale.y=alt;o.pilar.position.y=alt/2;
    o.tela.position.y=alt+.4;o.tela.material.color.set(cor);
    o.lum.position.y=alt+.4;o.lum.material.color.set(cor);
    const e=(on?9:hover3d===i?7.5:6)*(on?1.15:1);o.lum.scale.set(e,e,1);
    if(on){g.anel.position.x=o.grupo.position.x;g.anel.position.z=o.grupo.position.z;}
  });
  g.anel.visible=true;
  /* pessoas */
  const hw=S.totems.length,cores=g.pessoas.userData.cores,pesos=S.totems.map(t=>t.wt[hI]);
  let mudou=false;
  S.totems.forEach((tt,i)=>{
    const n=Math.min(16,Math.round(tt.ewma*1.5));
    for(let d=0;d<16;d++){
      const p=tt.dots[d],k=i*16+d;
      if(d<n){
        if(playing&&!reduceMotion)p.p+=p.v*dt;
        if(p.p>52||p.p<-52){p.v=-p.v;p.p=clamp(p.p,-52,52);const r=Math.random(),w=pesos[i];let s=0,ac=0;for(;s<NS-1;s++){ac+=w[s];if(r<ac)break;}p.g=s>>2;p.a=s&3;}
        const x=tt.axis==='h'?tt.x+p.p:tt.x+p.o,y=tt.axis==='h'?tt.y+p.o:tt.y+p.p;
        g.obj.position.set(X3(x),.3,Z3(y));g.obj.scale.setScalar(.8+p.a*.18);
      }else{g.obj.position.set(0,-5,0);g.obj.scale.setScalar(.001);}
      g.obj.updateMatrix();g.pessoas.setMatrixAt(k,g.obj.matrix);
      if(g.ultimoG[k]!==p.g){g.pessoas.setColorAt(k,g.cor.set(cores[p.g]));g.ultimoG[k]=p.g;mudou=true;}
    }
  });
  g.pessoas.instanceMatrix.needsUpdate=true;
  if(mudou&&g.pessoas.instanceColor)g.pessoas.instanceColor.needsUpdate=true;
  /* pulsos */
  S.pulses=S.pulses.filter(p=>now-p.t0<900);
  g.pulsos.forEach((m,n)=>{
    const p=S.pulses[n];
    if(!p){m.visible=false;return;}
    const k=(now-p.t0)/900,o=g.totens[p.i].grupo.position;
    m.visible=true;m.position.set(o.x,.2,o.z);m.scale.setScalar(1+k*5);
    m.material.color.set(CRE[S.totems[p.i].cur[0]].cor);m.material.opacity=1-k;
  });
  g.render.render(g.cena,g.camera);
}

/* interação: girar, aproximar, passar o mouse e clicar */
function totemSob3d(ev){
  const r=cv3.getBoundingClientRect(),T=THREE;
  const ndc=new T.Vector2((ev.clientX-r.left)/r.width*2-1,-((ev.clientY-r.top)/r.height)*2+1);
  const rc=new T.Raycaster();rc.setFromCamera(ndc,G3.camera);
  const h=rc.intersectObjects(G3.hit,false)[0];
  return h?h.object.userData.id:-1;
}
const ponteiros=new Map();let arrastou=false,distPinca=0;
cv3.addEventListener('pointerdown',ev=>{
  try{cv3.setPointerCapture(ev.pointerId);}catch(e){}
  ponteiros.set(ev.pointerId,{x:ev.clientX,y:ev.clientY,x0:ev.clientX,y0:ev.clientY});arrastou=false;
  if(ponteiros.size===2){const [a,b]=[...ponteiros.values()];distPinca=Math.hypot(a.x-b.x,a.y-b.y);}
});
cv3.addEventListener('pointermove',ev=>{
  if(!G3)return;
  const p=ponteiros.get(ev.pointerId);
  if(p){
    const dx=ev.clientX-p.x,dy=ev.clientY-p.y;p.x=ev.clientX;p.y=ev.clientY;
    if(Math.hypot(ev.clientX-p.x0,ev.clientY-p.y0)>5)arrastou=true;
    if(ponteiros.size===1){G3.cam.az-=dx*.0065;G3.cam.el=clamp(G3.cam.el+dy*.005,.2,1.45);}
    else if(ponteiros.size===2){const [a,b]=[...ponteiros.values()],d=Math.hypot(a.x-b.x,a.y-b.y);G3.cam.dist=clamp(G3.cam.dist*(distPinca/d),40,190);G3.zoomUsuario=true;distPinca=d;}
    return;
  }
  const i=totemSob3d(ev);hover3d=i;
  const tip=$('tip');
  if(i<0){tip.style.display='none';cv3.style.cursor='grab';return;}
  const tt=S.totems[i],rect=$('canvases').getBoundingClientRect();
  cv3.style.cursor='pointer';
  tip.innerHTML=`<b>${tt.nome}</b>${CRE[tt.cur[0]].nome} · ${tt.lastN} ${tt.lastN===1?'pessoa':'pessoas'}`;
  tip.style.display='block';
  tip.style.left=Math.min(ev.clientX-rect.left+12,rect.width-230)+'px';tip.style.top=(ev.clientY-rect.top+12)+'px';
});
cv3.addEventListener('pointerup',ev=>{
  const tinhaUm=ponteiros.size===1;ponteiros.delete(ev.pointerId);
  if(tinhaUm&&!arrastou&&G3){const i=totemSob3d(ev);if(i>=0)select(i);}
});
cv3.addEventListener('pointercancel',ev=>{ponteiros.delete(ev.pointerId);});
cv3.addEventListener('pointerleave',()=>{hover3d=-1;$('tip').style.display='none';});
cv3.addEventListener('wheel',ev=>{if(!G3)return;ev.preventDefault();G3.cam.dist=clamp(G3.cam.dist*(1+Math.sign(ev.deltaY)*.08),40,190);G3.zoomUsuario=true;},{passive:false});
cv3.tabIndex=0;
cv3.addEventListener('keydown',ev=>{
  if(!G3)return;const c=G3.cam;
  if(ev.key==='ArrowLeft')c.az+=.12;else if(ev.key==='ArrowRight')c.az-=.12;
  else if(ev.key==='ArrowUp')c.el=clamp(c.el+.08,.2,1.45);else if(ev.key==='ArrowDown')c.el=clamp(c.el-.08,.2,1.45);
  else if(ev.key==='+'||ev.key==='='){c.dist=clamp(c.dist*.92,40,190);G3.zoomUsuario=true;}else if(ev.key==='-'){c.dist=clamp(c.dist*1.08,40,190);G3.zoomUsuario=true;}
  else return;
  ev.preventDefault();
});

/* alternância 2D / 3D */
async function escolherVista(v){
  const msg=$('msg3d');
  [...$('segView').children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===v)));
  if(v==='2d'){
    vista3d=false;cv3.hidden=true;msg.hidden=true;$('hint3d').hidden=true;$('map').hidden=false;$('tip').style.display='none';
    return;
  }
  msg.hidden=false;msg.textContent='Carregando a vista 3D…';
  try{
    await carregarThree();
    if(!G3)montarCena();
    vista3d=true;$('map').hidden=true;cv3.hidden=false;msg.hidden=true;$('hint3d').hidden=false;ajustarTamanho3d();aplicarTema3d();
  }catch(e){
    vista3d=false;$('map').hidden=false;cv3.hidden=true;
    msg.hidden=false;msg.textContent='A vista 3D precisa baixar o Three.js da internet e não conseguiu. Confira a conexão e tente de novo.';
    [...$('segView').children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v==='2d')));
    setTimeout(()=>{if(!vista3d)msg.hidden=true;},5000);
  }
}
$('segView').addEventListener('click',e=>{const b=e.target.closest('button');if(b)escolherVista(b.dataset.v);});
new ResizeObserver(()=>ajustarTamanho3d()).observe($('canvases'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>setTimeout(aplicarTema3d,60));
