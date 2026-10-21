/* ==========================================================================
   js/atmosfera.js — fundos animados por tema elemental (OP.atmosfera)
   --------------------------------------------------------------------------
   Cada tema da ficha pode ter um fundo animado próprio, desenhado num <canvas>
   dentro da #atmosfera. Por enquanto só o de Conhecimento existe: sigilos da
   fonte "Sigilos de Conhecimento" (só as letras A–Z e a–z) que sobem em
   colunas, como numa tela de hack, mudando de sigilo, surgindo e sumindo.
   SÓ APARÊNCIA: nada aqui lê ou muda dados da ficha.

   - criarSigilos(): a simulação, sem DOM (testável). Grade de células com
     brilho (0…1) e sigilo; "fluxos" sobem uma linha por passo acendendo
     células; o brilho cai sozinho e o sigilo muda de vez em quando.
   - O desenho usa um atlas dos 52 sigilos pré-pintados na cor do tema
     (--acento): escuro = dourado com brilho, claro = tinta marrom, sem brilho.
   - Só roda com a ficha na tela, tema Conhecimento, aba visível e fora do
     alto contraste. Com movimento reduzido (sistema ou Aparência) pinta um
     quadro parado. Fora da ficha a animação para.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const FAMILIA = 'Sigilos de Conhecimento';
  const QUADROS_POR_SEGUNDO = 30;
  const TROCA_DE_SIGILO = 2.2;  // chance por segundo de uma célula acesa trocar de sigilo
  const LIMITE_CABECA = 0.92;   // acima disso a célula é a "cabeça" do fluxo (mais clara)

  /* ------------------------------------------------------------------------
     Simulação
     ------------------------------------------------------------------------ */

  /**
   * Grade de colunas × filas. aleatorio: função 0…1 (padrão Math.random; os
   * testes passam uma fixa). Devolve { brilho, sigilo, fluxos, passo, popular }.
   */
  function criarSigilos(colunas, filas, aleatorio) {
    const rnd = aleatorio || Math.random;
    const total = colunas * filas;
    const brilho = new Float32Array(total);
    const queda = new Float32Array(total); // brilho perdido por segundo
    const sigilo = new Uint8Array(total);  // índice em LETRAS
    const fluxos = [];
    let faiscas = 0;

    function entre(a, b) { return a + (b - a) * rnd(); }
    function sortear() { return Math.floor(rnd() * LETRAS.length) % LETRAS.length; }

    function acender(coluna, fila, forca, duracao) {
      const i = fila * colunas + coluna;
      brilho[i] = forca;
      queda[i] = forca / duracao;
      sigilo[i] = sortear();
    }

    function alvoDeFluxos() { return Math.max(3, Math.round(colunas * 0.45)); }

    /** Um fluxo sobe uma fila por "cadência"; some ao sair pelo alto ou ao esgotar o comprimento. */
    function novoFluxo(fila) {
      fluxos.push({
        coluna: Math.floor(rnd() * colunas) % colunas,
        fila: fila,
        cadencia: entre(0.07, 0.3),
        relogio: 0,
        restante: Math.round(entre(8, 40)),
        duracao: entre(1.2, 3.4) // quanto o rastro leva para apagar
      });
    }

    function passo(dt) {
      // Fluxos sobem
      for (let f = fluxos.length - 1; f >= 0; f--) {
        const fluxo = fluxos[f];
        fluxo.relogio += dt;
        while (fluxo.relogio >= fluxo.cadencia && fluxo.restante > 0 && fluxo.fila >= 0) {
          fluxo.relogio -= fluxo.cadencia;
          fluxo.fila -= 1;
          if (fluxo.fila >= 0 && fluxo.fila < filas) {
            acender(fluxo.coluna, fluxo.fila, 1, fluxo.duracao);
            fluxo.restante -= 1;
          }
        }
        if (fluxo.restante <= 0 || fluxo.fila < 0) fluxos.splice(f, 1);
      }

      // O brilho cai; enquanto há brilho, o sigilo muda
      const chance = dt * TROCA_DE_SIGILO;
      for (let i = 0; i < total; i++) {
        const b = brilho[i];
        if (b <= 0) continue;
        const novo = b - queda[i] * dt;
        if (novo <= 0) {
          brilho[i] = 0;
        } else {
          brilho[i] = novo;
          if (rnd() < chance) sigilo[i] = sortear();
        }
      }

      // Fluxos novos nascem abaixo da tela, mais depressa quanto mais faltam
      const falta = alvoDeFluxos() - fluxos.length;
      if (falta > 0 && rnd() < Math.min(1, dt * falta * 0.6)) novoFluxo(filas + Math.floor(entre(0, 6)));

      // Faíscas: sigilos soltos que surgem e somem
      faiscas += dt * total * 0.006;
      while (faiscas >= 1) {
        faiscas -= 1;
        acender(Math.floor(rnd() * colunas) % colunas, Math.floor(rnd() * filas) % filas, entre(0.35, 0.8), entre(0.8, 2.2));
      }
    }

    /** Estado inicial: fluxos espalhados pela tela e alguns segundos já rodados. */
    function popular() {
      for (let n = alvoDeFluxos(); n > 0; n--) novoFluxo(Math.floor(entre(0, filas)));
      for (let t = 0; t < 60; t++) passo(0.1);
    }

    return { colunas: colunas, filas: filas, brilho: brilho, sigilo: sigilo, fluxos: fluxos, passo: passo, popular: popular };
  }

  /* ------------------------------------------------------------------------
     Desenho (fundo de Conhecimento)
     ------------------------------------------------------------------------ */

  const refs = {};
  const fundo = {
    sim: null,
    ctx: null,
    atlas: null,       // { corpo, cabeca, passo, folga, celula }
    cores: '',         // "corpo|cabeca|claro" do último atlas (para saber quando refazer)
    colunas: 0,
    filas: 0,
    rodando: false,
    quadro: 0,
    ultimo: 0,
    ultimaCor: 0,
    fonteOk: false,
    carregandoFonte: false,
    parada: 0          // temporizador que desliga a animação depois que o fundo some
  };

  function reduzMovimento() {
    return OP.uiApp ? OP.uiApp.reduzMovimento() : Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** O fundo de Conhecimento está (ou vai estar) à vista? */
  function visivel() {
    return document.body.dataset.vista === 'ficha' &&
      refs.atmosfera.getAttribute('data-elemento') === 'conhecimento' &&
      document.documentElement.getAttribute('data-tema') !== 'contraste';
  }

  /** Cores do tema agora: --acento (corpo), --acento-claro (cabeça) e se o tema do site é claro. */
  function lerCores() {
    const estilo = getComputedStyle(refs.canvas);
    const corpo = estilo.getPropertyValue('--acento').trim() || estilo.color;
    const cabeca = estilo.getPropertyValue('--acento-claro').trim() || corpo;
    const claro = parseFloat(estilo.getPropertyValue('--claro')) >= 0.5;
    return { corpo: corpo, cabeca: cabeca, claro: claro };
  }

  /** Pinta os 52 sigilos, um por casa do atlas, centrados pelo traço de cada um. */
  function pintarAtlas(cores, celula) {
    const folga = Math.round(celula * 0.35); // margem para o brilho não ser cortado
    const passo = celula + folga * 2;
    const fonte = celula * 0.86;

    function folha(cor, brilho) {
      const tela = document.createElement('canvas');
      tela.width = passo * LETRAS.length;
      tela.height = passo;
      const c = tela.getContext('2d');
      c.font = fonte + 'px "' + FAMILIA + '"';
      c.textBaseline = 'alphabetic';
      c.fillStyle = cor;
      for (let n = 0; n < LETRAS.length; n++) {
        const m = c.measureText(LETRAS[n]);
        const largura = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
        const altura = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
        const escala = Math.min(1, (celula * 0.94) / Math.max(largura, 1), (celula * 0.94) / Math.max(altura, 1));
        c.save();
        c.translate(n * passo + passo / 2, passo / 2);
        c.scale(escala, escala);
        const x = -(m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
        const y = -(m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
        if (brilho) {
          c.shadowColor = cor;
          c.shadowBlur = celula * 0.3;
          c.fillText(LETRAS[n], x, y);
        }
        c.shadowBlur = 0;
        c.fillText(LETRAS[n], x, y);
        c.restore();
      }
      return tela;
    }

    return {
      corpo: folha(cores.corpo, false),
      cabeca: folha(cores.cabeca, !cores.claro), // só o escuro brilha
      passo: passo,
      folga: folga,
      celula: celula
    };
  }

  /** Refaz o atlas se a cor do tema (ou claro/escuro) mudou desde a última vez. */
  function atualizarCores() {
    if (!fundo.fonteOk || !fundo.atlas) return;
    const cores = lerCores();
    const chave = [cores.corpo, cores.cabeca, cores.claro].join('|');
    if (chave === fundo.cores) return;
    fundo.cores = chave;
    fundo.atlas = pintarAtlas(cores, fundo.atlas.celula);
  }

  /** Mede a tela e refaz a grade e o atlas. Devolve false se o canvas ainda não tem tamanho. */
  function medir() {
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    if (!largura || !altura) return false;
    const base = largura < 600 ? 26 : 32;
    const colunas = Math.max(4, Math.round(largura / base));
    const celulaCss = largura / colunas;
    const filas = Math.ceil(altura / celulaCss);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const celula = Math.round(celulaCss * dpr);
    if (fundo.sim && colunas === fundo.colunas && filas === fundo.filas && fundo.atlas && celula === fundo.atlas.celula) return true;

    fundo.colunas = colunas;
    fundo.filas = filas;
    refs.canvas.width = colunas * celula;
    refs.canvas.height = filas * celula;
    refs.canvas.style.width = (colunas * celula / dpr) + 'px';
    refs.canvas.style.height = (filas * celula / dpr) + 'px';
    fundo.ctx = refs.canvas.getContext('2d');
    const cores = lerCores();
    fundo.cores = [cores.corpo, cores.cabeca, cores.claro].join('|');
    fundo.atlas = pintarAtlas(cores, celula);
    fundo.sim = criarSigilos(colunas, filas);
    fundo.sim.popular();
    return true;
  }

  function desenhar() {
    const ctx = fundo.ctx;
    const sim = fundo.sim;
    const atlas = fundo.atlas;
    if (!ctx || !sim || !atlas || !atlas.corpo) return;
    ctx.clearRect(0, 0, refs.canvas.width, refs.canvas.height);
    const { colunas, brilho, sigilo } = sim;
    const celula = atlas.celula;
    for (let i = 0; i < brilho.length; i++) {
      const b = brilho[i];
      if (b <= 0.02) continue;
      const coluna = i % colunas;
      const fila = (i - coluna) / colunas;
      const cabeca = b > LIMITE_CABECA;
      ctx.globalAlpha = cabeca ? 1 : Math.pow(b, 1.4);
      ctx.drawImage(
        cabeca ? atlas.cabeca : atlas.corpo,
        sigilo[i] * atlas.passo, 0, atlas.passo, atlas.passo,
        coluna * celula - atlas.folga, fila * celula - atlas.folga, atlas.passo, atlas.passo
      );
    }
    ctx.globalAlpha = 1;
  }

  function aCadaQuadro(agora) {
    fundo.quadro = requestAnimationFrame(aCadaQuadro);
    const dt = (agora - fundo.ultimo) / 1000;
    if (dt < 0.9 / QUADROS_POR_SEGUNDO) return;
    fundo.ultimo = agora;
    if (agora - fundo.ultimaCor > 500) { // a cor desliza na troca de tema: acompanha
      fundo.ultimaCor = agora;
      atualizarCores();
    }
    fundo.sim.passo(Math.min(dt, 0.1));
    desenhar();
  }

  function iniciarAnimacao() {
    if (fundo.rodando) return;
    fundo.rodando = true;
    fundo.ultimo = performance.now();
    fundo.quadro = requestAnimationFrame(aCadaQuadro);
  }

  function pararAnimacao() {
    fundo.rodando = false;
    cancelAnimationFrame(fundo.quadro);
  }

  /** Carrega a fonte uma vez; só então o fundo pode ser pintado. */
  function carregarFonte() {
    if (fundo.fonteOk || fundo.carregandoFonte) return;
    if (!document.fonts || typeof document.fonts.load !== 'function') return;
    fundo.carregandoFonte = true;
    document.fonts.load('32px "' + FAMILIA + '"', LETRAS).then(function (lista) {
      fundo.carregandoFonte = false;
      fundo.fonteOk = lista.length > 0;
      if (fundo.fonteOk) sincronizar();
    }, function () {
      fundo.carregandoFonte = false;
    });
  }

  /**
   * Liga, para ou repinta o fundo conforme o estado da página. Chamada a cada
   * mudança que importa (tela, tema da ficha, aparência do site, movimento,
   * aba visível, tamanho da janela).
   */
  function sincronizar() {
    if (!refs.canvas) return;
    if (!visivel() || document.hidden) {
      // O fundo some com um fade (CSS): a animação só para depois dele
      if (fundo.rodando && !fundo.parada) {
        fundo.parada = setTimeout(function () {
          fundo.parada = 0;
          if (!visivel() || document.hidden) pararAnimacao();
        }, 700);
      }
      return;
    }
    clearTimeout(fundo.parada);
    fundo.parada = 0;
    if (!fundo.fonteOk) { carregarFonte(); return; }
    if (!medir()) return;
    atualizarCores();
    if (reduzMovimento()) {
      pararAnimacao();
      desenhar();
    } else {
      iniciarAnimacao();
    }
  }

  function montar() {
    refs.atmosfera = document.getElementById('atmosfera');
    refs.canvas = document.getElementById('atmosfera-sigilos');
    if (!refs.atmosfera || !refs.canvas || typeof refs.canvas.getContext !== 'function') return;

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
    montar: montar,
    sincronizar: sincronizar,
    criarSigilos: criarSigilos,
    LETRAS: LETRAS
  };
})(window.OP);
