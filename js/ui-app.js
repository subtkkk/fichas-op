/* ==========================================================================
   js/ui-app.js — navegação entre as telas e avisos rápidos (OP.uiApp)
   --------------------------------------------------------------------------
   Rotas (no #hash, funcionam em file:// e no botão Voltar do navegador):
   - #/central        Central de operações (tela inicial)
   - #/arquivo        Arquivo de agentes (biblioteca de fichas)
   - #/ficha/<id>     abre a ficha <id> (OP.fichas.abrir) e mostra a ficha
   - #/ficha          a ficha aberta
   Âncoras comuns (ex.: #secao-pericias) não são rotas e são ignoradas.
   A tela ativa fica em <body data-vista="...">; o CSS mostra só ela.
   Avisos rápidos: OP.uiApp.aviso('ok'|'aviso'|'erro', texto) — sempre por
   textContent (nomes de fichas podem vir de arquivos importados).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const VISTAS = ['central', 'arquivo', 'ficha'];
  const TITULOS = {
    central: 'Central de Operações · Dossiê',
    arquivo: 'Arquivo de agentes · Dossiê'
  };
  const DURACAO_AVISO = { ok: 4500, aviso: 6500, erro: 8000 };
  const MAXIMO_AVISOS = 3;

  const refs = {};
  const ouvintes = [];

  function reduzMovimento() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ------------------------------------------------------------------------
     Rotas
     ------------------------------------------------------------------------ */

  /** Rota do #hash: { vista, id } ou null se o hash não é uma rota (âncora). */
  function lerRota(hash) {
    const texto = typeof hash === 'string' ? hash : window.location.hash;
    if (!texto || texto === '#' || texto === '#/') return { vista: 'central', id: null };
    if (texto.indexOf('#/') !== 0) return null;
    const partes = texto.slice(2).split('/');
    const vista = VISTAS.indexOf(partes[0]) !== -1 ? partes[0] : 'central';
    let id = null;
    if (vista === 'ficha' && partes[1]) {
      try {
        id = decodeURIComponent(partes[1]);
      } catch (erro) {
        id = null;
      }
    }
    return { vista: vista, id: id };
  }

  function hashDe(vista, id) {
    return vista === 'ficha' && id ? '#/ficha/' + encodeURIComponent(id) : '#/' + vista;
  }

  /** Troca o hash sem criar uma entrada nova no histórico. */
  function substituirHash(hash) {
    if (window.location.hash === hash) return;
    try {
      window.history.replaceState(null, '', hash);
    } catch (erro) {
      window.location.replace(hash);
    }
  }

  /**
   * Vai para uma tela. opcoes.substituir: sem entrada nova no histórico;
   * opcoes.focar: id do elemento que recebe o foco quando a tela aparecer
   * (senão, o título da tela). Se o hash já é esse, aplica direto (o
   * evento hashchange não viria).
   */
  function irPara(vista, id, opcoes) {
    const o = opcoes || {};
    refs.focoPendente = o.focar || null;
    const hash = hashDe(vista, id);
    if (window.location.hash === hash) {
      aplicarRota();
      return;
    }
    if (o.substituir) {
      substituirHash(hash);
      aplicarRota();
    } else {
      window.location.hash = hash;
    }
  }

  /** Aplica a rota atual: abre a ficha pedida, se for o caso, e mostra a tela. */
  function aplicarRota() {
    const rota = lerRota();
    if (!rota) return; // âncora dentro da página: não muda de tela

    if (rota.vista === 'ficha') {
      if (rota.id && rota.id !== OP.fichas.idAtual()) {
        const resultado = OP.fichas.abrir(rota.id);
        if (!resultado.ok) {
          aviso('erro', resultado.erro);
          substituirHash('#/arquivo');
          mostrarVista('arquivo');
          return;
        }
      }
      // Sem nenhuma ficha salva (só o rascunho em branco): volta para a Central.
      if (OP.fichas.ehRascunho()) {
        substituirHash('#/central');
        mostrarVista('central');
        return;
      }
      substituirHash(hashDe('ficha', OP.fichas.idAtual()));
    }
    mostrarVista(rota.vista);
  }

  /* ------------------------------------------------------------------------
     Telas
     ------------------------------------------------------------------------ */

  function atualizarNav() {
    const vista = document.body.dataset.vista;
    refs.itensNav.forEach(function (item) {
      if (item.dataset.rota === vista) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    const semFicha = OP.fichas.ehRascunho();
    refs.navFicha.hidden = semFicha;
    refs.navFicha.setAttribute('href', semFicha ? '#/ficha' : hashDe('ficha', OP.fichas.idAtual()));
  }

  function atualizarTitulo(vista) {
    if (vista === 'ficha') {
      const ficha = OP.state.ficha;
      const nome = ficha && ficha.identificacao ? String(ficha.identificacao.nome || '').trim() : '';
      document.title = nome ? nome + ' · Ficha de Agente' : 'Ficha de Agente · Ordem Paranormal';
    } else {
      document.title = TITULOS[vista] || TITULOS.central;
    }
  }

  /** Põe o foco no começo da tela nova (leitores de tela anunciam a troca). */
  function focarTela(vista) {
    const pedido = refs.focoPendente ? document.getElementById(refs.focoPendente) : null;
    refs.focoPendente = null;
    const alvo = pedido || document.querySelector('[data-vista-id="' + vista + '"] [data-foco-tela]') ||
      document.getElementById('conteudo');
    if (!alvo) return;
    try {
      alvo.focus({ preventScroll: true });
    } catch (erro) {
      alvo.focus();
    }
  }

  /** Troca de fato (sem animação). Sempre aplica a tela pedida por último. */
  function trocarVista(vista) {
    const anterior = document.body.dataset.vista;
    document.body.dataset.vista = vista;
    document.documentElement.dataset.vista = vista; // o CSS do <html> (âncoras) depende da tela
    atualizarNav();
    atualizarTitulo(vista);
    if (anterior !== vista || refs.focoPendente) {
      window.scrollTo(0, 0);
      focarTela(vista);
    }
    ouvintes.forEach(function (funcao) { funcao(vista, anterior); });
  }

  /**
   * Mostra uma tela, com uma passagem curta quando o navegador permite
   * (View Transitions). Nunca duas passagens ao mesmo tempo: durante uma,
   * a troca seguinte é direta. A troca acontece mesmo se o navegador
   * atrasar a passagem (reserva de 300 ms).
   */
  function mostrarVista(vista) {
    const anterior = document.body.dataset.vista;
    refs.vistaPedida = vista;
    const raiz = document.documentElement;
    const animar = anterior !== vista && refs.prontos && !refs.emTransicao && !raiz.dataset.transicao &&
      !reduzMovimento() && typeof document.startViewTransition === 'function' && document.visibilityState === 'visible';
    if (!animar) {
      trocarVista(vista);
      return;
    }

    const marca = anterior + '-' + vista;
    let feita = false;
    const aplicar = function () {
      if (feita) return;
      feita = true;
      trocarVista(refs.vistaPedida);
    };
    refs.emTransicao = true;
    raiz.dataset.transicao = marca;
    const reserva = setTimeout(aplicar, 300);
    const terminar = function () {
      clearTimeout(reserva);
      aplicar();
      refs.emTransicao = false;
      if (raiz.dataset.transicao === marca) delete raiz.dataset.transicao;
    };
    try {
      document.startViewTransition(aplicar).finished.then(terminar, terminar);
    } catch (erro) {
      terminar();
    }
  }

  function vistaAtual() {
    return document.body.dataset.vista;
  }

  /** fn(vista, anterior) a cada troca de tela. */
  function aoTrocarVista(funcao) {
    ouvintes.push(funcao);
  }

  /* ------------------------------------------------------------------------
     Avisos rápidos (toasts)
     ------------------------------------------------------------------------ */

  function fecharAviso(item) {
    if (!item || item.dataset.saindo === 'sim') return;
    item.dataset.saindo = 'sim';
    clearTimeout(Number(item.dataset.temporizador));
    const remover = function () { if (item.parentNode) item.parentNode.removeChild(item); };
    if (reduzMovimento()) remover();
    else setTimeout(remover, 220);
  }

  /**
   * Mostra um aviso curto no canto da tela. tipo: 'ok' | 'aviso' | 'erro'.
   * opcoes.acao: { rotulo, fazer } — um botão (ex.: "Abrir").
   */
  function aviso(tipo, texto, opcoes) {
    if (!refs.avisos || !texto) return null;
    const o = opcoes || {};
    const t = DURACAO_AVISO[tipo] ? tipo : 'ok';
    const item = document.createElement('div');
    item.className = 'aviso-app aviso-app--' + t;
    item.setAttribute('role', t === 'erro' ? 'alert' : 'status');

    const marca = document.createElement('span');
    marca.className = 'aviso-app__marca';
    marca.setAttribute('aria-hidden', 'true');
    item.appendChild(marca);

    const corpo = document.createElement('p');
    corpo.className = 'aviso-app__texto';
    corpo.textContent = String(texto);
    item.appendChild(corpo);

    if (o.acao && typeof o.acao.fazer === 'function') {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'aviso-app__acao';
      botao.textContent = o.acao.rotulo || 'Abrir';
      botao.addEventListener('click', function () {
        o.acao.fazer();
        fecharAviso(item);
      });
      item.appendChild(botao);
    }

    const fechar = document.createElement('button');
    fechar.type = 'button';
    fechar.className = 'aviso-app__fechar';
    fechar.setAttribute('aria-label', 'Fechar aviso');
    const iconeFechar = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconeFechar.setAttribute('class', 'icone-ui');
    iconeFechar.setAttribute('aria-hidden', 'true');
    iconeFechar.setAttribute('focusable', 'false');
    const usoFechar = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    usoFechar.setAttribute('href', '#ic-fechar');
    iconeFechar.appendChild(usoFechar);
    fechar.appendChild(iconeFechar);
    fechar.addEventListener('click', function () { fecharAviso(item); });
    item.appendChild(fechar);

    refs.avisos.appendChild(item);
    const itens = refs.avisos.querySelectorAll('.aviso-app:not([data-saindo="sim"])');
    if (itens.length > MAXIMO_AVISOS) fecharAviso(itens[0]);

    const duracao = Number(o.duracao) > 0 ? Number(o.duracao) : DURACAO_AVISO[t];
    item.dataset.temporizador = String(setTimeout(function () { fecharAviso(item); }, duracao));
    // Passar o mouse ou focar segura o aviso na tela
    item.addEventListener('mouseenter', function () { clearTimeout(Number(item.dataset.temporizador)); });
    item.addEventListener('focusin', function () { clearTimeout(Number(item.dataset.temporizador)); });
    item.addEventListener('mouseleave', function () {
      item.dataset.temporizador = String(setTimeout(function () { fecharAviso(item); }, 2500));
    });
    return item;
  }

  /**
   * Anuncia um texto para leitores de tela na região aria-live única e
   * invisível (#anunciador): rolagens, descanso, rodadas, condições, Desfazer.
   * O texto some e volta para o mesmo aviso ser lido de novo se repetir.
   */
  function anunciar(texto) {
    const regiao = refs.anunciador || document.getElementById('anunciador');
    if (!regiao || !texto) return;
    refs.anunciador = regiao;
    regiao.textContent = '';
    clearTimeout(refs.timerAnuncio);
    refs.timerAnuncio = setTimeout(function () { regiao.textContent = String(texto); }, 60);
  }

  /* ------------------------------------------------------------------------
     Montagem
     ------------------------------------------------------------------------ */

  function montar() {
    refs.avisos = document.getElementById('avisos-app');
    refs.anunciador = document.getElementById('anunciador');
    refs.itensNav = Array.prototype.slice.call(document.querySelectorAll('.nav-global__item[data-rota]'));
    refs.navFicha = document.getElementById('nav-ficha');

    window.addEventListener('hashchange', aplicarRota);
    // A ficha aberta pode mudar sem trocar de rota (excluir a aberta, importar): mantém a navegação certa.
    OP.state.aoMudar(function (ficha, caminho) {
      if (caminho === '*' || caminho === 'identificacao.nome') {
        atualizarNav();
        if (vistaAtual() === 'ficha') atualizarTitulo('ficha');
      }
    });

    // "/" foca a busca do Arquivo (fora de campos de texto)
    document.addEventListener('keydown', function (evento) {
      if (evento.key !== '/' || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      const alvo = evento.target;
      const digitando = alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));
      if (digitando || vistaAtual() !== 'arquivo') return;
      const busca = document.getElementById('arquivo-busca');
      if (busca) {
        evento.preventDefault();
        busca.focus();
      }
    });

    aplicarRota();
    refs.prontos = true;
    document.documentElement.classList.add('app-pronto');
  }

  OP.uiApp = {
    montar: montar,
    irPara: irPara,
    aplicarRota: aplicarRota,
    lerRota: lerRota,
    vistaAtual: vistaAtual,
    aoTrocarVista: aoTrocarVista,
    atualizarNav: atualizarNav,
    aviso: aviso,
    anunciar: anunciar
  };
})(window.OP);
