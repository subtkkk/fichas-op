/* ==========================================================================
   data/habilidades.js — listas usadas por habilidades, poderes e rituais
   --------------------------------------------------------------------------
   Só estrutura (ids e nomes). O site não traz poderes nem rituais do livro:
   o usuário cadastra os dele.
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  /** De onde vem uma habilidade (também são as abas do filtro). */
  data.fontesHabilidade = [
    { id: 'classe', nome: 'Classe' },
    { id: 'origem', nome: 'Origem' },
    { id: 'trilha', nome: 'Trilha' },
    { id: 'poder',  nome: 'Poder' },
    { id: 'outro',  nome: 'Outro' }
  ];

  /** Tipo de ação para ativar uma habilidade ('' = não informado). */
  data.ativacoes = [
    { id: 'passiva',   nome: 'Passiva' },
    { id: 'livre',     nome: 'Livre' },
    { id: 'reacao',    nome: 'Reação' },
    { id: 'movimento', nome: 'Movimento' },
    { id: 'padrao',    nome: 'Padrão' },
    { id: 'completa',  nome: 'Completa' },
    { id: 'outra',     nome: 'Outra' }
  ];

  /** Círculos de ritual. */
  data.circulosRitual = [1, 2, 3, 4];

  /**
   * Formas de conjurar um ritual. A Padrão sempre existe; as outras só
   * valem quando marcadas como "ativa" no ritual.
   */
  data.formasRitual = [
    { id: 'padrao',     nome: 'Padrão',     opcional: false },
    { id: 'discente',   nome: 'Discente',   opcional: true },
    { id: 'verdadeira', nome: 'Verdadeira', opcional: true }
  ];
})(window.OP.data);
