'use strict';
/* Compara duas configurações do algoritmo nas mesmas sementes (mesma audiência) e mostra a diferença com o erro.
   Uso:  npm run comparar -- --a=padrao --b=sem-compartilhar
         node tools/comparar.js --a=padrao --b=kz=0,kt=0 --sementes=8 --passos=1440 --horario=3 --evento=chuva

   --a, --b       uma receita (padrao, sem-compartilhar, sem-desgaste, desgaste-zero, com-horario, camera-ruim, nunca-esquece)
                  ou campos sobre o padrão: acc, kz, kt, rest, forget, corrige, estima, contexto, kp (ex.: kz=0,kt=0)
   --sementes=N   número de sementes (padrão 8)       --passos=N   spots de 30 s por semente (padrão 1440 = 12 h)
   --horario=N    efeito do horário no mundo (1)      --desgaste=N desgaste do mundo (1)
   --evento=a,b   cenários ligados (chuva, show, greve, feriado)    --pausar=0,3   campanhas pausadas
   --cpm=R        preço por mil olhares, para o custo por interação (padrão 18) */
const { simular } = require('./headless.js');
const C = require('../site/js/comparacao.js');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), 'true'] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
if (args.a === undefined || args.b === undefined) {
  console.error('Informe as duas configurações: --a=... --b=...\nReceitas: ' + C.PRESETS.map(p => p.id).join(', '));
  process.exit(1);
}
let A, B;
try { A = C.ler(args.a); B = C.ler(args.b); } catch (e) { console.error(e.message); process.exit(1); }
const sementes = Number(args.sementes ?? 8), passos = Number(args.passos ?? 1440), cpm = Number(args.cpm ?? 18);
const base = {
  steps: passos,
  escalaHorario: args.horario ? Number(args.horario) : undefined,
  escalaDesgaste: args.desgaste ? Number(args.desgaste) : undefined,
  eventos: args.evento ? args.evento.split(',') : [],
  pausadas: args.pausar ? args.pausar.split(',').map(Number) : [],
};

function linha(seed, params) {
  const r = simular({ seed, ...base, params });
  const [alg, rot, orc] = r.interacoes;
  return { ganho: alg / rot - 1, efAlgoritmo: alg / orc, acertos: r.melhor.filter((c, s) => c === r.verdade[s]).length, interacoes: alg, custo: cpm * r.olhares / 1000 / alg };
}

const t0 = Date.now(), la = [], lb = [];
for (let seed = 1; seed <= sementes; seed++) {
  la.push(linha(seed, A.params));
  lb.push(linha(seed, B.params));
  console.log(`semente ${String(seed).padStart(2)}  ganho A ${pp(la[seed - 1].ganho)}  B ${pp(lb[seed - 1].ganho)}  diferença ${pp(lb[seed - 1].ganho - la[seed - 1].ganho, true)}`);
}
function pp(x, sinal) { return ((sinal && x >= 0 ? '+' : '') + (x * 100).toFixed(1).replace('.', ',') + '%').padStart(7); }
const pontos = (x, sinal) => (sinal && x >= 0 ? '+' : '') + (x * 100).toFixed(2).replace('.', ',') + ' pontos';

const P = C.pareadas(la, lb);
const dif = C.diferencas(A.params, B.params);
console.log(`\nA: ${A.nome}\nB: ${B.nome}`);
console.log('Diferem em: ' + (dif.length ? dif.map(d => `${d.k} ${d.a} → ${d.b}`).join(' · ') : 'nada (configurações iguais)'));
console.log(`Sementes: ${sementes} · ${(passos / 120).toFixed(1)} h simuladas por semente${base.eventos.length ? ' · cenários: ' + base.eventos.join(', ') : ''}${base.escalaHorario ? ' · horário x' + base.escalaHorario : ''}${base.escalaDesgaste ? ' · desgaste x' + base.escalaDesgaste : ''}\n`);
const linhaTabela = (nome, c, f) => console.log(`${nome.padEnd(30)} A ${f(c.A.media).padStart(10)}  B ${f(c.B.media).padStart(10)}  B − A ${f(c.dif.media, true).padStart(14)} ± ${f(c.dif.ep).replace('+', '').padStart(10)}`);
linhaTabela('Ganho sobre a rotação', P.ganho, (x, s) => pontos(x, s).replace(' pontos', '%').replace('pontos', '%'));
linhaTabela('Eficiência do algoritmo', P.efAlgoritmo, (x, s) => pontos(x, s).replace(' pontos', '%'));
linhaTabela('Perfis com o melhor criativo certo', P.acertos, (x, s) => (s && x >= 0 ? '+' : '') + x.toFixed(2).replace('.', ','));
linhaTabela('Custo por interação (R$)', P.custo, (x, s) => (s && x >= 0 ? '+' : '') + x.toFixed(3).replace('.', ','));
console.log('\n' + C.frase(P.ganho.dif, (x, s) => pontos(x, s)));
console.log(`Tempo: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
