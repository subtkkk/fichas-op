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
      { id: 'A', nome: 'A', categoria: 'medo', familia: 'f1', efeitos: { dadosPericias: -1 }, conferir: true },
      { id: 'B', nome: 'B', categoria: 'medo', familia: 'f1', efeitos: { dadosPericias: -2 }, conferir: true },
      { id: 'C', nome: 'C', categoria: 'mental', familia: 'f2', efeitos: { dadosAtributos: { for: -1 } }, conferir: true },
      { id: 'D', nome: 'D', categoria: 'mental', familia: 'f2', efeitos: { dadosAtributos: { for: -2, agi: -2 } }, conferir: true },
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

    const arquivoNovo = { length: 2, key: function (i) { return ['ab', 'x'][i]; }, getItem: function (k) { return { ab: 'cde', x: 'yz' }[k]; } };

    return [
      // --- Integridade dos dados ---
      { nome: 'E10 · 31 condições com ids únicos', obtido: function () { return OP.data.condicoes.length + '/' + idsUnicos(OP.data.condicoes); }, esperado: '31/true' },
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
      { nome: 'E10 · A + B (mesma família) → dadosPericias −2 (vale a pior)', obtido: function () { return modDe(['A', 'B']).dadosPericias; }, esperado: -2 },
      { nome: 'E10 · C + D (mesma família) → FOR −2 e AGI −2', obtido: function () { return juntar(modDe(['C', 'D']), ['for', 'agi']); }, esperado: '-2/-2' },
      { nome: 'E10 · E + F (sem família) → Defesa −7', obtido: function () { return modDe(['E', 'F']).defesa; }, esperado: -7 },
      { nome: 'E10 · G → deslocamento × 0,5; G + H → 0', obtido: function () { return modDe(['G']).deslocamentoMult + '/' + modDe(['G', 'H']).deslocamentoMult; }, esperado: '0.5/0' },
      { nome: 'E10 · I + E → Defesa −2 (E conta uma vez) e FOR −1', obtido: function () { return juntar(modDe(['I', 'E']), ['defesa', 'for']); }, esperado: '-2/-1' },
      { nome: 'E10 · "Aplicar efeitos" desligado → tudo neutro', obtido: function () {
        const m = modDe(['A', 'E', 'G', 'C'], function (f) { f.condicoes.aplicarEfeitos = false; });
        return [m.dadosPericias, m.defesa, m.deslocamentoMult, m.dadosAtributos.for, m.origens.length].join('/');
      }, esperado: '0/0/1/0/0' },
      { nome: 'E10 · Personalizada (−1 dado, −1 Defesa) + A → dadosPericias −2 e Defesa −1', obtido: function () {
        const m = modDe(['A', { id: 'personalizada', personalizada: { nome: 'Teste', dadosPericias: -1, defesa: -1, deslocamentoMult: 1 } }]);
        return m.dadosPericias + '/' + m.defesa;
      }, esperado: '-2/-1' },
      { nome: 'E10 · Duas personalizadas somam', obtido: function () {
        const p = { id: 'personalizada', personalizada: { nome: 'P', dadosPericias: -1, defesa: 0, deslocamentoMult: 1 } };
        return modDe([p, p]).dadosPericias;
      }, esperado: -2 },
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
        const f = comCondicoes(fichaValida(), ['abalado']);
        const v = calc.verificarFicha(f).filter(function (x) { return x.codigo === 'condicoes-conferir'; });
        return v.length + '/' + (v[0] && v[0].severidade);
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
      { nome: 'E10 · versaoModelo é 10', obtido: function () { return [OP.state.VERSAO_MODELO, OP.state.criarFichaVazia().versaoModelo].join('/'); }, esperado: '10/10' },
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
