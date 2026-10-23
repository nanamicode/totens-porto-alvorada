'use strict';
/* Mede o que acontece quando um criativo novo entra com a rede já operando (docs/AVALIACAO.md).
   Uso:  npm run lancar -- [--sementes=6] [--antes=2880] [--depois=5760] [--qualidade=1,0.5,0.3]
   O criativo novo (Orla Sorvetes) entra no passo --antes, sem nenhuma contagem aprendida. Para cada qualidade (× a taxa dele):
   quanto o algoritmo leva para testá-lo (exibido em metade dos totens) e para adotá-lo (exibe em 80% dos spots em que o oráculo o exibe). */
const { simular, estatistica } = require('./headless.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), 'true'] : [a.slice(2, i), a.slice(i + 1)]; }));
const N = Number(args.sementes ?? 6), antes = Number(args.antes ?? 2880), depois = Number(args.depois ?? 5760);
const qualidades = (args.qualidade ?? '1,0.5,0.3').split(',').map(Number);
const sementes = Array.from({ length: N }, (_, i) => i + 1);
const min = p => p * 0.5;                                    // 1 passo = 30 s
const fmtMin = m => m >= 120 ? (m / 60).toFixed(1).replace('.', ',') + ' h' : Math.round(m) + ' min';
const pc = x => (x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
console.log(`${N} sementes · criativo novo entra após ${(antes / 120).toFixed(0)} h · observado por ${(depois / 120).toFixed(0)} h\n`);
for (const q of qualidades) {
  const rs = simular({ sementes, steps: antes + depois, params: { qnovo: q }, sessao: [{ passo: antes, tipo: 'campanha', chave: 7, valor: true }] });
  const L = rs.map(r => r.lancamento);
  const testes = L.filter(l => l.testadoEm !== null).map(l => min(l.testadoEm)), adotados = L.filter(l => l.adotadoEm !== null).map(l => min(l.adotadoEm));
  const usa = L.filter(l => l.oraculoJa).length;
  const fatia = p => estatistica(rs.map(r => r.porCriativo[p].spots[7] / (depois * r.totens))).media;
  console.log(`qualidade ${q} × a taxa do criativo`);
  console.log(`  o oráculo o escolheu em algum momento em ${usa} de ${N} sementes · fatia dos spots no período: oráculo ${pc(fatia(2))}, algoritmo ${pc(fatia(0))}, rotação ${pc(fatia(1))}`);
  console.log(`  testado (metade dos totens) em ${testes.length} de ${N}` + (testes.length ? `: mediana ${fmtMin(testes.sort((a, b) => a - b)[testes.length >> 1])}` : ''));
  console.log(`  adotado em ${adotados.length} de ${N}` + (adotados.length ? `: mediana ${fmtMin(adotados.sort((a, b) => a - b)[adotados.length >> 1])}, de ${fmtMin(Math.min(...adotados))} a ${fmtMin(Math.max(...adotados))}` : ''));
}
