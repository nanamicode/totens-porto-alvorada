'use strict';
/* Conversão com atraso: o resultado chega depois da interação e o algoritmo aprende com ele (docs/ALGORITMO.md). */
const test = require('node:test');
const assert = require('node:assert/strict');
const Brain = require('../site/js/brain.js');
const { mulberry32 } = require('../site/js/util.js');
const { simular } = require('../tools/headless.js');

const total = r => r.conversoes.map((c, p) => c + r.conversoesPendentes[p]);
const ganho = r => total(r)[0] / total(r)[1] - 1;

test('com o atraso desligado nada muda: nenhuma conversão e o mesmo resultado de antes', () => {
  const a = simular({ seed: 3, steps: 400 }), b = simular({ seed: 3, steps: 400, params: { atraso: 0, espera: 2 } });
  assert.deepEqual(a.conversoes, [0, 0, 0]);
  assert.deepEqual(a.conversoesPendentes, [0, 0, 0]);
  assert.deepEqual(b.interacoes, a.interacoes);
  assert.equal(b.olhares, a.olhares);
});

test('a conversão chega depois da interação, nunca excede as interações e o resultado se repete', () => {
  const p = { atraso: 120, espera: 0 };
  const cedo = simular({ seed: 4, steps: 60, params: p }), tarde = simular({ seed: 4, steps: 1440, params: p });
  const de = simular({ seed: 4, steps: 60, params: p });
  assert.deepEqual(de.conversoes, cedo.conversoes);
  for (const r of [cedo, tarde]) for (let k = 0; k < 3; k++) {
    assert.ok(total(r)[k] > 0, 'houve conversões');
    assert.ok(total(r)[k] <= r.interacoes[k], 'conversões não passam das interações');
  }
  // no começo a maior parte ainda está a caminho; com o tempo, a maior parte já chegou
  assert.ok(cedo.conversoesPendentes[0] > cedo.conversoes[0], 'cedo: mais a caminho do que chegadas');
  assert.ok(tarde.conversoes[0] > tarde.conversoesPendentes[0], 'tarde: mais chegadas do que a caminho');
});

test('o atraso e a janela de espera entram no cenário e são refeitos igual', () => {
  const a = simular({ seed: 5, steps: 300, params: { atraso: 60, espera: 1 }, nomeCenario: 'atraso' });
  assert.equal(a.cenario.config0.params.atraso, 60);
  assert.equal(a.cenario.config0.params.espera, 1);
  const b = simular({ cenario: a.cenario });
  assert.deepEqual(b.conversoes, a.conversoes);
  assert.deepEqual(b.interacoes, a.interacoes);
});

test('o algoritmo converte mais do que a rotação aprendendo só com conversões atrasadas, nos dois modos', () => {
  for (const espera of [0, 1]) {
    const r = simular({ seed: 2, steps: 3600, params: { atraso: 120, espera } });
    assert.ok(ganho(r) > 0.1, `espera ${espera}: ganho ${ganho(r)}`);
  }
});

test('credit soma só o acerto, learn com eSnap usa a exposição da exibição', () => {
  const novo = () => Brain.create({ nSeg: 2, nCre: 3, nZones: 1, zoneOf: [0], rng: mulberry32(1), params: { ...Brain.DEFAULTS, corrige: 1, estima: 0, rest: 1 } });
  const b = novo();
  b.expose(0, 1, 300);                                   // o criativo 1 já tem exposição agora
  const antes = { a: b.cells.G.a[1 * 3 + 1], n: b.cells.G.n[1 * 3 + 1] };
  b.credit(0, 1, 1, null, 0);                            // exibido quando a exposição era 0: f = 1, vale 1
  assert.equal(b.cells.G.n[1 * 3 + 1], antes.n);
  assert.ok(Math.abs(b.cells.G.a[1 * 3 + 1] - antes.a - 1) < 1e-9);
  b.credit(0, 1, 1, null);                               // sem eSnap usa a exposição de agora: vale mais que 1
  assert.ok(b.cells.G.a[1 * 3 + 1] - antes.a > 2.2);
  const c = novo();
  c.expose(0, 1, 300);
  c.learnLote(0, 1, 1, 10, 4, null, 0);                  // 10 olhares, 4 acertos, exposição da época = 0
  assert.equal(c.cells.G.n[1 * 3 + 1], 10);
  assert.ok(Math.abs(c.cells.G.a[1 * 3 + 1] - 4) < 1e-9);
});
