/* ==========================================================================
   js/tests-atmosfera.js — verificações do fundo animado (js/atmosfera.js)
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
    const atmosfera = OP.atmosfera;
    if (!atmosfera) return [];

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
      }, esperado: true }
    ];
  }

  OP.testesAtmosfera = testesAtmosfera;
})(window.OP);
