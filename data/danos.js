/* ==========================================================================
   data/danos.js — dados de jogo: tipos de dano e perícias de ataque
   --------------------------------------------------------------------------
   Usado pelas resistências (seção Defesa) e pelos ataques.
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  /** Grupos só organizam a tela das resistências. */
  data.gruposDano = [
    { id: 'fisico',     nome: 'Físico' },
    { id: 'elemental',  nome: 'Elemental' },
    { id: 'mental',     nome: 'Mental' },
    { id: 'paranormal', nome: 'Paranormal' }
  ];

  /**
   * Tipos de dano: { id, nome } (+ grupo, para a tela de resistências).
   * Nomes conferidos em outro sistema, CONFERIR NO LIVRO.
   */
  data.tiposDano = [
    { id: 'cortante',     nome: 'Cortante',     grupo: 'fisico' },
    { id: 'impacto',      nome: 'Impacto',      grupo: 'fisico' },
    { id: 'perfurante',   nome: 'Perfurante',   grupo: 'fisico' },
    { id: 'balistico',    nome: 'Balístico',    grupo: 'fisico' },
    { id: 'fogo',         nome: 'Fogo',         grupo: 'elemental' },
    { id: 'eletrico',     nome: 'Elétrico',     grupo: 'elemental' },
    { id: 'frio',         nome: 'Frio',         grupo: 'elemental' },
    { id: 'quimico',      nome: 'Químico',      grupo: 'elemental' },
    { id: 'mental',       nome: 'Mental',       grupo: 'mental' },
    { id: 'sangue',       nome: 'Sangue',       grupo: 'paranormal' },
    { id: 'morte',        nome: 'Morte',        grupo: 'paranormal' },
    { id: 'conhecimento', nome: 'Conhecimento', grupo: 'paranormal' },
    { id: 'energia',      nome: 'Energia',      grupo: 'paranormal' }
  ];

  /** Perícias usadas nos ataques: Luta (corpo a corpo) e Pontaria (à distância). */
  data.periciasAtaque = [
    { id: 'luta',     rotulo: 'Luta (corpo a corpo)' },
    { id: 'pontaria', rotulo: 'Pontaria (à distância)' }
  ];

  /** Limites dos campos de crítico de um ataque ("margem/xmultiplicador"). */
  data.regrasAtaque = {
    critMargemMinima: 2,
    critMargemMaxima: 20,
    critMultMinimo: 2,
    critMultMaximo: 10
  };
})(window.OP.data);
