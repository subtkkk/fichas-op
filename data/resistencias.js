/* ==========================================================================
   data/resistencias.js — dados de jogo: resistência a rituais
   --------------------------------------------------------------------------
   Qual teste o alvo faz para resistir a um ritual e o que acontece se ele
   passar. Os resumos são curtos e escritos com palavras próprias.
   Usado no cartão de ritual (ritual.resistencia = { teste, efeito }).
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  data.resistencia = {
    /** Testes de resistência (os ids são os mesmos das perícias). */
    testes: [
      { id: 'fortitude', nome: 'Fortitude' },
      { id: 'reflexos',  nome: 'Reflexos' },
      { id: 'vontade',   nome: 'Vontade' }
    ],

    /** O que acontece com quem passa no teste. */
    efeitos: [
      {
        id: 'anula',
        nome: 'Anula',
        resumo: 'Quem passa no teste não sofre o efeito.'
      },
      {
        id: 'desacredita',
        nome: 'Desacredita',
        resumo: 'Quem interage de perto com o ritual faz um teste para perceber que ele não é real; ' +
          'o ritual continua funcionando e quem percebeu pode avisar os aliados.'
      },
      {
        id: 'parcial',
        nome: 'Parcial',
        resumo: 'Quem passa no teste sofre um efeito menor.'
      },
      {
        id: 'reduz_metade',
        nome: 'Reduz à metade',
        resumo: 'Quem passa sofre metade do efeito, aplicada antes da resistência a dano.'
      },
      {
        id: 'evita',
        nome: 'Evita',
        resumo: 'O alvo que passa evita o efeito descrito no ritual.'
      },
      {
        id: 'ver_texto',
        nome: 'Veja o texto',
        resumo: 'O resultado do teste está descrito no próprio texto do ritual.'
      }
    ]
  };
})(window.OP.data);
