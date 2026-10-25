// Rode com: node --test worker/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import trabalhador from '../index.js';
import { gerarCodigo, normalizarCodigo } from '../index.js';
import { criarBanco } from './d1-sqlite.mjs';

const ORIGEM = 'https://fichas.exemplo.workers.dev';
const ADMIN = '111111111111';
const JOGADOR = '222222222222';
const OUTRO = '333333333333';

function ambiente(extras) {
  const banco = criarBanco();
  const env = Object.assign({
    DB: banco, SEGREDO: 'segredo-de-teste', DISCORD_CLIENT_ID: 'cliente', DISCORD_CLIENT_SECRET: 'cliente-segredo',
    ADMIN_DISCORD_ID: ADMIN, relogio: () => 1000000
  }, extras);
  env.agora = (s) => { env.relogio = () => s; };
  return env;
}

async function chamar(env, metodo, caminho, opcoes) {
  const o = opcoes || {};
  const cabecalhos = new Headers(o.cabecalhos || {});
  if (o.cookie) cabecalhos.set('cookie', o.cookie);
  if (metodo !== 'GET') cabecalhos.set('origin', o.origem === undefined ? ORIGEM : o.origem);
  const corpo = o.json ? JSON.stringify(o.json) : undefined;
  if (corpo) cabecalhos.set('content-type', 'application/json');
  return trabalhador.fetch(new Request(ORIGEM + caminho, { method: metodo, headers: cabecalhos, body: corpo, redirect: 'manual' }), env);
}

async function entrar(env, discordId, nome) {
  const t = env.relogio();
  await env.DB.prepare('INSERT OR REPLACE INTO usuarios (discord_id, nome, avatar, criado_em, ultimo_acesso) VALUES (?, ?, NULL, ?, ?)').bind(discordId, nome, t, t).run();
  // abre a sessão pelo caminho real do OAuth, com o Discord simulado
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 'x' }), { status: 200 });
    return new Response(JSON.stringify({ id: discordId, username: nome, global_name: nome, avatar: null }), { status: 200 });
  };
  try {
    const r = await chamar(env, 'GET', '/api/auth/discord/retorno?code=abc&state=EST', { cookie: '__Host-estado=EST' });
    assert.equal(r.status, 302);
    const sessao = r.headers.getSetCookie().find((c) => c.startsWith('__Host-sessao=') && !c.includes('Max-Age=0'));
    return sessao.split(';')[0];
  } finally {
    globalThis.fetch = original;
  }
}

test('código: formato, alfabeto sem ambíguos e normalização', () => {
  const c = gerarCodigo();
  assert.match(c, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  assert.equal(normalizarCodigo(' ab12-cd34 ef56 '), 'AB12CD34EF56');
  const varios = new Set(Array.from({ length: 200 }, gerarCodigo));
  assert.equal(varios.size, 200);
});

test('rotas de /api exigem login e a origem do próprio site para mudar algo', async () => {
  const env = ambiente();
  assert.equal((await chamar(env, 'GET', '/api/conteudo/habilidades')).status, 401);
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { json: { codigo: 'x' }, origem: 'https://mal.exemplo' })).status, 403);
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { json: { codigo: 'x' }, origem: null })).status, 403);
  const eu = await (await chamar(env, 'GET', '/api/eu')).json();
  assert.deepEqual(eu, { configurado: true, conectado: false });
});

test('login: o estado do cookie precisa bater e a sessão guarda só o hash', async () => {
  const env = ambiente();
  const ruim = await chamar(env, 'GET', '/api/auth/discord/retorno?code=abc&state=OUTRO', { cookie: '__Host-estado=EST' });
  assert.equal(ruim.status, 400);
  const inicio = await chamar(env, 'GET', '/api/auth/discord');
  assert.equal(inicio.status, 302);
  const destino = new URL(inicio.headers.get('location'));
  assert.equal(destino.searchParams.get('redirect_uri'), ORIGEM + '/api/auth/discord/retorno');
  assert.equal(destino.searchParams.get('scope'), 'identify');
  assert.match(inicio.headers.get('set-cookie'), /^__Host-estado=[0-9a-f]{32}; .*HttpOnly; Secure; SameSite=Lax/);

  const cookie = await entrar(env, JOGADOR, 'Marina');
  const token = cookie.split('=')[1];
  const linha = env.DB.bruto.prepare('SELECT token_hash FROM sessoes').get();
  assert.notEqual(linha.token_hash, token);
  assert.equal(linha.token_hash.length, 64);
  const eu = await (await chamar(env, 'GET', '/api/eu', { cookie })).json();
  assert.equal(eu.conectado, true);
  assert.equal(eu.usuario.nome, 'Marina');
  assert.equal(eu.admin, false);
});

test('sair apaga a sessão; sessão vencida não vale', async () => {
  const env = ambiente();
  const cookie = await entrar(env, JOGADOR, 'Marina');
  env.agora(1000000 + 15 * 86400);
  assert.equal((await chamar(env, 'GET', '/api/conteudo/habilidades', { cookie })).status, 401);
  env.agora(1000000);
  assert.equal((await chamar(env, 'GET', '/api/eu', { cookie })).status, 200);
  assert.equal((await chamar(env, 'POST', '/api/sair', { cookie })).status, 200);
  assert.equal((await chamar(env, 'GET', '/api/conteudo/habilidades', { cookie })).status, 401);
});

test('admin: só o admin cria códigos, publica conteúdo e vê listas', async () => {
  const env = ambiente();
  const jogador = await entrar(env, JOGADOR, 'Marina');
  assert.equal((await chamar(env, 'POST', '/api/admin/codigos', { cookie: jogador, json: { rotulo: 'x', escopos: ['habilidades'] } })).status, 403);
  assert.equal((await chamar(env, 'GET', '/api/admin/codigos', { cookie: jogador })).status, 403);
  assert.equal((await chamar(env, 'PUT', '/api/admin/conteudo/habilidades', { cookie: jogador, json: { itens: [] } })).status, 403);
  const admin = await entrar(env, ADMIN, 'Dono');
  assert.equal((await chamar(env, 'GET', '/api/admin/codigos', { cookie: admin })).status, 200);
  const ruim = await chamar(env, 'POST', '/api/admin/codigos', { cookie: admin, json: { rotulo: 'x', escopos: ['Habilidades!'] } });
  assert.equal(ruim.status, 400);
  const semRotulo = await chamar(env, 'POST', '/api/admin/codigos', { cookie: admin, json: { rotulo: ' ', escopos: ['habilidades'] } });
  assert.equal(semRotulo.status, 400);
  const diasRuins = await chamar(env, 'POST', '/api/admin/codigos', { cookie: admin, json: { rotulo: 'x', escopos: ['habilidades'], dias: 9999 } });
  assert.equal(diasRuins.status, 400);
});

async function publicar(env, admin, escopo, itens) {
  const r = await chamar(env, 'PUT', '/api/admin/conteudo/' + escopo, { cookie: admin, json: { itens } });
  assert.equal(r.status, 200);
}

test('fluxo completo: código de uso único libera o conteúdo por X dias e depois vence', async () => {
  const env = ambiente();
  const admin = await entrar(env, ADMIN, 'Dono');
  const jogador = await entrar(env, JOGADOR, 'Marina');
  await publicar(env, admin, 'habilidades', [{ chave: 'a1', titulo: 'Texto A', texto: 'Conteúdo integral A' }, { chave: 'a2', titulo: 'Texto B', texto: 'Conteúdo B', ordem: -1 }]);

  assert.equal((await chamar(env, 'GET', '/api/conteudo/habilidades', { cookie: jogador })).status, 403);

  const criado = await (await chamar(env, 'POST', '/api/admin/codigos', { cookie: admin, json: { rotulo: 'Marina', escopos: ['habilidades'], dias: 10, validadeHoras: 24 } })).json();
  assert.match(criado.codigo, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  // no banco só existe o hash, nunca o código
  const gravado = JSON.stringify(env.DB.bruto.prepare('SELECT * FROM codigos').all());
  assert.ok(!gravado.includes(normalizarCodigo(criado.codigo)));

  const resgate = await chamar(env, 'POST', '/api/resgatar', { cookie: jogador, json: { codigo: criado.codigo.toLowerCase().replace(/-/g, ' ') } });
  assert.equal(resgate.status, 200);
  const lido = await (await chamar(env, 'GET', '/api/conteudo/habilidades', { cookie: jogador })).json();
  assert.deepEqual(lido.itens.map((i) => i.chave), ['a2', 'a1']); // respeita a ordem
  assert.equal(lido.expira_em, 1000000 + 10 * 86400);

  // uso único: o mesmo código não serve de novo, nem para outra pessoa
  const outro = await entrar(env, OUTRO, 'Rafa');
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { cookie: jogador, json: { codigo: criado.codigo } })).status, 400);
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { cookie: outro, json: { codigo: criado.codigo } })).status, 400);
  assert.equal((await chamar(env, 'GET', '/api/conteudo/habilidades', { cookie: outro })).status, 403);

  // vence depois de X dias
  env.agora(1000000 + 10 * 86400 + 1);
  const jogador2 = await entrar(env, JOGADOR, 'Marina');
  assert.equal((await chamar(env, 'GET', '/api/conteudo/habilidades', { cookie: jogador2 })).status, 403);
});

test('renovar soma aos dias que sobram; código vencido, revogado ou de outra pessoa não vale', async () => {
  const env = ambiente();
  const admin = await entrar(env, ADMIN, 'Dono');
  const jogador = await entrar(env, JOGADOR, 'Marina');
  const novo = async (json) => (await (await chamar(env, 'POST', '/api/admin/codigos', { cookie: admin, json })).json());

  const c1 = await novo({ rotulo: 'm', escopos: ['habilidades'], dias: 10 });
  await chamar(env, 'POST', '/api/resgatar', { cookie: jogador, json: { codigo: c1.codigo } });
  const c2 = await novo({ rotulo: 'm2', escopos: ['habilidades'], dias: 5 });
  const r2 = await (await chamar(env, 'POST', '/api/resgatar', { cookie: jogador, json: { codigo: c2.codigo } })).json();
  assert.equal(r2.acessos[0].expira_em, 1000000 + 15 * 86400);

  const c3 = await novo({ rotulo: 'revogado', escopos: ['habilidades'], validadeHoras: 24 });
  await chamar(env, 'POST', '/api/admin/codigos/' + c3.id + '/revogar', { cookie: admin });
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { cookie: jogador, json: { codigo: c3.codigo } })).status, 400);

  const c4 = await novo({ rotulo: 'vence', escopos: ['habilidades'], validadeHoras: 1 });
  env.agora(1000000 + 3601);
  const jog = await entrar(env, JOGADOR, 'Marina');
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { cookie: jog, json: { codigo: c4.codigo } })).status, 400);

  env.agora(1000000);
  const c5 = await novo({ rotulo: 'só do Rafa', escopos: ['habilidades'], paraDiscordId: OUTRO });
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { cookie: jogador, json: { codigo: c5.codigo } })).status, 400);
  const rafa = await entrar(env, OUTRO, 'Rafa');
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { cookie: rafa, json: { codigo: c5.codigo } })).status, 200);
});

test('revogar o acesso tira o conteúdo na hora; o admin sempre lê', async () => {
  const env = ambiente();
  const admin = await entrar(env, ADMIN, 'Dono');
  const jogador = await entrar(env, JOGADOR, 'Marina');
  await publicar(env, admin, 'habilidades', [{ chave: 'a1', titulo: 'A', texto: 'texto' }]);
  const c = await (await chamar(env, 'POST', '/api/admin/codigos', { cookie: admin, json: { rotulo: 'm', escopos: ['habilidades'] } })).json();
  await chamar(env, 'POST', '/api/resgatar', { cookie: jogador, json: { codigo: c.codigo } });
  assert.equal((await chamar(env, 'GET', '/api/conteudo/habilidades', { cookie: jogador })).status, 200);
  const lista = await (await chamar(env, 'GET', '/api/admin/acessos', { cookie: admin })).json();
  assert.equal(lista.acessos.length, 1);
  await chamar(env, 'POST', '/api/admin/acessos/revogar', { cookie: admin, json: { discordId: JOGADOR, escopo: 'habilidades' } });
  assert.equal((await chamar(env, 'GET', '/api/conteudo/habilidades', { cookie: jogador })).status, 403);
  assert.equal((await chamar(env, 'GET', '/api/conteudo/habilidades', { cookie: admin })).status, 200);
});

test('limite de tentativas de resgate por hora', async () => {
  const env = ambiente();
  const jogador = await entrar(env, JOGADOR, 'Marina');
  for (let i = 0; i < 8; i++) {
    assert.equal((await chamar(env, 'POST', '/api/resgatar', { cookie: jogador, json: { codigo: 'AAAA-AAAA-AAAA' } })).status, 400);
  }
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { cookie: jogador, json: { codigo: 'AAAA-AAAA-AAAA' } })).status, 429);
  env.agora(1000000 + 3601);
  const jogador2 = await entrar(env, JOGADOR, 'Marina');
  assert.equal((await chamar(env, 'POST', '/api/resgatar', { cookie: jogador2, json: { codigo: 'AAAA-AAAA-AAAA' } })).status, 400);
});

test('publicar conteúdo valida itens e escopo', async () => {
  const env = ambiente();
  const admin = await entrar(env, ADMIN, 'Dono');
  const p = (escopo, itens) => chamar(env, 'PUT', '/api/admin/conteudo/' + escopo, { cookie: admin, json: { itens } });
  assert.equal((await p('Maiúsculo', [])).status, 400);
  assert.equal((await p('ok', [{ chave: 'a', titulo: 'T', texto: 'x' }, { chave: 'a', titulo: 'T', texto: 'y' }])).status, 400);
  assert.equal((await p('ok', [{ chave: 'a b', titulo: 'T', texto: 'x' }])).status, 400);
  assert.equal((await p('ok', [{ chave: 'a', titulo: 'T', texto: 'x'.repeat(100001) }])).status, 400);
  assert.equal((await p('ok', [{ chave: 'a', titulo: 'T', texto: 'x' }])).status, 200);
  assert.equal((await p('ok', [{ chave: 'b', titulo: 'T2', texto: 'y' }])).status, 200); // substitui o anterior
  const lido = await (await chamar(env, 'GET', '/api/conteudo/ok', { cookie: admin })).json();
  assert.deepEqual(lido.itens.map((i) => i.chave), ['b']);
});

test('apagar conteúdo: só o administrador, só aquele nome, e o acesso concedido continua', async () => {
  const env = ambiente();
  const admin = await entrar(env, ADMIN, 'Dono');
  const jogador = await entrar(env, JOGADOR, 'Rita');
  const p = (escopo, chave) => chamar(env, 'PUT', '/api/admin/conteudo/' + escopo, { cookie: admin, json: { itens: [{ chave, titulo: 'T', texto: 'x' }] } });
  await p('um', 'a');
  await p('dois', 'b');
  assert.equal((await chamar(env, 'DELETE', '/api/admin/conteudo/um', { cookie: jogador })).status, 403);
  assert.equal((await chamar(env, 'DELETE', '/api/admin/conteudo/Maiúsculo', { cookie: admin })).status, 400);
  const r = await chamar(env, 'DELETE', '/api/admin/conteudo/um', { cookie: admin });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).apagados, 1);
  const lista = await (await chamar(env, 'GET', '/api/admin/conteudo', { cookie: admin })).json();
  assert.deepEqual(lista.escopos.map((e) => e.escopo), ['dois']);
  assert.equal((await (await chamar(env, 'GET', '/api/conteudo/um', { cookie: admin })).json()).itens.length, 0);
});

test('sem configuração, a API avisa em vez de quebrar; fora de /api vão os arquivos estáticos', async () => {
  const semId = ambiente({ DISCORD_CLIENT_ID: '' });
  assert.equal((await chamar(semId, 'GET', '/api/auth/discord')).status, 503);
  assert.deepEqual(await (await chamar(semId, 'GET', '/api/eu')).json(), { configurado: false, conectado: false });
  const semBanco = ambiente({ DB: undefined });
  assert.equal((await chamar(semBanco, 'GET', '/api/eu')).status, 503);
  const estaticos = ambiente({ ASSETS: { fetch: async () => new Response('pagina') } });
  assert.equal(await (await chamar(estaticos, 'GET', '/index.html')).text(), 'pagina');
});

/* ---------- Fichas na nuvem e link de compartilhamento ---------- */

const FICHA = { identificacao: { nome: 'Marina Lopes', classe: 'ocultista', nex: 35 }, recursos: { pv: { atual: 10 } } };

test('nuvem: salvar, listar, ler e apagar a própria ficha (com controle de versão)', async () => {
  const env = ambiente();
  const jogador = await entrar(env, JOGADOR, 'Marina');
  assert.equal((await chamar(env, 'GET', '/api/fichas')).status, 401);
  const eu = await (await chamar(env, 'GET', '/api/eu', { cookie: jogador })).json();
  assert.equal(eu.nuvem, true);

  const nova = await chamar(env, 'PUT', '/api/fichas/ficha-1', { cookie: jogador, json: { dados: FICHA, baseRev: 0 } });
  assert.equal(nova.status, 200);
  assert.equal((await nova.json()).rev, 1);
  const lista = await (await chamar(env, 'GET', '/api/fichas', { cookie: jogador })).json();
  assert.deepEqual(lista.fichas.map((f) => [f.id, f.nome, f.classe, f.nex, f.rev, f.link]), [['ficha-1', 'Marina Lopes', 'ocultista', 35, 1, null]]);
  assert.equal(lista.limite, 50);

  const lida = await (await chamar(env, 'GET', '/api/fichas/ficha-1', { cookie: jogador })).json();
  assert.deepEqual(lida.dados, FICHA);

  const v2 = await chamar(env, 'PUT', '/api/fichas/ficha-1', { cookie: jogador, json: { dados: Object.assign({}, FICHA, { identificacao: { nome: 'Marina 2', classe: 'ocultista', nex: 40 } }), baseRev: 1 } });
  assert.equal((await v2.json()).rev, 2);

  // versão velha: 409 com a versão atual, sem gravar
  const velha = await chamar(env, 'PUT', '/api/fichas/ficha-1', { cookie: jogador, json: { dados: FICHA, baseRev: 1 } });
  assert.equal(velha.status, 409);
  const corpoVelha = await velha.json();
  assert.equal(corpoVelha.conflito, true);
  assert.equal(corpoVelha.rev, 2);
  assert.equal((await (await chamar(env, 'GET', '/api/fichas', { cookie: jogador })).json()).fichas[0].nome, 'Marina 2');
  // ficha nova com baseRev diferente de 0 num id que não existe: avisa que foi apagada
  const fantasma = await chamar(env, 'PUT', '/api/fichas/outra', { cookie: jogador, json: { dados: FICHA, baseRev: 3 } });
  assert.equal(fantasma.status, 409);
  assert.equal((await fantasma.json()).apagada, true);

  assert.equal((await chamar(env, 'DELETE', '/api/fichas/ficha-1', { cookie: jogador })).status, 200);
  assert.equal((await chamar(env, 'GET', '/api/fichas/ficha-1', { cookie: jogador })).status, 404);
});

test('nuvem: cada conta só vê e mexe nas próprias fichas; confere id, formato, tamanho e limite', async () => {
  const env = ambiente();
  const marina = await entrar(env, JOGADOR, 'Marina');
  const outro = await entrar(env, OUTRO, 'Outro');
  await chamar(env, 'PUT', '/api/fichas/f1', { cookie: marina, json: { dados: FICHA, baseRev: 0 } });
  assert.equal((await chamar(env, 'GET', '/api/fichas/f1', { cookie: outro })).status, 404);
  assert.deepEqual((await (await chamar(env, 'GET', '/api/fichas', { cookie: outro })).json()).fichas, []);
  // o mesmo id em outra conta é outra ficha
  assert.equal((await chamar(env, 'PUT', '/api/fichas/f1', { cookie: outro, json: { dados: FICHA, baseRev: 0 } })).status, 200);
  await chamar(env, 'DELETE', '/api/fichas/f1', { cookie: outro });
  assert.equal((await chamar(env, 'GET', '/api/fichas/f1', { cookie: marina })).status, 200);

  assert.equal((await chamar(env, 'PUT', '/api/fichas/' + 'x'.repeat(65), { cookie: marina, json: { dados: FICHA } })).status, 400);
  assert.equal((await chamar(env, 'PUT', '/api/fichas/ok', { cookie: marina, json: { dados: [1] } })).status, 400);
  assert.equal((await chamar(env, 'PUT', '/api/fichas/ok', { cookie: marina, json: { dados: FICHA, baseRev: -1 } })).status, 400);
  assert.equal((await chamar(env, 'PUT', '/api/fichas/ok', { cookie: marina, json: { dados: { lixo: 'x'.repeat(1600000) } } })).status, 413);
  assert.equal((await chamar(env, 'PUT', '/api/fichas/ok', { cookie: marina, origem: 'https://mal.exemplo', json: { dados: FICHA } })).status, 403);

  for (let i = 0; i < 49; i++) assert.equal((await chamar(env, 'PUT', '/api/fichas/lote' + i, { cookie: marina, json: { dados: FICHA, baseRev: 0 } })).status, 200);
  const cheio = await chamar(env, 'PUT', '/api/fichas/passou', { cookie: marina, json: { dados: FICHA, baseRev: 0 } });
  assert.equal(cheio.status, 403);
  // atualizar uma que já existe continua valendo com a conta cheia
  assert.equal((await chamar(env, 'PUT', '/api/fichas/f1', { cookie: marina, json: { dados: FICHA, baseRev: 1 } })).status, 200);
});

test('link: só ver (sem login), trocar o modo, gerar link novo e parar de compartilhar', async () => {
  const env = ambiente();
  const marina = await entrar(env, JOGADOR, 'Marina');
  assert.equal((await chamar(env, 'PUT', '/api/fichas/f1/link', { cookie: marina, json: { modo: 'ver' } })).status, 404); // ainda não está na nuvem
  await chamar(env, 'PUT', '/api/fichas/f1', { cookie: marina, json: { dados: FICHA, baseRev: 0 } });
  assert.equal((await chamar(env, 'PUT', '/api/fichas/f1/link', { cookie: marina, json: { modo: 'qualquer' } })).status, 400);
  assert.deepEqual((await (await chamar(env, 'GET', '/api/fichas/f1/link', { cookie: marina })).json()).link, null);

  const criado = (await (await chamar(env, 'PUT', '/api/fichas/f1/link', { cookie: marina, json: { modo: 'ver' } })).json()).link;
  assert.match(criado.token, /^[0-9a-f]{48}$/);
  assert.equal(criado.modo, 'ver');

  // qualquer pessoa, sem login, vê; não vê o id do dono; o cabeçalho impede cache
  const publico = await chamar(env, 'GET', '/api/link/' + criado.token);
  assert.equal(publico.status, 200);
  assert.equal(publico.headers.get('cache-control'), 'no-store');
  const corpo = await publico.json();
  assert.equal(corpo.modo, 'ver');
  assert.equal(corpo.dono, 'Marina');
  assert.equal(corpo.seu, false);
  assert.deepEqual(corpo.dados, FICHA);
  assert.equal(JSON.stringify(corpo).includes(JOGADOR), false);
  // com rev igual: só avisa que nada mudou
  const igual = await (await chamar(env, 'GET', '/api/link/' + criado.token + '?rev=' + corpo.rev)).json();
  assert.equal(igual.igual, true);
  assert.equal(igual.dados, undefined);
  // o dono reconhece o próprio link
  assert.equal((await (await chamar(env, 'GET', '/api/link/' + criado.token, { cookie: marina })).json()).seu, true);

  // só ver: ninguém grava, nem logado
  const outro = await entrar(env, OUTRO, 'Outro');
  assert.equal((await chamar(env, 'PUT', '/api/link/' + criado.token, { cookie: outro, json: { dados: FICHA, baseRev: 1 } })).status, 403);

  // trocar o modo mantém o token; "novo" troca o token e o antigo morre
  const editar = (await (await chamar(env, 'PUT', '/api/fichas/f1/link', { cookie: marina, json: { modo: 'editar' } })).json()).link;
  assert.equal(editar.token, criado.token);
  assert.equal(editar.modo, 'editar');
  const novo = (await (await chamar(env, 'PUT', '/api/fichas/f1/link', { cookie: marina, json: { modo: 'editar', novo: true } })).json()).link;
  assert.notEqual(novo.token, criado.token);
  assert.equal((await chamar(env, 'GET', '/api/link/' + criado.token)).status, 404);
  assert.equal((await chamar(env, 'GET', '/api/link/' + novo.token)).status, 200);
  assert.equal((await chamar(env, 'GET', '/api/link/curto')).status, 404);

  // parar de compartilhar; apagar a ficha também derruba o link
  assert.equal((await chamar(env, 'DELETE', '/api/fichas/f1/link', { cookie: marina })).status, 200);
  assert.equal((await chamar(env, 'GET', '/api/link/' + novo.token)).status, 404);
  const de_novo = (await (await chamar(env, 'PUT', '/api/fichas/f1/link', { cookie: marina, json: { modo: 'ver' } })).json()).link;
  await chamar(env, 'DELETE', '/api/fichas/f1', { cookie: marina });
  assert.equal((await chamar(env, 'GET', '/api/link/' + de_novo.token)).status, 404);
  assert.equal(env.DB.bruto.prepare('SELECT COUNT(*) AS n FROM links_ficha').get().n, 0);
});

test('link: editar exige login, grava na ficha do dono com controle de versão e mostra a lista do dono com o link', async () => {
  const env = ambiente();
  const marina = await entrar(env, JOGADOR, 'Marina');
  const editor = await entrar(env, OUTRO, 'Editor');
  await chamar(env, 'PUT', '/api/fichas/f1', { cookie: marina, json: { dados: FICHA, baseRev: 0 } });
  const { token } = (await (await chamar(env, 'PUT', '/api/fichas/f1/link', { cookie: marina, json: { modo: 'editar' } })).json()).link;
  assert.equal((await (await chamar(env, 'GET', '/api/fichas', { cookie: marina })).json()).fichas[0].link, 'editar');

  assert.equal((await chamar(env, 'PUT', '/api/link/' + token, { json: { dados: FICHA, baseRev: 1 } })).status, 401); // sem login
  assert.equal((await chamar(env, 'PUT', '/api/link/' + token, { cookie: editor, origem: 'https://mal.exemplo', json: { dados: FICHA, baseRev: 1 } })).status, 403);

  const editada = Object.assign({}, FICHA, { recursos: { pv: { atual: 3 } } });
  const ok = await chamar(env, 'PUT', '/api/link/' + token, { cookie: editor, json: { dados: editada, baseRev: 1 } });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).rev, 2);
  const naNuvem = await (await chamar(env, 'GET', '/api/fichas/f1', { cookie: marina })).json();
  assert.equal(naNuvem.rev, 2);
  assert.equal(naNuvem.dados.recursos.pv.atual, 3);
  assert.equal(env.DB.bruto.prepare('SELECT atualizado_por FROM fichas_nuvem').get().atualizado_por, OUTRO);

  // o editor com versão velha leva 409; o dono também (a ficha mudou por link)
  assert.equal((await chamar(env, 'PUT', '/api/link/' + token, { cookie: editor, json: { dados: FICHA, baseRev: 1 } })).status, 409);
  assert.equal((await chamar(env, 'PUT', '/api/fichas/f1', { cookie: marina, json: { dados: FICHA, baseRev: 1 } })).status, 409);
  // o editor não consegue ler nem apagar a ficha pela rota da conta
  assert.equal((await chamar(env, 'GET', '/api/fichas/f1', { cookie: editor })).status, 404);
  assert.equal((await chamar(env, 'DELETE', '/api/fichas/f1', { cookie: editor })).status, 200); // apaga a "dele" (inexistente): nada acontece
  assert.equal((await chamar(env, 'GET', '/api/fichas/f1', { cookie: marina })).status, 200);
});

test('nuvem sem as tabelas novas: a API avisa que falta rodar o schema (e /api/eu diz nuvem: false)', async () => {
  const env = ambiente();
  env.DB.bruto.exec('DROP TABLE fichas_nuvem; DROP TABLE links_ficha;');
  const jogador = await entrar(env, JOGADOR, 'Marina');
  assert.equal((await (await chamar(env, 'GET', '/api/eu', { cookie: jogador })).json()).nuvem, false);
  const r = await chamar(env, 'GET', '/api/fichas', { cookie: jogador });
  assert.equal(r.status, 503);
  assert.match((await r.json()).erro, /schema\.sql/);
});
