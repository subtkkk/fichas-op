/* ==========================================================================
   js/fichas.js — várias fichas no navegador (OP.fichas)
   --------------------------------------------------------------------------
   Chaves no armazenamento (OP.storage):
   - "op_idx_v2"      { versao: 2, atualId, fichas: [ { id, nome, classe, nex, estagio, atualizadoEm } ] }
   - "op_f_<id>"      a ficha
   - "op_ficha_atual" ficha única da Etapa 1: só é lida na migração e nunca é apagada
   Funções de armazenamento (listar, ler, gravar, criar, duplicar, importar,
   prepararIndice) não mexem na ficha aberta na tela. iniciar, abrir,
   excluir (da aberta), salvarAtual e recarregarAtual cuidam da ficha
   aberta em OP.state.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const CHAVE_INDICE = 'op_idx_v2';
  const PREFIXO_FICHA = 'op_f_';
  const CHAVE_LEGADA = 'op_ficha_atual';
  const ESPERA_SALVAR = 400; // ms sem mudanças antes de gravar (debounce)

  let temporizador = null;
  // estado: 'salvo' | 'pendente' | 'falha'; quando: Date da última gravação;
  // falhou: a última tentativa de gravar falhou (o aviso fica até dar certo).
  let status = { estado: 'salvo', quando: null, falhou: false };
  // criarSeVazio: sem nenhuma ficha salva, cria uma (comportamento antigo).
  // Com a Central de operações (iniciar({ criarSeVazio: false })), fica um
  // RASCUNHO em branco só na memória: não entra no índice até ser editado.
  const config = { criarSeVazio: true };
  const ouvintesStatus = [];
  const ouvintesFora = [];

  /* ------------------------------------------------------------------------
     Utilitários
     ------------------------------------------------------------------------ */

  /** Id novo: crypto.randomUUID() quando existir; senão data + aleatório. */
  function novoId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (erro) {
      // segue com a alternativa
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function chaveFicha(id) {
    return PREFIXO_FICHA + id;
  }

  /** Lê e interpreta um JSON do armazenamento (null se faltar ou estiver corrompido). */
  function lerJson(chave) {
    const texto = OP.storage.ler(chave);
    if (texto === null) return null;
    try {
      return JSON.parse(texto);
    } catch (erro) {
      return null;
    }
  }

  function gravarJson(chave, valor) {
    let texto;
    try {
      texto = JSON.stringify(valor);
    } catch (erro) {
      return false;
    }
    return OP.storage.gravar(chave, texto);
  }

  function ehObjeto(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
  }

  /** Id da ficha aberta na tela (ou null). */
  function idAtual() {
    const ficha = OP.state.ficha;
    return ficha && OP.state.idValido(ficha.id) ? ficha.id : null;
  }

  /* ------------------------------------------------------------------------
     Índice
     ------------------------------------------------------------------------ */

  /** Linha do índice validada (os dados vêm do armazenamento: não confiar). */
  function linhaValida(linha) {
    if (!ehObjeto(linha) || !OP.state.idValido(linha.id)) return null;
    return {
      id: linha.id,
      nome: typeof linha.nome === 'string' ? linha.nome.slice(0, 200) : '',
      classe: typeof linha.classe === 'string' ? linha.classe.slice(0, 40) : '',
      nex: typeof linha.nex === 'number' && Number.isFinite(linha.nex) ? linha.nex : 0,
      estagio: typeof linha.estagio === 'number' && Number.isFinite(linha.estagio) ? linha.estagio : 1,
      atualizadoEm: typeof linha.atualizadoEm === 'string' ? linha.atualizadoEm.slice(0, 40) : ''
    };
  }

  /** Linha nova do índice a partir de uma ficha (estagio: só o Sobrevivente usa). */
  function linhaDe(id, ficha) {
    const identificacao = (ficha && ficha.identificacao) || {};
    return {
      id: id,
      nome: String(identificacao.nome || '').slice(0, 200),
      classe: String(identificacao.classe || '').slice(0, 40),
      nex: Number(identificacao.nex) || 0,
      estagio: Number(identificacao.estagio) || 1,
      atualizadoEm: new Date().toISOString()
    };
  }

  /** Índice salvo (validado) ou null se não existir / estiver corrompido. */
  function lerIndice() {
    const dados = lerJson(CHAVE_INDICE);
    if (!ehObjeto(dados) || dados.versao !== 2 || !Array.isArray(dados.fichas)) return null;
    const vistos = Object.create(null);
    const fichas = [];
    dados.fichas.forEach(function (bruta) {
      const linha = linhaValida(bruta);
      if (linha && !vistos[linha.id]) {
        vistos[linha.id] = true;
        fichas.push(linha);
      }
    });
    const atualId = typeof dados.atualId === 'string' && vistos[dados.atualId] ? dados.atualId : null;
    return { versao: 2, atualId: atualId, fichas: fichas };
  }

  function indiceOuVazio() {
    return lerIndice() || { versao: 2, atualId: null, fichas: [] };
  }

  function gravarIndice(indice) {
    return gravarJson(CHAVE_INDICE, indice);
  }

  function posicaoNoIndice(indice, id) {
    for (let i = 0; i < indice.fichas.length; i++) {
      if (indice.fichas[i].id === id) return i;
    }
    return -1;
  }

  /** Índice perdido: refaz a partir das chaves "op_f_<id>" que existirem. */
  function reconstruirIndice() {
    const fichas = [];
    OP.storage.chaves().forEach(function (chave) {
      if (chave.indexOf(PREFIXO_FICHA) !== 0) return;
      const id = chave.slice(PREFIXO_FICHA.length);
      const ficha = ler(id);
      if (ficha) fichas.push(linhaDe(id, ficha));
    });
    return { versao: 2, atualId: fichas.length ? fichas[0].id : null, fichas: fichas };
  }

  /**
   * Índice pronto para uso (grava se precisou montar):
   * 1. o índice salvo, se existir;
   * 2. senão, refeito a partir das fichas "op_f_<id>" que existirem;
   * 3. senão, MIGRAÇÃO da chave antiga "op_ficha_atual" (Etapa 1): vira a
   *    primeira ficha (passando por completarPadroes) e a chave antiga fica;
   * 4. senão, um índice vazio (não gravado).
   */
  function prepararIndice() {
    const indice = lerIndice();
    if (indice) return indice;

    const reconstruido = reconstruirIndice();
    if (reconstruido.fichas.length) {
      gravarIndice(reconstruido);
      return reconstruido;
    }

    const legado = lerJson(CHAVE_LEGADA);
    if (ehObjeto(legado)) {
      const ficha = OP.state.completarPadroes(legado);
      const id = novoId();
      ficha.id = id;
      gravar(id, ficha, { atual: true });
      return indiceOuVazio();
    }
    return { versao: 2, atualId: null, fichas: [] };
  }

  /** Linhas do índice (cópias), na ordem da lista. */
  function listar() {
    return indiceOuVazio().fichas.map(function (linha) { return Object.assign({}, linha); });
  }

  /** Data da última gravação de uma ficha (Date) ou null. */
  function dataDaLinha(id) {
    const indice = indiceOuVazio();
    const posicao = posicaoNoIndice(indice, id);
    if (posicao === -1) return null;
    const data = new Date(indice.fichas[posicao].atualizadoEm);
    return Number.isFinite(data.getTime()) ? data : null;
  }

  /** A ficha está no índice (foi salva neste navegador)? */
  function existe(id) {
    return OP.state.idValido(id) && posicaoNoIndice(indiceOuVazio(), id) !== -1;
  }

  /** A ficha aberta é um rascunho em branco que ainda não foi salvo? */
  function ehRascunho() {
    const id = idAtual();
    return id === null || !existe(id);
  }

  function marcarAtual(id) {
    const indice = indiceOuVazio();
    if (posicaoNoIndice(indice, id) === -1 || indice.atualId === id) return;
    indice.atualId = id;
    gravarIndice(indice);
  }

  /* ------------------------------------------------------------------------
     Fichas no armazenamento (não mexem na ficha aberta)
     ------------------------------------------------------------------------ */

  /** Ficha salva, completa (completarPadroes), ou null se não existir / estiver corrompida. */
  function ler(id) {
    if (!OP.state.idValido(id)) return null;
    const dados = lerJson(chaveFicha(id));
    if (!ehObjeto(dados)) return null;
    const ficha = OP.state.completarPadroes(dados);
    ficha.id = id; // a chave é quem manda
    return ficha;
  }

  /**
   * Grava a ficha e atualiza (ou cria) a linha dela no índice.
   * opcoes.atual: marca como a ficha aberta; opcoes.depoisDe: id da linha
   * depois da qual uma linha nova entra (senão vai para o fim).
   * Devolve true se tudo foi gravado no armazenamento.
   */
  function gravar(id, ficha, opcoes) {
    if (!OP.state.idValido(id) || !ehObjeto(ficha)) return false;
    const o = opcoes || {};
    const okFicha = gravarJson(chaveFicha(id), Object.assign({}, ficha, { id: id }));

    const indice = indiceOuVazio();
    const linha = linhaDe(id, ficha);
    const posicao = posicaoNoIndice(indice, id);
    if (posicao !== -1) {
      indice.fichas[posicao] = linha;
    } else {
      const depois = o.depoisDe ? posicaoNoIndice(indice, o.depoisDe) : -1;
      if (depois === -1) indice.fichas.push(linha);
      else indice.fichas.splice(depois + 1, 0, linha);
    }
    if (o.atual || !indice.atualId) indice.atualId = id;
    const okIndice = gravarIndice(indice);
    return okFicha && okIndice;
  }

  /** Cria uma ficha (vazia ou a partir de dados) e devolve o id. Não abre. */
  function criar(dados) {
    const ficha = OP.state.completarPadroes(dados || OP.state.modeloVazio());
    const id = novoId();
    ficha.id = id;
    gravar(id, ficha);
    return id;
  }

  /** Copia uma ficha: novo id e nome "… (cópia)", logo depois da original. Devolve o id ou null. */
  function duplicar(id) {
    const aberta = id === idAtual();
    if (aberta) salvarPendente();
    const original = aberta ? OP.state.ficha : ler(id);
    if (!original) return null;
    const copia = OP.state.completarPadroes(original);
    const novo = novoId();
    copia.id = novo;
    copia.identificacao.nome = (String(original.identificacao.nome || '').trim() || 'Ficha sem nome') + ' (cópia)';
    gravar(novo, copia, { depoisDe: id });
    return novo;
  }

  /**
   * Importa fichas (já lidas por OP.state.lerImportacao). SEMPRE cria fichas
   * novas: se o id já existir (ou for inválido), ganha um id novo.
   * Devolve { ok, ids }.
   */
  function importar(fichas) {
    const ids = [];
    let ok = true;
    (Array.isArray(fichas) ? fichas : []).forEach(function (dados) {
      const ficha = OP.state.completarPadroes(dados);
      const indice = indiceOuVazio();
      const livre = OP.state.idValido(ficha.id) &&
        posicaoNoIndice(indice, ficha.id) === -1 &&
        ficha.id !== idAtual() &&
        OP.storage.ler(chaveFicha(ficha.id)) === null;
      const id = livre ? ficha.id : novoId();
      ficha.id = id;
      if (!gravar(id, ficha)) ok = false;
      ids.push(id);
    });
    return { ok: ok, ids: ids };
  }

  /**
   * Grava uma ficha importada por cima da que já existe com o mesmo id (a
   * escolha "Substituir" ao reimportar). Se for a ficha aberta, a tela passa
   * a mostrar a versão do arquivo. Devolve o id ou null.
   */
  function substituirExistente(dados) {
    const ficha = OP.state.completarPadroes(dados);
    if (!OP.state.idValido(ficha.id) || !existe(ficha.id)) return null;
    const id = ficha.id;
    if (id === idAtual()) {
      cancelarSalvamento();
      OP.state.substituir(ficha);
    }
    return gravar(id, ficha) ? id : null;
  }

  /**
   * Devolve uma ficha excluída (mesmo id) ao lugar em que estava no índice.
   * É o "Desfazer" depois de excluir. Não abre a ficha. Devolve true/false.
   */
  function restaurar(ficha, posicao) {
    if (!ehObjeto(ficha) || !OP.state.idValido(ficha.id) || existe(ficha.id)) return false;
    const id = ficha.id;
    if (!gravar(id, OP.state.completarPadroes(ficha))) return false;
    const indice = indiceOuVazio();
    const atual = posicaoNoIndice(indice, id);
    if (atual !== -1 && typeof posicao === 'number' && posicao !== atual) {
      const linha = indice.fichas.splice(atual, 1)[0];
      indice.fichas.splice(Math.max(0, Math.min(posicao, indice.fichas.length)), 0, linha);
      gravarIndice(indice);
    }
    return true;
  }

  /** Posição da ficha no índice (ordem do Arquivo) ou -1. */
  function posicao(id) {
    return posicaoNoIndice(indiceOuVazio(), id);
  }

  /* ------------------------------------------------------------------------
     Ficha aberta: salvar (com debounce), abrir, excluir, recarregar
     ------------------------------------------------------------------------ */

  function emitirStatus(novo) {
    status = Object.assign({}, status, novo);
    ouvintesStatus.forEach(function (funcao) { funcao(Object.assign({}, status)); });
  }

  function cancelarSalvamento() {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  }

  /** Grava agora a ficha aberta. Devolve true se ficou salva neste navegador. */
  function salvarAtual() {
    cancelarSalvamento();
    const ficha = OP.state.ficha;
    if (!ficha || !OP.state.idValido(ficha.id)) return false;
    const ok = gravar(ficha.id, ficha, { atual: true }) && OP.storage.modo() !== 'memoria';
    emitirStatus(ok
      ? { estado: 'salvo', quando: new Date(), falhou: false }
      : { estado: 'falha', falhou: true });
    return ok;
  }

  /** Agenda a gravação para 400 ms depois da última mudança. */
  function agendarSalvamento() {
    cancelarSalvamento();
    if (status.estado !== 'pendente') emitirStatus({ estado: 'pendente' });
    temporizador = setTimeout(salvarAtual, ESPERA_SALVAR);
  }

  /** Se houver gravação agendada, grava já (antes de trocar de ficha, exportar, sair). */
  function salvarPendente() {
    if (temporizador !== null) salvarAtual();
  }

  /**
   * Abre uma ficha na tela. Salva a atual antes (opcoes.semSalvar pula isso,
   * usado quando a atual acabou de ser excluída). Devolve { ok, erro }.
   */
  function abrir(id, opcoes) {
    const o = opcoes || {};
    if (id === idAtual() && !o.forcar) return { ok: true, erro: '' };
    const ficha = ler(id);
    if (!ficha) return { ok: false, erro: 'Não foi possível abrir esta ficha: os dados salvos estão corrompidos ou não existem mais.' };
    if (o.semSalvar) cancelarSalvamento();
    else salvarPendente();
    OP.state.substituir(ficha);
    marcarAtual(id);
    emitirStatus({ estado: status.falhou ? 'falha' : 'salvo', quando: dataDaLinha(id) });
    return { ok: true, erro: '' };
  }

  /** Abre a primeira ficha que der certo, a partir de uma posição da lista. */
  function abrirAlguma(linhas, posicaoPreferida) {
    const ordem = linhas.slice(posicaoPreferida).concat(linhas.slice(0, posicaoPreferida));
    for (let i = 0; i < ordem.length; i++) {
      if (abrir(ordem[i].id, { semSalvar: true, forcar: true }).ok) return ordem[i].id;
    }
    return null;
  }

  /** Põe na tela um rascunho em branco (não salvo; entra no índice ao ser editado). */
  function abrirRascunho() {
    cancelarSalvamento();
    const ficha = OP.state.completarPadroes(OP.state.modeloVazio());
    ficha.id = novoId();
    OP.state.substituir(ficha);
    emitirStatus({ estado: status.falhou ? 'falha' : 'salvo', quando: null });
    return ficha.id;
  }

  /**
   * Exclui uma ficha. Se era a aberta, abre a vizinha da lista; se era a
   * última, cria uma nova (ou deixa um rascunho, com criarSeVazio desligado).
   * Devolve { ok, abriuId } (abriuId é null se ficou um rascunho).
   */
  function excluir(id) {
    if (!OP.state.idValido(id)) return { ok: false, abriuId: null };
    const eraAberta = id === idAtual();
    if (eraAberta) cancelarSalvamento(); // não deixa um salvamento agendado recriar a ficha

    OP.storage.remover(chaveFicha(id));
    const indice = indiceOuVazio();
    const posicao = posicaoNoIndice(indice, id);
    if (posicao !== -1) indice.fichas.splice(posicao, 1);
    if (indice.atualId === id) indice.atualId = null;
    gravarIndice(indice);
    if (!eraAberta) return { ok: true, abriuId: null };

    let abriu = indice.fichas.length
      ? abrirAlguma(indice.fichas, Math.max(0, Math.min(posicao, indice.fichas.length - 1)))
      : null;
    if (!abriu && !config.criarSeVazio) {
      abrirRascunho();
      return { ok: true, abriuId: null };
    }
    if (!abriu) {
      abriu = criar();
      abrir(abriu, { semSalvar: true, forcar: true });
    }
    return { ok: true, abriuId: abriu };
  }

  /** Relê a ficha aberta do armazenamento (alterada em outra aba). Descarta o que não foi salvo. */
  function recarregarAtual() {
    const id = idAtual();
    const ficha = id ? ler(id) : null;
    if (!ficha) return false;
    cancelarSalvamento();
    OP.state.substituir(ficha);
    emitirStatus({ estado: status.falhou ? 'falha' : 'salvo', quando: dataDaLinha(id) });
    return true;
  }

  /* ------------------------------------------------------------------------
     Exportar
     ------------------------------------------------------------------------ */

  /** Ficha para exportar: a aberta vem da memória (mais recente). */
  function fichaParaExportar(id) {
    if (id === idAtual()) {
      salvarPendente();
      return OP.state.ficha;
    }
    return ler(id);
  }

  /** Texto do arquivo de uma ficha ({ formato: "op-ficha", ... }) ou null. */
  function exportarTexto(id) {
    const ficha = fichaParaExportar(id);
    return ficha ? JSON.stringify(OP.state.envelopeFicha(ficha), null, 2) : null;
  }

  /** Texto do backup de todas as fichas ({ formato: "op-backup", ... }). */
  function backupTexto() {
    salvarPendente();
    const aberta = idAtual();
    const fichas = [];
    let incluiuAberta = false;
    listar().forEach(function (linha) {
      if (linha.id === aberta) {
        fichas.push(OP.state.ficha);
        incluiuAberta = true;
      } else {
        const ficha = ler(linha.id);
        if (ficha) fichas.push(ficha);
      }
    });
    if (!incluiuAberta && OP.state.ficha) fichas.unshift(OP.state.ficha);
    return JSON.stringify(OP.state.envelopeBackup(fichas), null, 2);
  }

  /** "Ana Júlia" → "ana-julia" (sem acentos, minúsculas, com hífens). */
  function textoParaArquivo(texto) {
    const limpo = String(texto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '');
    return limpo || 'sem-nome';
  }

  function nomeArquivoFicha(ficha) {
    const nome = ficha && ficha.identificacao ? ficha.identificacao.nome : '';
    return 'ficha-' + textoParaArquivo(nome) + '.json';
  }

  function doisDigitos(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** "fichas-backup-AAAA-MM-DD.json" (data local). */
  function nomeArquivoBackup(data) {
    const d = data || new Date();
    return 'fichas-backup-' + d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate()) + '.json';
  }

  /* ------------------------------------------------------------------------
     Avisos: status de salvamento e mudanças feitas em outra aba
     ------------------------------------------------------------------------ */

  /** fn({ estado, quando, falhou }) a cada mudança no salvamento. */
  function aoMudarStatus(funcao) {
    ouvintesStatus.push(funcao);
  }

  /** fn(tipo): 'ficha' (a ficha aberta mudou em outra aba) ou 'indice' (a lista mudou). */
  function aoAlterarFora(funcao) {
    ouvintesFora.push(funcao);
  }

  function lerStatus() {
    return Object.assign({}, status);
  }

  /** Evento "storage": só chega quando OUTRA aba grava. Nunca recarrega sozinho. */
  function aoMudarArmazenamento(evento) {
    if (!evento || typeof evento.key !== 'string') return;
    const aberta = idAtual();
    let tipo = null;
    if (aberta && evento.key === chaveFicha(aberta) && evento.newValue !== null) tipo = 'ficha';
    else if (evento.key === CHAVE_INDICE) tipo = 'indice';
    if (!tipo) return;
    ouvintesFora.forEach(function (funcao) { funcao(tipo); });
  }

  /* ------------------------------------------------------------------------
     Início
     ------------------------------------------------------------------------ */

  /**
   * Prepara o índice (ou migra a ficha da Etapa 1) e abre na tela a ficha
   * atual — ou a primeira que der para ler, ou uma nova. Devolve a ficha.
   * opcoes.criarSeVazio = false: sem fichas salvas, abre um rascunho em
   * branco que só é salvo se for editado (a Central mostra o estado vazio).
   */
  function iniciar(opcoes) {
    const o = opcoes || {};
    if (o.criarSeVazio === false) config.criarSeVazio = false;
    const indice = prepararIndice();
    const ordem = [indice.atualId].concat(indice.fichas.map(function (linha) { return linha.id; }));
    let id = null;
    let ficha = null;
    for (let i = 0; i < ordem.length && !ficha; i++) {
      if (!ordem[i]) continue;
      ficha = ler(ordem[i]);
      if (ficha) id = ordem[i];
    }
    if (!ficha && !config.criarSeVazio) {
      ficha = OP.state.completarPadroes(OP.state.modeloVazio());
      ficha.id = novoId();
      id = ficha.id;
    } else if (!ficha) {
      id = criar();
      ficha = ler(id) || Object.assign(OP.state.modeloVazio(), { id: id });
    }
    OP.state.substituir(ficha);
    marcarAtual(id); // não faz nada com o rascunho (ele não está no índice)

    status = OP.storage.modo() === 'memoria'
      ? { estado: 'falha', quando: null, falhou: true }
      : { estado: 'salvo', quando: dataDaLinha(id), falhou: false };

    window.addEventListener('storage', aoMudarArmazenamento);
    // Não perde a última digitação ao fechar ou trocar de aba.
    window.addEventListener('pagehide', salvarPendente);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') salvarPendente();
    });
    return OP.state.ficha;
  }

  OP.fichas = {
    CHAVE_INDICE: CHAVE_INDICE,
    PREFIXO_FICHA: PREFIXO_FICHA,
    CHAVE_LEGADA: CHAVE_LEGADA,
    novoId: novoId,
    iniciar: iniciar,
    prepararIndice: prepararIndice,
    lerIndice: lerIndice,
    listar: listar,
    ler: ler,
    gravar: gravar,
    criar: criar,
    duplicar: duplicar,
    excluir: excluir,
    importar: importar,
    substituirExistente: substituirExistente,
    restaurar: restaurar,
    posicao: posicao,
    abrir: abrir,
    abrirRascunho: abrirRascunho,
    existe: existe,
    ehRascunho: ehRascunho,
    idAtual: idAtual,
    salvarAtual: salvarAtual,
    agendarSalvamento: agendarSalvamento,
    salvarPendente: salvarPendente,
    recarregarAtual: recarregarAtual,
    exportarTexto: exportarTexto,
    backupTexto: backupTexto,
    nomeArquivoFicha: nomeArquivoFicha,
    nomeArquivoBackup: nomeArquivoBackup,
    status: lerStatus,
    aoMudarStatus: aoMudarStatus,
    aoAlterarFora: aoAlterarFora
  };
})(window.OP);
