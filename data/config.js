/* ==========================================================================
   data/config.js — números gerais do sistema, fáceis de ajustar
   --------------------------------------------------------------------------
   Este arquivo é carregado antes dos outros dados. As fórmulas que usam
   estes valores ficam em js/calc.js.
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};

// Versão do site (aparece em "Sobre"). A versão do modelo da ficha fica em js/state.js (OP.state.VERSAO_MODELO).
window.OP.versao = '0.10.0';

(function (data) {
  'use strict';

  data.config = {
    // Capacidade de carga, em espaços
    capacidadePorForca: 5,      // espaços por ponto de FOR (total)
    capacidadeForcaZero: 2,     // capacidade com FOR 0 ou menos. CONFERIR NO LIVRO

    // Deslocamento base, em metros (6 quadrados de 1,5 m)
    deslocamentoBase: 9,

    // Penalidades quando os espaços usados passam da capacidade. CONFERIR NO LIVRO
    sobrecarga: {
      pericias: 5,              // em perícias com penalidade de carga
      defesa: 5,
      deslocamento: 3           // metros
    },

    // Perícia que exige kit (Crime, Enganação, Medicina, Tecnologia): sem o kit dela
    // no inventário o bônus da perícia sofre esta penalidade; o kit limpa a penalidade.
    penalidadeSemKit: 5,

    // DT para resistir a uma habilidade = base + (limite de PE por turno, se
    // somaLimitePE) + atributo (total). Vale para qualquer habilidade; nos
    // rituais o atributo é o abaixo e a ficha ainda soma o bônus manual de DT.
    // Confirmado pelo livro (PRE 3 e NEX 5% → 14; PRE 5 e NEX 99% → 35).
    dtRitual: {
      base: 10,
      somaLimitePE: true,
      atributo: 'pre'
    },

    // Rituais de Medo: ao conjurar, o personagem perde Sanidade igual ao
    // custo em PE (sanPorCusto) e perde Sanidade permanente conforme a forma,
    // o que reduz o SAN máximo.
    // CONFERIR NO LIVRO: interpretação (a perda igual ao custo vale nas três formas).
    medo: {
      sanPorCusto: true,
      perdaPermanente: { padrao: 1, discente: 2, verdadeira: 3 }
    },

    // Custo (em PE) de um ritual de cada círculo. É o custo base automático
    // do ritual (custoBase null) e o custo TOTAL de uma forma que "requer"
    // aquele círculo: Discente/Verdadeiro somam "+N PE" sobre o custo base.
    custoRitualPorCirculo: { 1: 1, 2: 3, 3: 6, 4: 10 },

    // NEX (%) a partir do qual cada círculo fica liberado.
    circulosPorNex: { 1: 5, 2: 25, 3: 55, 4: 85 },

    // NEX (%) em que o personagem se conecta com um elemento. A afinidade só
    // se desenvolve na primeira vez que ele transcende depois disso.
    nexAfinidade: 50,

    // PV e PE: o atributo (VIG/PRE) também soma a CADA passo de NEX.
    // PV confirmado pelo Guia (Combatente NEX 15%, VIG 3 → 37); PE por simetria.
    // A SAN não soma atributo. No Sobrevivente (estágios) nada soma atributo
    // por estágio, seguindo o texto literal.
    progressaoSomaAtributo: { pv: true, pe: true },

    // ---- Etapa 10: estados de saúde e sanidade ----
    // Ferido = de 99% a 51% do PV máximo; machucado = de 50% a 1%;
    // ileso = PV cheio; morrendo = 0 PV. CONFIRMADO pelo Guia: ferido quando
    // o PV está ACIMA de (máximo × feridoAcimaDe).
    estadoSaude: { feridoAcimaDe: 0.5 },

    // Turnos morrendo na mesma cena até a morte: morre ao iniciar o 3º turno
    // morrendo. CONFIRMADO pelo Guia. Uma característica do Guia eleva para 4;
    // por isso a ficha tem um bônus (condicoes.bonusLimiteMorrendo).
    limiteTurnosMorrendo: 3,

    // "Perturbado": SAN atual igual ou abaixo de (máximo × este valor).
    // CONFERIR NO LIVRO: o Guia cita o estado, mas não o limite.
    sanidadePerturbadoAte: 0.5,

    // "Dano massivo": dano de uma só vez igual ou maior que (PV máximo × este
    // valor). CONFERIR NO LIVRO: o Guia cita "dano massivo" sem definir.
    // Provisório: metade do PV máximo. O site só avisa, não automatiza nada.
    danoMassivoFracao: 0.5,

    // Retrato da biografia: tamanho máximo do texto (data URL) guardado na ficha.
    retratoMaxChars: 400000,

    // ---- Etapa 10: descanso ----
    descanso: {
      // Condições de descanso (a escolhida fica em ficha.descanso.condicao).
      condicoes: [
        { id: 'precaria',    nome: 'Precária' },
        { id: 'normal',      nome: 'Normal' },
        { id: 'confortavel', nome: 'Confortável' },
        { id: 'luxuosa',     nome: 'Luxuosa' }
      ],
      // Meditação (poder Meditação Ocultista): PE recuperados = limite de PE
      // por turno × este número. Guia: normal = dobro do limite (NEX 35%,
      // limite 7 → 14 PE); precária = metade; confortável = "triplicada";
      // luxuosa = "quadruplicada". CONFERIR: "triplicada/quadruplicada" pode
      // significar 3× e 4× o limite (como está) ou 3× e 4× o valor normal.
      meditacaoPorLimitePE: { precaria: 1, normal: 2, confortavel: 3, luxuosa: 4 },
      // Dormir. CONFERIR NO LIVRO: a ação "dormir" não consta no Guia.
      // Provisório, copiado da Meditação; é só uma sugestão editável na tela.
      dormir: {
        pvPorLimitePE: { precaria: 1, normal: 2, confortavel: 3, luxuosa: 4 },
        pePorLimitePE: { precaria: 1, normal: 2, confortavel: 3, luxuosa: 4 },
        san: { precaria: 0, normal: 0, confortavel: 0, luxuosa: 0 }
      }
    }
  };

  /** Tipos de item do inventário (os campos extras aparecem conforme o tipo). */
  data.tiposItem = [
    { id: 'geral',    nome: 'Geral' },
    { id: 'arma',     nome: 'Arma' },
    { id: 'protecao', nome: 'Proteção' },
    { id: 'kit',      nome: 'Kit' }
  ];
})(window.OP.data);
