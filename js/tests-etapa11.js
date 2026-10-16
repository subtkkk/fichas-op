/* ==========================================================================
   js/tests-etapa11.js — verificações dos efeitos automáticos (data/efeitos.js,
   js/livro.js, OP.calc e OP.rolagens)
   --------------------------------------------------------------------------
   Usa definições INVENTADAS para o teste (nenhum dado do livro entra no
   repositório) e SEMPRE restaura OP.data.efeitos e OP.data.catalogo.
   Não roda sozinho: o OP.runTests() (js/tests.js) chama OP.testesEtapa11(ajuda).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  function testesEtapa11(ajuda) {
    const calc = OP.calc;
    const fichaDeTeste = ajuda.fichaDeTeste;

    function comEfeitos(defs, catalogo, conta) {
      const efeitos = OP.data.efeitos;
      const cat = OP.data.catalogo;
      OP.data.efeitos = defs;
      OP.data.catalogo = Object.assign({ origens: {}, trilhas: {}, classe: {}, poderes: [], rituais: [] }, catalogo || {});
      try {
        return conta();
      } finally {
        OP.data.efeitos = efeitos;
        OP.data.catalogo = cat;
      }
    }

    function comDados(fila, conta) {
      const original = OP.dados.getRng();
      let pos = 0;
      OP.dados.setRng(function () { const v = fila[pos]; pos += 1; return v === undefined ? 0 : v; });
      try { return conta(); } finally { OP.dados.setRng(original); }
    }
    function r(valor, faces) { return (valor - 0.5) / faces; }

    /** Combatente de NEX 50% com VIG 3, INT 3, PRE 2 e PE cheio. */
    function agente(extra) {
      const f = fichaDeTeste({ classe: 'combatente', nex: 50, atributos: { vig: 3, int: 3, pre: 2, for: 2, agi: 2 } });
      Object.assign(f.identificacao, (extra && extra.identificacao) || {});
      return f;
    }
    function comPoder(f, chave) {
      f.habilidades.push(OP.state.novaHabilidade({ nome: chave, catalogo: chave }));
      return f;
    }
    const PARANORMAL = { poderes: [{ id: 'teste-ferro', nome: 'Teste Ferro', tipo: 'paranormal' }, { id: 'teste-geral', nome: 'Teste Geral', tipo: 'geral' }] };

    const DEFS = {
      'teste-ferro': { passivos: [{ k: 'pv', v: { nivel: 2 } }, { k: 'per', id: 'fortitude', v: 5, se: { afinidade: 'sangue' } }] },
      'teste-geral': {
        passivos: [{ k: 'pv', v: { nivel: 2 } }, { k: 'def', v: 2 }, { k: 'desl', v: 3 }, { k: 'pe', v: { tabela: [[5, 1], [25, 3], [55, 5]] } }],
        gastos: [{ id: 'saber', nome: 'Saber', custo: 2, quando: { atr: ['int'] }, bonus: 5 },
          { id: 'ataque', nome: 'Ataque', custo: 2, custoExtra: 1, unidades: { tabela: [[5, 1], [25, 2], [55, 3]] }, quando: { ataque: 'todos' }, bonus: 5 },
          { id: 'dano', nome: 'Dano', custo: 2, quando: { dano: 'todos' }, dano: 5 },
          { id: 'atl', nome: 'Atl', custo: 0, quando: { atr: ['for', 'agi'], exceto: ['luta', 'pontaria'] }, bonus: 5 }],
        ativavel: { custo: 1, duracao: 'rodadas', rodadas: 2, passivos: [{ k: 'def', v: 5 }] },
        usos: [{ id: 'cura', nome: 'Cura', custo: 0, rolar: '2d8+2', tipo: 'cura', recupera: 'pv', perde: { san: '1d4' } }]
      },
      'teste-treino': { passivos: [{ k: 'treino', id: 'acrobacia' }, { k: 'treino', id: 'luta' }] },
      'teste-escolha': { escolhas: [{ id: 'p', rotulo: 'Perícia', tipo: 'pericia', opcoes: ['diplomacia', 'enganacao'] }], passivos: [{ k: 'per', id: { escolha: 'p' }, v: 2 }, { k: 'dados', alvo: 'pericia', id: { escolha: 'p' }, v: 1 }] },
      'teste-origem': { passivos: [{ k: 'cura', v: { atr: 'int' } }, { k: 'rd', tipo: 'mental', v: { atr: 'int' } }] },
      'teste-ritual': { formas: { padrao: { dano: '4d6' }, discente: { dano: '6d6' } }, ativavel: { custo: 0, duracao: 'cena', passivos: [{ k: 'def', v: 2 }, { k: 'def', v: 4, se: { forma: 'discente' } }] } }
    };
    const CAT = Object.assign({ origens: { academico: 'teste-origem' } }, PARANORMAL);

    return [
      { nome: 'E11 · Sem conteúdo do livro: nenhum efeito e PV como antes', obtido: function () {
        const f = comPoder(agente(), 'teste-ferro');
        const antes = calc.calcularTudo(f);
        return [antes.efeitos.carregado, antes.recursos.pv.bonusEfeitos, antes.efeitos.fontes.length].join('|');
      }, esperado: 'false|0|0' },
      { nome: 'E11 · Poder paranormal: +2 PV por 5% de NEX (NEX 50% = +20)', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = agente(); const sem = calc.pvMax(f);
          comPoder(f, 'teste-ferro');
          return calc.pvMax(f) - sem;
        });
      }, esperado: 20 },
      { nome: 'E11 · Poder paranormal usa o NEX de exposição (regra NEX e Experiência)', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = agente(); f.config.nexENivel = true; f.identificacao.nivel = 4; f.identificacao.nex = 10;
          const sem = calc.pvMax(f);
          comPoder(f, 'teste-ferro');
          return calc.pvMax(f) - sem; // 10% de exposição → 2 níveis × 2 PV
        });
      }, esperado: 4 },
      { nome: 'E11 · Afinidade: bônus só com afinidade desenvolvida com o elemento', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = comPoder(agente(), 'teste-ferro');
          const sem = calc.periciaBonus(f, 'fortitude');
          f.conjuracao.elementoConectado = 'sangue'; f.conjuracao.afinidadeDesenvolvida = true;
          const com = calc.periciaBonus(f, 'fortitude');
          f.conjuracao.elementoConectado = 'morte';
          const outro = calc.periciaBonus(f, 'fortitude');
          return (com - sem) + '|' + (outro - sem);
        });
      }, esperado: '5|0' },
      { nome: 'E11 · Passivos de poder geral: PV, PE por tabela de NEX, Defesa e deslocamento', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = agente(); const pv = calc.pvMax(f); const pe = calc.peMax(f); const def = calc.defesaTotal(f); const d = calc.deslocamento(f).metros;
          comPoder(f, 'teste-geral');
          return [calc.pvMax(f) - pv, calc.peMax(f) - pe, calc.defesaTotal(f) - def, calc.deslocamento(f).metros - d].join('|');
        });
      }, esperado: '20|3|2|3' },
      { nome: 'E11 · Origem: cura soma Int e RD mental igual ao Int; poder duplicado conta uma vez', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = agente({ identificacao: { origem: 'academico' } });
          comPoder(f, 'teste-origem'); comPoder(f, 'teste-origem');
          const e = calc.efeitosDaFicha(f);
          return [e.cura, calc.resistenciaEfeitos(f, 'mental'), calc.resistenciaEfeitos(f, 'fogo'), calc.fontesEfeitos(f).length].join('|');
        });
      }, esperado: '3|3|0|1' },
      { nome: 'E11 · Gasto opcional vale só no teste certo (atributo, exceções, ataque e dano)', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = comPoder(agente(), 'teste-geral');
          const ids = function (c) { return calc.gastosParaTeste(f, c).map(function (g) { return g.gasto; }).sort().join(','); };
          return [ids({ tipo: 'pericia', idPericia: 'ciencias' }), ids({ tipo: 'pericia', idPericia: 'atletismo' }), ids({ tipo: 'pericia', idPericia: 'luta' }),
            ids({ tipo: 'ataque', idPericia: 'luta', ataque: 'corpo' }), ids({ tipo: 'dano', ataque: 'corpo' })].join('|');
        });
      }, esperado: 'saber|atl||ataque|dano' },
      { nome: 'E11 · Unidades e custoExtra: NEX 50% permite 2 unidades por 2+2 PE', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = comPoder(agente(), 'teste-geral');
          const g = calc.gastosDaFicha(f).find(function (x) { return x.gasto === 'ataque'; });
          return [g.unidadesMax, g.custo, g.custoExtra, calc.custoDoGasto(f, g.fonteObj, g.def, 2)].join('|');
        });
      }, esperado: '2|2|1|3' },
      { nome: 'E11 · Preparar e rolar: soma o bônus, gasta o PE e limpa a preparação', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = comPoder(agente(), 'teste-geral');
          const peAntes = calc.estadoRecurso(f, 'pe').atual;
          OP.rolagens.prepararGasto(f, 'teste-geral__saber', 1);
          const res = comDados([r(10, 20)], function () { return OP.rolagens.rolarPericia(f, 'ciencias', {}); });
          const depois = calc.estadoRecurso(f, 'pe').atual;
          return [res.ok, res.escolhido, res.bonus, res.total, peAntes - depois, f.efeitos.preparados.length, res.poderes.join(',')].join('|');
        });
      }, esperado: 'true|10|5|15|2|0|Saber' },
      { nome: 'E11 · Preparado que não vale neste teste continua preparado e não gasta PE', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = comPoder(agente(), 'teste-geral');
          const peAntes = calc.estadoRecurso(f, 'pe').atual;
          OP.rolagens.prepararGasto(f, 'teste-geral__saber', 1);
          comDados([r(10, 20)], function () { return OP.rolagens.rolarPericia(f, 'luta', {}); });
          return [peAntes - calc.estadoRecurso(f, 'pe').atual, f.efeitos.preparados.length].join('|');
        });
      }, esperado: '0|1' },
      { nome: 'E11 · PE insuficiente: o teste não rola e a preparação fica', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = comPoder(agente(), 'teste-geral');
          f.recursos.pe.atual = 1;
          OP.rolagens.prepararGasto(f, 'teste-geral__saber', 1);
          const res = OP.rolagens.rolarPericia(f, 'ciencias', {});
          return [res.ok, /PE insuficiente/.test(res.erro || ''), f.efeitos.preparados.length, calc.estadoRecurso(f, 'pe').atual].join('|');
        });
      }, esperado: 'false|true|1|1' },
      { nome: 'E11 · Ataque com unidades: +10 no teste; dano preparado soma no dano', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = comPoder(agente(), 'teste-geral');
          const atq = OP.state.novoAtaque({ nome: 'x', pericia: 'luta', dano: '1d6' });
          f.ataques.push(atq);
          OP.rolagens.prepararGasto(f, 'teste-geral__ataque', 2);
          OP.rolagens.prepararGasto(f, 'teste-geral__dano', 1);
          const t = comDados([r(10, 20)], function () { return OP.rolagens.rolarAtaque(f, atq, {}); });
          const d = comDados([r(3, 6)], function () { return OP.rolagens.rolarDano(f, atq, {}); });
          return [t.bonus - calc.periciaBonus(f, 'luta'), t.partesBonus.length, d.total, f.efeitos.preparados.length].join('|');
        });
      }, esperado: '10|2|8|0' },
      { nome: 'E11 · Ativável: gasta PE, soma Defesa, conta rodadas e sai no fim', obtido: function () {
        return comEfeitos(DEFS, CAT, function () {
          const f = comPoder(agente(), 'teste-geral');
          const def0 = calc.defesaTotal(f); const pe0 = calc.estadoRecurso(f, 'pe').atual;
          const a = OP.rolagens.ativarEfeito(f, 'teste-geral');
          const ligado = calc.defesaTotal(f) - def0;
          const dupla = OP.rolagens.ativarEfeito(f, 'teste-geral').ok;
          const p1 = calc.passarRodadaEfeitos(f);
          f.efeitos.ativos = p1.ativos;
          const p2 = calc.passarRodadaEfeitos(f);
          return [a.ok, pe0 - calc.estadoRecurso(f, 'pe').atual, ligado, dupla, p1.ativos.length, p1.ativos[0].rodadas, p2.ativos.length, p2.removidos.length].join('|');
        });
      }, esperado: 'true|1|5|false|1|1|0|1' },
      { nome: 'E11 · Fim da cena tira os efeitos de cena e Desligar tira os manuais', obtido: function () {
        return comEfeitos(DEFS, { poderes: [] }, function () {
          const f = agente(); f.rituais.push(OP.state.novoRitual({ nome: 'R', catalogo: 'teste-ritual' }));
          const defsAntes = calc.defesaTotal(f);
          const a = OP.rolagens.ativarEfeito(f, 'teste-ritual');
          const fim = calc.fimDaCenaEfeitos(f);
          return [a.ok, calc.defesaTotal(f) - defsAntes, fim.removidos.length, fim.ativos.length].join('|');
        });
      }, esperado: 'true|2|1|0' },
      { nome: 'E11 · Ritual: conjurar liga o efeito na forma usada (Discente soma outro valor)', obtido: function () {
        return comEfeitos(DEFS, { poderes: [] }, function () {
          const f = agente();
          const rit = OP.state.novoRitual({ nome: 'R', catalogo: 'teste-ritual', circulo: 1, formas: { discente: { ativa: true, custoAdicional: 1 } } });
          f.rituais.push(rit);
          const def0 = calc.defesaTotal(f);
          const c = OP.rolagens.conjurarRitual(f, rit, 'discente');
          return [c.ok, c.efeitoLigado, calc.defesaTotal(f) - def0, f.efeitos.ativos[0].forma].join('|');
        });
      }, esperado: 'true|true|6|discente' },
      { nome: 'E11 · Uso de cura: rola, soma o bônus de cura, aplica em PV e tira SAN', obtido: function () {
        return comEfeitos(DEFS, Object.assign({ origens: { academico: 'teste-origem' } }, PARANORMAL), function () {
          const f = comPoder(agente({ identificacao: { origem: 'academico' } }), 'teste-geral');
          f.recursos.pv.atual = 10; const san0 = calc.estadoRecurso(f, 'san').atual;
          const res = comDados([r(4, 8), r(5, 8), r(2, 4)], function () { return OP.rolagens.usarEfeito(f, 'teste-geral__cura'); });
          return [res.ok, res.total, calc.estadoRecurso(f, 'pv').atual, san0 - calc.estadoRecurso(f, 'san').atual, /\+14 PV/.test(res.aplicado)].join('|');
        });
      }, esperado: 'true|14|24|2|true' },
      { nome: 'E11 · Treino: concede perícia nova (concedida por poder) e dá +2 se já treinada', obtido: function () {
        return comEfeitos(DEFS, { poderes: [{ id: 'teste-treino', tipo: 'geral' }] }, function () {
          const f = agente(); f.pericias.luta.grau = 1;
          const luta0 = calc.periciaBonus(f, 'luta'); const acro0 = calc.periciaBonus(f, 'acrobacia');
          comPoder(f, 'teste-treino');
          return [calc.periciaBonus(f, 'luta') - luta0, calc.periciaBonus(f, 'acrobacia') - acro0, calc.fonteConcedida(f, 'acrobacia'), calc.fonteConcedida(f, 'luta')].join('|');
        });
      }, esperado: '2|5|poder|' },
      { nome: 'E11 · Condição "treinado" num efeito vê o treino dado por outro efeito (sem laço)', obtido: function () {
        return comEfeitos({ 'teste-laco': { passivos: [{ k: 'treino', id: 'luta' }, { k: 'def', v: 3, se: { treinado: 'luta' } }] } }, { poderes: [{ id: 'teste-laco', tipo: 'geral' }] }, function () {
          const f = agente(); const d0 = calc.defesaTotal(f);
          comPoder(f, 'teste-laco');
          return calc.defesaTotal(f) - d0;
        });
      }, esperado: 3 },
      { nome: 'E11 · Escolha pendente: sem escolha não calcula e avisa; com escolha vale (bônus e dado)', obtido: function () {
        return comEfeitos(DEFS, { poderes: [{ id: 'teste-escolha', tipo: 'geral' }] }, function () {
          const f = comPoder(agente(), 'teste-escolha');
          const pend = calc.pendenciasDeEfeitos(f).length;
          const antes = calc.periciaBonus(f, 'diplomacia');
          f.efeitos.escolhas.push({ id: 'teste-escolha__p', chave: 'teste-escolha', campo: 'p', valor: 'diplomacia' });
          return [pend, calc.pendenciasDeEfeitos(f).length, calc.periciaBonus(f, 'diplomacia') - antes, calc.testePericia(f, 'diplomacia', 0).dados.qtd - calc.testePericia(f, 'enganacao', 0).dados.qtd].join('|');
        });
      }, esperado: '1|0|2|1' },
      { nome: 'E11 · Escolha que saiu das opções é removida pelas correções', obtido: function () {
        return comEfeitos(DEFS, { poderes: [{ id: 'teste-escolha', tipo: 'geral' }] }, function () {
          const f = comPoder(agente(), 'teste-escolha');
          f.efeitos.escolhas.push({ id: 'teste-escolha__p', chave: 'teste-escolha', campo: 'p', valor: 'luta' });
          return calc.correcoes(f).filter(function (c) { return c.caminho === 'efeitos.escolhas'; }).length;
        });
      }, esperado: 1 },
      { nome: 'E11 · Dano e cura de ritual: forma ativa, bônus de poderes e ritual sem forma', obtido: function () {
        return comEfeitos({ 'teste-ritual': { formas: { padrao: { dano: '1d6' } } }, 'teste-bonus': { passivos: [{ k: 'danoRitual', v: 2 }, { k: 'curaRitual', v: 3 }] } }, { poderes: [{ id: 'teste-bonus', tipo: 'geral' }] }, function () {
          const f = comPoder(agente(), 'teste-bonus');
          const rit = OP.state.novoRitual({ nome: 'R', formas: { padrao: { dano: '1d6', cura: '1d4' } } });
          const dano = comDados([r(3, 6)], function () { return OP.rolagens.rolarDanoRitual(f, rit, 'padrao'); });
          const cura = comDados([r(2, 4)], function () { return OP.rolagens.rolarCuraRitual(f, rit, 'padrao'); });
          const semForma = OP.rolagens.rolarCuraRitual(f, rit, 'discente');
          return [dano.total, cura.total, cura.cura, semForma.ok].join('|');
        });
      }, esperado: '5|5|true|false' },
      { nome: 'E11 · validarEfeitos aceita o formato e recusa erros', obtido: function () {
        const bom = calc.validarEfeitos('a', DEFS['teste-geral']).length;
        const ruins = [
          { passivos: [{ k: 'foo', v: 1 }] }, { passivos: [{ k: 'pv', v: { nivel: 'x' } }] }, { passivos: [{ k: 'per', id: 'xx', v: 1 }] },
          { gastos: [{ id: 'g', custo: 1, quando: {}, bonus: 1 }] }, { gastos: [{ id: 'g', custo: 1, quando: { pericia: 'todas' } }] },
          { ativavel: { custo: 1, duracao: 'sempre', passivos: [{ k: 'def', v: 1 }] } }, { usos: [{ id: 'u', tipo: 'cura', custo: 0, rolar: 'abc' }] },
          { passivos: [{ k: 'per', id: { escolha: 'nao' }, v: 1 }] }, { formas: { padrao: { dano: '10 x 10' } } }, { coisa: 1 }
        ].map(function (d) { return calc.validarEfeitos('b', d).length > 0; });
        return bom + '|' + ruins.every(Boolean);
      }, esperado: '0|true' },
      { nome: 'E11 · OP.livro separa o texto dos dados (§AUTO§), monta o catálogo e valida os efeitos', obtido: function () {
        const efeitos = OP.data.efeitos; const cat = OP.data.catalogo;
        OP.data.efeitos = {}; OP.data.catalogo = { origens: {}, trilhas: {}, classe: {}, poderes: [], rituais: [] };
        const aviso = console.warn; console.warn = function () {};
        try {
          OP.livro._registrar('habilidades', { chave: 'p1', titulo: 'Poder Um', texto: 'Poder geral · Combate\nDescrição: texto do livro\n\n§AUTO§' + JSON.stringify({ t: 'poder', tipo: 'geral', categoria: 'combate', ef: { passivos: [{ k: 'def', v: 1 }] } }) });
          OP.livro._registrar('rituais', { chave: 'r1', titulo: 'Ritual Um', texto: 'Ritual\n\n§AUTO§' + JSON.stringify({ t: 'ritual', circulo: 2, elemento: 'morte', execucao: 'padrão' }) });
          OP.livro._registrar('habilidades', { chave: 'p2', titulo: 'Ruim', texto: 'x\n\n§AUTO§' + JSON.stringify({ t: 'poder', tipo: 'geral', ef: { passivos: [{ k: 'zzz', v: 1 }] } }) });
          OP.livro._registrar('origens', { chave: 'o1', titulo: 'Origem', texto: 'Origem\n\n§AUTO§{quebrado' });
          const t = OP.livro.texto('p1');
          return [t.corpo.indexOf('§AUTO§') === -1, t.titulo, OP.data.catalogo.poderes.length, OP.data.catalogo.rituais[0].circulo, Object.keys(OP.data.efeitos).join(','), OP.livro.texto('o1').corpo].join('|');
        } finally {
          console.warn = aviso; OP.data.efeitos = efeitos; OP.data.catalogo = cat;
          OP.livro._esquecerTextos(['p1', 'p2', 'r1', 'o1']);
        }
      }, esperado: 'true|Poder Um|2|2|p1|Origem' },
      { nome: 'E11 · Ficha nova e importada trazem a seção efeitos (v11) e ignoram lixo', obtido: function () {
        const f = OP.state.criarFichaVazia();
        const imp = OP.state.sanitizar({ efeitos: { ativos: [{ id: 'a', chave: 'c', rodadas: 2, ateFimCena: true, lixo: 1 }, 5], preparados: 'x', escolhas: [{ id: 'e', chave: 'c', campo: 'p', valor: 'luta' }] } });
        return [OP.state.VERSAO_MODELO, Array.isArray(f.efeitos.ativos), imp.efeitos.ativos.length, imp.efeitos.ativos[0].rodadas, imp.efeitos.preparados.length, imp.efeitos.escolhas[0].valor].join('|');
      }, esperado: '11|true|1|2|0|luta' },
      { nome: 'E11 · Histórico: habilidade e ritual do catálogo guardam só a chave (nenhum texto)', obtido: function () {
        const h = OP.state.novaHabilidade({ nome: 'X', catalogo: 'chave-x' });
        const rt = OP.state.novoRitual({ nome: 'Y', catalogo: 'chave-y' });
        return [h.catalogo, rt.catalogo, h.descricao === '', rt.formas.padrao.cura === ''].join('|');
      }, esperado: 'chave-x|chave-y|true|true' },
      { nome: 'E12 · Origem e trilha: as habilidades entram sozinhas (origem + marcos da trilha já liberados)', obtido: function () {
        const f = OP.state.criarFichaVazia();
        Object.assign(f.identificacao, { classe: 'combatente', origem: 'academico', trilha: 'combatente-aniquilador', nex: 40 });
        OP.state.sincronizarHabilidadesAutomaticas(f);
        return f.habilidades.map(function (h) { return h.fonte + ':' + h.nome; }).join('|');
      }, esperado: 'origem:Saber é Poder|trilha:A Favorita|trilha:Técnica Secreta' },
      { nome: 'E12 · Habilidades automáticas: repetir não muda nada; NEX menor tira o marco; trocar a origem troca a habilidade', obtido: function () {
        const f = OP.state.criarFichaVazia();
        Object.assign(f.identificacao, { classe: 'combatente', origem: 'academico', trilha: 'combatente-aniquilador', nex: 40 });
        OP.state.sincronizarHabilidadesAutomaticas(f);
        const repetiu = OP.state.sincronizarHabilidadesAutomaticas(f);
        f.identificacao.nex = 10;
        OP.state.sincronizarHabilidadesAutomaticas(f);
        const nexBaixo = f.habilidades.length;
        f.identificacao.origem = 'amigo-dos-animais';
        OP.state.sincronizarHabilidadesAutomaticas(f);
        const origem = f.habilidades.filter(function (h) { return h.fonte === 'origem'; });
        return [repetiu, nexBaixo, origem.length, origem[0].nome !== 'Saber é Poder', f.habilidades.length].join('|');
      }, esperado: 'false|2|1|true|2' },
      { nome: 'E12 · Habilidade que a pessoa já tinha (mesma fonte e nome) é adotada com a descrição; poderes comuns não são tocados', obtido: function () {
        const f = OP.state.criarFichaVazia();
        Object.assign(f.identificacao, { classe: 'combatente', origem: 'academico', nex: 5 });
        f.habilidades.push(OP.state.novaHabilidade({ nome: 'saber e poder', fonte: 'origem', descricao: 'minha nota' }));
        f.habilidades.push(OP.state.novaHabilidade({ nome: 'Ataque Especial', fonte: 'poder' }));
        OP.state.sincronizarHabilidadesAutomaticas(f);
        const o = f.habilidades.find(function (h) { return h.fonte === 'origem'; });
        return [f.habilidades.length, o.id.indexOf('auto-origem-') === 0, o.descricao, f.habilidades.some(function (h) { return h.nome === 'Ataque Especial'; })].join('|');
      }, esperado: '2|true|minha nota|true' },
      { nome: 'E12 · Habilidades automáticas: a chave do livro é ligada quando o conteúdo chega e não some quando ele sai', obtido: function () {
        const f = OP.state.criarFichaVazia();
        Object.assign(f.identificacao, { classe: 'combatente', origem: 'academico', nex: 5 });
        OP.state.sincronizarHabilidadesAutomaticas(f);
        const antes = f.habilidades[0].catalogo;
        const cat = OP.data.catalogo;
        OP.data.catalogo = { origens: { academico: 'academico-livro' }, trilhas: {}, classe: {}, poderes: [], rituais: [] };
        try {
          OP.state.sincronizarHabilidadesAutomaticas(f);
          const durante = f.habilidades[0].catalogo;
          OP.data.catalogo = { origens: {}, trilhas: {}, classe: {}, poderes: [], rituais: [] };
          OP.state.sincronizarHabilidadesAutomaticas(f);
          return [antes === '', durante, f.habilidades[0].catalogo].join('|');
        } finally { OP.data.catalogo = cat; }
      }, esperado: 'true|academico-livro|academico-livro' }
    ];
  }

  OP.testesEtapa11 = testesEtapa11;
})(window.OP);
