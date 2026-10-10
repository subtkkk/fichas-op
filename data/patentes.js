/* ==========================================================================
   data/patentes.js — patentes, limite de crédito e categorias de item
   --------------------------------------------------------------------------
   Para ajustar, edite as linhas das tabelas abaixo.
   - ppMinimo: Pontos de Prestígio a partir dos quais a patente é sugerida
   - credito:  id de um nível de OP.data.niveisCredito
   - limites:  quantos itens de cada categoria (I a IV) a patente permite;
               0 = categoria não permitida (o "—" do livro); a categoria 0
               de item não tem limite
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  /** Níveis de Limite de Crédito, do menor para o maior. */
  data.niveisCredito = [
    { id: 'baixo',     nome: 'Baixo' },
    { id: 'medio',     nome: 'Médio' },
    { id: 'alto',      nome: 'Alto' },
    { id: 'ilimitado', nome: 'Ilimitado' }
  ];

  /**
   * Patentes, em ordem crescente. Todo personagem começa como Recruta.
   * Tabela 3.1 do livro, conferida.
   */
  data.patentes = [
    { id: 'recruta',             nome: 'Recruta',              ppMinimo: 0,   credito: 'baixo',     limites: { I: 2, II: 0, III: 0, IV: 0 } }, // Tabela 3.1 do livro, conferida
    { id: 'operador',            nome: 'Operador',             ppMinimo: 20,  credito: 'medio',     limites: { I: 3, II: 1, III: 0, IV: 0 } }, // Tabela 3.1 do livro, conferida
    { id: 'agente-especial',     nome: 'Agente especial',      ppMinimo: 50,  credito: 'medio',     limites: { I: 3, II: 2, III: 1, IV: 0 } }, // Tabela 3.1 do livro, conferida
    { id: 'oficial-operacoes',   nome: 'Oficial de operações', ppMinimo: 100, credito: 'alto',      limites: { I: 3, II: 3, III: 2, IV: 1 } }, // Tabela 3.1 do livro, conferida
    { id: 'agente-elite',        nome: 'Agente de elite',      ppMinimo: 200, credito: 'ilimitado', limites: { I: 3, II: 3, III: 3, IV: 2 } }  // Tabela 3.1 do livro, conferida
  ];

  /**
   * Categorias de item. "valor" é o número salvo no item (0 a 4);
   * "chave" liga a categoria aos limites da patente (null = sem limite).
   */
  data.categoriasItem = [
    { valor: 0, rotulo: '0',   chave: null },
    { valor: 1, rotulo: 'I',   chave: 'I' },
    { valor: 2, rotulo: 'II',  chave: 'II' },
    { valor: 3, rotulo: 'III', chave: 'III' },
    { valor: 4, rotulo: 'IV',  chave: 'IV' }
  ];
})(window.OP.data);
