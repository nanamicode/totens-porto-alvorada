'use strict';
/* Gera eventos de spot do simulador em JSON Lines (um evento por linha), no formato de docs/EVENTOS.md.
   Uso:  node tools/exportar-eventos.js --semente=1 --passos=240 --totem=T-12 --ultimos=120 > eventos.jsonl
         node tools/exportar-eventos.js --registro > registro.json

   --semente=N   semente da simulação (padrão 1)
   --passos=N    spots de 30 s simulados, a partir das 06:00 de segunda (padrão 120)
   --totem=T-12  só os eventos desse totem
   --ultimos=N   só os N últimos eventos de cada totem escolhido
   --registro    imprime o cadastro de totens e criativos, em vez dos eventos */
const { simular } = require('./headless.js');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? 'true'];
}));
const r = simular({ seed: Number(args.semente ?? 1), steps: Number(args.passos ?? 120), registrarEventos: true });

if (args.registro) {
  console.log(JSON.stringify(r.registro, null, 2));
} else {
  const porTotem = new Map();
  for (const ev of r.eventosEmitidos) {
    if (args.totem && ev.totem !== args.totem) continue;
    if (!porTotem.has(ev.totem)) porTotem.set(ev.totem, []);
    porTotem.get(ev.totem).push(ev);
  }
  const ordem = [...r.eventosEmitidos].filter(ev => porTotem.has(ev.totem));
  const manter = new Set();
  for (const lista of porTotem.values()) for (const ev of lista.slice(args.ultimos ? -Number(args.ultimos) : 0)) manter.add(ev);
  for (const ev of ordem) if (manter.has(ev)) console.log(JSON.stringify(ev));
}
