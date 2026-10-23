'use strict';
/* Utilitários: gerador pseudoaleatório, distribuições (Gamma, Beta, Poisson) e funções matemáticas. */
const pk=(h,mu,sg)=>{let d=Math.abs(h-mu);d=Math.min(d,24-d);return Math.exp(-.5*(d/sg)*(d/sg));};
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const norm=r=>{let u=0;while(u===0)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*r());};
function gammaS(k,r){if(k<1)return gammaS(k+1,r)*Math.pow(r(),1/k);const d=k-1/3,c=1/Math.sqrt(9*d);for(;;){let x,v;do{x=norm(r);v=1+c*x;}while(v<=0);v=v*v*v;const u=r();if(u<1-.0331*x*x*x*x||Math.log(u)<.5*x*x+d*(1-v+Math.log(v)))return d*v;}}
function betaS(a,b,r){if(a+b>60){const m=a/(a+b),sd=Math.sqrt(m*(1-m)/(a+b+1));return clamp(m+sd*norm(r),1e-4,.5);}const x=gammaS(a,r),y=gammaS(b,r);return x/(x+y);}
function poisson(l,r){const L=Math.exp(-l);let k=0,p=1;do{k++;p*=r();}while(p>L&&k<60);return k-1;}
