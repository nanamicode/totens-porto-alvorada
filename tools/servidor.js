'use strict';
/* Servidor HTTP do Operador: recebe eventos dos totens e responde qual criativo exibir.
   Sem dependências, só o Node. É um protótipo: não tem criptografia nem usuários. Veja docs/OPERACAO.md.

   Uso:  npm run servidor -- --cadastro=docs/exemplos/registro-exemplo.json --estado=estado.json --porta=8787
   --cadastro=ARQ   cadastro de totens e criativos (padrão docs/exemplos/registro-exemplo.json)
   --estado=ARQ     guarda o aprendizado nesse arquivo e o retoma ao reiniciar
   --porta=N        porta (padrão 8787)
   --host=H         endereço (padrão 127.0.0.1, só esta máquina)
   --salvar-cada=S  segundos entre as gravações do estado (padrão 30)
   --token=T        exige "Authorization: Bearer T" em tudo, menos em /saude

   Rotas:  GET /saude · GET /estado · GET /aprendido
           POST /evento    um evento, uma lista de eventos ou JSON Lines
           POST /decidir   {totem, leitura, quando}
           POST /campanha  {criativo, ativa} */
const http = require('http');
const fs = require('fs');
const path = require('path');
const Operador = require('../site/js/operador.js');

const LIMITE = 1024 * 1024;

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on('data', p => {
      tamanho += p.length;
      if (tamanho > LIMITE) { reject(Object.assign(new Error('corpo grande demais'), { status: 413 })); req.destroy(); return; }
      partes.push(p);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

/* um evento, uma lista, ou JSON Lines (um evento por linha) */
function lerEventos(texto) {
  const t = texto.trim();
  if (!t) throw Object.assign(new Error('corpo vazio'), { status: 400 });
  try {
    const v = JSON.parse(t);
    return Array.isArray(v) ? v : [v];
  } catch (e) {
    const linhas = t.split('\n').map(l => l.trim()).filter(Boolean);
    try { return linhas.map(l => JSON.parse(l)); } catch (e2) {
      throw Object.assign(new Error('o corpo não é JSON nem JSON Lines'), { status: 400 });
    }
  }
}

/* opcoes.token: exige "Authorization: Bearer <token>" · opcoes.aoMudar: chamado depois de eventos ou campanhas */
function criarServidor(op, opcoes = {}) {
  const responder = (res, status, corpo) => {
    const texto = JSON.stringify(corpo);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(texto) });
    res.end(texto);
  };
  return http.createServer(async (req, res) => {
    try {
      const rota = req.method + ' ' + new URL(req.url, 'http://x').pathname;
      if (rota === 'GET /saude') return responder(res, 200, { ok: true });
      if (opcoes.token && req.headers.authorization !== 'Bearer ' + opcoes.token) return responder(res, 401, { erro: 'não autorizado' });
      if (rota === 'GET /estado') return responder(res, 200, op.estado());
      if (rota === 'GET /aprendido') return responder(res, 200, op.aprendido());
      if (rota === 'POST /evento') {
        const eventos = lerEventos(await lerCorpo(req));
        const resultados = eventos.map(ev => ({ spot: ev && ev.spot, ...op.registrar(ev) }));
        const conta = m => resultados.filter(r => (m === 'aceito' ? r.aceito : r.motivo === m)).length;
        if (opcoes.aoMudar) opcoes.aoMudar();
        return responder(res, 200, {
          recebidos: eventos.length, aceitos: conta('aceito'), duplicados: conta('duplicado'),
          rejeitados: resultados.filter(r => !r.aceito && r.motivo !== 'duplicado').length,
          resultados: resultados.filter(r => !r.aceito).slice(0, 100),
        });
      }
      if (rota === 'POST /decidir') {
        let pedido;
        try { pedido = JSON.parse(await lerCorpo(req)); } catch (e) { return responder(res, 400, { erro: 'o corpo não é JSON' }); }
        try { return responder(res, 200, op.decidir(pedido)); } catch (e) { return responder(res, 404, { erro: e.message }); }
      }
      if (rota === 'POST /campanha') {
        let pedido;
        try { pedido = JSON.parse(await lerCorpo(req)); } catch (e) { return responder(res, 400, { erro: 'o corpo não é JSON' }); }
        try { op.campanha(pedido.criativo, pedido.ativa); } catch (e) { return responder(res, 400, { erro: e.message }); }
        if (opcoes.aoMudar) opcoes.aoMudar();
        return responder(res, 200, op.estado());
      }
      return responder(res, 404, { erro: 'rota desconhecida' });
    } catch (e) {
      return responder(res, e.status || 500, { erro: e.status ? e.message : 'erro interno' });
    }
  });
}

function salvarEstado(op, arquivo) {
  const tmp = arquivo + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(op.exportar()));
  fs.renameSync(tmp, arquivo);
}

function principal() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']; }));
  const arquivoEstado = args.estado;
  let op;
  if (arquivoEstado && fs.existsSync(arquivoEstado)) {
    const estado = JSON.parse(fs.readFileSync(arquivoEstado, 'utf8'));
    op = Operador.criar({ cadastro: estado.cadastro, estado });
    console.log(`Aprendizado retomado de ${arquivoEstado} (${op.estado().eventos.aceitos} eventos já aprendidos).`);
    if (args.cadastro) console.log('O cadastro guardado no estado vale mais que --cadastro. Apague o arquivo de estado para começar do zero.');
  } else {
    const cad = path.resolve(args.cadastro || path.join(__dirname, '..', 'docs', 'exemplos', 'registro-exemplo.json'));
    op = Operador.criar({ cadastro: JSON.parse(fs.readFileSync(cad, 'utf8')) });
    console.log(`Começando do zero com o cadastro ${cad}.`);
  }
  let sujo = false;
  const salvar = () => { if (arquivoEstado && sujo) { salvarEstado(op, arquivoEstado); sujo = false; } };
  const servidor = criarServidor(op, { token: args.token, aoMudar: () => { sujo = true; } });
  const temporizador = setInterval(salvar, Number(args['salvar-cada'] ?? 30) * 1000);
  const encerrar = () => { clearInterval(temporizador); salvar(); servidor.close(); process.exit(0); };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
  const porta = Number(args.porta ?? 8787), host = args.host || '127.0.0.1';
  servidor.on('error', e => {
    console.error(e.code === 'EADDRINUSE' ? `A porta ${porta} já está em uso. Use --porta=OUTRA.` : `Não foi possível iniciar o servidor: ${e.message}`);
    clearInterval(temporizador);
    process.exit(1);
  });
  servidor.listen(porta, host, () => console.log(`Operador em http://${host}:${porta}${args.token ? ' (com token)' : ''}${arquivoEstado ? ', estado em ' + arquivoEstado : ', sem guardar estado'}`));
}

if (require.main === module) principal();
module.exports = { criarServidor, salvarEstado };
