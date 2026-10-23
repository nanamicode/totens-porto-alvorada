'use strict';
/* Roda o simulador completo (mundo, Brain, rotação e oráculo) sem navegador.
   Lê os mesmos arquivos de site/js, na mesma ordem do index.html, e os executa dentro de uma função isolada.
   Só os arquivos sem interface entram: util, config, world, brain e sim. */
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', 'site', 'js');
const ler = nome => fs.readFileSync(path.join(JS, nome + '.js'), 'utf8');

/* Código executado por simulação. Entre os arquivos, só entram os trechos que os conectam no navegador
   (os globais criados por util.js e brain.js). */
const CORPO = `
'use strict';
const self = {}, module = undefined;
${ler('util')}
const { pk, clamp, mulberry32, norm, gammaS, betaS, poisson, f2, fmt, pc, per1k } = self.Util;
${ler('config')}
${ler('world')}
${ler('brain')}
const Brain = self.Brain;
${ler('sim')}
sel = -1;                                  // sem rastreio de cálculos: mais rápido
Object.assign(PRM, opts.params || {});
(opts.eventos || []).forEach(k => { EV[k] = true; });
(opts.pausadas || []).forEach(c => { CON[c] = false; });
init(opts.seed);
if (opts.escalaDesgaste) S.totems.forEach(t => { t.r *= opts.escalaDesgaste; });
if (opts.desgasteVerdadeiro) brain.setRest(i => S.totems[i].r);
for (let k = 0; k < opts.steps; k++) step();
const G = brain.cells.G, melhor = [], verdade = [];
for (let s = 0; s < NS; s++) {
  let b = 0, tb = 0, vb = -1, vt = -1;
  for (let c = 0; c < NC; c++) {
    const k = s * NC + c, v = (G.a[k] + .2) / (G.n[k] + 10);
    if (CON[c] && v > vb) { vb = v; b = c; }
    const cr = CRE[c];
    let m = 0; ZONES.forEach(z => { m += cr.zone[z.id] ?? 1; });
    const t = cr.base * cr.age[s & 3] * cr.gen[s >> 2] * m / ZONES.length;
    if (CON[c] && t > vt) { vt = t; tb = c; }
  }
  melhor.push(b); verdade.push(tb);
}
return {
  olhares: S.tot.v, interacoes: S.tot.e,
  bins: S.bins.map(b => b.e), binsOlhares: S.bins.map(b => b.v),
  porCriativo: S.cs.map(c => ({ olhares: Array.from(c.v), interacoes: Array.from(c.e), spots: Array.from(c.s) })),
  zonas: ZONES.map((z, zi) => ({ id: z.id, interacoes: [0, 1, 2].map(p => S.totems.filter(t => t.zi === zi).reduce((a, t) => a + t.eng[p], 0)) })),
  desgaste: S.totems.map(t => ({ zona: t.zi, real: t.r, estimado: brain.rest(t.id) })),
  melhor, verdade, totens: S.totems.length,
};`;

const executar = new Function('opts', 'performance', CORPO);

/* opts.seed       semente do mundo e do algoritmo
   opts.steps      spots de 30 s (2880 = um dia, começando às 06:00 de segunda)
   opts.params     sobrescreve parâmetros do algoritmo e da câmera (acc, kz, kt, rest, forget, look)
   opts.eventos    cenários ligados desde o início (chuva, show, greve, feriado)
   opts.pausadas   índices de campanhas pausadas desde o início */
function simular(opts = {}) {
  return executar({ seed: 1, steps: 2880, ...opts }, performance);
}

/* eficiência = interações da política / interações do oráculo, somadas num intervalo de bins de 15 min */
function eficiencia(bins, politica, de = 0, ate = bins.length) {
  let a = 0, o = 0;
  for (let k = de; k < ate; k++) { a += bins[k][politica]; o += bins[k][2]; }
  return o > 0 ? a / o : 0;
}

function resumo(r) {
  const [alg, rot, orc] = r.interacoes;
  const n = r.bins.length;
  return {
    ganho: alg / rot - 1,
    efAlgoritmo: alg / orc,
    efRotacao: rot / orc,
    efInicio: eficiencia(r.bins, 0, 0, Math.min(12, n)),
    efFim: eficiencia(r.bins, 0, Math.max(0, n - 12), n),
    acertos: r.melhor.filter((c, s) => c === r.verdade[s]).length,
    perfis: r.melhor.length,
  };
}

function estatistica(v) {
  const n = v.length, media = v.reduce((a, b) => a + b, 0) / n;
  const dp = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : 0;
  return { media, dp, min: Math.min(...v), max: Math.max(...v), n };
}

module.exports = { simular, resumo, estatistica, eficiencia };
