/* ==========================================================================
   data/temas-ficha.js — temas elementais da ficha (OP.data.temasFicha)
   --------------------------------------------------------------------------
   Os temas são SÓ aparência (cores, luz e detalhes gráficos da ficha e do
   painel de rolagens). Não mudam afinidade, regras, atributos nem nada da
   mecânica. A escolha fica nas preferências do navegador (js/prefs.js),
   por ficha, fora dos dados da ficha (não vai para exportar/importar).
   As cores de verdade ficam no css/style.css ([data-elemento="..."]).
   Não confundir com data/temas.js (OP.data.temas): aparência do SITE
   (Automático, Escuro, Claro e Alto contraste), no atributo data-tema do <html>.
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  /**
   * id: valor de data-elemento; nome e descricao: textos da tela;
   * cor: amostra usada fora da ficha (cartões do arquivo, seletor).
   * O primeiro é o padrão.
   */
  data.temasFicha = [
    { id: 'neutro',       nome: 'Neutro',       cor: '#c9a45c', descricao: 'Grafite e ouro de arquivo. Sem elemento: o padrão.' },
    { id: 'sangue',       nome: 'Sangue',       cor: '#e0473c', descricao: 'Carmesim, vermelho profundo e preto.' },
    { id: 'morte',        nome: 'Morte',        cor: '#a594c8', descricao: 'Violetas fechados, cinzas frios e névoa.' },
    { id: 'conhecimento', nome: 'Conhecimento', cor: '#d9b35a', descricao: 'Dourado envelhecido, grafite e diagramas.' },
    { id: 'energia',      nome: 'Energia',      cor: '#b06bff', descricao: 'Violeta elétrico, magenta e ciano.' },
    { id: 'medo',         nome: 'Medo',         cor: '#e9e6df', descricao: 'Preto profundo, branco pálido e silêncio.' }
  ];
})(window.OP.data);
