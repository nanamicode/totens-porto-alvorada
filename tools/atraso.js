'use strict';
/* Compara como o algoritmo aprende quando a conversão chega depois da interação (docs/AVALIACAO.md).
   Uso:  npm run atraso -- [--sementes=8] [--passos=8640] [--atraso=240]
   Para cada forma de aprender, as mesmas sementes: conversões do algoritmo, da rotação e do oráculo (as que chegaram e as que ainda estão a caminho no fim). */
const { simular, estatistica } = require('./headless.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), 'true'] : [a.slice(2, i), a.slice(i + 1)]; }));
const N = Number(args.sementes ?? 8), passos = Number(args.passos ?? 8640), atraso = Number(args.atraso ?? 240);
const sementes = Array.from({ length: N }, (_, i) => i + 1);
const formas = [
  { nome: 'sem atraso (referência: 0,5 min)', params: { atraso: 0.5, espera: 0 } },
  { nome: `atraso de ${atraso} min, contando já como falha (espera 0)`, params: { atraso, espera: 0 } },
  ...[1, 2, 3, 6].map(k => ({ nome: `atraso de ${atraso} min, esperando uma janela de ${k} × a média`, params: { atraso, espera: k } })),
];
const pc = (x, d = 1) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
console.log(`${N} sementes · ${passos} passos (${(passos / 2880).toFixed(1)} dias) · conversões do algoritmo sobre as da rotação, e sobre as do oráculo\n`);
for (const f of formas) {
  const rs = simular({ sementes, steps: passos, params: f.params });
  const tot = r => r.conversoes.map((c, p) => c + r.conversoesPendentes[p]);   // chegadas + a caminho: não premia quem converte mais rápido
  const ganho = rs.map(r => tot(r)[0] / tot(r)[1] - 1), ef = rs.map(r => tot(r)[0] / tot(r)[2]);
  const g = estatistica(ganho), e = estatistica(ef);
  console.log(`${f.nome}\n  ganho sobre a rotação ${pc(g.media)} (dp ${pc(g.dp)}, de ${pc(g.min)} a ${pc(g.max)}) · eficiência ${pc(e.media)}`);
}
