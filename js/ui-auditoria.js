/* ==========================================================================
   js/ui-auditoria.js — auditorias de layout, contraste e acessibilidade
   --------------------------------------------------------------------------
   Funções para conferir a tela (chamadas pelo OP.runTests() e, se quiser,
   direto no console). Nenhuma altera a ficha:
   - OP.ui.auditarLayout()         elementos que passam da largura da janela;
   - OP.ui.auditarContraste(tema)  pares de cor abaixo do mínimo no tema;
   - OP.ui.auditarAcessibilidade() controles/imagens sem nome e <dialog> sem título;
   - OP.ui.auditarTitulos()        saltos de nível nos títulos (h1…h6);
   - OP.ui.auditarAlvosToque()     alvos de toque menores que 44 × 44 px.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  function todos(seletor, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(seletor));
  }

  /** Texto curto para descrever um elemento (para mensagens do teste). */
  function descrever(elemento) {
    const id = elemento.id ? '#' + elemento.id : '';
    const classes = typeof elemento.className === 'string' && elemento.className.trim()
      ? '.' + elemento.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return elemento.tagName.toLowerCase() + id + classes;
  }

  /* ------------------------------------------------------------------------
     Layout
     ------------------------------------------------------------------------ */

  /** Está dentro de um bloco com rolagem horizontal própria (overflow-x: auto ou scroll)? */
  function dentroDeRolagemHorizontal(elemento) {
    let pai = elemento.parentElement;
    while (pai && pai !== document.body) {
      const o = getComputedStyle(pai).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
      pai = pai.parentElement;
    }
    return false;
  }

  /** Escondido de verdade (cortado por um pai minúsculo, como o texto só para leitores de tela)? */
  function recortado(elemento) {
    let atual = elemento;
    while (atual && atual !== document.body) {
      const r = atual.getBoundingClientRect();
      const cs = getComputedStyle(atual);
      if ((r.width <= 2 || r.height <= 2) && cs.overflow !== 'visible') return true;
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)') return true;
      atual = atual.parentElement;
    }
    return false;
  }

  /**
   * Elementos que passam da largura da janela (right > innerWidth + 1),
   * ignorando os que ficam dentro de um bloco com overflow-x: auto/scroll,
   * os de posição fixa e os escondidos (visualmente-oculto).
   */
  function auditarLayout() {
    const largura = window.innerWidth;
    return todos('body *').filter(function (elemento) {
      const r = elemento.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= largura + 1) return false;
      const cs = getComputedStyle(elemento);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return false;
      if (elemento.closest('svg') && elemento.tagName.toLowerCase() !== 'svg') return false;
      if (dentroDeRolagemHorizontal(elemento) || recortado(elemento)) return false;
      return true;
    });
  }

  /* ------------------------------------------------------------------------
     Contraste
     ------------------------------------------------------------------------ */

  /**
   * Confere os pares de OP.data.paresContraste num tema ("auto", "escuro",
   * "claro" ou "contraste"): define data-tema no <html> por um instante, lê
   * as variáveis com getComputedStyle e restaura. Devolve os pares abaixo do
   * mínimo: [{ tema, a, b, corA, corB, razao, minimo }].
   */
  function auditarContraste(temaId) {
    const raiz = document.documentElement;
    const antes = raiz.getAttribute('data-tema');
    const falhas = [];
    try {
      if (temaId === 'auto') raiz.removeAttribute('data-tema');
      else raiz.setAttribute('data-tema', temaId);
      const estilo = getComputedStyle(raiz);
      OP.data.paresContraste.forEach(function (par) {
        const corA = estilo.getPropertyValue(par.a).trim();
        const corB = estilo.getPropertyValue(par.b).trim();
        const razao = OP.calc.contrasteWCAG(corA, corB);
        const minimo = temaId === 'contraste' ? par.minimoAlto : par.minimo;
        if (razao === null || razao < minimo) {
          falhas.push({ tema: temaId, a: par.a, b: par.b, corA: corA, corB: corB, razao: razao === null ? null : Math.round(razao * 100) / 100, minimo: minimo });
        }
      });
    } finally {
      if (antes === null) raiz.removeAttribute('data-tema');
      else raiz.setAttribute('data-tema', antes);
    }
    return falhas;
  }

  /* ------------------------------------------------------------------------
     Acessibilidade
     ------------------------------------------------------------------------ */

  function textoDosIds(lista) {
    return String(lista || '').split(/\s+/).map(function (id) {
      const alvo = id ? document.getElementById(id) : null;
      return alvo ? alvo.textContent : '';
    }).join(' ').trim();
  }

  /** Texto visível de um elemento, sem ícones (svg) escondidos. */
  function textoSemIcones(elemento) {
    const copia = elemento.cloneNode(true);
    copia.querySelectorAll('svg, [aria-hidden="true"]').forEach(function (no) { no.remove(); });
    return copia.textContent.replace(/\s+/g, ' ').trim();
  }

  /** O controle tem nome acessível (aria-labelledby, aria-label, rótulo, texto ou title)? */
  function temNome(elemento) {
    if (textoDosIds(elemento.getAttribute('aria-labelledby'))) return true;
    if ((elemento.getAttribute('aria-label') || '').trim()) return true;
    const tag = elemento.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      const rotulos = elemento.labels ? Array.prototype.slice.call(elemento.labels) : [];
      if (rotulos.some(function (rotulo) { return textoSemIcones(rotulo).length > 0; })) return true;
    }
    if (tag === 'button' || (tag === 'input' && /^(button|submit|reset)$/.test(elemento.type))) {
      if (textoSemIcones(elemento).length > 0 || (elemento.value || '').trim()) return true;
    }
    return (elemento.getAttribute('title') || '').trim().length > 0;
  }

  /**
   * Controles sem nome acessível, imagens sem alt e <dialog> sem título.
   * Devolve [{ tipo, elemento, motivo }]. Ignora o que está escondido de leitores
   * de tela (aria-hidden) e os campos type="hidden".
   */
  function auditarAcessibilidade() {
    const problemas = [];
    todos('input, select, textarea, button, img, a[href]').forEach(function (elemento) {
      if (elemento.closest('[aria-hidden="true"]') || elemento.type === 'hidden') return;
      const tag = elemento.tagName.toLowerCase();
      if (tag === 'img') {
        if (!elemento.hasAttribute('alt')) problemas.push({ tipo: 'imagem', elemento: elemento, motivo: 'sem alt' });
        return;
      }
      if (tag === 'a') {
        if (!textoSemIcones(elemento) && !temNome(elemento)) problemas.push({ tipo: 'link', elemento: elemento, motivo: 'sem texto' });
        return;
      }
      if (!temNome(elemento)) {
        problemas.push({ tipo: tag === 'button' ? 'botão' : 'campo', elemento: elemento, motivo: 'sem nome acessível' });
      }
    });
    todos('dialog').forEach(function (dialogo) {
      const titulo = textoDosIds(dialogo.getAttribute('aria-labelledby')) || (dialogo.getAttribute('aria-label') || '').trim();
      if (!titulo) problemas.push({ tipo: 'diálogo', elemento: dialogo, motivo: 'sem título (aria-labelledby)' });
    });
    todos('[tabindex]').forEach(function (elemento) {
      if (Number(elemento.getAttribute('tabindex')) > 0) problemas.push({ tipo: 'foco', elemento: elemento, motivo: 'tabindex positivo' });
    });
    return problemas;
  }

  /** Saltos de nível nos títulos, na ordem do documento: [{ elemento, de, para }]. */
  function auditarTitulos() {
    const saltos = [];
    let anterior = 0;
    todos('h1, h2, h3, h4, h5, h6').forEach(function (titulo) {
      const nivel = Number(titulo.tagName.charAt(1));
      if (anterior && nivel > anterior + 1) saltos.push({ elemento: titulo, de: anterior, para: nivel });
      anterior = nivel;
    });
    return saltos;
  }

  /** Alvos de toque visíveis com menos de 44 × 44 px: [{ elemento, largura, altura }]. */
  function auditarAlvosToque() {
    const pequenos = [];
    todos('button, a[href], input:not([type="hidden"]), select, summary, [role="button"]').forEach(function (elemento) {
      if (elemento.closest('[aria-hidden="true"]') || recortado(elemento)) return;
      const r = elemento.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // botão de texto dentro de uma frase (alvo em linha) e o link "Ir para o conteúdo" (só aparece no foco)
      if (getComputedStyle(elemento).display === 'inline' || elemento.classList.contains('pular') || elemento.classList.contains('link')) return;
      // caixas de marcação: o alvo é o rótulo
      const alvo = (elemento.type === 'checkbox' || elemento.type === 'radio') && elemento.closest('label') ? elemento.closest('label') : elemento;
      const ra = alvo.getBoundingClientRect();
      if (ra.width < 43.5 || ra.height < 43.5) pequenos.push({ elemento: elemento, largura: Math.round(ra.width), altura: Math.round(ra.height) });
    });
    return pequenos;
  }

  OP.ui = OP.ui || {};
  OP.ui.auditarLayout = auditarLayout;
  OP.ui.auditarContraste = auditarContraste;
  OP.ui.auditarAcessibilidade = auditarAcessibilidade;
  OP.ui.auditarTitulos = auditarTitulos;
  OP.ui.auditarAlvosToque = auditarAlvosToque;
  OP.ui.descrever = descrever;
})(window.OP);
