'use strict';
/* Demonstração do Brain fora do navegador, com um mundo mínimo escrito aqui mesmo.
   Uso: node examples/brain-demo.js

   O mundo tem 3 totens em 2 zonas, 4 perfis e 3 criativos. O Brain só recebe a audiência
   que "a câmera viu" e as interações. A taxa verdadeira fica neste arquivo. */
const Brain = require('../site/js/brain.js');
const { mulberry32 } = require('../site/js/util.js');

const PERFIS = ['Homem jovem', 'Mulher jovem', 'Homem 35+', 'Mulher 35+'];
const CRIATIVOS = ['Academia', 'Cinema', 'Clínica'];
// taxa verdadeira de interação [perfil][criativo]
const TAXA = [
  [0.060, 0.030, 0.008],
  [0.035, 0.055, 0.010],
  [0.015, 0.012, 0.045],
  [0.010, 0.020, 0.065],
];
const ZONA_DO_TOTEM = [0, 0, 1];
const MIX = [[0.40, 0.40, 0.10, 0.10], [0.40, 0.40, 0.10, 0.10], [0.10, 0.10, 0.40, 0.40]];
const SPOTS = 20000;

const rngMundo = mulberry32(1);
const brain = Brain.create({
  nSeg: PERFIS.length, nCre: CRIATIVOS.length, nZones: 2,
  zoneOf: ZONA_DO_TOTEM, rng: mulberry32(2),
});

let cliquesBrain = 0, cliquesRodizio = 0, olhares = 0;
for (let spot = 0; spot < SPOTS; spot++) {
  if (spot % 120 === 0) brain.forget();              // 1 hora = 120 spots de 30 s
  for (let totem = 0; totem < ZONA_DO_TOTEM.length; totem++) {
    // chegam 5 pessoas; a câmera vê o perfil de cada uma
    const audiencia = new Float64Array(PERFIS.length), perfis = [];
    for (let k = 0; k < 5; k++) {
      let r = rngMundo(), s = 0;
      while (s < PERFIS.length - 1 && r > MIX[totem][s]) { r -= MIX[totem][s]; s++; }
      perfis.push(s); audiencia[s]++;
    }
    const { c } = brain.choose(totem, audiencia, perfis.length);
    const rodizio = (spot + totem) % CRIATIVOS.length;
    for (const s of perfis) {
      const u = rngMundo();
      const hit = u < TAXA[s][c];
      brain.learn(totem, s, c, hit);
      if (hit) cliquesBrain++;
      if (u < TAXA[s][rodizio]) cliquesRodizio++;
      olhares++;
    }
    brain.expose(totem, c, perfis.length);
  }
  brain.decay(0.995);
}

console.log(`Olhares: ${olhares}`);
console.log(`Interações com o Brain:  ${cliquesBrain} (${(1000 * cliquesBrain / olhares).toFixed(1)} por 1.000)`);
console.log(`Interações com rodízio:  ${cliquesRodizio} (${(1000 * cliquesRodizio / olhares).toFixed(1)} por 1.000)`);
console.log(`Ganho: ${((cliquesBrain / cliquesRodizio - 1) * 100).toFixed(0)}%\n`);
console.log('O que o totem 0 aprendeu, por perfil (aprendido | verdadeiro):');
PERFIS.forEach((nome, s) => {
  const medias = CRIATIVOS.map((_, c) => brain.mean(0, s, c));
  const apr = medias.indexOf(Math.max(...medias));
  const ver = TAXA[s].indexOf(Math.max(...TAXA[s]));
  console.log(`  ${nome.padEnd(12)} ${CRIATIVOS[apr].padEnd(9)} | ${CRIATIVOS[ver].padEnd(9)} ${apr === ver ? 'ok' : 'diferente'}`);
});
