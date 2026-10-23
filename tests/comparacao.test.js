'use strict';
/* Comparação pareada de duas configurações (site/js/comparacao.js e tools/comparar.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const C = require('../site/js/comparacao.js');
const Brain = require('../site/js/brain.js');
const { simular } = require('../tools/headless.js');

const linha = (ganho, extra = {}) => ({ ganho, efAlgoritmo: 0.9, acertos: 6, interacoes: 100, custo: 0.5, ...extra });
const lista = v => v.map(g => linha(g));

function rodar(params, seeds, steps) {
  return seeds.map(seed => {
    const r = simular({ seed, steps, params });
    const [alg, rot, orc] = r.interacoes;
    return { ganho: alg / rot - 1, efAlgoritmo: alg / orc, acertos: r.melhor.filter((c, s) => c === r.verdade[s]).length, interacoes: alg, custo: 18 * r.olhares / 1000 / alg };
  });
}

test('os valores padrão da comparação são os do simulador', () => {
  const { acc, ...resto } = C.PADRAO;
  assert.equal(acc, 0.86);
  for (const [k, v] of Object.entries(resto)) assert.equal(Brain.DEFAULTS[k], v, k);
  assert.deepEqual(C.CAMPOS.map(c => c.k), Object.keys(C.PADRAO));
});

test('uma configuração pode ser dada por receita ou por campos', () => {
  assert.deepEqual(C.ler('padrao').params, C.PADRAO);
  assert.equal(C.ler('sem-compartilhar').params.kz, 0);
  assert.equal(C.ler('sem-compartilhar').params.acc, 0.86);
  assert.deepEqual(C.ler('kz=0,kt=5').params, { ...C.PADRAO, kz: 0, kt: 5 });
  assert.equal(C.ler(undefined).nome, 'Padrão');
  assert.throws(() => C.ler('kz'), /inválida/);
  assert.throws(() => C.ler('xyz=1'), /inválida/);
  assert.throws(() => C.ler('kz=abc'), /inválida/);
});

test('mostra no que duas configurações diferem', () => {
  const d = C.diferencas(C.ler('padrao').params, C.ler('sem-compartilhar').params);
  assert.deepEqual(d.map(x => [x.k, x.a, x.b]), [['kz', 40, 0], ['kt', 60, 0]]);
  assert.deepEqual(C.diferencas(C.PADRAO, C.PADRAO), []);
});

test('a diferença pareada, o erro e o veredito', () => {
  const sempre = C.pareadas(lista([0.2, 0.21, 0.19, 0.2]), lista([0.25, 0.27, 0.23, 0.26]));
  assert.equal(sempre.n, 4);
  assert.ok(Math.abs(sempre.ganho.dif.media - 0.0525) < 1e-12);
  assert.equal(sempre.ganho.dif.melhorB, 4);
  assert.equal(C.veredito(sempre.ganho.dif).tipo, 'melhor');
  assert.equal(C.veredito(C.pareadas(lista([0.25, 0.27, 0.23, 0.26]), lista([0.2, 0.21, 0.19, 0.2])).ganho.dif).tipo, 'pior');
  const ruido = C.pareadas(lista([0.2, 0.22, 0.19, 0.21]), lista([0.21, 0.2, 0.2, 0.2]));
  assert.equal(C.veredito(ruido.ganho.dif).tipo, 'ruido');
  const igual = C.pareadas(lista([0.2, 0.22, 0.19]), lista([0.2, 0.22, 0.19]));
  assert.equal(igual.ganho.dif.media, 0);
  assert.equal(C.veredito(igual.ganho.dif).tipo, 'igual');
  assert.equal(C.veredito(C.pareadas(lista([0.2, 0.3]), lista([0.3, 0.4])).ganho.dif).tipo, 'poucas');
});

test('o erro padrão da diferença vem da variação entre sementes', () => {
  const p = C.pareadas(lista([0.1, 0.1, 0.1, 0.1]), lista([0.2, 0.3, 0.1, 0.4]));
  const d = p.ganho.dif;
  assert.ok(Math.abs(d.media - 0.15) < 1e-12);
  assert.ok(Math.abs(d.dp - Math.sqrt(((0.1 - 0.15) ** 2 + (0.2 - 0.15) ** 2 + (0 - 0.15) ** 2 + (0.3 - 0.15) ** 2) / 3)) < 1e-12);
  assert.ok(Math.abs(d.ep - d.dp / 2) < 1e-12);
  assert.ok(Math.abs(d.meia - 1.96 * d.ep) < 1e-12);
});

test('a frase do veredito diz quem ganhou e quanto', () => {
  const fmt = (x, s) => (s && x >= 0 ? '+' : '') + (x * 100).toFixed(1);
  const f = C.frase(C.pareadas(lista([0.2, 0.21, 0.19, 0.2]), lista([0.25, 0.27, 0.23, 0.26])).ganho.dif, fmt);
  assert.match(f, /B é melhor que A/);
  assert.match(f, /4 de 4 sementes/);
  assert.match(C.frase(C.pareadas(lista([0.2, 0.2, 0.2]), lista([0.2, 0.2, 0.2])).ganho.dif, fmt), /exatamente o mesmo/);
  assert.match(C.frase(C.pareadas(lista([0.2]), lista([0.3])).ganho.dif, fmt), /Poucas sementes/);
});

test('com a mesma audiência, duas configurações iguais dão exatamente o mesmo resultado', () => {
  const seeds = [1, 2, 3];
  const p = C.pareadas(rodar(C.PADRAO, seeds, 240), rodar(C.PADRAO, seeds, 240));
  assert.equal(p.ganho.dif.media, 0);
  assert.equal(p.efAlgoritmo.dif.media, 0);
  assert.equal(C.veredito(p.ganho.dif).tipo, 'igual');
});

test('detecta que não compartilhar o aprendizado rende bem menos nas primeiras horas', () => {
  const seeds = [1, 2, 3];
  const p = C.pareadas(rodar(C.ler('padrao').params, seeds, 720), rodar(C.ler('sem-compartilhar').params, seeds, 720));
  assert.equal(C.veredito(p.ganho.dif).tipo, 'pior');
  assert.ok(p.ganho.dif.media < -0.05, `diferença ${(p.ganho.dif.media * 100).toFixed(1)} pontos`);
  assert.equal(p.ganho.dif.piorB, 3);
  assert.ok(p.custo.dif.media > 0, 'o custo por interação sobe quando o ganho cai');
});

const CLI = path.join(__dirname, '..', 'tools', 'comparar.js');
const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' });

test('o comando comparar compara, e recusa configuração inválida', () => {
  const ok = cli('--a=padrao', '--b=padrao', '--sementes=3', '--passos=120');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /configurações iguais/);
  assert.match(ok.stdout, /exatamente o mesmo resultado/);
  const semArgs = cli();
  assert.equal(semArgs.status, 1);
  assert.match(semArgs.stderr, /Informe as duas configurações/);
  const ruim = cli('--a=padrao', '--b=xyz=1');
  assert.equal(ruim.status, 1);
  assert.match(ruim.stderr, /inválida/);
});
