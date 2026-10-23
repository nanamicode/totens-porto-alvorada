'use strict';
/* Avalia o algoritmo com várias sementes e mostra o ganho médio e a variação.
   Uso:  npm run avaliar
         node tools/avaliar.js --sementes=10 --passos=2880 --kt=0 --kz=0 --evento=chuva --pausar=0,3

   --sementes=N   número de sementes (padrão 10)
   --passos=N     spots de 30 s por semente (padrão 2880 = 1 dia, a partir das 06:00 de segunda)
   --acc --kz --kt --rest --forget --look --corrige --estima --contexto --kp   parâmetros do algoritmo e da câmera
   --horario=N    multiplica o efeito do horário no mundo simulado (1 = padrão)
   --desgaste=N   multiplica o desgaste do mundo simulado (1 = padrão)
   --evento=a,b   cenários ligados: chuva, show, greve, feriado
   --pausar=0,3   índices das campanhas pausadas desde o início */
const { simular, resumo, estatistica } = require('./headless.js');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? 'true'];
}));
const sementes = Number(args.sementes ?? 10);
const passos = Number(args.passos ?? 2880);
const params = {};
for (const k of ['acc', 'kz', 'kt', 'rest', 'forget', 'look', 'corrige', 'estima', 'contexto', 'kp']) if (args[k] !== undefined) params[k] = Number(args[k]);
const escalaHorario = args.horario ? Number(args.horario) : undefined;
const escalaDesgaste = args.desgaste ? Number(args.desgaste) : undefined;
const eventos = args.evento ? args.evento.split(',') : [];
const pausadas = args.pausar ? args.pausar.split(',').map(Number) : [];

const pct = (x, d = 1) => (100 * x).toFixed(d).padStart(5) + '%';
const linhas = [];
const t0 = Date.now();
for (let seed = 1; seed <= sementes; seed++) {
  const r = resumo(simular({ seed, steps: passos, params, eventos, pausadas, escalaHorario, escalaDesgaste }));
  linhas.push(r);
  console.log(`semente ${String(seed).padStart(2)}  ganho ${pct(r.ganho)}  eficiência algoritmo ${pct(r.efAlgoritmo)}  rotação ${pct(r.efRotacao)}  melhor criativo certo em ${r.acertos}/${r.perfis} perfis`);
}

const col = f => estatistica(linhas.map(f));
const resumoCol = (nome, e, fmtv) => console.log(`${nome.padEnd(34)} média ${fmtv(e.media)}  desvio ${fmtv(e.dp)}  mín ${fmtv(e.min)}  máx ${fmtv(e.max)}`);
const g = col(r => r.ganho);
console.log('\nResumo');
console.log(`Sementes: ${sementes} · spots por semente: ${passos} (${(passos / 120).toFixed(1)} h simuladas)`);
if (Object.keys(params).length) console.log('Parâmetros:', JSON.stringify(params));
if (eventos.length) console.log('Cenários:', eventos.join(', '));
if (escalaHorario) console.log('Efeito do horário no mundo: x' + escalaHorario);
if (escalaDesgaste) console.log('Desgaste do mundo: x' + escalaDesgaste);
if (pausadas.length) console.log('Campanhas pausadas:', pausadas.join(', '));
resumoCol('Ganho sobre a rotação fixa', g, v => pct(v));
resumoCol('Eficiência do algoritmo', col(r => r.efAlgoritmo), v => pct(v));
resumoCol('Eficiência da rotação fixa', col(r => r.efRotacao), v => pct(v));
resumoCol('Perfis com o melhor criativo certo', col(r => r.acertos), v => v.toFixed(1).padStart(5));
const meia = 1.96 * g.dp / Math.sqrt(g.n);
console.log(`\nGanho médio: ${pct(g.media)} (intervalo de 95% da média: ${pct(g.media - meia)} a ${pct(g.media + meia)})`);
console.log(`Tempo: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
