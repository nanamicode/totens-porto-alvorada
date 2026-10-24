'use strict';
/* Conversão com atraso no mundo real: evento `conversao`, Operador com recompensa 'conversao' e servidor (docs/EVENTOS.md). */
const test = require('node:test');
const assert = require('node:assert/strict');
const Eventos = require('../site/js/eventos.js');
const Operador = require('../site/js/operador.js');
const { mulberry32 } = require('../site/js/util.js');
const { criarServidor } = require('../tools/servidor.js');
const demo = require('../examples/operador-demo.js');

const CAD = {
  totens: [{ id: 'T-01', nome: 'A', zona: 'z1' }, { id: 'T-02', nome: 'B', zona: 'z1' }],
  criativos: [{ id: 'cafe', nome: 'Café' }, { id: 'cinema', nome: 'Cinema' }, { id: 'clinica', nome: 'Clínica' }],
};
const NC = 3, ESTRANHOS = ['imagem', 'foto', 'rosto', 'cupom', 'cliente', 'cpf', 'email', 'telefone', 'aparelho'];
const novo = (recompensa, extra = {}) => Operador.criar({ cadastro: CAD, rng: mulberry32(7), recompensa, ...extra });
const spot = (o = {}) => Eventos.criar({
  totem: 0, t: 8 * 3600, duracao: 30, criativo: 'cafe', audiencia: [0, 2, 1, 0, 0, 3, 0, 0], interacoes: [0, 0, 1, 0, 0, 1, 0, 0], ...o,
});
const conv = (ev, o = {}) => Eventos.criarConversao({ id: 'c1', spot: ev.spot, t: 8 * 3600 + 600, ...o });
const celula = (op, s, c) => ({ a: op.brain.cells.G.a[s * NC + c], n: op.brain.cells.G.n[s * NC + c] });

test('o evento conversao tem formato fechado e recusa o que não é contagem', () => {
  const ev = conv(spot());
  assert.deepEqual(Object.keys(ev), ['versao', 'tipo', 'conversao', 'spot', 'quando', 'quantidade']);
  assert.deepEqual(Eventos.validarConversao(ev), { ok: true, erros: [] });
  assert.equal(Eventos.validarConversao(conv(spot(), { perfil: 'M25-34', quantidade: 3 })).ok, true);
  for (const campo of ESTRANHOS) assert.equal(Eventos.validarConversao({ ...ev, [campo]: 'SEGREDO' }).ok, false, campo);
  const ruins = [
    { ...ev, quantidade: 0 }, { ...ev, quantidade: 1.5 }, { ...ev, quantidade: 1001 }, { ...ev, quantidade: '2' },
    { ...ev, perfil: 'X99' }, { ...ev, quando: 'ontem' }, { ...ev, quando: '2026-01-05T09:00:00' }, { ...ev, conversao: '' },
    { ...ev, conversao: 'tem espaço' }, { ...ev, tipo: 'spot' }, { ...ev, versao: 2 }, { ...ev, spot: '' }, null, [],
  ];
  for (const r of ruins) assert.equal(Eventos.validarConversao(r).ok, false, JSON.stringify(r));
  for (const k of Eventos.CHAVES_CONVERSAO) { const { [k]: _, ...sem } = ev; assert.equal(Eventos.validarConversao(sem).ok, false, 'sem ' + k); }
});

test('com recompensa conversao, o spot conta o olhar como falha e a conversão soma o acerto no perfil certo', () => {
  const op = novo('conversao'), s = spot();
  op.registrar(s);
  for (const [seg, n] of [[1, 2], [2, 1], [5, 3]]) assert.deepEqual(celula(op, seg, 0), { a: 0, n }, 'só o olhar, sem acerto: perfil ' + seg);
  const r = op.registrarConversao(conv(s, { perfil: 'H25-34' }));
  assert.deepEqual(r, { aceito: true, aprendeu: true });
  assert.ok(Math.abs(celula(op, 1, 0).a - 1) < 1e-9, 'a exposição do spot era zero: vale 1');
  assert.equal(celula(op, 1, 0).n, 2, 'a conversão não conta outro olhar');
  assert.equal(celula(op, 2, 0).a, 0);
  assert.equal(op.estado().eventos.conversoes, 1);
});

test('sem perfil no evento, a quantidade se reparte entre os perfis que estavam à frente do spot', () => {
  const op = novo('conversao'), s = spot();
  op.registrar(s);
  op.registrarConversao(conv(s, { quantidade: 3 }));
  // audiência [0, 2, 1, 0, 0, 3, 0, 0]: 2/6, 1/6 e 3/6 de 3 conversões
  assert.ok(Math.abs(celula(op, 1, 0).a - 1) < 1e-9);
  assert.ok(Math.abs(celula(op, 2, 0).a - 0.5) < 1e-9);
  assert.ok(Math.abs(celula(op, 5, 0).a - 1.5) < 1e-9);
  assert.equal(celula(op, 0, 0).a, 0);
  assert.equal(op.estado().eventos.conversoes, 3);
});

test('a conversão repetida, a de spot desconhecido e a malformada não ensinam nada', () => {
  const op = novo('conversao'), s = spot();
  op.registrar(s);
  assert.equal(op.registrarConversao(conv(s)).aceito, true);
  const depois = JSON.stringify(op.brain.exportar());
  assert.equal(op.registrarConversao(conv(s)).motivo, 'duplicado');
  assert.equal(op.registrarConversao(conv(s, { id: 'c2', spot: 'T-01-20990101T000000' })).motivo, 'spot desconhecido');
  assert.equal(op.registrarConversao({ ...conv(s, { id: 'c3' }), foto: 'x' }).motivo, 'formato');
  assert.equal(JSON.stringify(op.brain.exportar()), depois);
  const c = op.estado().eventos;
  assert.deepEqual([c.conversoes, c.conversoesDuplicadas, c.conversoesSemSpot, c.conversoesRejeitadas], [1, 0, 1, 1]);
});

test('com recompensa interacao a conversão é aceita e contada, mas o algoritmo não muda', () => {
  const op = novo('interacao'), s = spot();
  op.registrar(s);
  const antes = JSON.stringify(op.brain.exportar());
  assert.deepEqual(op.registrarConversao(conv(s)), { aceito: true, aprendeu: false });
  assert.equal(JSON.stringify(op.brain.exportar()), antes);
  assert.equal(op.estado().eventos.conversoes, 1);
  assert.equal(op.estado().recompensa, 'interacao');
  assert.throws(() => novo('lucro'), /recompensa/);
});

test('o estado guarda de onde vêm as conversões e continua depois de reiniciar', () => {
  const op = novo('conversao'), s = spot();
  op.registrar(s);
  op.registrarConversao(conv(s));
  const guardado = JSON.parse(JSON.stringify(op.exportar()));
  const volta = Operador.criar({ cadastro: CAD, rng: mulberry32(7), estado: guardado });
  assert.equal(volta.estado().recompensa, 'conversao');
  assert.equal(volta.registrarConversao(conv(s)).motivo, 'duplicado');
  assert.equal(volta.registrarConversao(conv(s, { id: 'c9', perfil: 'M25-34' })).aprendeu, true);
  assert.ok(celula(volta, 5, 0).a > celula(op, 5, 0).a, 'a conversão de depois do reinício foi aprendida');
});

test('servidor: conversões chegam pela mesma rota de eventos e são contadas à parte', async () => {
  const op = novo('conversao'), servidor = criarServidor(op, {});
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const envia = async corpo => (await fetch(base + '/evento', { method: 'POST', body: JSON.stringify(corpo) })).json();
  try {
    const s = spot();
    const a = await envia([s, conv(s), conv(s, { id: 'c2', perfil: 'M25-34' }), conv(s, { id: 'c3', spot: 'T-09-X' }), { ...conv(s, { id: 'c4' }), cupom: 'SEGREDO-1' }]);
    assert.equal(a.recebidos, 5);
    assert.equal(a.aceitos, 3);
    assert.equal(a.conversoesAceitas, 2);
    assert.equal(a.rejeitados, 2);
    assert.ok(!JSON.stringify(a).includes('SEGREDO-1'));
    assert.deepEqual(a.resultados.map(r => r.motivo), ['spot desconhecido', 'formato']);
  } finally { await new Promise(r => servidor.close(r)); }
});

test('em malha fechada, aprender com as conversões atrasadas converte mais do que aprender só com o toque', () => {
  const soma = (rec) => [1, 2, 3].reduce((acc, seed) => {
    const r = demo.rodar({ spots: 2500, seed, conversao: { atraso: 60, recompensa: rec } });
    return { op: acc.op + r.convOperador, rod: acc.rod + r.convRodizio };
  }, { op: 0, rod: 0 });
  const porConversao = soma('conversao'), porToque = soma('interacao');
  assert.ok(porConversao.op / porConversao.rod > 1.4, `ganho sobre o rodízio ${porConversao.op / porConversao.rod}`);
  assert.ok(porConversao.op > porToque.op * 1.1, `${porConversao.op} contra ${porToque.op}`);
});

test('o JSON Schema da conversão fecha o objeto e lista os mesmos campos do validador', () => {
  const s = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'docs', 'evento-conversao.schema.json'), 'utf8'));
  assert.equal(s.additionalProperties, false);
  assert.deepEqual([...s.required].sort(), [...Eventos.CHAVES_CONVERSAO].sort());
  assert.deepEqual(Object.keys(s.properties).sort(), [...Eventos.CHAVES_CONVERSAO, 'perfil'].sort());
  assert.deepEqual([...s.properties.perfil.enum], Eventos.PERFIS);
});
