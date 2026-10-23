'use strict';
/* Cenários: formato, validação, link e reprodução do zero (site/js/cenario.js, sim.js e tools/cenario.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Cenario = require('../site/js/cenario.js');
const { simular } = require('../tools/headless.js');

const base = () => ({
  versao: 1, nome: 'teste', semente: 5, passos: 300,
  config0: { params: { kz: 0 }, eventos: { chuva: true }, campanhasPausadas: [2] },
  mudancas: [
    { passo: 50, tipo: 'evento', chave: 'greve', valor: true },
    { passo: 120, tipo: 'campanha', chave: 0, valor: false },
    { passo: 200, tipo: 'param', chave: 'kz', valor: 5 },
  ],
});
const erros = c => Cenario.validar(c).erros;

test('um cenário válido passa, e os exemplos também', () => {
  assert.deepEqual(Cenario.validar(base()), { ok: true, erros: [] });
  assert.equal(Cenario.validar({ versao: 1, semente: 0, passos: 0, config0: {}, mudancas: [] }).ok, true);
  for (const x of Cenario.exemplos()) assert.deepEqual(Cenario.validar(x.cenario), { ok: true, erros: [] }, x.id);
});

test('recusa cenários fora do formato, dizendo o que está errado', () => {
  const casos = {
    'não é objeto': () => 3,
    'versão errada': c => { c.versao = 2; },
    'semente negativa': c => { c.semente = -1; },
    'semente fracionária': c => { c.semente = 1.5; },
    'passos demais': c => { c.passos = Cenario.MAX_PASSOS + 1; },
    'passos negativos': c => { c.passos = -1; },
    'nome grande': c => { c.nome = 'x'.repeat(81); },
    'config0 faltando': c => { delete c.config0; },
    'parâmetro desconhecido': c => { c.config0.params.xyz = 1; },
    'parâmetro negativo': c => { c.config0.params.kz = -3; },
    'cenário desconhecido': c => { c.config0.eventos.terremoto = true; },
    'cenário não booleano': c => { c.config0.eventos.chuva = 'sim'; },
    'campanha fora da faixa': c => { c.config0.campanhasPausadas = [9]; },
    'campanha repetida': c => { c.config0.campanhasPausadas = [1, 1]; },
    'todas as campanhas pausadas': c => { c.config0.campanhasPausadas = [0, 1, 2, 3, 4, 5, 6]; },
    'mudanças não é lista': c => { c.mudancas = {}; },
    'mudança sem tipo': c => { c.mudancas[0].tipo = 'sumir'; },
    'mudança fora do tempo': c => { c.mudancas[0].passo = c.passos + 1; },
    'mudanças fora de ordem': c => { c.mudancas[0].passo = 150; },
    'mudança de evento inválida': c => { c.mudancas[0].chave = 'x'; },
    'mudança de campanha sem booleano': c => { c.mudancas[1].valor = 'n'; },
    'mudança de parâmetro inválida': c => { c.mudancas[2].valor = Infinity; },
    'resultado incompleto': c => { c.resultado = { olhares: 1 }; },
  };
  for (const [nome, quebra] of Object.entries(casos)) {
    const c = base();
    const novo = quebra(c);
    const v = Cenario.validar(novo === undefined ? c : novo);
    assert.equal(v.ok, false, nome);
    assert.ok(v.erros.length > 0, nome);
  }
  assert.ok(erros({ ...base(), mudancas: Array.from({ length: 2001 }, () => ({ passo: 0, tipo: 'param', chave: 'kz', valor: 1 })) }).length > 0);
});

test('o link leva o cenário em texto que cabe no endereço, e volta igual', () => {
  const c = { ...base(), nome: 'Greve às 9h, ação e coração' };
  const token = Cenario.codificar(c);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(Cenario.decodificar(token), c);
  assert.deepEqual(Cenario.ler('#cenario.' + token), c);
  assert.deepEqual(Cenario.ler('https://exemplo.com/site/index.html#cenario.' + token), c);
  assert.deepEqual(Cenario.ler('cenario.' + token), c);
  assert.deepEqual(Cenario.ler(JSON.stringify(c)), c);
  assert.deepEqual(Cenario.ler('  ' + JSON.stringify(c, null, 1) + '\n'), c);
  for (const lixo of ['', '   ', 'isto não é um cenário', 'cenario.@@@', '{quebrado']) assert.throws(() => Cenario.ler(lixo), /cole|não é|não pôde|inválido/);
  assert.throws(() => Cenario.decodificar('????'), /não é válido/);
  assert.throws(() => Cenario.decodificar('abc'), /legível|válido/);
});

test('refazer um cenário do zero dá sempre o mesmo resultado', () => {
  const c = base();
  const a = simular({ cenario: c }), b = simular({ cenario: c });
  assert.deepEqual(a.interacoes, b.interacoes);
  assert.equal(a.olhares, b.olhares);
  assert.deepEqual(a.bins, b.bins);
  assert.deepEqual(a.porCriativo, b.porCriativo);
});

test('as mudanças do caminho são aplicadas no passo certo e mudam o resultado', () => {
  const c = base();
  const com = simular({ cenario: c });
  const sem = simular({ cenario: { ...c, mudancas: [] } });
  assert.notDeepEqual(com.interacoes, sem.interacoes);
  // a campanha 0 é pausada no passo 120: o número de spots dela para de crescer
  const ate119 = simular({ cenario: { ...c, passos: 120 } });
  const ate300 = simular({ cenario: c });
  assert.equal(ate300.porCriativo[0].spots[0], ate119.porCriativo[0].spots[0]);
  assert.ok(ate300.porCriativo[1].spots[1] > ate119.porCriativo[1].spots[1]);
  // a campanha 2 já começa pausada
  assert.equal(com.porCriativo[0].spots[2], 0);
  // uma mudança no passo 0 vale desde o começo; uma no último passo vale para o estado final
  const noInicio = simular({ cenario: { ...c, config0: {}, mudancas: [{ passo: 0, tipo: 'campanha', chave: 1, valor: false }] } });
  assert.equal(noInicio.porCriativo[0].spots[1], 0);
  const noFim = simular({ cenario: { ...c, config0: {}, mudancas: [{ passo: 300, tipo: 'param', chave: 'kz', valor: 7 }] } });
  assert.equal(noFim.cenario.mudancas.length, 1);
});

test('o cenário que a execução devolve refaz a mesma execução', () => {
  const a = simular({ seed: 7, steps: 400, eventos: ['chuva'], pausadas: [2], params: { kz: 10 }, nomeCenario: 'gravado' });
  assert.equal(a.cenario.semente, 7);
  assert.equal(a.cenario.passos, 400);
  assert.equal(a.cenario.nome, 'gravado');
  assert.deepEqual(a.cenario.config0.campanhasPausadas, [2]);
  assert.equal(a.cenario.config0.eventos.chuva, true);
  assert.equal(a.cenario.config0.params.kz, 10);
  assert.equal(Cenario.validar(a.cenario).ok, true);
  const b = simular({ cenario: a.cenario });
  assert.deepEqual(b.interacoes, a.interacoes);
  assert.equal(b.olhares, a.olhares);
  assert.deepEqual(a.cenario.resultado, { olhares: a.olhares, interacoes: a.interacoes });
});

test('mudanças feitas durante a sessão são registradas e refeitas, e arrastar um controle vale uma só', () => {
  const sessao = [
    { passo: 60, tipo: 'evento', chave: 'show', valor: true },
    { passo: 130, tipo: 'param', chave: 'kz', valor: 20 },
    { passo: 130, tipo: 'param', chave: 'kz', valor: 15 },       // o mesmo controle, no mesmo passo
    { passo: 130, tipo: 'param', chave: 'kt', valor: 30 },
    { passo: 200, tipo: 'campanha', chave: 3, valor: false },
  ];
  const viva = simular({ seed: 9, steps: 320, sessao });
  assert.deepEqual(viva.cenario.mudancas.map(m => [m.passo, m.tipo, m.chave, m.valor]),
    [[60, 'evento', 'show', true], [130, 'param', 'kz', 15], [130, 'param', 'kt', 30], [200, 'campanha', 3, false]]);
  assert.equal(Cenario.validar(viva.cenario).ok, true);
  const refeita = simular({ cenario: viva.cenario });
  assert.deepEqual(refeita.interacoes, viva.interacoes);
  assert.equal(refeita.olhares, viva.olhares);
  assert.deepEqual(refeita.cenario.mudancas, viva.cenario.mudancas);
  const semMudancas = simular({ seed: 9, steps: 320 });
  assert.notDeepEqual(semMudancas.interacoes, viva.interacoes);
});

const CLI = path.join(__dirname, '..', 'tools', 'cenario.js');
const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' });

test('o comando cenario cria, refaz e confere, e recusa arquivos inválidos', () => {
  const novo = cli('--novo', '--semente=4', '--passos=120', '--evento=chuva,greve', '--pausar=1', '--kz=3', '--nome=Teste');
  assert.equal(novo.status, 0, novo.stderr);
  const c = JSON.parse(novo.stdout);
  assert.equal(c.semente, 4);
  assert.equal(c.nome, 'Teste');
  assert.deepEqual(c.config0.campanhasPausadas, [1]);
  assert.equal(c.config0.params.kz, 3);
  assert.equal(c.config0.eventos.greve, true);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cen-'));
  try {
    const arq = path.join(dir, 'c.json');
    fs.writeFileSync(arq, novo.stdout);
    const ok = cli(arq);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /Conferido/);
    const errado = { ...c, resultado: { olhares: c.resultado.olhares + 1, interacoes: c.resultado.interacoes } };
    fs.writeFileSync(arq, JSON.stringify(errado));
    const dif = cli(arq);
    assert.equal(dif.status, 4);
    assert.match(dif.stdout, /não batem/);
    fs.writeFileSync(arq, JSON.stringify({ ...c, semente: -5 }));
    const inv = cli(arq);
    assert.equal(inv.status, 2);
    assert.match(inv.stderr, /inválido/);
    fs.writeFileSync(arq, 'não é json');
    assert.equal(cli(arq).status, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  assert.equal(cli().status, 2);
  assert.equal(cli('arquivo-que-nao-existe.json').status, 2);
});

test('o exemplo da documentação é válido e se refaz com os números salvos', () => {
  const arq = path.join(__dirname, '..', 'docs', 'exemplos', 'cenario-exemplo.json');
  const c = JSON.parse(fs.readFileSync(arq, 'utf8'));
  assert.equal(Cenario.validar(c).ok, true);
  assert.equal(c.mudancas.length, 2);
  const r = simular({ cenario: c });
  assert.deepEqual({ olhares: r.olhares, interacoes: r.interacoes }, c.resultado);
});
