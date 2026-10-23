'use strict';
/* Avaliação do algoritmo no simulador completo, com várias sementes. Uso: npm test
   Os limites abaixo ficam bem abaixo do que se mede hoje (ganho de 23% ± 1 ponto em 10 sementes),
   para pegar regressões sem quebrar por ruído. Demora cerca de meio minuto. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { simular, resumo, estatistica } = require('../tools/headless.js');

const SEMENTES = [1, 2, 3, 4, 5];
const DIA = 2880;                   // spots de 30 s em 24 h

const cache = new Map();
function dia(seed) {
  if (!cache.has(seed)) cache.set(seed, simular({ seed, steps: DIA }));
  return cache.get(seed);
}
const media = v => v.reduce((a, b) => a + b, 0) / v.length;

test('a mesma semente reproduz exatamente o mesmo dia', () => {
  const a = simular({ seed: 9, steps: 480 }), b = simular({ seed: 9, steps: 480 });
  assert.deepEqual(a.interacoes, b.interacoes);
  assert.deepEqual(a.bins, b.bins);
});

test('o algoritmo supera a rotação fixa em todas as sementes', () => {
  const ganhos = SEMENTES.map(s => resumo(dia(s)).ganho);
  const est = estatistica(ganhos);
  assert.ok(est.min > 0.10, `pior semente: ${(est.min * 100).toFixed(1)}%`);
  assert.ok(est.media > 0.15, `ganho médio: ${(est.media * 100).toFixed(1)}%`);
  assert.ok(est.dp < 0.04, `variação entre sementes: ${(est.dp * 100).toFixed(1)} pontos`);
});

test('a eficiência do algoritmo fica bem acima da rotação em todas as sementes', () => {
  for (const s of SEMENTES) {
    const r = resumo(dia(s));
    assert.ok(r.efAlgoritmo > 0.85, `semente ${s}: algoritmo ${(r.efAlgoritmo * 100).toFixed(1)}%`);
    assert.ok(r.efAlgoritmo - r.efRotacao > 0.08, `semente ${s}: diferença para a rotação`);
  }
});

test('descobre o melhor criativo de quase todos os perfis', () => {
  const acertos = SEMENTES.map(s => resumo(dia(s)).acertos);
  assert.ok(Math.min(...acertos) >= 5, `acertos por semente: ${acertos}`);
  assert.ok(media(acertos) >= 6, `média de acertos: ${media(acertos).toFixed(1)} de 8`);
});

test('aprende com o tempo: depois de um dia acerta bem mais perfis que depois de uma hora', () => {
  const umaHora = media(SEMENTES.map(seed => resumo(simular({ seed, steps: 120 })).acertos));
  const umDia = media(SEMENTES.map(s => resumo(dia(s)).acertos));
  assert.ok(umDia - umaHora > 1.5, `acertos de 8 perfis: ${umaHora.toFixed(1)} após 1 h, ${umDia.toFixed(1)} após 1 dia`);
});

test('compartilhar o aprendizado entre totens e zonas ajuda no começo', () => {
  const seis = { steps: 720 };       // 6 horas
  const com = media([1, 2, 3, 4, 5, 6].map(seed => resumo(simular({ seed, ...seis })).ganho));
  const sem = media([1, 2, 3, 4, 5, 6].map(seed => resumo(simular({ seed, ...seis, params: { kz: 0, kt: 0 } })).ganho));
  assert.ok(com - sem > 0.05, `com hierarquia ${(com * 100).toFixed(1)}%, sem ${(sem * 100).toFixed(1)}%`);
});

test('continua superando a rotação nos cenários de evento', () => {
  for (const evento of ['chuva', 'show', 'greve', 'feriado']) {
    const r = resumo(simular({ seed: 3, steps: 1440, eventos: [evento] }));
    assert.ok(r.ganho > 0.05, `${evento}: ${(r.ganho * 100).toFixed(1)}%`);
  }
});

test('campanhas pausadas desde o início nunca vão ao ar', () => {
  const r = simular({ seed: 3, steps: 720, pausadas: [0, 3] });
  for (const politica of r.porCriativo) {
    assert.equal(politica.spots[0], 0);
    assert.equal(politica.spots[3], 0);
  }
  assert.ok(resumo(r).ganho > 0);
});

test('aguenta parâmetros extremos sem produzir valores inválidos', () => {
  const casos = [{ kz: 0, kt: 0 }, { acc: 0.6 }, { forget: 1 }, { rest: 0 }, { rest: 1 }];
  for (const params of casos) {
    const r = simular({ seed: 2, steps: 480, params });
    assert.ok(r.olhares > 0, JSON.stringify(params));
    assert.ok(r.interacoes.every(Number.isFinite), JSON.stringify(params));
    assert.ok(r.porCriativo[0].spots.reduce((a, b) => a + b, 0) > 0, JSON.stringify(params));
  }
});

test('com a câmera errando 40% das faixas etárias, ainda há ganho', () => {
  const r = resumo(simular({ seed: 4, steps: 1440, params: { acc: 0.6 } }));
  assert.ok(r.ganho > 0.10, `${(r.ganho * 100).toFixed(1)}%`);
});
