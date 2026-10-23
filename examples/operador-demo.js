'use strict';
/* O Operador em malha fechada, como um sistema de totens reais o usaria: só pela API pública.
   Uso: node examples/operador-demo.js [--por-spot]

   Seis totens em duas zonas, 4 criativos e os 8 perfis. A cada spot, cada totem lê quem está à frente,
   pergunta ao Operador o que exibir, e ao fim envia um evento de spot. A taxa verdadeira de interação
   fica só neste arquivo. Com --por-spot, o evento traz só o total de interações, como num totem só com QR. */
const Operador = require('../site/js/operador.js');
const Eventos = require('../site/js/eventos.js');
const { mulberry32 } = require('../site/js/util.js');

const CRIATIVOS = ['academia', 'cinema', 'clinica', 'cafe'];
const TAXA = [   // taxa verdadeira [perfil][criativo], na ordem de Eventos.PERFIS
  [0.060, 0.040, 0.010, 0.030], [0.050, 0.040, 0.015, 0.040], [0.030, 0.020, 0.030, 0.050], [0.010, 0.010, 0.060, 0.030],
  [0.040, 0.060, 0.010, 0.030], [0.030, 0.050, 0.020, 0.040], [0.020, 0.020, 0.040, 0.050], [0.010, 0.010, 0.070, 0.030],
];
const MIX = {    // quem passa em cada zona
  jovem: [0.20, 0.20, 0.07, 0.03, 0.20, 0.20, 0.07, 0.03],
  maduro: [0.03, 0.07, 0.20, 0.20, 0.03, 0.07, 0.20, 0.20],
};
const cadastro = {
  totens: [0, 1, 2, 3, 4, 5].map(i => ({ id: Eventos.idTotem(i), nome: 'Totem ' + (i + 1), zona: i < 3 ? 'jovem' : 'maduro' })),
  criativos: CRIATIVOS.map(id => ({ id, nome: id })),
};

function rodar({ spots = 2000, porSpot = false, seed = 1 } = {}) {
  const mundo = mulberry32(seed), op = Operador.criar({ cadastro, rng: mulberry32(seed + 100) });
  let comOperador = 0, comRodizio = 0, olhares = 0;
  for (let spot = 0; spot < spots; spot++) {
    const t = 6 * 3600 + spot * 30;
    cadastro.totens.forEach((totem, i) => {
      const aud = PERFIL_VAZIO(), mix = MIX[totem.zona];
      const pessoas = [];
      for (let k = 0; k < 5; k++) {
        let r = mundo(), s = 0;
        while (s < 7 && r > mix[s]) { r -= mix[s]; s++; }
        pessoas.push(s); aud[s]++;
      }
      const leitura = Object.fromEntries(Eventos.PERFIS.map((p, s) => [p, aud[s]]));
      const { criativo } = op.decidir({ totem: totem.id, leitura, quando: Eventos.instante(t) });
      const c = CRIATIVOS.indexOf(criativo), rodizio = (spot + i) % CRIATIVOS.length;
      const hits = PERFIL_VAZIO();
      for (const s of pessoas) {
        const u = mundo();
        if (u < TAXA[s][c]) { hits[s]++; comOperador++; }
        if (u < TAXA[s][rodizio]) comRodizio++;
        olhares++;
      }
      const total = hits.reduce((a, b) => a + b, 0);
      op.registrar(Eventos.criar({ totem: i, t, duracao: 30, criativo, audiencia: aud, interacoes: porSpot ? total : hits }));
    });
  }
  return { op, comOperador, comRodizio, olhares };
}
function PERFIL_VAZIO() { return new Array(8).fill(0); }

/* melhor criativo verdadeiro de cada perfil, para comparar com o que o Operador aprendeu */
const verdade = TAXA.map(l => CRIATIVOS[l.indexOf(Math.max(...l))]);

module.exports = { rodar, verdade, cadastro };

if (require.main === module) {
  const porSpot = process.argv.includes('--por-spot');
  const { op, comOperador, comRodizio, olhares } = rodar({ porSpot });
  console.log(`Interações enviadas ${porSpot ? 'só como total por spot' : 'por perfil'}.`);
  console.log(`Olhares: ${olhares} · Operador: ${comOperador} (${(1000 * comOperador / olhares).toFixed(1)} por 1.000) · rodízio: ${comRodizio} (${(1000 * comRodizio / olhares).toFixed(1)} por 1.000) · ganho ${((comOperador / comRodizio - 1) * 100).toFixed(0)}%`);
  const ap = op.aprendido();
  let certos = 0;
  console.log('\nO que o Operador aprendeu (aprendido | verdadeiro):');
  Eventos.PERFIS.forEach((p, s) => { const ok = ap.melhor[p] === verdade[s]; if (ok) certos++; console.log(`  ${p.padEnd(7)} ${ap.melhor[p].padEnd(9)} | ${verdade[s].padEnd(9)} ${ok ? 'ok' : 'diferente'}`); });
  console.log(`Acertos: ${certos}/8 · eventos aceitos: ${op.estado().eventos.aceitos}`);
}
