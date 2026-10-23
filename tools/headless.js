'use strict';
/* Roda o simulador completo (mundo, Brain, rotação e oráculo) sem navegador.
   Lê os mesmos arquivos de site/js, na mesma ordem do index.html, e os executa dentro de uma função isolada.
   Só os arquivos sem interface entram: util, config, world, brain e sim. */
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', 'site', 'js');
const ler = nome => fs.readFileSync(path.join(JS, nome + '.js'), 'utf8');

/* Código executado por simulação. Entre os arquivos, só entram os trechos que os conectam no navegador
   (os globais criados por util.js e brain.js). */
const CORPO = `
'use strict';
const self = {}, module = undefined;
${ler('util')}
const { pk, clamp, mulberry32, norm, gammaS, betaS, poisson, f2, fmt, pc, per1k } = self.Util;
${ler('eventos')}
const Eventos = self.Eventos;
${ler('config')}
${ler('world')}
${ler('brain')}
const Brain = self.Brain;
${ler('sim')}
sel = -1;                                  // sem rastreio de cálculos: mais rápido
Object.assign(PRM, opts.params || {});
(opts.eventos || []).forEach(k => { EV[k] = true; });
(opts.pausadas || []).forEach(c => { CON[c] = false; });
if (opts.escalaHorario) CRE.forEach(cr => { const f = cr.tm; cr.tm = h => 1 + opts.escalaHorario * (f(h) - 1); });
EVENTOS.ativo = !!opts.registrarEventos;
EVENTOS.max = Infinity;
const sementes = opts.sementes || [opts.seed];
const resultados = sementes.map(seed => {
  if (opts.cenario) { for (const _ of reproduzirPassos(opts.cenario)); } else init(seed);
  if (opts.escalaDesgaste) S.totems.forEach(t => { t.r *= opts.escalaDesgaste; });
  if (opts.desgasteVerdadeiro) brain.setRest(i => S.totems[i].r);
  if (opts.periodoVerdadeiro) brain.setPeriodFactor((c, per) => {   // teto: o algoritmo conhece o efeito do horário
    let a = 0, d = 0;
    for (let h = 0; h < 24; h++) { const v = CRE[c].tm(h); d += v; if (((h / 3) | 0) === per) a += v; }
    return (a / 3) / (d / 24);
  });
  if (opts.sessao) {   // mudanças feitas durante a sessão, como a tela faz: aplicadas e registradas no passo certo
    let i = 0;
    for (let k = 0; k < opts.steps; k++) {
      while (i < opts.sessao.length && opts.sessao[i].passo <= k) { const m = opts.sessao[i++]; aplicarMudanca(m); registrarMudanca(m.tipo, m.chave, m.valor); }
      step();
    }
  } else if (!opts.cenario) for (let k = 0; k < opts.steps; k++) step();
  const out = resumirMundo();
  out.cenario = cenarioAtual(opts.nomeCenario);
  if (opts.registrarEventos) { out.eventosEmitidos = EVENTOS.lista.slice(); EVENTOS.lista.length = 0; out.registro = registroDoMundo(); }
  return out;
});
return opts.sementes ? resultados : resultados[0];`;

const executar = new Function('opts', 'performance', CORPO);

/* opts.seed       semente do mundo e do algoritmo
   opts.cenario    cenário salvo (docs/CENARIOS.md): refaz a sessão do zero; devolve também cenario, o cenário desta execução
   opts.sessao     lista de mudanças {passo, tipo, chave, valor} aplicadas durante a execução, como faria a tela
   opts.sementes   lista de sementes rodadas em sequência no mesmo ambiente (devolve uma lista de resultados)
   opts.registrarEventos  guarda os eventos de spot (docs/EVENTOS.md) em eventosEmitidos e o cadastro em registro
   opts.steps      spots de 30 s (2880 = um dia, começando às 06:00 de segunda)
   opts.params     sobrescreve parâmetros do algoritmo e da câmera (acc, kz, kt, rest, forget, look)
   opts.eventos    cenários ligados desde o início (chuva, show, greve, feriado)
   opts.pausadas   índices de campanhas pausadas desde o início */
function simular(opts = {}) {
  return executar({ seed: 1, steps: 2880, ...opts }, performance);
}

/* eficiência = interações da política / interações do oráculo, somadas num intervalo de bins de 15 min */
function eficiencia(bins, politica, de = 0, ate = bins.length) {
  let a = 0, o = 0;
  for (let k = de; k < ate; k++) { a += bins[k][politica]; o += bins[k][2]; }
  return o > 0 ? a / o : 0;
}

function resumo(r) {
  const [alg, rot, orc] = r.interacoes;
  const n = r.bins.length;
  return {
    ganho: alg / rot - 1,
    efAlgoritmo: alg / orc,
    efRotacao: rot / orc,
    efInicio: eficiencia(r.bins, 0, 0, Math.min(12, n)),
    efFim: eficiencia(r.bins, 0, Math.max(0, n - 12), n),
    acertos: r.melhor.filter((c, s) => c === r.verdade[s]).length,
    perfis: r.melhor.length,
  };
}

function estatistica(v) {
  const n = v.length, media = v.reduce((a, b) => a + b, 0) / n;
  const dp = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : 0;
  return { media, dp, min: Math.min(...v), max: Math.max(...v), n };
}

module.exports = { simular, resumo, estatistica, eficiencia };
