/* ==========================================================================
   js/tests-atmosfera.js — verificações dos fundos animados (js/atmosfera-*.js)
   --------------------------------------------------------------------------
   Só a simulação (sem DOM), com sorteio fixo. Não roda sozinho: o
   OP.runTests() (js/tests.js) chama OP.testesAtmosfera().
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  /** Sorteio fixo e repetível (LCG) para a simulação dar sempre o mesmo resultado. */
  function sorteioFixo(semente) {
    let s = semente;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  function testesAtmosfera() {
    const atmosfera = OP.atmosfera && OP.atmosfera.conhecimento;
    const morte = OP.atmosfera && OP.atmosfera.morte;
    if (!atmosfera || !morte) return [];

    function acesas(sim) {
      let n = 0;
      for (let i = 0; i < sim.brilho.length; i++) if (sim.brilho[i] > 0) n++;
      return n;
    }

    return [
      { nome: 'Atmosfera · Os sigilos usam só as 52 letras (A–Z e a–z), sem repetir', obtido: function () {
        return atmosfera.LETRAS.length + '/' + /^[A-Za-z]+$/.test(atmosfera.LETRAS) + '/' + new Set(atmosfera.LETRAS.split('')).size;
      }, esperado: '52/true/52' },
      { nome: 'Atmosfera · Ao popular, há células acesas e todo sigilo e brilho ficam nos limites', obtido: function () {
        const sim = atmosfera.criarSigilos(40, 25, sorteioFixo(7));
        sim.popular();
        let ok = true;
        for (let i = 0; i < sim.brilho.length; i++) {
          if (sim.brilho[i] < 0 || sim.brilho[i] > 1 || sim.sigilo[i] >= atmosfera.LETRAS.length) ok = false;
        }
        return ok + '/' + (acesas(sim) > 20);
      }, esperado: 'true/true' },
      { nome: 'Atmosfera · Os fluxos sobem (a fila só diminui) e sempre há fluxos ativos', obtido: function () {
        const sim = atmosfera.criarSigilos(30, 20, sorteioFixo(3));
        sim.popular();
        const antes = sim.fluxos.map(function (f) { return f.fila; });
        const primeiro = sim.fluxos[0];
        sim.passo(0.5);
        const sobe = !sim.fluxos.includes(primeiro) || primeiro.fila < antes[0];
        return sobe + '/' + (sim.fluxos.length > 0);
      }, esperado: 'true/true' },
      { nome: 'Atmosfera · Sigilos surgem e somem: o número de células acesas varia e nunca enche a tela', obtido: function () {
        const sim = atmosfera.criarSigilos(30, 20, sorteioFixo(11));
        sim.popular();
        let menor = Infinity;
        let maior = 0;
        for (let t = 0; t < 200; t++) {
          sim.passo(0.1);
          const n = acesas(sim);
          menor = Math.min(menor, n);
          maior = Math.max(maior, n);
        }
        return (maior < sim.brilho.length * 0.8) + '/' + (menor < maior) + '/' + (menor > 0);
      }, esperado: 'true/true/true' },
      { nome: 'Atmosfera · Células acesas trocam de sigilo com o tempo', obtido: function () {
        const sim = atmosfera.criarSigilos(30, 20, sorteioFixo(5));
        sim.popular();
        const antes = Array.from(sim.sigilo);
        let trocou = 0;
        sim.passo(0.1);
        for (let i = 0; i < sim.sigilo.length; i++) {
          if (sim.brilho[i] > 0 && sim.sigilo[i] !== antes[i]) trocou++;
        }
        return trocou > 0;
      }, esperado: true },
      { nome: 'Morte · As espirais crescem de dentro para fora (as voltas externas ficam mais longe do ponto de origem)', obtido: function () {
        const sim = morte.criarEspirais(900, 600, sorteioFixo(5));
        sim.popular();
        let vista = false;
        let abre = false;
        for (let t = 0; t < 200; t++) {
          sim.passo(0.1);
          sim.espirais.forEach(function (e) {
            if (e.n < 60) return;
            vista = true;
            const quarto = Math.floor(e.n / 4);
            let inicio = 0;
            let fim = 0;
            for (let i = 0; i < quarto; i++) {
              inicio += Math.hypot(e.xs[i] - e.xs[0], e.ys[i] - e.ys[0]);
              fim += Math.hypot(e.xs[e.n - 1 - i] - e.xs[0], e.ys[e.n - 1 - i] - e.ys[0]);
            }
            if (fim > inicio) abre = true;
          });
        }
        return vista + '/' + abre;
      }, esperado: 'true/true' },
      { nome: 'Morte · Espirais diferentes nunca se tocam: ficam a pelo menos uma célula uma da outra, dentro da tela', obtido: function () {
        const sim = morte.criarEspirais(300, 200, sorteioFixo(9));
        sim.nascimentos = false;
        for (let n = 0; n < 6; n++) sim.nascer(0);
        const juntas = sim.espirais.length;
        let menor = Infinity;
        let fora = false;
        for (let t = 0; t < 250; t++) {
          sim.passo(0.1);
          sim.espirais.forEach(function (a, ia) {
            for (let i = Math.floor(a.inicio); i < a.n; i++) {
              if (a.xs[i] < -45 || a.xs[i] > 345 || a.ys[i] < -45 || a.ys[i] > 245) fora = true;
              sim.espirais.forEach(function (b, ib) {
                if (ib <= ia) return;
                for (let j = Math.floor(b.inicio); j < b.n; j += 2) {
                  menor = Math.min(menor, Math.hypot(a.xs[i] - b.xs[j], a.ys[i] - b.ys[j]));
                }
              });
            }
          });
        }
        return (juntas >= 2) + '/' + (menor >= 7.5) + '/' + (!fora);
      }, esperado: 'true/true/true' },
      { nome: 'Morte · Depois de um tempo as espirais somem de dentro para fora e liberam o espaço', obtido: function () {
        const sim = morte.criarEspirais(600, 400, sorteioFixo(21));
        sim.nascimentos = false;
        for (let n = 0; n < 3; n++) sim.nascer(0);
        let viuApagar = false;
        let recuou = false;
        const ultimo = {};
        for (let t = 0; t < 900 && sim.espirais.length; t++) {
          sim.passo(0.1);
          sim.espirais.forEach(function (e) {
            if (e.inicio > 5 && e.n - e.inicio > 5) viuApagar = true;
            if (ultimo[e.id] !== undefined && e.inicio < ultimo[e.id]) recuou = true;
            ultimo[e.id] = e.inicio;
          });
        }
        let livre = true;
        for (let i = 0; i < sim.dono.length; i++) if (sim.dono[i] !== 0) livre = false;
        return [sim.espirais.length, livre, viuApagar, !recuou].join('/');
      }, esperado: '0/true/true/true' },
      { nome: 'Morte · Umas espirais ficam pequenas e outras grandes', obtido: function () {
        let menor = Infinity;
        let maior = 0;
        for (let semente = 1; semente <= 40; semente++) {
          const sim = morte.criarEspirais(1200, 800, sorteioFixo(semente));
          sim.nascimentos = false;
          sim.nascer(0);
          sim.espirais.forEach(function (e) {
            menor = Math.min(menor, e.pontosMax);
            maior = Math.max(maior, e.pontosMax);
          });
        }
        return (menor < 100) + '/' + (maior > 600);
      }, esperado: 'true/true' }
    ];
  }

  OP.testesAtmosfera = testesAtmosfera;
})(window.OP);
