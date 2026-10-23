'use strict';
/* Operador (site/js/operador.js) e servidor HTTP (tools/servidor.js): o Brain ligado a eventos reais. */
const test = require('node:test');
const assert = require('node:assert/strict');
const Operador = require('../site/js/operador.js');
const Eventos = require('../site/js/eventos.js');
const { mulberry32 } = require('../site/js/util.js');
const { simular } = require('../tools/headless.js');
const { criarServidor } = require('../tools/servidor.js');
const demo = require('../examples/operador-demo.js');

const { PERFIS } = Eventos;
const CAD = {
  totens: [{ id: 'T-01', nome: 'A', zona: 'z1' }, { id: 'T-02', nome: 'B', zona: 'z1' }, { id: 'T-03', nome: 'C', zona: 'z2' }],
  criativos: [{ id: 'cafe', nome: 'Café' }, { id: 'cinema', nome: 'Cinema' }, { id: 'clinica', nome: 'Clínica' }],
};
const novo = extra => Operador.criar({ cadastro: CAD, rng: mulberry32(7), ...extra });
const evento = (o = {}) => Eventos.criar({
  totem: 0, t: 8 * 3600, duracao: 30, criativo: 'cafe',
  audiencia: [0, 2, 1, 0, 0, 3, 0, 0], interacoes: [0, 0, 1, 0, 0, 1, 0, 0], ...o,
});

// uma simulação de 4 h, reaproveitada
let cacheSim;
const sim = () => cacheSim || (cacheSim = simular({ seed: 2, steps: 480, registrarEventos: true }));
const acertos = (op, verdade) => {
  const ap = op.aprendido();
  return PERFIS.filter((p, s) => ap.criativos.indexOf(ap.melhor[p]) === verdade[s]).length;
};
const total = ev => (typeof ev.interacoes === 'number' ? ev.interacoes : Eventos.totais(ev).interacoes);

test('o cadastro é validado', () => {
  assert.deepEqual(Operador.validarCadastro(CAD), []);
  assert.ok(Operador.validarCadastro(null).length > 0);
  assert.ok(Operador.validarCadastro({ totens: [], criativos: CAD.criativos }).length > 0);
  assert.ok(Operador.validarCadastro({ totens: [{ id: 'x', zona: 'a' }], criativos: CAD.criativos }).length > 0);
  assert.ok(Operador.validarCadastro({ totens: CAD.totens, criativos: [{ id: 'Cafe' }] }).length > 0);
  assert.ok(Operador.validarCadastro({ totens: [CAD.totens[0], CAD.totens[0]], criativos: CAD.criativos }).length > 0);
  assert.throws(() => Operador.criar({ cadastro: { totens: [], criativos: [] } }), /cadastro inválido/);
});

test('registrar aceita evento válido e recusa o resto, dizendo o motivo', () => {
  const op = novo();
  assert.equal(op.registrar(evento()).aceito, true);
  assert.deepEqual(op.registrar(evento()), { aceito: false, motivo: 'duplicado' });
  const ruim = evento({ t: 8 * 3600 + 30 });
  delete ruim.criativo;
  assert.equal(op.registrar(ruim).motivo, 'formato');
  assert.equal(op.registrar(evento({ t: 8 * 3600 + 60, totem: 9 })).motivo, 'totem fora do cadastro');
  assert.equal(op.registrar(evento({ t: 8 * 3600 + 90, criativo: 'novo-criativo' })).motivo, 'criativo fora do cadastro');
  assert.deepEqual(op.estado().eventos, { aceitos: 1, porSpot: 0, rejeitados: 1, duplicados: 1, desconhecidos: 2, atrasados: 0 });
});

test('eventos reais do simulador, por perfil, ensinam o melhor criativo de quase todos os perfis', () => {
  const r = sim(), op = Operador.criar({ cadastro: r.registro, rng: mulberry32(5) });
  for (const ev of r.eventosEmitidos) assert.equal(op.registrar(ev).aceito, true);
  assert.equal(op.estado().eventos.aceitos, 42 * 480);
  const certos = acertos(op, r.verdade);
  assert.ok(certos >= 5, `acertou ${certos} de 8`);
});

test('só com o total de interações por spot, ainda aprende o melhor criativo depois de meio dia', () => {
  const r = simular({ seed: 2, steps: 1440, registrarEventos: true });
  const op = Operador.criar({ cadastro: r.registro, rng: mulberry32(5) });
  for (const ev of r.eventosEmitidos) assert.equal(op.registrar({ ...ev, interacoes: total(ev) }).aceito, true);
  assert.equal(op.estado().eventos.porSpot, 42 * 1440);
  const certos = acertos(op, r.verdade);
  assert.ok(certos >= 5, `acertou ${certos} de 8`);
});

test('eventos fora de ordem e repetidos não atrapalham o aprendizado', () => {
  const r = sim(), op = Operador.criar({ cadastro: r.registro, rng: mulberry32(5) });
  const evs = r.eventosEmitidos.slice();
  for (let i = 0; i < evs.length; i += 420) evs.splice(i, 420, ...evs.slice(i, i + 420).reverse());   // 10 spots ao contrário
  for (const ev of evs) op.registrar(ev);
  for (const ev of evs.slice(0, 500)) assert.equal(op.registrar(ev).motivo, 'duplicado');
  assert.ok(op.estado().eventos.atrasados > 0);
  assert.equal(op.estado().eventos.aceitos, 42 * 480);
  const certos = acertos(op, r.verdade);
  assert.ok(certos >= 5, `acertou ${certos} de 8`);
});

test('decidir devolve um criativo do cadastro e usa o perfil habitual quando não há ninguém à frente', () => {
  const op = novo();
  for (let k = 0; k < 40; k++) op.registrar(evento({ t: 8 * 3600 + k * 30 }));
  const d = op.decidir({ totem: 'T-01', leitura: { 'H25-34': 2, 'M25-34': 3 }, quando: Eventos.instante(9 * 3600) });
  assert.ok(CAD.criativos.some(c => c.id === d.criativo));
  assert.equal(d.mixEsperado, false);
  assert.equal(d.periodo, 3);
  const vazio = op.decidir({ totem: 'T-01', leitura: {}, quando: Eventos.instante(9 * 3600) });
  assert.equal(vazio.mixEsperado, true);
  assert.ok(Number.isFinite(vazio.esperado));
  const lista = op.decidir({ totem: 'T-02', leitura: [1, 0, 0, 0, 0, 0, 0, 0] });
  assert.ok(lista.criativo);
  assert.throws(() => op.decidir({ totem: 'T-99', leitura: {} }), /totem desconhecido/);
});

test('campanha pausada nunca é escolhida, e o último criativo não pode ser pausado', () => {
  const op = novo();
  op.campanha('cafe', false);
  for (let k = 0; k < 200; k++) assert.notEqual(op.decidir({ totem: 'T-01', leitura: { 'H25-34': 3 } }).criativo, 'cafe');
  assert.equal(op.estado().criativos[0].ativo, false);
  op.campanha('cinema', false);
  assert.throws(() => op.campanha('clinica', false), /pelo menos um/);
  assert.throws(() => op.campanha('nada', false), /desconhecido/);
  op.campanha('cafe', true);
  assert.equal(op.estado().criativos[0].ativo, true);
});

test('o tempo que passa esvazia a exposição do criativo', () => {
  const op = novo();
  op.registrar(evento({ t: 8 * 3600, audiencia: [0, 10, 0, 0, 0, 0, 0, 0], interacoes: [0, 0, 0, 0, 0, 0, 0, 0] }));
  const antes = op.brain.exposure(0)[0];
  assert.equal(antes, 10);
  op.registrar(evento({ totem: 1, t: 12 * 3600, audiencia: [1, 0, 0, 0, 0, 0, 0, 0], interacoes: [0, 0, 0, 0, 0, 0, 0, 0] }));
  const esperado = antes * Math.exp(-Math.LN2 * (4 * 60 + 0.5) / 150);       // do fim do primeiro ao fim do segundo
  assert.ok(Math.abs(op.brain.exposure(0)[0] - esperado) < 0.01, `exposição ${op.brain.exposure(0)[0]} contra ${esperado}`);
});

test('o estado se exporta, volta do JSON e continua de onde parou', () => {
  const r = sim(), op = Operador.criar({ cadastro: r.registro, rng: mulberry32(5) });
  const evs = r.eventosEmitidos;
  for (const ev of evs.slice(0, 5000)) op.registrar(ev);
  const guardado = JSON.parse(JSON.stringify(op.exportar()));
  const volta = Operador.criar({ cadastro: r.registro, rng: mulberry32(5), estado: guardado });
  assert.deepEqual(volta.estado(), op.estado());
  assert.deepEqual(volta.aprendido(), op.aprendido());
  assert.equal(volta.registrar(evs[10]).motivo, 'duplicado');
  for (const ev of evs.slice(5000, 5300)) { op.registrar(ev); volta.registrar(ev); }
  assert.deepEqual(volta.aprendido().melhor, op.aprendido().melhor);
  assert.equal(volta.brain.mean(3, 2, 1), op.brain.mean(3, 2, 1));
  assert.throws(() => Operador.criar({ cadastro: CAD, estado: guardado }), /não combina|cadastro/);
});

test('em malha fechada, só pela API, o Operador supera o rodízio e aprende os perfis', () => {
  const porPerfil = demo.rodar({ spots: 1500 });
  assert.ok(porPerfil.comOperador / porPerfil.comRodizio - 1 > 0.15, `ganho ${(porPerfil.comOperador / porPerfil.comRodizio - 1).toFixed(3)}`);
  const ap = porPerfil.op.aprendido();
  assert.ok(PERFIS.filter((p, s) => ap.melhor[p] === demo.verdade[s]).length >= 7);
  const porSpot = demo.rodar({ spots: 1500, porSpot: true });
  assert.ok(porSpot.comOperador / porSpot.comRodizio - 1 > 0.15, 'com total por spot também deve superar o rodízio');
});

/* ---------- servidor HTTP ---------- */
async function comServidor(opcoes, fn) {
  const op = novo(), servidor = criarServidor(op, opcoes);
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const chama = (rota, corpo, cab = {}) => fetch(base + rota, corpo === undefined ? { headers: cab } : {
    method: 'POST', body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo), headers: { 'Content-Type': 'application/json', ...cab },
  }).then(async r => ({ status: r.status, corpo: await r.json() }));
  try { await fn(chama, op); } finally { await new Promise(r => servidor.close(r)); }
}

test('servidor: recebe eventos, decide, e responde erros com o código certo', async () => {
  let mudancas = 0;
  await comServidor({ aoMudar: () => { mudancas++; } }, async (chama, op) => {
    assert.deepEqual((await chama('/saude')).corpo, { ok: true });
    const um = await chama('/evento', evento());
    assert.equal(um.status, 200);
    assert.equal(um.corpo.aceitos, 1);
    assert.equal((await chama('/evento', evento())).corpo.duplicados, 1);
    const lote = await chama('/evento', [evento({ t: 8 * 3600 + 30 }), evento({ t: 8 * 3600 + 60, totem: 9 })]);
    assert.equal(lote.corpo.aceitos, 1);
    assert.equal(lote.corpo.rejeitados, 1);
    assert.equal(lote.corpo.resultados[0].motivo, 'totem fora do cadastro');
    const jsonl = [evento({ t: 8 * 3600 + 90 }), evento({ t: 8 * 3600 + 120 })].map(e => JSON.stringify(e)).join('\n');
    assert.equal((await chama('/evento', jsonl)).corpo.aceitos, 2);
    assert.equal((await chama('/evento', 'isto não é json')).status, 400);
    assert.equal((await chama('/evento', '   ')).status, 400);
    const d = await chama('/decidir', { totem: 'T-01', leitura: { 'M25-34': 2 }, quando: '2026-01-05T09:00:00-03:00' });
    assert.equal(d.status, 200);
    assert.ok(CAD.criativos.some(c => c.id === d.corpo.criativo));
    assert.equal((await chama('/decidir', { totem: 'T-99' })).status, 404);
    assert.equal((await chama('/decidir', 'nada')).status, 400);
    assert.equal((await chama('/campanha', { criativo: 'cafe', ativa: false })).corpo.criativos[0].ativo, false);
    assert.equal((await chama('/campanha', { criativo: 'nada', ativa: false })).status, 400);
    assert.equal((await chama('/estado')).corpo.eventos.aceitos, 4);
    assert.equal(Object.keys((await chama('/aprendido')).corpo.melhor).length, 8);
    assert.equal((await chama('/nao-existe')).status, 404);
    assert.equal(op.estado().eventos.aceitos, 4);
  });
  assert.ok(mudancas >= 5, 'o servidor deve avisar que o estado mudou');
});

test('servidor: com token, recusa quem não o envia, menos em /saude', async () => {
  await comServidor({ token: 'segredo' }, async chama => {
    assert.equal((await chama('/saude')).status, 200);
    assert.equal((await chama('/estado')).status, 401);
    assert.equal((await chama('/evento', evento())).status, 401);
    assert.equal((await chama('/estado', undefined, { Authorization: 'Bearer errado' })).status, 401);
    assert.equal((await chama('/estado', undefined, { Authorization: 'Bearer segredo' })).status, 200);
    assert.equal((await chama('/evento', evento(), { Authorization: 'Bearer segredo' })).corpo.aceitos, 1);
  });
});
