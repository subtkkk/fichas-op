/* ==========================================================================
   js/atmosfera-morte.js — fundo animado do tema Morte (OP.atmosfera.morte)
   --------------------------------------------------------------------------
   Espirais pretas que nascem de um ponto e crescem para fora, em linhas
   sinuosas e orgânicas. Umas crescem pouco, outras muito. Depois de um tempo
   somem, de dentro para fora. Ao chegar perto de outra espiral, a ponta
   desvia (e, encurralada, para de crescer). Controlado por js/atmosfera.js.

   - criarEspirais(): a simulação, sem DOM (testável). Cada espiral é uma
     trilha de pontos, de PASSO em PASSO px. A ponta anda como uma "tartaruga":
     vira um pouco a cada passo (mais devagar quanto maior o raio, o que faz a
     espiral abrir) e um ruído suave torna a linha orgânica. Uma grade de
     ocupação diz de quem é cada pedaço da tela; a ponta olha à frente e desvia
     do que é de outra espiral.
   - O desenho é uma faixa de espessura variável (fina na ponta e no começo
     que some). No escuro o preto quase não aparece sobre o fundo, então cada
     espiral ganha uma névoa e um fio de luz na cor do tema (--acento); no
     claro é tinta.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const PASSO = 4;              // distância entre pontos da trilha (px)
  const CELULA = 8;             // lado de uma célula da grade de ocupação (px)
  const DOIS_PI = Math.PI * 2;

  /* ------------------------------------------------------------------------
     Simulação
     ------------------------------------------------------------------------ */

  /**
   * Tela de largura × altura (px). aleatorio: função 0…1 (padrão Math.random;
   * os testes passam uma fixa). Devolve { espirais, dono, nascer, passo,
   * popular, nascimentos } — "nascimentos" false impede espirais novas por
   * conta própria (testes).
   */
  function criarEspirais(largura, altura, aleatorio) {
    const rnd = aleatorio || Math.random;
    const colunas = Math.ceil(largura / CELULA) + 1;
    const filas = Math.ceil(altura / CELULA) + 1;
    const dono = new Int32Array(colunas * filas);  // id da espiral que ocupa a célula (0 = livre)
    const marcas = new Uint16Array(colunas * filas); // quantos pontos do dono marcam a célula
    const espirais = [];
    const sim = { espirais: espirais, dono: dono, nascimentos: true, nascer: nascer, passo: passo, popular: popular, largura: largura, altura: altura };
    let proximoId = 1;

    function entre(a, b) { return a + (b - a) * rnd(); }

    function celulaDe(x, y) {
      const c = Math.floor(x / CELULA);
      const f = Math.floor(y / CELULA);
      return c < 0 || f < 0 || c >= colunas || f >= filas ? -1 : f * colunas + c;
    }

    /** Há, nesse ponto, algo de OUTRA espiral? */
    function ocupado(x, y, id) {
      const i = celulaDe(x, y);
      return i >= 0 && dono[i] !== 0 && dono[i] !== id;
    }

    /** A espiral reserva as 9 células em volta do ponto (guarda quais, para liberar depois). */
    function marcar(esp, x, y) {
      for (let df = -1; df <= 1; df++) {
        for (let dc = -1; dc <= 1; dc++) {
          const i = celulaDe(x + dc * CELULA, y + df * CELULA);
          if (i >= 0 && (dono[i] === 0 || dono[i] === esp.id)) {
            dono[i] = esp.id;
            marcas[i]++;
            esp.reservas.push(i);
          } else {
            esp.reservas.push(-1);
          }
        }
      }
    }

    /** Solta as reservas do ponto k (quando ele some). */
    function liberar(esp, k) {
      for (let j = k * 9; j < k * 9 + 9; j++) {
        const i = esp.reservas[j];
        if (i >= 0 && --marcas[i] === 0) dono[i] = 0;
      }
    }

    /** Suaviza o começo: 0 no centro, 1 depois da primeira volta (o ruído só entra com a espiral já aberta). */
    function entrada(theta) {
      const t = Math.max(0, Math.min(1, theta / DOIS_PI));
      return t * t * (3 - 2 * t);
    }

    /** Onde está a espiral no ângulo theta (acumulado): em volta de um centro que deriva um pouco, com raio que cresce a cada volta. */
    function posicao(esp, theta) {
      const ramp = entrada(theta);
      const ruido = Math.sin(theta * 1.7 + esp.f1) * 0.5 + Math.sin(theta * 3.1 + esp.f2) * 0.3 + Math.sin(theta * 0.6 + esp.f3) * 0.4;
      const raio = Math.max(2, esp.raioInicial + esp.afastamento * theta / DOIS_PI + (esp.desvio + esp.afastamento * 0.2 * ruido) * ramp);
      const angulo = esp.fase + esp.sentido * theta;
      const cx = esp.cx + esp.afastamento * 0.12 * Math.sin(theta * 0.37 + esp.f4) * ramp;
      const cy = esp.cy + esp.afastamento * 0.12 * Math.cos(theta * 0.31 + esp.f5) * ramp;
      return { x: cx + Math.cos(angulo) * raio, y: cy + Math.sin(angulo) * raio, raio: raio, angulo: angulo };
    }

    /**
     * Olha à frente e à volta da ponta. Onde há outra espiral por perto, o raio
     * é puxado para dentro (a espiral cresce para o outro lado); sem nada por
     * perto, volta ao normal. Devolve true se não há mais por onde crescer.
     */
    function desviar(esp, atual) {
      const a = esp.afastamento;
      const fora = [Math.cos(atual.angulo), Math.sin(atual.angulo)];
      const frente = [-fora[1] * esp.sentido, fora[0] * esp.sentido];
      const perto = ocupado(atual.x + fora[0] * a * 0.7, atual.y + fora[1] * a * 0.7, esp.id);
      const longe = ocupado(atual.x + fora[0] * a * 1.4, atual.y + fora[1] * a * 1.4, esp.id);
      const adiante = ocupado(atual.x + frente[0] * a * 0.9, atual.y + frente[1] * a * 0.9, esp.id);
      if (perto || longe || adiante) {
        esp.desvio -= a * (perto ? 0.06 : 0) + a * (longe ? 0.03 : 0) + a * (adiante ? 0.05 : 0);
      } else {
        esp.desvio *= 0.985;
      }
      const limite = a * 0.2;
      const preso = esp.desvio < -limite && (perto || adiante);
      esp.desvio = Math.max(-limite, Math.min(limite, esp.desvio));
      return preso;
    }

    /** Um ponto novo na ponta. Para de crescer se não houver caminho. */
    function crescer(esp) {
      const atual = posicao(esp, esp.theta);
      esp.theta += PASSO / Math.max(atual.raio, 6);
      if (desviar(esp, atual) && ++esp.presa > 10) { esp.crescendo = false; return; }

      const novo = posicao(esp, esp.theta);
      esp.raio = novo.raio;
      if (ocupado(novo.x, novo.y, esp.id) || novo.x < -40 || novo.y < -40 || novo.x > largura + 40 || novo.y > altura + 40) {
        esp.crescendo = false;
        return;
      }
      esp.x = novo.x;
      esp.y = novo.y;
      esp.xs.push(novo.x);
      esp.ys.push(novo.y);
      esp.n++;
      marcar(esp, novo.x, novo.y);
      if (esp.n >= esp.pontosMax) esp.crescendo = false;
    }

    function alvoDeEspirais() { return Math.max(2, Math.round(largura * altura / 120000)); }

    /** Tenta fazer nascer uma espiral num ponto livre da tela. */
    function nascer(idadeInicial) {
      for (let tentativa = 0; tentativa < 10; tentativa++) {
        const x = entre(0.05, 0.95) * largura;
        const y = entre(0.05, 0.95) * altura;
        let livre = !ocupado(x, y, 0);
        for (let a = 0; a < 6 && livre; a++) {
          livre = !ocupado(x + Math.cos(a * 1.047) * 30, y + Math.sin(a * 1.047) * 30, 0);
        }
        if (!livre) continue;
        // Poucas crescem muito: o comprimento final varia de ~150 a ~9000 px (escala logarítmica)
        const comprimento = Math.exp(entre(Math.log(150), Math.log(9000)));
        const esp = {
          id: proximoId++,
          xs: [], ys: [], n: 0,
          cx: x, cy: y,                        // centro de onde ela nasce
          x: x, y: y,                          // ponta
          fase: entre(0, DOIS_PI),
          sentido: rnd() < 0.5 ? -1 : 1,
          theta: 0,                            // quanto já girou (rad)
          raioInicial: entre(3, 6),
          raio: 0,
          afastamento: entre(13, 26),          // distância entre uma volta e a seguinte
          desvio: 0,                           // quanto o raio foi puxado para dentro para fugir de outra espiral
          giroPorSegundo: entre(2, 3.6),       // rad/s: a ponta anda mais depressa quanto maior o raio
          f1: entre(0, DOIS_PI), f2: entre(0, DOIS_PI), f3: entre(0, DOIS_PI), f4: entre(0, DOIS_PI), f5: entre(0, DOIS_PI),
          acumulado: 0,
          pontosMax: Math.round(comprimento / PASSO),
          espessura: entre(1.8, 3.6),
          crescendo: true,
          presa: 0,
          idade: idadeInicial || 0,
          vida: entre(10, 26),                 // depois disso começa a apagar
          espera: entre(1.5, 5),               // pausa depois de parar de crescer, antes de apagar
          paradaEm: 0,
          apagando: false,
          inicio: 0,                           // primeiro ponto ainda visível (apaga de dentro para fora)
          liberados: 0,
          velApagar: 0,                        // pontos por segundo
          reservas: []
        };
        const primeiro = posicao(esp, 0);
        esp.raio = primeiro.raio;
        esp.x = primeiro.x;
        esp.y = primeiro.y;
        esp.xs.push(primeiro.x);
        esp.ys.push(primeiro.y);
        esp.n = 1;
        marcar(esp, esp.x, esp.y);
        espirais.push(esp);
        return;
      }
    }

    function passo(dt) {
      for (let k = espirais.length - 1; k >= 0; k--) {
        const esp = espirais[k];
        esp.idade += dt;

        if (esp.crescendo) {
          esp.acumulado += esp.giroPorSegundo * Math.max(esp.raio, 8) * dt;
          while (esp.acumulado >= PASSO && esp.crescendo) {
            esp.acumulado -= PASSO;
            crescer(esp);
          }
          if (!esp.crescendo) esp.paradaEm = esp.idade;
        }

        if (!esp.apagando && (esp.idade > esp.vida || (!esp.crescendo && esp.idade > esp.paradaEm + esp.espera))) {
          esp.apagando = true;
          esp.velApagar = Math.max(1, esp.n - esp.inicio) / entre(2.5, 6);
        }

        if (esp.apagando) {
          esp.inicio += esp.velApagar * dt;
          while (esp.liberados < Math.floor(esp.inicio) && esp.liberados < esp.n) liberar(esp, esp.liberados++);
          if (esp.inicio >= esp.n - 1) {
            while (esp.liberados < esp.n) liberar(esp, esp.liberados++);
            espirais.splice(k, 1);
          }
        }
      }

      if (sim.nascimentos && espirais.length < alvoDeEspirais() && rnd() < dt * 0.8) nascer(0);
    }

    /** Estado inicial: algumas espirais já crescidas e alguns segundos rodados. */
    function popular() {
      for (let n = alvoDeEspirais(); n > 0; n--) nascer(entre(0, 6));
      for (let t = 0; t < 120; t++) passo(0.1);
    }

    return sim;
  }

  /* ------------------------------------------------------------------------
     Desenho
     ------------------------------------------------------------------------ */

  function suave(t) {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  }

  function criar(canvas) {
    const e = { sim: null, ctx: null, dpr: 1, largura: 0, altura: 0, tinta: '#000', borda: '#fff', claro: false, chave: '' };
    let faixa = new Float32Array(8192); // (esq x, esq y, dir x, dir y) de cada ponto da espiral

    /** Preto (tinta) e fio de luz: no escuro, --cor-sombra e --acento; no claro, --cor-texto e sem fio. */
    function lerCores() {
      const estilo = getComputedStyle(canvas);
      const claro = parseFloat(estilo.getPropertyValue('--claro')) >= 0.5;
      const tinta = estilo.getPropertyValue(claro ? '--cor-texto' : '--cor-sombra').trim() || (claro ? '#1c1a15' : '#000000');
      const borda = estilo.getPropertyValue('--acento').trim() || estilo.color;
      return { tinta: tinta, borda: borda, claro: claro };
    }

    function cores() {
      const c = lerCores();
      const chave = [c.tinta, c.borda, c.claro].join('|');
      if (chave === e.chave) return;
      e.chave = chave;
      e.tinta = c.tinta;
      e.borda = c.borda;
      e.claro = c.claro;
    }

    function ajustar(largura, altura) {
      if (!largura || !altura) return false;
      // Mudança pequena de altura (barra do navegador no celular) não reinicia o desenho
      if (e.sim && Math.abs(largura - e.largura) <= 8 && Math.abs(altura - e.altura) <= 80) return true;
      e.largura = largura;
      e.altura = altura;
      e.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(largura * e.dpr);
      canvas.height = Math.round(altura * e.dpr);
      canvas.style.width = largura + 'px';
      canvas.style.height = altura + 'px';
      e.ctx = canvas.getContext('2d');
      e.sim = criarEspirais(largura, altura);
      e.sim.popular();
      e.chave = '';
      cores();
      return true;
    }

    function passo(dt) {
      e.sim.passo(dt);
    }

    /** Uma espiral como faixa: fina na ponta e onde está sumindo, mais grossa no meio. */
    function tracar(ctx, esp) {
      const i0 = Math.floor(esp.inicio);
      const n = esp.n;
      const total = n - i0;
      if (total < 2) return false;
      if (faixa.length < total * 4) faixa = new Float32Array(total * 8);
      for (let i = i0; i < n; i++) {
        const a = Math.max(i - 1, i0);
        const b = Math.min(i + 1, n - 1);
        let tx = esp.xs[b] - esp.xs[a];
        let ty = esp.ys[b] - esp.ys[a];
        const tam = Math.sqrt(tx * tx + ty * ty) || 1;
        tx /= tam;
        ty /= tam;
        let largura = esp.espessura * (1 + 0.14 * Math.sin(i * 0.07 + esp.f1));
        largura *= 0.12 + 0.88 * suave((n - 1 - i) / 45);  // ponta fina
        largura *= suave((i - esp.inicio) / 30);             // começo que some, também fino
        largura = Math.max(largura, 0.25) / 2;
        const k = (i - i0) * 4;
        faixa[k] = esp.xs[i] - ty * largura;
        faixa[k + 1] = esp.ys[i] + tx * largura;
        faixa[k + 2] = esp.xs[i] + ty * largura;
        faixa[k + 3] = esp.ys[i] - tx * largura;
      }
      ctx.beginPath();
      ctx.moveTo(faixa[0], faixa[1]);
      for (let i = 1; i < total; i++) ctx.lineTo(faixa[i * 4], faixa[i * 4 + 1]);
      for (let i = total - 1; i >= 0; i--) ctx.lineTo(faixa[i * 4 + 2], faixa[i * 4 + 3]);
      ctx.closePath();
      return true;
    }

    function desenhar() {
      const ctx = e.ctx;
      const sim = e.sim;
      if (!ctx || !sim) return;
      ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      ctx.clearRect(0, 0, e.largura, e.altura);
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      for (let k = 0; k < sim.espirais.length; k++) {
        if (!tracar(ctx, sim.espirais[k])) continue;
        if (!e.claro) { // névoa na cor do tema em volta do preto, para a espiral aparecer no fundo escuro
          ctx.strokeStyle = e.borda;
          ctx.globalAlpha = 0.12;
          ctx.lineWidth = 10;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = e.tinta;
        ctx.fill();
        if (!e.claro) {
          ctx.strokeStyle = e.borda;
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    return { quadros: 30, ajustar: ajustar, cores: cores, passo: passo, desenhar: desenhar };
  }

  OP.atmosfera.morte = { criarEspirais: criarEspirais };
  OP.atmosfera.registrar({ tema: 'morte', canvas: 'atmosfera-espirais', criar: criar });
})(window.OP);
