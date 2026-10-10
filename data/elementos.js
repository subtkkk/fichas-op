/* ==========================================================================
   data/elementos.js — dados de jogo: elementos paranormais
   --------------------------------------------------------------------------
   Usados nos rituais e na afinidade. Só ids, nomes e um sinalizador.
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  /**
   * afinidadePossivel: o elemento pode ser escolhido como afinidade.
   * Não existe afinidade com Medo, mas existem rituais de Medo.
   */
  data.elementos = [
    { id: 'sangue',       nome: 'Sangue',       afinidadePossivel: true },
    { id: 'morte',        nome: 'Morte',        afinidadePossivel: true },
    { id: 'conhecimento', nome: 'Conhecimento', afinidadePossivel: true },
    { id: 'energia',      nome: 'Energia',      afinidadePossivel: true },
    { id: 'medo',         nome: 'Medo',         afinidadePossivel: false }
  ];
})(window.OP.data);
