'use strict';
/* Testes do Brain fora do navegador. Uso: npm test  (ou node --test) */
const test = require('node:test');
const assert = require('node:assert/strict');
const Brain = require('../site/js/brain.js');
const { mulberry32 } = require('../site/js/util.js');

const NS = 2, NC = 3;
const TAXA = [[0.06, 0.02, 0.01], [0.01, 0.02, 0.07]];   // perfil 0 prefere o criativo 0, perfil 1 o criativo 2

function novo(extra = {}) {
  return Brain.create({ nSeg: NS, nCre: NC, nZones: 1, zoneOf: [0, 0], rng: mulberry32(7), ...extra });
}

function treinar(brain, totem, perfil, spots, rng) {
  const aud = new Float64Array(NS); aud[perfil] = 5;
  const escolhas = [];
  for (let i = 0; i < spots; i++) {
    const { c } = brain.choose(totem, aud, 5);
    for (let k = 0; k < 5; k++) brain.learn(totem, perfil, c, rng() < TAXA[perfil][c]);
    escolhas.push(c);
  }
  return escolhas;
}

test('o mesmo gerador aleatório dá as mesmas escolhas', () => {
  const rodar = () => treinar(novo(), 0, 0, 200, mulberry32(3));
  assert.deepEqual(rodar(), rodar());
});

test('aprende o melhor criativo de cada perfil', () => {
  const brain = novo(), rng = mulberry32(11);
  const a = treinar(brain, 0, 0, 1500, rng).slice(-300);
  const b = treinar(brain, 0, 1, 1500, rng).slice(-300);
  assert.ok(a.filter(c => c === 0).length / 300 > 0.85, 'perfil 0 deveria receber o criativo 0');
  assert.ok(b.filter(c => c === 2).length / 300 > 0.85, 'perfil 1 deveria receber o criativo 2');
});

test('nunca escolhe uma campanha pausada', () => {
  const brain = novo();
  brain.active[0] = false;
  const escolhas = treinar(brain, 0, 0, 300, mulberry32(5));
  assert.ok(escolhas.every(c => c !== 0));
});

test('um totem novo herda o que a zona já aprendeu', () => {
  const brain = novo();
  treinar(brain, 0, 0, 1500, mulberry32(13));
  assert.ok(brain.mean(1, 0, 0) > brain.mean(1, 0, 1), 'o totem 1 nunca viu ninguém, mas deveria preferir o criativo 0');
  assert.ok(brain.mean(1, 0, 0) > brain.mean(1, 0, 2));
});

test('o esquecimento reduz as contagens pelo fator configurado', () => {
  const brain = novo({ params: { kz: 40, kt: 60, rest: 0.4, forget: 0.5 } });
  brain.learn(0, 0, 0, true); brain.learn(0, 0, 0, false);
  brain.forget();
  assert.equal(brain.cells.T[0].n[0], 1);
  assert.equal(brain.cells.T[0].a[0], 0.5);
  assert.equal(brain.cells.G.n[0], 1);
});

test('a exposição aumenta o desgaste e o tempo reduz', () => {
  const brain = novo();
  assert.equal(brain.wear(0, 1), 0);
  brain.expose(0, 1, 600);
  const alto = brain.wear(0, 1);
  assert.ok(alto > 0.1);
  brain.decay(0.5);
  assert.ok(brain.wear(0, 1) < alto);
  assert.equal(brain.wear(0, 2), 0);
});

test('o desgaste faz o Brain alternar criativos parecidos', () => {
  const brain = novo({ params: { kz: 40, kt: 60, rest: 1, forget: 0.985 } });
  const aud = new Float64Array(NS); aud[0] = 5;
  brain.expose(0, 0, 5000);                     // o criativo 0 está saturado neste totem
  const { c } = brain.choose(0, aud, 5);
  assert.notEqual(c, 0);
});
