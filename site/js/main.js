'use strict';
/* Início: laço de animação, controles da barra superior e inicialização. */
/* ---------- Laço principal ---------- */
let last=performance.now(),debt=0;
function frame(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(emLote){requestAnimationFrame(frame);return;}      // a execução com várias sementes usa o mundo no lugar do ao vivo
  if(ffTarget){
    const t0=performance.now();
    while(S.t<ffTarget&&performance.now()-t0<24)step();
    $('ffMsg').textContent=S.t>=ffTarget?'':`Avançando… ${Math.round(100-100*(ffTarget-S.t)/86400)}%`;
    if(S.t>=ffTarget){ffTarget=0;$('ffMsg').textContent='';}
  }else if(playing){
    debt+=dt*speed*2;
    const t0=performance.now();
    while(debt>=1&&performance.now()-t0<10){step();debt--;}
    if(debt>60)debt=60;
  }
  if(vista3d&&G3)desenhar3d(now,dt);else drawMap(now,dt);
  if(now-lastUI>250){lastUI=now;renderUI(now);}
  requestAnimationFrame(frame);
}

/* ---------- Controles ---------- */
$('btnPlay').addEventListener('click',()=>setPlaying(!playing));
$('segSpeed').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;speed=+b.dataset.v;
  [...$('segSpeed').children].forEach(x=>x.setAttribute('aria-pressed',x===b));if(!playing)setPlaying(true);});
$('segMode').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;mode=b.dataset.v;
  [...$('segMode').children].forEach(x=>x.setAttribute('aria-pressed',x===b));});
$('btnDay').addEventListener('click',()=>{if(!emLote)ffTarget=S.t+86400;});
$('btnReset').addEventListener('click',()=>{if(emLote)return;ffTarget=0;debt=0;init(Math.floor(Math.random()*1e9));buildSelect();for(let k=0;k<10;k++)step();lastHeat=0;renderUI(performance.now());});
$('chkTruth').addEventListener('change',e=>{showTruth=e.target.checked;renderHeat();});
new ResizeObserver(()=>{buildStatic();}).observe(cvs.parentElement);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>setTimeout(buildStatic,50));

init(20261022);
buildSelect();
for(let k=0;k<10;k++)step();
buildStatic();
renderUI(performance.now());
requestAnimationFrame(frame);
