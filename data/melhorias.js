/* ==========================================================================
   data/melhorias.js — melhorias de itens: naturezas, classes e compatibilidade
   --------------------------------------------------------------------------
   Só ids, nomes e regras de contagem (nenhum texto do livro). O catálogo de itens
   e de melhorias (nomes, efeitos, textos) vem do conteúdo protegido (servidor):
   "itens" e "melhorias" (js/livro.js).

   Natureza do item (gruposItem): o tipo de objeto, que decide quais melhorias ele
   aceita. É o que o livro chama de "natureza do item" (arma de fogo, munição,
   granada, proteção...). "tipo" é o tipo da ficha (OP.data.tiposItem) que a
   natureza sugere.

   Classe de melhoria (classesMelhoria): modificação, maldição ou regalia.
   "aumento" é quanto cada uma soma à categoria do item: a 1ª da classe soma
   aumento[0], a 2ª aumento[1]... e as seguintes repetem o último valor.
   - modificação: +I cada;
   - maldição: a primeira +II, as seguintes +I (e só a partir de Agente especial);
   - regalia (veículo): +I cada; o veículo tem um limite de regalias.

   Grupo de melhoria (gruposMelhoria): cada tabela do livro. "alvos" são as
   naturezas de item que o grupo aceita. Uma melhoria do catálogo pode restringir
   mais (campos "so", "somente" e "tambem" no conteúdo protegido).
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

(function (data) {
  'use strict';

  /** Naturezas de item. */
  data.gruposItem = [
    { id: 'arma-cac',        nome: 'Arma corpo a corpo',          tipo: 'arma' },
    { id: 'arma-arremesso',  nome: 'Arma de arremesso',           tipo: 'arma' },
    { id: 'arma-disparo',    nome: 'Arma de disparo',             tipo: 'arma' },
    { id: 'arma-fogo',       nome: 'Arma de fogo',                tipo: 'arma' },
    { id: 'municao',         nome: 'Munição',                     tipo: 'geral' },
    { id: 'granada',         nome: 'Granada',                     tipo: 'geral' },
    { id: 'explosivo',       nome: 'Explosivo',                   tipo: 'geral' },
    { id: 'protecao-leve',   nome: 'Proteção leve',               tipo: 'protecao' },
    { id: 'protecao-pesada', nome: 'Proteção pesada',             tipo: 'protecao' },
    { id: 'escudo',          nome: 'Escudo',                      tipo: 'protecao' },
    { id: 'capacete',        nome: 'Capacete (proteção vestida)', tipo: 'protecao' },
    { id: 'acessorio',       nome: 'Acessório (kit, utensílio, vestimenta)', tipo: 'geral' },
    { id: 'medicamento',     nome: 'Medicamento',                 tipo: 'geral' },
    { id: 'paranormal',      nome: 'Item paranormal',             tipo: 'geral' },
    { id: 'operacional',     nome: 'Item operacional',            tipo: 'geral' },
    { id: 'recurso',         nome: 'Recurso',                     tipo: 'geral' },
    { id: 'aliado',          nome: 'Aliado',                      tipo: 'geral' },
    { id: 'veiculo',         nome: 'Veículo',                     tipo: 'geral' },
    { id: 'drone',           nome: 'Drone',                       tipo: 'geral' },
    { id: 'veneno',          nome: 'Veneno',                      tipo: 'geral' },
    { id: 'amaldicoado',     nome: 'Item amaldiçoado especial ou único', tipo: 'geral' },
    { id: 'outro',           nome: 'Outro equipamento',           tipo: 'geral' }
  ];

  /** Classes de melhoria e o que cada uma soma à categoria do item. */
  data.classesMelhoria = [
    { id: 'modificacao', nome: 'Modificação', plural: 'Modificações', aumento: [1] },
    { id: 'maldicao',    nome: 'Maldição',    plural: 'Maldições',    aumento: [2, 1], patenteMinima: 'agente-especial' },
    { id: 'regalia',     nome: 'Regalia',     plural: 'Regalias',     aumento: [1] }
  ];

  var ARMAS_CORPO_E_DISPARO = ['arma-cac', 'arma-arremesso', 'arma-disparo'];
  var ARMAS = ARMAS_CORPO_E_DISPARO.concat(['arma-fogo']);
  var PROTECOES = ['protecao-leve', 'protecao-pesada', 'escudo', 'capacete'];

  /** Grupos de melhoria (uma tabela do livro cada) e as naturezas que aceitam. */
  data.gruposMelhoria = [
    { id: 'mod-corpo-disparo', classe: 'modificacao', nome: 'Armas corpo a corpo e de disparo', alvos: ARMAS_CORPO_E_DISPARO },
    { id: 'mod-fogo',          classe: 'modificacao', nome: 'Armas de fogo',                    alvos: ['arma-fogo'] },
    { id: 'mod-municao',       classe: 'modificacao', nome: 'Munições',                         alvos: ['municao'] },
    { id: 'mod-granada',       classe: 'modificacao', nome: 'Granadas',                         alvos: ['granada'] },
    { id: 'mod-protecao',      classe: 'modificacao', nome: 'Proteções',                        alvos: PROTECOES },
    { id: 'mod-acessorio',     classe: 'modificacao', nome: 'Acessórios',                       alvos: ['acessorio'] },
    { id: 'mod-medicamento',   classe: 'modificacao', nome: 'Medicamentos',                     alvos: ['medicamento'] },
    { id: 'mod-paranormal',    classe: 'modificacao', nome: 'Itens paranormais',                alvos: ['paranormal'] },
    { id: 'mod-drone',         classe: 'modificacao', nome: 'Drones',                           alvos: ['drone'] },
    { id: 'mal-arma',          classe: 'maldicao',    nome: 'Maldições para armas',             alvos: ARMAS },
    { id: 'mal-protecao',      classe: 'maldicao',    nome: 'Maldições para proteções',         alvos: PROTECOES },
    { id: 'mal-acessorio',     classe: 'maldicao',    nome: 'Maldições para acessórios',        alvos: ['acessorio'] },
    { id: 'mal-medicamento',   classe: 'maldicao',    nome: 'Maldições para medicamentos',      alvos: ['medicamento'] },
    { id: 'reg-veiculo',       classe: 'regalia',     nome: 'Regalias de veículos',             alvos: ['veiculo'] }
  ];
})(window.OP.data);
