'use strict';
/* Garantias técnicas de privacidade (docs/PRIVACIDADE.md): só contagens agregadas entram, nada é guardado além delas,
   e o site não usa câmera, rede de dados nem armazenamento do navegador. Não substitui a revisão jurídica. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Eventos = require('../site/js/eventos.js');
const Operador = require('../site/js/operador.js');
const { mulberry32 } = require('../site/js/util.js');
const { criarServidor } = require('../tools/servidor.js');

const RAIZ = path.join(__dirname, '..');
const CAD = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs', 'exemplos', 'registro-exemplo.json'), 'utf8'));
const EVENTOS = fs.readFileSync(path.join(RAIZ, 'docs', 'exemplos', 'eventos-exemplo.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const SEGREDO = 'SEGREDO-12345';
const CAMPOS_PROIBIDOS = ['imagem', 'foto', 'video', 'rosto', 'face', 'embedding', 'biometria', 'pessoa_id', 'aparelho', 'mac', 'ip', 'cpf', 'nome'];

test('o evento recusa qualquer campo além das contagens do formato, em qualquer nível', () => {
  assert.equal(Eventos.validar(EVENTOS[0]).ok, true);
  for (const campo of CAMPOS_PROIBIDOS) {
    const v = Eventos.validar({ ...EVENTOS[0], [campo]: SEGREDO });
    assert.equal(v.ok, false, campo);
    assert.ok(v.erros.some(e => e.includes('campo desconhecido: ' + campo)), campo);
    const dentro = Eventos.validar({ ...EVENTOS[0], audiencia: { ...EVENTOS[0].audiencia, [campo]: 1 } });
    assert.equal(dentro.ok, false, 'dentro da audiência: ' + campo);
  }
});

test('as contagens só aceitam inteiros: nenhum texto passa escondido nelas', () => {
  for (const ruim of [SEGREDO, -1, 1.5, null, {}, [1], true]) {
    assert.equal(Eventos.validar({ ...EVENTOS[0], audiencia: { ...EVENTOS[0].audiencia, 'H18-24': ruim } }).ok, false, JSON.stringify(ruim));
    assert.equal(Eventos.validar({ ...EVENTOS[0], interacoes: ruim }).ok, false, 'interacoes ' + JSON.stringify(ruim));
  }
});

test('o JSON Schema do evento fecha todos os objetos', () => {
  const s = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs', 'evento-spot.schema.json'), 'utf8'));
  assert.equal(s.additionalProperties, false);
  assert.equal(s.$defs.contagens.additionalProperties, false);
  assert.deepEqual(Object.keys(s.properties).sort(), [...Eventos.CHAVES].sort());
});

test('o pedido de decidir só aceita totem, leitura e quando, com contagens inteiras', () => {
  const ok = { totem: 'T-01', leitura: { 'H25-34': 2 }, quando: '2026-01-05T09:00:00-03:00' };
  assert.deepEqual(Operador.validarPedido(ok), []);
  assert.deepEqual(Operador.validarPedido({ totem: 'T-01' }), []);
  assert.deepEqual(Operador.validarPedido({ totem: 'T-01', leitura: [0, 0, 0, 0, 0, 0, 0, 1] }), []);
  for (const campo of CAMPOS_PROIBIDOS) assert.ok(Operador.validarPedido({ ...ok, [campo]: SEGREDO }).length > 0, campo);
  for (const ruim of [
    { ...ok, leitura: { rosto: 1 } }, { ...ok, leitura: { 'H25-34': SEGREDO } }, { ...ok, leitura: { 'H25-34': 1.5 } },
    { ...ok, leitura: { 'H25-34': -1 } }, { ...ok, leitura: [1, 2] }, { ...ok, leitura: SEGREDO }, { ...ok, quando: SEGREDO }, { ...ok, totem: 5 },
  ]) assert.ok(Operador.validarPedido(ruim).length > 0, JSON.stringify(ruim));
  assert.ok(Operador.validarPedido(null).length > 0);
  assert.throws(() => Operador.criar({ cadastro: CAD, rng: mulberry32(1) }).decidir({ ...ok, foto: SEGREDO }), /pedido inválido/);
});

async function comServidor(fn) {
  const op = Operador.criar({ cadastro: CAD, rng: mulberry32(1) }), servidor = criarServidor(op, {});
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const chama = async (rota, corpo) => {
    const r = await fetch(base + rota, { method: 'POST', body: JSON.stringify(corpo) });
    const texto = await r.text();
    return { status: r.status, texto };
  };
  try { await fn(chama, op); } finally { await new Promise(r => servidor.close(r)); }
}

test('o servidor recusa campos extras em todas as rotas e nunca devolve o que recusou', async () => {
  await comServidor(async (chama) => {
    const ev = await chama('/evento', { ...EVENTOS[0], foto: SEGREDO });
    assert.equal(JSON.parse(ev.texto).rejeitados, 1);
    assert.ok(!ev.texto.includes(SEGREDO));
    const d = await chama('/decidir', { totem: 'T-01', leitura: {}, foto: SEGREDO });
    assert.equal(d.status, 400);
    assert.ok(!d.texto.includes(SEGREDO));
    const l = await chama('/decidir', { totem: 'T-01', leitura: { rosto: SEGREDO } });
    assert.equal(l.status, 400);
    const c = await chama('/campanha', { criativo: CAD.criativos[0].id, ativa: true, foto: SEGREDO });
    assert.equal(c.status, 400);
    assert.ok(!c.texto.includes(SEGREDO));
    assert.equal((await chama('/campanha', { criativo: CAD.criativos[0].id, ativa: 'sim' })).status, 400);
  });
});

test('o servidor não escreve nenhum registro ao receber pedidos', async () => {
  const chamadas = [];
  const originais = ['log', 'info', 'warn', 'error', 'debug'].map(m => [m, console[m]]);
  originais.forEach(([m]) => { console[m] = (...a) => chamadas.push([m, a]); });
  try {
    await comServidor(async (chama) => {
      await chama('/evento', EVENTOS[0]);
      await chama('/decidir', { totem: 'T-01', leitura: {} });
      await chama('/decidir', { totem: 'T-01', foto: SEGREDO });
    });
  } finally { originais.forEach(([m, f]) => { console[m] = f; }); }
  assert.deepEqual(chamadas, []);
});

test('o estado guardado só tem identificadores do cadastro, ids de spot e números', () => {
  const op = Operador.criar({ cadastro: CAD, rng: mulberry32(1) });
  for (const ev of EVENTOS) op.registrar(ev);
  op.decidir({ totem: CAD.totens[0].id, leitura: { 'H25-34': 2 }, quando: '2026-01-05T09:00:00-03:00' });
  const conhecidas = new Set([...CAD.totens.flatMap(t => [t.id, t.nome, t.zona]), ...CAD.criativos.flatMap(c => [c.id, c.nome])]);
  const textos = [];
  const varre = v => {
    if (typeof v === 'string') textos.push(v);
    else if (Array.isArray(v)) v.forEach(varre);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { textos.push(k); varre(x); }
  };
  varre(JSON.parse(JSON.stringify(op.exportar())));
  const chaves = new Set(['versao', 'cadastro', 'params', 'brain', 'relogio', 'contadores', 'vistos', 'mix', 'beta', 'ativos', 'totens', 'criativos', 'id', 'nome', 'zona']);
  const estranhos = textos.filter(t => !conhecidas.has(t) && !/^T-\d+-\d{8}T\d{6}$/.test(t) && !/^[a-zA-Z]+$/.test(t));
  assert.deepEqual(estranhos, []);
  // só as chaves conhecidas, em qualquer nível: nada de campo novo escondido no estado
  const nivel = JSON.parse(JSON.stringify(op.exportar()));
  assert.deepEqual(Object.keys(nivel).sort(), ['ativos', 'beta', 'brain', 'cadastro', 'contadores', 'mix', 'params', 'relogio', 'versao', 'vistos'].sort());
  assert.ok(chaves.size > 0);
});

/* o site simulado: nada de câmera, rede de dados nem armazenamento no navegador, e só dois servidores externos */
function arquivos(dir, ext) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? arquivos(path.join(dir, e.name), ext) : e.name.endsWith(ext) ? [path.join(dir, e.name)] : []);
}

test('o site não usa câmera, rede de dados nem armazenamento do navegador', () => {
  const proibidos = ['getUserMedia', 'mediaDevices', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'geolocation'];
  const achados = [];
  for (const f of [...arquivos(path.join(RAIZ, 'site'), '.js'), path.join(RAIZ, 'site', 'index.html')]) {
    const t = fs.readFileSync(f, 'utf8');
    for (const p of proibidos) if (t.includes(p)) achados.push(`${path.relative(RAIZ, f)}: ${p}`);
  }
  assert.deepEqual(achados, []);
});

test('o site só carrega recursos de servidores externos conhecidos (fontes e Three.js), e nenhum outro', () => {
  const hosts = new Set();
  for (const f of [...arquivos(path.join(RAIZ, 'site'), '.js'), ...arquivos(path.join(RAIZ, 'site'), '.html'), ...arquivos(path.join(RAIZ, 'site'), '.css')]) {
    // o endereço www.w3.org/2000/svg é só o nome do espaço SVG: o navegador não o acessa
    const texto = fs.readFileSync(f, 'utf8').split('http://www.w3.org/2000/svg').join('');
    for (const m of texto.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) hosts.add(m[1]);
  }
  assert.deepEqual([...hosts].sort(), ['cdnjs.cloudflare.com', 'fonts.googleapis.com']);
});
