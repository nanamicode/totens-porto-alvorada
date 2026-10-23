'use strict';
/* Mede o equilíbrio entre desempenho e metas de entrega (docs/AVALIACAO.md).
   Uso:  npm run metas -- [--sementes=5] [--passos=11520] [--ritmo=0,0.5,1,2] [--escala=1]
   Para cada força de ritmo, nas mesmas sementes: ganho de interações sobre a rotação, cumprimento das metas (algoritmo e rotação),
   a campanha mais atrasada e os olhares entregues além do que o orçamento paga. Só dias completos entram no cumprimento. */
const { simular, estatistica } = require('./headless.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), 'true'] : [a.slice(2, i), a.slice(i + 1)]; }));
const N = Number(args.sementes ?? 5), passos = Number(args.passos ?? 11520), escala = Number(args.escala ?? 1);
const ritmos = (args.ritmo ?? '0,0.5,1,2').split(',').map(Number);
const sementes = Array.from({ length: N }, (_, i) => i + 1);
const pc = x => (x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const cumpr = (r, p) => {
  const cs = r.metas.campanhas.filter(c => c.meta > 0);
  return cs.reduce((a, c) => a + c.cumprimento[p] * c.meta, 0) / cs.reduce((a, c) => a + c.meta, 0);   // ponderado pela meta
};
const pior = (r, p) => Math.min(...r.metas.campanhas.filter(c => c.meta > 0).map(c => c.cumprimento[p]));
const exced = (r, p) => r.metas.campanhas.reduce((a, c) => a + c.excedente[p], 0) / (r.olhares * (r.metas.dias / (passos / 2880)));
console.log(`${N} sementes · ${passos} passos (${r2(passos / 2880)} dias, ${'dias completos entram no cumprimento'}) · metas × ${escala}\n`);
function r2(x) { return x.toFixed(1); }
let rot = null;
for (const rit of ritmos) {
  const rs = simular({ sementes, steps: passos, params: { ritmo: rit, metaEsc: escala } });
  const ganho = estatistica(rs.map(r => r.interacoes[0] / r.interacoes[1] - 1)), ef = estatistica(rs.map(r => r.interacoes[0] / r.interacoes[2]));
  const c0 = estatistica(rs.map(r => cumpr(r, 0))), p0 = estatistica(rs.map(r => pior(r, 0))), e0 = estatistica(rs.map(r => exced(r, 0)));
  if (!rot) rot = { c: estatistica(rs.map(r => cumpr(r, 1))), p: estatistica(rs.map(r => pior(r, 1))), e: estatistica(rs.map(r => exced(r, 1))) };
  console.log(`ritmo ${rit}: ganho de interações ${pc(ganho.media)} (dp ${pc(ganho.dp)}) · eficiência ${pc(ef.media)} · metas cumpridas ${pc(c0.media)} · campanha mais atrasada ${pc(p0.media)} · além do orçamento ${pc(e0.media)} dos olhares`);
}
console.log(`rotação fixa (referência, sem metas): metas cumpridas ${pc(rot.c.media)} · campanha mais atrasada ${pc(rot.p.media)} · além do orçamento ${pc(rot.e.media)} dos olhares`);
