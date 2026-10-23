'use strict';
/* Refaz um cenário salvo (docs/CENARIOS.md) ou cria um novo, sem navegador.
   Uso:  npm run cenario -- docs/exemplos/cenario-exemplo.json
         npm run cenario -- --novo --semente=2 --passos=1440 --evento=chuva --nome="Chuva forte" > cenario.json

   Refazer: valida o arquivo, roda a sessão do zero e, se o cenário traz os números salvos, confere os olhares e as
   interações. Códigos de saída: 0 refeito (e conferido, se havia números), 2 arquivo inválido, 4 números diferentes.
   --novo: grava um cenário a partir de opções, com os números desta execução.
     --semente=N  --passos=N (spots de 30 s, padrão 1440)  --evento=chuva,greve  --pausar=0,3  --nome="..."
     --kz=0 --kt=0 e os demais parâmetros: acc, kz, kt, rest, forget, look, cpm, val, corrige, estima, contexto, kp, atraso, espera, qnovo */
const fs = require('fs');
const { simular } = require('./headless.js');
const Cenario = require('../site/js/cenario.js');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  if (!a.startsWith('--')) return ['arquivo', a];
  const i = a.indexOf('=');
  return i < 0 ? [a.slice(2), 'true'] : [a.slice(2, i), a.slice(i + 1)];
}));

if (args.novo) {
  const params = {};
  for (const k of Cenario.PARAMS) if (args[k] !== undefined) params[k] = Number(args[k]);
  const r = simular({
    seed: Number(args.semente ?? 1), steps: Number(args.passos ?? 1440), params,
    eventos: args.evento ? args.evento.split(',') : [], pausadas: args.pausar ? args.pausar.split(',').map(Number) : [],
    nomeCenario: args.nome || '',
  });
  const v = Cenario.validar(r.cenario);
  if (!v.ok) { console.error('Cenário inválido: ' + v.erros.join('; ')); process.exit(2); }
  console.log(JSON.stringify(r.cenario, null, 1));
  process.exit(0);
}

if (!args.arquivo) {
  console.error('Informe o arquivo do cenário, ou use --novo. Exemplo: npm run cenario -- docs/exemplos/cenario-exemplo.json');
  process.exit(2);
}
let c;
try { c = JSON.parse(fs.readFileSync(args.arquivo, 'utf8')); } catch (e) { console.error(`Não consegui ler ${args.arquivo}: ${e.message}`); process.exit(2); }
const v = Cenario.validar(c);
if (!v.ok) { console.error('Cenário inválido:\n- ' + v.erros.join('\n- ')); process.exit(2); }

const t0 = Date.now();
const r = simular({ cenario: c });
const [alg, rot, orc] = r.interacoes;
console.log(`${c.nome ? c.nome + ' · ' : ''}semente ${c.semente} · ${c.passos} passos (${(c.passos / 120).toFixed(1)} h simuladas) · ${c.mudancas.length} mudanças`);
console.log(`Olhares ${r.olhares} · interações: algoritmo ${alg}, rotação ${rot}, oráculo ${orc} · ganho ${((alg / rot - 1) * 100).toFixed(1)}% sobre a rotação`);
console.log(`Tempo: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (!c.resultado) { console.log('O cenário não traz números salvos para conferir.'); process.exit(0); }
const bate = r.olhares === c.resultado.olhares && r.interacoes.every((x, i) => x === c.resultado.interacoes[i]);
if (bate) { console.log('Conferido: os olhares e as interações batem com os do cenário salvo.'); process.exit(0); }
console.log(`Os números não batem com os salvos (olhares ${r.olhares} contra ${c.resultado.olhares}). É esperado se o cenário foi salvo em outro ambiente ou versão: a mesma semente só reproduz o mesmo dia no mesmo ambiente.`);
process.exit(4);
