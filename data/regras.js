/* ==========================================================================
   data/regras.js — dados de jogo: atributos, recursos e níveis
   --------------------------------------------------------------------------
   Estrutura e números gerais que antes ficavam em data/classes.js (até a
   Etapa 8). As classes agora vêm de data/classes.js (Guia de Consulta).
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  /**
   * Recursos da ficha e de onde vem cada parte do máximo.
   * - campoInicial/campoPorNex: nomes dos campos em cada classe (data/classes.js).
   * - atributo: id do atributo somado ao inicial (e, conforme
   *   config.progressaoSomaAtributo, a cada passo de NEX). null = nenhum.
   */
  data.recursos = [
    { id: 'pv',  sigla: 'PV',  nome: 'Pontos de Vida',    campoInicial: 'pvInicial',  campoPorNex: 'pvPorNex',  atributo: 'vig' },
    { id: 'pe',  sigla: 'PE',  nome: 'Pontos de Esforço', campoInicial: 'peInicial',  campoPorNex: 'pePorNex',  atributo: 'pre' },
    { id: 'san', sigla: 'SAN', nome: 'Sanidade',          campoInicial: 'sanInicial', campoPorNex: 'sanPorNex', atributo: null }
  ];

  /** Níveis de NEX disponíveis (em %): 5 a 95 de 5 em 5, mais 99. */
  data.nex = (function gerarNiveisNex() {
    const niveis = [];
    for (let valor = 5; valor <= 95; valor += 5) niveis.push(valor);
    niveis.push(99);
    return niveis;
  })();

  /** Os cinco atributos, na ordem em que aparecem na ficha. */
  data.atributos = [
    { id: 'agi', sigla: 'AGI', nome: 'Agilidade' },
    { id: 'for', sigla: 'FOR', nome: 'Força' },
    { id: 'int', sigla: 'INT', nome: 'Intelecto' },
    { id: 'pre', sigla: 'PRE', nome: 'Presença' },
    { id: 'vig', sigla: 'VIG', nome: 'Vigor' }
  ];

  /**
   * Regras de distribuição de atributos na criação do personagem.
   * Total na criação: 5 atributos × 1 + 4 pontos = 9 (reduzir um atributo
   * a 0 dá 1 ponto extra, e a soma continua 9). Os aumentos de atributo do
   * NEX somam pontos a esse total (js/calc.js).
   */
  data.regrasAtributos = {
    baseInicial: 1,            // todo atributo começa neste valor
    pontosParaDistribuir: 4,   // pontos livres na criação
    maximoInicial: 3,          // maior valor base permitido na criação
    maximoComAumentos: 5,      // limite dos aumentos pelo NEX sem classe escolhida (a classe tem aumentoAtributoMax)
    minimo: 0,                 // menor valor base possível
    maxAtributosReduzidos: 1   // quantos atributos podem cair abaixo da base inicial (cada ponto reduzido devolve 1 ponto)
  };
})(window.OP.data);
