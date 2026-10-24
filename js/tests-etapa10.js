/* ==========================================================================
   js/tests-etapa10.js — verificações da Etapa 10 (condições, descanso,
   biografia, verificações, números, contraste, aparência e acessibilidade)
   --------------------------------------------------------------------------
   Não roda sozinho: o OP.runTests() (js/tests.js) chama OP.testesEtapa10(ajuda)
   e acrescenta estes casos aos antigos. `ajuda` traz o que o tests.js já tem
   pronto (fichaDeTeste).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  function testesEtapa10(ajuda) {
    const calc = OP.calc;
    const cfg = OP.data.config;
    const fichaDeTeste = ajuda.fichaDeTeste;

    /** Ficha com a regra NEX e Experiência ligada: { classe, nivel, nex (exposição), atributos }. */
    function fichaRegra(opc) {
      const f = fichaDeTeste({ classe: opc.classe || 'combatente', nex: 5, atributos: opc.atributos || {} });
      f.config.nexENivel = true;
      f.identificacao.nivel = opc.nivel || 1;
      f.identificacao.nex = opc.nex === undefined ? 0 : opc.nex;
      return f;
    }

    /** d20 que sai v (para forçar dados). */
    function r(valor, faces) { return (valor - 0.5) / faces; }

    /** Roda a conta com o gerador de dados trocado por uma fila e SEMPRE restaura o original. */
    function comDadosE10(fila, conta) {
      const original = OP.dados.getRng();
      let posicao = 0;
      OP.dados.setRng(function () { const v = fila[posicao]; posicao += 1; return v === undefined ? 0 : v; });
      try { return conta(); } finally { OP.dados.setRng(original); }
    }

    /** Troca o catálogo de condições durante a conta e SEMPRE restaura o original. */
    function comCatalogo(lista, conta) {
      const original = OP.data.condicoes;
      OP.data.condicoes = lista;
      try {
        return conta();
      } finally {
        OP.data.condicoes = original;
      }
    }

    // Catálogo de TESTE (não usa os números do arquivo real)
    const CATALOGO_TESTE = [
      { id: 'A', nome: 'A', categoria: 'medo', efeitos: { dadosPericias: -1 }, conferir: true },
      { id: 'B', nome: 'B', categoria: 'medo', efeitos: { dadosPericias: -2 }, conferir: true },
      { id: 'C', nome: 'C', categoria: 'mental', efeitos: { dadosAtributos: { for: -1 } }, conferir: true },
      { id: 'D', nome: 'D', categoria: 'mental', efeitos: { dadosAtributos: { for: -2, agi: -2 } }, conferir: true },
      { id: 'E', nome: 'E', categoria: 'defesa', efeitos: { defesa: -2 }, conferir: true },
      { id: 'F', nome: 'F', categoria: 'defesa', efeitos: { defesa: -5 }, conferir: true },
      { id: 'G', nome: 'G', categoria: 'movimento', efeitos: { deslocamentoMult: 0.5 }, conferir: true },
      { id: 'H', nome: 'H', categoria: 'movimento', efeitos: { deslocamentoMult: 0 }, conferir: true },
      { id: 'I', nome: 'I', categoria: 'fisica', implica: ['C', 'E'], efeitos: null, conferir: false }
    ];

    /** Aplica ids (ou objetos { id, ... }) como condições ativas de uma ficha. */
    function comCondicoes(ficha, condicoes) {
      ficha.condicoes.ativas = condicoes.map(function (c) {
        return OP.state.novaCondicao(typeof c === 'string' ? { id: c } : c);
      });
      return ficha;
    }

    /** Modificadores com o catálogo de teste. */
    function modDe(ids, ajustar) {
      return comCatalogo(CATALOGO_TESTE, function () {
        const ficha = comCondicoes(fichaDeTeste({}), ids);
        if (ajustar) ajustar(ficha);
        return calc.modificadoresCondicoes(ficha);
      });
    }

    /** Modificadores com o catálogo REAL (data/condicoes.js). */
    function reais(ids) {
      return calc.modificadoresCondicoes(comCondicoes(fichaDeTeste({}), ids));
    }

    function juntar(mod, campos) {
      return campos.map(function (c) { return c === 'for' || c === 'agi' ? mod.dadosAtributos[c] : mod[c]; }).join('/');
    }

    /** Combatente NEX 5% (PV máx 22) com PV atual, turnos e bônus do limite. */
    function fichaMorrendo(pv, turnos, bonus) {
      const ficha = fichaDeTeste({ classe: 'combatente', nex: 5, atributos: { vig: 2 } });
      ficha.recursos.pv.atual = pv;
      ficha.condicoes.turnosMorrendo = turnos;
      ficha.condicoes.bonusLimiteMorrendo = bonus || 0;
      return ficha;
    }
    function estadoMorrendo(pv, turnos, bonus) {
      const s = calc.statusMorrendo(fichaMorrendo(pv, turnos, bonus));
      return [s.morrendo, s.morto].join('/');
    }

    /** Ficha cujo PV, PE e SAN máximos são os indicados (ajusta o bônus de máximo). */
    function fichaComMaximos(pv, pe, san) {
      const ficha = fichaDeTeste({ classe: 'ocultista', nex: 35, atributos: { vig: 1, pre: 1 } });
      [['pv', pv], ['pe', pe], ['san', san]].forEach(function (par) {
        if (par[1] === null) return;
        ficha.recursos[par[0]].bonusMax = 0;
        ficha.recursos[par[0]].bonusMax = par[1] - calc.composicaoRecurso(ficha, par[0]).max;
      });
      return ficha;
    }
    function recuperar(maximos, atuais, ganhos) {
      const ficha = fichaComMaximos(maximos[0], maximos[1], maximos[2]);
      ficha.recursos.pv.atual = atuais[0];
      ficha.recursos.pe.atual = atuais[1];
      ficha.recursos.san.atual = atuais[2];
      const novo = calc.aplicarRecuperacao(ficha, { pv: ganhos[0], pe: ganhos[1], san: ganhos[2] });
      return [novo.pv, novo.pe, novo.san].join('/');
    }

    function importarJson(ficha) {
      return OP.state.lerImportacao(JSON.stringify({ formato: 'op-ficha', versao: 10, ficha: ficha }));
    }

    function idsUnicos(lista) {
      return new Set(lista.map(function (x) { return x.id; })).size === lista.length;
    }

    const NOMES_GUIA = ['abalado', 'apavorado', 'alquebrado', 'atordoado', 'cego', 'confuso', 'debilitado', 'enjoado', 'envenenado',
      'esmorecido', 'exausto', 'fascinado', 'fatigado', 'fraco', 'frustrado', 'lento', 'ofuscado', 'paralisado', 'pasmo', 'surdo'];

    const ocultista35 = fichaDeTeste({ classe: 'ocultista', nex: 35 });
    const limite35 = calc.limitePEporTurno(ocultista35);

    function descanso(tipo, condicao) {
      return calc.recuperacaoDescanso(ocultista35, tipo, condicao);
    }

    // Ficha válida de referência: Combatente NEX 5%, atributos 3/2/1/1/1 (9 no total)
    function fichaValida() {
      return fichaDeTeste({ classe: 'combatente', nex: 5, atributos: { agi: 2, for: 2, vig: 3, int: 1, pre: 1 } });
    }

    /** "--a×--b 4.1<4.5, ..." — texto dos pares reprovados (vazio = tudo certo). */
    function textoFalhas(falhas) {
      return falhas.map(function (f) { return f.a + '×' + f.b + ' ' + f.razao + '<' + f.minimo; }).join(', ');
    }

    /** Roda a conta com um armazenamento falso que já guarda as preferências indicadas. */
    function comPrefs(prefs, conta) {
      const falso = OP.storage.criarMemoria();
      falso.setItem(OP.prefs.CHAVE, JSON.stringify(prefs));
      const anterior = OP.storage.usar(falso);
      try {
        return conta();
      } finally {
        OP.storage.usar(anterior);
      }
    }

    const arquivoNovo = { length: 2, key: function (i) { return ['ab', 'x'][i]; }, getItem: function (k) { return { ab: 'cde', x: 'yz' }[k]; } };

    return [
      // --- Integridade dos dados ---
      { nome: 'E10 · 35 condições com ids únicos', obtido: function () { return OP.data.condicoes.length + '/' + idsUnicos(OP.data.condicoes); }, esperado: '35/true' },
      { nome: 'E10 · Toda condição tem categoria existente', obtido: function () { return OP.data.condicoes.filter(function (c) { return !OP.data.categoriasCondicao[c.categoria]; }).map(function (c) { return c.id; }).join(','); }, esperado: '' },
      { nome: 'E10 · Todo "implica" aponta para uma condição existente', obtido: function () {
        const ids = OP.data.condicoes.map(function (c) { return c.id; });
        return OP.data.condicoes.filter(function (c) { return (c.implica || []).some(function (i) { return ids.indexOf(i) === -1; }); }).map(function (c) { return c.id; }).join(',');
      }, esperado: '' },
      { nome: 'E10 · Os 20 nomes da lista do Guia estão no catálogo', obtido: function () { return NOMES_GUIA.filter(function (id) { return !OP.data.condicoes.some(function (c) { return c.id === id; }); }).join(','); }, esperado: '' },
      { nome: 'E10 · 4 temas, 4 tamanhos de texto e 10 pares de contraste', obtido: function () { return [OP.data.temas.length, OP.data.tamanhosFonte.length, OP.data.paresContraste.length].join('/'); }, esperado: '4/4/10' },
      { nome: 'E10 · Temas elementais por ficha continuam existindo (6)', obtido: function () { return OP.data.temasFicha.length; }, esperado: 6 },

      // --- Estado de saúde e de sanidade ---
      { nome: 'E10 · estadoSaude PV máx 20: 20 → ileso', obtido: function () { return calc.estadoSaude(20, 20); }, esperado: 'ileso' },
      { nome: 'E10 · estadoSaude PV máx 20: 19 e 11 → ferido', obtido: function () { return calc.estadoSaude(19, 20) + '/' + calc.estadoSaude(11, 20); }, esperado: 'ferido/ferido' },
      { nome: 'E10 · estadoSaude PV máx 20: 10 e 1 → machucado', obtido: function () { return calc.estadoSaude(10, 20) + '/' + calc.estadoSaude(1, 20); }, esperado: 'machucado/machucado' },
      { nome: 'E10 · estadoSaude PV máx 20: 0 → morrendo', obtido: function () { return calc.estadoSaude(0, 20); }, esperado: 'morrendo' },
      { nome: 'E10 · estadoSaude PV máx 37: 19 → ferido, 18 → machucado', obtido: function () { return calc.estadoSaude(19, 37) + '/' + calc.estadoSaude(18, 37); }, esperado: 'ferido/machucado' },
      { nome: 'E10 · estadoSaude PV máx 100: 51 → ferido, 50 → machucado', obtido: function () { return calc.estadoSaude(51, 100) + '/' + calc.estadoSaude(50, 100); }, esperado: 'ferido/machucado' },
      { nome: 'E10 · estadoSaude PV 25 com máx 20 → ileso; máx 0 → ileso', obtido: function () { return calc.estadoSaude(25, 20) + '/' + calc.estadoSaude(0, 0); }, esperado: 'ileso/ileso' },
      { nome: 'E10 · estadoSanidade SAN máx 20: 20 e 11 → sao', obtido: function () { return calc.estadoSanidade(20, 20) + '/' + calc.estadoSanidade(11, 20); }, esperado: 'sao/sao' },
      { nome: 'E10 · estadoSanidade SAN máx 20: 10 e 1 → perturbado', obtido: function () { return calc.estadoSanidade(10, 20) + '/' + calc.estadoSanidade(1, 20); }, esperado: 'perturbado/perturbado' },
      { nome: 'E10 · estadoSanidade SAN máx 20: 0 → enlouquecendo', obtido: function () { return calc.estadoSanidade(0, 20); }, esperado: 'enlouquecendo' },

      // --- Morrendo ---
      { nome: 'E10 · statusMorrendo: PV 5 → não está morrendo', obtido: function () { return estadoMorrendo(5, 0); }, esperado: 'false/false' },
      { nome: 'E10 · statusMorrendo: PV 0, turnos 2, limite 3 → morrendo e vivo', obtido: function () { return estadoMorrendo(0, 2); }, esperado: 'true/false' },
      { nome: 'E10 · statusMorrendo: PV 0, turnos 3 → morto', obtido: function () { return estadoMorrendo(0, 3); }, esperado: 'true/true' },
      { nome: 'E10 · statusMorrendo com bônus +1: turnos 3 → vivo, turnos 4 → morto', obtido: function () { return estadoMorrendo(0, 3, 1) + '|' + estadoMorrendo(0, 4, 1); }, esperado: 'true/false|true/true' },
      { nome: 'E10 · proximoTurnoMorrendo: 0 → 1 → 2 → 3 → 3 (não passa do limite)', obtido: function () { return [0, 1, 2, 3].map(function (t) { return calc.proximoTurnoMorrendo(fichaMorrendo(0, t)); }).join(','); }, esperado: '1,2,3,3' },
      { nome: 'E10 · Voltar a ter PV zera os turnos morrendo (correcoes)', obtido: function () { return calc.correcoes(fichaMorrendo(4, 2)).filter(function (c) { return c.caminho === 'condicoes.turnosMorrendo'; }).map(function (c) { return c.valor; }).join(','); }, esperado: '0' },
      { nome: 'E10 · Com PV 0 os turnos morrendo não são zerados', obtido: function () { return calc.correcoes(fichaMorrendo(0, 2)).filter(function (c) { return c.caminho === 'condicoes.turnosMorrendo'; }).length; }, esperado: 0 },

      // --- modificadoresCondicoes (catálogo de teste) ---
      { nome: 'E10 · Condição A → dadosPericias −1', obtido: function () { return modDe(['A']).dadosPericias; }, esperado: -1 },
      { nome: 'E10 · A + B (mesmo efeito) → dadosPericias −2 (vale o mais severo)', obtido: function () { return modDe(['A', 'B']).dadosPericias; }, esperado: -2 },
      { nome: 'E10 · C + D (mesmo efeito em FOR) → FOR −2 e AGI −2', obtido: function () { return juntar(modDe(['C', 'D']), ['for', 'agi']); }, esperado: '-2/-2' },
      { nome: 'E10 · E + F (mesmo efeito, Defesa) → −5, não −7', obtido: function () { return modDe(['E', 'F']).defesa; }, esperado: -5 },
      { nome: 'E10 · G → deslocamento × 0,5; G + H → 0', obtido: function () { return modDe(['G']).deslocamentoMult + '/' + modDe(['G', 'H']).deslocamentoMult; }, esperado: '0.5/0' },
      { nome: 'E10 · I + E → Defesa −2 (E conta uma vez) e FOR −1', obtido: function () { return juntar(modDe(['I', 'E']), ['defesa', 'for']); }, esperado: '-2/-1' },
      { nome: 'E10 · "Aplicar efeitos" desligado → tudo neutro', obtido: function () {
        const m = modDe(['A', 'E', 'G', 'C'], function (f) { f.condicoes.aplicarEfeitos = false; });
        return [m.dadosPericias, m.defesa, m.deslocamentoMult, m.dadosAtributos.for, m.origens.length].join('/');
      }, esperado: '0/0/1/0/0' },
      { nome: 'E10 · Personalizada (−1 dado, −1 Defesa) + A → dados −1 (mesmo efeito) e Defesa −1', obtido: function () {
        const m = modDe(['A', { id: 'personalizada', personalizada: { nome: 'Teste', dadosPericias: -1, defesa: -1, deslocamentoMult: 1 } }]);
        return m.dadosPericias + '/' + m.defesa;
      }, esperado: '-1/-1' },
      { nome: 'E10 · Duas personalizadas iguais não se acumulam', obtido: function () {
        const p = { id: 'personalizada', personalizada: { nome: 'P', dadosPericias: -1, defesa: 0, deslocamentoMult: 1 } };
        return modDe([p, p]).dadosPericias;
      }, esperado: -1 },
      { nome: 'E10 · condicoesEfetivas resolve "implica" sem repetir', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () { return calc.condicoesEfetivas(comCondicoes(fichaDeTeste({}), ['I', 'E', 'I']).condicoes).slice().sort().join(','); });
      }, esperado: 'C,E,I' },
      { nome: 'E10 · condicoesEfetivas não entra em laço infinito', obtido: function () {
        const laco = [{ id: 'X', nome: 'X', categoria: 'medo', implica: ['Y'], efeitos: null }, { id: 'Y', nome: 'Y', categoria: 'medo', implica: ['X'], efeitos: null }];
        return comCatalogo(laco, function () { return calc.condicoesEfetivas([{ id: 'X' }]).join(','); });
      }, esperado: 'X,Y' },
      { nome: 'E10 · Resumo de efeitos gerado dos números', obtido: function () { return calc.resumoEfeitos({ dadosPericias: -1, defesa: -2 }); }, esperado: '−1d20 em perícias; Defesa −2' },
      { nome: 'E10 · Catálogo real: Exausto implica Debilitado, Lento e Vulnerável (defesa −2, ×0,5)', obtido: function () {
        const f = comCondicoes(fichaDeTeste({}), ['exausto']);
        const m = calc.modificadoresCondicoes(f);
        return [m.defesa, m.deslocamentoMult, m.dadosAtributos.for].join('/');
      }, esperado: '-2/0.5/-2' },

      // --- modificadorDadosTeste ---
      { nome: 'E10 · modificadorDadosTeste: perícia de FOR → −2; de AGI → −1', obtido: function () {
        const m = { dadosPericias: -1, dadosAtributos: { for: -1 } };
        return calc.modificadorDadosTeste(m, { atributo: 'for', ehPericia: true }) + '/' + calc.modificadorDadosTeste(m, { atributo: 'agi', ehPericia: true });
      }, esperado: '-2/-1' },
      { nome: 'E10 · modificadorDadosTeste: teste puro de FOR → −1; de AGI → 0', obtido: function () {
        const m = { dadosPericias: -1, dadosAtributos: { for: -1 } };
        return calc.modificadorDadosTeste(m, { atributo: 'for', ehPericia: false }) + '/' + calc.modificadorDadosTeste(m, { atributo: 'agi', ehPericia: false });
      }, esperado: '-1/0' },

      // --- Integração (catálogo de teste) ---
      { nome: 'E10 · Atletismo com FOR 3 e a condição A → 2 dados (sem condição → 3)', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          const com = comCondicoes(fichaDeTeste({ atributos: { for: 3 } }), ['A']);
          return calc.periciaDados(com, 'atletismo').qtd + '/' + calc.periciaDados(fichaDeTeste({ atributos: { for: 3 } }), 'atletismo').qtd;
        });
      }, esperado: '2/3' },
      { nome: 'E10 · FOR 1 com a condição A = FOR 0 sem condição (mesma regra de dados ≤ 0)', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          const com = comCondicoes(fichaDeTeste({ atributos: { for: 1 } }), ['A']);
          return JSON.stringify(calc.periciaDados(com, 'atletismo')) === JSON.stringify(calc.periciaDados(fichaDeTeste({ atributos: { for: 0 } }), 'atletismo'));
        });
      }, esperado: true },
      { nome: 'E10 · A condição entra também no teste rolado (testePericia) e junto ao modificador do painel', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          const com = comCondicoes(fichaDeTeste({ atributos: { for: 3 } }), ['A']);
          return calc.testePericia(com, 'atletismo', 0).dados.qtd + '/' + calc.testePericia(com, 'atletismo', 1).dados.qtd;
        });
      }, esperado: '2/3' },
      { nome: 'E10 · Condição de atributo (D: FOR −2) só afeta perícias baseadas em FOR', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          const f = comCondicoes(fichaDeTeste({ atributos: { for: 3, agi: 3 } }), ['D']);
          return calc.periciaDados(f, 'atletismo').qtd + '/' + calc.periciaDados(f, 'acrobacia').qtd + '/' + calc.periciaDados(f, 'intuicao').qtd;
        });
      }, esperado: '1/1/1' },
      { nome: 'E10 · Defesa com E fica 2 abaixo da Defesa sem condição', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          return calc.defesaTotal(fichaDeTeste({})) - calc.defesaTotal(comCondicoes(fichaDeTeste({}), ['E']));
        });
      }, esperado: 2 },
      { nome: 'E10 · Deslocamento: base 9, sobrecarga −3 e G → 3 m; sem sobrecarga e G → 4,5 m', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          const sobre = comCondicoes(fichaDeTeste({ atributos: { for: 1 }, itens: [{ nome: 'Caixa', espacos: 6 }] }), ['G']);
          const leve = comCondicoes(fichaDeTeste({}), ['G']);
          return calc.deslocamento(sobre).metros + '/' + calc.deslocamento(leve).metros + '/' + calc.deslocamento(leve).quadrados;
        });
      }, esperado: '3/4.5/3' },

      // --- Condições do livro (catálogo real) ---
      { nome: 'E10 · Toda condição do catálogo tem texto do livro', obtido: function () { return OP.data.condicoes.filter(function (c) { return !c.descricao; }).map(function (c) { return c.id; }).join(','); }, esperado: '' },
      { nome: 'E10 · Catálogo real: nenhum efeito pendente de conferência', obtido: function () { return OP.data.condicoes.filter(function (c) { return c.conferir; }).length; }, esperado: 0 },
      { nome: 'E10 · Desprevenido + Vulnerável → Defesa −5, não −7 (livro)', obtido: function () { return reais(['desprevenido', 'vulneravel']).defesa; }, esperado: -5 },
      { nome: 'E10 · Indefeso (−10) + Desprevenido (−5) → Defesa −10', obtido: function () { return reais(['indefeso', 'desprevenido']).defesa; }, esperado: -10 },
      { nome: 'E10 · Abalado + Apavorado → −2d20 em perícias (vale o mais severo)', obtido: function () { return reais(['abalado', 'apavorado']).dadosPericias; }, esperado: -2 },
      { nome: 'E10 · Efeitos diferentes se acumulam: Abalado + Fraco → perícia de FOR −2, de INT −1', obtido: function () {
        const f = comCondicoes(fichaDeTeste({ atributos: { for: 3, int: 3 } }), ['abalado', 'fraco']);
        return calc.dadosCondicoesPericia(f, 'atletismo') + '/' + calc.dadosCondicoesPericia(f, 'ciencias');
      }, esperado: '-2/-1' },
      { nome: 'E10 · Cego + Debilitado → AGI e FOR −2 (mesmo efeito, não −4); VIG −2 só do Debilitado', obtido: function () { return juntar(reais(['cego', 'debilitado']), ['agi', 'for']) + '/' + reais(['cego', 'debilitado']).dadosAtributos.vig; }, esperado: '-2/-2/-2' },
      { nome: 'E10 · Cego implica Desprevenido e Lento (Defesa −5, deslocamento × 0,5)', obtido: function () { const m = reais(['cego']); return m.defesa + '/' + m.deslocamentoMult; }, esperado: '-5/0.5' },
      { nome: 'E10 · Surdo: −1d20 só em Iniciativa', obtido: function () {
        const f = comCondicoes(fichaDeTeste({ atributos: { agi: 3, pre: 3 } }), ['surdo']);
        return calc.periciaDados(f, 'iniciativa').qtd + '/' + calc.periciaDados(f, 'reflexos').qtd + '/' + calc.periciaDados(f, 'percepcao').qtd;
      }, esperado: '2/3/3' },
      { nome: 'E10 · Fascinado (−2) + Ofuscado (−1) em Percepção → −2 (vale o mais severo)', obtido: function () {
        const f = comCondicoes(fichaDeTeste({ atributos: { pre: 3 } }), ['fascinado', 'ofuscado']);
        return calc.dadosCondicoesPericia(f, 'percepcao');
      }, esperado: -2 },
      { nome: 'E10 · Desprevenido: −1d20 em Reflexos', obtido: function () {
        const f = comCondicoes(fichaDeTeste({ atributos: { agi: 3 } }), ['desprevenido']);
        return calc.periciaDados(f, 'reflexos').qtd + '/' + calc.periciaDados(f, 'acrobacia').qtd;
      }, esperado: '2/3' },
      { nome: 'E10 · Ofuscado: −1d20 em ataques (Luta e Pontaria) e em Percepção', obtido: function () {
        const f = comCondicoes(fichaDeTeste({ atributos: { for: 3, agi: 3, pre: 3 } }), ['ofuscado']);
        return [calc.ataqueTeste(f, { pericia: 'luta', testeBonus: 0 }, 0).dados.qtd, calc.ataqueTeste(f, { pericia: 'pontaria', testeBonus: 0 }, 0).dados.qtd, calc.periciaDados(f, 'percepcao').qtd].join('/');
      }, esperado: '2/2/2' },
      { nome: 'E10 · Caído: −2d20 só nos ataques corpo a corpo', obtido: function () {
        const f = comCondicoes(fichaDeTeste({ atributos: { for: 3, agi: 3 } }), ['caido']);
        return calc.ataqueTeste(f, { pericia: 'luta', testeBonus: 0 }, 0).dados.qtd + '/' + calc.ataqueTeste(f, { pericia: 'pontaria', testeBonus: 0 }, 0).dados.qtd + '/' + calc.periciaDados(f, 'luta').qtd;
      }, esperado: '1/3/3' },
      { nome: 'E10 · Agarrado (−1) + Caído (−2) em ataque corpo a corpo → −2 (mesmo efeito); à distância → −1', obtido: function () {
        const m = reais(['agarrado', 'caido']);
        return m.dadosAtaqueCorpoACorpo + '/' + m.dadosAtaque;
      }, esperado: '-2/-1' },
      { nome: 'E10 · Caído: Defesa −5 contra corpo a corpo, +5 à distância, 0 em geral', obtido: function () {
        const f = comCondicoes(fichaDeTeste({}), ['caido']);
        const d = calc.composicaoDefesa(f);
        const base = calc.defesaTotal(fichaDeTeste({}));
        return [d.total - base, d.totalCorpoACorpo - base, d.totalDistancia - base].join('/');
      }, esperado: '0/-5/5' },
      { nome: 'E10 · Caído + Desprevenido: contra corpo a corpo vale −5 (não −10); à distância −5 + 5 = 0', obtido: function () {
        const m = reais(['caido', 'desprevenido']);
        return m.defesa + '/' + m.defesaCorpoACorpo + '/' + m.defesaDistancia;
      }, esperado: '-5/-5/0' },
      { nome: 'E10 · Caído: deslocamento máximo 1,5 m (1 quadrado)', obtido: function () {
        const d = calc.deslocamento(comCondicoes(fichaDeTeste({}), ['caido']));
        return d.metros + '/' + d.quadrados;
      }, esperado: '1.5/1' },
      { nome: 'E10 · Lento: 9 m → 4,5 m; com +1,5 m de bônus (10,5) → 4,5 m (arredonda para baixo)', obtido: function () {
        const a = comCondicoes(fichaDeTeste({}), ['lento']);
        const b = comCondicoes(fichaDeTeste({}), ['lento']);
        b.defesa.deslocamentoBonus = 1.5;
        return calc.deslocamento(a).metros + '/' + calc.deslocamento(b).metros;
      }, esperado: '4.5/4.5' },
      { nome: 'E10 · Imóvel e Paralisado: deslocamento 0', obtido: function () {
        return calc.deslocamento(comCondicoes(fichaDeTeste({}), ['imovel'])).metros + '/' + calc.deslocamento(comCondicoes(fichaDeTeste({}), ['paralisado'])).metros;
      }, esperado: '0/0' },
      { nome: 'E10 · Paralisado implica Imóvel e Indefeso (Defesa −10)', obtido: function () { return reais(['paralisado']).defesa + '/' + calc.condicoesEfetivas(comCondicoes(fichaDeTeste({}), ['paralisado']).condicoes).slice().sort().join(','); }, esperado: '-10/desprevenido,imovel,indefeso,paralisado' },
      { nome: 'E10 · Petrificado: inconsciente, indefeso, resistência a dano 10', obtido: function () { const m = reais(['petrificado']); return m.defesa + '/' + m.resistenciaDano; }, esperado: '-10/10' },
      { nome: 'E10 · Exausto + Fraco → FOR −2 (Debilitado vale mais que Fraco)', obtido: function () { return reais(['exausto', 'fraco']).dadosAtributos.for; }, esperado: -2 },
      { nome: 'E10 · Alquebrado: +1 PE só no que já custa PE', obtido: function () {
        const f = comCondicoes(fichaDeTeste({}), ['alquebrado']);
        return [calc.custoComCondicoes(f, 2), calc.custoComCondicoes(f, 0), calc.custoComCondicoes(fichaDeTeste({}), 2)].join('/');
      }, esperado: '3/0/2' },
      { nome: 'E10 · Alquebrado: o plano de conjurar um ritual de 1º círculo custa 2 PE (1 + 1)', obtido: function () {
        const f = comCondicoes(fichaDeTeste({ classe: 'ocultista', nex: 35 }), ['alquebrado']);
        const ritual = OP.state.novoRitual({ nome: 'Teste', circulo: 1 });
        return calc.planoConjuracao(f, ritual, 'padrao').pe;
      }, esperado: 2 },
      { nome: 'E10 · Condições sem efeito numérico (Doente, Em Chamas…) não mudam os números', obtido: function () {
        const m = reais(['doente', 'emchamas', 'sangrando', 'asfixiado', 'confuso']);
        return [m.dadosPericias, m.defesa, m.deslocamentoMult, m.origens.length].join('/');
      }, esperado: '0/0/1/0' },
      { nome: 'E10 · estadoCondicoes traz lembretes e texto do livro', obtido: function () {
        const e = calc.estadoCondicoes(comCondicoes(fichaDeTeste({}), ['emchamas']));
        return e.ativas[0].lembretes.length > 0 && e.ativas[0].descricao.indexOf('1d6') !== -1;
      }, esperado: true },
      { nome: 'E10 · Resumo de efeitos: Caído', obtido: function () { return calc.resumoEfeitos(OP.data.condicoes.find(function (c) { return c.id === 'caido'; }).efeitos); }, esperado: '−2d20 em ataques corpo a corpo; Defesa −5 contra corpo a corpo; Defesa +5 contra ataques à distância; deslocamento máximo 1,5 m' },

      // --- Dano e cura ---
      { nome: 'E10 · aplicarDano: PV 10/20 com dano 4 → 6; dano 15 → 0 e morrendo', obtido: function () {
        const a = calc.aplicarDano(10, 20, 4);
        const b = calc.aplicarDano(10, 20, 15);
        return [a.pv, a.morrendo, b.pv, b.morrendo].join('/');
      }, esperado: '6/false/0/true' },
      { nome: 'E10 · Dano massivo: PV máx 20: 10 sim, 9 não; PV máx 37: 19 sim, 18 não', obtido: function () {
        return [calc.aplicarDano(20, 20, 10).massivo, calc.aplicarDano(20, 20, 9).massivo, calc.aplicarDano(37, 37, 19).massivo, calc.aplicarDano(37, 37, 18).massivo].join('/');
      }, esperado: 'true/false/true/false' },
      { nome: 'E10 · aplicarCura: 20 em PV 10/20 → 20; PV 25/20 com cura 5 → 25', obtido: function () { return calc.aplicarCura(10, 20, 20) + '/' + calc.aplicarCura(25, 20, 5); }, esperado: '20/25' },

      // --- Rodadas e fim da cena ---
      { nome: 'E10 · passarRodada: [2, indefinida, 1, até o fim da cena] → [1, indefinida, —, intacta]; removida só a de 1', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          const f = comCondicoes(fichaDeTeste({}), [{ id: 'A', rodadas: 2 }, { id: 'B', rodadas: null }, { id: 'C', rodadas: 1 }, { id: 'E', ateFimCena: true }]);
          const r = calc.passarRodada(f);
          return r.ativas.map(function (c) { return c.id + ':' + c.rodadas + ':' + c.ateFimCena; }).join(',') + '|' + r.removidas.map(function (c) { return c.id; }).join(',');
        });
      }, esperado: 'A:1:false,B:null:false,E:null:true|C' },
      { nome: 'E10 · passarRodada não altera a ficha', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          const f = comCondicoes(fichaDeTeste({}), [{ id: 'A', rodadas: 2 }]);
          calc.passarRodada(f);
          return f.condicoes.ativas[0].rodadas;
        });
      }, esperado: 2 },
      { nome: 'E10 · fimDaCena remove só as "até o fim da cena" e zera os turnos', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          const f = comCondicoes(fichaDeTeste({}), [{ id: 'A', rodadas: 2 }, { id: 'B' }, { id: 'E', ateFimCena: true }]);
          f.condicoes.turnosMorrendo = 2;
          const r = calc.fimDaCena(f);
          return r.ativas.map(function (c) { return c.id; }).join(',') + '|' + r.removidas.map(function (c) { return c.id; }).join(',') + '|' + r.turnosMorrendo;
        });
      }, esperado: 'A,B|E|0' },

      // --- Descanso ---
      { nome: 'E10 · Ocultista NEX 35%: limite de PE por turno 7', obtido: function () { return limite35; }, esperado: 7 },
      { nome: 'E10 · Meditação normal → 14 PE (confirmado pelo Guia); só PE', obtido: function () { const r = descanso('meditacao', 'normal'); return [r.pv, r.pe, r.san].join('/'); }, esperado: '0/14/0' },
      { nome: 'E10 · Meditação precária → 7 PE', obtido: function () { return descanso('meditacao', 'precaria').pe; }, esperado: 7 },
      { nome: 'E10 · Meditação confortável e luxuosa → limite × valor da config', obtido: function () {
        return descanso('meditacao', 'confortavel').pe + '/' + descanso('meditacao', 'luxuosa').pe;
      }, esperado: (limite35 * cfg.descanso.meditacaoPorLimitePE.confortavel) + '/' + (limite35 * cfg.descanso.meditacaoPorLimitePE.luxuosa) },
      { nome: 'E10 · Dormir normal devolve PV, PE e SAN numéricos (SAN = config)', obtido: function () {
        const r = descanso('dormir', 'normal');
        return [typeof r.pv, typeof r.pe, typeof r.san, r.san === cfg.descanso.dormir.san.normal].join('/');
      }, esperado: 'number/number/number/true' },
      { nome: 'E10 · Condição de descanso inválida vira "normal"', obtido: function () { return descanso('meditacao', 'xyz').pe; }, esperado: 14 },
      { nome: 'E10 · aplicarRecuperacao: PE 3/20 + 14 → 17', obtido: function () { return recuperar([30, 20, 30], [30, 3, 30], [0, 14, 0]); }, esperado: '30/17/30' },
      { nome: 'E10 · aplicarRecuperacao: PE 15/20 + 14 → 20 (não passa do máximo)', obtido: function () { return recuperar([30, 20, 30], [30, 15, 30], [0, 14, 0]); }, esperado: '30/20/30' },
      { nome: 'E10 · aplicarRecuperacao: PV 12/15 + 0 → 12 (nunca desce)', obtido: function () { return recuperar([15, 20, 30], [12, 20, 30], [0, 0, 0]); }, esperado: '12/20/30' },
      { nome: 'E10 · aplicarRecuperacao: PV 17/15 + 5 → 17 (temporário não muda)', obtido: function () { return recuperar([15, 20, 30], [17, 20, 30], [5, 0, 0]); }, esperado: '17/20/30' },
      { nome: 'E10 · aplicarRecuperacao não altera a ficha', obtido: function () {
        const f = fichaComMaximos(15, 20, 30);
        f.recursos.pe.atual = 3;
        calc.aplicarRecuperacao(f, { pe: 10 });
        return f.recursos.pe.atual;
      }, esperado: 3 },

      // --- lerNumero ---
      { nome: 'E10 · lerNumero: "1,5" e "1.5" → 1,5', obtido: function () { return calc.lerNumero('1,5') + '/' + calc.lerNumero('1.5'); }, esperado: '1.5/1.5' },
      { nome: 'E10 · lerNumero: "  12 " → 12; "−3" (U+2212) → −3', obtido: function () { return calc.lerNumero('  12 ') + '/' + calc.lerNumero('−3'); }, esperado: '12/-3' },
      { nome: 'E10 · lerNumero: inválido volta ao padrão', obtido: function () { return calc.lerNumero('abc', { padrao: 7 }) + '/' + calc.lerNumero('', { padrao: 0 }) + '/' + calc.lerNumero('1,2,3', { padrao: 9 }); }, esperado: '7/0/9' },
      { nome: 'E10 · lerNumero: max 10 com "15" → 10; min 0 com "-2" → 0', obtido: function () { return calc.lerNumero('15', { max: 10 }) + '/' + calc.lerNumero('-2', { min: 0 }); }, esperado: '10/0' },
      { nome: 'E10 · lerNumero: inteiro arredonda "2,5" → 3', obtido: function () { return calc.lerNumero('2,5', { inteiro: true }); }, esperado: 3 },

      // --- Contraste WCAG ---
      { nome: 'E10 · contrasteWCAG: preto × branco → 21; branco × branco → 1', obtido: function () { return calc.contrasteWCAG('#000000', '#ffffff') + '/' + calc.contrasteWCAG('#ffffff', '#ffffff'); }, esperado: '21/1' },
      { nome: 'E10 · contrasteWCAG: #767676 × branco → 4,54 (±0,01), em qualquer ordem', obtido: function () {
        const a = calc.contrasteWCAG('#767676', '#ffffff');
        const b = calc.contrasteWCAG('#ffffff', '#767676');
        return Math.abs(a - 4.54) <= 0.01 && a === b;
      }, esperado: true },

      // --- Retrato ---
      { nome: 'E10 · retratoValido aceita PNG e JPEG em base64', obtido: function () { return calc.retratoValido('data:image/png;base64,iVBORw0KGgo=') + '/' + calc.retratoValido('data:image/jpeg;base64,/9j/4AAQ'); }, esperado: 'true/true' },
      { nome: 'E10 · retratoValido rejeita SVG, HTML, javascript:, http, vazio e texto grande demais', obtido: function () {
        const demais = 'data:image/png;base64,' + new Array(cfg.retratoMaxChars + 1).join('A');
        return ['data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGgxPg==', 'javascript:alert(1)', 'http://x/y.png', '', demais, null, 5]
          .map(calc.retratoValido).join(',');
      }, esperado: 'false,false,false,false,false,false,false,false' },

      // --- Armazenamento ---
      { nome: 'E10 · estimarUso: "ab"→"cde" e "x"→"yz" → 16 bytes', obtido: function () { return OP.storage.estimarUso(arquivoNovo); }, esperado: 16 },
      { nome: 'E10 · estimarUso de armazenamento vazio ou ilegível → 0', obtido: function () { return OP.storage.estimarUso({ length: 0 }) + '/' + OP.storage.estimarUso(null); }, esperado: '0/0' },

      // --- verificarFicha ---
      { nome: 'E10 · verificarFicha: ficha padrão válida → lista vazia', obtido: function () { return JSON.stringify(calc.verificarFicha(fichaValida())); }, esperado: '[]' },
      { nome: 'E10 · verificarFicha: PV atual acima do máximo → "pv-acima-max"', obtido: function () {
        const f = fichaValida();
        f.recursos.pv.atual = calc.pvMax(f) + 5;
        return calc.verificarFicha(f).map(function (v) { return v.codigo; }).join(',');
      }, esperado: 'pv-acima-max' },
      { nome: 'E10 · verificarFicha: PE e SAN acima do máximo → "pe-acima-max" e "san-acima-max"', obtido: function () {
        const f = fichaValida();
        f.recursos.pe.atual = calc.peMax(f) + 1;
        f.recursos.san.atual = calc.sanMax(f) + 1;
        return calc.verificarFicha(f).map(function (v) { return v.codigo; }).join(',');
      }, esperado: 'pe-acima-max,san-acima-max' },
      { nome: 'E10 · verificarFicha: atributos somando 12 no NEX 5% → aviso de atributos', obtido: function () {
        const f = fichaDeTeste({ classe: 'combatente', nex: 5, atributos: { agi: 3, for: 3, vig: 3, int: 2, pre: 1 } });
        return calc.verificarFicha(f).some(function (v) { return v.codigo === 'atributos-pontos' && v.severidade === 'aviso' && v.secao === 'atributos' && v.campo === 'atr-agi-base'; });
      }, esperado: true },
      { nome: 'E10 · verificarFicha: a mesma ficha em modo livre → lista vazia', obtido: function () {
        const f = fichaDeTeste({ classe: 'combatente', nex: 5, atributos: { agi: 3, for: 3, vig: 3, int: 2, pre: 1 } });
        f.recursos.pv.atual = 999;
        f.config.modoLivre = true;
        return calc.verificarFicha(f).length;
      }, esperado: 0 },
      { nome: 'E10 · verificarFicha: turnos morrendo acima do limite → aviso', obtido: function () {
        return calc.verificarFicha(fichaMorrendo(0, 9)).map(function (v) { return v.codigo; }).join(',');
      }, esperado: 'turnos-morrendo-acima' },
      { nome: 'E10 · verificarFicha: condição com efeito "conferir" aplicado → linha "info"', obtido: function () {
        return comCatalogo(CATALOGO_TESTE, function () {
          const f = comCondicoes(fichaValida(), ['A']);
          const v = calc.verificarFicha(f).filter(function (x) { return x.codigo === 'condicoes-conferir'; });
          return v.length + '/' + (v[0] && v[0].severidade);
        });
      }, esperado: '1/info' },
      { nome: 'E10 · verificarFicha: sem aplicar efeitos não há linha "info"', obtido: function () {
        const f = comCondicoes(fichaValida(), ['abalado']);
        f.condicoes.aplicarEfeitos = false;
        return calc.verificarFicha(f).length;
      }, esperado: 0 },
      { nome: 'E10 · verificarFicha: ritual de 4º círculo com NEX 5% → aviso de círculo', obtido: function () {
        const f = fichaValida();
        f.rituais = [OP.state.novoRitual({ nome: 'Grande', circulo: 4 })];
        return calc.verificarFicha(f).map(function (v) { return v.codigo; }).join(',');
      }, esperado: 'ritual-fora-circulo' },
      { nome: 'E10 · verificarFicha: sobrecarga e itens acima da patente', obtido: function () {
        const f = fichaDeTeste({ classe: 'combatente', nex: 5, atributos: { agi: 2, for: 1, vig: 3, int: 1, pre: 1 }, itens: [{ nome: 'Caixa', espacos: 6, categoria: 2 }] });
        return calc.verificarFicha(f).map(function (v) { return v.codigo; }).join(',');
      }, esperado: 'sobrecarga,categoria-acima-patente' },

      // --- Modelo e migração (versão 10) ---
      { nome: 'E10 · versaoModelo é 12', obtido: function () { return [OP.state.VERSAO_MODELO, OP.state.criarFichaVazia().versaoModelo].join('/'); }, esperado: '12/12' },
      { nome: 'E10 · Migração: ficha v9 sem condições/descanso/biografia abre com os padrões', obtido: function () {
        const f = OP.state.completarPadroes({ versaoModelo: 9, identificacao: { nome: 'Antigo' } });
        return [f.condicoes.ativas.length, f.condicoes.turnosMorrendo, f.condicoes.aplicarEfeitos, f.biografia.diario.length, f.descanso.condicao].join('/');
      }, esperado: '0/0/true/0/normal' },
      { nome: 'E10 · Migração: aparência, histórico e anotações antigos vão para a biografia', obtido: function () {
        const f = OP.state.completarPadroes({ versaoModelo: 9, descricao: { aparencia: 'Alto', personalidade: 'Calmo', historico: 'Veio de longe', objetivo: 'Voltar', anotacoes: 'Pista 1' } });
        return [f.biografia.aparencia, f.biografia.personalidade, f.biografia.historico, f.biografia.objetivo, f.biografia.notas, Object.prototype.hasOwnProperty.call(f, 'descricao')].join('|');
      }, esperado: 'Alto|Calmo|Veio de longe|Voltar|Pista 1|false' },
      { nome: 'E10 · Migração não perde texto quando biografia e descrição já têm conteúdo', obtido: function () {
        const f = OP.state.completarPadroes({ descricao: { historico: 'Antigo' }, biografia: { historico: 'Novo' } });
        return f.biografia.historico;
      }, esperado: 'Novo\n\nAntigo' },
      { nome: 'E10 · completarPadroes é idempotente com a biografia migrada', obtido: function () {
        const a = OP.state.completarPadroes({ descricao: { anotacoes: 'x' } });
        return JSON.stringify(OP.state.completarPadroes(a)) === JSON.stringify(a);
      }, esperado: true },
      { nome: 'E10 · Importação: id de condição inexistente é removido', obtido: function () {
        const f = importarJson({ condicoes: { ativas: [{ id: 'inexistente' }, { id: 'abalado' }] } }).fichas[0];
        return f.condicoes.ativas.map(function (c) { return c.id; }).join(',');
      }, esperado: 'abalado' },
      { nome: 'E10 · Importação: rodadas "abc" → null; 150 → 99; 2,7 → 2', obtido: function () {
        const f = importarJson({ condicoes: { ativas: [{ id: 'abalado', rodadas: 'abc' }, { id: 'cego', rodadas: 150 }, { id: 'surdo', rodadas: 2.7 }] } }).fichas[0];
        return f.condicoes.ativas.map(function (c) { return String(c.rodadas); }).join(',');
      }, esperado: 'null,99,2' },
      { nome: 'E10 · Importação: turnosMorrendo −3 → 0 e 99 → 20', obtido: function () {
        return importarJson({ condicoes: { turnosMorrendo: -3 } }).fichas[0].condicoes.turnosMorrendo + '/' + importarJson({ condicoes: { turnosMorrendo: 99 } }).fichas[0].condicoes.turnosMorrendo;
      }, esperado: '0/20' },
      { nome: 'E10 · Importação: retrato inválido → ""; válido é mantido', obtido: function () {
        return importarJson({ biografia: { retrato: 'javascript:alert(1)' } }).fichas[0].biografia.retrato + '|' +
          importarJson({ biografia: { retrato: 'data:image/jpeg;base64,/9j/4AAQ' } }).fichas[0].biografia.retrato;
      }, esperado: '|data:image/jpeg;base64,/9j/4AAQ' },
      { nome: 'E10 · Importação: SVG como retrato é descartado', obtido: function () { return importarJson({ biografia: { retrato: 'data:image/svg+xml;base64,PHN2Zz4=' } }).fichas[0].biografia.retrato; }, esperado: '' },
      { nome: 'E10 · Limites: 60 condições → 50; 250 diário → 200; 150 aliados → 100', obtido: function () {
        const cat = OP.data.condicoes;
        const condicoes = [];
        for (let i = 0; i < 60; i++) condicoes.push({ id: 'personalizada' });
        const diario = [];
        for (let i = 0; i < 250; i++) diario.push({ titulo: 'D' + i });
        const aliados = [];
        for (let i = 0; i < 150; i++) aliados.push({ nome: 'A' + i });
        const f = importarJson({ condicoes: { ativas: condicoes }, biografia: { diario: diario, aliados: aliados } }).fichas[0];
        return [f.condicoes.ativas.length, f.biografia.diario.length, f.biografia.aliados.length, cat === OP.data.condicoes].join('/');
      }, esperado: '50/200/100/true' },
      { nome: 'E10 · Limites de texto: diário até 20000; notas até 20000; aparência 5000', obtido: function () {
        const f = importarJson({ biografia: { diario: [{ texto: new Array(20101).join('a') }], notas: new Array(20101).join('b'), aparencia: new Array(5101).join('c') } }).fichas[0];
        return [f.biografia.diario[0].texto.length, f.biografia.notas.length, f.biografia.aparencia.length].join('/');
      }, esperado: '20000/20000/5000' },
      { nome: 'E10 · Condições personalizadas repetidas ganham uid único e mantêm os números', obtido: function () {
        const p = { id: 'personalizada', personalizada: { nome: 'Dor', dadosPericias: -1, defesa: -1, deslocamentoMult: 0.5 } };
        const f = OP.state.completarPadroes({ condicoes: { ativas: [p, p] } });
        return [f.condicoes.ativas.length, f.condicoes.ativas[0].uid !== f.condicoes.ativas[1].uid, f.condicoes.ativas[1].personalizada.deslocamentoMult].join('/');
      }, esperado: '2/true/0.5' },
      // --- Temas, aparência e preferências ---
      { nome: 'E10 · Contraste (escuro): todos os pares cumprem o mínimo', obtido: function () { return textoFalhas(OP.ui.auditarContraste('escuro')); }, esperado: '' },
      { nome: 'E10 · Contraste (claro): todos os pares cumprem o mínimo', obtido: function () { return textoFalhas(OP.ui.auditarContraste('claro')); }, esperado: '' },
      { nome: 'E10 · Contraste (alto contraste): todos os pares cumprem o mínimo alto', obtido: function () { return textoFalhas(OP.ui.auditarContraste('contraste')); }, esperado: '' },
      { nome: 'E10 · Contraste (automático): cumpre o mínimo', obtido: function () { return textoFalhas(OP.ui.auditarContraste('auto')); }, esperado: '' },
      { nome: 'E10 · auditarContraste restaura o data-tema do <html>', obtido: function () {
        const raiz = document.documentElement;
        const antes = raiz.getAttribute('data-tema');
        OP.ui.auditarContraste('claro');
        return raiz.getAttribute('data-tema') === antes;
      }, esperado: true },
      { nome: 'E10 · Toda variável dos pares existe (em #rrggbb) nos temas escuro, claro e alto contraste', obtido: function () {
        const raiz = document.documentElement;
        const antes = raiz.getAttribute('data-tema');
        const ruins = [];
        try {
          ['escuro', 'claro', 'contraste'].forEach(function (tema) {
            raiz.setAttribute('data-tema', tema);
            const estilo = getComputedStyle(raiz);
            OP.data.paresContraste.forEach(function (par) {
              [par.a, par.b].forEach(function (nome) {
                if (!/^#[0-9a-fA-F]{6}$/.test(estilo.getPropertyValue(nome).trim())) ruins.push(tema + ':' + nome);
              });
            });
          });
        } finally {
          if (antes === null) raiz.removeAttribute('data-tema');
          else raiz.setAttribute('data-tema', antes);
        }
        return ruins.join(',');
      }, esperado: '' },
      { nome: 'E10 · Prefs: sem tema → "auto"; tema "xyz" → "auto"; tamanho "zz" → "m"', obtido: function () {
        return comPrefs({}, function () { return OP.prefs.ler().tema; }) + '/' +
          comPrefs({ tema: 'xyz' }, function () { return OP.prefs.ler().tema; }) + '/' +
          comPrefs({ tamanhoFonte: 'zz' }, function () { return OP.prefs.ler().tamanhoFonte; });
      }, esperado: 'auto/auto/m' },
      { nome: 'E10 · Prefs: movimento inválido → "auto"; diário na impressão padrão desligado', obtido: function () {
        return comPrefs({ movimento: 'talvez' }, function () { const p = OP.prefs.ler(); return p.movimento + '/' + p.incluirDiarioNaImpressao; });
      }, esperado: 'auto/false' },
      { nome: 'E10 · Prefs: valores válidos são mantidos', obtido: function () {
        return comPrefs({ tema: 'contraste', tamanhoFonte: 'gg', movimento: 'nao', incluirDiarioNaImpressao: true }, function () {
          const p = OP.prefs.ler();
          return [p.tema, p.tamanhoFonte, p.movimento, p.incluirDiarioNaImpressao].join('/');
        });
      }, esperado: 'contraste/gg/nao/true' },
      { nome: 'E10 · Prefs: definirAparencia ignora valor inválido e guarda o válido', obtido: function () {
        return comPrefs({}, function () {
          OP.prefs.definirAparencia({ tema: 'claro', tamanhoFonte: 'zz' });
          const p = OP.prefs.aparencia();
          return p.tema + '/' + p.tamanhoFonte;
        });
      }, esperado: 'claro/m' },
      { nome: 'E10 · Prefs de aparência não vão para a ficha exportada', obtido: function () {
        const texto = JSON.stringify(OP.state.envelopeFicha(fichaValida()));
        return /tamanhoFonte|movimento|"tema"/.test(texto);
      }, esperado: false },
      { nome: 'E10 · aplicarAparencia põe e tira os atributos do <html>', obtido: function () {
        const raiz = document.documentElement;
        const antes = ['data-tema', 'data-fonte', 'data-movimento'].map(function (a) { return raiz.getAttribute(a); });
        try {
          OP.ui.aplicarAparencia({ tema: 'claro', tamanhoFonte: 'g', movimento: 'nao' });
          const a = ['data-tema', 'data-fonte', 'data-movimento'].map(function (n) { return raiz.getAttribute(n); }).join('/');
          OP.ui.aplicarAparencia({ tema: 'auto', tamanhoFonte: 'm', movimento: 'auto' });
          const b = ['data-tema', 'data-fonte', 'data-movimento'].map(function (n) { return String(raiz.getAttribute(n)); }).join('/');
          return a + '|' + b;
        } finally {
          ['data-tema', 'data-fonte', 'data-movimento'].forEach(function (n, i) {
            if (antes[i] === null) raiz.removeAttribute(n);
            else raiz.setAttribute(n, antes[i]);
          });
        }
      }, esperado: 'claro/g/nao|null/m/null' },
      { nome: 'E10 · Tamanho do texto: data-fonte define o font-size do :root (14, 16, 18, 20 px)', obtido: function () {
        const raiz = document.documentElement;
        const antes = raiz.getAttribute('data-fonte');
        try {
          return OP.data.tamanhosFonte.map(function (t) {
            raiz.setAttribute('data-fonte', t.id);
            return getComputedStyle(raiz).fontSize === t.px + 'px';
          }).join(',');
        } finally {
          if (antes === null) raiz.removeAttribute('data-fonte');
          else raiz.setAttribute('data-fonte', antes);
        }
      }, esperado: 'true,true,true,true' },

      // --- Estrutura da página e acessibilidade (DOM) ---
      { nome: 'E10 · OP.ui.auditarAcessibilidade() com a ficha renderizada → lista vazia', obtido: function () {
        return OP.ui.auditarAcessibilidade().map(function (p) { return p.tipo + ' ' + OP.ui.descrever(p.elemento) + ' (' + p.motivo + ')'; }).join('; ');
      }, esperado: '' },
      // --- Linha de perícia compacta (botão de grau) ---
      { nome: 'E10 · Toda perícia tem botão de grau com rótulo e nível', obtido: function () {
        return OP.data.pericias.filter(function (p) {
          const b = document.querySelector('[data-pericia="' + p.id + '"] .botao-grau');
          return !b || !/^Grau de /.test(b.getAttribute('aria-label') || '') || !/^[0-3]$/.test(b.dataset.nivel);
        }).length;
      }, esperado: 0 },
      { nome: 'E10 · Botão de grau: Destreinado → Treinado → Veterano → Expert → Destreinado', obtido: function () {
        const ficha = OP.state.ficha;
        const botao = document.querySelector('[data-pericia="luta"] .botao-grau');
        const antes = ficha.pericias.luta.grau;
        const concedida = OP.calc.estadoPericia(ficha, 'luta').concedidaPor;
        if (!botao || concedida) return 'sem botão ou concedida';
        const modo = document.getElementById('botao-modo-pericias');
        const estavaEmEdicao = modo.getAttribute('aria-pressed') === 'true';
        if (!estavaEmEdicao) modo.click();
        try {
          OP.state.atualizar('pericias.luta.grau', 0);
          const graus = [];
          for (let i = 0; i < 4; i++) {
            botao.click();
            graus.push(OP.state.ficha.pericias.luta.grau);
          }
          return graus.join(',');
        } finally {
          OP.state.atualizar('pericias.luta.grau', antes);
          if (!estavaEmEdicao) modo.click();
        }
      }, esperado: '1,2,3,0' },
      { nome: 'E10 · Na mesa o botão de grau fica desligado e não muda o grau; em "Editar perícias" funciona', obtido: function () {
        const botao = document.querySelector('[data-pericia="luta"] .botao-grau');
        const modo = document.getElementById('botao-modo-pericias');
        const estavaEmEdicao = modo.getAttribute('aria-pressed') === 'true';
        const antes = OP.state.ficha.pericias.luta.grau;
        try {
          if (estavaEmEdicao) modo.click();
          const naMesa = botao.disabled;
          botao.click();
          const naoMudou = OP.state.ficha.pericias.luta.grau === antes;
          modo.click();
          return [naMesa, naoMudou, botao.disabled].join('/');
        } finally {
          OP.state.atualizar('pericias.luta.grau', antes);
          if (modo.getAttribute('aria-pressed') === 'true' && !estavaEmEdicao) modo.click();
          if (modo.getAttribute('aria-pressed') !== 'true' && estavaEmEdicao) modo.click();
        }
      }, esperado: 'true/true/false' },
      { nome: 'E10 · Perícia "somente treinada" sem grau pede treinamento só por símbolo (sem texto "requer treinamento")', obtido: function () {
        return document.querySelectorAll('.pericia__requer').length + '/' + document.querySelector('.tabela-pericias').textContent.indexOf('requer treinamento');
      }, esperado: '0/-1' },

      // --- Atributo da perícia pela sigla ---
      { nome: 'E10 · Toda perícia tem a sigla do atributo como botão com rótulo', obtido: function () {
        return OP.data.pericias.filter(function (p) {
          const b = document.querySelector('[data-pericia="' + p.id + '"] .atributo-sigla');
          return !b || !b.textContent || !/^Atributo de /.test(b.getAttribute('aria-label') || '');
        }).length;
      }, esperado: 0 },
      { nome: 'E10 · Sigla → painel → outro atributo → "Voltar ao padrão" (e o painel fecha)', obtido: function () {
        const ficha = OP.state.ficha;
        const antes = ficha.pericias.luta.atributo;
        const sigla = document.querySelector('[data-pericia="luta"] .atributo-sigla');
        const painel = document.getElementById('seletor-atributo');
        if (!sigla || !painel) return 'sem botão ou painel';
        try {
          OP.state.atualizar('pericias.luta.atributo', null);
          sigla.click();
          const abriu = !painel.hidden;
          painel.querySelector('[data-atributo="agi"]').click();
          const trocou = OP.state.ficha.pericias.luta.atributo + '/' + painel.hidden;
          sigla.click();
          const voltarAtivo = !painel.querySelector('[data-padrao]').disabled;
          painel.querySelector('[data-padrao]').click();
          return [abriu, trocou, voltarAtivo, String(OP.state.ficha.pericias.luta.atributo), painel.hidden].join('|');
        } finally {
          if (!painel.hidden) painel.querySelector('[data-padrao]').click();
          OP.state.atualizar('pericias.luta.atributo', antes);
        }
      }, esperado: 'true|agi/true|true|null|true' },
      { nome: 'E10 · Painel do atributo: "Voltar ao padrão" fica desligado quando já é o padrão', obtido: function () {
        const sigla = document.querySelector('[data-pericia="luta"] .atributo-sigla');
        const painel = document.getElementById('seletor-atributo');
        if (OP.state.ficha.pericias.luta.atributo !== null) return 'luta com atributo trocado';
        sigla.click();
        const desligado = painel.querySelector('[data-padrao]').disabled;
        sigla.click();
        return desligado + '/' + painel.hidden;
      }, esperado: 'true/true' },

      { nome: 'E10 · A marca de "menor" só aparece nas perícias que rolam o menor (e o rótulo diz quantos dados)', obtido: function () {
        return OP.data.pericias.filter(function (p) {
          const dados = OP.calc.periciaDados(OP.state.ficha, p.id);
          const marca = document.querySelector('[data-pericia="' + p.id + '"] .marca-menor');
          const rolar = document.querySelector('[data-pericia="' + p.id + '"] .botao-icone--rolar');
          const rotuloOk = rolar && rolar.getAttribute('aria-label') === 'Rolar ' + p.nome + ' (' + dados.qtd + 'd20, fica o ' + dados.modo + ')';
          return !marca || marca.hidden !== (dados.modo !== 'menor') || !rotuloOk;
        }).length;
      }, esperado: 0 },

      { nome: 'E11 · A folha de ajuste de vital abre já com o valor (não "— / —")', obtido: function () {
        const botao = document.querySelector('[data-abrir-vital="pv"]');
        const dialogo = document.getElementById('dialogo-vital');
        if (!botao || !dialogo) return 'sem botão ou diálogo';
        const classeAntes = OP.state.ficha.identificacao.classe;
        try {
          OP.state.atualizar('identificacao.classe', 'combatente');
          botao.click();
          const lido = document.getElementById('vital-atual').textContent;
          return lido !== '—' && lido !== '';
        } finally {
          if (dialogo.open) dialogo.close();
          OP.state.atualizar('identificacao.classe', classeAntes);
        }
      }, esperado: true },
      // --- Resultado fixo e perícia na mesa ---
      { nome: 'E11 · A faixa de resultado está sempre presente: vazia no começo, com o total grande depois de rolar, e volta a vazia ao trocar de ficha', obtido: function () {
        const caixa = document.getElementById('resultado-rapido');
        const botao = document.querySelector('[data-pericia="luta"] [data-rolar-pericia]');
        if (!caixa || !botao) return 'sem faixa ou botão';
        const idAntes = OP.state.ficha.id;
        document.querySelector('[data-dado-rapido="1d6"]'); // garante o painel montado
        botao.click();
        const total = document.getElementById('rr-total').textContent;
        const mostrou = caixa.getAttribute('data-vazio') === 'nao' && /^-?\d+$/.test(total) && document.getElementById('rr-titulo').textContent.indexOf('Luta') !== -1 && !caixa.hidden;
        return mostrou + '/' + idAntes.length;
      }, esperado: 'true/' + OP.state.ficha.id.length },
      { nome: 'E11 · Na mesa o grau é um marcador (T, V, E) e "outros" some; em edição voltam o botão e o campo', obtido: function () {
        const secao = document.getElementById('secao-pericias');
        const modo = document.getElementById('botao-modo-pericias');
        const estavaEmEdicao = modo.getAttribute('aria-pressed') === 'true';
        const marcaOk = function () {
          return OP.data.pericias.every(function (p) {
            const marca = document.querySelector('[data-pericia="' + p.id + '"] .pericia__grau-marca');
            const grau = OP.calc.estadoPericia(OP.state.ficha, p.id).grau;
            return marca.textContent === ['', 'T', 'V', 'E'][grau];
          });
        };
        try {
          if (estavaEmEdicao) modo.click();
          const celulaOutros = document.querySelector('[data-pericia="luta"] .pericia__outros');
          const outrosNaMesa = getComputedStyle(celulaOutros).display === 'none' ? 0 : 1;
          const marcas = marcaOk();
          modo.click();
          const outrosEmEdicao = getComputedStyle(celulaOutros).display !== 'none';
          return [secao.dataset.modo, outrosNaMesa, marcas, outrosEmEdicao].join('/');
        } finally {
          if ((modo.getAttribute('aria-pressed') === 'true') !== estavaEmEdicao) modo.click();
        }
      }, esperado: 'edicao/0/true/true' },

      // --- Rodada de revisão de design ---
      { nome: 'E12 · Atalhos de teclado: a tecla "5" abre Rituais (a numeração é a do índice, igual nos dois tamanhos)', obtido: function () {
        const antes = OP.uiPaginas.atual();
        const vistaAntes = document.body.dataset.vista;
        try {
          document.body.dataset.vista = 'ficha';
          document.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
          return OP.uiPaginas.atual() === 'rituais';
        } finally {
          document.body.dataset.vista = vistaAntes;
          OP.uiPaginas.ir(antes, { rolar: false, anunciar: false });
        }
      }, esperado: true },
      { nome: 'E12 · Digitar "5" num campo de texto não troca de página', obtido: function () {
        const antes = OP.uiPaginas.atual();
        const vistaAntes = document.body.dataset.vista;
        const campo = document.getElementById('campo-jogador');
        try {
          document.body.dataset.vista = 'ficha';
          campo.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
          return OP.uiPaginas.atual() === antes;
        } finally {
          document.body.dataset.vista = vistaAntes;
        }
      }, esperado: true },
      { nome: 'E12 · 4 links de pulo na ficha (vitais, perícias, páginas, página aberta)', obtido: function () {
        return Array.prototype.map.call(document.querySelectorAll('[data-pular]'), function (a) { return a.getAttribute('data-pular'); }).join(',');
      }, esperado: 'vitais,pericias,abas,pagina' },
      { nome: 'E12 · Dados rápidos: d4, d6, d8, d10, d12, d20 e d100', obtido: function () {
        return Array.prototype.map.call(document.querySelectorAll('[data-dado-rapido]'), function (b) { return b.getAttribute('data-dado-rapido'); }).join(',');
      }, esperado: '1d4,1d6,1d8,1d10,1d12,1d20,1d100' },
      { nome: 'E12 · Um toque num dado rápido rola e mostra o total na faixa de resultado', obtido: function () {
        const caixa = document.getElementById('resultado-rapido');
        document.querySelector('[data-dado-rapido="1d6"]').click();
        const total = Number(document.getElementById('rr-total').textContent);
        return caixa.getAttribute('data-vazio') === 'nao' && total >= 1 && total <= 6;
      }, esperado: true },
      { nome: 'E12 · Defesa e derivados: composição, reações e resistências ficam recolhidas (e abrem para o campo pedido)', obtido: function () {
        const d = document.getElementById('defesa-detalhes');
        const fechadaAntes = !d.open;
        const campo = document.getElementById('defesa-protecao-nome');
        let no = campo;
        while (no) { if (no.tagName === 'DETAILS') no.open = true; no = no.parentElement; }
        const abriu = d.open;
        d.open = false;
        return fechadaAntes + '/' + abriu;
      }, esperado: 'true/true' },
      { nome: 'E12 · Os vitais mostram o nível por extenso no rótulo (baixo, crítico, zerado)', obtido: function () {
        const f = OP.state.ficha;
        const classeAntes = f.identificacao.classe;
        const pvAntes = f.recursos.pv.atual;
        try {
          OP.state.atualizar('identificacao.classe', 'combatente');
          const max = OP.calc.estadoRecurso(OP.state.ficha, 'pv').max;
          OP.state.atualizar('recursos.pv.atual', Math.max(1, Math.floor(max * 0.2)));
          const rotulo = document.querySelector('[data-abrir-vital="pv"]').getAttribute('aria-label');
          return /crítico/.test(rotulo);
        } finally {
          OP.state.atualizar('recursos.pv.atual', pvAntes);
          OP.state.atualizar('identificacao.classe', classeAntes);
        }
      }, esperado: true },

      // --- Ficha em páginas ---
      { nome: 'E11 · 9 páginas; 7 com aba (Resumo e Perícias só existem no celular)', obtido: function () {
        const p = OP.uiPaginas.paginas;
        return p.length + '/' + p.filter(function (x) { return x.aba; }).length + '/' + document.querySelectorAll('#abas-paginas [role="tab"]').length;
      }, esperado: '9/7/7' },
      { nome: 'E11 · Cada aba aponta para um painel que existe (tabpanel com rótulo)', obtido: function () {
        return Array.prototype.filter.call(document.querySelectorAll('#abas-paginas [role="tab"]'), function (aba) {
          const painel = document.getElementById(aba.getAttribute('aria-controls'));
          return !painel || painel.getAttribute('role') !== 'tabpanel' || !painel.getAttribute('aria-label');
        }).length;
      }, esperado: 0 },
      { nome: 'E11 · Toda seção da ficha mora numa página (ou é o trilho de vitais)', obtido: function () {
        return Array.prototype.filter.call(document.querySelectorAll('#ficha section.secao'), function (secao) {
          return !secao.closest('[data-pagina]');
        }).map(function (secao) { return secao.id; }).join(',');
      }, esperado: '' },
      { nome: 'E11 · ir("rituais") mostra só a página de Rituais entre as abas e marca a aba', obtido: function () {
        const antes = OP.uiPaginas.atual();
        try {
          OP.uiPaginas.ir('rituais', { rolar: false, anunciar: false });
          const ocultas = OP.uiPaginas.paginas.filter(function (p) { return p.aba; }).map(function (p) {
            return document.getElementById('pagina-' + p.id).hasAttribute('data-oculta');
          });
          return [OP.uiPaginas.atual(), ocultas.filter(function (o) { return !o; }).length, document.getElementById('aba-rituais').getAttribute('aria-selected')].join('/');
        } finally {
          OP.uiPaginas.ir(antes, { rolar: false, anunciar: false });
        }
      }, esperado: 'rituais/1/true' },
      { nome: 'E11 · mostrarPaginaDe abre a página onde o campo mora (o inventário abre ao pedir um campo dele)', obtido: function () {
        const antes = OP.uiPaginas.atual();
        try {
          OP.uiPaginas.ir('combate', { rolar: false, anunciar: false });
          OP.uiPaginas.mostrarPaginaDe(document.getElementById('secao-inventario'));
          return OP.uiPaginas.atual();
        } finally {
          OP.uiPaginas.ir(antes, { rolar: false, anunciar: false });
        }
      }, esperado: 'inventario' },
      { nome: 'E11 · Dock: setas e botão-índice com rótulo; a folha do índice lista as 9 páginas', obtido: function () {
        const setas = document.querySelectorAll('[data-pagina-delta]');
        const rotulos = Array.prototype.every.call(setas, function (b) { return /pagina/i.test((b.getAttribute('aria-label') || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')); });
        return setas.length + '/' + rotulos + '/' + document.querySelectorAll('#paginas-indice [data-ir-pagina]').length + '/' + /^Índice da ficha/.test(document.getElementById('dock-indice').getAttribute('aria-label'));
      }, esperado: '2/true/9/true' },

      { nome: 'E10 · Existe um único <h1>', obtido: function () { return document.querySelectorAll('h1').length; }, esperado: 1 },
      { nome: 'E10 · Títulos h2 e h3 sem pular nível', obtido: function () { return OP.ui.auditarTitulos().map(function (t) { return t.de + '→' + t.para; }).join(','); }, esperado: '' },
      { nome: 'E10 · Landmarks: header, nav, main, aside e footer existem', obtido: function () {
        return ['header', 'nav', 'main', 'aside', 'footer'].filter(function (tag) { return !document.querySelector(tag); }).join(',');
      }, esperado: '' },
      { nome: 'E10 · <html lang="pt-BR">', obtido: function () { return document.documentElement.lang; }, esperado: 'pt-BR' },
      { nome: 'E10 · "Ir para o conteúdo" é o primeiro elemento focável e aponta para o <main>', obtido: function () {
        const primeiro = document.querySelector('a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        return Boolean(primeiro) && primeiro.classList.contains('pular') && primeiro.getAttribute('href') === '#conteudo' && Boolean(document.getElementById('conteudo')) &&
          /conte[úu]do/i.test(primeiro.textContent);
      }, esperado: true },
      { nome: 'E10 · Nenhum tabindex positivo', obtido: function () { return document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').length; }, esperado: 0 },
      { nome: 'E10 · Toda <img> tem alt', obtido: function () { return document.querySelectorAll('img:not([alt])').length; }, esperado: 0 },
      { nome: 'E10 · role="alert" só em Morrendo, Enlouquecendo e erro de armazenamento', obtido: function () {
        return Array.prototype.map.call(document.querySelectorAll('[role="alert"]'), function (e) { return e.id || e.className; }).sort().join(',');
      }, esperado: ['alerta-estado__titulo', 'alerta-estado__titulo', 'faixa-falha-salvamento'].sort().join(',') },
      { nome: 'E10 · Região aria-live invisível para anúncios existe', obtido: function () {
        const r = document.getElementById('anunciador');
        return Boolean(r) && r.getAttribute('aria-live') === 'polite' && r.classList.contains('visualmente-oculto');
      }, esperado: true },
      { nome: 'E13 · Teste de atributo: FOR 3 rola 3d20 e fica com o maior, sem bônus', obtido: function () {
        const f = OP.state.completarPadroes(fichaValida());
        f.atributos['for'].base = 3; f.atributos['for'].bonus = 0;
        const t = OP.calc.testeAtributo(f, 'for', 0);
        return [t.dados.qtd, t.dados.modo, t.bonus].join('|');
      }, esperado: '3|maior|0' },
      { nome: 'E13 · Teste de atributo: atributo 0 rola 2d20 e fica com o menor', obtido: function () {
        const f = OP.state.completarPadroes(fichaValida());
        f.atributos.int.base = 0; f.atributos.int.bonus = 0;
        const t = OP.calc.testeAtributo(f, 'int', 0);
        return [t.dados.qtd, t.dados.modo].join('|');
      }, esperado: '2|menor' },
      { nome: 'E13 · rolarAtributo: título "Teste de Força", subtipo atributo e total = d20 escolhido', obtido: function () {
        const f = OP.state.completarPadroes(fichaValida());
        const r = OP.rolagens.rolarAtributo(f, 'for', {});
        return [r.ok, r.titulo, r.subtipo, r.total === r.escolhido].join('|');
      }, esperado: 'true|Teste de Força|atributo|true' },
      { nome: 'E13 · rolarAtributo com atributo desconhecido não lança e devolve ok false', obtido: function () { return OP.rolagens.rolarAtributo(OP.state.completarPadroes(fichaValida()), 'xyz', {}).ok; }, esperado: false },
      { nome: 'E13 · Cada um dos 5 atributos tem botão de rolar com nome acessível', obtido: function () {
        const botoes = document.querySelectorAll('.atributo__rolar[data-rolar-atributo]');
        return botoes.length + '|' + Array.prototype.every.call(botoes, function (b) { return /^Rolar teste de /.test(b.getAttribute('aria-label')); });
      }, esperado: '5|true' },
      { nome: 'E13 · Clicar no d20 de um atributo mostra "Teste de ..." na faixa de resultado', obtido: function () {
        document.querySelector('[data-rolar-atributo="agi"]').click();
        return document.getElementById('rr-titulo').textContent;
      }, esperado: 'Teste de Agilidade' },
      { nome: 'E13 · O trilho do agente é um botão que leva à página Agente', obtido: function () {
        const antes = OP.uiPaginas.atual();
        const botao = document.getElementById('trilho-agente');
        try {
          botao.click();
          return botao.tagName + '|' + OP.uiPaginas.atual();
        } finally {
          OP.uiPaginas.ir(antes, { rolar: false, anunciar: false, foco: false });
        }
      }, esperado: 'BUTTON|agente' },
      { nome: 'E14 · Rolagens: "Voltar" aparece com a página de origem e leva de volta a ela', obtido: function () {
        const antes = OP.uiPaginas.atual();
        const botao = document.getElementById('rolagens-voltar');
        try {
          OP.uiPaginas.ir('inventario', { rolar: false, anunciar: false });
          OP.uiPaginas.ir('rolagens', { rolar: false, anunciar: false });
          const visivel = !botao.hidden && /Inventário/.test(botao.textContent);
          botao.click();
          return visivel + '|' + OP.uiPaginas.atual();
        } finally {
          OP.uiPaginas.ir(antes, { rolar: false, anunciar: false, foco: false });
        }
      }, esperado: 'true|inventario' },
      { nome: 'E14 · O aviso "Escolha a classe" só aparece enquanto a ficha não tem classe', obtido: function () {
        const aviso = document.getElementById('aviso-classe');
        const semClasse = !OP.data.classes[OP.state.ficha.identificacao.classe];
        return aviso.hidden === !semClasse;
      }, esperado: true },
      { nome: 'E15 · Impressão: texto longo de um campo vira texto corrido e volta ao campo depois', obtido: function () {
        const f = OP.state.ficha;
        const antes = f.ataques.length;
        OP.state.atualizar('ataques', f.ataques.concat([OP.state.novoAtaque({ nome: 'Teste longo', notas: 'x'.repeat(120) })]));
        try {
          window.dispatchEvent(new Event('beforeprint'));
          const durante = document.querySelectorAll('.impressao-nota').length;
          window.dispatchEvent(new Event('afterprint'));
          const depois = document.querySelectorAll('.impressao-nota').length + document.querySelectorAll('.impressao-oculto').length;
          return durante + '|' + depois;
        } finally {
          window.dispatchEvent(new Event('afterprint'));
          OP.state.atualizar('ataques', OP.state.ficha.ataques.slice(0, antes));
        }
      }, esperado: '1|0' },
      { nome: 'E16 · Perícia: marcador de grau e seta do "menor" vêm antes da sigla do atributo (a sigla não se move)', obtido: function () {
        return Array.prototype.filter.call(document.querySelectorAll('.pericia__dados'), function (celula) {
          const filhos = Array.prototype.map.call(celula.children, function (f) { return f.className.split(' ')[0]; });
          return filhos.indexOf('atributo-sigla') < filhos.indexOf('pericia__grau-marca') || filhos.indexOf('atributo-sigla') < filhos.indexOf('marca-menor');
        }).length;
      }, esperado: 0 },
      { nome: 'E17 · Som das rolagens: ligado por padrão e valor inválido volta ao padrão', obtido: function () {
        const antes = OP.prefs.aparencia().som;
        try {
          OP.prefs.definirAparencia({ som: 'talvez' });
          const invalido = OP.prefs.aparencia().som;
          OP.prefs.definirAparencia({ som: 'nao' });
          const desligado = OP.prefs.aparencia().som;
          return invalido === antes && desligado === 'nao';
        } finally {
          OP.prefs.definirAparencia({ som: antes });
        }
      }, esperado: true },
      { nome: 'E17 · OP.som: resultado com erro ou som desligado não toca nada', obtido: function () {
        const antes = OP.prefs.aparencia().som;
        try {
          OP.prefs.definirAparencia({ som: 'nao' });
          OP.som.silenciar(false);
          const desligado = OP.som.tocarResultado({ ok: true, tipo: 'teste', escolhido: 20 });
          OP.prefs.definirAparencia({ som: 'sim' });
          const comErro = OP.som.tocarResultado({ ok: false });
          return [desligado, comErro].join('|');
        } finally {
          OP.prefs.definirAparencia({ som: antes });
          OP.som.silenciar(true);
        }
      }, esperado: 'false|false' },
      { nome: 'E17 · Diálogo Aparência tem o grupo "Som das rolagens" (Ligado/Desligado)', obtido: function () {
        return document.querySelectorAll('input[name="aparencia-som"]').length;
      }, esperado: 2 },
      { nome: 'E18 · Identificação: Origem, Classe, Trilha e NEX são texto clicável, sem caixa', obtido: function () {
        const ids = ['campo-origem', 'campo-classe', 'campo-trilha', 'campo-nex'];
        return ids.filter(function (id) {
          const botao = document.getElementById(id).parentElement.querySelector('.seletor');
          if (!botao) return true;
          const cs = getComputedStyle(botao);
          return !(parseFloat(cs.borderTopWidth) === 0 && cs.backgroundColor === 'rgba(0, 0, 0, 0)');
        }).length;
      }, esperado: 0 },
      { nome: 'E19 · Sem Sanidade: Combatente NEX 35% com PRE 2 tem 38 PD (e 28 PE com a regra desligada)', obtido: function () {
        const f = fichaDeTeste({ classe: 'combatente', nex: 35, atributos: { pre: 2 } });
        const antes = calc.peMax(f);
        f.config.semSanidade = true;
        return antes + '|' + calc.peMax(f);
      }, esperado: '28|38' },
      { nome: 'E19 · Sem Sanidade: PD inicial por classe (Combatente 6, Especialista 8, Ocultista 10, Sobrevivente 4, mais PRE)', obtido: function () {
        return ['combatente', 'especialista', 'ocultista', 'sobrevivente'].map(function (classe) {
          const f = fichaDeTeste({ classe: classe, nex: 5, estagio: 1, atributos: { pre: 1 } });
          f.config.semSanidade = true;
          return calc.peMax(f);
        }).join('|');
      }, esperado: '7|9|11|5' },
      { nome: 'E19 · Sem Sanidade: Sobrevivente soma 2 PD por estágio (sem PRE)', obtido: function () {
        const f = fichaDeTeste({ classe: 'sobrevivente', estagio: 3, atributos: { pre: 1 } });
        f.config.semSanidade = true;
        return calc.peMax(f);
      }, esperado: 9 },
      { nome: 'E19 · Sem Sanidade: a SAN guardada não é apagada e o estado de Sanidade fica "sã"', obtido: function () {
        const f = fichaDeTeste({ classe: 'ocultista', nex: 5, atributos: { pre: 1 } });
        f.recursos.san.atual = 0;
        const antes = calc.estadoCondicoes(f).sanidade;
        f.config.semSanidade = true;
        return antes + '|' + calc.estadoCondicoes(f).sanidade + '|' + f.recursos.san.atual;
      }, esperado: 'enlouquecendo|sao|0' },
      { nome: 'E19 · Sem Sanidade: ritual de Medo tira PD (custo + perda), sem perda permanente nem SAN', obtido: function () {
        const f = fichaDeTeste({ classe: 'ocultista', nex: 5, atributos: { pre: 1 } });
        f.config.semSanidade = true;
        f.recursos.pe.atual = 10;
        const ritual = OP.state.novoRitual({ elemento: 'medo', formas: { padrao: { custo: 3 } } });
        const p = calc.planoConjuracao(f, ritual, 'padrao');
        return [p.ok, p.pe, p.perdaMental, p.san, p.permanente, p.peDepois, p.peGastoTurnoDepois].join('|');
      }, esperado: 'true|3|3|0|0|4|3' },
      { nome: 'E19 · Sem Sanidade: a perda mental não impede a conjuração (PD vai a 0, não abaixo)', obtido: function () {
        const f = fichaDeTeste({ classe: 'ocultista', nex: 5, atributos: { pre: 1 } });
        f.config.semSanidade = true;
        f.recursos.pe.atual = 4;
        const ritual = OP.state.novoRitual({ elemento: 'medo', formas: { padrao: { custo: 3 } } });
        const p = calc.planoConjuracao(f, ritual, 'padrao');
        return [p.ok, p.peDepois].join('|');
      }, esperado: 'true|0' },
      { nome: 'E19 · Sem Sanidade: dormir recupera só PV', obtido: function () {
        const f = fichaDeTeste({ classe: 'ocultista', nex: 35 });
        f.config.semSanidade = true;
        const r = calc.recuperacaoDescanso(f, 'dormir', 'normal');
        return [r.pv > 0, r.pe, r.san].join('|');
      }, esperado: 'true|0|0' },
      { nome: 'E19 · Regras opcionais: botão na faixa do agente e diálogo com a tabela de PD das 4 classes', obtido: function () {
        return [Boolean(document.getElementById('botao-regras-opcionais')), document.querySelectorAll('#regra-sem-sanidade-tabela tbody tr').length].join('|');
      }, esperado: 'true|4' },
      { nome: 'E19 · Ligar a regra mostra PD no lugar do PE, esconde a SAN e desligar devolve tudo', obtido: function () {
        const estavaLigada = OP.state.ficha.config.semSanidade === true;
        const fichaEl = document.getElementById('ficha');
        const lerVitais = function () {
          return Array.prototype.filter.call(document.querySelectorAll('#trilho-vitais .vital'), function (v) { return getComputedStyle(v).display !== 'none'; })
            .map(function (v) { return v.querySelector('.vital__sigla').textContent; }).join(',');
        };
        try {
          OP.state.atualizar('config.semSanidade', false);
          const antes = lerVitais();
          OP.state.atualizar('config.semSanidade', true);
          const ligada = lerVitais();
          OP.state.atualizar('config.semSanidade', false);
          const depois = lerVitais();
          const sobrou = /\bPD\b/.test(fichaEl.textContent);
          return [antes, ligada, depois, sobrou].join('|');
        } finally {
          OP.state.atualizar('config.semSanidade', estavaLigada);
        }
      }, esperado: 'PV,PE,SAN|PV,PD|PV,PE,SAN|false' },
      { nome: 'E20 · NEX e Experiência: 1 nível = 5% de NEX (nível 1 = 5%, 7 = 35%, 20 = 99%) e a volta', obtido: function () {
        return [calc.nexDoNivel(1), calc.nexDoNivel(7), calc.nexDoNivel(20), calc.nivelDoNex(5), calc.nivelDoNex(35), calc.nivelDoNex(99), calc.nivelDoNex(0)].join('|');
      }, esperado: '5|35|99|1|7|20|1' },
      { nome: 'E20 · NEX e Experiência: o nível manda na progressão (Ocultista nível 7 = os PE da regra padrão com NEX 35%)', obtido: function () {
        const padrao = fichaDeTeste({ classe: 'ocultista', nex: 35, atributos: { pre: 2, vig: 1 } });
        const regra = fichaRegra({ classe: 'ocultista', nivel: 7, nex: 0, atributos: { pre: 2, vig: 1 } });
        return [calc.pvMax(regra) === calc.pvMax(padrao), calc.peMax(regra) === calc.peMax(padrao), calc.sanMax(regra) === calc.sanMax(padrao),
          calc.limitePEporTurno(regra) === calc.limitePEporTurno(padrao)].join('|');
      }, esperado: 'true|true|true|true' },
      { nome: 'E20 · NEX e Experiência: o NEX de exposição não mexe na progressão (nível 1 com NEX 90% segue como NEX 5%)', obtido: function () {
        const f = fichaRegra({ classe: 'combatente', nivel: 1, nex: 90, atributos: { vig: 1, pre: 1 } });
        const cinco = fichaDeTeste({ classe: 'combatente', nex: 5, atributos: { vig: 1, pre: 1 } });
        return [calc.pvMax(f) === calc.pvMax(cinco), calc.limitePEporTurno(f)].join('|');
      }, esperado: 'true|1' },
      { nome: 'E20 · NEX e Experiência: o círculo de ritual segue o nível; a afinidade segue o NEX', obtido: function () {
        const a = calc.estadoConjuracao(fichaRegra({ classe: 'ocultista', nivel: 5, nex: 0 }));
        const b = calc.estadoConjuracao(fichaRegra({ classe: 'ocultista', nivel: 1, nex: 50 }));
        const c = calc.estadoConjuracao(fichaRegra({ classe: 'ocultista', nivel: 20, nex: 0 }));
        return [a.circulosLiberados, a.afinidadeLiberada, b.circulosLiberados, b.afinidadeLiberada, c.circulosLiberados, c.afinidadeLiberada].join('|');
      }, esperado: '2|false|1|true|4|false' },
      { nome: 'E20 · NEX e Experiência: Sobrevivente continua pelo estágio (o nível não vale)', obtido: function () {
        const normal = fichaDeTeste({ classe: 'sobrevivente', estagio: 3, atributos: { vig: 1, pre: 1 } });
        const regra = fichaRegra({ classe: 'sobrevivente', nivel: 20, nex: 0, atributos: { vig: 1, pre: 1 } });
        regra.identificacao.estagio = 3;
        return calc.pvMax(regra) === calc.pvMax(normal) && calc.nivelProgressao(regra) === 3;
      }, esperado: true },
      { nome: 'E20 · Com a regra desligada o campo nível é ignorado', obtido: function () {
        const f = fichaDeTeste({ classe: 'combatente', nex: 35 });
        f.identificacao.nivel = 20;
        return calc.nexProgressao(f) + '|' + calc.nivelProgressao(f);
      }, esperado: '35|35' },
      { nome: 'E20 · Correções: com a regra o NEX vale de 0 a 99 (37 serve, 150 vira 99); sem a regra só a tabela', obtido: function () {
        const comRegra = function (nex) { const f = fichaRegra({ classe: 'combatente', nex: nex }); return calc.correcoes(f).filter(function (c) { return c.caminho === 'identificacao.nex'; }).map(function (c) { return c.valor; }).join(','); };
        const sem = fichaDeTeste({ classe: 'combatente', nex: 37 });
        const corrigeSem = calc.correcoes(sem).filter(function (c) { return c.caminho === 'identificacao.nex'; }).map(function (c) { return c.valor; }).join(',');
        return ['[' + comRegra(37) + ']', '[' + comRegra(150) + ']', '[' + comRegra(-4) + ']', '[' + corrigeSem + ']'].join('');
      }, esperado: '[][99][0][35]' },
      { nome: 'E20 · NEX 25%: Ocultismo sem treino deixa de exigir treino; treinado ganha +2; −5 na perícia escolhida', obtido: function () {
        const sem = fichaRegra({ classe: 'combatente', nex: 25 });
        sem.alteracoesNex.penalidade25 = 'diplomacia';
        const treinada = fichaRegra({ classe: 'ocultista', nex: 25 });
        const normal = fichaDeTeste({ classe: 'ocultista', nex: 5 });
        const base = fichaDeTeste({ classe: 'combatente', nex: 5 });
        return [calc.estadoPericia(sem, 'ocultismo').requerTreinamento, calc.periciaBonus(treinada, 'ocultismo') - calc.periciaBonus(normal, 'ocultismo'),
          calc.periciaBonus(sem, 'diplomacia') - calc.periciaBonus(base, 'diplomacia'), calc.periciaBonus(sem, 'enganacao') - calc.periciaBonus(base, 'enganacao')].join('|');
      }, esperado: 'false|2|-5|0' },
      { nome: 'E20 · NEX 25%: sem escolher a perícia não há penalidade e a ficha avisa', obtido: function () {
        const f = fichaRegra({ classe: 'combatente', nex: 25 });
        return calc.periciaBonus(f, 'diplomacia') + '|' + calc.efeitosAlteracoes(f).pendencias.length + '|' +
          calc.verificarFicha(f).some(function (v) { return v.codigo === 'alteracao-sem-escolha-penalidade25'; });
      }, esperado: '0|1|true' },
      { nome: 'E20 · NEX 35%: o atributo escolhido soma no PE e há −5 na perícia escolhida', obtido: function () {
        const f = fichaRegra({ classe: 'ocultista', nex: 35, atributos: { int: 2, pre: 1 } });
        const antes = calc.peMax(f);
        f.alteracoesNex.atributo35 = 'int';
        f.alteracoesNex.penalidade35 = 'reflexos';
        return [calc.peMax(f) - antes, calc.periciaBonus(f, 'reflexos') - calc.periciaBonus(fichaRegra({ classe: 'ocultista', nex: 0, atributos: { int: 2, pre: 1 } }), 'reflexos')].join('|');
      }, esperado: '2|-5' },
      { nome: 'E20 · Alterações de Conhecimento: ofuscado (60%), −2d20 (75%), cego fora da escuridão (90%)', obtido: function () {
        function em(nex, escuro) {
          const f = fichaRegra({ classe: 'ocultista', nex: nex });
          f.conjuracao.elementoConectado = 'conhecimento';
          f.alteracoesNex.escuridao = escuro === true;
          const m = calc.modificadoresCondicoes(f);
          return [m.dadosPorPericia.percepcao || 0, m.dadosAtaque, m.dadosAtributos.agi].join(',');
        }
        return [em(55), em(60), em(75), em(90), em(90, true)].join('|');
      }, esperado: '0,0,0|-1,-1,0|-2,-2,0|0,0,-2|-2,-2,0' },
      { nome: 'E20 · Ofuscado das alterações não soma com o ofuscado posto à mão (vale o mais severo)', obtido: function () {
        const f = fichaRegra({ classe: 'ocultista', nex: 75 });
        f.conjuracao.elementoConectado = 'conhecimento';
        f.condicoes.ativas = [OP.state.novaCondicao({ id: 'ofuscado' })];
        return calc.modificadoresCondicoes(f).dadosPorPericia.percepcao;
      }, esperado: -2 },
      { nome: 'E20 · Alterações de Sangue: +1d20 Sobrevivência (60%); −1d20 e depois −2d20 em Ciências, Medicina e Tecnologia; Forma Monstruosa suspende', obtido: function () {
        function em(nex, suspenso) {
          const f = fichaRegra({ classe: 'ocultista', nex: nex });
          f.conjuracao.elementoConectado = 'sangue';
          f.alteracoesNex.sangueSuspenso = suspenso === true;
          return [calc.dadosAlteracoesPericia(f, 'sobrevivencia'), calc.dadosAlteracoesPericia(f, 'ciencias')].join(',');
        }
        return [em(60), em(75), em(90), em(90, true)].join('|');
      }, esperado: '1,0|1,-1|1,-2|1,0' },
      { nome: 'E20 · Alterações de Morte: +1d20 Iniciativa/Reflexos e −1d20 Diplomacia/Intuição; aos 75% −2d20 e vale também para Enganação e Intimidação', obtido: function () {
        function em(nex) {
          const f = fichaRegra({ classe: 'ocultista', nex: nex });
          f.conjuracao.elementoConectado = 'morte';
          return ['iniciativa', 'reflexos', 'diplomacia', 'intuicao', 'enganacao', 'intimidacao'].map(function (id) { return calc.dadosAlteracoesPericia(f, id); }).join(',');
        }
        return [em(60), em(75)].join('|');
      }, esperado: '1,1,-1,-1,0,0|1,1,-2,-2,-2,-2' },
      { nome: 'E20 · Só vale o elemento conectado: sem elemento (ou com Medo) as alterações de elemento não entram', obtido: function () {
        const a = fichaRegra({ classe: 'ocultista', nex: 90 });
        const b = fichaRegra({ classe: 'ocultista', nex: 90 });
        b.conjuracao.elementoConectado = 'medo';
        return [calc.efeitosAlteracoes(a).alcancadas.length, calc.efeitosAlteracoes(b).alcancadas.length].join('|');
      }, esperado: '3|3' },
      { nome: 'E20 · Dados de alteração somam com os de condição (fontes diferentes)', obtido: function () {
        const f = fichaRegra({ classe: 'ocultista', nex: 60, atributos: { pre: 3 } });
        f.conjuracao.elementoConectado = 'morte';
        f.condicoes.ativas = [OP.state.novaCondicao({ id: 'abalado' })];
        const dados = calc.periciaDados(f, 'intuicao');
        return [calc.dadosCondicoesPericia(f, 'intuicao'), calc.dadosAlteracoesPericia(f, 'intuicao'), dados.qtd].join('|');
      }, esperado: '-1|-1|1' },
      { nome: 'E20 · Rituais das alterações: −1 PE no custo pelo nome (sem acento ou maiúscula) e só se a alteração foi alcançada', obtido: function () {
        function plano(nex, nome) {
          const f = fichaRegra({ classe: 'ocultista', nex: nex, atributos: { pre: 1 } });
          f.conjuracao.elementoConectado = 'conhecimento';
          f.recursos.pe.atual = 20;
          return calc.planoConjuracao(f, OP.state.novoRitual({ nome: nome, circulo: 1, formas: { padrao: { custo: 3 } } }), 'padrao').pe;
        }
        return [plano(60, 'Terceiro Olho'), plano(60, 'terceiro olho'), plano(60, 'Detecção de Ameaças'), plano(75, 'DETECCAO DE AMEACAS'), plano(60, 'Outro ritual'), plano(50, 'Terceiro Olho')].join('|');
      }, esperado: '2|2|3|2|3|3' },
      { nome: 'E20 · Energia, efeito 1 do d6: −Xd20 em Presença e nas perícias baseadas, menos Vontade', obtido: function () {
        const f = fichaRegra({ classe: 'ocultista', nex: 75, atributos: { pre: 3 } });
        f.conjuracao.elementoConectado = 'energia';
        f.alteracoesNex.energia = { d6: 1, valores: [], intensidade: 2 };
        return [calc.dadosAlteracoesAtributo(f, 'pre'), calc.dadosAlteracoesPericia(f, 'diplomacia'), calc.dadosAlteracoesPericia(f, 'vontade'), calc.dadosAlteracoesPericia(f, 'luta')].join('|');
      }, esperado: '-2|-2|0|0' },
      { nome: 'E20 · Energia, efeito 5: o aviso aparece quando um d20 repete o valor anotado', obtido: function () {
        const f = fichaRegra({ classe: 'combatente', nex: 60, atributos: { for: 1 } });
        f.conjuracao.elementoConectado = 'energia';
        f.alteracoesNex.energia = { d6: 5, valores: [14], intensidade: 1 };
        const fila = [r(14, 20), r(4, 6)];
        const acerta = comDadosE10(fila, function () { return OP.rolagens.rolarPericia(f, 'luta', {}); });
        const erra = comDadosE10([r(13, 20)], function () { return OP.rolagens.rolarPericia(f, 'luta', {}); });
        return [typeof acerta.avisoEnergia === 'string' && /14/.test(acerta.avisoEnergia), erra.avisoEnergia === undefined].join('|');
      }, esperado: 'true|true' },
      { nome: 'E20 · Teste de atributo e de ataque também levam os dados das alterações', obtido: function () {
        const f = fichaRegra({ classe: 'ocultista', nex: 60, atributos: { pre: 2, for: 2 } });
        f.conjuracao.elementoConectado = 'sangue';
        f.alteracoesNex.penalidade25 = 'diplomacia';
        const atq = OP.state.novoAtaque({ pericia: 'luta', dano: '1d4' });
        return [calc.testeAtributo(f, 'for', 0).dados.qtd, calc.ataqueTeste(f, atq, 0).dados.qtd].join('|');
      }, esperado: '2|2' },
      { nome: 'E20 · trocarNexENivel: ligar vira nível equivalente com NEX 0; desligar volta ao NEX do nível', obtido: function () {
        const f = OP.state.ficha;
        const guardado = { nex: f.identificacao.nex, nivel: f.identificacao.nivel, cfg: f.config.nexENivel };
        try {
          OP.state.atualizar('config.nexENivel', false, { silencioso: true });
          OP.state.atualizar('identificacao.nex', 35, { silencioso: true });
          OP.uiRegras.trocarNexENivel(true);
          const ligada = [f.config.nexENivel, f.identificacao.nivel, f.identificacao.nex].join(',');
          OP.state.atualizar('identificacao.nex', 12, { silencioso: true });
          OP.uiRegras.trocarNexENivel(false);
          return ligada + '|' + [f.config.nexENivel, f.identificacao.nex].join(',');
        } finally {
          OP.state.atualizar('identificacao.nex', guardado.nex, { silencioso: true });
          OP.state.atualizar('identificacao.nivel', guardado.nivel, { silencioso: true });
          OP.state.atualizar('config.nexENivel', guardado.cfg === true);
        }
      }, esperado: 'true,7,0|false,35' },
      { nome: 'E20 · Exportar e importar mantém a regra, o nível, o NEX de exposição e as escolhas das alterações', obtido: function () {
        const f = OP.state.completarPadroes(fichaRegra({ classe: 'ocultista', nivel: 9, nex: 62 }));
        f.alteracoesNex.penalidade25 = 'intimidacao';
        f.alteracoesNex.atributo35 = 'vig';
        f.alteracoesNex.energia = { d6: 4, valores: [], intensidade: 2 };
        const lida = OP.state.lerImportacao(JSON.stringify(OP.state.envelopeFicha(f))).fichas[0];
        return [lida.config.nexENivel, lida.identificacao.nivel, lida.identificacao.nex, lida.alteracoesNex.penalidade25, lida.alteracoesNex.atributo35, lida.alteracoesNex.energia.d6].join('|');
      }, esperado: 'true|9|62|intimidacao|vig|4' },
      { nome: 'E20 · Ficha antiga (sem os campos novos) abre com a regra desligada, nível 1 e escolhas vazias', obtido: function () {
        const f = OP.state.completarPadroes({ identificacao: { classe: 'combatente', nex: 35 } });
        return [f.config.nexENivel, f.identificacao.nivel, f.alteracoesNex.penalidade25 === '', f.alteracoesNex.energia.d6].join('|');
      }, esperado: 'false|1|true|0' },
      { nome: 'E20 · A composição do PE mostra a alteração de NEX (atributo somado)', obtido: function () {
        const f = fichaRegra({ classe: 'ocultista', nex: 35, atributos: { int: 2 } });
        f.alteracoesNex.atributo35 = 'int';
        const c = calc.estadoRecurso(f, 'pe');
        return [c.bonusAlteracoes, c.atributoAlteracoes].join('|');
      }, esperado: '2|int' },
      { nome: 'E20 · "Fim da cena" encerra o efeito sorteado de Energia', obtido: function () {
        const f = OP.state.ficha;
        const energia = JSON.stringify(f.alteracoesNex.energia);
        const ativas = JSON.stringify(f.condicoes.ativas);
        const turnos = f.condicoes.turnosMorrendo;
        try {
          OP.state.atualizar('alteracoesNex.energia', { d6: 2, valores: [], intensidade: 1 });
          document.getElementById('cond-fim-cena').click();
          return f.alteracoesNex.energia.d6;
        } finally {
          OP.state.atualizar('alteracoesNex.energia', JSON.parse(energia), { silencioso: true });
          OP.state.atualizar('condicoes.ativas', JSON.parse(ativas), { silencioso: true });
          OP.state.atualizar('condicoes.turnosMorrendo', turnos);
        }
      }, esperado: 0 },
      { nome: 'E20 · Painel Alterações de NEX só aparece com a regra ligada e o campo da identificação vira "Nível"', obtido: function () {
        const estava = OP.state.ficha.config.nexENivel === true;
        const secao = document.getElementById('secao-alteracoes');
        const rotulo = document.getElementById('rotulo-nivel');
        try {
          OP.state.atualizar('config.nexENivel', false);
          const desligada = [secao.hidden, rotulo.textContent].join(',');
          OP.state.atualizar('config.nexENivel', true);
          const ligada = [secao.hidden, rotulo.textContent].join(',');
          return desligada + '|' + ligada;
        } finally {
          OP.state.atualizar('config.nexENivel', estava);
        }
      }, esperado: 'true,NEX|false,Nível' },
      { nome: 'E10 · Diálogos: todos têm título (aria-labelledby) e são <dialog>', obtido: function () {
        return Array.prototype.filter.call(document.querySelectorAll('dialog'), function (d) {
          const alvo = document.getElementById(d.getAttribute('aria-labelledby') || '');
          return !alvo || !alvo.textContent.trim();
        }).length;
      }, esperado: 0 },
      { nome: 'E10 · Meta color-scheme e viewport-fit=cover', obtido: function () {
        return document.querySelector('meta[name="color-scheme"]').content + '|' + /viewport-fit=cover/.test(document.querySelector('meta[name="viewport"]').content);
      }, esperado: 'dark light|true' },
      { nome: 'E10 · Estimativa do armazenamento em uso é um número', obtido: function () { const u = OP.storage.uso(); return typeof u.usado === 'number' && u.limite === 5 * 1024 * 1024; }, esperado: true },
      { nome: 'E10 · Layout em janela estreita: nada passa da largura (ou "pulado")', obtido: function () {
        if (window.innerWidth > 480) return 'pulado: abra com a janela estreita';
        return OP.ui.auditarLayout().map(function (e) { return OP.ui.descrever(e); }).join(',');
      }, esperado: window.innerWidth > 480 ? 'pulado: abra com a janela estreita' : '' },

      { nome: 'E10 · Ficha de teste exportada e importada mantém condições e biografia', obtido: function () {
        const f = OP.state.completarPadroes(fichaValida());
        f.condicoes.ativas = [OP.state.novaCondicao({ id: 'abalado', rodadas: 3, nota: 'susto' })];
        f.biografia.notas = 'Cuidado com o porão';
        f.biografia.aliados = [OP.state.novaPessoa({ nome: 'Rita', nota: 'médica' })];
        f.biografia.diario = [OP.state.novaEntradaDiario({ data: '2026-01-02', titulo: 'Dia 1', texto: 'Chegamos' })];
        const r = OP.state.lerImportacao(JSON.stringify(OP.state.envelopeFicha(f))).fichas[0];
        return [r.condicoes.ativas[0].id, r.condicoes.ativas[0].rodadas, r.condicoes.ativas[0].nota, r.biografia.notas, r.biografia.aliados[0].nome, r.biografia.diario[0].titulo].join('|');
      }, esperado: 'abalado|3|susto|Cuidado com o porão|Rita|Dia 1' }
    ];
  }

  OP.testesEtapa10 = testesEtapa10;
})(window.OP);
