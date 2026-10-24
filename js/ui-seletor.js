/* ==========================================================================
   js/ui-seletor.js — seletor próprio para as listas (OP.uiSeletor)
   --------------------------------------------------------------------------
   Troca a lista nativa que o navegador desenha ao abrir um <select> por um
   painel do próprio dossiê: grupos por livro, busca nas listas longas, a
   descrição de cada opção (o title) visível também no toque, teclado
   completo e, no celular, uma gaveta presa embaixo.

   O <select> continua no lugar, escondido, e é a fonte de verdade: as
   ligações da ficha (data-campo), os ouvintes de "change", a impressão e o
   salvamento não mudam. Escolher uma opção grava no <select> e dispara
   "input" e "change" como o navegador faria. O botão só espelha o valor.

   Listas criadas depois (cartões de ataque, ritual, item…) são encontradas
   sozinhas (MutationObserver). Valores trocados por código são relidos a
   cada desenho da ficha e a cada troca de tela.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const MINIMO_BUSCA = 10;            // listas com mais opções que isso ganham busca
  const CONSULTA_GAVETA = '(max-width: 719px)';
  const ALTURA_MAXIMA = 360;          // px do painel no desktop
  const LARGURA_MINIMA = 260;         // px do painel no desktop (títulos de livro cabem numa linha)
  const TEMPO_DIGITACAO = 700;        // ms para juntar letras na busca por digitação

  let itens = [];                     // { select, botao, valor, medida, textos, nome }
  let contador = 0;
  const painel = {};
  let aberto = null;                  // { item, opcoes: [{ elemento, option, desativada, normal }], ativo }
  let digitado = '';
  let temporizadorDigitacao = null;

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function emGaveta() {
    return Boolean(window.matchMedia && window.matchMedia(CONSULTA_GAVETA).matches);
  }

  function reduzMovimento() {
    return OP.uiApp ? OP.uiApp.reduzMovimento() : Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** Nome do campo para leitores de tela e para o título da gaveta. */
  function nomeDoCampo(select) {
    const rotuloAria = select.getAttribute('aria-label');
    if (rotuloAria) return rotuloAria;
    if (select.labels && select.labels.length) {
      const copia = select.labels[0].cloneNode(true);
      copia.querySelectorAll('select, .seletor, [hidden]').forEach(function (no) { no.remove(); });
      const texto = copia.textContent.replace(/\s+/g, ' ').trim();
      if (texto) return texto;
    }
    return select.title || '';
  }

  /* ------------------------------------------------------------------------
     O botão no lugar do select
     ------------------------------------------------------------------------ */

  function melhorar(select) {
    if (select.dataset.seletor || select.multiple || select.size > 1 || select.hasAttribute('data-nativo')) return;
    contador += 1;
    select.dataset.seletor = String(contador);

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.setAttribute('aria-haspopup', 'listbox');
    botao.setAttribute('aria-expanded', 'false');
    // Valor à vista e, na mesma célula e invisíveis, todos os textos: o botão
    // fica com a largura da opção mais longa, como o select nativo (sem pular)
    const caixa = document.createElement('span');
    caixa.className = 'seletor__caixa';
    const valor = document.createElement('span');
    valor.className = 'seletor__valor';
    const medida = document.createElement('span');
    medida.className = 'seletor__medida';
    medida.setAttribute('aria-hidden', 'true');
    caixa.appendChild(valor);
    caixa.appendChild(medida);
    botao.appendChild(caixa);
    botao.insertAdjacentHTML('beforeend',
      '<svg class="seletor__seta" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1 1.5 6 6.5 11 1.5"/></svg>');
    select.insertAdjacentElement('afterend', botao);

    // O select fica no lugar (para os rótulos, a impressão e os dados), fora do caminho do teclado
    select.classList.add('seletor-nativo');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const item = { select: select, botao: botao, valor: valor, medida: medida, textos: null, nome: nomeDoCampo(select) };
    itens.push(item);

    botao.addEventListener('click', function () {
      if (aberto && aberto.item === item) fechar(true);
      else abrir(item);
    });
    botao.addEventListener('keydown', function (evento) { teclaNoBotao(evento, item); });
    // Clique no <label for> foca o select escondido: o foco vai para o botão
    select.addEventListener('focus', function () { botao.focus(); });
    select.addEventListener('change', function () { atualizarItem(item); });
    new MutationObserver(function () { atualizarItem(item); })
      .observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'class', 'title'] });
    atualizarItem(item);
  }

  function atualizarItem(item) {
    const select = item.select;
    const botao = item.botao;
    const opcao = select.selectedOptions && select.selectedOptions[0];
    const texto = opcao ? opcao.textContent.replace(/\s+/g, ' ').trim() : '';
    const mostrado = texto || '—';
    if (item.valor.textContent !== mostrado) item.valor.textContent = mostrado;
    const textos = Array.prototype.map.call(select.options, function (o) {
      return o.textContent.replace(/\s+/g, ' ').trim();
    }).join('\n');
    if (item.textos !== textos) {
      item.textos = textos;
      item.medida.textContent = '';
      textos.split('\n').forEach(function (linha) {
        const span = document.createElement('span');
        span.textContent = linha;
        item.medida.appendChild(span);
      });
    }

    const classes = ('seletor ' + select.className.replace(/\bseletor-nativo\b/, '')).replace(/\s+/g, ' ').trim();
    if (botao.className !== classes) botao.className = classes;
    if (botao.disabled !== select.disabled) botao.disabled = select.disabled;
    if (botao.hidden !== select.hidden) botao.hidden = select.hidden;
    const dica = select.title || '';
    if (botao.title !== dica) botao.title = dica;
    const rotulo = (item.nome ? item.nome + ': ' : '') + (texto || 'nada escolhido');
    if (botao.getAttribute('aria-label') !== rotulo) botao.setAttribute('aria-label', rotulo);
  }

  /** Relê todos os botões (valores trocados por código) e esquece os que saíram da página. */
  function atualizar() {
    itens = itens.filter(function (item) { return item.select.isConnected; });
    itens.forEach(atualizarItem);
    if (aberto && !aberto.item.select.isConnected) fechar(false);
  }

  function melhorarEm(raiz) {
    if (!raiz || raiz.nodeType !== 1) return;
    if (raiz.tagName === 'SELECT') melhorar(raiz);
    else raiz.querySelectorAll('select').forEach(melhorar);
  }

  /* ------------------------------------------------------------------------
     O painel (um só, reaproveitado)
     ------------------------------------------------------------------------ */

  function construirPainel() {
    if (painel.caixa) return;
    painel.fundo = document.createElement('div');
    painel.fundo.className = 'seletor-fundo';
    painel.fundo.hidden = true;
    painel.fundo.addEventListener('click', function () { fechar(true); });

    painel.caixa = document.createElement('div');
    painel.caixa.className = 'seletor-painel';
    painel.caixa.hidden = true;

    painel.topo = document.createElement('div');
    painel.topo.className = 'seletor-painel__topo';
    painel.titulo = document.createElement('p');
    painel.titulo.className = 'seletor-painel__titulo';
    painel.titulo.id = 'seletor-painel-titulo';
    painel.fechar = document.createElement('button');
    painel.fechar.type = 'button';
    painel.fechar.className = 'botao-icone seletor-painel__fechar';
    painel.fechar.setAttribute('aria-label', 'Fechar lista');
    painel.fechar.innerHTML = '<svg class="icone-ui" aria-hidden="true" focusable="false"><use href="#ic-fechar"/></svg>';
    painel.fechar.addEventListener('click', function () { fechar(true); });
    painel.topo.appendChild(painel.titulo);
    painel.topo.appendChild(painel.fechar);

    painel.busca = document.createElement('input');
    painel.busca.type = 'search';
    painel.busca.className = 'controle seletor-painel__busca';
    painel.busca.placeholder = 'Buscar…';
    painel.busca.autocomplete = 'off';
    painel.busca.spellcheck = false;
    painel.busca.setAttribute('role', 'combobox');
    painel.busca.setAttribute('aria-autocomplete', 'list');
    painel.busca.setAttribute('aria-expanded', 'true');
    painel.busca.setAttribute('aria-controls', 'seletor-painel-lista');
    painel.busca.setAttribute('aria-label', 'Buscar na lista');
    painel.busca.addEventListener('input', filtrar);
    painel.busca.addEventListener('keydown', teclaNoPainel);

    painel.lista = document.createElement('div');
    painel.lista.className = 'seletor-painel__lista';
    painel.lista.id = 'seletor-painel-lista';
    painel.lista.setAttribute('role', 'listbox');
    painel.lista.setAttribute('aria-labelledby', 'seletor-painel-titulo');
    painel.lista.tabIndex = -1;
    painel.lista.addEventListener('keydown', teclaNoPainel);
    painel.lista.addEventListener('click', function (evento) {
      const linha = evento.target.closest('[role="option"]');
      if (!linha || !aberto) return;
      const indice = aberto.opcoes.findIndex(function (o) { return o.elemento === linha; });
      if (indice !== -1) escolher(indice);
    });
    painel.lista.addEventListener('mousemove', function (evento) {
      const linha = evento.target.closest('[role="option"]');
      if (!linha || !aberto) return;
      const indice = aberto.opcoes.findIndex(function (o) { return o.elemento === linha; });
      if (indice !== -1 && indice !== aberto.ativo && !aberto.opcoes[indice].desativada) marcarAtivo(indice, false);
    });

    painel.vazio = document.createElement('p');
    painel.vazio.className = 'seletor-painel__vazio';
    painel.vazio.textContent = 'Nenhuma opção encontrada.';
    painel.vazio.hidden = true;

    painel.caixa.appendChild(painel.topo);
    painel.caixa.appendChild(painel.busca);
    painel.caixa.appendChild(painel.lista);
    painel.caixa.appendChild(painel.vazio);
    document.body.appendChild(painel.fundo);
    document.body.appendChild(painel.caixa);
  }

  function criarOpcao(option, destino) {
    contador += 1;
    const linha = document.createElement('div');
    linha.className = 'seletor-opcao';
    linha.id = 'seletor-opcao-' + contador;
    linha.setAttribute('role', 'option');
    const selecionada = option.selected;
    linha.setAttribute('aria-selected', String(selecionada));
    if (option.disabled) linha.setAttribute('aria-disabled', 'true');
    if (!option.value) linha.classList.add('seletor-opcao--vazia');

    const texto = document.createElement('span');
    texto.className = 'seletor-opcao__texto';
    texto.textContent = option.textContent.replace(/\s+/g, ' ').trim();
    linha.appendChild(texto);
    if (option.title) {
      const descricao = document.createElement('span');
      descricao.className = 'seletor-opcao__descricao';
      descricao.textContent = option.title;
      linha.appendChild(descricao);
    }
    linha.insertAdjacentHTML('beforeend',
      '<svg class="seletor-opcao__marca" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5 6.5 12 13 4.5"/></svg>');
    destino.appendChild(linha);
    return { elemento: linha, option: option, desativada: option.disabled, normal: normalizar(texto.textContent + ' ' + (option.title || '')) };
  }

  function montarOpcoes(select) {
    const opcoes = [];
    painel.lista.textContent = '';
    Array.prototype.forEach.call(select.children, function (no) {
      if (no.hidden) return;
      if (no.tagName === 'OPTION') {
        opcoes.push(criarOpcao(no, painel.lista));
        return;
      }
      if (no.tagName !== 'OPTGROUP') return;
      contador += 1;
      const grupo = document.createElement('div');
      grupo.className = 'seletor-grupo';
      grupo.setAttribute('role', 'group');
      const titulo = document.createElement('div');
      titulo.className = 'seletor-grupo__titulo';
      titulo.id = 'seletor-grupo-' + contador;
      titulo.setAttribute('role', 'presentation');
      titulo.textContent = no.label;
      grupo.setAttribute('aria-labelledby', titulo.id);
      grupo.appendChild(titulo);
      Array.prototype.forEach.call(no.children, function (option) {
        if (option.tagName === 'OPTION' && !option.hidden) opcoes.push(criarOpcao(option, grupo));
      });
      painel.lista.appendChild(grupo);
    });
    return opcoes;
  }

  function abrir(item) {
    // A origem usa um painel grande, com título e setinha para ler descrição, poder e perícias (js/ui-livro.js)
    if (item.select.dataset.seletorGrande === 'origem' && OP.uiLivro && OP.uiLivro.abrirOrigem) {
      OP.uiLivro.abrirOrigem(item.select, item.botao);
      return;
    }
    // A trilha também: cada trilha traz as habilidades por NEX e as descrições (só com a classe escolhida)
    if (item.select.dataset.seletorGrande === 'trilha' && OP.uiLivro && OP.uiLivro.abrirTrilha) {
      if (!item.select.disabled) OP.uiLivro.abrirTrilha(item.select, item.botao);
      return;
    }
    if (item.select.disabled) return;
    if (aberto) fechar(false);
    construirPainel();
    atualizarItem(item);
    const opcoes = montarOpcoes(item.select);
    aberto = { item: item, opcoes: opcoes, ativo: -1 };

    // Dentro de um <dialog> aberto o painel precisa estar na mesma camada; e leva o tema da ficha
    const dono = item.botao.closest('dialog[open]') || document.body;
    if (painel.caixa.parentNode !== dono) {
      dono.appendChild(painel.fundo);
      dono.appendChild(painel.caixa);
    }
    const tema = item.botao.closest('[data-elemento]');
    if (tema) painel.caixa.setAttribute('data-elemento', tema.getAttribute('data-elemento'));
    else painel.caixa.removeAttribute('data-elemento');

    painel.titulo.textContent = item.nome || 'Escolha';
    const comBusca = opcoes.length > MINIMO_BUSCA;
    painel.busca.hidden = !comBusca;
    painel.busca.value = '';
    painel.vazio.hidden = true;
    const gaveta = emGaveta();
    painel.caixa.classList.toggle('seletor-painel--gaveta', gaveta);
    painel.caixa.classList.toggle('seletor-painel--com-busca', comBusca);
    painel.caixa.classList.toggle('seletor-painel--animar', !reduzMovimento());
    painel.fundo.hidden = !gaveta;
    painel.caixa.hidden = false;
    item.botao.setAttribute('aria-expanded', 'true');
    item.botao.setAttribute('aria-controls', 'seletor-painel-lista');
    item.botao.classList.add('seletor--aberto');
    posicionar();

    const selecionada = opcoes.findIndex(function (o) { return o.option.selected; });
    marcarAtivo(selecionada !== -1 ? selecionada : proximaHabilitada(-1, 1), true);
    if (comBusca && !gaveta) painel.busca.focus();
    else painel.lista.focus({ preventScroll: true });

    document.addEventListener('pointerdown', aoTocarFora, true);
    document.addEventListener('scroll', aoRolar, true);
    window.addEventListener('resize', aoRedimensionar);
  }

  function fechar(devolverFoco) {
    if (!aberto) return;
    const item = aberto.item;
    aberto = null;
    painel.caixa.hidden = true;
    painel.fundo.hidden = true;
    painel.lista.removeAttribute('aria-activedescendant');
    painel.busca.removeAttribute('aria-activedescendant');
    item.botao.setAttribute('aria-expanded', 'false');
    item.botao.classList.remove('seletor--aberto');
    document.removeEventListener('pointerdown', aoTocarFora, true);
    document.removeEventListener('scroll', aoRolar, true);
    window.removeEventListener('resize', aoRedimensionar);
    if (devolverFoco && item.botao.isConnected) item.botao.focus({ preventScroll: true });
  }

  /** Desktop: logo abaixo (ou acima) do botão. Celular: gaveta (o CSS cuida). */
  function posicionar() {
    if (!aberto) return;
    const caixa = painel.caixa;
    if (caixa.classList.contains('seletor-painel--gaveta')) {
      caixa.style.cssText = '';
      return;
    }
    const r = aberto.item.botao.getBoundingClientRect();
    const larguraTela = document.documentElement.clientWidth;
    const alturaTela = window.innerHeight;
    const largura = Math.min(Math.max(r.width, LARGURA_MINIMA), larguraTela - 16);
    const esquerda = Math.max(8, Math.min(r.left, larguraTela - largura - 8));
    const abaixo = alturaTela - r.bottom - 12;
    const acima = r.top - 12;
    const desejada = Math.min(ALTURA_MAXIMA, caixa.scrollHeight || ALTURA_MAXIMA);
    caixa.style.left = esquerda + 'px';
    caixa.style.width = largura + 'px';
    if (abaixo >= desejada || abaixo >= acima) {
      caixa.style.top = (r.bottom + 6) + 'px';
      caixa.style.bottom = 'auto';
      caixa.style.maxHeight = Math.max(160, Math.min(ALTURA_MAXIMA, abaixo)) + 'px';
      caixa.dataset.lado = 'baixo';
    } else {
      caixa.style.top = 'auto';
      caixa.style.bottom = (alturaTela - r.top + 6) + 'px';
      caixa.style.maxHeight = Math.max(160, Math.min(ALTURA_MAXIMA, acima)) + 'px';
      caixa.dataset.lado = 'cima';
    }
  }

  function aoTocarFora(evento) {
    if (!aberto) return;
    if (painel.caixa.contains(evento.target) || aberto.item.botao.contains(evento.target)) return;
    fechar(false);
  }

  function aoRolar(evento) {
    if (!aberto || painel.caixa.contains(evento.target)) return;
    if (painel.caixa.classList.contains('seletor-painel--gaveta')) return;
    // O botão saiu da tela: fecha; senão, o painel acompanha
    const r = aberto.item.botao.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) fechar(false);
    else posicionar();
  }

  function aoRedimensionar() {
    if (!aberto) return;
    const gaveta = emGaveta();
    painel.caixa.classList.toggle('seletor-painel--gaveta', gaveta);
    painel.fundo.hidden = !gaveta;
    posicionar();
  }

  /* ------------------------------------------------------------------------
     Opção ativa, filtro e escolha
     ------------------------------------------------------------------------ */

  function visivel(opcao) {
    return !opcao.elemento.hidden;
  }

  function proximaHabilitada(de, passo) {
    if (!aberto) return -1;
    const opcoes = aberto.opcoes;
    for (let i = de + passo; i >= 0 && i < opcoes.length; i += passo) {
      if (!opcoes[i].desativada && visivel(opcoes[i])) return i;
    }
    return -1;
  }

  function marcarAtivo(indice, centralizar) {
    if (!aberto) return;
    const anterior = aberto.opcoes[aberto.ativo];
    if (anterior) anterior.elemento.classList.remove('seletor-opcao--ativa');
    aberto.ativo = indice;
    const atual = aberto.opcoes[indice];
    // Na lista e na busca: o foco pode estar em qualquer uma das duas (gaveta com busca)
    const alvos = painel.busca.hidden ? [painel.lista] : [painel.lista, painel.busca];
    if (!atual) {
      alvos.forEach(function (alvo) { alvo.removeAttribute('aria-activedescendant'); });
      return;
    }
    atual.elemento.classList.add('seletor-opcao--ativa');
    alvos.forEach(function (alvo) { alvo.setAttribute('aria-activedescendant', atual.elemento.id); });
    atual.elemento.scrollIntoView({ block: centralizar ? 'center' : 'nearest' });
  }

  function filtrar() {
    if (!aberto) return;
    const termo = normalizar(painel.busca.value);
    let visiveis = 0;
    aberto.opcoes.forEach(function (opcao) {
      const mostra = !termo || opcao.normal.indexOf(termo) !== -1;
      opcao.elemento.hidden = !mostra;
      if (mostra) visiveis += 1;
    });
    painel.lista.querySelectorAll('.seletor-grupo').forEach(function (grupo) {
      grupo.hidden = !grupo.querySelector('[role="option"]:not([hidden])');
    });
    painel.vazio.hidden = visiveis > 0;
    const atual = aberto.opcoes[aberto.ativo];
    if (!atual || !visivel(atual) || atual.desativada) marcarAtivo(proximaHabilitada(-1, 1), false);
  }

  function escolher(indice) {
    if (!aberto) return;
    const opcao = aberto.opcoes[indice];
    if (!opcao || opcao.desativada) return;
    const item = aberto.item;
    const select = item.select;
    const mudou = select.value !== opcao.option.value || !opcao.option.selected;
    fechar(true);
    if (mudou) {
      opcao.option.selected = true;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    atualizarItem(item);
  }

  /** Letras digitadas com a lista aberta (sem busca): pula para a opção que começa assim. */
  function pularPorTexto(letra) {
    clearTimeout(temporizadorDigitacao);
    digitado += normalizar(letra);
    temporizadorDigitacao = setTimeout(function () { digitado = ''; }, TEMPO_DIGITACAO);
    const opcoes = aberto.opcoes;
    const inicio = digitado.length === 1 ? aberto.ativo + 1 : Math.max(aberto.ativo, 0);
    for (let n = 0; n < opcoes.length; n++) {
      const i = (inicio + n) % opcoes.length;
      if (!opcoes[i].desativada && opcoes[i].normal.indexOf(digitado) === 0) {
        marcarAtivo(i, false);
        return;
      }
    }
  }

  /* ------------------------------------------------------------------------
     Teclado
     ------------------------------------------------------------------------ */

  function teclaNoBotao(evento, item) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].indexOf(evento.key) === -1) return;
    evento.preventDefault();
    abrir(item);
  }

  function teclaNoPainel(evento) {
    if (!aberto) return;
    const naBusca = evento.target === painel.busca;
    switch (evento.key) {
      case 'ArrowDown': {
        evento.preventDefault();
        const proxima = proximaHabilitada(aberto.ativo, 1);
        if (proxima !== -1) marcarAtivo(proxima, false);
        return;
      }
      case 'ArrowUp': {
        evento.preventDefault();
        const anterior = proximaHabilitada(aberto.ativo, -1);
        if (anterior !== -1) marcarAtivo(anterior, false);
        return;
      }
      case 'PageDown':
      case 'PageUp': {
        evento.preventDefault();
        const passo = evento.key === 'PageDown' ? 1 : -1;
        let alvo = aberto.ativo;
        for (let n = 0; n < 8; n++) {
          const seguinte = proximaHabilitada(alvo, passo);
          if (seguinte === -1) break;
          alvo = seguinte;
        }
        marcarAtivo(alvo, false);
        return;
      }
      case 'Home':
      case 'End':
        if (naBusca) return;
        evento.preventDefault();
        marcarAtivo(evento.key === 'Home' ? proximaHabilitada(-1, 1) : proximaHabilitada(aberto.opcoes.length, -1), false);
        return;
      case 'Enter':
        evento.preventDefault();
        if (aberto.ativo !== -1) escolher(aberto.ativo);
        return;
      case ' ':
        if (naBusca) return;
        evento.preventDefault();
        if (aberto.ativo !== -1) escolher(aberto.ativo);
        return;
      case 'Escape':
        evento.preventDefault();
        evento.stopPropagation();
        fechar(true);
        return;
      case 'Tab':
        evento.preventDefault();
        fechar(true);
        return;
      default:
        if (!naBusca && evento.key.length === 1 && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
          pularPorTexto(evento.key);
        }
    }
  }

  /* ------------------------------------------------------------------------
     Montagem
     ------------------------------------------------------------------------ */

  function montar() {
    melhorarEm(document.body);
    // Listas novas (cartões redesenhados, opções recriadas em outro lugar)
    new MutationObserver(function (mudancas) {
      mudancas.forEach(function (mudanca) {
        mudanca.addedNodes.forEach(function (no) {
          if (no.nodeType === 1 && no !== painel.caixa && no !== painel.fundo && !(painel.caixa && painel.caixa.contains(no))) melhorarEm(no);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
    // Valores trocados por código: relê a cada desenho e a cada troca de tela
    if (OP.ui && OP.ui.registrarExtensao) OP.ui.registrarExtensao({ desenhar: atualizar });
    if (OP.uiApp && OP.uiApp.aoTrocarVista) OP.uiApp.aoTrocarVista(function () { fechar(false); atualizar(); });
  }

  OP.uiSeletor = {
    montar: montar,
    atualizar: atualizar,
    fechar: fechar
  };
})(window.OP);
