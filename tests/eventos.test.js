'use strict';
/* Formato de evento do totem (docs/EVENTOS.md): validação, geração pelo simulador e suficiência para o aprendizado. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Eventos = require('../site/js/eventos.js');
const Brain = require('../site/js/brain.js');
const { mulberry32 } = require('../site/js/util.js');
const { simular } = require('../tools/headless.js');

const { PERFIS } = Eventos;
const DOCS = path.join(__dirname, '..', 'docs');
const zeros = () => PERFIS.map(() => 0);
const base = () => Eventos.criar({ totem: 6, t: 6 * 3600, duracao: 30, criativo: 'brasa-cafe', audiencia: [0, 1, 0, 0, 0, 2, 1, 0], interacoes: [0, 0, 0, 0, 0, 1, 0, 0] });
const erros = ev => Eventos.validar(ev).erros;

test('um evento criado é válido e traz os campos do formato', () => {
  const ev = base();
  assert.deepEqual(Eventos.validar(ev), { ok: true, erros: [], avisos: [] });
  assert.equal(ev.totem, 'T-07');
  assert.equal(ev.inicio, '2026-01-05T06:00:00-03:00');
  assert.equal(ev.spot, 'T-07-20260105T060000');
  assert.deepEqual(Object.keys(ev), Eventos.CHAVES);
  assert.deepEqual(Eventos.totais(ev), { pessoas: 4, interacoes: 1 });
});

test('o evento aceita interações como um total por spot', () => {
  const ev = Eventos.criar({ totem: 0, t: 7 * 3600, duracao: 30, criativo: 'cine-aurora', audiencia: [1, 1, 1, 1, 0, 0, 0, 0], interacoes: 2 });
  assert.equal(Eventos.validar(ev).ok, true);
  assert.deepEqual(Eventos.totais(ev), { pessoas: 4, interacoes: 2 });
  const demais = { ...ev, interacoes: 9 };
  assert.equal(Eventos.validar(demais).ok, true);
  assert.equal(Eventos.validar(demais).avisos.length, 1);
});

test('rejeita eventos fora do formato', () => {
  const casos = {
    'campo faltando': ev => { delete ev.criativo; },
    'campo desconhecido': ev => { ev.extra = 1; },
    'versão errada': ev => { ev.versao = 2; },
    'tipo errado': ev => { ev.tipo = 'clique'; },
    'totem fora do padrão': ev => { ev.totem = 'totem7'; },
    'criativo com maiúscula': ev => { ev.criativo = 'Brasa-Cafe'; },
    'início sem fuso': ev => { ev.inicio = '2026-01-05T06:00:00'; },
    'início que não é data': ev => { ev.inicio = 'ontem'; },
    'duração zero': ev => { ev.duracao_s = 0; },
    'perfil faltando': ev => { delete ev.audiencia['M50+']; },
    'perfil desconhecido': ev => { ev.audiencia.X = 1; },
    'contagem negativa': ev => { ev.audiencia['H25-34'] = -1; },
    'contagem fracionária': ev => { ev.audiencia['H25-34'] = 1.5; },
    'interações maiores que a audiência do perfil': ev => { ev.interacoes['H18-24'] = 1; },
    'total de interações negativo': ev => { ev.interacoes = -1; },
  };
  for (const [nome, quebra] of Object.entries(casos)) {
    const ev = base();
    quebra(ev);
    assert.equal(Eventos.validar(ev).ok, false, nome);
  }
  for (const lixo of [null, 3, 'texto', [], undefined]) assert.equal(Eventos.validar(lixo).ok, false);
});

test('o JSON Schema e o código descrevem o mesmo formato', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(DOCS, 'evento-spot.schema.json'), 'utf8'));
  assert.deepEqual(schema.required, Eventos.CHAVES);
  assert.deepEqual(Object.keys(schema.properties), Eventos.CHAVES);
  assert.deepEqual(schema.$defs.contagens.required, PERFIS);
  assert.deepEqual(Object.keys(schema.$defs.contagens.properties), PERFIS);
  assert.equal(schema.additionalProperties, false);
});

test('os exemplos da documentação são válidos', () => {
  const linhas = fs.readFileSync(path.join(DOCS, 'exemplos', 'eventos-exemplo.jsonl'), 'utf8').trim().split('\n');
  assert.equal(linhas.length, 120);
  for (const l of linhas) assert.equal(Eventos.validar(JSON.parse(l)).ok, true, l);
  const reg = JSON.parse(fs.readFileSync(path.join(DOCS, 'exemplos', 'registro-exemplo.json'), 'utf8'));
  assert.equal(reg.totens.length, 42);
  assert.equal(reg.criativos.length, 7);
  const ids = new Set(reg.criativos.map(c => c.id));
  for (const l of linhas) assert.ok(ids.has(JSON.parse(l).criativo));
});

test('o simulador gera um evento válido por totem e por spot, com as mesmas somas do algoritmo', () => {
  const r = simular({ seed: 3, steps: 60, registrarEventos: true });
  const evs = r.eventosEmitidos;
  assert.equal(evs.length, 42 * 60);
  for (const ev of evs) assert.equal(Eventos.validar(ev).ok, true, JSON.stringify(ev));
  assert.equal(new Set(evs.map(e => e.spot)).size, evs.length, 'spots repetidos');
  const soma = evs.reduce((a, e) => { const t = Eventos.totais(e); return [a[0] + t.pessoas, a[1] + t.interacoes]; }, [0, 0]);
  assert.equal(soma[0], r.olhares);
  assert.equal(soma[1], r.interacoes[0]);
  const ids = new Set(r.registro.criativos.map(c => c.id));
  assert.ok(evs.every(e => ids.has(e.criativo)));
  const doTotem = evs.filter(e => e.totem === 'T-01');
  assert.equal(doTotem[0].inicio, '2026-01-05T06:00:00-03:00');
  doTotem.slice(1).forEach((e, i) => assert.equal(Date.parse(e.inicio) - Date.parse(doTotem[i].inicio), 30000));
});

test('registrar eventos não muda o resultado da simulação', () => {
  const com = simular({ seed: 4, steps: 120, registrarEventos: true });
  const sem = simular({ seed: 4, steps: 120 });
  assert.deepEqual(com.interacoes, sem.interacoes);
  assert.deepEqual(com.bins, sem.bins);
});

test('só com os eventos e o cadastro dá para recriar o aprendizado do melhor criativo por perfil', () => {
  const r = simular({ seed: 2, steps: 480, registrarEventos: true });         // 4 horas
  const zonas = [...new Set(r.registro.totens.map(t => t.zona))];
  const totemIdx = new Map(r.registro.totens.map((t, i) => [t.id, i]));
  const criativoIdx = new Map(r.registro.criativos.map((c, i) => [c.id, i]));
  const brain = Brain.create({
    nSeg: PERFIS.length, nCre: r.registro.criativos.length, nZones: zonas.length,
    zoneOf: r.registro.totens.map(t => zonas.indexOf(t.zona)), rng: mulberry32(5),
  });
  let ultimo = null;
  for (const ev of r.eventosEmitidos) {
    if (ev.inicio !== ultimo) { brain.decay(Math.exp(-Math.LN2 * 0.5 / 150)); ultimo = ev.inicio; }
    const i = totemIdx.get(ev.totem), c = criativoIdx.get(ev.criativo);
    PERFIS.forEach((p, s) => {
      const n = ev.audiencia[p], h = ev.interacoes[p];
      for (let k = 0; k < h; k++) brain.learn(i, s, c, true);
      for (let k = 0; k < n - h; k++) brain.learn(i, s, c, false);
    });
    brain.expose(i, c, Eventos.totais(ev).pessoas);
  }
  let certos = 0;
  for (let s = 0; s < PERFIS.length; s++) {
    let melhor = 0;
    for (let c = 1; c < criativoIdx.size; c++) if (brain.globalMean(s, c) > brain.globalMean(s, melhor)) melhor = c;
    if (melhor === r.verdade[s]) certos++;
  }
  assert.ok(certos >= 5, `acertou ${certos} de 8 perfis`);
});
