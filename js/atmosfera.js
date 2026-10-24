/* ==========================================================================
   js/atmosfera.js — controlador dos fundos animados por tema (OP.atmosfera)
   --------------------------------------------------------------------------
   Cada tema elemental da ficha pode ter um fundo animado próprio, desenhado
   num <canvas> dentro da #atmosfera. Cada fundo mora no seu arquivo
   (js/atmosfera-conhecimento.js, js/atmosfera-morte.js…) e se registra aqui
   com OP.atmosfera.registrar({ tema, canvas, criar }). SÓ APARÊNCIA: nada
   disso lê ou muda dados da ficha.

   Um fundo (o que criar(canvas) devolve) tem:
   - quadros: quadros por segundo da animação (padrão 30);
   - preparar(): opcional; devolve uma Promise<boolean> (ex.: carregar a fonte);
   - ajustar(largura, altura): mede a tela e (re)cria o que precisar; false se
     ainda não dá para pintar;
   - cores(): relê as cores do tema e refaz o que depender delas;
   - passo(dt): avança a simulação; desenhar(): pinta um quadro.

   O controlador só liga o fundo com a ficha na tela, no tema dele, com a aba
   visível e fora do alto contraste. Com movimento reduzido (sistema ou
   Aparência) o fundo pinta um quadro parado. Fora da ficha a animação para.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const definicoes = [];
  const controles = [];
  const refs = {};

  function reduzMovimento() {
    return OP.uiApp ? OP.uiApp.reduzMovimento() : Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function registrar(definicao) {
    definicoes.push(definicao);
  }

  function criarControle(definicao) {
    const canvas = document.getElementById(definicao.canvas);
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    const fundo = definicao.criar(canvas);
    const intervalo = 0.9 / (fundo.quadros || 30);
    const estado = { pronto: !fundo.preparar, preparando: false, rodando: false, quadro: 0, ultimo: 0, ultimaCor: 0, parada: 0 };

    /** O fundo deste tema está (ou vai estar) à vista? */
    function visivel() {
      return document.body.dataset.vista === 'ficha' &&
        refs.atmosfera.getAttribute('data-elemento') === definicao.tema &&
        document.documentElement.getAttribute('data-tema') !== 'contraste';
    }

    function aCadaQuadro(agora) {
      estado.quadro = requestAnimationFrame(aCadaQuadro);
      const dt = (agora - estado.ultimo) / 1000;
      if (dt < intervalo) return;
      estado.ultimo = agora;
      if (agora - estado.ultimaCor > 500) { // a cor desliza na troca de tema: acompanha
        estado.ultimaCor = agora;
        fundo.cores();
      }
      fundo.passo(Math.min(dt, 0.1));
      fundo.desenhar();
    }

    function iniciar() {
      if (estado.rodando) return;
      estado.rodando = true;
      estado.ultimo = performance.now();
      estado.quadro = requestAnimationFrame(aCadaQuadro);
    }

    function parar() {
      estado.rodando = false;
      cancelAnimationFrame(estado.quadro);
    }

    function preparar() {
      if (estado.preparando) return;
      estado.preparando = true;
      fundo.preparar().then(function (ok) {
        estado.preparando = false;
        estado.pronto = Boolean(ok);
        if (estado.pronto) sincronizar();
      }, function () {
        estado.preparando = false;
      });
    }

    function sincronizar() {
      if (!visivel() || document.hidden) {
        // O fundo some com um fade (CSS): a animação só para depois dele
        if (estado.rodando && !estado.parada) {
          estado.parada = setTimeout(function () {
            estado.parada = 0;
            if (!visivel() || document.hidden) parar();
          }, 700);
        }
        return;
      }
      clearTimeout(estado.parada);
      estado.parada = 0;
      if (!estado.pronto) { preparar(); return; }
      if (!fundo.ajustar(window.innerWidth, window.innerHeight)) return;
      fundo.cores();
      if (reduzMovimento()) {
        parar();
        fundo.desenhar();
      } else {
        iniciar();
      }
    }

    return { sincronizar: sincronizar };
  }

  function sincronizar() {
    controles.forEach(function (controle) { controle.sincronizar(); });
  }

  function montar() {
    refs.atmosfera = document.getElementById('atmosfera');
    if (!refs.atmosfera) return;
    definicoes.forEach(function (definicao) {
      const controle = criarControle(definicao);
      if (controle) controles.push(controle);
    });
    if (!controles.length) return;

    const olhar = new MutationObserver(sincronizar);
    olhar.observe(document.body, { attributes: true, attributeFilter: ['data-vista'] });
    olhar.observe(refs.atmosfera, { attributes: true, attributeFilter: ['data-elemento'] });
    olhar.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema', 'data-movimento'] });
    document.addEventListener('visibilitychange', sincronizar);
    if (window.matchMedia) {
      ['(prefers-reduced-motion: reduce)', '(prefers-color-scheme: light)'].forEach(function (consulta) {
        const m = window.matchMedia(consulta);
        if (m.addEventListener) m.addEventListener('change', sincronizar);
      });
    }
    let esperando = 0;
    window.addEventListener('resize', function () {
      clearTimeout(esperando);
      esperando = setTimeout(sincronizar, 200);
    });
    sincronizar();
  }

  OP.atmosfera = {
    registrar: registrar,
    montar: montar,
    sincronizar: sincronizar
  };
})(window.OP);
