/* ==========================================================================
   js/ui-verificacoes.js — painel "Verificações (N)" (OP.uiVerificacoes)
   --------------------------------------------------------------------------
   Mostra a lista de OP.calc.verificarFicha(ficha): avisos que NÃO bloqueiam
   nada. Atualiza ao mudar a ficha, com espera de 250 ms (debounce). A
   contagem fica numa região aria-live="polite". Cada linha tem "Ir ao campo",
   que rola até o campo e dá foco. Some em "modo livre" (a lista vem vazia).
   Textos entram só por textContent.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const ESPERA = 250; // ms
  const refs = {};
  let temporizador = null;
  let assinatura = '';
  let ultimaFicha = null;

  function reduzMovimento() {
    return OP.uiApp ? OP.uiApp.reduzMovimento() : Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function criar(tag, classe, texto) {
    return OP.ui.criarElemento(tag, classe, texto);
  }

  function criarLinha(item) {
    const linha = criar('li', 'verificacao verificacao--' + item.severidade);
    const icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icone.setAttribute('class', 'icone-ui verificacao__icone');
    icone.setAttribute('aria-hidden', 'true');
    icone.setAttribute('focusable', 'false');
    const uso = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    uso.setAttribute('href', item.severidade === 'info' ? '#ic-info' : '#ic-estado-2');
    icone.appendChild(uso);
    linha.appendChild(icone);

    const texto = criar('span', 'verificacao__texto');
    texto.appendChild(criar('strong', '', item.severidade === 'info' ? 'Info: ' : 'Aviso: '));
    texto.appendChild(document.createTextNode(item.mensagem));
    linha.appendChild(texto);

    const botao = criar('button', 'botao botao--pequeno botao--fantasma', 'Ir ao campo');
    botao.type = 'button';
    botao.setAttribute('aria-label', 'Ir ao campo: ' + item.mensagem);
    botao.addEventListener('click', function () { irAoCampo(item); });
    linha.appendChild(botao);
    return linha;
  }

  function abrirDetalhesAncestrais(elemento) {
    let d = elemento.closest('details');
    while (d) {
      d.open = true;
      d = d.parentElement ? d.parentElement.closest('details') : null;
    }
  }

  function visivel(elemento) {
    return Boolean(elemento) && elemento.getClientRects().length > 0;
  }

  /** Rola até o campo e dá foco; sem campo visível, vai para a seção. */
  function irAoCampo(item) {
    let alvo = item.campo ? document.getElementById(item.campo) : null;
    // Aviso de um item do inventário: abre o cartão dele
    if (!alvo && item.ref && OP.uiItens && OP.uiItens.mostrar && OP.uiItens.mostrar(String(item.ref))) return;
    if (!alvo && item.ref) {
      const linha = document.querySelector('[data-pericia="' + String(item.ref).replace(/[^A-Za-z0-9_-]/g, '') + '"]');
      alvo = linha ? linha.querySelector('select, input, button') : null;
    }
    if (alvo && OP.uiPaginas) OP.uiPaginas.mostrarPaginaDe(alvo); // abre a página onde o campo mora
    if (alvo) abrirDetalhesAncestrais(alvo);
    // Atributos na mesa: o campo só aparece em "Editar atributos"
    if (alvo && !visivel(alvo) && /^atr-/.test(item.campo || '')) {
      const modo = document.getElementById('botao-modo-atributos');
      if (modo && modo.getAttribute('aria-pressed') !== 'true') modo.click();
    }
    if (alvo && visivel(alvo)) {
      alvo.scrollIntoView({ behavior: reduzMovimento() ? 'auto' : 'smooth', block: 'center' });
      try {
        alvo.focus({ preventScroll: true });
      } catch (erro) {
        alvo.focus();
      }
      return;
    }
    if (OP.uiDossie) OP.uiDossie.irParaSecao('secao-' + item.secao);
  }

  function desenharAgora() {
    temporizador = null;
    const ficha = OP.state.ficha;
    if (!refs.painel || !ficha) return;
    const lista = OP.calc.verificarFicha(ficha);
    const nova = JSON.stringify(lista);
    if (nova === assinatura) return;
    assinatura = nova;
    OP.ui.substituirFilhos(refs.lista, lista.map(criarLinha));
    const total = String(lista.length);
    if (refs.contagem.textContent !== total) refs.contagem.textContent = total;
    refs.painel.hidden = lista.length === 0;
  }

  /** Agenda a atualização (250 ms depois da última mudança). Trocar de ficha atualiza na hora. */
  function agendar(ficha) {
    if (temporizador !== null) clearTimeout(temporizador);
    if (ficha !== ultimaFicha) {
      ultimaFicha = ficha;
      assinatura = '';
      desenharAgora();
      return;
    }
    temporizador = setTimeout(desenharAgora, ESPERA);
  }

  function montar() {
    refs.painel = document.getElementById('verificacoes');
    refs.contagem = document.getElementById('verificacoes-contagem');
    refs.lista = document.getElementById('verificacoes-lista');
    if (!refs.painel) return;
    OP.ui.registrarExtensao({
      desenhar: function (ficha) {
        // a identidade da ficha muda ao abrir outra: id diferente → atualiza na hora
        agendar(ficha.id || ficha);
      }
    });
  }

  OP.uiVerificacoes = {
    montar: montar,
    atualizarAgora: function () {
      if (temporizador !== null) clearTimeout(temporizador);
      assinatura = '';
      desenharAgora();
    }
  };
})(window.OP);
