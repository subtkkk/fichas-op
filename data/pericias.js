/* ==========================================================================
   data/pericias.js — dados de jogo: perícias e graus de treinamento
   --------------------------------------------------------------------------
   Só estrutura: ids, nomes, atributo padrão e sinalizadores.
   Nenhuma descrição do livro de regras é copiada.

   Para corrigir uma perícia, edite a linha dela na lista abaixo:
   - atributoPadrao:  'agi' | 'for' | 'int' | 'pre' | 'vig'
   - somenteTreinada: true se a perícia só pode ser usada com treinamento
   - penalidadeCarga: true se sofre penalidade de carga (aplicada na Etapa 5)
   - kit:             true se a perícia usa um kit (por enquanto só um indicador)
   - aberta:          true se o jogador digita uma especialidade (ex.: Profissão)
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  /**
   * Graus de treinamento. A POSIÇÃO na lista é o valor salvo em
   * ficha.pericias[id].grau (0 = Destreinado ... 3 = Expert).
   */
  data.grausTreinamento = [
    { id: 'destreinado', nome: 'Destreinado', bonus: 0 },
    { id: 'treinado',    nome: 'Treinado',    bonus: 5 },
    { id: 'veterano',    nome: 'Veterano',    bonus: 10 },  // CONFERIR NO LIVRO
    { id: 'expert',      nome: 'Expert',      bonus: 15 }   // CONFERIR NO LIVRO
  ];

  /*
   * As 28 perícias, em ordem alfabética (conferidas com a tabela do livro).
   * Por atributo padrão: AGI 7, FOR 2, INT 9, PRE 9, VIG 1.
   * Somente treinada: 10. Penalidade de carga: 3. Kit: 4.
   * TODO: efeito do kit, depende da regra do livro (por enquanto use o campo "outros").
   */
  data.pericias = [
    { id: 'acrobacia',     nome: 'Acrobacia',     atributoPadrao: 'agi', somenteTreinada: false, penalidadeCarga: true,  kit: false, aberta: false },
    { id: 'adestramento',  nome: 'Adestramento',  atributoPadrao: 'pre', somenteTreinada: true,  penalidadeCarga: false, kit: false, aberta: false },
    { id: 'artes',         nome: 'Artes',         atributoPadrao: 'pre', somenteTreinada: true,  penalidadeCarga: false, kit: false, aberta: false },
    { id: 'atletismo',     nome: 'Atletismo',     atributoPadrao: 'for', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'atualidades',   nome: 'Atualidades',   atributoPadrao: 'int', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'ciencias',      nome: 'Ciências',      atributoPadrao: 'int', somenteTreinada: true,  penalidadeCarga: false, kit: false, aberta: false },
    { id: 'crime',         nome: 'Crime',         atributoPadrao: 'agi', somenteTreinada: true,  penalidadeCarga: true,  kit: true,  aberta: false },
    { id: 'diplomacia',    nome: 'Diplomacia',    atributoPadrao: 'pre', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'enganacao',     nome: 'Enganação',     atributoPadrao: 'pre', somenteTreinada: false, penalidadeCarga: false, kit: true,  aberta: false },
    { id: 'fortitude',     nome: 'Fortitude',     atributoPadrao: 'vig', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'furtividade',   nome: 'Furtividade',   atributoPadrao: 'agi', somenteTreinada: false, penalidadeCarga: true,  kit: false, aberta: false },
    { id: 'iniciativa',    nome: 'Iniciativa',    atributoPadrao: 'agi', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'intimidacao',   nome: 'Intimidação',   atributoPadrao: 'pre', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'intuicao',      nome: 'Intuição',      atributoPadrao: 'pre', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'investigacao',  nome: 'Investigação',  atributoPadrao: 'int', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'luta',          nome: 'Luta',          atributoPadrao: 'for', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'medicina',      nome: 'Medicina',      atributoPadrao: 'int', somenteTreinada: false, penalidadeCarga: false, kit: true,  aberta: false },
    { id: 'ocultismo',     nome: 'Ocultismo',     atributoPadrao: 'int', somenteTreinada: true,  penalidadeCarga: false, kit: false, aberta: false },
    { id: 'percepcao',     nome: 'Percepção',     atributoPadrao: 'pre', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'pilotagem',     nome: 'Pilotagem',     atributoPadrao: 'agi', somenteTreinada: true,  penalidadeCarga: false, kit: false, aberta: false },
    { id: 'pontaria',      nome: 'Pontaria',      atributoPadrao: 'agi', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'profissao',     nome: 'Profissão',     atributoPadrao: 'int', somenteTreinada: true,  penalidadeCarga: false, kit: false, aberta: true  },
    { id: 'reflexos',      nome: 'Reflexos',      atributoPadrao: 'agi', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'religiao',      nome: 'Religião',      atributoPadrao: 'pre', somenteTreinada: true,  penalidadeCarga: false, kit: false, aberta: false },
    { id: 'sobrevivencia', nome: 'Sobrevivência', atributoPadrao: 'int', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false },
    { id: 'tatica',        nome: 'Tática',        atributoPadrao: 'int', somenteTreinada: true,  penalidadeCarga: false, kit: false, aberta: false },
    { id: 'tecnologia',    nome: 'Tecnologia',    atributoPadrao: 'int', somenteTreinada: true,  penalidadeCarga: false, kit: true,  aberta: false },
    { id: 'vontade',       nome: 'Vontade',       atributoPadrao: 'pre', somenteTreinada: false, penalidadeCarga: false, kit: false, aberta: false }
  ];
})(window.OP.data);
