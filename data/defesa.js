/* ==========================================================================
   data/defesa.js — dados de jogo: Defesa, reações e deslocamento
   --------------------------------------------------------------------------
   Só estrutura e números. As fórmulas ficam em js/calc.js.
   Os tipos de dano (usados nas resistências e nos ataques) ficam em data/danos.js.
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  /**
   * Defesa = base + atributo (total) + proteções + outros.
   * Deslocamento = base + bônus (em metros); 1 quadrado = 1,5 m.
   * O deslocamento base fica em data/config.js (OP.data.config.deslocamentoBase).
   */
  data.regrasDefesa = {
    base: 10,
    atributo: 'agi',
    metrosPorQuadrado: 1.5
  };

  /**
   * Reações defensivas: ficam disponíveis com a perícia indicada
   * em grau ≥ grauMinimo (1 = Treinado). O valor vem de periciaBonus.
   */
  data.reacoes = [
    { id: 'bloqueio',     nome: 'Bloqueio',      pericia: 'fortitude', grauMinimo: 1 },
    { id: 'esquiva',      nome: 'Esquiva',       pericia: 'reflexos',  grauMinimo: 1 },
    { id: 'contraAtaque', nome: 'Contra-ataque', pericia: 'luta',      grauMinimo: 1 }
  ];

  /** Perícias mostradas como "testes rápidos" na seção Defesa e derivados. */
  data.periciasDerivadas = ['iniciativa', 'fortitude', 'reflexos', 'vontade'];
})(window.OP.data);
