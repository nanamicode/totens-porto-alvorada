'use strict';
/* Criativo novo no meio da operação: partida a frio, teste e adoção (docs/ALGORITMO.md, tools/lancar.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const Cenario = require('../site/js/cenario.js');
const { simular } = require('../tools/headless.js');

const lancar = passo => [{ passo, tipo: 'campanha', chave: 7, valor: true }];
const rodar = (extra = {}) => simular({ seed: 2, steps: 1500, sessao: lancar(300), ...extra });

test('antes do lançamento o criativo reservado não existe para o algoritmo, a rotação e o oráculo', () => {
  const r = simular({ seed: 2, steps: 600, registrarEventos: true });
  assert.equal(r.lancamento, null);
  for (let p = 0; p < 3; p++) assert.equal(r.porCriativo[p].spots[7], 0);
  assert.equal(r.registro.criativos.length, 7);
  assert.ok(r.registro.criativos.every(c => c.id !== 'orla-sorvetes'));
  assert.equal(rodar({ registrarEventos: true }).registro.criativos.length, 8);
});

test('um criativo bom é testado em poucos minutos e adotado em poucas horas, sem nenhuma contagem prévia', () => {
  const r = rodar();
  const L = r.lancamento;
  assert.equal(L.passo, 300);
  assert.ok(r.porCriativo[0].spots[7] > 0 && r.porCriativo[1].spots[7] > 0 && r.porCriativo[2].spots[7] > 0);
  assert.ok(L.testadoEm !== null && L.testadoEm <= 60, `testado em ${L.testadoEm} passos`);   // 30 min
  assert.ok(L.oraculoJa, 'o oráculo escolhe um criativo bom');
  assert.ok(L.adotadoEm !== null && L.adotadoEm <= 360, `adotado em ${L.adotadoEm} passos`);   // 3 h
  assert.ok(L.fatiaAlgoritmo > 0.15, `fatia do algoritmo ${L.fatiaAlgoritmo}`);
});

test('um criativo fraco é testado mas o algoritmo quase não o usa, e não é dado como adotado', () => {
  const r = rodar({ params: { qnovo: 0.3 } });
  const L = r.lancamento;
  assert.ok(L.testadoEm !== null, 'foi testado');
  assert.equal(L.oraculoJa, false);
  assert.equal(L.adotadoEm, null);
  const fatia = r.porCriativo[0].spots[7] / ((1500 - 300) * r.totens);
  assert.ok(fatia < 0.03, `fatia dos spots ${fatia}`);
});

test('o lançamento entra no cenário salvo e a sessão se refaz igual', () => {
  const a = rodar({ nomeCenario: 'lançamento' });
  assert.deepEqual(a.cenario.mudancas.map(m => [m.passo, m.tipo, m.chave, m.valor]), [[300, 'campanha', 7, true]]);
  assert.deepEqual(a.cenario.config0.campanhasPausadas, []);
  assert.equal(Cenario.validar(a.cenario).ok, true);
  const b = simular({ cenario: a.cenario });
  assert.deepEqual(b.interacoes, a.interacoes);
  assert.deepEqual(b.lancamento, a.lancamento);
  assert.notEqual(Cenario.validar({ ...a.cenario, mudancas: [{ passo: 1, tipo: 'campanha', chave: 8, valor: true }] }).ok, true);
});

test('uma cidade nova começa sem o criativo lançado', () => {
  const duas = simular({ sementes: [2, 3], steps: 900, sessao: lancar(300) });
  const so3 = simular({ seed: 3, steps: 900, sessao: lancar(300) });
  assert.deepEqual(duas[1].interacoes, so3.interacoes);
  assert.deepEqual(duas[1].lancamento, so3.lancamento);
  const sem = simular({ sementes: [2, 3], steps: 300 });
  assert.equal(sem[1].lancamento, null);
});
