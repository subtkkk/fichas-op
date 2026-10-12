/* ==========================================================================
   js/tests.js — verificações das fórmulas
   --------------------------------------------------------------------------
   Não roda sozinho. No console do navegador, digite:  OP.runTests()
   Usa fichas montadas aqui mesmo: a ficha aberta na tela não é alterada.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  /**
   * Monta uma ficha de teste a partir da ficha vazia.
   * config: { classe, nex, atributos: { vig: 1, ... }, bonusMax: { pv: 3, ... },
   *           pericias: { luta: { grau: 1, outros: 2 }, ... },
   *           inventario: { patente, capacidadeBonus, ... },
   *           itens: [ { tipo, espacos, quantidade, ... } ] }
   */
  function fichaDeTeste(config) {
    const ficha = OP.state.criarFichaVazia();
    ficha.identificacao.classe = config.classe || '';
    ficha.identificacao.nex = config.nex !== undefined ? config.nex : 5;
    if (config.estagio !== undefined) ficha.identificacao.estagio = config.estagio;
    if (config.origem !== undefined) ficha.identificacao.origem = config.origem;
    if (config.trilha !== undefined) ficha.identificacao.trilha = config.trilha;
    if (config.escolhasOrigem) Object.assign(ficha.identificacao.escolhas.origem, config.escolhasOrigem);
    if (config.gruposClasse) ficha.identificacao.escolhas.classe.grupos = config.gruposClasse.slice();
    Object.keys(config.atributos || {}).forEach(function (id) {
      ficha.atributos[id].base = config.atributos[id];
    });
    Object.keys(config.bonusMax || {}).forEach(function (id) {
      ficha.recursos[id].bonusMax = config.bonusMax[id];
    });
    Object.keys(config.pericias || {}).forEach(function (id) {
      Object.assign(ficha.pericias[id], config.pericias[id]);
    });
    Object.assign(ficha.inventario, config.inventario || {});
    ficha.inventario.itens = (config.itens || []).map(OP.state.novoItem);
    return ficha;
  }

  /* ------------------------------------------------------------------------
     Dados previsíveis: troca o gerador por uma fila de valores.
     Para forçar o valor v num dado de f faces, o gerador devolve (v − 0,5) / f.
     ------------------------------------------------------------------------ */

  /** r(17, 20) → número que faz um d20 sair 17. */
  function r(valor, faces) {
    return (valor - 0.5) / faces;
  }

  /** Roda a conta com o gerador trocado pela fila e SEMPRE restaura o original. */
  function comDados(fila, conta) {
    const original = OP.dados.getRng();
    let posicao = 0;
    OP.dados.setRng(function () {
      const valor = fila[posicao];
      posicao += 1;
      return valor === undefined ? 0 : valor;
    });
    try {
      return conta();
    } finally {
      OP.dados.setRng(original);
    }
  }

  /** Fila de d20: d20s(4, 17, 9) → [r(4,20), r(17,20), r(9,20)]. */
  function d20s() {
    return Array.prototype.map.call(arguments, function (v) { return r(v, 20); });
  }

  /** Chama a função e diz se ela lançou exceção (deve ser false). */
  function lancou(funcao) {
    try {
      funcao();
      return false;
    } catch (erro) {
      return true;
    }
  }

  /** Lista de verificações: { nome, obtido: function, esperado }. */
  function casos() {
    const calc = OP.calc;

    const especialista = fichaDeTeste({ classe: 'especialista', nex: 5, atributos: { vig: 1, pre: 2 } });
    const combatente = fichaDeTeste({ classe: 'combatente', nex: 5, atributos: { vig: 2, pre: 1 } });
    const ocultista = fichaDeTeste({ classe: 'ocultista', nex: 50, atributos: { vig: 1, pre: 3 } });
    const comBonus = fichaDeTeste({ classe: 'especialista', nex: 5, atributos: { vig: 1 }, bonusMax: { pv: 3 } });
    const semClasse = fichaDeTeste({ classe: '', nex: 50, atributos: { vig: 3, pre: 3 } });

    // Bônus do atributo (não só a base) entra no cálculo.
    const vigComBonus = fichaDeTeste({ classe: 'combatente', nex: 5, atributos: { vig: 1 } });
    vigComBonus.atributos.vig.bonus = 2;

    // --- Perícias ---
    const graus = fichaDeTeste({
      pericias: {
        luta: { grau: 1, outros: 2 },      // Treinado + 2
        pontaria: { grau: 2 },             // Veterano
        ocultismo: { grau: 3 },            // Expert
        atletismo: { grau: 0 },            // Destreinado
        furtividade: { grau: 1, outros: -3 }
      }
    });
    const agi3 = fichaDeTeste({ atributos: { agi: 3 } });
    const agi2mais1 = fichaDeTeste({ atributos: { agi: 2 } });
    agi2mais1.atributos.agi.bonus = 1;
    const agi0 = fichaDeTeste({ atributos: { agi: 0 } });
    const lutaComAgi = fichaDeTeste({ atributos: { agi: 3, for: 1 }, pericias: { luta: { atributo: 'agi' } } });
    const atributoInvalido = fichaDeTeste({ pericias: { luta: { atributo: 'xyz' } } });
    const especialistaInt3 = fichaDeTeste({ classe: 'especialista', atributos: { int: 3 } });
    const tresTreinadas = fichaDeTeste({
      classe: 'especialista',
      pericias: {
        investigacao: { grau: 1 },
        percepcao: { grau: 1 },
        ocultismo: { grau: 1, concedida: true }
      }
    });
    const concedidaSemGrau = fichaDeTeste({ pericias: { luta: { grau: 0, concedida: true } } });
    const pontosComBonus = fichaDeTeste({ classe: 'ocultista', atributos: { int: 2 } });
    pontosComBonus.pontosTreinamento.bonus = 1;

    // --- Dados de perícias (contagens conferidas com o livro) ---
    function contarPericias(filtro) {
      return OP.data.pericias.filter(filtro).length;
    }
    function porAtributo(idAtributo) {
      return function () { return contarPericias(function (p) { return p.atributoPadrao === idAtributo; }); };
    }
    const religiao = OP.data.pericias.find(function (p) { return p.id === 'religiao'; });

    // --- Defesa e derivados ---
    const exemploEspecialista = fichaDeTeste({
      classe: 'especialista',
      atributos: { agi: 2 },
      pericias: { fortitude: { grau: 1 }, reflexos: { grau: 1 } }
    });
    const destreinado = fichaDeTeste({ atributos: { agi: 2 } });
    const lutaTreinada = fichaDeTeste({ pericias: { luta: { grau: 1 } } });
    const comProtecao = fichaDeTeste({ atributos: { agi: 3 } });
    comProtecao.defesa.protecao.defesa = 5;
    comProtecao.defesa.outros = 1;
    const deslocamentoMais3 = fichaDeTeste({});
    deslocamentoMais3.defesa.deslocamentoBonus = 3;

    // --- Inventário ---
    const cfg = OP.data.config;
    const for1 = fichaDeTeste({ atributos: { for: 1 } });
    const for3mais2 = fichaDeTeste({ atributos: { for: 3 }, inventario: { capacidadeBonus: 2 } });
    const for0 = fichaDeTeste({ atributos: { for: 0 } });
    const doisItens = fichaDeTeste({
      atributos: { for: 2 },
      itens: [{ nome: 'A', espacos: 2, quantidade: 3 }, { nome: 'B', espacos: 1, quantidade: 1 }]
    });
    const recrutaTresI = fichaDeTeste({
      itens: [{ categoria: 1 }, { categoria: 1 }, { categoria: 1 }]
    });
    const recrutaQtd3 = fichaDeTeste({ itens: [{ categoria: 1, quantidade: 3 }] });
    function limiteI(ficha) {
      return calc.limitesItens(ficha).find(function (limite) { return limite.categoria === 'I'; });
    }
    const protecaoEquipada = fichaDeTeste({
      atributos: { agi: 2 },
      itens: [{ nome: 'Colete', tipo: 'protecao', defesa: 5, equipada: true }]
    });
    const protecaoGuardada = fichaDeTeste({
      atributos: { agi: 2 },
      itens: [{ nome: 'Colete', tipo: 'protecao', defesa: 5, equipada: false }]
    });
    const geralMarcadoEquipado = fichaDeTeste({
      atributos: { agi: 2 },
      itens: [{ nome: 'Mochila', tipo: 'geral', defesa: 5, equipada: true }]
    });
    const sobrecarga = fichaDeTeste({
      atributos: { for: 1, agi: 2 },
      pericias: { furtividade: { grau: 1 }, fortitude: { grau: 1 } },
      itens: [{ nome: 'Caixa', espacos: 6 }]
    });
    const noLimite = fichaDeTeste({ atributos: { for: 1 }, itens: [{ espacos: 5 }] });
    const protecaoPenalidade = fichaDeTeste({
      pericias: { acrobacia: { grau: 1 }, luta: { grau: 1 } },
      itens: [{ nome: 'Armadura', tipo: 'protecao', defesa: 2, penalidade: 2, equipada: true }]
    });
    const kitMedicina = fichaDeTeste({
      pericias: { medicina: { grau: 1 } },
      itens: [{ nome: 'Kit de medicina', tipo: 'kit', periciaKit: 'medicina' }]
    });
    const kitSemPericia = fichaDeTeste({ itens: [{ tipo: 'geral', periciaKit: 'medicina' }] });
    const creditoManual = fichaDeTeste({ inventario: { creditoNivel: 'alto' } });

    /** Roda uma conta com config.bonusKit trocado e devolve o valor ao final. */
    function comBonusKit(valor, conta) {
      const original = cfg.bonusKit;
      cfg.bonusKit = valor;
      try {
        return conta();
      } finally {
        cfg.bonusKit = original;
      }
    }

    // --- Etapa 6: patentes, dados e ataques ---
    const tabelaPatentes = {
      'recruta':           { ppMinimo: 0,   credito: 'baixo',     limites: { I: 2, II: 0, III: 0, IV: 0 } },
      'operador':          { ppMinimo: 20,  credito: 'medio',     limites: { I: 3, II: 1, III: 0, IV: 0 } },
      'agente-especial':   { ppMinimo: 50,  credito: 'medio',     limites: { I: 3, II: 2, III: 1, IV: 0 } },
      'oficial-operacoes': { ppMinimo: 100, credito: 'alto',      limites: { I: 3, II: 3, III: 2, IV: 1 } },
      'agente-elite':      { ppMinimo: 200, credito: 'ilimitado', limites: { I: 3, II: 3, III: 3, IV: 2 } }
    };
    function casosPatentes() {
      return Object.keys(tabelaPatentes).map(function (id) {
        const esperado = tabelaPatentes[id];
        return {
          nome: 'Tabela 3.1: ' + id + ' (PP, crédito e limites)',
          obtido: function () {
            const p = OP.data.patentes.find(function (x) { return x.id === id; });
            return p ? JSON.stringify({ ppMinimo: p.ppMinimo, credito: p.credito, limites: p.limites }) : 'não existe';
          },
          esperado: JSON.stringify(esperado)
        };
      });
    }
    const recrutaItemII = fichaDeTeste({ itens: [{ categoria: 2 }] });
    function limiteCategoria(ficha, categoria) {
      return calc.limitesItens(ficha).find(function (l) { return l.categoria === categoria; });
    }

    const lutaFor2 = fichaDeTeste({ atributos: { for: 2 }, pericias: { luta: { grau: 1 } } });
    const ataqueLuta = OP.state.novoAtaque({ nome: 'Faca', pericia: 'luta', testeBonus: 1, dano: '1d4', critMargem: 19, critMult: 2 });
    const ataqueSemMunicao = OP.state.novoAtaque({ nome: 'Pistola', pericia: 'pontaria', usaMunicao: true, municao: 0 });
    const ataqueComMunicao = OP.state.novoAtaque({ nome: 'Pistola', pericia: 'pontaria', usaMunicao: true, municao: 3 });
    const ataqueCritico = OP.state.novoAtaque({ nome: 'Machado', pericia: 'luta', dano: '1d8+2', danoBonus: 1, critMargem: 19, critMult: 2 });

    // --- Etapa 7: rituais e conjuração ---
    const dtCfg = cfg.dtRitual;

    /** Roda a conta com config.dtRitual.somaLimitePE trocado e SEMPRE restaura o original. */
    function comSomaLimitePE(valor, conta) {
      const original = dtCfg.somaLimitePE;
      dtCfg.somaLimitePE = valor;
      try {
        return conta();
      } finally {
        dtCfg.somaLimitePE = original;
      }
    }

    /** Ficha para a DT: NEX 50, atributo da DT (config) = 3, bônus de DT 2. */
    function fichaDt() {
      const atributos = {};
      atributos[dtCfg.atributo] = 3;
      const ficha = fichaDeTeste({ classe: 'ocultista', nex: 50, atributos: atributos });
      ficha.conjuracao.dtBonus = 2;
      return ficha;
    }

    /** Ocultista NEX 5%, PRE 1 → PE máximo 5 (limite por turno 1), com PE atual definido. */
    function fichaPE(atual) {
      const ficha = fichaDeTeste({ classe: 'ocultista', nex: 5, atributos: { pre: 1 } });
      ficha.recursos.pe.atual = atual === undefined ? 5 : atual;
      return ficha;
    }

    /** Gasta em sequência e devolve o estado depois de cada passo. */
    function gastosEmSequencia(ficha, custos) {
      return custos.map(function (custo) {
        const resultado = OP.state.gastarPE(custo, ficha);
        return { ok: resultado.ok, motivo: resultado.motivo, avisoLimite: resultado.avisoLimite,
                 pe: calc.estadoRecurso(ficha, 'pe').atual, turno: ficha.conjuracao.peGastoTurno };
      });
    }

    function ritualDeTeste(dados) {
      return OP.state.novoRitual(Object.assign({ nome: 'Ritual de teste' }, dados));
    }
    const ritualDiscente4 = ritualDeTeste({ circulo: 2, formas: { padrao: { custo: 3 }, discente: { ativa: true, custo: 4 } } });
    const ritualPadrao0 = ritualDeTeste({ circulo: 1, formas: { padrao: { custo: 0 } } });
    const ritualCirculo3 = ritualDeTeste({ circulo: 3 });
    const ritualDano = ritualDeTeste({ formas: { padrao: { dano: '2d6+3' } } });
    const ritualDanoRuim = ritualDeTeste({ formas: { padrao: { dano: 'abc' } } });

    // --- Etapa 8, Parte A: DT, resistência, afinidade e rituais de Medo ---
    function fichaOcultista(nex, pre) {
      return fichaDeTeste({ classe: 'ocultista', nex: nex, atributos: { pre: pre } });
    }

    /** Ocultista NEX 5%, PRE 1 (PE máx 5, SAN máx 20) com PE e SAN atuais definidos. */
    function fichaMedo(pe, san) {
      const ficha = fichaDeTeste({ classe: 'ocultista', nex: 5, atributos: { pre: 1 } });
      ficha.recursos.pe.atual = pe;
      ficha.recursos.san.atual = san;
      return ficha;
    }
    const ritualMedo = ritualDeTeste({
      elemento: 'medo',
      formas: { padrao: { custo: 3 }, discente: { ativa: true, custo: 4 }, verdadeira: { ativa: true, custo: 5 } }
    });
    const ritualSangue = ritualDeTeste({ elemento: 'sangue', formas: { padrao: { custo: 3 } } });
    const ritualVontade = ritualDeTeste({ resistencia: { teste: 'vontade', efeito: 'parcial' } });

    /** Conjura e devolve o antes/depois: { ok, pe, san, perda, sanMaxAntes, sanMax }. */
    function conjurarResumo(ficha, ritual, forma) {
      const sanMaxAntes = calc.sanMax(ficha);
      const resultado = OP.rolagens.conjurarRitual(ficha, ritual, forma);
      return {
        ok: resultado.ok,
        pe: calc.estadoRecurso(ficha, 'pe').atual,
        san: calc.estadoRecurso(ficha, 'san').atual,
        perda: ficha.recursos.san.perdaPermanente,
        sanMaxAntes: sanMaxAntes,
        sanMax: calc.sanMax(ficha)
      };
    }

    function habilidadeComDt(atributo, bonus) {
      const ficha = fichaDeTeste({ nex: 5, atributos: { for: 2 } });
      ficha.habilidades = [OP.state.novaHabilidade({ nome: 'Golpe', atributoDT: atributo, dtBonus: bonus || 0 })];
      return calc.estadoHabilidades(ficha)[0].dt;
    }

    // --- Etapa 8, Parte B: modelo, importação e várias fichas ---

    /** Cópia com as chaves em ordem alfabética (para comparar objetos). */
    function ordenado(valor) {
      if (Array.isArray(valor)) return valor.map(ordenado);
      if (valor && typeof valor === 'object') {
        const resultado = {};
        Object.keys(valor).sort().forEach(function (chave) { resultado[chave] = ordenado(valor[chave]); });
        return resultado;
      }
      return valor;
    }
    function iguais(a, b) {
      return JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(b));
    }

    /** Ficha com todas as seções preenchidas. */
    function fichaPreenchida() {
      const ficha = fichaDeTeste({
        classe: 'ocultista', nex: 25, atributos: { pre: 3, int: 2 },
        pericias: { ocultismo: { grau: 2, outros: 1 } },
        itens: [{ nome: 'Lanterna', espacos: 1, descricao: 'Pilhas novas' }]
      });
      ficha.id = 'ficha-ida-e-volta';
      ficha.identificacao.nome = 'Ana <b>Júlia</b>';
      ficha.recursos.san.perdaPermanente = 1;
      ficha.recursos.pv.atual = 7;
      ficha.ataques = [OP.state.novoAtaque({ nome: 'Faca', dano: '1d4' })];
      ficha.habilidades = [OP.state.novaHabilidade({ nome: 'Poder', atributoDT: 'pre', descricao: 'Linha 1\nLinha 2' })];
      ficha.rituais = [OP.state.novoRitual({ nome: 'Ritual', elemento: 'medo', resistencia: { teste: 'vontade', efeito: 'parcial' }, resistenciaNotas: 'nota' })];
      ficha.conjuracao.elementoConectado = 'sangue';
      ficha.conjuracao.afinidadeDesenvolvida = true;
      ficha.identificacao.origem = 'academico';
      ficha.identificacao.trilha = 'ocultista-graduado';
      ficha.biografia.historico = 'Veio de longe.';
      return ficha;
    }

    /** Roda a conta com um armazenamento falso (em memória) e SEMPRE restaura o original. */
    function comArmazenamentoFalso(conta, preparar) {
      const falso = OP.storage.criarMemoria();
      if (preparar) preparar(falso);
      const anterior = OP.storage.usar(falso);
      try {
        return conta(falso);
      } finally {
        OP.storage.usar(anterior);
      }
    }

    function importarTexto(texto) {
      return OP.state.lerImportacao(texto);
    }
    function recusado(texto) {
      const r = importarTexto(texto);
      return r.ok === false && typeof r.erro === 'string' && r.erro.length > 0 && r.fichas.length === 0;
    }

    const fichaEtapa1 = {
      versao: 1,
      config: { modoLivre: false },
      identificacao: { nome: 'Agente Antigo', jogador: 'Bia', origem: '', classe: 'ocultista', trilha: '', nex: 10 },
      atributos: {
        agi: { base: 1, bonus: 0 }, for: { base: 1, bonus: 0 }, int: { base: 2, bonus: 0 },
        pre: { base: 3, bonus: 0 }, vig: { base: 1, bonus: 0 }
      },
      recursos: { pv: { atual: null, bonus: 2 }, pe: { atual: 4, bonus: 0 }, san: { atual: null, bonus: 0 } },
      descricao: { aparencia: '', personalidade: '', historico: 'Começou na Etapa 1.', objetivo: '', anotacoes: '' }
    };

    const XSS = '<img src=x onerror=alert(1)>';

    // --- Etapa 9: classes, origens, trilhas e progressão (dados reais) ---

    /** "PV/PE/SAN" de uma ficha de teste. */
    function recursosDe(config) {
      const f = fichaDeTeste(config);
      return [calc.pvMax(f), calc.peMax(f), calc.sanMax(f)].join('/');
    }

    function idsPericiasCitadas() {
      const ids = [];
      OP.data.origens.forEach(function (o) {
        Array.prototype.push.apply(ids, o.pericias);
        if (o.escolha && o.escolha.opcoes) o.escolha.opcoes.forEach(function (par) { Array.prototype.push.apply(ids, par); });
        if (o.escolha && o.escolha.mapa) Object.keys(o.escolha.mapa).forEach(function (k) { ids.push(o.escolha.mapa[k]); });
      });
      calc.classesLista().forEach(function (c) {
        Array.prototype.push.apply(ids, c.pericias.fixas);
        c.pericias.escolhas.forEach(function (grupo) { Array.prototype.push.apply(ids, grupo); });
      });
      return ids;
    }

    function idsUnicos(lista) {
      const ids = lista.map(function (item) { return item.id; });
      return new Set(ids).size === ids.length;
    }

    /** Ficha com perícias em Veterano/Expert para os avisos de grau. */
    function fichaGraus(classe, nex, pericias) {
      return fichaDeTeste({ classe: classe, nex: nex, pericias: pericias });
    }

    function concedidas(config) {
      return calc.periciasConcedidas(fichaDeTeste(config)).join(',');
    }

    function habilidadesTrilhaTexto(config) {
      return calc.habilidadesTrilha(fichaDeTeste(config)).map(function (h) { return h.marco + ':' + h.liberada; }).join(',');
    }

    /** "Padrão/Discente/Verdadeiro" (custos totais) de um ritual. */
    function custosRitual(dados) {
      const ritual = OP.state.novoRitual(dados);
      return ['padrao', 'discente', 'verdadeira'].map(function (forma) { return calc.custoForma(ritual, forma); }).join('/');
    }

    const armaAtroz = {
      nome: 'Arma Atroz', circulo: 1, elemento: 'sangue',
      formas: {
        discente: { ativa: true, custoAdicional: 2, requerCirculo: 2, requerAfinidade: false },
        verdadeira: { ativa: true, custoAdicional: 5, requerCirculo: 3, requerAfinidade: true }
      }
    };

    /** Tipos dos avisos de uma forma: "circulo,afinidade" (vazio = sem avisos). */
    function avisosDe(config, ritualDados, forma, conjuracao) {
      const f = fichaDeTeste(config);
      Object.assign(f.conjuracao, conjuracao || {});
      return calc.avisosForma(f, OP.state.novoRitual(ritualDados), forma).map(function (a) { return a.tipo; }).join(',');
    }

    function migrado(identificacao) {
      return OP.state.completarPadroes({ identificacao: identificacao }).identificacao;
    }

    return [
      // --- Casos pedidos ---
      { nome: 'Especialista NEX 5%, VIG 1, PRE 2 → PV', obtido: function () { return calc.pvMax(especialista); }, esperado: 17 },
      { nome: 'Especialista NEX 5%, VIG 1, PRE 2 → PE', obtido: function () { return calc.peMax(especialista); }, esperado: 5 },
      { nome: 'Especialista NEX 5%, VIG 1, PRE 2 → SAN', obtido: function () { return calc.sanMax(especialista); }, esperado: 16 },

      { nome: 'Combatente NEX 5%, VIG 2, PRE 1 → PV', obtido: function () { return calc.pvMax(combatente); }, esperado: 22 },
      { nome: 'Combatente NEX 5%, VIG 2, PRE 1 → PE', obtido: function () { return calc.peMax(combatente); }, esperado: 3 },
      { nome: 'Combatente NEX 5%, VIG 2, PRE 1 → SAN', obtido: function () { return calc.sanMax(combatente); }, esperado: 12 },

      { nome: 'Ocultista NEX 50%, VIG 1, PRE 3 → PV', obtido: function () { return calc.pvMax(ocultista); }, esperado: 40 },
      { nome: 'Ocultista NEX 50%, VIG 1, PRE 3 → PE', obtido: function () { return calc.peMax(ocultista); }, esperado: 70 },
      { nome: 'Ocultista NEX 50%, VIG 1, PRE 3 → SAN', obtido: function () { return calc.sanMax(ocultista); }, esperado: 65 },

      // 16 + VIG 1 + bônus 3 = 20
      { nome: 'Especialista NEX 5%, VIG 1, bônus PV +3 → PV (16 + VIG + bônus)', obtido: function () { return calc.pvMax(comBonus); }, esperado: 20 },

      // --- Extras ---
      { nome: 'Combatente VIG base 1 + bônus 2 → PV usa o total (20 + 3)', obtido: function () { return calc.pvMax(vigComBonus); }, esperado: 23 },
      { nome: 'Sem classe → PV 0', obtido: function () { return calc.pvMax(semClasse); }, esperado: 0 },
      { nome: 'Sem classe → PE 0', obtido: function () { return calc.peMax(semClasse); }, esperado: 0 },
      { nome: 'Sem classe → SAN 0', obtido: function () { return calc.sanMax(semClasse); }, esperado: 0 },

      { nome: 'passosNex(5)', obtido: function () { return calc.passosNex(5); }, esperado: 0 },
      { nome: 'passosNex(10)', obtido: function () { return calc.passosNex(10); }, esperado: 1 },
      { nome: 'passosNex(50)', obtido: function () { return calc.passosNex(50); }, esperado: 9 },
      { nome: 'passosNex(95)', obtido: function () { return calc.passosNex(95); }, esperado: 18 },
      { nome: 'passosNex(99)', obtido: function () { return calc.passosNex(99); }, esperado: 19 },

      { nome: 'limitePEporTurno(5)', obtido: function () { return calc.limitePEporTurno(5); }, esperado: 1 },
      { nome: 'limitePEporTurno(50)', obtido: function () { return calc.limitePEporTurno(50); }, esperado: 10 },
      { nome: 'limitePEporTurno(99)', obtido: function () { return calc.limitePEporTurno(99); }, esperado: 20 },

      { nome: 'Atual null assume o máximo', obtido: function () { return calc.atualEfetivo(null, 17); }, esperado: 17 },
      { nome: 'Atual acima do máximo cai para o máximo', obtido: function () { return calc.ajustarAtual(25, 17); }, esperado: 17 },
      { nome: 'Atual abaixo de 0 sobe para 0', obtido: function () { return calc.ajustarAtual(-3, 17); }, esperado: 0 },
      { nome: 'Máximo subiu: atual não muda', obtido: function () { return calc.ajustarAtual(10, 40); }, esperado: 10 },
      { nome: 'Máximo mudou: atual null continua null', obtido: function () { return calc.ajustarAtual(null, 40); }, esperado: null },

      // --- Perícias: bônus (grau + outros, sem atributo) ---
      { nome: 'Perícia Treinado + outros 2 → bônus', obtido: function () { return calc.periciaBonus(graus, 'luta'); }, esperado: 7 },
      { nome: 'Perícia Veterano → bônus', obtido: function () { return calc.periciaBonus(graus, 'pontaria'); }, esperado: 10 },
      { nome: 'Perícia Expert → bônus', obtido: function () { return calc.periciaBonus(graus, 'ocultismo'); }, esperado: 15 },
      { nome: 'Perícia Destreinado → bônus', obtido: function () { return calc.periciaBonus(graus, 'atletismo'); }, esperado: 0 },
      { nome: 'Perícia Treinado + outros −3 → bônus', obtido: function () { return calc.periciaBonus(graus, 'furtividade'); }, esperado: 2 },

      // --- Perícias: dados (atributo define quantos d20) ---
      { nome: 'Atributo total 3 → dados', obtido: function () { return calc.formatarDados(calc.periciaDados(agi3, 'acrobacia')); }, esperado: '3d20 maior' },
      { nome: 'Atributo base 2 + bônus 1 → dados', obtido: function () { return calc.formatarDados(calc.periciaDados(agi2mais1, 'acrobacia')); }, esperado: '3d20 maior' },
      { nome: 'Atributo total 0 → dados', obtido: function () { return calc.formatarDados(calc.periciaDados(agi0, 'acrobacia')); }, esperado: '2d20 menor' },
      { nome: 'Atributo total 1 → dados', obtido: function () { return calc.formatarDados(calc.periciaDados(agi0, 'luta')); }, esperado: '1d20 maior' },
      { nome: 'Luta com atributo trocado para AGI', obtido: function () { return calc.atributoDaPericia(lutaComAgi, 'luta'); }, esperado: 'agi' },
      { nome: 'Luta com AGI 3 → dados', obtido: function () { return calc.formatarDados(calc.periciaDados(lutaComAgi, 'luta')); }, esperado: '3d20 maior' },
      { nome: 'Atributo inválido volta ao padrão (FOR)', obtido: function () { return calc.atributoDaPericia(atributoInvalido, 'luta'); }, esperado: 'for' },
      { nome: '28 perícias nos dados', obtido: function () { return OP.data.pericias.length; }, esperado: 28 },

      // --- Pontos de treinamento ---
      { nome: 'Especialista INT 3 → pontos de treinamento', obtido: function () { return calc.pontosTreinamentoTotal(especialistaInt3); }, esperado: 10 },
      { nome: 'Ocultista INT 2 + bônus 1 → pontos de treinamento', obtido: function () { return calc.pontosTreinamentoTotal(pontosComBonus); }, esperado: 6 },
      { nome: 'Sem classe → pontos de treinamento', obtido: function () { return calc.pontosTreinamentoTotal(agi3); }, esperado: 0 },
      { nome: '3 treinadas, 1 concedida → gastos', obtido: function () { return calc.pontosTreinamentoGastos(tresTreinadas); }, esperado: 2 },
      { nome: 'Concedida destreinada não conta → gastos', obtido: function () { return calc.pontosTreinamentoGastos(concedidaSemGrau); }, esperado: 0 },

      // --- Correção dos dados de perícias ---
      { nome: 'Perícias com atributo padrão AGI', obtido: porAtributo('agi'), esperado: 7 },
      { nome: 'Perícias com atributo padrão FOR', obtido: porAtributo('for'), esperado: 2 },
      { nome: 'Perícias com atributo padrão INT', obtido: porAtributo('int'), esperado: 9 },
      { nome: 'Perícias com atributo padrão PRE', obtido: porAtributo('pre'), esperado: 9 },
      { nome: 'Perícias com atributo padrão VIG', obtido: porAtributo('vig'), esperado: 1 },
      { nome: 'Total de perícias (somando os atributos)', obtido: function () { return ['agi', 'for', 'int', 'pre', 'vig'].reduce(function (s, a) { return s + porAtributo(a)(); }, 0); }, esperado: 28 },
      { nome: 'Perícias somente treinadas', obtido: function () { return contarPericias(function (p) { return p.somenteTreinada === true; }); }, esperado: 10 },
      { nome: 'Perícias com penalidade de carga', obtido: function () { return contarPericias(function (p) { return p.penalidadeCarga === true; }); }, esperado: 3 },
      { nome: 'Perícias com kit', obtido: function () { return contarPericias(function (p) { return p.kit === true; }); }, esperado: 4 },
      { nome: 'Atributo padrão de Religião', obtido: function () { return religiao.atributoPadrao; }, esperado: 'pre' },
      { nome: 'Religião sem escolha usa PRE na ficha', obtido: function () { return calc.atributoDaPericia(destreinado, 'religiao'); }, esperado: 'pre' },

      // --- Defesa e derivados ---
      { nome: 'Especialista AGI 2, Fort. e Refl. treinadas → Defesa', obtido: function () { return calc.defesaTotal(exemploEspecialista); }, esperado: 12 },
      { nome: 'Especialista AGI 2, Fort. e Refl. treinadas → Bloqueio', obtido: function () { return calc.bloqueio(exemploEspecialista).reducao; }, esperado: 5 },
      { nome: 'Especialista AGI 2, Fort. e Refl. treinadas → Defesa com Esquiva', obtido: function () { return calc.esquiva(exemploEspecialista).defesaComEsquiva; }, esperado: 17 },
      { nome: 'Fortitude treinada → bloqueio disponível', obtido: function () { return calc.bloqueio(exemploEspecialista).disponivel; }, esperado: true },
      { nome: 'Fortitude destreinada → bloqueio disponível?', obtido: function () { return calc.bloqueio(destreinado).disponivel; }, esperado: false },
      { nome: 'Reflexos destreinada → esquiva disponível?', obtido: function () { return calc.esquiva(destreinado).disponivel; }, esperado: false },
      { nome: 'Reflexos destreinada → Defesa com Esquiva = Defesa', obtido: function () { return calc.esquiva(destreinado).defesaComEsquiva; }, esperado: 12 },
      { nome: 'Luta destreinada → contra-ataque disponível?', obtido: function () { return calc.contraAtaque(destreinado).disponivel; }, esperado: false },
      { nome: 'Luta treinada → contra-ataque disponível?', obtido: function () { return calc.contraAtaque(lutaTreinada).disponivel; }, esperado: true },
      { nome: 'AGI 3, proteção +5, outros +1 → Defesa', obtido: function () { return calc.defesaTotal(comProtecao); }, esperado: 19 },
      { nome: 'Deslocamento base → metros', obtido: function () { return calc.deslocamento(destreinado).metros; }, esperado: 9 },
      { nome: 'Deslocamento base → quadrados', obtido: function () { return calc.deslocamento(destreinado).quadrados; }, esperado: 6 },
      { nome: 'Deslocamento com bônus +3 → metros', obtido: function () { return calc.deslocamento(deslocamentoMais3).metros; }, esperado: 12 },
      { nome: 'Deslocamento com bônus +3 → quadrados', obtido: function () { return calc.deslocamento(deslocamentoMais3).quadrados; }, esperado: 8 },
      { nome: 'Reflexos (exemplo) → dados', obtido: function () { return calc.formatarDados(calc.derivadasPericia(exemploEspecialista, 'reflexos').dados); }, esperado: '2d20 maior' },
      { nome: 'Reflexos (exemplo) → bônus', obtido: function () { return calc.derivadasPericia(exemploEspecialista, 'reflexos').bonus; }, esperado: 5 },

      // --- Inventário: carga ---
      { nome: 'FOR 1 → capacidade', obtido: function () { return calc.capacidadeCarga(for1); }, esperado: 5 },
      { nome: 'FOR 3 + bônus 2 → capacidade', obtido: function () { return calc.capacidadeCarga(for3mais2); }, esperado: 17 },
      { nome: 'FOR 0 → capacidade (config.capacidadeForcaZero)', obtido: function () { return calc.capacidadeCarga(for0); }, esperado: cfg.capacidadeForcaZero },
      { nome: 'Item A (2 esp. × 3) + item B (1 esp. × 1) → espaços usados', obtido: function () { return calc.espacosUsados(doisItens); }, esperado: 7 },
      { nome: 'FOR 1 com 6 espaços → sobrecarregado', obtido: function () { return calc.sobrecarregado(sobrecarga); }, esperado: true },
      { nome: 'FOR 1 com 5 espaços (no limite) → sobrecarregado', obtido: function () { return calc.sobrecarregado(noLimite); }, esperado: false },

      // --- Inventário: patente, crédito e limites ---
      { nome: 'patenteSugerida(0)', obtido: function () { return calc.patenteSugerida(0); }, esperado: 'recruta' },
      { nome: 'patenteSugerida(PP mínimo da 2ª patente)', obtido: function () { return calc.patenteSugerida(OP.data.patentes[1].ppMinimo); }, esperado: OP.data.patentes[1].id },
      { nome: 'patenteSugerida(muito PP) → última patente', obtido: function () { return calc.patenteSugerida(99999); }, esperado: OP.data.patentes[OP.data.patentes.length - 1].id },
      { nome: 'Ficha nova → patente', obtido: function () { return calc.patenteAtual(for1); }, esperado: 'recruta' },
      { nome: 'Ficha nova → crédito', obtido: function () { return calc.creditoAtual(for1); }, esperado: 'baixo' },
      { nome: 'Crédito escolhido à mão', obtido: function () { return calc.creditoAtual(creditoManual); }, esperado: 'alto' },
      { nome: 'Recruta com 3 itens de categoria I → limite', obtido: function () { return limiteI(recrutaTresI).limite; }, esperado: 2 },
      { nome: 'Recruta com 3 itens de categoria I → usados', obtido: function () { return limiteI(recrutaTresI).usados; }, esperado: 3 },
      { nome: 'Recruta com 3 itens de categoria I → excedeu', obtido: function () { return limiteI(recrutaTresI).excedeu; }, esperado: true },
      { nome: 'Recruta com 1 item cat. I, quantidade 3 → usados', obtido: function () { return limiteI(recrutaQtd3).usados; }, esperado: 3 },

      // --- Inventário: proteções e Defesa ---
      { nome: 'AGI 2 + proteção equipada +5 → Defesa', obtido: function () { return calc.defesaTotal(protecaoEquipada); }, esperado: 17 },
      { nome: 'AGI 2 + proteção desequipada → Defesa', obtido: function () { return calc.defesaTotal(protecaoGuardada); }, esperado: 12 },
      { nome: 'Item que não é proteção não dá Defesa', obtido: function () { return calc.defesaTotal(geralMarcadoEquipado); }, esperado: 12 },

      // --- Inventário: sobrecarga e penalidade de carga ---
      { nome: 'Sobrecarga: Furtividade treinada → 5 − config.sobrecarga.pericias', obtido: function () { return calc.periciaBonus(sobrecarga, 'furtividade'); }, esperado: 5 - cfg.sobrecarga.pericias },
      { nome: 'Sobrecarga: Fortitude treinada (sem carga) continua', obtido: function () { return calc.periciaBonus(sobrecarga, 'fortitude'); }, esperado: 5 },
      { nome: 'Sobrecarga: Defesa (AGI 2) → 12 − config.sobrecarga.defesa', obtido: function () { return calc.defesaTotal(sobrecarga); }, esperado: 12 - cfg.sobrecarga.defesa },
      { nome: 'Sobrecarga: deslocamento → base − config.sobrecarga.deslocamento', obtido: function () { return calc.deslocamento(sobrecarga).metros; }, esperado: cfg.deslocamentoBase - cfg.sobrecarga.deslocamento },
      { nome: 'Proteção com penalidade 2: Acrobacia treinada', obtido: function () { return calc.periciaBonus(protecaoPenalidade, 'acrobacia'); }, esperado: 3 },
      { nome: 'Proteção com penalidade 2: Luta (sem carga) não muda', obtido: function () { return calc.periciaBonus(protecaoPenalidade, 'luta'); }, esperado: 5 },
      { nome: 'Penalidade de carga sem proteção nem sobrecarga', obtido: function () { return calc.penalidadeCarga(for1); }, esperado: 0 },

      // --- Inventário: kit ---
      { nome: 'Kit de Medicina no inventário → kitAtivo', obtido: function () { return calc.kitAtivo(kitMedicina, 'medicina'); }, esperado: true },
      { nome: 'Item geral com perícia de kit não conta como kit', obtido: function () { return calc.kitAtivo(kitSemPericia, 'medicina'); }, esperado: false },
      { nome: 'Kit de Medicina, config.bonusKit = 2 → Medicina treinada', obtido: function () { return comBonusKit(2, function () { return calc.periciaBonus(kitMedicina, 'medicina'); }); }, esperado: 7 },
      { nome: 'config.bonusKit restaurado após o teste', obtido: function () { return cfg.bonusKit; }, esperado: cfg.bonusKit },

      // --- Etapa 6, Parte A: patentes (Tabela 3.1) ---
      { nome: 'Tabela 3.1: 5 patentes', obtido: function () { return OP.data.patentes.length; }, esperado: 5 }
    ].concat(casosPatentes(), [
      { nome: 'patenteSugerida(0)', obtido: function () { return calc.patenteSugerida(0); }, esperado: 'recruta' },
      { nome: 'patenteSugerida(19)', obtido: function () { return calc.patenteSugerida(19); }, esperado: 'recruta' },
      { nome: 'patenteSugerida(20)', obtido: function () { return calc.patenteSugerida(20); }, esperado: 'operador' },
      { nome: 'patenteSugerida(50)', obtido: function () { return calc.patenteSugerida(50); }, esperado: 'agente-especial' },
      { nome: 'patenteSugerida(100)', obtido: function () { return calc.patenteSugerida(100); }, esperado: 'oficial-operacoes' },
      { nome: 'patenteSugerida(200)', obtido: function () { return calc.patenteSugerida(200); }, esperado: 'agente-elite' },
      { nome: 'Recruta com 1 item cat. II → limite II', obtido: function () { return limiteCategoria(recrutaItemII, 'II').limite; }, esperado: 0 },
      { nome: 'Recruta com 1 item cat. II → usados', obtido: function () { return limiteCategoria(recrutaItemII, 'II').usados; }, esperado: 1 },
      { nome: 'Recruta com 1 item cat. II → excedeu', obtido: function () { return limiteCategoria(recrutaItemII, 'II').excedeu; }, esperado: true },

      // --- Etapa 6, Parte B: reserva de d20 ---
      { nome: 'Atributo 3 sem modificador → reserva', obtido: function () { return JSON.stringify(calc.resolverReserva(3, 0)); }, esperado: '{"qtd":3,"modo":"maior"}' },
      { nome: 'Rolagens [4, 17, 9] no maior → escolhido', obtido: function () { return comDados(d20s(4, 17, 9), function () { return OP.dados.rolarReserva(3, 'maior').escolhido; }); }, esperado: 17 },
      { nome: 'Rolagens [4, 17, 9] → resultados guardados', obtido: function () { return comDados(d20s(4, 17, 9), function () { return OP.dados.rolarReserva(3, 'maior').resultados.join(','); }); }, esperado: '4,17,9' },
      { nome: 'Atributo 0 → reserva', obtido: function () { return JSON.stringify(calc.resolverReserva(0, 0)); }, esperado: '{"qtd":2,"modo":"menor"}' },
      { nome: 'Rolagens [15, 6] no menor → escolhido', obtido: function () { return comDados(d20s(15, 6), function () { return OP.dados.rolarReserva(2, 'menor').escolhido; }); }, esperado: 6 },
      { nome: 'Atributo 2 com +1 → reserva', obtido: function () { return JSON.stringify(calc.resolverReserva(2, 1)); }, esperado: '{"qtd":3,"modo":"maior"}' },
      { nome: 'Atributo 1 com −1 → reserva', obtido: function () { return JSON.stringify(calc.resolverReserva(1, -1)); }, esperado: '{"qtd":2,"modo":"menor"}' },
      { nome: 'Atributo 0 com −1 → reserva', obtido: function () { return JSON.stringify(calc.resolverReserva(0, -1)); }, esperado: '{"qtd":3,"modo":"menor"}' },
      { nome: 'd(20) com o gerador forçado em 20', obtido: function () { return comDados([r(20, 20)], function () { return OP.dados.d(20); }); }, esperado: 20 },

      // --- Etapa 6, Parte B: fórmulas ---
      { nome: '"2d6+3" com [4, 5] → total', obtido: function () { return comDados([r(4, 6), r(5, 6)], function () { return OP.dados.rolarFormula('2d6+3').total; }); }, esperado: 12 },
      { nome: '"1d8+1d4+2" com [3, 2] → total', obtido: function () { return comDados([r(3, 8), r(2, 4)], function () { return OP.dados.rolarFormula('1d8+1d4+2').total; }); }, esperado: 7 },
      { nome: '" 2D6 + 3 " é aceita', obtido: function () { return OP.dados.rolarFormula(' 2D6 + 3 ').ok; }, esperado: true },
      { nome: '"d10" vale 1d10', obtido: function () { return OP.dados.analisarFormula('d10').termos[0].qtd; }, esperado: 1 },
      { nome: '"abc" → ok false', obtido: function () { return OP.dados.rolarFormula('abc').ok; }, esperado: false },
      { nome: '"51d6" → ok false', obtido: function () { return OP.dados.rolarFormula('51d6').ok; }, esperado: false },
      { nome: '"1d1" → ok false', obtido: function () { return OP.dados.rolarFormula('1d1').ok; }, esperado: false },
      { nome: 'Fórmulas inválidas não lançam exceção', obtido: function () { return lancou(function () { ['abc', '51d6', '1d1', '', null, undefined, '2d6+', '++', '{}'].forEach(function (t) { OP.dados.rolarFormula(t); }); }); }, esperado: false },
      { nome: 'Fórmula inválida traz mensagem de erro', obtido: function () { return typeof OP.dados.rolarFormula('abc').erro === 'string' && OP.dados.rolarFormula('abc').erro.length > 0; }, esperado: true },
      { nome: 'Crítico: "1d8+2" com multDados 2 e [3, 6] → total', obtido: function () { return comDados([r(3, 8), r(6, 8)], function () { return OP.dados.rolarFormula('1d8+2', { multDados: 2 }).total; }); }, esperado: 11 },

      // --- Etapa 6, Parte C: ataques ---
      { nome: 'Luta, FOR 2, Treinada, testeBonus 1 → dados', obtido: function () { return calc.formatarDados(calc.ataqueTeste(lutaFor2, ataqueLuta).dados); }, esperado: '2d20 maior' },
      { nome: 'Luta, FOR 2, Treinada, testeBonus 1 → bônus', obtido: function () { return calc.ataqueTeste(lutaFor2, ataqueLuta).bonus; }, esperado: 6 },
      { nome: 'ehCritico(19, 19)', obtido: function () { return calc.ehCritico(19, 19); }, esperado: true },
      { nome: 'ehCritico(18, 19)', obtido: function () { return calc.ehCritico(18, 19); }, esperado: false },
      { nome: 'Munição 0 → rolarAtaque bloqueia', obtido: function () { return OP.rolagens.rolarAtaque(lutaFor2, ataqueSemMunicao).ok; }, esperado: false },
      { nome: 'Munição 3 → rolar gasta 1 e sobra', obtido: function () { return comDados(d20s(10), function () { return OP.rolagens.rolarAtaque(lutaFor2, ataqueComMunicao).municaoRestante; }); }, esperado: 2 },
      { nome: 'rolarPericia: total = escolhido + bônus', obtido: function () { return comDados(d20s(4, 17), function () { return OP.rolagens.rolarPericia(lutaFor2, 'luta').total; }); }, esperado: 22 },
      { nome: 'rolarAtaque com margem 19 e d20 = 19 → crítico', obtido: function () { return comDados(d20s(19, 3), function () { return OP.rolagens.rolarAtaque(lutaFor2, ataqueLuta).critico; }); }, esperado: true },
      { nome: 'rolarAtaque contra Defesa 20 com total 25 → acertou', obtido: function () { return comDados(d20s(19, 3), function () { return OP.rolagens.rolarAtaque(lutaFor2, ataqueLuta, { defesaAlvo: 20 }).acertou; }); }, esperado: true },
      { nome: 'rolarDano crítico: "1d8+2" + bônus 1 com [3, 6] → total', obtido: function () { return comDados([r(3, 8), r(6, 8)], function () { return OP.rolagens.rolarDano(lutaFor2, ataqueCritico, { critico: true }).total; }); }, esperado: 12 },
      { nome: 'rolarDano normal: "1d8+2" + bônus 1 com [5] → total', obtido: function () { return comDados([r(5, 8)], function () { return OP.rolagens.rolarDano(lutaFor2, ataqueCritico, {}).total; }); }, esperado: 8 },

      // --- Etapa 7: círculos e afinidade (valores de config.circulosPorNex / config.nexAfinidade) ---
      { nome: 'circulosLiberados(5)', obtido: function () { return calc.circulosLiberados(5); }, esperado: 1 },
      { nome: 'circulosLiberados(24)', obtido: function () { return calc.circulosLiberados(24); }, esperado: 1 },
      { nome: 'circulosLiberados(25)', obtido: function () { return calc.circulosLiberados(25); }, esperado: 2 },
      { nome: 'circulosLiberados(55)', obtido: function () { return calc.circulosLiberados(55); }, esperado: 3 },
      { nome: 'circulosLiberados(84)', obtido: function () { return calc.circulosLiberados(84); }, esperado: 3 },
      { nome: 'circulosLiberados(85)', obtido: function () { return calc.circulosLiberados(85); }, esperado: 4 },
      { nome: 'circulosLiberados(99)', obtido: function () { return calc.circulosLiberados(99); }, esperado: 4 },
      { nome: 'afinidadeLiberada(45)', obtido: function () { return calc.afinidadeLiberada(45); }, esperado: false },
      { nome: 'afinidadeLiberada(50)', obtido: function () { return calc.afinidadeLiberada(50); }, esperado: true },

      // --- Etapa 7: DT de rituais (sempre a partir de config.dtRitual) ---
      { nome: 'DT: NEX 50, atributo 3, bônus 2, somando limite de PE → base + limite + 3 + 2',
        obtido: function () { return comSomaLimitePE(true, function () { return calc.dtRituais(fichaDt()).total; }); },
        esperado: dtCfg.base + calc.limitePEporTurno(50) + 3 + 2 },
      { nome: 'DT: NEX 50, atributo 3, bônus 2, sem somar limite de PE → base + 3 + 2',
        obtido: function () { return comSomaLimitePE(false, function () { return calc.dtRituais(fichaDt()).total; }); },
        esperado: dtCfg.base + 3 + 2 },
      { nome: 'config.dtRitual.somaLimitePE restaurado após o teste', obtido: function () { return dtCfg.somaLimitePE; }, esperado: dtCfg.somaLimitePE },

      // --- Etapa 7: custo sugerido por círculo (config.custoRitualPorCirculo) ---
      { nome: 'custoSugeridoRitual(1)', obtido: function () { return calc.custoSugeridoRitual(1); }, esperado: 1 },
      { nome: 'custoSugeridoRitual(2)', obtido: function () { return calc.custoSugeridoRitual(2); }, esperado: 3 },
      { nome: 'custoSugeridoRitual(3)', obtido: function () { return calc.custoSugeridoRitual(3); }, esperado: 6 },
      { nome: 'custoSugeridoRitual(4)', obtido: function () { return calc.custoSugeridoRitual(4); }, esperado: 10 },

      // --- Etapa 7: gastar PE ---
      { nome: 'gastarPE: PE 5, gasta 3 → ok', obtido: function () { return gastosEmSequencia(fichaPE(5), [3])[0].ok; }, esperado: true },
      { nome: 'gastarPE: PE 5, gasta 3 → sobram 2', obtido: function () { return gastosEmSequencia(fichaPE(5), [3])[0].pe; }, esperado: 2 },
      { nome: 'gastarPE: gasta 3 de novo (só tem 2) → ok', obtido: function () { return gastosEmSequencia(fichaPE(5), [3, 3])[1].ok; }, esperado: false },
      { nome: 'gastarPE: gasta 3 de novo (só tem 2) → motivo', obtido: function () { return gastosEmSequencia(fichaPE(5), [3, 3])[1].motivo; }, esperado: 'PE insuficiente' },
      { nome: 'gastarPE: gasta 3 de novo (só tem 2) → PE continua 2', obtido: function () { return gastosEmSequencia(fichaPE(5), [3, 3])[1].pe; }, esperado: 2 },
      { nome: 'gastarPE(0) → ok, nada muda', obtido: function () { const p = gastosEmSequencia(fichaPE(5), [0])[0]; return p.ok + '/' + p.pe + '/' + p.turno; }, esperado: 'true/5/0' },
      { nome: 'gastarPE com PE atual vazio (null) usa o máximo', obtido: function () { return gastosEmSequencia(fichaPE(null), [2])[0].pe; }, esperado: 3 },
      { nome: 'NEX 5% (limite 1): gastos 1 + 1 → PE gasto no turno', obtido: function () { return gastosEmSequencia(fichaPE(5), [1, 1])[1].turno; }, esperado: 2 },
      { nome: 'NEX 5% (limite 1): gastos 1 + 1 → avisoLimite', obtido: function () { return gastosEmSequencia(fichaPE(5), [1, 1])[1].avisoLimite; }, esperado: true },
      { nome: 'NEX 5% (limite 1): primeiro gasto de 1 → avisoLimite', obtido: function () { return gastosEmSequencia(fichaPE(5), [1])[0].avisoLimite; }, esperado: false },
      { nome: 'novoTurno() → PE gasto no turno volta a 0', obtido: function () { const f = fichaPE(5); gastosEmSequencia(f, [1, 1]); OP.state.novoTurno(f); return f.conjuracao.peGastoTurno; }, esperado: 0 },

      // --- Etapa 7: rituais ---
      { nome: 'Ritual de 3º círculo com NEX 10% → além do círculo', obtido: function () { return calc.ritualAlemDoCirculo(fichaDeTeste({ nex: 10 }), ritualCirculo3); }, esperado: true },
      { nome: 'Ritual de 3º círculo com NEX 55% → além do círculo', obtido: function () { return calc.ritualAlemDoCirculo(fichaDeTeste({ nex: 55 }), ritualCirculo3); }, esperado: false },
      { nome: 'conjurarRitual Discente (custo 4) com PE 5 → ok', obtido: function () { return OP.rolagens.conjurarRitual(fichaPE(5), ritualDiscente4, 'discente').ok; }, esperado: true },
      { nome: 'conjurarRitual Discente (custo 4) com PE 5 → sobra 1', obtido: function () { const f = fichaPE(5); OP.rolagens.conjurarRitual(f, ritualDiscente4, 'discente'); return calc.estadoRecurso(f, 'pe').atual; }, esperado: 1 },
      { nome: 'conjurarRitual Padrão (custo 0) → não gasta PE', obtido: function () { const f = fichaPE(5); OP.rolagens.conjurarRitual(f, ritualPadrao0, 'padrao'); return calc.estadoRecurso(f, 'pe').atual; }, esperado: 5 },
      { nome: 'conjurarRitual numa forma inativa → ok', obtido: function () { return OP.rolagens.conjurarRitual(fichaPE(5), ritualPadrao0, 'verdadeira').ok; }, esperado: false },
      { nome: 'rolarDanoRitual "2d6+3" com [4, 5] → total', obtido: function () { return comDados([r(4, 6), r(5, 6)], function () { return OP.rolagens.rolarDanoRitual(fichaPE(5), ritualDano, 'padrao').total; }); }, esperado: 12 },
      { nome: 'rolarDanoRitual "abc" → ok', obtido: function () { return OP.rolagens.rolarDanoRitual(fichaPE(5), ritualDanoRuim, 'padrao').ok; }, esperado: false },
      { nome: 'rolarDanoRitual "abc" → mensagem de erro', obtido: function () { const e = OP.rolagens.rolarDanoRitual(fichaPE(5), ritualDanoRuim, 'padrao').erro; return typeof e === 'string' && e.length > 0; }, esperado: true },
      { nome: 'rolarDanoRitual com dano inválido ou vazio não lança exceção', obtido: function () { return lancou(function () { OP.rolagens.rolarDanoRitual(fichaPE(5), ritualDanoRuim, 'padrao'); OP.rolagens.rolarDanoRitual(fichaPE(5), ritualPadrao0, 'padrao'); OP.rolagens.rolarDanoRitual(fichaPE(5), ritualPadrao0, 'discente'); OP.rolagens.rolarDanoRitual(fichaPE(5), null, 'padrao'); }); }, esperado: false },

      // --- Etapa 8, Parte A: DT (confirmada pelo livro) ---
      { nome: 'E8 · DT de rituais: Ocultista PRE 3, NEX 5%, bônus 0', obtido: function () { return calc.dtRituais(fichaOcultista(5, 3)).total; }, esperado: 14 },
      { nome: 'E8 · DT de rituais: Ocultista PRE 5, NEX 99%, bônus 0', obtido: function () { return calc.dtRituais(fichaOcultista(99, 5)).total; }, esperado: 35 },
      { nome: 'E8 · DT de rituais → partes (base/limite/atributo/bônus)', obtido: function () { const p = calc.dtRituais(fichaOcultista(5, 3)).partes; return [p.base, p.limitePE, p.atributo, p.bonus].join('/'); }, esperado: '10/1/3/0' },
      { nome: 'E8 · dtHabilidade com FOR 2 e NEX 5%', obtido: function () { return calc.dtHabilidade(fichaDeTeste({ nex: 5, atributos: { for: 2 } }), 'for').total; }, esperado: 13 },
      { nome: 'E8 · Habilidade com atributoDT FOR (FOR 2, NEX 5%) → DT', obtido: function () { return habilidadeComDt('for'); }, esperado: 13 },
      { nome: 'E8 · Habilidade com atributoDT FOR e bônus de DT 1 → DT', obtido: function () { return habilidadeComDt('for', 1); }, esperado: 14 },
      { nome: 'E8 · Habilidade sem atributoDT → DT', obtido: function () { return habilidadeComDt(null); }, esperado: null },

      // --- Etapa 8, Parte A: resistência estruturada ---
      { nome: 'E8 · resumoResistencia Vontade/Parcial (PRE 3, NEX 5%) → dt', obtido: function () { return calc.resumoResistencia(fichaOcultista(5, 3), ritualVontade).dt; }, esperado: 14 },
      { nome: 'E8 · resumoResistencia Vontade/Parcial → teste e efeito', obtido: function () { const r = calc.resumoResistencia(fichaOcultista(5, 3), ritualVontade); return r.teste + '/' + r.efeito; }, esperado: 'vontade/parcial' },
      { nome: 'E8 · resumoResistencia de ritual sem teste → null', obtido: function () { return calc.resumoResistencia(fichaOcultista(5, 3), ritualDeTeste({})); }, esperado: null },
      { nome: 'E8 · Migração: resistência em texto → objeto vazio', obtido: function () { return JSON.stringify(OP.state.completarPadroes({ rituais: [{ nome: 'Antigo', resistencia: 'Vontade parcial' }] }).rituais[0].resistencia); }, esperado: '{"teste":"","efeito":""}' },
      { nome: 'E8 · Migração: resistência em texto → resistenciaNotas', obtido: function () { return OP.state.completarPadroes({ rituais: [{ nome: 'Antigo', resistencia: 'Vontade parcial' }] }).rituais[0].resistenciaNotas; }, esperado: 'Vontade parcial' },
      { nome: 'E8 · Migração também em novoRitual (texto → notas)', obtido: function () { const r = OP.state.novoRitual({ resistencia: 'Vontade parcial' }); return r.resistencia.teste + '|' + r.resistenciaNotas; }, esperado: '|Vontade parcial' },
      { nome: 'E8 · Teste de resistência desconhecido é corrigido', obtido: function () { const f = fichaOcultista(5, 3); f.rituais = [ritualDeTeste({ resistencia: { teste: 'xyz', efeito: 'parcial' } })]; return calc.correcoesConjuracao(f).some(function (c) { return c.caminho === 'rituais.0.resistencia.teste' && c.valor === ''; }); }, esperado: true },

      // --- Etapa 8, Parte A: afinidade e Medo ---
      { nome: 'E8 · Lista de afinidades contém Medo?', obtido: function () { return calc.elementosAfinidade().some(function (e) { return e.id === 'medo'; }); }, esperado: false },
      { nome: 'E8 · Lista de elementos de ritual contém Medo?', obtido: function () { return calc.elementosRitual().some(function (e) { return e.id === 'medo'; }); }, esperado: true },
      { nome: 'E8 · Afinidade (elemento conectado) "medo" é corrigida para null', obtido: function () { const f = fichaOcultista(50, 3); f.conjuracao.elementoConectado = 'medo'; return calc.correcoesConjuracao(f).some(function (c) { return c.caminho === 'conjuracao.elementoConectado' && c.valor === null; }); }, esperado: true },
      { nome: 'E8 · planoConjuracao Medo Padrão (custo 3) → pe/san/permanente/medo', obtido: function () { const p = calc.planoConjuracao(fichaMedo(5, 20), ritualMedo, 'padrao'); return [p.ok, p.pe, p.san, p.permanente, p.medo].join('/'); }, esperado: 'true/3/3/1/true' },
      { nome: 'E8 · planoConjuracao não altera a ficha', obtido: function () { const f = fichaMedo(5, 20); calc.planoConjuracao(f, ritualMedo, 'padrao'); return [f.recursos.pe.atual, f.recursos.san.atual, f.recursos.san.perdaPermanente].join('/'); }, esperado: '5/20/0' },
      { nome: 'E8 · Medo Padrão, custo 3, PE 5, SAN 20 → PE', obtido: function () { return conjurarResumo(fichaMedo(5, 20), ritualMedo, 'padrao').pe; }, esperado: 2 },
      { nome: 'E8 · Medo Padrão, custo 3, PE 5, SAN 20 → SAN atual', obtido: function () { return conjurarResumo(fichaMedo(5, 20), ritualMedo, 'padrao').san; }, esperado: 17 },
      { nome: 'E8 · Medo Padrão, custo 3, PE 5, SAN 20 → perdaPermanente', obtido: function () { return conjurarResumo(fichaMedo(5, 20), ritualMedo, 'padrao').perda; }, esperado: 1 },
      { nome: 'E8 · Medo Padrão → SAN máximo 1 abaixo do anterior', obtido: function () { const r = conjurarResumo(fichaMedo(5, 20), ritualMedo, 'padrao'); return r.sanMaxAntes - r.sanMax; }, esperado: 1 },
      { nome: 'E8 · Medo Discente (custo 4) → perdaPermanente aumenta', obtido: function () { return conjurarResumo(fichaMedo(5, 20), ritualMedo, 'discente').perda; }, esperado: 2 },
      { nome: 'E8 · Medo Verdadeira → perdaPermanente aumenta', obtido: function () { return conjurarResumo(fichaMedo(5, 20), ritualMedo, 'verdadeira').perda; }, esperado: 3 },
      { nome: 'E8 · Medo com PE insuficiente → ok', obtido: function () { return conjurarResumo(fichaMedo(2, 20), ritualMedo, 'padrao').ok; }, esperado: false },
      { nome: 'E8 · Medo com PE insuficiente → PE/SAN/perda inalterados', obtido: function () { const r = conjurarResumo(fichaMedo(2, 20), ritualMedo, 'padrao'); return [r.pe, r.san, r.perda].join('/'); }, esperado: '2/20/0' },
      { nome: 'E8 · Ritual de Sangue (custo 3) → PE/SAN/perda', obtido: function () { const r = conjurarResumo(fichaMedo(5, 20), ritualSangue, 'padrao'); return [r.ok, r.pe, r.san, r.perda].join('/'); }, esperado: 'true/2/20/0' },
      { nome: 'E8 · sanMax: Especialista NEX 5% com perdaPermanente 2', obtido: function () { const f = fichaDeTeste({ classe: 'especialista', nex: 5 }); f.recursos.san.perdaPermanente = 2; return calc.sanMax(f); }, esperado: 14 },
      { nome: 'E8 · SAN atual acima do novo máximo é corrigida', obtido: function () { const f = fichaDeTeste({ classe: 'especialista', nex: 5 }); f.recursos.san.atual = 16; f.recursos.san.perdaPermanente = 2; return calc.correcoesRecursos(f).some(function (c) { return c.caminho === 'recursos.san.atual' && c.valor === 14; }); }, esperado: true },

      // --- Etapa 8, Parte B: completarPadroes ---
      { nome: 'E8 · completarPadroes({}) → todas as seções existem', obtido: function () { const f = OP.state.completarPadroes({}); return Object.keys(OP.state.modeloVazio()).every(function (k) { return Object.prototype.hasOwnProperty.call(f, k); }) && f.recursos.san.perdaPermanente === 0 && f.pericias.luta.grau === 0 && f.versaoModelo === OP.state.VERSAO_MODELO; }, esperado: true },
      { nome: 'E8 · completarPadroes preserva valores existentes', obtido: function () { const f = OP.state.completarPadroes({ identificacao: { nome: 'Ana' }, atributos: { agi: { base: 3 } } }); return f.identificacao.nome + '/' + f.atributos.agi.base + '/' + f.atributos.agi.bonus; }, esperado: 'Ana/3/0' },
      { nome: 'E8 · completarPadroes chamado duas vezes dá o mesmo resultado', obtido: function () { const x = { versao: 7, habilidades: [{ nome: 'A' }], rituais: [{ resistencia: 'Vontade' }], inventario: { itens: [{ nome: 'B' }] } }; const uma = OP.state.completarPadroes(x); return iguais(OP.state.completarPadroes(uma), uma); }, esperado: true },
      { nome: 'E8 · completarPadroes não altera o objeto recebido', obtido: function () { const x = { versao: 1, recursos: { pv: { bonus: 2 } } }; OP.state.completarPadroes(x); return JSON.stringify(x); }, esperado: '{"versao":1,"recursos":{"pv":{"bonus":2}}}' },

      // --- Etapa 8, Parte B: exportar e importar ---
      { nome: 'E8 · Ida e volta: exportar e importar devolve a mesma ficha', obtido: function () { const f = fichaPreenchida(); const r = importarTexto(JSON.stringify(OP.state.envelopeFicha(f))); return r.ok && r.fichas.length === 1 && iguais(r.fichas[0], OP.state.completarPadroes(f)); }, esperado: true },
      { nome: 'E8 · Ida e volta de um backup com 2 fichas', obtido: function () { const r = importarTexto(JSON.stringify(OP.state.envelopeBackup([fichaPreenchida(), fichaDeTeste({})]))); return r.ok && r.fichas.length; }, esperado: 2 },
      { nome: 'E8 · lerImportacao: texto que não é JSON → recusado', obtido: function () { return recusado('{isto não é json'); }, esperado: true },
      { nome: 'E8 · lerImportacao: JSON sem "formato" → recusado', obtido: function () { return recusado('{"ficha":{}}'); }, esperado: true },
      { nome: 'E8 · lerImportacao: formato desconhecido → recusado', obtido: function () { return recusado('{"formato":"outro-site","versao":1,"ficha":{}}'); }, esperado: true },
      { nome: 'E8 · lerImportacao: versão futura → recusado', obtido: function () { return recusado('{"formato":"op-ficha","versao":99,"ficha":{}}'); }, esperado: true },
      { nome: 'E8 · lerImportacao: versão futura → mensagem "versão mais nova"', obtido: function () { return importarTexto('{"formato":"op-ficha","versao":99,"ficha":{}}').erro.indexOf('versão mais nova') !== -1; }, esperado: true },
      { nome: 'E8 · lerImportacao: versão antiga (7) é aceita', obtido: function () { return importarTexto('{"formato":"op-ficha","versao":7,"ficha":{"versao":7,"rituais":[{"resistencia":"Reflexos anula"}]}}').fichas[0].rituais[0].resistenciaNotas; }, esperado: 'Reflexos anula' },
      { nome: 'E8 · lerImportacao nunca lança exceção', obtido: function () { return lancou(function () { [null, undefined, 123, '', '[]', '"texto"', 'null', '{"formato":"op-backup","versao":8,"fichas":[1,null,"x"]}', '{"formato":"op-ficha","versao":8,"ficha":{"rituais":"x","ataques":[1,2]}}'].forEach(importarTexto); }); }, esperado: false },
      { nome: 'E8 · lerImportacao: campo desconhecido gera aviso', obtido: function () { return importarTexto('{"formato":"op-ficha","versao":8,"ficha":{"campoEstranho":1}}').avisos.length > 0; }, esperado: true },

      // --- Etapa 8, Parte B: sanitizar ---
      { nome: 'E8 · sanitizar: texto de 6000 caracteres → 5000', obtido: function () { return OP.state.sanitizar({ identificacao: { nome: new Array(6001).join('a') } }).identificacao.nome.length; }, esperado: 5000 },
      { nome: 'E8 · sanitizar: número NaN → padrão', obtido: function () { return OP.state.sanitizar({ identificacao: { nex: NaN }, atributos: { agi: { base: NaN } } }).identificacao.nex + '/' + OP.state.sanitizar({ atributos: { agi: { base: NaN } } }).atributos.agi.base; }, esperado: '5/1' },
      { nome: 'E8 · sanitizar: lista com 600 itens → 500', obtido: function () { const lista = []; for (let i = 0; i < 600; i++) lista.push({ nome: 'H' + i }); return OP.state.sanitizar({ habilidades: lista }).habilidades.length; }, esperado: 500 },
      { nome: 'E8 · sanitizar: chave desconhecida some', obtido: function () { const s = OP.state.sanitizar({ foo: 1, identificacao: { bar: 2 } }); return Object.prototype.hasOwnProperty.call(s, 'foo') || Object.prototype.hasOwnProperty.call(s.identificacao, 'bar'); }, esperado: false },
      { nome: 'E8 · sanitizar: "<img onerror>" continua a mesma string', obtido: function () { return OP.state.sanitizar({ identificacao: { nome: XSS }, descricao: { historico: '<script>alert(1)</script>' } }).identificacao.nome === XSS; }, esperado: true },
      { nome: 'E8 · sanitizar: tipos errados viram o padrão', obtido: function () { const s = OP.state.sanitizar({ config: { modoLivre: 'sim' }, ataques: 'x', recursos: { pv: { atual: 'abc' } } }); return [s.config.modoLivre, Array.isArray(s.ataques) && s.ataques.length, s.recursos.pv.atual].join('/'); }, esperado: 'false/0/' },
      { nome: 'E8 · sanitizar: "__proto__" no arquivo não contamina objetos', obtido: function () { OP.state.sanitizar(JSON.parse('{"__proto__":{"poluido":1},"identificacao":{"__proto__":{"poluido":1}}}')); return ({}).poluido === undefined; }, esperado: true },

      // --- Etapa 8, Parte B: várias fichas (armazenamento falso) ---
      { nome: 'E8 · Índice: criar 2 fichas → 2 linhas', obtido: function () { return comArmazenamentoFalso(function () { OP.fichas.criar(); OP.fichas.criar(); return OP.fichas.listar().length; }); }, esperado: 2 },
      { nome: 'E8 · Índice: duplicar → 3 linhas, ids distintos, "(cópia)"', obtido: function () {
        return comArmazenamentoFalso(function () {
          const a = OP.fichas.criar({ identificacao: { nome: 'Agente A' } });
          OP.fichas.criar();
          const copia = OP.fichas.duplicar(a);
          const linhas = OP.fichas.listar();
          const ids = linhas.map(function (l) { return l.id; });
          const nome = OP.fichas.ler(copia).identificacao.nome;
          return linhas.length + '/' + (new Set(ids).size === 3) + '/' + /\(cópia\)$/.test(nome);
        });
      }, esperado: '3/true/true' },
      { nome: 'E8 · Índice: excluir uma de 3 → 2 linhas', obtido: function () { return comArmazenamentoFalso(function () { const a = OP.fichas.criar(); OP.fichas.criar(); OP.fichas.duplicar(a); OP.fichas.excluir(a); return OP.fichas.listar().length + '/' + (OP.fichas.ler(a) === null); }); }, esperado: '2/true' },
      { nome: 'E8 · Alterar a ficha A não altera a B', obtido: function () {
        return comArmazenamentoFalso(function () {
          const a = OP.fichas.criar({ identificacao: { nome: 'A' } });
          const b = OP.fichas.criar({ identificacao: { nome: 'B' } });
          const fichaA = OP.fichas.ler(a);
          fichaA.identificacao.nome = 'A mudou';
          fichaA.atributos.agi.base = 3;
          OP.fichas.gravar(a, fichaA);
          const fichaB = OP.fichas.ler(b);
          return OP.fichas.ler(a).identificacao.nome + '/' + fichaB.identificacao.nome + '/' + fichaB.atributos.agi.base;
        });
      }, esperado: 'A mudou/B/1' },
      { nome: 'E8 · Índice guarda nome, classe e NEX', obtido: function () { return comArmazenamentoFalso(function () { OP.fichas.criar({ identificacao: { nome: 'Rui', classe: 'combatente', nex: 15 } }); const l = OP.fichas.listar()[0]; return l.nome + '/' + l.classe + '/' + l.nex + '/' + (typeof l.atualizadoEm === 'string'); }); }, esperado: 'Rui/combatente/15/true' },
      { nome: 'E8 · Importar ficha com id existente → id novo, sem sobrescrever', obtido: function () {
        return comArmazenamentoFalso(function () {
          const a = OP.fichas.criar({ identificacao: { nome: 'Original' } });
          const importada = OP.state.completarPadroes(fichaPreenchida());
          importada.id = a;
          const r = OP.fichas.importar([importada]);
          return (r.ids[0] !== a) + '/' + OP.fichas.ler(a).identificacao.nome + '/' + OP.fichas.listar().length;
        });
      }, esperado: 'true/Original/2' },
      { nome: 'E8 · Migração de "op_ficha_atual" (Etapa 1): cria a 1ª ficha e mantém a chave', obtido: function () {
        return comArmazenamentoFalso(function (falso) {
          const indice = OP.fichas.prepararIndice();
          const ficha = OP.fichas.ler(indice.fichas[0].id);
          return [indice.fichas.length, indice.atualId === indice.fichas[0].id, falso.getItem('op_ficha_atual') !== null,
            ficha.identificacao.nome, ficha.recursos.pv.bonusMax, ficha.biografia.historico].join('/');
        }, function (falso) { falso.setItem('op_ficha_atual', JSON.stringify(fichaEtapa1)); });
      }, esperado: '1/true/true/Agente Antigo/2/Começou na Etapa 1.' },
      { nome: 'E8 · Migração não repete: segunda vez usa o índice', obtido: function () {
        return comArmazenamentoFalso(function () {
          OP.fichas.prepararIndice();
          return OP.fichas.prepararIndice().fichas.length;
        }, function (falso) { falso.setItem('op_ficha_atual', JSON.stringify(fichaEtapa1)); });
      }, esperado: 1 },
      { nome: 'E8 · Nome do arquivo exportado (sem acentos, minúsculas, hífens)', obtido: function () { return OP.fichas.nomeArquivoFicha({ identificacao: { nome: 'Ana Júlia  da Conceição!' } }); }, esperado: 'ficha-ana-julia-da-conceicao.json' },
      { nome: 'E8 · Armazenamento original restaurado após os testes', obtido: function () { return OP.storage.modo() !== 'teste'; }, esperado: true },

      // --- Etapa 9, Parte D: integridade dos dados ---
      { nome: 'E9 · 59 origens com ids únicos', obtido: function () { return OP.data.origens.length + '/' + idsUnicos(OP.data.origens); }, esperado: '59/true' },
      { nome: 'E9 · 37 trilhas com ids únicos', obtido: function () { return OP.data.trilhas.length + '/' + idsUnicos(OP.data.trilhas); }, esperado: '37/true' },
      { nome: 'E9 · 4 classes', obtido: function () { return calc.classesLista().map(function (c) { return c.id; }).join(','); }, esperado: 'combatente,especialista,ocultista,sobrevivente' },
      { nome: 'E9 · Todo id de perícia citado em origens e classes existe (faltando)', obtido: function () { return idsPericiasCitadas().filter(function (id) { return !OP.data.pericias.some(function (p) { return p.id === id; }); }).join(','); }, esperado: '' },
      { nome: 'E9 · Linhas de progressão por classe', obtido: function () { return calc.classesLista().map(function (c) { return c.id + ':' + c.progressao.length; }).join(','); }, esperado: 'combatente:20,especialista:20,ocultista:20,sobrevivente:5' },
      { nome: 'E9 · Trilhas com as chaves esperadas (erradas)', obtido: function () { return OP.data.trilhas.filter(function (t) { const chaves = Object.keys(t.habilidades).sort(function (a, b) { return a - b; }).join(','); return chaves !== (t.classe === 'sobrevivente' ? '2,4' : '10,40,65,99'); }).map(function (t) { return t.id; }).join(','); }, esperado: '' },
      { nome: 'E9 · Origens e trilhas com fonte conhecida (desconhecidas)', obtido: function () { return OP.data.origens.concat(OP.data.trilhas).filter(function (x) { return !Object.prototype.hasOwnProperty.call(OP.data.fontes, x.fonte); }).map(function (x) { return x.id; }).join(','); }, esperado: '' },

      // --- Etapa 9: PV, PE e SAN com os dados reais (PV/PE/SAN) ---
      { nome: 'E9 · Combatente NEX 15%, VIG 3, PRE 1 (PV 37 confirmado pelo Guia)', obtido: function () { return recursosDe({ classe: 'combatente', nex: 15, atributos: { vig: 3, pre: 1 } }); }, esperado: '37/9/18' },
      { nome: 'E9 · Especialista NEX 5%, VIG 1, PRE 2', obtido: function () { return recursosDe({ classe: 'especialista', nex: 5, atributos: { vig: 1, pre: 2 } }); }, esperado: '17/5/16' },
      { nome: 'E9 · Ocultista NEX 50%, VIG 1, PRE 3', obtido: function () { return recursosDe({ classe: 'ocultista', nex: 50, atributos: { vig: 1, pre: 3 } }); }, esperado: '40/70/65' },
      { nome: 'E9 · Combatente NEX 99%, VIG 3, PRE 1', obtido: function () { return recursosDe({ classe: 'combatente', nex: 99, atributos: { vig: 3, pre: 1 } }); }, esperado: '156/60/69' },
      { nome: 'E9 · Sobrevivente estágio 1, VIG 2, PRE 1', obtido: function () { return recursosDe({ classe: 'sobrevivente', estagio: 1, atributos: { vig: 2, pre: 1 } }); }, esperado: '10/3/8' },
      { nome: 'E9 · Sobrevivente estágio 5, VIG 2, PRE 1', obtido: function () { return recursosDe({ classe: 'sobrevivente', estagio: 5, atributos: { vig: 2, pre: 1 } }); }, esperado: '18/7/16' },
      { nome: 'E9 · passosProgressao: NEX 5% → 0, NEX 99% → 19, Sobrevivente estágio 3 → 2', obtido: function () { return [calc.passosProgressao(fichaDeTeste({ classe: 'combatente', nex: 5 })), calc.passosProgressao(fichaDeTeste({ classe: 'combatente', nex: 99 })), calc.passosProgressao(fichaDeTeste({ classe: 'sobrevivente', estagio: 3 }))].join(','); }, esperado: '0,19,2' },

      // --- Etapa 9: limite de PE por turno ---
      { nome: 'E9 · limitePEporTurno(ficha): NEX 5/10/50/99', obtido: function () { return [5, 10, 50, 99].map(function (nex) { return calc.limitePEporTurno(fichaDeTeste({ classe: 'ocultista', nex: nex })); }).join(','); }, esperado: '1,2,10,20' },
      { nome: 'E9 · limitePEporTurno(10) (atalho pelo NEX)', obtido: function () { return calc.limitePEporTurno(10); }, esperado: 2 },
      { nome: 'E9 · Sobrevivente: limite de PE em todos os estágios', obtido: function () { return [1, 2, 3, 4, 5].map(function (e) { return calc.limitePEporTurno(fichaDeTeste({ classe: 'sobrevivente', estagio: e, nex: 99 })); }).join(','); }, esperado: '1,1,1,1,1' },

      // --- Etapa 9: aumentos de atributo ---
      { nome: 'E9 · aumentosAtributoLiberados: NEX 15/20/50/80/95', obtido: function () { return [15, 20, 50, 80, 95].map(function (nex) { return calc.aumentosAtributoLiberados(fichaDeTeste({ classe: 'combatente', nex: nex })); }).join(','); }, esperado: '0,1,2,3,4' },
      { nome: 'E9 · pontosAtributoPermitidos no NEX 50%', obtido: function () { return calc.pontosAtributoPermitidos(fichaDeTeste({ classe: 'especialista', nex: 50 })); }, esperado: 11 },
      { nome: 'E9 · Sobrevivente: aumentos no estágio 2 e no 3', obtido: function () { return [2, 3].map(function (e) { return calc.aumentosAtributoLiberados(fichaDeTeste({ classe: 'sobrevivente', estagio: e })); }).join(','); }, esperado: '0,1' },
      { nome: 'E9 · Distribuição: NEX 20% com um atributo 4 e soma 10 → sem avisos', obtido: function () { const d = calc.analisarDistribuicao(fichaDeTeste({ classe: 'combatente', nex: 20, atributos: { agi: 4, for: 2, int: 1, pre: 2, vig: 1 } })); return d.valida + '/' + d.restantes; }, esperado: 'true/0' },
      { nome: 'E9 · Distribuição: atributo 6 com aumentos → acima do máximo (5)', obtido: function () { const d = calc.analisarDistribuicao(fichaDeTeste({ classe: 'combatente', nex: 95, atributos: { agi: 6 } })); return d.acimaDoMaximo.join(',') + '/' + d.maximo; }, esperado: 'agi/5' },
      { nome: 'E9 · Sobrevivente com aumento: máximo continua 3', obtido: function () { return calc.analisarDistribuicao(fichaDeTeste({ classe: 'sobrevivente', estagio: 3, atributos: { agi: 4 } })).acimaDoMaximo.join(','); }, esperado: 'agi' },

      // --- Etapa 9: graus de treinamento ---
      { nome: 'E9 · Graus liberados: Especialista INT 2 (NEX 30/35/70)', obtido: function () { return [30, 35, 70].map(function (nex) { return calc.grausTreinamentoLiberados(fichaDeTeste({ classe: 'especialista', nex: nex, atributos: { int: 2 } })); }).join(','); }, esperado: '0,7,14' },
      { nome: 'E9 · Graus liberados: Combatente INT 1 (NEX 35/70)', obtido: function () { return [35, 70].map(function (nex) { return calc.grausTreinamentoLiberados(fichaDeTeste({ classe: 'combatente', nex: nex, atributos: { int: 1 } })); }).join(','); }, esperado: '3,6' },
      { nome: 'E9 · Graus usados: um Veterano e um Expert', obtido: function () { return calc.grausTreinamentoUsados(fichaGraus('especialista', 70, { luta: { grau: 2 }, ocultismo: { grau: 3 } })); }, esperado: 3 },
      { nome: 'E9 · Aviso de grau: Veterano no NEX 30%', obtido: function () { return calc.avisosGrau(fichaGraus('especialista', 30, { luta: { grau: 2 } })).length; }, esperado: 1 },
      { nome: 'E9 · Aviso de grau: Expert no NEX 50%', obtido: function () { return calc.avisosGrau(fichaGraus('especialista', 50, { luta: { grau: 3 } })).length; }, esperado: 1 },
      { nome: 'E9 · Sem aviso: Veterano no NEX 35%', obtido: function () { return calc.avisosGrau(fichaGraus('especialista', 35, { luta: { grau: 2 } })).length; }, esperado: 0 },
      { nome: 'E9 · Sem aviso: Expert no NEX 70%', obtido: function () { return calc.avisosGrau(fichaGraus('especialista', 70, { luta: { grau: 3 } })).length; }, esperado: 0 },

      // --- Etapa 9: perícias concedidas ---
      { nome: 'E9 · Concedidas: Ocultista + Acadêmico', obtido: function () { return concedidas({ classe: 'ocultista', origem: 'academico' }); }, esperado: 'ocultismo,vontade,ciencias,investigacao' },
      { nome: 'E9 · Concedidas: Combatente (Pontaria, Reflexos) + Policial', obtido: function () { return concedidas({ classe: 'combatente', origem: 'policial', gruposClasse: ['pontaria', 'reflexos'] }); }, esperado: 'pontaria,reflexos,percepcao' },
      { nome: 'E9 · Concedidas: Treinado pela Hell Hunters (conjunto 1)', obtido: function () { return concedidas({ origem: 'treinado-pela-hell-hunters', escolhasOrigem: { conjunto: 1 } }); }, esperado: 'pontaria,reflexos' },
      { nome: 'E9 · Concedidas: Ferido por Ritual (Energia)', obtido: function () { return concedidas({ origem: 'ferido-por-ritual', escolhasOrigem: { elemento: 'energia' } }); }, esperado: 'ocultismo,reflexos' },
      { nome: 'E9 · Concedidas: Amnésico (Atletismo, Luta)', obtido: function () { return concedidas({ origem: 'amnesico', escolhasOrigem: { livres: ['atletismo', 'luta'] } }); }, esperado: 'atletismo,luta' },
      { nome: 'E9 · Concedidas: Profetizado (Percepção)', obtido: function () { return concedidas({ origem: 'profetizado', escolhasOrigem: { livres: ['percepcao'] } }); }, esperado: 'vontade,percepcao' },
      { nome: 'E9 · Profetizado não aceita Luta na escolha livre', obtido: function () { return concedidas({ origem: 'profetizado', escolhasOrigem: { livres: ['luta'] } }); }, esperado: 'vontade' },
      { nome: 'E9 · Concedida destreinada vale Treinado (grau efetivo e bônus)', obtido: function () { const f = fichaDeTeste({ classe: 'ocultista', origem: 'academico' }); return calc.grauEfetivo(f, 'ciencias') + '/' + calc.periciaBonus(f, 'ciencias'); }, esperado: '1/5' },
      { nome: 'E9 · Gastos: Ocultista + Acadêmico com 3 outras treinadas', obtido: function () { return calc.pontosTreinamentoGastos(fichaDeTeste({ classe: 'ocultista', origem: 'academico', pericias: { ocultismo: { grau: 1 }, vontade: { grau: 1 }, ciencias: { grau: 1 }, investigacao: { grau: 1 }, atletismo: { grau: 1 }, luta: { grau: 1 }, medicina: { grau: 1 } } })); }, esperado: 3 },
      { nome: 'E9 · Reflexos concedida libera a Esquiva', obtido: function () { return calc.esquiva(fichaDeTeste({ classe: 'combatente', gruposClasse: ['luta', 'reflexos'] })).disponivel; }, esperado: true },
      { nome: 'E9 · Trocar a origem descarta a escolha que não vale mais', obtido: function () { const f = fichaDeTeste({ origem: 'policial', escolhasOrigem: { conjunto: 1 } }); return calc.correcoesEscolhas(f).some(function (c) { return c.caminho === 'identificacao.escolhas.origem.conjunto' && c.valor === null; }); }, esperado: true },

      // --- Etapa 9: trilhas ---
      { nome: 'E9 · trilhasDaClasse: combatente/especialista/ocultista/sobrevivente', obtido: function () { return ['combatente', 'especialista', 'ocultista', 'sobrevivente'].map(function (c) { return calc.trilhasDaClasse(c).length; }).join(','); }, esperado: '10,12,12,3' },
      { nome: 'E9 · habilidadesTrilha: Aniquilador no NEX 40%', obtido: function () { return habilidadesTrilhaTexto({ classe: 'combatente', nex: 40, trilha: 'combatente-aniquilador' }); }, esperado: '10:true,40:true,65:false,99:false' },
      { nome: 'E9 · habilidadesTrilha: Durão no estágio 2', obtido: function () { return habilidadesTrilhaTexto({ classe: 'sobrevivente', estagio: 2, trilha: 'sobrevivente-durao' }); }, esperado: '2:true,4:false' },
      { nome: 'E9 · habilidadesTrilha: Durão no estágio 4', obtido: function () { return habilidadesTrilhaTexto({ classe: 'sobrevivente', estagio: 4, trilha: 'sobrevivente-durao' }); }, esperado: '2:true,4:true' },
      { nome: 'E9 · Versatilidade (NEX 50%): 1ª habilidade da outra trilha', obtido: function () { const f = fichaDeTeste({ classe: 'combatente', nex: 50, trilha: 'combatente-aniquilador' }); f.identificacao.versatilidade = 'combatente-guerreiro'; const v = calc.habilidadeVersatilidade(f); return v.nome + '/' + v.liberada; }, esperado: 'Técnica Letal/true' },
      { nome: 'E9 · Trilha de outra classe é corrigida', obtido: function () { const f = fichaDeTeste({ classe: 'ocultista', trilha: 'combatente-aniquilador' }); return calc.correcoesIdentificacao(f).some(function (c) { return c.caminho === 'identificacao.trilha' && c.valor === ''; }); }, esperado: true },

      // --- Etapa 9: migração de origem e trilha (texto → id) ---
      { nome: 'E9 · Migração: trilha "Aniquilador" (Combatente)', obtido: function () { return migrado({ classe: 'combatente', trilha: 'Aniquilador' }).trilha; }, esperado: 'combatente-aniquilador' },
      { nome: 'E9 · Migração: trilha "tropa de choque"', obtido: function () { return migrado({ classe: 'combatente', trilha: 'tropa de choque' }).trilha; }, esperado: 'combatente-tropa-de-choque' },
      { nome: 'E9 · Migração: trilha "xyz" fica em trilhaTexto', obtido: function () { const i = migrado({ classe: 'combatente', trilha: 'xyz' }); return i.trilha + '/' + i.trilhaTexto; }, esperado: 'outra/xyz' },
      { nome: 'E9 · Migração: origem "Policial"', obtido: function () { return migrado({ origem: 'Policial' }).origem; }, esperado: 'policial' },
      { nome: 'E9 · Migração: origem desconhecida fica em origemTexto', obtido: function () { const i = migrado({ origem: 'Detetive particular' }); return i.origem + '/' + i.origemTexto; }, esperado: 'outra/Detetive particular' },
      { nome: 'E9 · Migração de origem/trilha é idempotente', obtido: function () { const uma = OP.state.completarPadroes({ identificacao: { classe: 'combatente', origem: 'Policial', trilha: 'xyz' } }); return iguais(OP.state.completarPadroes(uma), uma); }, esperado: true },

      // --- Etapa 9: progressão ---
      { nome: 'E9 · rituaisConcedidosClasse: Ocultista NEX 5/50/99 e Combatente', obtido: function () { return [5, 50, 99].map(function (nex) { return calc.rituaisConcedidosClasse(fichaDeTeste({ classe: 'ocultista', nex: nex })); }).concat([calc.rituaisConcedidosClasse(fichaDeTeste({ classe: 'combatente', nex: 99 }))]).join(','); }, esperado: '3,12,22,0' },
      { nome: 'E9 · proximoMarco: Combatente NEX 15%', obtido: function () { const p = calc.proximoMarco(fichaDeTeste({ classe: 'combatente', nex: 15 })); return p.nivel + '/' + p.rotulos.join(','); }, esperado: '20/Aumento de atributo' },
      { nome: 'E9 · proximoMarco: NEX 99% → nenhum', obtido: function () { return calc.proximoMarco(fichaDeTeste({ classe: 'combatente', nex: 99 })); }, esperado: null },
      { nome: 'E9 · Poderes liberados: Combatente NEX 45%', obtido: function () { return calc.poderesLiberados(fichaDeTeste({ classe: 'combatente', nex: 45 })); }, esperado: 3 },

      // --- Etapa 9, Parte B: custo das formas dos rituais ---
      { nome: 'E9 · Arma Atroz (1º): Padrão/Discente (+2)/Verdadeiro (+5)', obtido: function () { return custosRitual(armaAtroz); }, esperado: '1/3/6' },
      { nome: 'E9 · Armadura de Sangue (1º): Discente (+5)/Verdadeiro (+9)', obtido: function () { return custosRitual({ circulo: 1, formas: { discente: { ativa: true, custoAdicional: 5, requerCirculo: 3 }, verdadeira: { ativa: true, custoAdicional: 9, requerCirculo: 4 } } }); }, esperado: '1/6/10' },
      { nome: 'E9 · Aprimorar Físico (2º): Discente (+3)/Verdadeiro (+7)', obtido: function () { return custosRitual({ circulo: 2, formas: { discente: { ativa: true, custoAdicional: 3, requerCirculo: 3 }, verdadeira: { ativa: true, custoAdicional: 7, requerCirculo: 4 } } }); }, esperado: '3/6/10' },
      { nome: 'E9 · Ritual novo de 1º círculo: +PE sugeridos (requer 2º e 3º)', obtido: function () { const r = OP.state.novoRitual({ circulo: 1 }); return [r.formas.discente.custoAdicional, r.formas.discente.requerCirculo, r.formas.verdadeira.custoAdicional, r.formas.verdadeira.requerCirculo, r.formas.verdadeira.requerAfinidade].join('/'); }, esperado: '2/2/5/3/true' },
      { nome: 'E9 · custoAdicionalSugerido: 2º círculo que requer o 4º', obtido: function () { return calc.custoAdicionalSugerido(OP.state.novoRitual({ circulo: 2 }), 4); }, esperado: 7 },
      { nome: 'E9 · Custo base digitado substitui o do círculo', obtido: function () { return custosRitual({ circulo: 1, custoBase: 2, formas: { discente: { ativa: true, custoAdicional: 2 } } }).split('/').slice(0, 2).join('/'); }, esperado: '2/4' },
      { nome: 'E9 · Aviso: Discente que requer o 2º círculo com NEX 20%', obtido: function () { return avisosDe({ classe: 'ocultista', nex: 20 }, armaAtroz, 'discente'); }, esperado: 'circulo' },
      { nome: 'E9 · Sem aviso: Discente que requer o 2º círculo com NEX 25%', obtido: function () { return avisosDe({ classe: 'ocultista', nex: 25 }, armaAtroz, 'discente'); }, esperado: '' },
      { nome: 'E9 · Aviso: Verdadeiro que requer afinidade sem afinidade desenvolvida', obtido: function () { return avisosDe({ classe: 'ocultista', nex: 99 }, armaAtroz, 'verdadeira', { elementoConectado: 'sangue', afinidadeDesenvolvida: false }); }, esperado: 'afinidade' },
      { nome: 'E9 · Aviso: afinidade com outro elemento não vale', obtido: function () { return avisosDe({ classe: 'ocultista', nex: 99 }, armaAtroz, 'verdadeira', { elementoConectado: 'morte', afinidadeDesenvolvida: true }); }, esperado: 'afinidade' },
      { nome: 'E9 · Sem aviso: afinidade desenvolvida com o elemento do ritual', obtido: function () { return avisosDe({ classe: 'ocultista', nex: 99 }, armaAtroz, 'verdadeira', { elementoConectado: 'sangue', afinidadeDesenvolvida: true }); }, esperado: '' },
      { nome: 'E9 · Medo de 2º círculo, forma Padrão → SAN e perda permanente', obtido: function () { const p = calc.planoConjuracao(fichaMedo(5, 20), OP.state.novoRitual({ circulo: 2, elemento: 'medo' }), 'padrao'); return [p.pe, p.san, p.permanente].join('/'); }, esperado: '3/3/1' },
      { nome: 'E9 · Conjurar usa o custo total (Arma Atroz Discente, PE 5 → 2)', obtido: function () { const f = fichaMedo(5, 20); OP.rolagens.conjurarRitual(f, OP.state.novoRitual(armaAtroz), 'discente'); return calc.estadoRecurso(f, 'pe').atual; }, esperado: 2 },
      { nome: 'E9 · Migração de ritual: 1º círculo, Discente com custo antigo 3', obtido: function () { const r = OP.state.completarPadroes({ rituais: [{ circulo: 1, formas: { padrao: { custo: 1 }, discente: { ativa: true, custo: 3 } } }] }).rituais[0]; return [r.formas.discente.custoAdicional, r.custoBase, Object.prototype.hasOwnProperty.call(r.formas.discente, 'custo')].join('/'); }, esperado: '2//false' },
      { nome: 'E9 · Migração de ritual mantém o total antigo com Padrão personalizada', obtido: function () { const r = OP.state.novoRitual({ circulo: 1, formas: { padrao: { custo: 2 }, discente: { ativa: true, custo: 5 } } }); return custosRitual(r).split('/').slice(0, 2).join('/'); }, esperado: '2/5' },
      { nome: 'E9 · Resistência: efeitos "evita" e "ver_texto" existem', obtido: function () { return ['evita', 'ver_texto'].every(function (id) { return OP.data.resistencia.efeitos.some(function (e) { return e.id === id; }); }); }, esperado: true },

      // --- Etapa 9, Parte A3: afinidade ---
      { nome: 'E9 · Migração: afinidade "sangue" → elemento conectado e desenvolvida', obtido: function () { const c = OP.state.completarPadroes({ conjuracao: { afinidade: 'sangue' } }).conjuracao; return [c.elementoConectado, c.afinidadeDesenvolvida, Object.prototype.hasOwnProperty.call(c, 'afinidade')].join('/'); }, esperado: 'sangue/true/false' },
      { nome: 'E9 · Afinidade desenvolvida sem elemento conectado é desfeita', obtido: function () { const f = fichaDeTeste({ classe: 'ocultista', nex: 50 }); f.conjuracao.afinidadeDesenvolvida = true; return calc.correcoesConjuracao(f).some(function (c) { return c.caminho === 'conjuracao.afinidadeDesenvolvida' && c.valor === false; }); }, esperado: true },
      { nome: 'E9 · Importar ficha da versão 8 com afinidade antiga', obtido: function () { const r = importarTexto(JSON.stringify({ formato: 'op-ficha', versao: 8, ficha: { versaoModelo: 8, conjuracao: { afinidade: 'energia' }, identificacao: { origem: 'Militar' } } })); return r.ok + '/' + r.fichas[0].conjuracao.elementoConectado + '/' + r.fichas[0].identificacao.origem; }, esperado: 'true/energia/militar' },

      { nome: 'Gerador restaurado após os testes', obtido: function () { const g = OP.dados.getRng(); return comDados([0], function () { return true; }) && OP.dados.getRng() === g; }, esperado: true }
    ]).concat(OP.testesEtapa10 ? OP.testesEtapa10({ fichaDeTeste: fichaDeTeste }) : []);
  }

  /** Roda todas as verificações e mostra o resultado no console. */
  function runTests() {
    let aprovados = 0;
    const lista = casos();

    console.group('[OP] Testes de fórmulas');
    lista.forEach(function (caso) {
      let obtido;
      try {
        obtido = caso.obtido();
      } catch (erro) {
        obtido = 'erro: ' + erro.message;
      }
      if (obtido === caso.esperado) {
        aprovados++;
        console.log('OK      ' + caso.nome + ' = ' + obtido);
      } else {
        console.error('FALHOU  ' + caso.nome + ' → esperado ' + caso.esperado + ', obtido ' + obtido);
      }
    });
    console.log(aprovados + ' de ' + lista.length + ' testes OK');
    console.groupEnd();

    return { total: lista.length, aprovados: aprovados, falhas: lista.length - aprovados };
  }

  OP.runTests = runTests;
})(window.OP);
