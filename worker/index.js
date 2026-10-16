/* ==========================================================================
   worker/index.js — API da conta (Cloudflare Workers + D1)
   --------------------------------------------------------------------------
   Roda no mesmo endereço do site: o Worker atende só /api/*; o resto são os
   arquivos estáticos (wrangler.jsonc). O que fica aqui:
     • login com o Discord (OAuth, escopo "identify"; o token do Discord não é guardado);
     • sessões por cookie HttpOnly (só o hash do token vai para o banco);
     • códigos de acesso de uso único e curta validade, que liberam "escopos"
       de conteúdo por X dias;
     • o conteúdo protegido (texto integral), entregue só a quem tem acesso;
     • rotas de admin (o dono, pelo ID do Discord em ADMIN_DISCORD_ID).
   Segredos (nunca no repositório): DISCORD_CLIENT_SECRET e SEGREDO (chave que
   amarra o hash dos códigos). Variáveis: DISCORD_CLIENT_ID e ADMIN_DISCORD_ID.
   ========================================================================== */

const DIA = 86400;
const SESSAO_DIAS = 14;
const COOKIE_SESSAO = '__Host-sessao';
const COOKIE_ESTADO = '__Host-estado';
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem I, L, O, 0 e 1 (confundem)
const TENTATIVAS_POR_HORA = 8;
const LIMITE_TEXTO = 100000; // caracteres por item de conteúdo
const LIMITE_ITENS = 500;
const ESCOPO_VALIDO = /^[a-z0-9-]{1,40}$/;
const CHAVE_VALIDA = /^[a-zA-Z0-9._-]{1,80}$/;

/* ------------------------------------------------------------------------
   Utilitários
   ------------------------------------------------------------------------ */

function agora(env) {
  return typeof env.relogio === 'function' ? env.relogio() : Math.floor(Date.now() / 1000);
}

function resposta(corpo, status, extras) {
  const cabecalhos = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  if (extras) Object.keys(extras).forEach(function (k) { cabecalhos.append(k, extras[k]); });
  return new Response(JSON.stringify(corpo), { status: status || 200, headers: cabecalhos });
}

function erro(status, mensagem) {
  return resposta({ erro: mensagem }, status);
}

function bytesParaHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

async function sha256(texto) {
  return bytesParaHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
}

async function hmac(segredo, texto) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesParaHex(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(texto)));
}

function aleatorioHex(bytes) {
  return bytesParaHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Código no formato XXXX-XXXX-XXXX (sorteio sem viés, 31 símbolos). */
function gerarCodigo() {
  let letras = '';
  while (letras.length < 12) {
    const sorteio = crypto.getRandomValues(new Uint8Array(24));
    for (let i = 0; i < sorteio.length && letras.length < 12; i++) {
      if (sorteio[i] < 248) letras += ALFABETO_CODIGO[sorteio[i] % ALFABETO_CODIGO.length]; // 248 = 8 × 31
    }
  }
  return letras.slice(0, 4) + '-' + letras.slice(4, 8) + '-' + letras.slice(8, 12);
}

function normalizarCodigo(texto) {
  return String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function lerCookies(request) {
  const saida = {};
  (request.headers.get('cookie') || '').split(';').forEach(function (par) {
    const i = par.indexOf('=');
    if (i > 0) saida[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  });
  return saida;
}

function cookie(nome, valor, segundos) {
  return nome + '=' + valor + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + segundos;
}

function ehAdmin(env, discordId) {
  return String(env.ADMIN_DISCORD_ID || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).indexOf(discordId) !== -1;
}

async function lerJson(request) {
  try {
    const corpo = await request.json();
    return corpo && typeof corpo === 'object' ? corpo : null;
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------------------
   Sessão
   ------------------------------------------------------------------------ */

async function usuarioDaSessao(request, env) {
  const token = lerCookies(request)[COOKIE_SESSAO];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const linha = await env.DB.prepare(
    'SELECT u.discord_id, u.nome, u.avatar FROM sessoes s JOIN usuarios u ON u.discord_id = s.discord_id WHERE s.token_hash = ? AND s.expira_em > ?'
  ).bind(await sha256(token), agora(env)).first();
  return linha || null;
}

async function abrirSessao(env, discordId) {
  const token = aleatorioHex(32);
  const t = agora(env);
  await env.DB.prepare('INSERT INTO sessoes (token_hash, discord_id, criado_em, expira_em) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), discordId, t, t + SESSAO_DIAS * DIA).run();
  return token;
}

async function acessosAtivos(env, discordId) {
  const { results } = await env.DB.prepare('SELECT escopo, expira_em FROM acessos WHERE discord_id = ? AND expira_em > ? ORDER BY escopo')
    .bind(discordId, agora(env)).all();
  return results || [];
}

/* ------------------------------------------------------------------------
   Login com o Discord
   ------------------------------------------------------------------------ */

function urlDeRetorno(request) {
  return new URL(request.url).origin + '/api/auth/discord/retorno';
}

function iniciarLogin(request, env) {
  if (!env.DISCORD_CLIENT_ID) return erro(503, 'O login ainda não foi configurado.');
  const estado = aleatorioHex(16);
  const destino = new URL('https://discord.com/oauth2/authorize');
  destino.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  destino.searchParams.set('redirect_uri', urlDeRetorno(request));
  destino.searchParams.set('response_type', 'code');
  destino.searchParams.set('scope', 'identify');
  destino.searchParams.set('state', estado);
  destino.searchParams.set('prompt', 'none');
  return new Response(null, {
    status: 302,
    headers: { location: destino.toString(), 'set-cookie': cookie(COOKIE_ESTADO, estado, 600), 'cache-control': 'no-store' }
  });
}

async function concluirLogin(request, env) {
  const url = new URL(request.url);
  const estado = url.searchParams.get('state');
  const codigo = url.searchParams.get('code');
  if (!estado || !codigo || lerCookies(request)[COOKIE_ESTADO] !== estado) return erro(400, 'Pedido de login inválido ou expirado. Tente entrar de novo.');
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return erro(503, 'O login ainda não foi configurado.');

  const troca = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: urlDeRetorno(request)
    })
  });
  if (!troca.ok) return erro(502, 'O Discord recusou o login. Tente de novo.');
  const { access_token: acesso } = await troca.json();
  const perfilResposta = await fetch('https://discord.com/api/users/@me', { headers: { authorization: 'Bearer ' + acesso } });
  if (!perfilResposta.ok) return erro(502, 'Não foi possível ler o perfil do Discord.');
  const perfil = await perfilResposta.json();
  if (!perfil || !/^[0-9]{5,25}$/.test(String(perfil.id))) return erro(502, 'Resposta inesperada do Discord.');

  const t = agora(env);
  const nome = String(perfil.global_name || perfil.username || 'Jogador').slice(0, 80);
  await env.DB.prepare(
    'INSERT INTO usuarios (discord_id, nome, avatar, criado_em, ultimo_acesso) VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT(discord_id) DO UPDATE SET nome = excluded.nome, avatar = excluded.avatar, ultimo_acesso = excluded.ultimo_acesso'
  ).bind(String(perfil.id), nome, perfil.avatar ? String(perfil.avatar).slice(0, 80) : null, t, t).run();
  // Limpeza barata: sessões vencidas e tentativas antigas
  await env.DB.prepare('DELETE FROM sessoes WHERE expira_em < ?').bind(t).run();
  await env.DB.prepare('DELETE FROM tentativas WHERE criado_em < ?').bind(t - DIA).run();

  const token = await abrirSessao(env, String(perfil.id));
  const cabecalhos = new Headers({ location: '/?conta=ok', 'cache-control': 'no-store' });
  cabecalhos.append('set-cookie', cookie(COOKIE_SESSAO, token, SESSAO_DIAS * DIA));
  cabecalhos.append('set-cookie', cookie(COOKIE_ESTADO, '', 0));
  return new Response(null, { status: 302, headers: cabecalhos });
}

async function sair(request, env) {
  const token = lerCookies(request)[COOKIE_SESSAO];
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await env.DB.prepare('DELETE FROM sessoes WHERE token_hash = ?').bind(await sha256(token)).run();
  }
  return resposta({ ok: true }, 200, { 'set-cookie': cookie(COOKIE_SESSAO, '', 0) });
}

async function quemSou(request, env) {
  const usuario = await usuarioDaSessao(request, env);
  if (!usuario) return resposta({ configurado: !!env.DISCORD_CLIENT_ID, conectado: false });
  return resposta({
    configurado: true,
    conectado: true,
    usuario: { id: usuario.discord_id, nome: usuario.nome, avatar: usuario.avatar },
    admin: ehAdmin(env, usuario.discord_id),
    acessos: await acessosAtivos(env, usuario.discord_id)
  });
}

/* ------------------------------------------------------------------------
   Códigos de acesso
   ------------------------------------------------------------------------ */

async function resgatar(request, env, usuario) {
  const corpo = await lerJson(request);
  const normalizado = normalizarCodigo(corpo && corpo.codigo);
  if (normalizado.length !== 12) return erro(400, 'Digite o código completo (12 letras e números).');
  if (!env.SEGREDO) return erro(503, 'O servidor ainda não foi configurado.');

  const t = agora(env);
  const recentes = await env.DB.prepare('SELECT COUNT(*) AS n FROM tentativas WHERE discord_id = ? AND criado_em > ?')
    .bind(usuario.discord_id, t - 3600).first();
  if (recentes && recentes.n >= TENTATIVAS_POR_HORA) return erro(429, 'Muitas tentativas. Espere um pouco e tente de novo.');
  await env.DB.prepare('INSERT INTO tentativas (discord_id, criado_em) VALUES (?, ?)').bind(usuario.discord_id, t).run();

  const hash = await hmac(env.SEGREDO, normalizado);
  const linha = await env.DB.prepare('SELECT id, escopos, dias, para_discord_id, expira_em, usado_em, revogado FROM codigos WHERE hash = ?').bind(hash).first();
  // Mesma mensagem para código inexistente, usado, vencido ou de outra pessoa: não dá pista a quem chuta
  const invalido = erro(400, 'Código inválido, já usado ou vencido.');
  if (!linha || linha.revogado || linha.usado_em || linha.expira_em <= t) return invalido;
  if (linha.para_discord_id && linha.para_discord_id !== usuario.discord_id) return invalido;

  const reivindicado = await env.DB.prepare('UPDATE codigos SET usado_por = ?, usado_em = ? WHERE id = ? AND usado_em IS NULL AND revogado = 0')
    .bind(usuario.discord_id, t, linha.id).run();
  if (!reivindicado.meta || reivindicado.meta.changes !== 1) return invalido;

  const escopos = JSON.parse(linha.escopos);
  for (const escopo of escopos) {
    const atual = await env.DB.prepare('SELECT expira_em FROM acessos WHERE discord_id = ? AND escopo = ?').bind(usuario.discord_id, escopo).first();
    const base = atual && atual.expira_em > t ? atual.expira_em : t; // renovar soma aos dias que sobram
    await env.DB.prepare(
      'INSERT INTO acessos (discord_id, escopo, expira_em, origem_codigo) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(discord_id, escopo) DO UPDATE SET expira_em = excluded.expira_em, origem_codigo = excluded.origem_codigo'
    ).bind(usuario.discord_id, escopo, base + linha.dias * DIA, linha.id).run();
  }
  return resposta({ ok: true, acessos: await acessosAtivos(env, usuario.discord_id) });
}

/* ------------------------------------------------------------------------
   Conteúdo protegido
   ------------------------------------------------------------------------ */

async function lerConteudo(env, usuario, escopo) {
  if (!ESCOPO_VALIDO.test(escopo)) return erro(400, 'Conteúdo inexistente.');
  let expira = null;
  if (ehAdmin(env, usuario.discord_id)) {
    expira = agora(env) + DIA; // o admin sempre lê (para conferir o que publicou)
  } else {
    const acesso = await env.DB.prepare('SELECT expira_em FROM acessos WHERE discord_id = ? AND escopo = ? AND expira_em > ?')
      .bind(usuario.discord_id, escopo, agora(env)).first();
    if (!acesso) return erro(403, 'Você não tem acesso a este conteúdo. Resgate um código válido.');
    expira = acesso.expira_em;
  }
  const { results } = await env.DB.prepare('SELECT chave, titulo, texto, ordem FROM conteudo WHERE escopo = ? ORDER BY ordem, chave').bind(escopo).all();
  return resposta({ escopo: escopo, expira_em: expira, itens: results || [] });
}

/* ------------------------------------------------------------------------
   Admin
   ------------------------------------------------------------------------ */

function inteiroEntre(valor, minimo, maximo, padrao) {
  const n = Number(valor);
  if (valor === undefined || valor === null || valor === '') return padrao;
  return Number.isInteger(n) && n >= minimo && n <= maximo ? n : NaN;
}

async function criarCodigo(request, env, usuario) {
  if (!env.SEGREDO) return erro(503, 'O servidor ainda não foi configurado.');
  const corpo = await lerJson(request);
  if (!corpo) return erro(400, 'Pedido inválido.');
  const escopos = Array.isArray(corpo.escopos) ? Array.from(new Set(corpo.escopos.map(String))) : [];
  if (!escopos.length || escopos.length > 20 || !escopos.every(function (e) { return ESCOPO_VALIDO.test(e); })) return erro(400, 'Informe de 1 a 20 conteúdos (letras minúsculas, números e hífen).');
  const dias = inteiroEntre(corpo.dias, 1, 365, 30);
  const horas = inteiroEntre(corpo.validadeHoras, 1, 168, 24);
  if (Number.isNaN(dias) || Number.isNaN(horas)) return erro(400, 'Dias (1 a 365) e validade do código (1 a 168 horas) precisam ser números inteiros.');
  const rotulo = String(corpo.rotulo || '').trim().slice(0, 80);
  if (!rotulo) return erro(400, 'Dê um nome para o código (para quem ele é).');
  const para = corpo.paraDiscordId ? String(corpo.paraDiscordId).trim() : null;
  if (para && !/^[0-9]{5,25}$/.test(para)) return erro(400, 'O ID do Discord deve ter só números.');

  const codigo = gerarCodigo();
  const t = agora(env);
  const resultado = await env.DB.prepare(
    'INSERT INTO codigos (hash, rotulo, escopos, dias, para_discord_id, criado_em, expira_em) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(await hmac(env.SEGREDO, normalizarCodigo(codigo)), rotulo, JSON.stringify(escopos), dias, para, t, t + horas * 3600).run();
  // O código em texto só aparece agora: no banco fica apenas o hash
  return resposta({ ok: true, id: resultado.meta.last_row_id, codigo: codigo, expira_em: t + horas * 3600, dias: dias, escopos: escopos });
}

async function listarCodigos(env) {
  const { results } = await env.DB.prepare(
    'SELECT c.id, c.rotulo, c.escopos, c.dias, c.para_discord_id, c.criado_em, c.expira_em, c.usado_em, c.revogado, u.nome AS usado_por_nome ' +
    'FROM codigos c LEFT JOIN usuarios u ON u.discord_id = c.usado_por ORDER BY c.id DESC LIMIT 100'
  ).all();
  return resposta({ codigos: (results || []).map(function (c) { return Object.assign({}, c, { escopos: JSON.parse(c.escopos) }); }) });
}

async function revogarCodigo(env, id) {
  const r = await env.DB.prepare('UPDATE codigos SET revogado = 1 WHERE id = ?').bind(id).run();
  return r.meta && r.meta.changes ? resposta({ ok: true }) : erro(404, 'Código não encontrado.');
}

async function listarAcessos(env) {
  const { results } = await env.DB.prepare(
    'SELECT a.discord_id, u.nome, a.escopo, a.expira_em FROM acessos a LEFT JOIN usuarios u ON u.discord_id = a.discord_id WHERE a.expira_em > ? ORDER BY u.nome, a.escopo'
  ).bind(agora(env)).all();
  return resposta({ acessos: results || [] });
}

async function revogarAcesso(request, env) {
  const corpo = await lerJson(request);
  if (!corpo || !/^[0-9]{5,25}$/.test(String(corpo.discordId)) || !ESCOPO_VALIDO.test(String(corpo.escopo))) return erro(400, 'Pedido inválido.');
  await env.DB.prepare('DELETE FROM acessos WHERE discord_id = ? AND escopo = ?').bind(String(corpo.discordId), String(corpo.escopo)).run();
  return resposta({ ok: true });
}

async function listarEscoposDeConteudo(env) {
  const { results } = await env.DB.prepare('SELECT escopo, COUNT(*) AS itens, MAX(atualizado_em) AS atualizado_em FROM conteudo GROUP BY escopo ORDER BY escopo').all();
  return resposta({ escopos: results || [] });
}

async function publicarConteudo(request, env, escopo) {
  if (!ESCOPO_VALIDO.test(escopo)) return erro(400, 'Nome de conteúdo inválido (use minúsculas, números e hífen).');
  const corpo = await lerJson(request);
  const itens = corpo && Array.isArray(corpo.itens) ? corpo.itens : null;
  if (!itens || itens.length > LIMITE_ITENS) return erro(400, 'Envie { "itens": [...] } com até ' + LIMITE_ITENS + ' itens.');
  const chaves = new Set();
  const limpos = [];
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i] || {};
    const chave = String(it.chave || '');
    const titulo = String(it.titulo || '').slice(0, 200);
    const texto = String(it.texto || '');
    if (!CHAVE_VALIDA.test(chave) || chaves.has(chave) || !titulo || !texto || texto.length > LIMITE_TEXTO) {
      return erro(400, 'Item ' + (i + 1) + ' inválido: chave única (letras, números, ponto, hífen), título e texto (até ' + LIMITE_TEXTO + ' caracteres).');
    }
    chaves.add(chave);
    limpos.push({ chave: chave, titulo: titulo, texto: texto, ordem: Number.isInteger(it.ordem) ? it.ordem : i });
  }
  const t = agora(env);
  const comandos = [env.DB.prepare('DELETE FROM conteudo WHERE escopo = ?').bind(escopo)];
  limpos.forEach(function (it) {
    comandos.push(env.DB.prepare('INSERT INTO conteudo (escopo, chave, titulo, texto, ordem, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(escopo, it.chave, it.titulo, it.texto, it.ordem, t));
  });
  await env.DB.batch(comandos);
  return resposta({ ok: true, itens: limpos.length });
}

async function apagarConteudo(env, escopo) {
  if (!ESCOPO_VALIDO.test(escopo)) return erro(400, 'Nome de conteúdo inválido.');
  const existente = await env.DB.prepare('SELECT COUNT(*) AS n FROM conteudo WHERE escopo = ?').bind(escopo).first();
  await env.DB.prepare('DELETE FROM conteudo WHERE escopo = ?').bind(escopo).run();
  return resposta({ ok: true, apagados: existente ? existente.n : 0 });
}

/* ------------------------------------------------------------------------
   Roteador
   ------------------------------------------------------------------------ */

async function tratar(request, env) {
  const url = new URL(request.url);
  const metodo = request.method;
  const caminho = url.pathname.replace(/\/+$/, '') || '/';

  if (!caminho.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : erro(404, 'Não encontrado.');
  if (!env.DB) return erro(503, 'O banco de dados ainda não foi ligado.');

  // Pedidos que mudam algo só valem se vierem do próprio site (contra CSRF)
  if (metodo !== 'GET' && metodo !== 'HEAD' && request.headers.get('origin') !== url.origin) return erro(403, 'Origem não permitida.');

  if (metodo === 'GET' && caminho === '/api/auth/discord') return iniciarLogin(request, env);
  if (metodo === 'GET' && caminho === '/api/auth/discord/retorno') return concluirLogin(request, env);
  if (metodo === 'GET' && caminho === '/api/eu') return quemSou(request, env);

  const usuario = await usuarioDaSessao(request, env);
  if (!usuario) return erro(401, 'Entre com o Discord para continuar.');

  if (metodo === 'POST' && caminho === '/api/sair') return sair(request, env);
  if (metodo === 'POST' && caminho === '/api/resgatar') return resgatar(request, env, usuario);

  let achado = caminho.match(/^\/api\/conteudo\/([^/]+)$/);
  if (metodo === 'GET' && achado) return lerConteudo(env, usuario, achado[1]);

  if (caminho.startsWith('/api/admin/')) {
    if (!ehAdmin(env, usuario.discord_id)) return erro(403, 'Só o administrador pode fazer isso.');
    if (metodo === 'GET' && caminho === '/api/admin/codigos') return listarCodigos(env);
    if (metodo === 'POST' && caminho === '/api/admin/codigos') return criarCodigo(request, env, usuario);
    achado = caminho.match(/^\/api\/admin\/codigos\/(\d+)\/revogar$/);
    if (metodo === 'POST' && achado) return revogarCodigo(env, Number(achado[1]));
    if (metodo === 'GET' && caminho === '/api/admin/acessos') return listarAcessos(env);
    if (metodo === 'POST' && caminho === '/api/admin/acessos/revogar') return revogarAcesso(request, env);
    if (metodo === 'GET' && caminho === '/api/admin/conteudo') return listarEscoposDeConteudo(env);
    achado = caminho.match(/^\/api\/admin\/conteudo\/([^/]+)$/);
    if (metodo === 'PUT' && achado) return publicarConteudo(request, env, achado[1]);
    if (metodo === 'DELETE' && achado) return apagarConteudo(env, achado[1]);
  }
  return erro(404, 'Não encontrado.');
}

export default {
  async fetch(request, env) {
    try {
      return await tratar(request, env);
    } catch (e) {
      console.error('Erro no Worker:', e && e.message);
      return erro(500, 'Erro interno. Tente de novo.');
    }
  }
};

export { gerarCodigo, normalizarCodigo, ehAdmin };
