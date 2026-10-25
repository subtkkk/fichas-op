/* ==========================================================================
   js/nuvem.js — fichas na conta e compartilhamento por link (OP.nuvem)
   --------------------------------------------------------------------------
   Sem tela aqui (a tela é js/ui-nuvem.js). O servidor é worker/index.js.

   Salvar na conta (sincronização)
   - Com a conta conectada e a nuvem ativa, cada ficha deste navegador tem uma
     cópia na conta. O navegador continua sendo a cópia de trabalho: tudo
     funciona sem rede e sem conta.
   - Para saber o que mudou, guardamos por ficha o último estado em comum
     ("meta", chave op_nuvem): a versão (rev) da nuvem e uma impressão digital
     (hash) do que estava gravado aqui. Comparando os dois lados com a meta:
       mudou só aqui → envia; mudou só na nuvem → baixa; mudou nos dois →
       CONFLITO: a versão da nuvem vira uma cópia "(da nuvem)" aqui e a daqui
       segue como a ficha (nada se perde); sumiu de um lado (e existe a meta) →
       foi excluída lá: sai daqui se não foi mexida, ou volta a ser enviada.
   - O servidor só aceita uma gravação baseada na última versão (rev); senão
     devolve 409 e o navegador sincroniza de novo.
   - Tudo que vem da nuvem passa por OP.state.sanitizar (não é confiável).

   Compartilhar por link
   - O dono liga um link por ficha: "ver" (qualquer pessoa, sem conta) ou
     "editar" (quem abrir precisa entrar com o Discord). O link é
     <site>/#/compartilhada/<token>: o token fica no # e não vai para o servidor
     em registros nem para outros sites.
   - Quem abre vê a ficha só na memória (OP.fichas.abrirExterna): nada é gravado
     neste navegador. Em "ver", o estado recusa qualquer mudança. Em "editar", as
     mudanças vão para a ficha do dono (com o mesmo controle de versão) e a tela
     confere a cada 15 s se alguém mudou algo.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const CHAVE_META = 'op_nuvem';
  const ESPERA_SINCRONIA = 2000;     // ms depois da última gravação local
  const ESPERA_APOS_ERRO = 20000;    // idem, quando a última tentativa falhou
  const INTERVALO_SINCRONIA = 15000; // confere a nuvem de tempos em tempos (aba visível): é assim que a edição de um amigo chega
  const INTERVALO_LINK = 15000;      // confere a ficha de um link
  const ESPERA_ENVIO_LINK = 900;
  const TOKEN_VALIDO = /^[0-9a-f]{48}$/;
  const MAX_PASSADAS = 3;

  const estado = {
    disponivel: false,    // conta conectada e nuvem ativa no servidor
    ativo: true,          // chave "Salvar minhas fichas na conta"
    sincronizando: false,
    ultimo: null,         // Date da última sincronização que deu certo
    erro: '',             // última falha (vazio = tudo certo)
    externa: null         // ficha de link aberta: { token, modo, editavel, dono, id, rev, conectado }
  };
  const ouvintes = [];
  const falhas = Object.create(null); // id → { h, msg }: o servidor recusou esta versão (não repete até mudar)
  let agendamento = null;
  let intervaloSync = null;
  let intervaloLink = null;
  let envioLink = null;
  let emAndamento = null;
  let repetir = false;
  let ultimoAvisoLeitura = 0;

  /* ------------------------------------------------------------------------
     Utilitários
     ------------------------------------------------------------------------ */

  function emitir() {
    ouvintes.forEach(function (funcao) { funcao(estado); });
  }

  function aoMudar(funcao) {
    ouvintes.push(funcao);
  }

  function aviso(tipo, texto) {
    if (OP.uiApp && OP.uiApp.aviso) OP.uiApp.aviso(tipo, texto);
  }

  /** Impressão digital de um texto (cyrb53 + tamanho): só para saber se mudou, não é segurança. */
  function hashDe(texto) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < texto.length; i++) {
      const c = texto.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ':' + texto.length;
  }

  function conta() {
    return OP.conta && OP.conta.estado ? OP.conta.estado : null;
  }

  function pedirJson(metodo, caminho, corpo) {
    return OP.conta.pedir(caminho, {
      method: metodo,
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo)
    });
  }

  /* ------------------------------------------------------------------------
     Meta (último estado em comum com a nuvem, por ficha)
     ------------------------------------------------------------------------ */

  function metaVazia() {
    return { versao: 1, usuario: '', ativo: true, fichas: {} };
  }

  function lerMeta() {
    try {
      const bruto = OP.storage.ler(CHAVE_META);
      const m = bruto ? JSON.parse(bruto) : null;
      if (m && m.versao === 1 && m.fichas && typeof m.fichas === 'object' && !Array.isArray(m.fichas)) {
        return { versao: 1, usuario: typeof m.usuario === 'string' ? m.usuario : '', ativo: m.ativo !== false, fichas: m.fichas };
      }
    } catch (erro) {
      // meta corrompida: recomeça (as fichas não são afetadas; a próxima sincronia compara os conteúdos)
    }
    return metaVazia();
  }

  function gravarMeta(meta) {
    OP.storage.gravar(CHAVE_META, JSON.stringify(meta));
  }

  /* ------------------------------------------------------------------------
     A decisão (função pura, testada em js/tests-etapa11.js)
     ------------------------------------------------------------------------ */

  /**
   * remota: { rev } ou null; local: a ficha existe aqui?; hLocal: hash do que está gravado aqui;
   * meta: { rev, h } do último estado em comum ou null.
   * Devolve: 'nada' | 'enviar' | 'enviar-novo' | 'baixar' | 'comparar' | 'conflito' | 'excluir-local' | 'excluir-nuvem'.
   */
  function decidir(s) {
    const remota = s.remota;
    const meta = s.meta;
    if (!remota && !s.local) return 'nada';
    if (!remota) {
      if (!meta) return 'enviar-novo';
      return s.hLocal === meta.h ? 'excluir-local' : 'enviar-novo'; // excluída na nuvem: sai daqui se ninguém mexeu
    }
    if (!s.local) {
      if (!meta) return 'baixar';
      return remota.rev === meta.rev ? 'excluir-nuvem' : 'baixar'; // excluída aqui: sai de lá, a não ser que tenha mudado
    }
    if (!meta) return 'comparar';
    const mudouAqui = s.hLocal !== meta.h;
    const mudouLa = remota.rev !== meta.rev;
    if (mudouAqui && mudouLa) return 'conflito';
    if (mudouAqui) return 'enviar';
    return mudouLa ? 'baixar' : 'nada';
  }

  /* ------------------------------------------------------------------------
     Aplicar e enviar uma ficha
     ------------------------------------------------------------------------ */

  /** Ficha gravada aqui, em texto (a base da impressão digital). null se não existir. */
  function serializarLocal(id) {
    const ficha = OP.fichas.ler(id);
    return ficha ? JSON.stringify(ficha) : null;
  }

  function dataIso(segundos) {
    const d = new Date(Number(segundos) * 1000);
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  }

  /** Tira de dados da nuvem uma ficha confiável e completa (os dados vêm de fora). */
  function fichaDaNuvem(dados, id) {
    const ficha = OP.state.completarPadroes(OP.state.sanitizar(dados));
    ficha.id = id;
    return ficha;
  }

  /** A ficha aberta está sendo digitada agora? Então não se troca por baixo da pessoa. */
  function abertaComMudancaPendente(id) {
    return id === OP.fichas.idAtual() && !OP.fichas.ehExterna() && OP.fichas.status().estado === 'pendente';
  }

  /** Grava aqui a versão da nuvem. Devolve false se a pessoa estiver digitando nela (tenta de novo depois). */
  function aplicarRemota(id, dados, rev, atualizadoEm, meta) {
    if (abertaComMudancaPendente(id)) return false;
    const ficha = fichaDaNuvem(dados, id);
    const eraAberta = id === OP.fichas.idAtual() && !OP.fichas.ehExterna();
    OP.fichas.gravar(id, ficha, { atualizadoEm: dataIso(atualizadoEm) });
    if (eraAberta) OP.state.substituir(ficha);
    meta.fichas[id] = { rev: rev, h: hashDe(serializarLocal(id) || '') };
    return true;
  }

  async function baixarFicha(id) {
    const r = await pedirJson('GET', '/api/fichas/' + encodeURIComponent(id));
    return r.ok ? r.dados : null;
  }

  /** Envia a ficha daqui. Devolve { ok, rev, conflito, erro, h }. */
  async function enviarFicha(id, baseRev) {
    const texto = serializarLocal(id);
    if (texto === null) return { ok: false, erro: 'A ficha não existe mais aqui.' };
    const h = hashDe(texto);
    if (falhas[id] && falhas[id].h === h) return { ok: false, erro: falhas[id].msg, recusada: true, repetida: true }; // já avisei desta versão
    const r = await pedirJson('PUT', '/api/fichas/' + encodeURIComponent(id), { dados: JSON.parse(texto), baseRev: baseRev });
    if (r.ok) return { ok: true, rev: r.dados.rev, h: h };
    if (r.status === 409) return { ok: false, conflito: true, apagada: r.dados.apagada === true, rev: r.dados.rev };
    if (r.status === 413 || r.status === 403) {
      falhas[id] = { h: h, msg: r.dados.erro || 'O servidor recusou esta ficha.' };
      return { ok: false, erro: falhas[id].msg, recusada: true };
    }
    throw new Error(r.dados.erro || 'Falha ao enviar a ficha.');
  }

  function nomeDaFicha(id) {
    const linha = OP.fichas.listar().find(function (l) { return l.id === id; });
    return (linha && String(linha.nome || '').trim()) || 'Ficha sem nome';
  }

  /* ------------------------------------------------------------------------
     Sincronização
     ------------------------------------------------------------------------ */

  function pode() {
    const c = conta();
    return Boolean(c && c.conectado && c.nuvem && estado.ativo && !OP.fichas.ehExterna());
  }

  function confirmar(titulo, texto, textoConfirmar) {
    return new Promise(function (resolver) {
      let respondido = false;
      function responder(valor) {
        if (respondido) return;
        respondido = true;
        resolver(valor);
      }
      const abriu = OP.ui && OP.ui.confirmar && OP.ui.confirmar({
        titulo: titulo, texto: texto, textoConfirmar: textoConfirmar,
        aoConfirmar: function () { responder(true); },
        aoCancelar: function () { responder(false); }
      });
      if (!abriu) responder(false);
    });
  }

  /**
   * Primeira vez nesta conta (ou conta diferente da última): confirma antes de
   * mandar as fichas deste navegador. Devolve false se a pessoa não quiser.
   */
  async function conferirConta(meta) {
    const usuario = conta().usuario;
    const id = usuario ? usuario.id : '';
    if (meta.usuario === id) return true;
    const locais = OP.fichas.listar().length;
    const aceitou = locais === 0 || await confirmar(
      'Salvar suas fichas na conta?',
      'As ' + locais + (locais === 1 ? ' ficha deste navegador será salva' : ' fichas deste navegador serão salvas') + ' na conta ' +
        (usuario && usuario.nome ? usuario.nome : 'conectada') + ', e as que já estão na conta serão baixadas para cá. Você pode desligar isso depois em Conta.',
      'Salvar na conta'
    );
    meta.usuario = id;
    meta.fichas = {};
    meta.ativo = aceitou;
    estado.ativo = aceitou;
    gravarMeta(meta);
    return aceitou;
  }

  /** Uma passada: compara cada ficha (daqui e da nuvem) com a meta e faz o que for preciso. Devolve true se pediu outra passada. */
  async function passada() {
    OP.fichas.salvarPendente();
    const meta = lerMeta();
    if (!(await conferirConta(meta))) return false;

    const lista = await pedirJson('GET', '/api/fichas');
    if (!lista.ok) throw new Error(lista.dados.erro || 'Não foi possível ler as fichas da conta.');
    const remotas = Object.create(null);
    (lista.dados.fichas || []).forEach(function (f) { remotas[f.id] = f; });
    const locais = Object.create(null);
    OP.fichas.listar().forEach(function (l) { locais[l.id] = true; });
    const ids = Object.keys(Object.assign({}, remotas, locais, meta.fichas));
    let outra = false;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!OP.state.idValido(id)) continue;
      OP.fichas.salvarPendente();
      const texto = locais[id] ? serializarLocal(id) : null;
      const existeLocal = texto !== null;
      const acao = decidir({ remota: remotas[id] || null, local: existeLocal, hLocal: existeLocal ? hashDe(texto) : '', meta: meta.fichas[id] || null });
      const rem = remotas[id];

      if (acao === 'nada') {
        if (!rem && !existeLocal) delete meta.fichas[id];
      } else if (acao === 'excluir-local') {
        if (abertaComMudancaPendente(id)) { outra = true; continue; }
        delete meta.fichas[id];
        gravarMeta(meta);
        const nome = nomeDaFicha(id);
        OP.fichas.excluir(id);
        aviso('aviso', 'A ficha "' + nome + '" foi excluída na conta e saiu deste navegador.');
      } else if (acao === 'excluir-nuvem') {
        const r = await pedirJson('DELETE', '/api/fichas/' + encodeURIComponent(id));
        if (r.ok) delete meta.fichas[id];
      } else if (acao === 'enviar' || acao === 'enviar-novo') {
        const baseRev = acao === 'enviar' && rem ? rem.rev : 0;
        const e = await enviarFicha(id, baseRev);
        if (e.ok) meta.fichas[id] = { rev: e.rev, h: e.h };
        else if (e.conflito) outra = true;
        else if (e.recusada && !e.repetida) avisarRecusada(id, e.erro);
      } else if (acao === 'baixar' || acao === 'comparar') {
        const dados = await baixarFicha(id);
        if (!dados) { outra = true; continue; }
        if (acao === 'comparar') {
          const igual = hashDe(JSON.stringify(fichaDaNuvem(dados.dados, id))) === hashDe(texto);
          if (igual) { meta.fichas[id] = { rev: dados.rev, h: hashDe(texto) }; continue; }
          resolverConflito(id, dados, rem, meta);
          outra = true;
        } else if (!aplicarRemota(id, dados.dados, dados.rev, dados.atualizado_em, meta)) {
          outra = true;
        }
      } else if (acao === 'conflito') {
        const dados = await baixarFicha(id);
        if (!dados) { outra = true; continue; }
        resolverConflito(id, dados, rem, meta);
        outra = true;
      }
      gravarMeta(meta);
    }
    gravarMeta(meta);
    return outra;
  }

  /**
   * A ficha mudou aqui e na nuvem. A versão da nuvem vira uma ficha nova aqui
   * ("(da nuvem)") e a daqui continua sendo a ficha (será enviada por cima). Nada se perde.
   */
  function resolverConflito(id, dados, rem, meta) {
    const copia = fichaDaNuvem(dados.dados, OP.fichas.novoId());
    copia.identificacao.nome = ((copia.identificacao.nome || '').trim() || 'Ficha sem nome') + ' (da nuvem)';
    OP.fichas.gravar(copia.id, copia, { depoisDe: id, atualizadoEm: dataIso(dados.atualizado_em) });
    meta.fichas[id] = { rev: rem ? rem.rev : dados.rev, h: '' }; // sem hash em comum: a daqui conta como alterada e vai por cima
    aviso('aviso', 'A ficha "' + nomeDaFicha(id) + '" mudou aqui e na conta. A versão da conta ficou numa cópia chamada "' + nomeDaFicha(copia.id) + '".');
  }

  function avisarRecusada(id, texto) {
    aviso('erro', 'A ficha "' + nomeDaFicha(id) + '" não foi para a conta: ' + texto);
  }

  /** Sincroniza tudo. Várias chamadas juntas viram uma só (e uma passada extra, se chegou mudança no meio). */
  function sincronizar() {
    if (!pode()) return Promise.resolve(false);
    if (emAndamento) {
      repetir = true;
      return emAndamento;
    }
    estado.sincronizando = true;
    estado.erro = '';
    emitir();
    emAndamento = (async function () {
      try {
        let passadas = 0;
        do {
          repetir = false;
          const outra = await passada();
          passadas += 1;
          if (!outra && !repetir) break;
        } while (passadas < MAX_PASSADAS);
        estado.ultimo = new Date();
        return true;
      } catch (erro) {
        tratarErro(erro);
        return false;
      } finally {
        emAndamento = null;
        estado.sincronizando = false;
        emitir();
      }
    })();
    return emAndamento;
  }

  /** Mensagem legível para um erro de rede ou do servidor. */
  function mensagemDoErro(erro, padrao) {
    if (!erro || erro instanceof TypeError || erro.message === 'sem-api') return 'Sem conexão com o servidor.';
    return erro.message || padrao;
  }

  function tratarErro(erro) {
    const msg = mensagemDoErro(erro, 'Falha ao sincronizar.');
    estado.erro = msg;
    if (OP.conta && OP.conta.recarregar && /entre com o discord/i.test(msg)) OP.conta.recarregar();
  }

  /** Depois de gravar aqui: espera a pessoa parar de mexer e sincroniza. */
  function agendarSincronia() {
    if (!pode()) return;
    clearTimeout(agendamento);
    // Com a última tentativa em erro (sem rede, por exemplo), não insiste a cada digitação
    agendamento = setTimeout(sincronizar, estado.erro ? ESPERA_APOS_ERRO : ESPERA_SINCRONIA);
  }

  /** A conta mudou (entrou, saiu, recarregou): liga ou desliga a sincronia. */
  function atualizar() {
    const c = conta();
    const meta = lerMeta();
    estado.ativo = meta.ativo;
    estado.disponivel = Boolean(c && c.conectado && c.nuvem);
    clearInterval(intervaloSync);
    intervaloSync = null;
    if (estado.disponivel) {
      intervaloSync = setInterval(function () {
        if (document.visibilityState === 'visible') sincronizar();
      }, INTERVALO_SINCRONIA);
      if (estado.ativo) sincronizar();
    }
    reavaliarExterna();
    emitir();
  }

  /** Chave "Salvar minhas fichas na conta". */
  function definirAtivo(ligado) {
    const meta = lerMeta();
    meta.ativo = ligado === true;
    gravarMeta(meta);
    estado.ativo = meta.ativo;
    emitir();
    if (estado.ativo) sincronizar();
  }

  /* ------------------------------------------------------------------------
     Compartilhar: o link da ficha
     ------------------------------------------------------------------------ */

  function urlDoLink(token) {
    return location.origin + location.pathname + '#/compartilhada/' + token;
  }

  /** Garante que a ficha está na conta (envia agora, se precisar). Devolve true se está. */
  async function garantirNaNuvem(id) {
    if (!pode()) return false;
    OP.fichas.salvarPendente();
    await sincronizar();
    return Boolean(lerMeta().fichas[id]);
  }

  /** O link da ficha: { token, modo, url } ou null. */
  async function lerLink(id) {
    const r = await pedirJson('GET', '/api/fichas/' + encodeURIComponent(id) + '/link');
    if (!r.ok) throw new Error(r.dados.erro || 'Não foi possível ler o link.');
    return r.dados.link ? { token: r.dados.link.token, modo: r.dados.link.modo, url: urlDoLink(r.dados.link.token) } : null;
  }

  /** Liga o link (ou muda o modo). novo = true troca o endereço (o antigo para de funcionar). */
  async function definirLink(id, modo, novo) {
    if (!(await garantirNaNuvem(id))) throw new Error(estado.erro || 'A ficha ainda não está na conta. Confira se "Salvar minhas fichas na conta" está ligado.');
    const r = await pedirJson('PUT', '/api/fichas/' + encodeURIComponent(id) + '/link', { modo: modo, novo: novo === true });
    if (!r.ok) throw new Error(r.dados.erro || 'Não foi possível criar o link.');
    return { token: r.dados.link.token, modo: r.dados.link.modo, url: urlDoLink(r.dados.link.token) };
  }

  async function pararLink(id) {
    const r = await pedirJson('DELETE', '/api/fichas/' + encodeURIComponent(id) + '/link');
    if (!r.ok) throw new Error(r.dados.erro || 'Não foi possível desligar o link.');
  }

  /* ------------------------------------------------------------------------
     Abrir a ficha de um link
     ------------------------------------------------------------------------ */

  function pararRelogiosDoLink() {
    clearInterval(intervaloLink);
    clearTimeout(envioLink);
    intervaloLink = null;
    envioLink = null;
  }

  /** Pode editar: o link deixa e a pessoa entrou com o Discord. */
  function calcularEditavel(modo) {
    const c = conta();
    return modo === 'editar' && Boolean(c && c.conectado);
  }

  /** Reaplica o modo (ver/editar) depois de entrar ou sair da conta. */
  function reavaliarExterna() {
    const e = estado.externa;
    if (!e) return;
    e.editavel = calcularEditavel(e.modo);
    OP.state.definirSomenteLeitura(!e.editavel);
  }

  /**
   * Abre o link na tela. Devolve { ok, redirecionar?, erro? }.
   * redirecionar: o link é de uma ficha da própria pessoa que já está neste navegador.
   */
  async function abrirLink(token) {
    if (!TOKEN_VALIDO.test(String(token))) return { ok: false, erro: 'Este link não é válido.' };
    let r;
    try {
      r = await OP.conta.pedir('/api/link/' + token);
    } catch (erro) {
      return { ok: false, erro: 'Não foi possível abrir o link agora (sem conexão com o servidor).' };
    }
    if (!r.ok) return { ok: false, erro: r.dados.erro || 'Este link não existe mais ou foi desativado.' };
    const d = r.dados;
    if (d.seu && OP.fichas.existe(d.id)) return { ok: true, redirecionar: d.id };
    pararRelogiosDoLink();
    estado.externa = { token: token, modo: d.modo, editavel: false, dono: d.dono, id: d.id, rev: d.rev, enviando: false };
    OP.fichas.abrirExterna(fichaDaNuvem(d.dados, d.id), true);
    reavaliarExterna();
    intervaloLink = setInterval(conferirLink, INTERVALO_LINK);
    emitir();
    return { ok: true };
  }

  function sairDoLink() {
    if (!estado.externa) return;
    pararRelogiosDoLink();
    estado.externa = null;
    OP.fichas.sairDaExterna();
    emitir();
    if (estado.disponivel && estado.ativo) agendarSincronia();
  }

  /** A ficha de link tem uma mudança digitada que ainda não foi enviada? */
  function externaComEnvioPendente() {
    return envioLink !== null || Boolean(estado.externa && estado.externa.enviando);
  }

  /** De tempos em tempos: alguém mudou a ficha? Se sim (e não estou digitando), mostra a versão nova. */
  async function conferirLink() {
    const e = estado.externa;
    if (!e || document.visibilityState !== 'visible' || externaComEnvioPendente()) return;
    let r;
    try {
      r = await OP.conta.pedir('/api/link/' + e.token + '?rev=' + e.rev);
    } catch (erro) {
      return;
    }
    if (estado.externa !== e) return;
    if (r.status === 404) {
      aviso('erro', 'Este link foi desativado pelo dono da ficha.');
      pararRelogiosDoLink();
      OP.state.definirSomenteLeitura(true);
      e.editavel = false;
      emitir();
      return;
    }
    if (!r.ok || r.dados.igual) return;
    if (externaComEnvioPendente()) return;
    e.modo = r.dados.modo;
    e.dono = r.dados.dono;
    e.rev = r.dados.rev;
    OP.state.definirSomenteLeitura(false); // para poder trocar a ficha por dentro; reavaliarExterna volta o modo certo
    OP.state.substituir(fichaDaNuvem(r.dados.dados, e.id));
    reavaliarExterna();
    emitir();
  }

  /** Chamado a cada mudança na ficha de link (main.js). Só vale em "editar" com login. */
  function aoEditarExterna() {
    const e = estado.externa;
    if (!e || !e.editavel) return;
    clearTimeout(envioLink);
    envioLink = setTimeout(enviarExterna, ESPERA_ENVIO_LINK);
  }

  async function enviarExterna() {
    envioLink = null;
    const e = estado.externa;
    if (!e || !e.editavel || e.enviando) return;
    e.enviando = true;
    try {
      const r = await pedirJson('PUT', '/api/link/' + e.token, { dados: OP.state.ficha, baseRev: e.rev });
      if (r.ok) {
        e.rev = r.dados.rev;
      } else if (r.status === 409) {
        aviso('aviso', 'Outra pessoa mexeu na ficha ao mesmo tempo. A versão mais recente foi carregada.');
        const atual = await OP.conta.pedir('/api/link/' + e.token);
        if (atual.ok && estado.externa === e) {
          e.rev = atual.dados.rev;
          OP.state.definirSomenteLeitura(false);
          OP.state.substituir(fichaDaNuvem(atual.dados.dados, e.id));
          reavaliarExterna();
        }
      } else if (r.status === 403 || r.status === 404) {
        aviso('erro', r.dados.erro || 'O dono não permite mais editar esta ficha.');
        e.editavel = false;
        OP.state.definirSomenteLeitura(true);
      } else if (r.status === 401) {
        aviso('erro', 'Entre com o Discord para editar.');
        if (OP.conta.recarregar) OP.conta.recarregar();
      } else {
        aviso('erro', r.dados.erro || 'Não foi possível enviar a alteração.');
      }
    } catch (erro) {
      aviso('erro', 'Sem conexão: a alteração não foi enviada. Tente de novo.');
    } finally {
      e.enviando = false;
      emitir();
    }
  }

  /** Texto do indicador de salvamento enquanto a ficha de um link está na tela. */
  function textoDoStatus() {
    const e = estado.externa;
    if (!e) return '';
    if (!e.editavel) return 'Só visualização';
    return externaComEnvioPendente() ? 'Enviando…' : 'Mudanças vão para a ficha do dono';
  }

  /** Atualiza agora a ficha de link (botão "Atualizar"). */
  function atualizarLink() {
    return conferirLink();
  }

  /* ------------------------------------------------------------------------
     Início
     ------------------------------------------------------------------------ */

  function montar() {
    OP.fichas.aoGravar(function () {
      if (!emAndamento) agendarSincronia();
    });
    // Ao voltar para a aba, confere a nuvem (outra pessoa ou outro aparelho podem ter mexido)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && pode()) sincronizar();
    });
    // Tentou mudar uma ficha que é só para ver: avisa (no máximo a cada 4 s)
    OP.state.aoBloquear(function () {
      const t = Date.now();
      if (t - ultimoAvisoLeitura < 4000) return;
      ultimoAvisoLeitura = t;
      aviso('aviso', estado.externa && estado.externa.modo === 'editar'
        ? 'Entre com o Discord para editar esta ficha.'
        : 'Esta ficha é só para visualizar: o dono não liberou a edição.');
    });
  }

  OP.nuvem = {
    montar: montar,
    estado: estado,
    aoMudar: aoMudar,
    atualizar: atualizar,
    sincronizar: sincronizar,
    definirAtivo: definirAtivo,
    lerLink: lerLink,
    definirLink: definirLink,
    pararLink: pararLink,
    abrirLink: abrirLink,
    sairDoLink: sairDoLink,
    atualizarLink: atualizarLink,
    textoDoStatus: textoDoStatus,
    aoEditarExterna: aoEditarExterna,
    decidir: decidir,
    hashDe: hashDe,
    urlDoLink: urlDoLink
  };
})(window.OP);
