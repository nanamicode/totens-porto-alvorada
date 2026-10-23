'use strict';
/* Metas de entrega por anunciante: medição, equilíbrio com o desempenho e orçamento (docs/ALGORITMO.md, tools/metas.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const Brain = require('../site/js/brain.js');
const { mulberry32 } = require('../site/js/util.js');
const { simular } = require('../tools/headless.js');

const DIAS_COMPLETOS = 8000;   // a cidade começa às 06:00 de segunda: 2 dias completos terminam no passo 7920
const cumprimento = (r, p) => {
  const cs = r.metas.campanhas.filter(c => c.meta > 0);
  return cs.reduce((a, c) => a + c.cumprimento[p] * c.meta, 0) / cs.reduce((a, c) => a + c.meta, 0);
};

test('o cumprimento é medido só em dias completos, e o primeiro dia (parcial) não conta', () => {
  const um = simular({ seed: 1, steps: 2880 }), dois = simular({ seed: 1, steps: 6000 });
  assert.equal(um.metas.dias, 0);
  assert.ok(um.metas.campanhas.every(c => c.hoje[0] > 0 || c.meta === 0 || c.id === 'orla-sorvetes'));
  assert.equal(dois.metas.dias, 1);
  for (const c of dois.metas.campanhas) {
    if (c.meta > 0) for (let p = 0; p < 3; p++) assert.ok(c.cumprimento[p] >= 0 && c.cumprimento[p] <= 1 + 1e-9, `${c.id} ${p}`);
    else assert.equal(c.cumprimento[0], null);
  }
  assert.equal(dois.metas.campanhas.find(c => c.id === 'orla-sorvetes').meta, 0);
});

test('só desempenho deixa campanhas muito abaixo da meta; com o equilíbrio ligado as metas são cumpridas', () => {
  const sem = simular({ seed: 1, steps: DIAS_COMPLETOS }), com = simular({ seed: 1, steps: DIAS_COMPLETOS, params: { ritmo: 1 } });
  assert.equal(sem.metas.dias, 2);
  assert.ok(cumprimento(sem, 0) < 0.9, `sem equilíbrio: ${cumprimento(sem, 0)}`);
  assert.ok(Math.min(...sem.metas.campanhas.filter(c => c.meta > 0).map(c => c.cumprimento[0])) < 0.6);
  assert.ok(cumprimento(com, 0) > 0.97, `com equilíbrio: ${cumprimento(com, 0)}`);
  assert.ok(Math.min(...com.metas.campanhas.filter(c => c.meta > 0).map(c => c.cumprimento[0])) > 0.95);
  // o equilíbrio custa desempenho, mas o algoritmo continua ganhando da rotação
  assert.ok(com.interacoes[0] < sem.interacoes[0]);
  assert.ok(com.interacoes[0] > com.interacoes[1], 'ainda ganha da rotação');
  // a rotação não é afetada pelo equilíbrio: a mesma audiência e as mesmas escolhas
  assert.equal(com.interacoes[1], sem.interacoes[1]);
  assert.deepEqual(com.metas.campanhas.map(c => c.cumprimento[1]), sem.metas.campanhas.map(c => c.cumprimento[1]));
});

test('o orçamento do dia tira a campanha da escolha do algoritmo, e sem o equilíbrio ela passa do teto', () => {
  const passos = 7200;   // 18:00 do segundo dia: o dia ainda corre
  const com = simular({ seed: 1, steps: passos, params: { ritmo: 1 } }), sem = simular({ seed: 1, steps: passos });
  const cine = r => r.metas.campanhas.find(c => c.id === 'cine-aurora');
  assert.ok(cine(sem).hoje[0] > cine(sem).teto, `sem: ${cine(sem).hoje[0]} de ${cine(sem).teto}`);
  assert.ok(cine(com).hoje[0] <= cine(com).teto + 2000, `com: ${cine(com).hoje[0]} de ${cine(com).teto}`);
});

test('metas e equilíbrio entram no cenário e são refeitos igual', () => {
  const a = simular({ seed: 3, steps: 400, params: { ritmo: 0.5, metaEsc: 0.8 }, nomeCenario: 'metas' });
  assert.equal(a.cenario.config0.params.ritmo, 0.5);
  assert.equal(a.cenario.config0.params.metaEsc, 0.8);
  const b = simular({ cenario: a.cenario });
  assert.deepEqual(b.interacoes, a.interacoes);
  assert.deepEqual(b.metas, a.metas);
  const ligado = simular({ seed: 3, steps: 600, sessao: [{ passo: 200, tipo: 'param', chave: 'ritmo', valor: 1 }] });
  assert.deepEqual(simular({ cenario: ligado.cenario }).interacoes, ligado.interacoes);
});

test('o peso de cada criativo empurra ou tira a campanha da escolha, sem mudar o valor esperado mostrado', () => {
  const peso = [1, 1, 1];
  const mk = () => Brain.create({ nSeg: 2, nCre: 3, nZones: 1, zoneOf: [0], rng: mulberry32(5), peso });
  const b = mk();
  const aud = new Float64Array(2); aud[0] = 5;
  const rr = mulberry32(9);
  for (let i = 0; i < 300; i++) for (let k = 0; k < 5; k++) b.learn(0, 0, 0, rr() < 0.08);   // o criativo 0 é o melhor
  const esc = () => { const r = []; for (let i = 0; i < 60; i++) r.push(b.choose(0, aud, 5).c); return r; };
  assert.ok(esc().filter(c => c === 0).length > 40, 'sem pesos o melhor domina');
  const sem = b.choose(0, aud, 5);
  peso[0] = 0;
  assert.ok(esc().every(c => c !== 0), 'peso 0 tira a campanha');
  peso[0] = 1; peso[2] = 50;
  assert.ok(esc().filter(c => c === 2).length > 40, 'peso alto empurra a campanha');
  const r = b.choose(0, aud, 5), rec = {cells: {}};
  b.choose(0, aud, 5, rec);
  assert.deepEqual(rec.peso, [1, 1, 50]);
  assert.ok(r.exp < 0.2, 'o esperado mostrado é o valor sem o peso');
  assert.ok(sem.exp >= 0);
});
