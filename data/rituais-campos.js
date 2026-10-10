/* ==========================================================================
   data/rituais-campos.js — sugestões para os campos de texto dos rituais
   --------------------------------------------------------------------------
   Viram <datalist>: o usuário escolhe uma sugestão ou digita outro valor.
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  data.rituaisCampos = {
    execucao: ['padrão', 'movimento', 'completa', 'reação', 'livre'],
    alcance: ['pessoal', 'toque', 'curto', 'médio', 'longo', 'extremo', 'ilimitado'],
    duracao: ['instantânea', 'cena', 'sustentada', '1 rodada', '1 dia', 'permanente']
  };
})(window.OP.data);
