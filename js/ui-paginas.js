/* ==========================================================================
   js/ui-paginas.js — a ficha em páginas (OP.uiPaginas)
   --------------------------------------------------------------------------
   A ficha não é mais uma rolagem contínua.
   - Computador (a partir de 1280 px): três zonas sempre à vista (info do agente,
     atributos + vitais + testes, perícias) e, à direita, abas com as outras
     páginas (Combate, Habilidades, Rituais, Inventário, Biografia, Agente e
     Rolagens).
   - Celular e tablet: uma página por vez. O rodapé tem as setas e o botão-índice
     (abre a folha com todas as páginas); deslizar para os lados também troca.
   Quais elementos aparecem em cada página vem do atributo data-pagina no HTML;
   data-fixa marca o que fica sempre visível no computador; o que não está na página atual recebe data-oculta. Textos fixos, sem
   dados da ficha (só o número de condições ativas, como número).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  // Ordem do índice no celular. aba: aparece nas abas do computador.
  const PAGINAS = [
    { id: 'resumo', nome: 'Resumo', nota: 'Atributos, vitais, defesa e testes', aba: false },
    { id: 'pericias', nome: 'Perícias', nota: 'Grau, bônus e rolagem de cada perícia', aba: false },
    { id: 'combate', nome: 'Combate', nota: 'Condições, defesa e ataques', aba: true },
    { id: 'habilidades', nome: 'Habilidades', nota: 'Habilidades e poderes', aba: true },
    { id: 'rituais', nome: 'Rituais', nota: 'Rituais, formas e custos', aba: true },
    { id: 'inventario', nome: 'Inventário', nota: 'Itens, carga e patente', aba: true },
    { id: 'biografia', nome: 'Biografia', nota: 'Retrato, notas e diário', aba: true },
    { id: 'agente', nome: 'Agente', nota: 'Identificação, origem, classe e recursos', aba: true },
    { id: 'rolagens', nome: 'Rolagens', nota: 'Dados, fórmulas e histórico', aba: true }
  ];

  const LARGURA_COMPUTADOR = 1280; // px
  const refs = {};
  const estado = { desktop: 'combate', mobile: 'resumo', condicoes: 0 };
  let consulta = null;

  function emComputador() {
    return consulta ? consulta.matches : window.innerWidth >= LARGURA_COMPUTADOR;
  }

  function paginaPorId(id) {
    return PAGINAS.find(function (p) { return p.id === id; }) || null;
  }

  function atual() {
    return emComputador() ? estado.desktop : estado.mobile;
  }

  function reduzMovimento() {
    return OP.uiApp ? OP.uiApp.reduzMovimento() : Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function criar(tag, classe, texto) {
    return OP.ui.criarElemento(tag, classe, texto);
  }

  /* ------------------------------------------------------------------------
     Montagem: abas (computador) e folha do índice (celular)
     ------------------------------------------------------------------------ */

  function textoSelo(pagina) {
    return pagina.id === 'combate' && estado.condicoes > 0 ? String(estado.condicoes) : '';
  }

  function montarAbas() {
    PAGINAS.filter(function (p) { return p.aba; }).forEach(function (pagina) {
      const aba = criar('button', 'aba-pagina');
      aba.type = 'button';
      aba.id = 'aba-' + pagina.id;
      aba.setAttribute('role', 'tab');
      aba.setAttribute('aria-controls', 'pagina-' + pagina.id);
      aba.setAttribute('data-ir-pagina', pagina.id);
      aba.appendChild(criar('span', 'aba-pagina__nome', pagina.nome));
      const selo = criar('span', 'aba-pagina__selo');
      selo.hidden = true;
      aba.appendChild(selo);
      refs.abas.appendChild(aba);
    });
  }

  function montarIndice() {
    PAGINAS.forEach(function (pagina, indice) {
      const item = criar('li', 'paginas-indice__item');
      const botao = criar('button', 'paginas-indice__botao');
      botao.type = 'button';
      botao.setAttribute('data-ir-pagina', pagina.id);
      botao.appendChild(criar('span', 'paginas-indice__num', String(indice + 1).padStart(2, '0')));
      const texto = criar('span', 'paginas-indice__texto');
      texto.appendChild(criar('strong', '', pagina.nome));
      texto.appendChild(criar('small', '', pagina.nota));
      botao.appendChild(texto);
      const selo = criar('span', 'paginas-indice__selo');
      selo.hidden = true;
      botao.appendChild(selo);
      item.appendChild(botao);
      refs.indice.appendChild(item);
    });
  }

  /* ------------------------------------------------------------------------
     Aplicar a página atual (o que aparece e o que fica marcado)
     ------------------------------------------------------------------------ */

  function aplicar() {
    const computador = emComputador();
    const id = atual();
    refs.ficha.setAttribute('data-pagina', id);
    refs.ficha.setAttribute('data-modo-paginas', computador ? 'computador' : 'celular');

    Array.prototype.forEach.call(refs.ficha.querySelectorAll('[data-pagina]'), function (elemento) {
      const fixa = elemento.hasAttribute('data-fixa');
      const visivel = (computador && fixa) || elemento.getAttribute('data-pagina') === id;
      // data-oculta (e não hidden): o CSS de impressão mostra tudo, sem depender de JavaScript
      elemento.toggleAttribute('data-oculta', !visivel);
    });

    // Abas (computador)
    Array.prototype.forEach.call(refs.abas.querySelectorAll('[role="tab"]'), function (aba) {
      const marcada = aba.getAttribute('data-ir-pagina') === id;
      aba.setAttribute('aria-selected', String(marcada));
      aba.tabIndex = marcada ? 0 : -1;
      const selo = aba.querySelector('.aba-pagina__selo');
      const texto = textoSelo(paginaPorId(aba.getAttribute('data-ir-pagina')));
      if (selo.textContent !== texto) selo.textContent = texto;
      selo.hidden = !texto;
      if (texto) selo.setAttribute('aria-label', texto + ' condições ativas');
    });
    // Se as abas não couberem, a marcada é trazida para a vista
    const marcada = refs.abas.querySelector('[aria-selected="true"]');
    if (marcada && refs.abas.scrollWidth > refs.abas.clientWidth + 2) {
      const esquerda = marcada.offsetLeft;
      const direita = esquerda + marcada.offsetWidth;
      if (esquerda < refs.abas.scrollLeft) refs.abas.scrollLeft = Math.max(0, esquerda - 8);
      else if (direita > refs.abas.scrollLeft + refs.abas.clientWidth) refs.abas.scrollLeft = direita - refs.abas.clientWidth + 8;
    }

    // Folha do índice e rodapé (celular)
    const posicao = PAGINAS.findIndex(function (p) { return p.id === id; });
    Array.prototype.forEach.call(refs.indice.querySelectorAll('[data-ir-pagina]'), function (botao) {
      const eleito = botao.getAttribute('data-ir-pagina') === id;
      if (eleito) botao.setAttribute('aria-current', 'page');
      else botao.removeAttribute('aria-current');
      const selo = botao.querySelector('.paginas-indice__selo');
      const texto = textoSelo(paginaPorId(botao.getAttribute('data-ir-pagina')));
      if (selo.textContent !== texto) selo.textContent = texto;
      selo.hidden = !texto;
    });
    const pagina = paginaPorId(id);
    if (refs.dockNome.textContent !== pagina.nome) refs.dockNome.textContent = pagina.nome;
    const contador = (posicao + 1) + '/' + PAGINAS.length;
    if (refs.dockContador.textContent !== contador) refs.dockContador.textContent = contador;
    refs.dockIndice.setAttribute('aria-label', 'Índice da ficha: página ' + pagina.nome + ', ' + (posicao + 1) + ' de ' + PAGINAS.length);
    refs.dockSetas.forEach(function (seta) {
      const delta = Number(seta.getAttribute('data-pagina-delta'));
      const destino = posicao + delta;
      seta.disabled = destino < 0 || destino >= PAGINAS.length;
      if (!seta.disabled) seta.setAttribute('aria-label', (delta < 0 ? 'Página anterior: ' : 'Próxima página: ') + PAGINAS[destino].nome);
    });
  }

  function focarPagina(id) {
    const alvo = refs.ficha.querySelector('[data-pagina="' + id + '"]:not([data-oculta])');
    if (!alvo) return;
    const titulo = alvo.querySelector('.secao__titulo, .rolagens__titulo');
    const foco = titulo || alvo;
    if (!foco.hasAttribute('tabindex')) foco.setAttribute('tabindex', '-1');
    try {
      foco.focus({ preventScroll: true });
    } catch (erro) {
      foco.focus();
    }
  }

  /**
   * Abre uma página. No computador só as páginas com aba mudam (Perícias e Resumo
   * já estão sempre à vista); no celular qualquer uma. opcoes: { foco, rolar, anunciar }.
   */
  function ir(id, opcoes) {
    const o = opcoes || {};
    const pagina = paginaPorId(id);
    if (!pagina) return;
    const computador = emComputador();
    // As páginas com aba valem nos dois tamanhos (quem redimensiona a janela leva a página junto);
    // Resumo e Perícias só existem como página no celular
    if (pagina.aba) {
      estado.desktop = id;
      estado.mobile = id;
    } else {
      estado.mobile = id;
    }
    aplicar();
    if (o.rolar !== false && !computador) window.scrollTo({ top: 0, behavior: 'auto' });
    if (o.foco && !(computador && !pagina.aba)) focarPagina(id);
    if (o.anunciar !== false && OP.uiApp && OP.uiApp.anunciar) OP.uiApp.anunciar('Página ' + pagina.nome + '.');
  }

  /** Mostra a página onde o elemento mora (sem rolar nem mover o foco) e devolve o elemento. */
  function mostrarPaginaDe(alvo) {
    const elemento = typeof alvo === 'string' ? document.getElementById(alvo) : alvo;
    if (!elemento) return null;
    const dono = elemento.closest('[data-pagina]');
    if (dono && refs.ficha.contains(dono) && dono.closest('[data-oculta]')) {
      ir(dono.getAttribute('data-pagina'), { rolar: false, anunciar: false });
    }
    return elemento;
  }

  /** Vai até uma seção (ou elemento): troca de página se precisar, rola e põe o foco no título. */
  function irParaSecao(alvo) {
    const elemento = mostrarPaginaDe(alvo);
    if (!elemento) return;
    elemento.scrollIntoView({ behavior: reduzMovimento() ? 'auto' : 'smooth', block: 'start' });
    const titulo = elemento.querySelector ? elemento.querySelector('.secao__titulo') : null;
    if (titulo) {
      if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1');
      try {
        titulo.focus({ preventScroll: true });
      } catch (erro) {
        titulo.focus();
      }
    }
  }

  function visivel(id) {
    const elemento = refs.ficha.querySelector('[data-pagina="' + id + '"]');
    return Boolean(elemento) && !elemento.hasAttribute('data-oculta') && elemento.getClientRects().length > 0;
  }

  function mudarPor(delta) {
    const posicao = PAGINAS.findIndex(function (p) { return p.id === atual(); });
    const destino = PAGINAS[posicao + delta];
    if (destino) ir(destino.id, { foco: true });
  }

  /* ------------------------------------------------------------------------
     Eventos
     ------------------------------------------------------------------------ */

  function aoTeclarNasAbas(evento) {
    const teclas = { ArrowRight: 1, ArrowLeft: -1, Home: 'inicio', End: 'fim' };
    if (!(evento.key in teclas)) return;
    const abas = Array.prototype.slice.call(refs.abas.querySelectorAll('[role="tab"]'));
    const indice = abas.indexOf(document.activeElement);
    if (indice === -1) return;
    evento.preventDefault();
    let destino = indice;
    if (evento.key === 'Home') destino = 0;
    else if (evento.key === 'End') destino = abas.length - 1;
    else destino = (indice + teclas[evento.key] + abas.length) % abas.length;
    abas[destino].focus();
    ir(abas[destino].getAttribute('data-ir-pagina'), { anunciar: false });
  }

  // Deslizar para os lados troca de página (só no celular, e só se o gesto for claramente horizontal)
  function ligarGesto() {
    let inicio = null;
    function rolaParaOsLados(elemento) {
      let no = elemento;
      while (no && no !== refs.ficha) {
        if (no.scrollWidth > no.clientWidth + 4) {
          const o = getComputedStyle(no).overflowX;
          if (o === 'auto' || o === 'scroll') return true;
        }
        no = no.parentElement;
      }
      return false;
    }
    refs.ficha.addEventListener('touchstart', function (evento) {
      inicio = null;
      if (emComputador() || evento.touches.length !== 1) return;
      const alvo = evento.target;
      if (alvo.closest('input, textarea, select, dialog, [contenteditable], .seletor-atributo, .seletor-painel') || rolaParaOsLados(alvo)) return;
      inicio = { x: evento.touches[0].clientX, y: evento.touches[0].clientY };
    }, { passive: true });
    refs.ficha.addEventListener('touchend', function (evento) {
      if (!inicio || emComputador()) return;
      const fim = evento.changedTouches[0];
      const dx = fim.clientX - inicio.x;
      const dy = fim.clientY - inicio.y;
      inicio = null;
      if (Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
      mudarPor(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     Teclado: links de pulo (vitais, perícias, páginas) e atalhos 1…9, [ e ]
     ------------------------------------------------------------------------ */

  function digitando(alvo) {
    return Boolean(alvo) && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));
  }

  function focar(elemento) {
    if (!elemento) return;
    if (!elemento.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(elemento.tagName)) elemento.setAttribute('tabindex', '-1');
    try {
      elemento.focus({ preventScroll: false });
    } catch (erro) {
      elemento.focus();
    }
  }

  function pular(destino) {
    const computador = emComputador();
    if (destino === 'vitais') {
      const botao = refs.ficha.querySelector('[data-abrir-vital="pv"]');
      focar(botao);
    } else if (destino === 'pericias') {
      if (!computador) ir('pericias', { anunciar: false, rolar: false });
      focar(document.getElementById('busca-pericias'));
    } else if (destino === 'abas') {
      if (computador) focar(refs.abas.querySelector('[aria-selected="true"]'));
      else focar(refs.dockIndice);
    } else if (destino === 'pagina') {
      focarPagina(atual());
    }
  }

  function aoTeclarNaFicha(evento) {
    if (document.body.dataset.vista !== 'ficha') return;
    if (evento.ctrlKey || evento.metaKey || evento.altKey || digitando(evento.target)) return;
    if (document.querySelector('dialog[open]')) return;
    let id = null;
    if (/^[1-9]$/.test(evento.key)) {
      // A numeração é a do índice (1 Resumo … 9 Rolagens), igual no computador e no celular
      const pagina = PAGINAS[Number(evento.key) - 1];
      if (pagina && emComputador() && !pagina.aba) {
        // Resumo e Perícias já estão à vista no computador: o foco vai para lá
        evento.preventDefault();
        pular(pagina.id === 'resumo' ? 'vitais' : 'pericias');
        return;
      }
      if (pagina) id = pagina.id;
    } else if (evento.key === '[' || evento.key === ']') {
      evento.preventDefault();
      const lista = emComputador() ? PAGINAS.filter(function (p) { return p.aba; }) : PAGINAS;
      const posicao = lista.findIndex(function (p) { return p.id === atual(); });
      const destino = lista[posicao + (evento.key === ']' ? 1 : -1)];
      if (destino) ir(destino.id, { foco: true });
      return;
    }
    if (!id) return;
    evento.preventDefault();
    ir(id, { foco: true });
  }

  function montar() {
    refs.ficha = document.getElementById('ficha');
    refs.abas = document.getElementById('abas-paginas');
    refs.paginas = document.getElementById('paginas');
    refs.indice = document.getElementById('paginas-indice');
    refs.dialogo = document.getElementById('dialogo-paginas');
    refs.dockIndice = document.getElementById('dock-indice');
    refs.dockNome = document.getElementById('dock-nome');
    refs.dockContador = document.getElementById('dock-contador');
    refs.dockSetas = Array.prototype.slice.call(document.querySelectorAll('[data-pagina-delta]'));
    if (!refs.ficha || !refs.abas || !refs.indice) return;

    montarAbas();
    montarIndice();

    refs.abas.addEventListener('click', function (evento) {
      const aba = evento.target.closest('[data-ir-pagina]');
      if (aba) ir(aba.getAttribute('data-ir-pagina'), { anunciar: false });
    });
    refs.abas.addEventListener('keydown', aoTeclarNasAbas);
    const trilhoAgente = document.getElementById('trilho-agente');
    if (trilhoAgente) trilhoAgente.addEventListener('click', function () { ir('agente', { foco: true }); });
    refs.dockSetas.forEach(function (seta) {
      seta.addEventListener('click', function () { mudarPor(Number(seta.getAttribute('data-pagina-delta'))); });
    });
    refs.dockIndice.addEventListener('click', function () {
      if (OP.ui.abrirDialogo) OP.ui.abrirDialogo(refs.dialogo, refs.dockIndice);
    });
    refs.indice.addEventListener('click', function (evento) {
      const botao = evento.target.closest('[data-ir-pagina]');
      if (!botao) return;
      const id = botao.getAttribute('data-ir-pagina');
      refs.dialogo.close();
      ir(id, { foco: false });
      // o foco volta ao botão-índice ao fechar a folha; depois disso vai para a página
      window.setTimeout(function () { focarPagina(id); }, 0);
    });
    refs.dialogo.addEventListener('click', function (evento) {
      if (evento.target.closest('[data-fechar-dialogo]') || evento.target === refs.dialogo) refs.dialogo.close();
    });

    consulta = window.matchMedia ? window.matchMedia('(min-width: ' + LARGURA_COMPUTADOR + 'px)') : null;
    if (consulta) {
      const aoMudar = function () { aplicar(); };
      if (consulta.addEventListener) consulta.addEventListener('change', aoMudar);
      else if (consulta.addListener) consulta.addListener(aoMudar);
    }

    ligarGesto();

    Array.prototype.forEach.call(document.querySelectorAll('[data-pular]'), function (link) {
      link.addEventListener('click', function (evento) {
        evento.preventDefault(); // não mexe no #hash (ele guarda a rota)
        pular(link.getAttribute('data-pular'));
      });
    });
    document.addEventListener('keydown', aoTeclarNaFicha);

    // A legenda dos ícones é um balão: fecha ao clicar fora ou com Esc
    document.addEventListener('click', function (evento) {
      Array.prototype.forEach.call(document.querySelectorAll('.legenda-ic[open]'), function (d) {
        if (!d.contains(evento.target)) d.open = false;
      });
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key !== 'Escape') return;
      Array.prototype.forEach.call(document.querySelectorAll('.legenda-ic[open]'), function (d) {
        d.open = false;
        const resumo = d.querySelector('summary');
        if (resumo) resumo.focus();
      });
    });

    // Indício de "tem mais embaixo": as zonas que rolam por dentro ganham um esmaecido no pé
    const rolantes = [refs.ficha.querySelector('.zona--esq'), refs.ficha.querySelector('.zona--per'), refs.paginas].filter(Boolean);
    function marcarRolagem(elemento) {
      const mais = elemento.scrollTop + elemento.clientHeight < elemento.scrollHeight - 6;
      if (elemento.getAttribute('data-mais') !== String(mais)) elemento.setAttribute('data-mais', String(mais));
    }
    rolantes.forEach(function (elemento) {
      elemento.addEventListener('scroll', function () { marcarRolagem(elemento); }, { passive: true });
      if ('ResizeObserver' in window) {
        const obs = new ResizeObserver(function () { marcarRolagem(elemento); });
        obs.observe(elemento);
        Array.prototype.forEach.call(elemento.children, function (filho) { obs.observe(filho); });
      }
    });

    // Imprimir: as seções recolhidas (Defesa) abrem para sair no papel; depois voltam como estavam
    let abertasAntes = [];
    window.addEventListener('beforeprint', function () {
      abertasAntes = Array.prototype.filter.call(document.querySelectorAll('details.defesa-detalhes'), function (d) { return d.open; });
      Array.prototype.forEach.call(document.querySelectorAll('details.defesa-detalhes'), function (d) { d.open = true; });
    });
    window.addEventListener('afterprint', function () {
      Array.prototype.forEach.call(document.querySelectorAll('details.defesa-detalhes'), function (d) { d.open = abertasAntes.indexOf(d) !== -1; });
    });

    // O número de condições ativas aparece na aba/índice de Combate
    OP.ui.registrarExtensao({
      desenhar: function (ficha) {
        const total = ficha && ficha.condicoes && Array.isArray(ficha.condicoes.ativas) ? ficha.condicoes.ativas.length : 0;
        if (total !== estado.condicoes) {
          estado.condicoes = total;
          aplicar();
        }
      }
    });

    aplicar();
  }

  OP.uiPaginas = {
    montar: montar,
    ir: ir,
    irParaSecao: irParaSecao,
    mostrarPaginaDe: mostrarPaginaDe,
    visivel: visivel,
    atual: atual,
    paginas: PAGINAS
  };
})(window.OP);
