/* ==========================================================================
   data/config.js — números gerais do sistema, fáceis de ajustar
   --------------------------------------------------------------------------
   Este arquivo é carregado antes dos outros dados. As fórmulas que usam
   estes valores ficam em js/calc.js.
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  data.config = {
    // Capacidade de carga, em espaços
    capacidadePorForca: 5,      // espaços por ponto de FOR (total)
    capacidadeForcaZero: 2,     // capacidade com FOR 0 ou menos. CONFERIR NO LIVRO

    // Deslocamento base, em metros (6 quadrados de 1,5 m)
    deslocamentoBase: 9,

    // Penalidades quando os espaços usados passam da capacidade. CONFERIR NO LIVRO
    sobrecarga: {
      pericias: 5,              // em perícias com penalidade de carga
      defesa: 5,
      deslocamento: 3           // metros
    },

    // Bônus numa perícia com kit quando o kit dela está no inventário.
    // TODO: confirmar a regra no livro
    bonusKit: 0,

    // DT para resistir a uma habilidade = base + (limite de PE por turno, se
    // somaLimitePE) + atributo (total). Vale para qualquer habilidade; nos
    // rituais o atributo é o abaixo e a ficha ainda soma o bônus manual de DT.
    // Confirmado pelo livro (PRE 3 e NEX 5% → 14; PRE 5 e NEX 99% → 35).
    dtRitual: {
      base: 10,
      somaLimitePE: true,
      atributo: 'pre'
    },

    // Rituais de Medo: ao conjurar, o personagem perde Sanidade igual ao
    // custo em PE (sanPorCusto) e perde Sanidade permanente conforme a forma,
    // o que reduz o SAN máximo.
    // CONFERIR NO LIVRO: interpretação (a perda igual ao custo vale nas três formas).
    medo: {
      sanPorCusto: true,
      perdaPermanente: { padrao: 1, discente: 2, verdadeira: 3 }
    },

    // Custo (em PE) de um ritual de cada círculo. É o custo base automático
    // do ritual (custoBase null) e o custo TOTAL de uma forma que "requer"
    // aquele círculo: Discente/Verdadeiro somam "+N PE" sobre o custo base.
    custoRitualPorCirculo: { 1: 1, 2: 3, 3: 6, 4: 10 },

    // NEX (%) a partir do qual cada círculo fica liberado.
    circulosPorNex: { 1: 5, 2: 25, 3: 55, 4: 85 },

    // NEX (%) em que o personagem se conecta com um elemento. A afinidade só
    // se desenvolve na primeira vez que ele transcende depois disso.
    nexAfinidade: 50,

    // PV e PE: o atributo (VIG/PRE) também soma a CADA passo de NEX.
    // PV confirmado pelo Guia (Combatente NEX 15%, VIG 3 → 37); PE por simetria.
    // A SAN não soma atributo. No Sobrevivente (estágios) nada soma atributo
    // por estágio, seguindo o texto literal.
    progressaoSomaAtributo: { pv: true, pe: true }
  };

  /** Tipos de item do inventário (os campos extras aparecem conforme o tipo). */
  data.tiposItem = [
    { id: 'geral',    nome: 'Geral' },
    { id: 'arma',     nome: 'Arma' },
    { id: 'protecao', nome: 'Proteção' },
    { id: 'kit',      nome: 'Kit' }
  ];
})(window.OP.data);
