/* ==========================================================================
   js/calc.js — fórmulas da ficha
   --------------------------------------------------------------------------
   Só funções puras: recebem a ficha (e, se preciso, as regras) e devolvem
   números ou estruturas simples. Nada aqui lê ou altera o DOM nem o estado.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  /** Converte qualquer valor em número finito; vazio, texto ou NaN viram 0. */
  function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  }

  /** Ids dos atributos na ordem da ficha. */
  function idsAtributos() {
    return OP.data.atributos.map(function (atributo) { return atributo.id; });
  }

  /** Valor base de um atributo. */
  function baseAtributo(ficha, id) {
    const atributo = ficha.atributos[id] || {};
    return numero(atributo.base);
  }

  /** Total de um atributo = base + bônus. */
  function totalAtributo(ficha, id) {
    const atributo = ficha.atributos[id] || {};
    return numero(atributo.base) + numero(atributo.bonus);
  }

  /** Totais de todos os atributos: { agi, for, int, pre, vig }. */
  function totaisAtributos(ficha) {
    const totais = {};
    idsAtributos().forEach(function (id) {
      totais[id] = totalAtributo(ficha, id);
    });
    return totais;
  }

  /**
   * Confere a distribuição de pontos dos atributos.
   * Cada ponto acima da base inicial custa 1; cada ponto abaixo devolve 1.
   * Usa só os valores BASE: bônus de poderes e itens não gastam pontos.
   * Total permitido = 9 (criação) + aumentos de atributo liberados pelo NEX
   * (pontosAtributoPermitidos). Máximo por atributo: o da criação (3) sem
   * aumentos; com aumentos, o da classe (5; 3 no Sobrevivente).
   *
   * Devolve:
   *   disponiveis, gastos, restantes, aumentos, maximo, permitidos → números
   *   acimaDoMaximo, abaixoDoMinimo, reduzidos → listas de ids
   *   reducoesEmExcesso → quantos atributos reduzidos além do permitido
   *   valida → true se nenhuma regra foi violada (pontos sobrando não é violação)
   */
  function analisarDistribuicao(ficha, regras) {
    const r = regras || OP.data.regrasAtributos;
    const aumentos = aumentosAtributoLiberados(ficha);
    const maximo = maximoAtributo(ficha, r);
    const resultado = {
      disponiveis: r.pontosParaDistribuir + aumentos,
      aumentos: aumentos,
      maximo: maximo,
      permitidos: pontosAtributoPermitidos(ficha, r),
      gastos: 0,
      restantes: 0,
      acimaDoMaximo: [],
      abaixoDoMinimo: [],
      reduzidos: [],
      reducoesEmExcesso: 0,
      valida: true
    };

    idsAtributos().forEach(function (id) {
      const base = baseAtributo(ficha, id);
      resultado.gastos += base - r.baseInicial;
      if (base > maximo) resultado.acimaDoMaximo.push(id);
      if (base < r.minimo) resultado.abaixoDoMinimo.push(id);
      if (base < r.baseInicial) resultado.reduzidos.push(id);
    });

    resultado.restantes = resultado.disponiveis - resultado.gastos;
    resultado.reducoesEmExcesso = Math.max(0, resultado.reduzidos.length - r.maxAtributosReduzidos);
    resultado.valida = resultado.restantes >= 0 &&
      resultado.acimaDoMaximo.length === 0 &&
      resultado.abaixoDoMinimo.length === 0 &&
      resultado.reducoesEmExcesso === 0;

    return resultado;
  }

  /* ------------------------------------------------------------------------
     Classe, NEX e estágio
     ------------------------------------------------------------------------ */

  function temChave(objeto, chave) {
    return objeto !== null && typeof objeto === 'object' && Object.prototype.hasOwnProperty.call(objeto, chave);
  }

  /** As classes de data/classes.js, na ordem do arquivo. */
  function classesLista() {
    return Object.keys(OP.data.classes).map(function (id) { return OP.data.classes[id]; });
  }

  /** Dados de uma classe pelo id, ou null. */
  function classeDados(id) {
    return typeof id === 'string' && temChave(OP.data.classes, id) ? OP.data.classes[id] : null;
  }

  /** Dados da classe escolhida na ficha, ou null se nenhuma estiver escolhida. */
  function classeDaFicha(ficha) {
    return classeDados(ficha.identificacao ? ficha.identificacao.classe : '');
  }

  /** Dados de uma origem pelo id, ou null. */
  function origemDados(id) {
    return acharPorId(OP.data.origens, id);
  }

  /** Dados de uma trilha pelo id, ou null. */
  function trilhaDados(id) {
    return acharPorId(OP.data.trilhas, id);
  }

  /** Todas as trilhas de uma classe (sem filtro de fontes). */
  function trilhasDaClasse(idClasse) {
    return OP.data.trilhas.filter(function (trilha) { return trilha.classe === idClasse; });
  }

  /**
   * Passos de NEX: quantos avanços de 5% já ocorreram depois do NEX 5%.
   * 5% → 0, 10% → 1, 50% → 9, 95% → 18 e 99% (último nível) → 19.
   */
  function passosNex(nex) {
    const valor = numero(nex);
    if (valor >= 99) return 19;
    return Math.max(0, Math.floor((valor - 5) / 5));
  }

  /** Unidade da progressão: 'estagio' (Sobrevivente) ou 'nex' (demais e sem classe). */
  function unidadeProgressao(ficha) {
    const classe = classeDaFicha(ficha);
    return classe && classe.unidadeProgressao === 'estagio' ? 'estagio' : 'nex';
  }

  /** Estágio da ficha, entre 1 e o máximo da classe (5 sem classe de estágio). */
  function estagioDaFicha(ficha) {
    const classe = classeDaFicha(ficha);
    const maximo = classe && classe.estagioMax ? Math.max(1, numero(classe.estagioMax)) : 5;
    return limitarEntre(Math.trunc(numero(ficha.identificacao.estagio)) || 1, 1, maximo);
  }

  /** Nível atual na unidade da classe: NEX (%) ou estágio. */
  function nivelProgressao(ficha) {
    return unidadeProgressao(ficha) === 'estagio' ? estagioDaFicha(ficha) : numero(ficha.identificacao.nex);
  }

  /**
   * Passos usados por PV, PE e SAN:
   * classes de NEX → passosNex(nex) (NEX 5% = 0, 99% = 19);
   * Sobrevivente → estágio − 1.
   */
  function passosProgressao(ficha) {
    return unidadeProgressao(ficha) === 'estagio' ? estagioDaFicha(ficha) - 1 : passosNex(ficha.identificacao.nex);
  }

  /**
   * Limite de PE gastos por turno = NEX ÷ 5 (5% → 1, 10% → 2, 99% → 20).
   * Com uma ficha: classes com limitePEFixo (Sobrevivente) usam esse valor.
   * Com um número: atalho pelo NEX (como nas etapas anteriores).
   */
  function limitePEporTurno(fichaOuNex) {
    if (fichaOuNex !== null && typeof fichaOuNex === 'object') {
      const classe = classeDaFicha(fichaOuNex);
      if (classe && typeof classe.limitePEFixo === 'number') return classe.limitePEFixo;
      return limitePEporTurno(fichaOuNex.identificacao ? fichaOuNex.identificacao.nex : 0);
    }
    return Math.max(0, Math.round(numero(fichaOuNex) / 5));
  }

  /* ---------- Tabela de progressão ---------- */

  /**
   * Linhas de progressão em uso: as da classe da ficha; sem classe, a tabela
   * das classes de NEX (os marcos de atributo e de grau são os mesmos).
   */
  function progressaoDaFicha(ficha) {
    const classe = classeDaFicha(ficha) || classesLista().find(function (c) { return c.unidadeProgressao === 'nex'; });
    return classe && Array.isArray(classe.progressao) ? classe.progressao : [];
  }

  /** Nível de uma linha da tabela: NEX (%) ou estágio. */
  function nivelDaLinha(linha) {
    return numero(temChave(linha, 'estagio') ? linha.estagio : linha.nex);
  }

  /** Quantos itens de um tipo (poder, aumento_atributo...) já foram alcançados. */
  function itensAlcancados(ficha, tipo) {
    const nivel = nivelProgressao(ficha);
    return progressaoDaFicha(ficha).reduce(function (soma, linha) {
      if (nivelDaLinha(linha) > nivel) return soma;
      return soma + linha.itens.filter(function (item) { return item.tipo === tipo; }).length;
    }, 0);
  }

  /** Níveis em que aparece um tipo de item (ex.: grau_treinamento → [35, 70]). */
  function niveisDoTipo(ficha, tipo) {
    return progressaoDaFicha(ficha).filter(function (linha) {
      return linha.itens.some(function (item) { return item.tipo === tipo; });
    }).map(nivelDaLinha);
  }

  /** Próxima linha da tabela depois do nível atual: { nivel, unidade, rotulos } ou null. */
  function proximoMarco(ficha) {
    const nivel = nivelProgressao(ficha);
    const linha = progressaoDaFicha(ficha).find(function (l) { return nivelDaLinha(l) > nivel; });
    if (!linha) return null;
    return {
      nivel: nivelDaLinha(linha),
      unidade: unidadeProgressao(ficha),
      rotulos: linha.itens.map(function (item) { return item.rotulo; })
    };
  }

  /** Poderes de classe liberados até o nível atual (itens "poder"). */
  function poderesLiberados(ficha) {
    return itensAlcancados(ficha, 'poder');
  }

  /**
   * Rituais concedidos pela classe (Ocultista): rituaisIniciais + 1 por passo
   * (3 no NEX 5%, 12 no 50%, 22 no 99%). Classes sem rituais iniciais → 0.
   */
  function rituaisConcedidosClasse(ficha) {
    const classe = classeDaFicha(ficha);
    if (!classe || typeof classe.rituaisIniciais !== 'number') return 0;
    return classe.rituaisIniciais + passosProgressao(ficha);
  }

  /* ---------- Atributos: aumentos pelo NEX ---------- */

  /** Aumentos de atributo liberados (NEX 20%, 50%, 80% e 95%; Sobrevivente: estágio 3). */
  function aumentosAtributoLiberados(ficha) {
    return itensAlcancados(ficha, 'aumento_atributo');
  }

  /** Soma das bases permitida = 9 da criação + aumentos liberados. */
  function pontosAtributoPermitidos(ficha, regras) {
    const r = regras || OP.data.regrasAtributos;
    return r.baseInicial * OP.data.atributos.length + r.pontosParaDistribuir + aumentosAtributoLiberados(ficha);
  }

  /** Aumentos já usados = soma das bases − 9 (nunca negativo). */
  function aumentosAtributoUsados(ficha, regras) {
    const r = regras || OP.data.regrasAtributos;
    const soma = idsAtributos().reduce(function (total, id) { return total + baseAtributo(ficha, id); }, 0);
    return Math.max(0, soma - (r.baseInicial * OP.data.atributos.length + r.pontosParaDistribuir));
  }

  /**
   * Maior valor base aceito sem aviso: o da criação (3) enquanto não há
   * aumentos; depois, o limite dos aumentos da classe (5; 3 no Sobrevivente).
   */
  function maximoAtributo(ficha, regras) {
    const r = regras || OP.data.regrasAtributos;
    if (aumentosAtributoLiberados(ficha) === 0) return r.maximoInicial;
    const classe = classeDaFicha(ficha);
    return classe && typeof classe.aumentoAtributoMax === 'number' ? classe.aumentoAtributoMax : r.maximoComAumentos;
  }

  /* ------------------------------------------------------------------------
     Recursos (PV, PE, SAN)
     ------------------------------------------------------------------------ */

  function definicaoRecurso(idRecurso) {
    return OP.data.recursos.find(function (recurso) { return recurso.id === idRecurso; }) || null;
  }

  /** Inteiro ≥ 0 (vazio, texto, NaN e negativos viram 0). */
  function inteiroNaoNegativo(valor) {
    return Math.max(0, Math.trunc(numero(valor)));
  }

  /**
   * Composição do máximo de um recurso, parte por parte:
   *   inicial  = inicial da classe + atributo (total)
   *   porNex   = valor por NEX da classe (+ atributo, se config.progressaoSomaAtributo
   *              estiver ligado para o recurso e a classe for de NEX)
   *   ganhoNex = porNex × passosProgressao (passos de NEX ou estágio − 1)
   *   max      = inicial + ganhoNex + bônus manual − perda permanente
   *              (nunca abaixo de 0; só a SAN tem perda permanente)
   * Ex. (Guia): Combatente NEX 15%, VIG 3 → 20 + 3 + 2 × (4 + 3) = 37 PV.
   * Sobrevivente: valores "por NEX" valem por estágio, sem somar atributo.
   * Sem classe escolhida: max = 0 e classeDefinida = false.
   */
  function composicaoRecurso(ficha, idRecurso) {
    const definicao = definicaoRecurso(idRecurso);
    const classe = classeDaFicha(ficha);
    const salvo = (ficha.recursos && ficha.recursos[idRecurso]) || {};
    const atributo = definicao ? definicao.atributo : null;
    const unidade = unidadeProgressao(ficha);
    const somaConfig = OP.data.config.progressaoSomaAtributo || {};

    const composicao = {
      classeDefinida: Boolean(definicao && classe),
      atributo: atributo,
      valorAtributo: atributo ? totalAtributo(ficha, atributo) : 0,
      unidade: unidade,
      somaAtributo: Boolean(atributo) && unidade === 'nex' && somaConfig[idRecurso] === true,
      inicialClasse: 0,
      porNexClasse: 0,
      passos: passosProgressao(ficha),
      inicial: 0,
      porNex: 0,
      ganhoNex: 0,
      bonus: numero(salvo.bonusMax),
      perdaPermanente: inteiroNaoNegativo(salvo.perdaPermanente),
      max: 0
    };
    if (!composicao.classeDefinida) return composicao;

    composicao.inicialClasse = numero(classe[definicao.campoInicial]);
    composicao.porNexClasse = numero(classe[definicao.campoPorNex]);
    composicao.inicial = composicao.inicialClasse + composicao.valorAtributo;
    composicao.porNex = composicao.porNexClasse + (composicao.somaAtributo ? composicao.valorAtributo : 0);
    composicao.ganhoNex = composicao.porNex * composicao.passos;
    composicao.max = Math.max(0, composicao.inicial + composicao.ganhoNex + composicao.bonus - composicao.perdaPermanente);
    return composicao;
  }

  /** PV máximo = (PV inicial + VIG) + (PV por NEX + VIG) × passos + bônus. */
  function pvMax(ficha) {
    return composicaoRecurso(ficha, 'pv').max;
  }

  /** PE máximo = (PE inicial + PRE) + (PE por NEX + PRE) × passos + bônus (PRE por passo: config). */
  function peMax(ficha) {
    return composicaoRecurso(ficha, 'pe').max;
  }

  /** SAN máxima = SAN inicial + SAN por NEX × passos + bônus − perda permanente (nunca abaixo de 0). */
  function sanMax(ficha) {
    return composicaoRecurso(ficha, 'san').max;
  }

  /** Valor "atual" salvo, validado: número finito ou null (null = ficha nova). */
  function atualSalvo(valor) {
    return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
  }

  function limitarEntre(valor, minimo, maximo) {
    return Math.min(Math.max(valor, minimo), maximo);
  }

  /** Valor atual mostrado: null assume o máximo; os demais ficam entre 0 e o máximo. */
  function atualEfetivo(atual, max) {
    const salvo = atualSalvo(atual);
    return salvo === null ? max : limitarEntre(salvo, 0, max);
  }

  /**
   * Valor a gravar depois que o máximo muda:
   * - null continua null (segue o máximo até o usuário mexer);
   * - acima do máximo cai para o máximo; abaixo de 0 sobe para 0;
   * - se o máximo subir, o atual não muda.
   */
  function ajustarAtual(atual, max) {
    const salvo = atualSalvo(atual);
    return salvo === null ? null : limitarEntre(salvo, 0, max);
  }

  /**
   * Correções que o estado precisa receber para manter 0 ≤ atual ≤ máximo.
   * Sem classe o máximo é desconhecido, então nada é corrigido (evita zerar
   * o atual só porque a classe ficou em branco por um momento).
   * Devolve uma lista [{ caminho, valor }].
   */
  function correcoesRecursos(ficha) {
    const correcoes = [];
    OP.data.recursos.forEach(function (definicao) {
      const composicao = composicaoRecurso(ficha, definicao.id);
      const salvo = ficha.recursos[definicao.id] || {};
      // Perda permanente (só a SAN): inteiro, nunca negativa.
      if (Object.prototype.hasOwnProperty.call(salvo, 'perdaPermanente') && salvo.perdaPermanente !== composicao.perdaPermanente) {
        correcoes.push({ caminho: 'recursos.' + definicao.id + '.perdaPermanente', valor: composicao.perdaPermanente });
      }
      if (!composicao.classeDefinida) return;
      const atual = salvo.atual;
      const ajustado = ajustarAtual(atual, composicao.max);
      if (ajustado !== atual) {
        correcoes.push({ caminho: 'recursos.' + definicao.id + '.atual', valor: ajustado });
      }
    });
    return correcoes;
  }

  /** Tudo o que a interface precisa de um recurso: composição, atual e % da barra. */
  function estadoRecurso(ficha, idRecurso) {
    const composicao = composicaoRecurso(ficha, idRecurso);
    if (!composicao.classeDefinida) {
      // Sem classe: máximo e atual ficam "desconhecidos" na tela.
      return Object.assign(composicao, { max: null, atual: null, percentual: 0 });
    }
    const atual = atualEfetivo((ficha.recursos[idRecurso] || {}).atual, composicao.max);
    const percentual = composicao.max > 0 ? Math.round((atual / composicao.max) * 100) : 0;
    return Object.assign(composicao, { atual: atual, percentual: percentual });
  }

  /* ------------------------------------------------------------------------
     Inventário
     Sem dinheiro nem peso: espaços de carga, Pontos de Prestígio, patente,
     limite de crédito e limite de itens por categoria.
     ------------------------------------------------------------------------ */

  function inventarioSalvo(ficha) {
    return ficha.inventario || {};
  }

  /** Itens da ficha (só os que são objetos). */
  function itensDaFicha(ficha) {
    const itens = inventarioSalvo(ficha).itens;
    if (!Array.isArray(itens)) return [];
    return itens.filter(function (item) { return item !== null && typeof item === 'object'; });
  }

  /** Quantidade de um item: inteiro, nunca negativo. */
  function quantidadeItem(item) {
    return Math.max(0, Math.trunc(numero(item.quantidade)));
  }

  /** Capacidade sem o bônus: capacidadePorForca × FOR, ou capacidadeForcaZero se FOR ≤ 0. */
  function capacidadeBase(ficha) {
    const config = OP.data.config;
    const forca = totalAtributo(ficha, 'for');
    return forca <= 0 ? numero(config.capacidadeForcaZero) : numero(config.capacidadePorForca) * forca;
  }

  /**
   * Capacidade de carga (espaços) = capacidadePorForca × FOR total + bônus manual.
   * Com FOR total ≤ 0: capacidadeForcaZero + bônus manual. Nunca abaixo de 0.
   */
  function capacidadeCarga(ficha) {
    return Math.max(0, capacidadeBase(ficha) + numero(inventarioSalvo(ficha).capacidadeBonus));
  }

  /** Espaços usados = soma de espaços × quantidade de TODOS os itens. */
  function espacosUsados(ficha) {
    const total = itensDaFicha(ficha).reduce(function (soma, item) {
      return soma + Math.max(0, numero(item.espacos)) * quantidadeItem(item);
    }, 0);
    return Math.round(total * 100) / 100; // evita sobras de ponto flutuante (ex.: 0,5 × 3)
  }

  /** Sobrecarregado = espaços usados acima da capacidade. */
  function sobrecarregado(ficha) {
    return espacosUsados(ficha) > capacidadeCarga(ficha);
  }

  function dadosPatente(idPatente) {
    return OP.data.patentes.find(function (patente) { return patente.id === idPatente; }) || null;
  }

  /** Patente escolhida na ficha (id). Se for inválida, a primeira da tabela (Recruta). */
  function patenteAtual(ficha) {
    const escolhida = dadosPatente(inventarioSalvo(ficha).patente);
    return escolhida ? escolhida.id : OP.data.patentes[0].id;
  }

  /**
   * Maior patente com ppMinimo ≤ PP (id).
   * É só uma sugestão: nunca altera a patente escolhida pelo usuário.
   */
  function patenteSugerida(pp) {
    const pontos = numero(pp);
    let sugerida = OP.data.patentes[0];
    OP.data.patentes.forEach(function (patente) {
      if (patente.ppMinimo <= pontos && patente.ppMinimo >= sugerida.ppMinimo) sugerida = patente;
    });
    return sugerida.id;
  }

  function nivelCreditoValido(idNivel) {
    return OP.data.niveisCredito.some(function (nivel) { return nivel.id === idNivel; });
  }

  /** Crédito em uso (id): o escolhido à mão ou, se null, o da patente. */
  function creditoAtual(ficha) {
    const escolhido = inventarioSalvo(ficha).creditoNivel;
    if (nivelCreditoValido(escolhido)) return escolhido;
    return dadosPatente(patenteAtual(ficha)).credito;
  }

  /**
   * Limite de itens por categoria (I a IV; a categoria 0 não tem limite).
   * Devolve [{ categoria: 'I', limite, usados, excedeu }], com "usados" = soma das quantidades.
   */
  function limitesItens(ficha) {
    const patente = dadosPatente(patenteAtual(ficha));
    const itens = itensDaFicha(ficha);
    return OP.data.categoriasItem.filter(function (categoria) { return categoria.chave !== null; }).map(function (categoria) {
      const limite = numero(patente.limites[categoria.chave]);
      const usados = itens.filter(function (item) {
        return Math.trunc(numero(item.categoria)) === categoria.valor;
      }).reduce(function (soma, item) { return soma + quantidadeItem(item); }, 0);
      return { categoria: categoria.chave, limite: limite, usados: usados, excedeu: usados > limite };
    });
  }

  /** Itens do tipo proteção marcados como equipados. */
  function protecoesEquipadas(ficha) {
    return itensDaFicha(ficha).filter(function (item) {
      return item.tipo === 'protecao' && item.equipada === true;
    });
  }

  /** Soma da Defesa das proteções equipadas. */
  function defesaProtecoes(ficha) {
    return protecoesEquipadas(ficha).reduce(function (soma, item) { return soma + numero(item.defesa); }, 0);
  }

  /**
   * Penalidade em perícias com carga = penalidades das proteções equipadas
   * + (sobrecarregado ? config.sobrecarga.pericias : 0). Sempre ≥ 0.
   */
  function penalidadeCarga(ficha) {
    const protecoes = protecoesEquipadas(ficha).reduce(function (soma, item) {
      return soma + Math.max(0, numero(item.penalidade));
    }, 0);
    return protecoes + (sobrecarregado(ficha) ? numero(OP.data.config.sobrecarga.pericias) : 0);
  }

  function periciaTemKit(idPericia) {
    const definicao = definicaoPericia(idPericia);
    return Boolean(definicao && definicao.kit);
  }

  /** Há um item do tipo "kit" no inventário ligado a esta perícia? */
  function kitAtivo(ficha, idPericia) {
    return itensDaFicha(ficha).some(function (item) {
      return item.tipo === 'kit' && item.periciaKit === idPericia;
    });
  }

  /** Tudo o que a interface precisa do inventário. */
  function estadoInventario(ficha) {
    const config = OP.data.config;
    const capacidade = capacidadeCarga(ficha);
    const usados = espacosUsados(ficha);
    const limites = limitesItens(ficha);
    const limitesPorCategoria = {};
    limites.forEach(function (limite) { limitesPorCategoria[limite.categoria] = limite; });
    const patente = dadosPatente(patenteAtual(ficha));
    const pontos = numero(inventarioSalvo(ficha).pontosPrestigio);

    let percentual = 0;
    if (capacidade > 0) percentual = Math.min(100, Math.round((usados / capacidade) * 100));
    else if (usados > 0) percentual = 100;

    return {
      forca: totalAtributo(ficha, 'for'),
      capacidadeBase: capacidadeBase(ficha),
      capacidadeBonus: numero(inventarioSalvo(ficha).capacidadeBonus),
      capacidade: capacidade,
      espacosUsados: usados,
      percentualCarga: percentual,
      sobrecarregado: usados > capacidade,
      sobrecarga: config.sobrecarga,
      patente: patente.id,
      pontosPrestigio: pontos,
      patenteSugerida: patenteSugerida(pontos),
      credito: creditoAtual(ficha),
      creditoPatente: patente.credito,
      limites: limites,
      limitesPorCategoria: limitesPorCategoria,
      algumLimiteExcedido: limites.some(function (limite) { return limite.excedeu; }),
      defesaProtecoes: defesaProtecoes(ficha),
      nomesProtecoes: protecoesEquipadas(ficha).map(function (item) { return item.nome; }),
      penalidadeCarga: penalidadeCarga(ficha)
    };
  }

  /**
   * Correções para dados inválidos do inventário: patente inexistente volta
   * à primeira, crédito inexistente volta ao padrão (null), tipo inválido vira
   * "geral", categoria fica entre 0 e 4 e kit sem perícia válida vira null.
   */
  function correcoesInventario(ficha) {
    const inventario = inventarioSalvo(ficha);
    const correcoes = [];
    const categoriaMaxima = OP.data.categoriasItem[OP.data.categoriasItem.length - 1].valor;

    if (!dadosPatente(inventario.patente)) {
      correcoes.push({ caminho: 'inventario.patente', valor: OP.data.patentes[0].id });
    }
    if (inventario.creditoNivel !== null && !nivelCreditoValido(inventario.creditoNivel)) {
      correcoes.push({ caminho: 'inventario.creditoNivel', valor: null });
    }
    (Array.isArray(inventario.itens) ? inventario.itens : []).forEach(function (item, indice) {
      if (item === null || typeof item !== 'object') return;
      const caminho = 'inventario.itens.' + indice;
      const tipoValido = OP.data.tiposItem.some(function (tipo) { return tipo.id === item.tipo; });
      if (!tipoValido) correcoes.push({ caminho: caminho + '.tipo', valor: 'geral' });
      const categoria = limitarEntre(Math.trunc(numero(item.categoria)), 0, categoriaMaxima);
      if (categoria !== item.categoria) correcoes.push({ caminho: caminho + '.categoria', valor: categoria });
      if (item.periciaKit !== null && !periciaTemKit(item.periciaKit)) {
        correcoes.push({ caminho: caminho + '.periciaKit', valor: null });
      }
    });
    return correcoes;
  }

  /* ------------------------------------------------------------------------
     Perícias
     O atributo NÃO entra no bônus: ele define quantos d20 se rola.
     ------------------------------------------------------------------------ */

  function definicaoPericia(idPericia) {
    return OP.data.pericias.find(function (pericia) { return pericia.id === idPericia; }) || null;
  }

  /** Dados salvos de uma perícia (objeto vazio se não houver). */
  function periciaSalva(ficha, idPericia) {
    return (ficha.pericias && ficha.pericias[idPericia]) || {};
  }

  function ehAtributoValido(idAtributo) {
    return OP.data.atributos.some(function (atributo) { return atributo.id === idAtributo; });
  }

  /** Grau de treinamento salvo, sempre um índice válido de OP.data.grausTreinamento. */
  function grauDaPericia(ficha, idPericia) {
    const maximo = OP.data.grausTreinamento.length - 1;
    return limitarEntre(Math.trunc(numero(periciaSalva(ficha, idPericia).grau)), 0, maximo);
  }

  /** Bônus de um grau de treinamento (0, 5, 10, 15). */
  function bonusDoGrau(grau) {
    const dados = OP.data.grausTreinamento[grau];
    return dados ? dados.bonus : 0;
  }

  /* ---------- Perícias concedidas pela classe e pela origem ---------- */

  function idPericiaValido(id) {
    return typeof id === 'string' && Boolean(definicaoPericia(id));
  }

  /** "Ciências" → "ciencias" (sem acento e minúsculo), para comparar textos. */
  function semAcento(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /**
   * Perícias que a escolha "livre" de uma origem aceita: todas, menos Luta e
   * Pontaria (só se a nota da origem citar); se a nota diz que o mestre
   * decide (Amnésico), todas.
   */
  function periciasLivresPermitidas(origem) {
    const nota = semAcento(origem && origem.escolha ? origem.escolha.nota : '');
    const todas = OP.data.pericias.map(function (p) { return p.id; });
    if (nota.indexOf('mestre') !== -1) return todas;
    return todas.filter(function (id) {
      return (id !== 'luta' && id !== 'pontaria') || nota.indexOf(id) !== -1;
    });
  }

  /** Perícias vindas da escolha da origem (livre, conjunto ou elemento), já validadas. */
  function periciasDaEscolhaOrigem(origem, salvas) {
    const escolha = origem && origem.escolha;
    const s = salvas || {};
    if (!escolha) return [];
    if (escolha.tipo === 'livre') {
      const permitidas = periciasLivresPermitidas(origem);
      const livres = Array.isArray(s.livres) ? s.livres.slice(0, Math.max(0, numero(escolha.qtd))) : [];
      return livres.filter(function (id) { return permitidas.indexOf(id) !== -1; });
    }
    if (escolha.tipo === 'conjunto') {
      const par = (s.conjunto === 0 || s.conjunto === 1) && Array.isArray(escolha.opcoes) ? escolha.opcoes[s.conjunto] : null;
      return Array.isArray(par) ? par.slice() : [];
    }
    if (escolha.tipo === 'elemento') {
      return typeof s.elemento === 'string' && temChave(escolha.mapa, s.elemento) ? [escolha.mapa[s.elemento]] : [];
    }
    return [];
  }

  /**
   * Perícias concedidas, com a fonte: [{ id, fonte: 'classe' | 'origem' }]
   * = fixas da classe + escolhas da classe + perícias da origem + escolhas
   * da origem (sem repetir; a classe vem primeiro).
   */
  function periciasConcedidasDetalhe(ficha) {
    const lista = [];
    const vistos = Object.create(null);
    function incluir(id, fonte) {
      if (idPericiaValido(id) && !vistos[id]) {
        vistos[id] = true;
        lista.push({ id: id, fonte: fonte });
      }
    }
    const identificacao = ficha.identificacao || {};
    const escolhas = identificacao.escolhas || {};
    const classe = classeDaFicha(ficha);
    if (classe && classe.pericias) {
      (classe.pericias.fixas || []).forEach(function (id) { incluir(id, 'classe'); });
      const grupos = escolhas.classe && Array.isArray(escolhas.classe.grupos) ? escolhas.classe.grupos : [];
      (classe.pericias.escolhas || []).forEach(function (opcoes, indice) {
        if (opcoes.indexOf(grupos[indice]) !== -1) incluir(grupos[indice], 'classe');
      });
    }
    const origem = origemDados(identificacao.origem);
    if (origem) {
      origem.pericias.forEach(function (id) { incluir(id, 'origem'); });
      periciasDaEscolhaOrigem(origem, escolhas.origem).forEach(function (id) { incluir(id, 'origem'); });
    }
    return lista;
  }

  /** Ids das perícias concedidas pela classe e pela origem. */
  function periciasConcedidas(ficha) {
    return periciasConcedidasDetalhe(ficha).map(function (item) { return item.id; });
  }

  /** De onde vem a perícia concedida: 'classe', 'origem' ou null. */
  function fonteConcedida(ficha, idPericia) {
    const achada = periciasConcedidasDetalhe(ficha).find(function (item) { return item.id === idPericia; });
    return achada ? achada.fonte : null;
  }

  /** Grau em uso: concedidas valem pelo menos Treinado (máximo entre o salvo e 1). */
  function grauEfetivo(ficha, idPericia) {
    const grau = grauDaPericia(ficha, idPericia);
    return fonteConcedida(ficha, idPericia) ? Math.max(grau, 1) : grau;
  }

  /* ---------- Graus de treinamento (NEX 35% e 70%) ---------- */

  /** Perícias que sobem por marco de grau = grauTreinamentoBase da classe + INT (total). */
  function grausPorMarco(ficha) {
    const classe = classeDaFicha(ficha);
    if (!classe || typeof classe.grauTreinamentoBase !== 'number') return 0;
    return Math.max(0, classe.grauTreinamentoBase + totalAtributo(ficha, 'int'));
  }

  /** Graus liberados = marcos de grau alcançados × (base + INT). */
  function grausTreinamentoLiberados(ficha) {
    return itensAlcancados(ficha, 'grau_treinamento') * grausPorMarco(ficha);
  }

  /** Graus usados = soma de (grau − 1) das perícias em Veterano (1) ou Expert (2). */
  function grausTreinamentoUsados(ficha) {
    return OP.data.pericias.reduce(function (soma, pericia) {
      const grau = grauDaPericia(ficha, pericia.id);
      return soma + (grau >= 2 ? grau - 1 : 0);
    }, 0);
  }

  /**
   * Perícias acima do grau liberado pelo NEX: Veterano antes do 1º marco de
   * grau (NEX 35%) ou Expert antes do 2º (NEX 70%).
   * Devolve [{ id, nome, grau, nomeGrau, nivelNecessario }] (nível null = a classe não tem o marco).
   */
  function avisosGrau(ficha) {
    const marcos = itensAlcancados(ficha, 'grau_treinamento');
    const niveis = niveisDoTipo(ficha, 'grau_treinamento');
    const avisos = [];
    OP.data.pericias.forEach(function (pericia) {
      const grau = grauDaPericia(ficha, pericia.id);
      if (grau < 2 || marcos >= grau - 1) return;
      const nivel = niveis[grau - 2];
      avisos.push({
        id: pericia.id,
        nome: pericia.nome,
        grau: grau,
        nomeGrau: OP.data.grausTreinamento[grau].nome,
        nivelNecessario: nivel === undefined ? null : nivel
      });
    });
    return avisos;
  }

  /** Tudo o que a tela precisa dos graus de treinamento. */
  function estadoGraus(ficha) {
    const liberados = grausTreinamentoLiberados(ficha);
    const usados = grausTreinamentoUsados(ficha);
    return {
      porMarco: grausPorMarco(ficha),
      marcos: itensAlcancados(ficha, 'grau_treinamento'),
      liberados: liberados,
      usados: usados,
      excedido: usados > liberados,
      avisos: avisosGrau(ficha),
      unidade: unidadeProgressao(ficha)
    };
  }

  /** Atributo em uso pela perícia: o escolhido na ficha ou, se nenhum (null), o padrão. */
  function atributoDaPericia(ficha, idPericia) {
    const escolhido = periciaSalva(ficha, idPericia).atributo;
    if (ehAtributoValido(escolhido)) return escolhido;
    const definicao = definicaoPericia(idPericia);
    return definicao ? definicao.atributoPadrao : null;
  }

  /**
   * Reserva de d20 de um teste, com o modificador de dados (+/−):
   * N efetivo = atributo + modificador.
   * - N ≥ 1: rola N d20 e fica com o MAIOR;
   * - N ≤ 0: rola (2 − N) d20 e fica com o MENOR
   *   (N 0 → 2d20 menor; N 0 com −1 → 3d20 menor). CONFERIR NO LIVRO
   */
  function resolverReserva(qtdAtributo, modDados) {
    const efetivo = Math.trunc(numero(qtdAtributo)) + Math.trunc(numero(modDados));
    if (efetivo >= 1) return { qtd: efetivo, modo: 'maior' };
    return { qtd: 2 - efetivo, modo: 'menor' };
  }

  /**
   * Quantos d20 rolar a partir do valor TOTAL do atributo (sem modificador).
   * Atributo N (N ≥ 1): N d20, usa o maior. Atributo 0: 2d20, usa o menor.
   * Atributo negativo segue a mesma regra do modificador (−1 → 3d20 menor).
   */
  function dadosPorAtributo(totalDoAtributo) {
    return resolverReserva(totalDoAtributo, 0);
  }

  /** Dados de uma perícia: { qtd, modo } ("maior" ou "menor"). */
  function periciaDados(ficha, idPericia) {
    const atributo = atributoDaPericia(ficha, idPericia);
    return resolverReserva(atributo ? totalAtributo(ficha, atributo) : 0, dadosCondicoesPericia(ficha, idPericia));
  }

  /** Texto dos dados: { qtd: 3, modo: 'maior' } → "3d20 maior". */
  function formatarDados(dados) {
    return dados.qtd + 'd20 ' + dados.modo;
  }

  /**
   * Bônus da perícia = bônus do grau + outros
   *   + config.bonusKit (se a perícia tem kit e o kit está no inventário)
   *   − penalidade de carga (se a perícia tem o sinalizador de carga).
   * O atributo fica de fora.
   * Usado também por Bloqueio, Esquiva e Iniciativa: manter nome e formato
   * (recebe ficha e id, devolve número).
   */
  function periciaBonus(ficha, idPericia) {
    const definicao = definicaoPericia(idPericia) || {};
    let bonus = bonusDoGrau(grauEfetivo(ficha, idPericia)) + numero(periciaSalva(ficha, idPericia).outros);
    // TODO: efeito do kit, depende da regra do livro (valor em OP.data.config.bonusKit).
    if (definicao.kit && kitAtivo(ficha, idPericia)) bonus += numero(OP.data.config.bonusKit);
    if (definicao.penalidadeCarga) bonus -= penalidadeCarga(ficha);
    return bonus;
  }

  /**
   * Pontos de treinamento = pontos da classe + INT (total) + bônus manual.
   * Sem classe: 0.
   */
  function pontosTreinamentoTotal(ficha) {
    const classe = classeDaFicha(ficha);
    if (!classe) return 0;
    const bonus = numero(ficha.pontosTreinamento && ficha.pontosTreinamento.bonus);
    return numero(classe.pontosTreinamento) + totalAtributo(ficha, 'int') + bonus;
  }

  /**
   * Perícias com grau salvo ≥ 1 que gastam pontos: ficam de fora as
   * concedidas pela classe/origem (automáticas) e as marcadas à mão como concedidas.
   */
  function pontosTreinamentoGastos(ficha) {
    const concedidas = periciasConcedidas(ficha);
    return OP.data.pericias.filter(function (pericia) {
      return grauDaPericia(ficha, pericia.id) >= 1 &&
        periciaSalva(ficha, pericia.id).concedida !== true &&
        concedidas.indexOf(pericia.id) === -1;
    }).length;
  }

  /** Tudo o que a interface precisa de uma perícia. */
  function estadoPericia(ficha, idPericia) {
    const definicao = definicaoPericia(idPericia) || {};
    const grau = grauEfetivo(ficha, idPericia);
    const atributo = atributoDaPericia(ficha, idPericia);
    return {
      atributo: atributo,
      atributoPadrao: definicao.atributoPadrao || null,
      atributoAlterado: atributo !== definicao.atributoPadrao,
      dados: periciaDados(ficha, idPericia),
      dadosCondicoes: dadosCondicoesPericia(ficha, idPericia), // soma de dados das condições (negativa = menos dados)
      grau: grau,
      grauSalvo: grauDaPericia(ficha, idPericia),
      concedidaPor: fonteConcedida(ficha, idPericia), // 'classe' | 'origem' | null
      treinada: grau >= 1,
      requerTreinamento: definicao.somenteTreinada === true && grau === 0,
      bonus: periciaBonus(ficha, idPericia),
      penalidadeCarga: definicao.penalidadeCarga ? penalidadeCarga(ficha) : 0,
      kitAtivo: definicao.kit ? kitAtivo(ficha, idPericia) : false
    };
  }

  /**
   * Correções para dados de perícia inválidos (ex.: ficha salva editada à mão):
   * - atributo que não existe volta a null (padrão);
   * - atributo igual ao padrão também vira null, para seguir o arquivo de dados
   *   se o padrão mudar (ex.: Religião passou de INT para PRE);
   * - grau fora da faixa é ajustado.
   * Devolve uma lista [{ caminho, valor }].
   */
  function correcoesPericias(ficha) {
    const correcoes = [];
    OP.data.pericias.forEach(function (definicao) {
      const salvo = periciaSalva(ficha, definicao.id);
      const caminho = 'pericias.' + definicao.id;
      const atributoInvalido = !ehAtributoValido(salvo.atributo);
      const atributoIgualAoPadrao = salvo.atributo === definicao.atributoPadrao;
      if (salvo.atributo !== null && (atributoInvalido || atributoIgualAoPadrao)) {
        correcoes.push({ caminho: caminho + '.atributo', valor: null });
      }
      const grau = grauDaPericia(ficha, definicao.id);
      if (salvo.grau !== grau) correcoes.push({ caminho: caminho + '.grau', valor: grau });
    });
    return correcoes;
  }

  /** Resumo dos pontos de treinamento, parte por parte. */
  function estadoTreinamento(ficha) {
    const classe = classeDaFicha(ficha);
    const total = pontosTreinamentoTotal(ficha);
    const gastos = pontosTreinamentoGastos(ficha);
    return {
      classeDefinida: Boolean(classe),
      daClasse: classe ? numero(classe.pontosTreinamento) : 0,
      intelecto: totalAtributo(ficha, 'int'),
      bonus: numero(ficha.pontosTreinamento && ficha.pontosTreinamento.bonus),
      total: classe ? total : null, // null = desconhecido (sem classe)
      gastos: gastos,
      restantes: total - gastos,
      excedido: Boolean(classe) && gastos > total
    };
  }

  /* ------------------------------------------------------------------------
     Defesa e derivados
     ------------------------------------------------------------------------ */

  function defesaSalva(ficha) {
    return ficha.defesa || {};
  }

  /**
   * Defesa parte por parte:
   * base + AGI (total) + proteções equipadas (inventário) + bônus de proteção
   * manual + outros − sobrecarga + condições (modificadoresCondicoes).
   */
  function composicaoDefesa(ficha) {
    const regras = OP.data.regrasDefesa;
    const defesa = defesaSalva(ficha);
    const composicao = {
      base: regras.base,
      atributo: regras.atributo,
      valorAtributo: totalAtributo(ficha, regras.atributo),
      protecoesInventario: defesaProtecoes(ficha),
      protecao: numero(defesa.protecao && defesa.protecao.defesa), // bônus de proteção manual
      outros: numero(defesa.outros),
      sobrecarga: sobrecarregado(ficha) ? numero(OP.data.config.sobrecarga.defesa) : 0,
      condicoes: modificadoresCondicoes(ficha).defesa // soma das condições ativas (sugestões a conferir)
    };
    composicao.total = composicao.base + composicao.valorAtributo + composicao.protecoesInventario +
      composicao.protecao + composicao.outros - composicao.sobrecarga + composicao.condicoes;
    return composicao;
  }

  /**
   * Defesa = 10 + AGI (total) + proteções equipadas + bônus de proteção manual
   * + outros − (sobrecarregado ? config.sobrecarga.defesa : 0).
   */
  function defesaTotal(ficha) {
    return composicaoDefesa(ficha).total;
  }

  function definicaoReacao(idReacao) {
    return OP.data.reacoes.find(function (reacao) { return reacao.id === idReacao; }) || null;
  }

  /** A reação fica disponível com a perícia dela no grau mínimo (Treinado). */
  function reacaoDisponivel(ficha, idReacao) {
    const definicao = definicaoReacao(idReacao);
    return Boolean(definicao) && grauEfetivo(ficha, definicao.pericia) >= definicao.grauMinimo;
  }

  /** Bônus da perícia de uma reação (periciaBonus: grau + outros, sem atributo). */
  function bonusDaReacao(ficha, idReacao) {
    return periciaBonus(ficha, definicaoReacao(idReacao).pericia);
  }

  /** Bloqueio: com Fortitude treinada, reduz o dano de um ataque pelo bônus de Fortitude. */
  function bloqueio(ficha) {
    const disponivel = reacaoDisponivel(ficha, 'bloqueio');
    return {
      disponivel: disponivel,
      reducao: disponivel ? Math.max(0, bonusDaReacao(ficha, 'bloqueio')) : 0
    };
  }

  /** Esquiva: com Reflexos treinada, soma o bônus de Reflexos à Defesa contra um ataque. */
  function esquiva(ficha) {
    const disponivel = reacaoDisponivel(ficha, 'esquiva');
    const bonus = disponivel ? bonusDaReacao(ficha, 'esquiva') : 0;
    return {
      disponivel: disponivel,
      bonus: bonus,
      defesaComEsquiva: defesaTotal(ficha) + bonus
    };
  }

  /** Contra-ataque: só a disponibilidade (Luta treinada). */
  function contraAtaque(ficha) {
    return { disponivel: reacaoDisponivel(ficha, 'contraAtaque') };
  }

  /**
   * Deslocamento = config.deslocamentoBase + bônus manual (metros)
   * − (sobrecarregado ? config.sobrecarga.deslocamento : 0), nunca abaixo de 0.
   * Depois da sobrecarga, multiplica pelo deslocamento das condições
   * (0,5 = metade; 0 = não se move).
   * Só quadrados inteiros contam (ex.: 10 m = 6 quadrados). CONFERIR NO LIVRO
   */
  function deslocamento(ficha) {
    const config = OP.data.config;
    const base = numero(config.deslocamentoBase);
    const bonus = numero(defesaSalva(ficha).deslocamentoBonus);
    const sobrecarga = sobrecarregado(ficha) ? numero(config.sobrecarga.deslocamento) : 0;
    const multiplicador = modificadoresCondicoes(ficha).deslocamentoMult;
    const metrosAntes = Math.max(0, base + bonus - sobrecarga);
    const metros = Math.round(metrosAntes * multiplicador * 100) / 100;
    // a pequena folga evita erro de arredondamento (ex.: 10,5 / 1,5)
    const quadrados = Math.floor(metros / OP.data.regrasDefesa.metrosPorQuadrado + 1e-9);
    return {
      base: base, bonus: bonus, sobrecarga: sobrecarga, metros: metros, quadrados: quadrados,
      multiplicador: multiplicador, metrosAntesCondicoes: metrosAntes
    };
  }

  /** Dados e bônus de uma perícia (para Iniciativa, Fortitude, Reflexos e Vontade). */
  function derivadasPericia(ficha, idPericia) {
    return {
      dados: periciaDados(ficha, idPericia),
      bonus: periciaBonus(ficha, idPericia)
    };
  }

  /** Quantos tipos de dano têm resistência diferente de 0. */
  function resistenciasAtivas(ficha) {
    const resistencias = defesaSalva(ficha).resistencias || {};
    return OP.data.tiposDano.filter(function (tipo) {
      return numero(resistencias[tipo.id]) !== 0;
    }).length;
  }

  /* ------------------------------------------------------------------------
     Testes e ataques
     ------------------------------------------------------------------------ */

  /**
   * Teste de uma perícia com modificador de dados:
   * { dados: { qtd, modo }, bonus } (bonus = periciaBonus, sem o atributo).
   */
  function testePericia(ficha, idPericia, modDados) {
    const atributo = atributoDaPericia(ficha, idPericia);
    return {
      dados: resolverReserva(atributo ? totalAtributo(ficha, atributo) : 0, numero(modDados) + dadosCondicoesPericia(ficha, idPericia)),
      bonus: periciaBonus(ficha, idPericia)
    };
  }

  /**
   * Teste de ataque: o atributo vem da perícia do ataque (padrão ou o escolhido
   * na ficha) e bonus = periciaBonus(perícia) + testeBonus do ataque.
   */
  function ataqueTeste(ficha, ataque, modDados) {
    const teste = testePericia(ficha, ataque.pericia, modDados || 0);
    return {
      dados: teste.dados,
      bonus: teste.bonus + numero(ataque.testeBonus)
    };
  }

  /** Crítico quando o d20 escolhido alcança a margem (19/x2 → 19 ou 20). */
  function ehCritico(escolhido, critMargem) {
    return numero(escolhido) >= numero(critMargem);
  }

  function ataquesDaFicha(ficha) {
    if (!Array.isArray(ficha.ataques)) return [];
    return ficha.ataques.filter(function (ataque) { return ataque !== null && typeof ataque === 'object'; });
  }

  function periciaDeAtaqueValida(idPericia) {
    return OP.data.periciasAtaque.some(function (p) { return p.id === idPericia; });
  }

  function tipoDanoValido(idTipo) {
    return OP.data.tiposDano.some(function (t) { return t.id === idTipo; });
  }

  /** Item do inventário (tipo "arma") ligado a um ataque, ou null. */
  function armaDoAtaque(ficha, ataque) {
    if (ataque.itemId === null || ataque.itemId === undefined) return null;
    return itensDaFicha(ficha).find(function (item) {
      return item.id === ataque.itemId && item.tipo === 'arma';
    }) || null;
  }

  /**
   * Tudo o que a interface precisa de cada ataque (mesma ordem de ficha.ataques):
   * teste (dados e bônus), crítico, validade da fórmula de dano e munição.
   * A fórmula é conferida pelo analisador de js/dados.js (sem rolar nada).
   */
  function estadoAtaques(ficha) {
    return ataquesDaFicha(ficha).map(function (ataque) {
      const analise = OP.dados.analisarFormula(ataque.dano);
      const arma = armaDoAtaque(ficha, ataque);
      return {
        teste: ataqueTeste(ficha, ataque, 0),
        critico: { margem: numero(ataque.critMargem), mult: numero(ataque.critMult) },
        danoValido: analise.ok,
        danoErro: analise.ok ? '' : analise.erro,
        semMunicao: ataque.usaMunicao === true && numero(ataque.municao) <= 0,
        nomeArma: arma ? arma.nome : ''
      };
    });
  }

  /**
   * Correções para dados de ataque inválidos: perícia fora de Luta/Pontaria,
   * crítico fora da faixa, tipo de dano desconhecido, munição negativa e
   * arma que não existe mais (ou deixou de ser arma) no inventário.
   */
  function correcoesAtaques(ficha) {
    const regras = OP.data.regrasAtaque;
    const correcoes = [];
    (Array.isArray(ficha.ataques) ? ficha.ataques : []).forEach(function (ataque, indice) {
      if (ataque === null || typeof ataque !== 'object') return;
      const caminho = 'ataques.' + indice;
      if (!periciaDeAtaqueValida(ataque.pericia)) {
        correcoes.push({ caminho: caminho + '.pericia', valor: OP.data.periciasAtaque[0].id });
      }
      const margem = limitarEntre(Math.trunc(numero(ataque.critMargem)) || regras.critMargemMaxima, regras.critMargemMinima, regras.critMargemMaxima);
      if (margem !== ataque.critMargem) correcoes.push({ caminho: caminho + '.critMargem', valor: margem });
      const mult = limitarEntre(Math.trunc(numero(ataque.critMult)) || regras.critMultMinimo, regras.critMultMinimo, regras.critMultMaximo);
      if (mult !== ataque.critMult) correcoes.push({ caminho: caminho + '.critMult', valor: mult });
      if (ataque.tipoDano !== '' && !tipoDanoValido(ataque.tipoDano)) {
        correcoes.push({ caminho: caminho + '.tipoDano', valor: '' });
      }
      const municao = Math.max(0, Math.trunc(numero(ataque.municao)));
      if (municao !== ataque.municao) correcoes.push({ caminho: caminho + '.municao', valor: municao });
      if (ataque.itemId !== null && !armaDoAtaque(ficha, ataque)) {
        correcoes.push({ caminho: caminho + '.itemId', valor: null });
      }
    });
    return correcoes;
  }

  /* ------------------------------------------------------------------------
     Rituais e conjuração
     ------------------------------------------------------------------------ */

  /** Maior círculo liberado pelo NEX (config.circulosPorNex). 0 se nenhum. */
  function circulosLiberados(nex) {
    const tabela = OP.data.config.circulosPorNex;
    const valor = numero(nex);
    let maior = 0;
    Object.keys(tabela).forEach(function (circulo) {
      if (valor >= numero(tabela[circulo])) maior = Math.max(maior, numero(circulo));
    });
    return maior;
  }

  /** A afinidade com um elemento só pode ser escolhida a partir de config.nexAfinidade. */
  function afinidadeLiberada(nex) {
    return numero(nex) >= numero(OP.data.config.nexAfinidade);
  }

  /**
   * DT para resistir a qualquer habilidade = base + limite de PE por turno
   * (se somaLimitePE) + atributo (TOTAL). Regra em config.dtRitual,
   * confirmada pelo livro (ex.: FOR 2 e NEX 5% → 10 + 1 + 2 = 13).
   * Devolve { total, partes: { base, limitePE, atributo }, idAtributo }.
   */
  function dtHabilidade(ficha, atributoId) {
    const regra = OP.data.config.dtRitual;
    const partes = {
      base: numero(regra.base),
      limitePE: regra.somaLimitePE ? limitePEporTurno(ficha) : 0,
      atributo: ehAtributoValido(atributoId) ? totalAtributo(ficha, atributoId) : 0
    };
    return {
      total: partes.base + partes.limitePE + partes.atributo,
      partes: partes,
      idAtributo: atributoId
    };
  }

  /**
   * DT dos rituais = DT de habilidade com o atributo de config.dtRitual
   * (Presença) + bônus manual (conjuracao.dtBonus).
   * Ex.: PRE 3 e NEX 5% → 14; PRE 5 e NEX 99% → 35.
   * Devolve { total, partes: { base, limitePE, atributo, bonus }, idAtributo, somaLimitePE }.
   */
  function dtRituais(ficha) {
    const regra = OP.data.config.dtRitual;
    const dt = dtHabilidade(ficha, regra.atributo);
    const bonus = numero(ficha.conjuracao && ficha.conjuracao.dtBonus);
    return {
      total: dt.total + bonus,
      partes: Object.assign({}, dt.partes, { bonus: bonus }),
      idAtributo: regra.atributo,
      somaLimitePE: regra.somaLimitePE === true
    };
  }

  /**
   * DT de cada habilidade (mesma ordem de ficha.habilidades):
   * { dt: null } sem atributoDT; senão { dt, partes: { base, limitePE, atributo, bonus }, idAtributo }.
   */
  function estadoHabilidades(ficha) {
    const habilidades = Array.isArray(ficha.habilidades) ? ficha.habilidades : [];
    return habilidades.map(function (habilidade) {
      if (!habilidade || typeof habilidade !== 'object' || !ehAtributoValido(habilidade.atributoDT)) return { dt: null };
      const dt = dtHabilidade(ficha, habilidade.atributoDT);
      const bonus = numero(habilidade.dtBonus);
      return {
        dt: dt.total + bonus,
        partes: Object.assign({}, dt.partes, { bonus: bonus }),
        idAtributo: habilidade.atributoDT
      };
    });
  }

  function acharPorId(lista, id) {
    return lista.find(function (item) { return item.id === id; }) || null;
  }

  /**
   * Resistência de um ritual para mostrar no cartão.
   * null se o ritual não permite teste (teste vazio ou desconhecido);
   * senão { teste, efeito, dt, nomeTeste, nomeEfeito, resumoEfeito }
   * (ids de OP.data.resistencia; efeito '' se não escolhido; dt = DT de rituais).
   */
  function resumoResistencia(ficha, ritual) {
    const resistencia = ritual && ritual.resistencia;
    if (!resistencia || typeof resistencia !== 'object') return null;
    const teste = acharPorId(OP.data.resistencia.testes, resistencia.teste);
    if (!teste) return null;
    const efeito = acharPorId(OP.data.resistencia.efeitos, resistencia.efeito);
    return {
      teste: teste.id,
      efeito: efeito ? efeito.id : '',
      dt: dtRituais(ficha).total,
      nomeTeste: teste.nome,
      nomeEfeito: efeito ? efeito.nome : '',
      resumoEfeito: efeito ? efeito.resumo : ''
    };
  }

  /**
   * Projeta o efeito de gastar { pe, san, permanente } SEM alterar nada.
   * Usada pelo estado (que aplica tudo de uma vez) e pelo plano de conjuração.
   * - pe > PE atual (ou sem classe com pe > 0): ok false e nada muda;
   * - san sai da SAN atual (nunca abaixo de 0);
   * - permanente soma em recursos.san.perdaPermanente e reduz o SAN máximo;
   *   a SAN atual fica limitada ao novo máximo.
   * Devolve os valores antes/depois e mudancas: [{ caminho, valor }].
   */
  function projetarCustos(ficha, custos) {
    const c = custos || {};
    const pe = inteiroNaoNegativo(c.pe);
    const san = inteiroNaoNegativo(c.san);
    const permanente = inteiroNaoNegativo(c.permanente);
    const limite = limitePEporTurno(ficha);
    const gastoAntes = inteiroNaoNegativo(ficha.conjuracao && ficha.conjuracao.peGastoTurno);
    const estadoPe = estadoRecurso(ficha, 'pe');

    const projecao = {
      ok: true,
      motivo: '',
      pe: pe,
      san: san,
      permanente: permanente,
      peAtual: estadoPe.atual,
      peDepois: estadoPe.atual,
      limite: limite,
      peGastoTurno: gastoAntes,
      peGastoTurnoDepois: gastoAntes,
      avisoLimite: false,
      sanAtual: null,
      sanDepois: null,
      sanMaxDepois: null,
      perdaAntes: 0,
      perdaDepois: 0,
      sanZera: false,
      mudancas: []
    };

    if (pe > 0) {
      if (!estadoPe.classeDefinida) return Object.assign(projecao, { ok: false, motivo: 'Escolha uma classe para calcular o PE.' });
      if (pe > estadoPe.atual) return Object.assign(projecao, { ok: false, motivo: 'PE insuficiente' });
      projecao.peDepois = estadoPe.atual - pe;
      projecao.peGastoTurnoDepois = gastoAntes + pe;
      projecao.avisoLimite = projecao.peGastoTurnoDepois > limite;
      projecao.mudancas.push(
        { caminho: 'recursos.pe.atual', valor: projecao.peDepois },
        { caminho: 'conjuracao.peGastoTurno', valor: projecao.peGastoTurnoDepois }
      );
    }

    if (san > 0 || permanente > 0) {
      const composicao = composicaoRecurso(ficha, 'san');
      projecao.perdaAntes = composicao.perdaPermanente;
      projecao.perdaDepois = composicao.perdaPermanente + permanente;
      if (permanente > 0) projecao.mudancas.push({ caminho: 'recursos.san.perdaPermanente', valor: projecao.perdaDepois });

      if (composicao.classeDefinida) {
        const estadoSan = estadoRecurso(ficha, 'san');
        const semPerda = composicao.inicial + composicao.ganhoNex + composicao.bonus;
        projecao.sanAtual = estadoSan.atual;
        projecao.sanMaxDepois = Math.max(0, semPerda - projecao.perdaDepois);
        projecao.sanDepois = limitarEntre(estadoSan.atual - san, 0, projecao.sanMaxDepois);
        projecao.sanZera = projecao.sanDepois === 0;
        // SAN atual vazia (null) segue o máximo sozinha; só grava se mudou de fato.
        const salvoAtual = atualSalvo((ficha.recursos.san || {}).atual);
        if (san > 0 || salvoAtual !== null) projecao.mudancas.push({ caminho: 'recursos.san.atual', valor: projecao.sanDepois });
      }
    }
    return projecao;
  }

  /**
   * Quanto custaria conjurar o ritual na forma indicada, SEM aplicar nada.
   * Usa o custo TOTAL da forma (custoForma).
   * Ritual de Medo: perde Sanidade igual ao custo total em PE
   * (config.medo.sanPorCusto) e Sanidade permanente conforme a forma
   * (config.medo.perdaPermanente).
   * CONFERIR NO LIVRO: interpretação (perda igual ao custo nas três formas).
   * Devolve { ok, motivo, pe, san, permanente, medo, forma, avisos, ... } (+ a
   * projeção de projetarCustos). Forma inativa ou PE insuficiente: ok false.
   * avisos (círculo exigido, afinidade) não bloqueiam: a tela pede confirmação.
   */
  function planoConjuracao(ficha, ritual, idForma) {
    const medo = ehRitualDeMedo(ritual);
    const forma = formaDoRitual(ritual, idForma);
    if (!forma) {
      return { ok: false, motivo: 'Esta forma não está ativa neste ritual.', pe: 0, san: 0, permanente: 0, medo: medo, forma: idForma, avisos: [], mudancas: [] };
    }
    const regra = OP.data.config.medo;
    const custo = custoForma(ritual, idForma);
    const projecao = projetarCustos(ficha, {
      pe: custo,
      san: medo && regra.sanPorCusto ? custo : 0,
      permanente: medo ? inteiroNaoNegativo(regra.perdaPermanente[idForma]) : 0
    });
    return Object.assign(projecao, { medo: medo, forma: idForma, avisos: avisosForma(ficha, ritual, idForma) });
  }

  /** Custo de um círculo (config.custoRitualPorCirculo: 1º = 1, 2º = 3, 3º = 6, 4º = 10); 0 se não houver. */
  function custoSugeridoRitual(circulo) {
    return numero(OP.data.config.custoRitualPorCirculo[circulo]);
  }

  /** Círculo válido (1 a 4); outros valores viram o 1º. */
  function circuloValido(valor) {
    const circulos = OP.data.circulosRitual;
    const n = Math.trunc(numero(valor));
    return circulos.indexOf(n) !== -1 ? n : circulos[0];
  }

  /** Custo base do ritual: o digitado (custoBase) ou, se null, o do círculo. */
  function custoBaseRitual(ritual) {
    const base = ritual && ritual.custoBase;
    if (typeof base === 'number' && Number.isFinite(base)) return inteiroNaoNegativo(base);
    return custoSugeridoRitual(circuloValido(ritual && ritual.circulo));
  }

  /**
   * Custo TOTAL de uma forma: Padrão = custo base; Discente e Verdadeira =
   * custo base + custoAdicional (o "+N PE" impresso).
   * Ex.: Arma Atroz (1º): Padrão 1, Discente (+2) 3, Verdadeiro (+5) 6.
   */
  function custoForma(ritual, idForma) {
    const base = custoBaseRitual(ritual);
    if (idForma === 'padrao') return base;
    const forma = ritual && ritual.formas && ritual.formas[idForma];
    if (!forma || typeof forma !== 'object') return base;
    return base + inteiroNaoNegativo(forma.custoAdicional);
  }

  /**
   * "+N PE" sugerido para uma forma que requer um círculo: o custo total de
   * uma forma é o custo do círculo exigido, então N = custo do círculo − custo base.
   */
  function custoAdicionalSugerido(ritual, requerCirculo) {
    return Math.max(0, custoSugeridoRitual(circuloValido(requerCirculo)) - custoBaseRitual(ritual));
  }

  /**
   * Avisos (sem bloquear) de uma forma Discente/Verdadeira:
   * - 'circulo': o círculo exigido passa do que o NEX libera;
   * - 'afinidade': a forma requer afinidade e o personagem não tem afinidade
   *   desenvolvida com o elemento do ritual.
   * Devolve [{ tipo, texto }].
   */
  function avisosForma(ficha, ritual, idForma) {
    if (idForma === 'padrao') return [];
    const forma = ritual && ritual.formas && ritual.formas[idForma];
    if (!forma || typeof forma !== 'object') return [];
    const avisos = [];
    const requer = circuloValido(forma.requerCirculo);
    const liberados = circulosLiberados(ficha.identificacao.nex);
    if (requer > liberados) {
      avisos.push({
        tipo: 'circulo',
        texto: 'Requer o ' + requer + 'º círculo, e o NEX libera ' + (liberados ? 'até o ' + liberados + 'º' : 'nenhum') + '.'
      });
    }
    if (forma.requerAfinidade === true) {
      const conjuracao = ficha.conjuracao || {};
      const temAfinidade = conjuracao.afinidadeDesenvolvida === true &&
        typeof conjuracao.elementoConectado === 'string' && conjuracao.elementoConectado === ritual.elemento;
      if (!temAfinidade) {
        const elemento = acharPorId(OP.data.elementos, ritual.elemento);
        avisos.push({
          tipo: 'afinidade',
          texto: 'Requer afinidade' + (elemento ? ' com ' + elemento.nome : ' com o elemento do ritual') + ', e o personagem não a desenvolveu.'
        });
      }
    }
    return avisos;
  }

  /** O círculo do ritual passa do que o NEX da ficha libera? (só aviso) */
  function ritualAlemDoCirculo(ficha, ritual) {
    return numero(ritual.circulo) > circulosLiberados(ficha.identificacao.nex);
  }

  function elementoValido(idElemento) {
    return OP.data.elementos.some(function (e) { return e.id === idElemento; });
  }

  /** Elementos que podem ser afinidade (não existe afinidade com Medo). */
  function elementosAfinidade() {
    return OP.data.elementos.filter(function (e) { return e.afinidadePossivel === true; });
  }

  /** Elementos que um ritual pode ter (todos, inclusive Medo). */
  function elementosRitual() {
    return OP.data.elementos.slice();
  }

  function afinidadeValida(idElemento) {
    return elementosAfinidade().some(function (e) { return e.id === idElemento; });
  }

  function ehRitualDeMedo(ritual) {
    return Boolean(ritual) && ritual.elemento === 'medo';
  }

  /** Forma de um ritual, ou null se não existir / não estiver ativa. */
  function formaDoRitual(ritual, idForma) {
    const formas = ritual && ritual.formas;
    const forma = formas && formas[idForma];
    if (!forma || typeof forma !== 'object') return null;
    if (idForma !== 'padrao' && forma.ativa !== true) return null;
    return forma;
  }

  /**
   * Estado da conjuração para a tela: DT, círculos, elemento conectado,
   * afinidade e PE gasto no turno.
   */
  function estadoConjuracao(ficha) {
    const nex = ficha.identificacao.nex;
    const conjuracao = ficha.conjuracao || {};
    const limite = limitePEporTurno(ficha);
    const gasto = Math.max(0, numero(conjuracao.peGastoTurno));
    const conectado = afinidadeValida(conjuracao.elementoConectado) ? conjuracao.elementoConectado : null;
    return {
      dt: dtRituais(ficha),
      circulosLiberados: circulosLiberados(nex),
      afinidadeLiberada: afinidadeLiberada(nex),
      nexAfinidade: numero(OP.data.config.nexAfinidade),
      elementoConectado: conectado,
      afinidadeDesenvolvida: Boolean(conectado) && conjuracao.afinidadeDesenvolvida === true,
      limitePE: limite,
      peGastoTurno: gasto,
      passouLimite: gasto > limite
    };
  }

  /**
   * Para cada ritual (mesma ordem de ficha.rituais): aviso de círculo,
   * resistência (resumoResistencia), se é de Medo, custo base e, por forma,
   * o custo TOTAL (com a Sanidade, nos rituais de Medo), os avisos de
   * círculo/afinidade e se o dano é uma fórmula válida.
   */
  function estadoRituais(ficha) {
    const rituais = Array.isArray(ficha.rituais) ? ficha.rituais : [];
    const regraMedo = OP.data.config.medo;
    return rituais.map(function (ritual) {
      const medo = ehRitualDeMedo(ritual);
      const formas = {};
      OP.data.formasRitual.forEach(function (definicao) {
        const forma = (ritual.formas && ritual.formas[definicao.id]) || {};
        const texto = String(forma.dano || '').trim();
        const analise = texto ? OP.dados.analisarFormula(texto) : { ok: false, erro: '' };
        const custo = custoForma(ritual, definicao.id);
        formas[definicao.id] = {
          ativa: definicao.id === 'padrao' || forma.ativa === true,
          custo: custo,
          adicional: definicao.id === 'padrao' ? 0 : inteiroNaoNegativo(forma.custoAdicional),
          requerCirculo: definicao.id === 'padrao' ? null : circuloValido(forma.requerCirculo),
          requerAfinidade: definicao.id !== 'padrao' && forma.requerAfinidade === true,
          avisos: avisosForma(ficha, ritual, definicao.id),
          san: medo && regraMedo.sanPorCusto ? custo : 0,
          permanente: medo ? inteiroNaoNegativo(regraMedo.perdaPermanente[definicao.id]) : 0,
          temDano: texto !== '',
          danoValido: texto !== '' && analise.ok,
          danoErro: texto !== '' && !analise.ok ? analise.erro : ''
        };
      });
      return {
        alemDoCirculo: ritualAlemDoCirculo(ficha, ritual),
        medo: medo,
        resistencia: resumoResistencia(ficha, ritual),
        custoBase: custoBaseRitual(ritual),
        custoBaseAuto: custoSugeridoRitual(circuloValido(ritual.circulo)),
        custoBaseManual: typeof ritual.custoBase === 'number',
        formas: formas
      };
    });
  }

  /**
   * Correções de dados inválidos: elemento conectado desconhecido ou que não
   * pode ser afinidade (Medo), afinidade desenvolvida sem elemento conectado,
   * PE gasto negativo, ritual com círculo fora de 1–4, elemento ou resistência
   * desconhecidos, custos negativos, círculo exigido fora de 1–4, habilidade
   * com fonte, ativação ou atributo de DT desconhecidos.
   */
  function correcoesConjuracao(ficha) {
    const correcoes = [];
    const conjuracao = ficha.conjuracao || {};
    if (conjuracao.elementoConectado !== null && !afinidadeValida(conjuracao.elementoConectado)) {
      correcoes.push({ caminho: 'conjuracao.elementoConectado', valor: null });
    }
    // A afinidade só se desenvolve com um elemento conectado.
    if (conjuracao.afinidadeDesenvolvida === true && !afinidadeValida(conjuracao.elementoConectado)) {
      correcoes.push({ caminho: 'conjuracao.afinidadeDesenvolvida', valor: false });
    }
    const gasto = Math.max(0, Math.trunc(numero(conjuracao.peGastoTurno)));
    if (gasto !== conjuracao.peGastoTurno) correcoes.push({ caminho: 'conjuracao.peGastoTurno', valor: gasto });

    const circulos = OP.data.circulosRitual;
    (Array.isArray(ficha.rituais) ? ficha.rituais : []).forEach(function (ritual, indice) {
      if (ritual === null || typeof ritual !== 'object') return;
      const caminho = 'rituais.' + indice;
      const circulo = limitarEntre(Math.trunc(numero(ritual.circulo)) || circulos[0], circulos[0], circulos[circulos.length - 1]);
      if (circulo !== ritual.circulo) correcoes.push({ caminho: caminho + '.circulo', valor: circulo });
      if (ritual.elemento !== '' && !elementoValido(ritual.elemento)) correcoes.push({ caminho: caminho + '.elemento', valor: '' });
      const resistencia = ritual.resistencia;
      if (!resistencia || typeof resistencia !== 'object' || Array.isArray(resistencia)) {
        correcoes.push({ caminho: caminho + '.resistencia', valor: { teste: '', efeito: '' } });
      } else {
        if (resistencia.teste !== '' && !acharPorId(OP.data.resistencia.testes, resistencia.teste)) {
          correcoes.push({ caminho: caminho + '.resistencia.teste', valor: '' });
        }
        if (resistencia.efeito !== '' && !acharPorId(OP.data.resistencia.efeitos, resistencia.efeito)) {
          correcoes.push({ caminho: caminho + '.resistencia.efeito', valor: '' });
        }
      }
      if (ritual.custoBase !== null) {
        const base = typeof ritual.custoBase === 'number' && Number.isFinite(ritual.custoBase) ? inteiroNaoNegativo(ritual.custoBase) : null;
        if (base !== ritual.custoBase) correcoes.push({ caminho: caminho + '.custoBase', valor: base });
      }
      OP.data.formasRitual.forEach(function (definicao) {
        const forma = ritual.formas && ritual.formas[definicao.id];
        if (!forma || typeof forma !== 'object' || definicao.id === 'padrao') return;
        const caminhoForma = caminho + '.formas.' + definicao.id;
        const adicional = inteiroNaoNegativo(forma.custoAdicional);
        if (adicional !== forma.custoAdicional) correcoes.push({ caminho: caminhoForma + '.custoAdicional', valor: adicional });
        const requer = circuloValido(forma.requerCirculo);
        if (requer !== forma.requerCirculo) correcoes.push({ caminho: caminhoForma + '.requerCirculo', valor: requer });
      });
    });

    (Array.isArray(ficha.habilidades) ? ficha.habilidades : []).forEach(function (habilidade, indice) {
      if (habilidade === null || typeof habilidade !== 'object') return;
      const caminho = 'habilidades.' + indice;
      if (!OP.data.fontesHabilidade.some(function (f) { return f.id === habilidade.fonte; })) {
        correcoes.push({ caminho: caminho + '.fonte', valor: 'outro' });
      }
      if (habilidade.ativacao !== '' && !OP.data.ativacoes.some(function (a) { return a.id === habilidade.ativacao; })) {
        correcoes.push({ caminho: caminho + '.ativacao', valor: '' });
      }
      const custo = Math.max(0, Math.trunc(numero(habilidade.custoPE)));
      if (custo !== habilidade.custoPE) correcoes.push({ caminho: caminho + '.custoPE', valor: custo });
      if (habilidade.atributoDT !== null && !ehAtributoValido(habilidade.atributoDT)) {
        correcoes.push({ caminho: caminho + '.atributoDT', valor: null });
      }
    });
    return correcoes;
  }

  /* ------------------------------------------------------------------------
     Identificação
     ------------------------------------------------------------------------ */

  /** O maior NEX da tabela que não passa do valor (ou o menor da tabela). */
  function nexValido(valor) {
    const n = numero(valor);
    let escolhido = OP.data.nex[0];
    OP.data.nex.forEach(function (opcao) {
      if (opcao <= n) escolhido = opcao;
    });
    return escolhido;
  }

  function mesmaLista(a, b) {
    if (!Array.isArray(a) || a.length !== b.length) return false;
    for (let i = 0; i < b.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Correções das escolhas de perícias (as que não valem mais saem):
   * - origem: só vale a escolha do tipo da origem atual (livre, conjunto ou
   *   elemento); livres limitadas a escolha.qtd e às perícias permitidas;
   * - classe: uma escolha por grupo, sempre uma das opções do grupo (ou null).
   */
  function correcoesEscolhas(ficha) {
    const correcoes = [];
    const identificacao = ficha.identificacao || {};
    const escolhas = identificacao.escolhas || {};
    const salvas = escolhas.origem || {};
    const origem = origemDados(identificacao.origem);
    const escolha = origem && origem.escolha ? origem.escolha : null;
    const tipo = escolha ? escolha.tipo : null;

    const livres = Array.isArray(salvas.livres) ? salvas.livres : [];
    const livresCorretas = [];
    if (tipo === 'livre') {
      const permitidas = periciasLivresPermitidas(origem);
      const qtd = Math.min(livres.length, Math.max(0, Math.trunc(numero(escolha.qtd))));
      for (let i = 0; i < qtd; i++) livresCorretas.push(permitidas.indexOf(livres[i]) !== -1 ? livres[i] : null);
    }
    if (!mesmaLista(salvas.livres, livresCorretas)) {
      correcoes.push({ caminho: 'identificacao.escolhas.origem.livres', valor: livresCorretas });
    }
    const conjunto = tipo === 'conjunto' && (salvas.conjunto === 0 || salvas.conjunto === 1) ? salvas.conjunto : null;
    if (conjunto !== salvas.conjunto) correcoes.push({ caminho: 'identificacao.escolhas.origem.conjunto', valor: conjunto });
    const elemento = tipo === 'elemento' && typeof salvas.elemento === 'string' && temChave(escolha.mapa, salvas.elemento) ? salvas.elemento : null;
    if (elemento !== salvas.elemento) correcoes.push({ caminho: 'identificacao.escolhas.origem.elemento', valor: elemento });

    const classe = classeDaFicha(ficha);
    const grupos = escolhas.classe && Array.isArray(escolhas.classe.grupos) ? escolhas.classe.grupos : null;
    const opcoes = classe && classe.pericias && Array.isArray(classe.pericias.escolhas) ? classe.pericias.escolhas : [];
    const corretos = opcoes.map(function (lista, indice) {
      return grupos && lista.indexOf(grupos[indice]) !== -1 ? grupos[indice] : null;
    });
    if (!mesmaLista(grupos, corretos)) correcoes.push({ caminho: 'identificacao.escolhas.classe.grupos', valor: corretos });
    return correcoes;
  }

  /**
   * Correções de identificação: classe desconhecida, NEX fora da tabela,
   * estágio fora de 1–máximo, origem/trilha/versatilidade que não existem (ou
   * que não são da classe) e escolhas de perícias que não valem mais.
   */
  function correcoesIdentificacao(ficha) {
    const correcoes = [];
    const identificacao = ficha.identificacao || {};
    const classe = classeDaFicha(ficha);
    if (identificacao.classe !== '' && !classe) {
      correcoes.push({ caminho: 'identificacao.classe', valor: '' });
    }
    if (OP.data.nex.indexOf(identificacao.nex) === -1) {
      correcoes.push({ caminho: 'identificacao.nex', valor: nexValido(identificacao.nex) });
    }
    const estagio = estagioDaFicha(ficha);
    if (estagio !== identificacao.estagio) correcoes.push({ caminho: 'identificacao.estagio', valor: estagio });

    if (identificacao.origem !== '' && identificacao.origem !== 'outra' && !origemDados(identificacao.origem)) {
      correcoes.push({ caminho: 'identificacao.origem', valor: '' });
    }
    const trilha = trilhaDados(identificacao.trilha);
    if (identificacao.trilha !== '' && identificacao.trilha !== 'outra' && !(trilha && classe && trilha.classe === classe.id)) {
      correcoes.push({ caminho: 'identificacao.trilha', valor: '' });
    }
    const versatilidade = trilhaDados(identificacao.versatilidade);
    const versatilidadeOk = versatilidade && classe && versatilidade.classe === classe.id && versatilidade.id !== identificacao.trilha;
    if (identificacao.versatilidade !== '' && !versatilidadeOk) {
      correcoes.push({ caminho: 'identificacao.versatilidade', valor: '' });
    }
    return correcoes.concat(correcoesEscolhas(ficha));
  }

  /* ------------------------------------------------------------------------
     Origem, classe, trilha e progressão (para a tela)
     ------------------------------------------------------------------------ */

  /** Trilha escolhida na ficha, se for da classe dela; senão null. */
  function trilhaDaFicha(ficha) {
    const identificacao = ficha.identificacao || {};
    const trilha = trilhaDados(identificacao.trilha);
    return trilha && trilha.classe === identificacao.classe ? trilha : null;
  }

  /** Habilidades de uma trilha em ordem: [{ marco, nome, liberada }] (marco = NEX ou estágio). */
  function habilidadesDeTrilha(trilha, nivel) {
    return Object.keys(trilha.habilidades).map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; })
      .map(function (marco) {
        return { marco: marco, nome: trilha.habilidades[String(marco)], liberada: marco <= nivel };
      });
  }

  /**
   * Habilidades da trilha da ficha, liberadas conforme o NEX (ou o estágio,
   * no Sobrevivente): [{ marco, nome, liberada }]. Sem trilha: [].
   */
  function habilidadesTrilha(ficha) {
    const trilha = trilhaDaFicha(ficha);
    return trilha ? habilidadesDeTrilha(trilha, nivelProgressao(ficha)) : [];
  }

  /** A versatilidade (NEX 50%) já foi alcançada? */
  function versatilidadeLiberada(ficha) {
    return Boolean(classeDaFicha(ficha)) && itensAlcancados(ficha, 'versatilidade') > 0;
  }

  /**
   * Versatilidade: a 1ª habilidade (NEX 10%) de outra trilha da classe.
   * { trilha, nomeTrilha, marco, nome, liberada } ou null.
   */
  function habilidadeVersatilidade(ficha) {
    const identificacao = ficha.identificacao || {};
    const trilha = trilhaDados(identificacao.versatilidade);
    if (!trilha || trilha.classe !== identificacao.classe || trilha.id === identificacao.trilha) return null;
    const primeira = habilidadesDeTrilha(trilha, Infinity)[0];
    if (!primeira) return null;
    return { trilha: trilha.id, nomeTrilha: trilha.nome, marco: primeira.marco, nome: primeira.nome, liberada: versatilidadeLiberada(ficha) };
  }

  /** Tudo o que a tela precisa de origem, classe e trilha (dados de jogo só para leitura). */
  function estadoIdentidade(ficha) {
    const identificacao = ficha.identificacao || {};
    const origem = origemDados(identificacao.origem);
    return {
      unidade: unidadeProgressao(ficha),
      nivel: nivelProgressao(ficha),
      classe: classeDaFicha(ficha),
      origem: origem,
      origemOutra: identificacao.origem === 'outra',
      periciasLivres: origem && origem.escolha && origem.escolha.tipo === 'livre' ? periciasLivresPermitidas(origem) : [],
      trilha: trilhaDaFicha(ficha),
      trilhaOutra: identificacao.trilha === 'outra',
      habilidadesTrilha: habilidadesTrilha(ficha),
      versatilidadeLiberada: versatilidadeLiberada(ficha),
      versatilidade: habilidadeVersatilidade(ficha),
      concedidas: periciasConcedidasDetalhe(ficha),
      profissaoSugerida: origem && origem.profissao ? origem.profissao : ''
    };
  }

  /**
   * Painel "Progressão da classe": linhas da tabela (alcançadas e a atual),
   * próximo marco e contadores informativos (poderes, aumentos de atributo,
   * graus de treinamento e, no Ocultista, rituais concedidos).
   */
  function estadoProgressao(ficha) {
    const classe = classeDaFicha(ficha);
    const nivel = nivelProgressao(ficha);
    const linhas = classe ? progressaoDaFicha(ficha) : [];
    const alcancadas = linhas.filter(function (linha) { return nivelDaLinha(linha) <= nivel; });
    const nivelAtual = alcancadas.length ? nivelDaLinha(alcancadas[alcancadas.length - 1]) : null;
    const trilhaPorMarco = {};
    habilidadesTrilha(ficha).forEach(function (h) { trilhaPorMarco[h.marco] = h.nome; });
    const habilidades = Array.isArray(ficha.habilidades) ? ficha.habilidades : [];
    const rituais = Array.isArray(ficha.rituais) ? ficha.rituais : [];
    return {
      classeDefinida: Boolean(classe),
      unidade: unidadeProgressao(ficha),
      nivel: nivel,
      linhas: linhas.map(function (linha) {
        const n = nivelDaLinha(linha);
        return {
          nivel: n,
          alcancada: n <= nivel,
          atual: n === nivelAtual,
          itens: linha.itens.map(function (item) {
            return { tipo: item.tipo, rotulo: item.rotulo, trilha: item.tipo === 'trilha' ? trilhaPorMarco[n] || '' : '' };
          })
        };
      }),
      proximo: classe ? proximoMarco(ficha) : null,
      poderes: {
        liberados: poderesLiberados(ficha),
        cadastrados: habilidades.filter(function (h) { return h && h.fonte === 'poder'; }).length
      },
      aumentos: { liberados: aumentosAtributoLiberados(ficha), usados: aumentosAtributoUsados(ficha) },
      graus: estadoGraus(ficha),
      rituais: classe && typeof classe.rituaisIniciais === 'number'
        ? { concedidos: rituaisConcedidosClasse(ficha), cadastrados: rituais.length }
        : null
    };
  }

  /* ------------------------------------------------------------------------
     Etapa 10 · Condições e estados
     Tudo puro. O catálogo (OP.data.condicoes) é lido a cada chamada, nunca
     guardado: os testes trocam o catálogo temporariamente.
     Os efeitos do catálogo são SUGESTÕES a conferir (campo "conferir").
     ------------------------------------------------------------------------ */

  const IDS_ATRIBUTOS_COND = ['agi', 'for', 'int', 'pre', 'vig'];

  function condicoesSalvas(ficha) {
    const c = ficha && ficha.condicoes;
    return c !== null && typeof c === 'object' && !Array.isArray(c) ? c : {};
  }

  /** Lista de condições ativas: aceita a ficha, o objeto ficha.condicoes ou a própria lista. */
  function listaAtivas(entrada) {
    let lista = entrada;
    if (entrada && !Array.isArray(entrada) && typeof entrada === 'object') {
      lista = entrada.condicoes !== undefined && entrada.ativas === undefined ? entrada.condicoes.ativas : entrada.ativas;
    }
    return (Array.isArray(lista) ? lista : []).filter(function (item) {
      return item !== null && typeof item === 'object' && typeof item.id === 'string';
    });
  }

  function definicaoCondicao(id) {
    return (OP.data.condicoes || []).find(function (c) { return c.id === id; }) || null;
  }

  /**
   * Ids das condições em vigor, já com as implicadas (campo `implica`),
   * sem repetir e sem laço infinito. A condição "personalizada" não entra
   * (cada uma tem os próprios números).
   */
  function condicoesEfetivas(condicoes) {
    const vistos = Object.create(null);
    const resultado = [];
    function visitar(id) {
      if (vistos[id]) return;
      const definicao = definicaoCondicao(id);
      if (!definicao) return;
      vistos[id] = true;
      resultado.push(id);
      (Array.isArray(definicao.implica) ? definicao.implica : []).forEach(visitar);
    }
    listaAtivas(condicoes).forEach(function (item) { visitar(item.id); });
    return resultado;
  }

  function siglaAtributoCond(id) {
    const atributo = (OP.data.atributos || []).find(function (a) { return a.id === id; });
    return atributo ? atributo.sigla : String(id).toUpperCase();
  }

  function textoMenos(n) {
    return (n < 0 ? '−' : '+') + Math.abs(n);
  }

  function formatarMult(mult) {
    return String(Math.round(mult * 100) / 100).replace('.', ',');
  }

  /** Resumo dos números de um efeito: "−1d20 em perícias; Defesa −2". '' se não houver efeito. */
  function resumoEfeitos(efeitos) {
    if (!efeitos || typeof efeitos !== 'object') return '';
    const partes = [];
    const dadosPericias = numero(efeitos.dadosPericias);
    if (dadosPericias) partes.push(textoMenos(dadosPericias) + 'd20 em perícias');
    const atributos = efeitos.dadosAtributos && typeof efeitos.dadosAtributos === 'object' ? efeitos.dadosAtributos : {};
    const porValor = {};
    IDS_ATRIBUTOS_COND.forEach(function (id) {
      const valor = numero(atributos[id]);
      if (valor) (porValor[valor] = porValor[valor] || []).push(siglaAtributoCond(id));
    });
    Object.keys(porValor).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (valor) {
      const siglas = porValor[valor];
      const lista = siglas.length > 1 ? siglas.slice(0, -1).join(', ') + ' e ' + siglas[siglas.length - 1] : siglas[0];
      partes.push(textoMenos(Number(valor)) + 'd20 em testes de ' + lista);
    });
    const defesa = numero(efeitos.defesa);
    if (defesa) partes.push('Defesa ' + textoMenos(defesa));
    if (efeitos.deslocamentoMult !== undefined && efeitos.deslocamentoMult !== null) {
      const mult = numero(efeitos.deslocamentoMult);
      if (mult === 0) partes.push('não se move');
      else if (mult === 0.5) partes.push('deslocamento pela metade');
      else if (mult !== 1) partes.push('deslocamento × ' + formatarMult(mult));
    }
    return partes.join('; ');
  }

  function efeitosDaPersonalizada(p) {
    const dados = p && typeof p === 'object' ? p : {};
    const efeitos = {};
    if (numero(dados.dadosPericias)) efeitos.dadosPericias = numero(dados.dadosPericias);
    if (numero(dados.defesa)) efeitos.defesa = numero(dados.defesa);
    if (dados.deslocamentoMult !== undefined && dados.deslocamentoMult !== null && numero(dados.deslocamentoMult) !== 1) {
      efeitos.deslocamentoMult = numero(dados.deslocamentoMult);
    }
    return efeitos;
  }

  function modificadoresNeutros() {
    return { dadosPericias: 0, dadosAtributos: { agi: 0, for: 0, int: 0, pre: 0, vig: 0 }, defesa: 0, deslocamentoMult: 1, origens: [] };
  }

  /**
   * Junta os efeitos de uma família: por campo (e por atributo) vale o PIOR
   * valor (o menor; para o deslocamento, o menor multiplicador).
   * Devolve { efeitos, contribui: [bool por membro] }.
   */
  function piorDaFamilia(membros) {
    const efeitos = { dadosAtributos: {} };
    const contribui = membros.map(function () { return false; });
    function pior(leitor, vazio) {
      let melhor = null;
      membros.forEach(function (membro) {
        const valor = leitor(membro.efeitos);
        if (valor === undefined) return;
        if (melhor === null || valor < melhor) melhor = valor;
      });
      membros.forEach(function (membro, indice) {
        const valor = leitor(membro.efeitos);
        if (valor !== undefined && valor === melhor) contribui[indice] = true;
      });
      return melhor === null ? vazio : melhor;
    }
    efeitos.dadosPericias = pior(function (e) { return e && e.dadosPericias !== undefined ? numero(e.dadosPericias) : undefined; }, 0);
    efeitos.defesa = pior(function (e) { return e && e.defesa !== undefined ? numero(e.defesa) : undefined; }, 0);
    efeitos.deslocamentoMult = pior(function (e) { return e && e.deslocamentoMult !== undefined ? numero(e.deslocamentoMult) : undefined; }, 1);
    IDS_ATRIBUTOS_COND.forEach(function (id) {
      efeitos.dadosAtributos[id] = pior(function (e) {
        return e && e.dadosAtributos && e.dadosAtributos[id] !== undefined ? numero(e.dadosAtributos[id]) : undefined;
      }, 0);
    });
    return { efeitos: efeitos, contribui: contribui };
  }

  /**
   * Soma dos efeitos de todas as condições da ficha:
   * { dadosPericias, dadosAtributos: {agi,for,int,pre,vig}, defesa, deslocamentoMult,
   *   origens: [{ condicao, texto }] }.
   * - da mesma família não se acumulam (vale a pior); sem família, somam;
   * - cada id conta uma vez (condicoesEfetivas); as personalizadas somam;
   * - com ficha.condicoes.aplicarEfeitos falso, tudo neutro (0 e multiplicador 1).
   */
  function modificadoresCondicoes(ficha) {
    const salvas = condicoesSalvas(ficha);
    const resultado = modificadoresNeutros();
    if (salvas.aplicarEfeitos === false) return resultado;

    const itens = condicoesEfetivas(salvas).map(function (id) {
      const definicao = definicaoCondicao(id);
      return { nome: definicao.nome, familia: definicao.familia || null, efeitos: definicao.efeitos || null };
    });
    listaAtivas(salvas).forEach(function (item) {
      if (item.id !== 'personalizada') return;
      const nome = item.personalizada && String(item.personalizada.nome || '').trim();
      itens.push({ nome: nome || 'Condição personalizada', familia: null, efeitos: efeitosDaPersonalizada(item.personalizada) });
    });

    const aplicados = []; // efeitos que entram na soma
    const grupos = Object.create(null);
    itens.forEach(function (item) {
      if (!item.efeitos) return;
      if (item.familia) (grupos[item.familia] = grupos[item.familia] || []).push(item);
      else {
        aplicados.push(item.efeitos);
        const texto = resumoEfeitos(item.efeitos);
        if (texto) resultado.origens.push({ condicao: item.nome, texto: texto });
      }
    });
    Object.keys(grupos).forEach(function (familia) {
      const membros = grupos[familia];
      const junto = piorDaFamilia(membros);
      aplicados.push(junto.efeitos);
      membros.forEach(function (membro, indice) {
        const texto = resumoEfeitos(membro.efeitos);
        if (!texto) return;
        resultado.origens.push({
          condicao: membro.nome,
          texto: junto.contribui[indice] ? texto : texto + ' (não acumula: vale a pior da família)'
        });
      });
    });

    aplicados.forEach(function (efeitos) {
      resultado.dadosPericias += numero(efeitos.dadosPericias);
      resultado.defesa += numero(efeitos.defesa);
      if (efeitos.deslocamentoMult !== undefined && efeitos.deslocamentoMult !== null) {
        resultado.deslocamentoMult *= numero(efeitos.deslocamentoMult);
      }
      IDS_ATRIBUTOS_COND.forEach(function (id) {
        if (efeitos.dadosAtributos) resultado.dadosAtributos[id] += numero(efeitos.dadosAtributos[id]);
      });
    });
    return resultado;
  }

  /**
   * Dados a somar (negativo = tirar) num teste: teste de PERÍCIA = dadosPericias
   * + dadosAtributos do atributo da perícia; teste PURO de atributo = só dadosAtributos.
   */
  function modificadorDadosTeste(mod, opcoes) {
    const o = opcoes || {};
    const m = mod || {};
    const doAtributo = m.dadosAtributos && o.atributo ? numero(m.dadosAtributos[o.atributo]) : 0;
    return Math.trunc((o.ehPericia ? numero(m.dadosPericias) : 0) + doAtributo);
  }

  /** Dados das condições no teste de uma perícia da ficha. */
  function dadosCondicoesPericia(ficha, idPericia) {
    return modificadorDadosTeste(modificadoresCondicoes(ficha), { atributo: atributoDaPericia(ficha, idPericia), ehPericia: true });
  }

  /** Rodadas: reduz 1 de cada condição com contagem, remove as que chegam a 0. Não altera a ficha. */
  function passarRodada(ficha) {
    const ativas = [];
    const removidas = [];
    listaAtivas(condicoesSalvas(ficha)).forEach(function (item) {
      if (item.rodadas === null || item.rodadas === undefined) {
        ativas.push(item);
        return;
      }
      const restantes = Math.trunc(numero(item.rodadas)) - 1;
      if (restantes <= 0) removidas.push(item);
      else ativas.push(Object.assign({}, item, { rodadas: restantes }));
    });
    return { ativas: ativas, removidas: removidas };
  }

  /** Fim da cena: sai quem tem "até o fim da cena" e os turnos morrendo voltam a 0. Não altera a ficha. */
  function fimDaCena(ficha) {
    const ativas = [];
    const removidas = [];
    listaAtivas(condicoesSalvas(ficha)).forEach(function (item) {
      if (item.ateFimCena === true) removidas.push(item);
      else ativas.push(item);
    });
    return { ativas: ativas, removidas: removidas, turnosMorrendo: 0 };
  }

  /** Saúde pelo PV: "ileso" | "ferido" | "machucado" | "morrendo". */
  function estadoSaude(pv, pvMaximo) {
    const atual = numero(pv);
    const maximo = numero(pvMaximo);
    if (maximo <= 0) return 'ileso';
    if (atual <= 0) return 'morrendo';
    if (atual >= maximo) return 'ileso';
    return atual > maximo * numero(OP.data.config.estadoSaude.feridoAcimaDe) ? 'ferido' : 'machucado';
  }

  /** Sanidade pela SAN: "sao" | "perturbado" | "enlouquecendo". CONFERIR NO LIVRO (limite em config). */
  function estadoSanidade(san, sanMaximo) {
    const atual = numero(san);
    const maximo = numero(sanMaximo);
    if (maximo <= 0) return 'sao';
    if (atual <= 0) return 'enlouquecendo';
    return atual <= maximo * numero(OP.data.config.sanidadePerturbadoAte) ? 'perturbado' : 'sao';
  }

  /** Limite de turnos morrendo: o do config + o bônus da ficha (características). */
  function limiteMorrendo(ficha) {
    return Math.max(1, Math.trunc(numero(OP.data.config.limiteTurnosMorrendo)) + Math.max(0, Math.trunc(numero(condicoesSalvas(ficha).bonusLimiteMorrendo))));
  }

  /** { morrendo, turnos, limite, morto }: morrendo = PV atual 0 (com classe escolhida). */
  function statusMorrendo(ficha) {
    const pv = estadoRecurso(ficha, 'pv');
    const morrendo = Boolean(pv.classeDefinida) && numero(pv.atual) <= 0;
    const turnos = Math.max(0, Math.trunc(numero(condicoesSalvas(ficha).turnosMorrendo)));
    const limite = limiteMorrendo(ficha);
    return { morrendo: morrendo, turnos: turnos, limite: limite, morto: morrendo && turnos >= limite };
  }

  /** Turnos morrendo depois de iniciar mais um turno (não passa do limite). */
  function proximoTurnoMorrendo(ficha) {
    const status = statusMorrendo(ficha);
    return Math.min(status.turnos + 1, status.limite);
  }

  /** Dano em PV: { pv, massivo, morrendo }. PV nunca abaixo de 0. Dano massivo: CONFERIR NO LIVRO. */
  function aplicarDano(pv, pvMaximo, dano) {
    const atual = numero(pv);
    const maximo = numero(pvMaximo);
    const quantia = Math.max(0, numero(dano));
    const novo = Math.max(0, atual - quantia);
    return {
      pv: novo,
      massivo: quantia > 0 && maximo > 0 && quantia >= maximo * numero(OP.data.config.danoMassivoFracao),
      morrendo: maximo > 0 && novo <= 0
    };
  }

  /** Cura em PV: sobe até o máximo; PV acima do máximo (temporário) não diminui. */
  function aplicarCura(pv, pvMaximo, cura) {
    const atual = numero(pv);
    const maximo = numero(pvMaximo);
    if (atual >= maximo) return atual;
    return Math.min(maximo, atual + Math.max(0, numero(cura)));
  }

  /** Condição de descanso conhecida (senão "normal"). */
  function condicaoDescansoValida(id) {
    const lista = OP.data.config.descanso.condicoes;
    return lista.some(function (c) { return c.id === id; }) ? id : 'normal';
  }

  /**
   * Sugestão de recuperação num descanso: { pv, pe, san }.
   * tipo "meditacao": só PE = limite de PE por turno × config.descanso.meditacaoPorLimitePE.
   * tipo "dormir": CONFERIR NO LIVRO (provisório, copiado da Meditação; editável na tela).
   */
  function recuperacaoDescanso(ficha, tipo, condicao) {
    const cfg = OP.data.config.descanso;
    const id = condicaoDescansoValida(condicao);
    const limite = limitePEporTurno(ficha);
    if (tipo === 'meditacao') return { pv: 0, pe: limite * numero(cfg.meditacaoPorLimitePE[id]), san: 0 };
    return {
      pv: limite * numero(cfg.dormir.pvPorLimitePE[id]),
      pe: limite * numero(cfg.dormir.pePorLimitePE[id]),
      san: numero(cfg.dormir.san[id])
    };
  }

  /** Novo valor atual depois de recuperar `ganho`: sobe até o máximo; nunca desce; acima do máximo não muda. */
  function recuperarAteMaximo(estado, ganho) {
    const salvo = atualSalvo(estado.atual);
    const atual = salvo === null ? estado.max : salvo;
    if (atual >= estado.max) return atual;
    return Math.min(estado.max, atual + Math.max(0, Math.trunc(numero(ganho))));
  }

  /**
   * Valores atuais de PV, PE e SAN depois de recuperar { pv, pe, san }.
   * Sem classe escolhida (máximos desconhecidos) devolve o que está salvo.
   */
  function aplicarRecuperacao(ficha, recuperacao) {
    const r = recuperacao || {};
    const resultado = {};
    ['pv', 'pe', 'san'].forEach(function (id) {
      const estado = estadoRecurso(ficha, id);
      const salvo = atualSalvo(ficha.recursos && ficha.recursos[id] ? ficha.recursos[id].atual : null);
      resultado[id] = estado.classeDefinida ? recuperarAteMaximo({ atual: salvo, max: estado.max }, r[id]) : salvo;
    });
    return resultado;
  }

  /** Tudo de condições e estados que a tela precisa. */
  function estadoCondicoes(ficha) {
    const salvas = condicoesSalvas(ficha);
    const pv = estadoRecurso(ficha, 'pv');
    const san = estadoRecurso(ficha, 'san');
    const mod = modificadoresCondicoes(ficha);
    const ativas = listaAtivas(salvas).map(function (item) {
      if (item.id === 'personalizada') {
        const p = item.personalizada && typeof item.personalizada === 'object' ? item.personalizada : {};
        return {
          id: 'personalizada', nome: String(p.nome || '').trim() || 'Condição personalizada', categoria: '',
          categoriaNome: 'Personalizada', resumo: resumoEfeitos(efeitosDaPersonalizada(p)), conferir: false, familia: null
        };
      }
      const definicao = definicaoCondicao(item.id);
      if (!definicao) return null;
      // O resumo inclui o que as condições implicadas trazem (ex.: Exausto → Debilitado, Lento e Vulnerável)
      const sozinha = modificadoresCondicoes({ condicoes: { ativas: [{ id: definicao.id }], aplicarEfeitos: true } });
      return {
        id: definicao.id, nome: definicao.nome, categoria: definicao.categoria,
        categoriaNome: (OP.data.categoriasCondicao || {})[definicao.categoria] || '',
        resumo: resumoEfeitos(sozinha), conferir: definicao.conferir === true,
        familia: definicao.familia || null,
        implica: (definicao.implica || []).map(function (id) { const d = definicaoCondicao(id); return d ? d.nome : id; })
      };
    });
    const efetivas = condicoesEfetivas(salvas);
    return {
      saude: pv.classeDefinida ? estadoSaude(pv.atual, pv.max) : 'ileso',
      sanidade: san.classeDefinida ? estadoSanidade(san.atual, san.max) : 'sao',
      morrendo: statusMorrendo(ficha),
      mod: mod,
      efetivas: efetivas,
      ativas: ativas,
      aplicarEfeitos: salvas.aplicarEfeitos !== false,
      temConferir: salvas.aplicarEfeitos !== false && efetivas.some(function (id) {
        const d = definicaoCondicao(id);
        return d && d.conferir === true && resumoEfeitos(d.efeitos) !== '';
      })
    };
  }

  /**
   * Correções do que as condições guardam: turnos morrendo inteiros de 0 a 20,
   * bônus do limite de 0 a 10 e turnos zerados quando o PV volta a ser maior que 0.
   */
  function correcoesCondicoes(ficha) {
    const correcoes = [];
    const salvas = condicoesSalvas(ficha);
    if (!Object.keys(salvas).length) return correcoes;
    const pv = estadoRecurso(ficha, 'pv');
    let turnos = limitarEntre(Math.trunc(numero(salvas.turnosMorrendo)), 0, 20);
    if (pv.classeDefinida && numero(pv.atual) > 0) turnos = 0;
    if (turnos !== salvas.turnosMorrendo) correcoes.push({ caminho: 'condicoes.turnosMorrendo', valor: turnos });
    const bonus = limitarEntre(Math.trunc(numero(salvas.bonusLimiteMorrendo)), 0, 10);
    if (bonus !== salvas.bonusLimiteMorrendo) correcoes.push({ caminho: 'condicoes.bonusLimiteMorrendo', valor: bonus });
    return correcoes;
  }

  /* ------------------------------------------------------------------------
     Etapa 10 · Números digitados, cores e retrato
     ------------------------------------------------------------------------ */

  /**
   * Lê um número digitado. Aceita vírgula decimal ("1,5"), ponto, espaços e o
   * sinal de menos tipográfico (−). Inválido → opcoes.padrao (undefined se
   * não informado). opcoes: { inteiro (Math.round), min, max, padrao }.
   */
  function lerNumero(texto, opcoes) {
    const o = opcoes || {};
    let valor;
    if (typeof texto === 'number') {
      valor = texto;
    } else {
      let t = String(texto === null || texto === undefined ? '' : texto)
        .replace(/[\s ]/g, '').replace(/[−‒–]/g, '-');
      if (t.indexOf(',') !== -1 && t.indexOf('.') !== -1) {
        // "1.234,5" (ponto de milhar) ou "1,234.5" (vírgula de milhar): vale o último separador
        t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
      } else {
        t = t.replace(',', '.');
      }
      valor = /^[+-]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN;
    }
    if (!Number.isFinite(valor)) return o.padrao;
    if (o.inteiro) valor = Math.round(valor);
    if (typeof o.min === 'number' && valor < o.min) valor = o.min;
    if (typeof o.max === 'number' && valor > o.max) valor = o.max;
    return valor;
  }

  function luminanciaRelativa(hex) {
    const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(String(hex).trim());
    if (!m) return null;
    const canais = [m[1], m[2], m[3]].map(function (c) {
      const v = parseInt(c, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
  }

  /** Razão de contraste WCAG entre duas cores "#rrggbb" (1 a 21; a ordem não importa). null se a cor for inválida. */
  function contrasteWCAG(corA, corB) {
    const a = luminanciaRelativa(corA);
    const b = luminanciaRelativa(corB);
    if (a === null || b === null) return null;
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  /** Retrato aceito: data URL de imagem PNG, JPEG ou WEBP em base64, dentro do limite. Nada de SVG, HTML ou outros esquemas. */
  function retratoValido(texto) {
    return typeof texto === 'string' && texto.length > 0 && texto.length <= numero(OP.data.config.retratoMaxChars) &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(texto);
  }

  /* ------------------------------------------------------------------------
     Etapa 10 · Verificações centralizadas (avisos que não bloqueiam nada)
     Reúne o que já existe em outras funções; nenhuma regra é refeita aqui.
     ------------------------------------------------------------------------ */

  function palavraPontos(n) {
    return Math.abs(n) === 1 ? 'ponto' : 'pontos';
  }

  /**
   * Lista de { codigo, severidade: 'aviso' | 'info', secao, campo, mensagem }.
   * secao: parte final do id da seção ("atributos" → #secao-atributos);
   * campo: id do campo na tela ou null; ref (opcional): id da perícia, do ritual
   * ou do item a que o aviso se refere. Em "modo livre" a lista é vazia
   * (e no modo livre das perícias, só as verificações de perícias saem).
   */
  function verificarFicha(ficha) {
    if (!ficha || typeof ficha !== 'object') return [];
    const config = ficha.config || {};
    if (config.modoLivre === true) return [];
    const lista = [];
    function aviso(codigo, secao, campo, mensagem, ref) {
      const item = { codigo: codigo, severidade: 'aviso', secao: secao, campo: campo, mensagem: mensagem };
      if (ref) item.ref = ref;
      lista.push(item);
    }

    // Identificação
    correcoesIdentificacao(ficha).forEach(function (c) {
      if (c.caminho === 'identificacao.nex') aviso('nex-invalido', 'identificacao', 'campo-nex', 'NEX fora da tabela (' + ficha.identificacao.nex + '%).');
      if (c.caminho === 'identificacao.estagio') aviso('estagio-invalido', 'identificacao', 'campo-estagio', 'Estágio fora do intervalo da classe.');
    });

    // Atributos
    const dist = analisarDistribuicao(ficha);
    const primeiro = dist.acimaDoMaximo.concat(dist.abaixoDoMinimo, dist.reduzidos)[0] || idsAtributos()[0];
    if (dist.restantes < 0) {
      aviso('atributos-pontos', 'atributos', 'atr-' + primeiro + '-base',
        'Atributos: ' + (-dist.restantes) + ' ' + palavraPontos(-dist.restantes) + ' gastos além do permitido (' + dist.permitidos + ').');
    }
    if (dist.acimaDoMaximo.length) {
      aviso('atributo-acima-max', 'atributos', 'atr-' + dist.acimaDoMaximo[0] + '-base',
        'Atributo acima do máximo (' + dist.maximo + '): ' + dist.acimaDoMaximo.map(function (id) { return id.toUpperCase(); }).join(', ') + '.');
    }
    if (dist.abaixoDoMinimo.length) {
      aviso('atributo-abaixo-min', 'atributos', 'atr-' + dist.abaixoDoMinimo[0] + '-base',
        'Atributo abaixo do mínimo: ' + dist.abaixoDoMinimo.map(function (id) { return id.toUpperCase(); }).join(', ') + '.');
    }
    if (dist.reducoesEmExcesso > 0) {
      aviso('atributos-reduzidos', 'atributos', 'atr-' + dist.reduzidos[0] + '-base',
        'Atributos reduzidos em excesso: ' + dist.reduzidos.map(function (id) { return id.toUpperCase(); }).join(', ') + '.');
    }

    // Recursos: atual acima do máximo (a tela corrige sozinha; o aviso vale para dados importados)
    OP.data.recursos.forEach(function (definicao) {
      const estado = estadoRecurso(ficha, definicao.id);
      const salvo = atualSalvo(ficha.recursos && ficha.recursos[definicao.id] ? ficha.recursos[definicao.id].atual : null);
      if (estado.classeDefinida && salvo !== null && salvo > estado.max) {
        aviso(definicao.id + '-acima-max', 'recursos', 'rec-' + definicao.id + '-atual',
          definicao.sigla + ' atual (' + salvo + ') acima do máximo (' + estado.max + ').');
      }
    });

    // Condições: turnos morrendo e efeitos sugeridos
    const morrendo = statusMorrendo(ficha);
    if (numero(condicoesSalvas(ficha).turnosMorrendo) > morrendo.limite) {
      aviso('turnos-morrendo-acima', 'condicoes', 'cond-morrendo',
        'Turnos morrendo (' + condicoesSalvas(ficha).turnosMorrendo + ') acima do limite (' + morrendo.limite + ').');
    }
    if (estadoCondicoes(ficha).temConferir) {
      lista.push({
        codigo: 'condicoes-conferir', severidade: 'info', secao: 'condicoes', campo: 'cond-aplicar',
        mensagem: 'Há condições com efeito sugerido a conferir no livro (dados, Defesa ou deslocamento já aplicados).'
      });
    }

    // Perícias
    if (config.modoLivrePericias !== true) {
      const treino = estadoTreinamento(ficha);
      if (treino.excedido) {
        aviso('pericias-pontos', 'pericias', 'busca-pericias',
          'Perícias: ' + (treino.gastos - treino.total) + ' ' + palavraPontos(treino.gastos - treino.total) + ' de treinamento além do total (' + treino.total + ').');
      }
      const graus = estadoGraus(ficha);
      if (graus.excedido) {
        aviso('graus-excedidos', 'pericias', 'busca-pericias', 'Graus de treinamento: ' + graus.usados + ' usados para ' + graus.liberados + ' liberados.');
      }
      graus.avisos.forEach(function (a) {
        aviso('grau-fora-nex', 'pericias', null,
          a.nome + ' em ' + a.nomeGrau + (a.nivelNecessario !== null ? ': exige NEX ' + a.nivelNecessario + '%.' : ': a classe não ganha graus de treinamento.'), a.id);
      });
    }

    // Rituais
    const rituais = Array.isArray(ficha.rituais) ? ficha.rituais : [];
    estadoRituais(ficha).forEach(function (estado, indice) {
      const ritual = rituais[indice] || {};
      const nome = String(ritual.nome || '').trim() || 'ritual sem nome';
      if (estado.alemDoCirculo) {
        aviso('ritual-fora-circulo', 'rituais', null, 'Ritual "' + nome + '": ' + numero(ritual.circulo) + 'º círculo além do que o NEX libera.', ritual.id);
      }
      OP.data.formasRitual.forEach(function (forma) {
        if (!estado.formas[forma.id].ativa) return; // forma desligada não gera aviso
        estado.formas[forma.id].avisos.forEach(function (a) {
          aviso(a.tipo === 'afinidade' ? 'ritual-sem-afinidade' : 'ritual-forma-circulo', 'rituais', null,
            'Ritual "' + nome + '" (' + forma.nome + '): ' + a.texto, ritual.id);
        });
      });
    });
    const conjuracao = estadoConjuracao(ficha);
    if (conjuracao.passouLimite) {
      aviso('limite-pe-turno', 'rituais', null, 'PE gasto no turno (' + conjuracao.peGastoTurno + ') acima do limite (' + conjuracao.limitePE + ').');
    }

    // Inventário
    const inventario = estadoInventario(ficha);
    if (inventario.sobrecarregado) {
      aviso('sobrecarga', 'inventario', null, 'Sobrecarregado: ' + inventario.espacosUsados + ' de ' + inventario.capacidade + ' espaços.');
    }
    inventario.limites.forEach(function (limite) {
      if (!limite.excedeu) return;
      if (limite.limite === 0) {
        aviso('categoria-acima-patente', 'inventario', 'inv-patente', 'Itens de categoria ' + limite.categoria + ' acima da patente (a patente não permite).');
      } else {
        aviso('limite-itens', 'inventario', 'inv-patente', 'Categoria ' + limite.categoria + ': ' + limite.usados + ' itens para o limite de ' + limite.limite + '.');
      }
    });
    return lista;
  }

  /* ------------------------------------------------------------------------
     Tudo de uma vez
     ------------------------------------------------------------------------ */

  /** Todas as correções que o ciclo de atualização deve aplicar ao estado. */
  function correcoes(ficha) {
    return correcoesIdentificacao(ficha).concat(
      correcoesRecursos(ficha),
      correcoesPericias(ficha),
      correcoesInventario(ficha),
      correcoesAtaques(ficha),
      correcoesConjuracao(ficha),
      correcoesCondicoes(ficha)
    );
  }

  /**
   * Calcula todos os valores derivados da ficha de uma vez.
   * A interface lê daqui (via data-saida="caminho") e nunca refaz contas.
   */
  function calcularTudo(ficha) {
    const recursos = {};
    OP.data.recursos.forEach(function (definicao) {
      recursos[definicao.id] = estadoRecurso(ficha, definicao.id);
    });
    const pericias = {};
    OP.data.pericias.forEach(function (definicao) {
      pericias[definicao.id] = estadoPericia(ficha, definicao.id);
    });
    const testes = {};
    OP.data.periciasDerivadas.forEach(function (idPericia) {
      testes[idPericia] = derivadasPericia(ficha, idPericia);
    });
    const defesa = Object.assign(composicaoDefesa(ficha), {
      bloqueio: bloqueio(ficha),
      esquiva: esquiva(ficha),
      contraAtaque: contraAtaque(ficha)
    });

    return {
      atributos: totaisAtributos(ficha),
      distribuicao: analisarDistribuicao(ficha),
      nex: {
        passos: passosProgressao(ficha),   // passos de NEX (ou de estágio, no Sobrevivente)
        limitePE: limitePEporTurno(ficha),
        unidade: unidadeProgressao(ficha),
        nivel: nivelProgressao(ficha)
      },
      recursos: recursos,
      pericias: pericias,
      treinamento: estadoTreinamento(ficha),
      graus: estadoGraus(ficha),
      identidade: estadoIdentidade(ficha),
      progressao: estadoProgressao(ficha),
      defesa: defesa,
      deslocamento: deslocamento(ficha),
      testes: testes,
      resistenciasAtivas: resistenciasAtivas(ficha),
      inventario: estadoInventario(ficha),
      ataques: estadoAtaques(ficha),
      habilidades: estadoHabilidades(ficha),
      conjuracao: estadoConjuracao(ficha),
      rituais: estadoRituais(ficha),
      condicoes: estadoCondicoes(ficha)
    };
  }

  OP.calc = {
    numero: numero,
    baseAtributo: baseAtributo,
    totalAtributo: totalAtributo,
    totaisAtributos: totaisAtributos,
    analisarDistribuicao: analisarDistribuicao,
    classesLista: classesLista,
    classeDados: classeDados,
    classeDaFicha: classeDaFicha,
    origemDados: origemDados,
    trilhaDados: trilhaDados,
    trilhasDaClasse: trilhasDaClasse,
    trilhaDaFicha: trilhaDaFicha,
    habilidadesTrilha: habilidadesTrilha,
    versatilidadeLiberada: versatilidadeLiberada,
    habilidadeVersatilidade: habilidadeVersatilidade,
    proximoMarco: proximoMarco,
    poderesLiberados: poderesLiberados,
    rituaisConcedidosClasse: rituaisConcedidosClasse,
    estadoIdentidade: estadoIdentidade,
    estadoProgressao: estadoProgressao,
    passosNex: passosNex,
    unidadeProgressao: unidadeProgressao,
    nivelProgressao: nivelProgressao,
    passosProgressao: passosProgressao,
    limitePEporTurno: limitePEporTurno,
    aumentosAtributoLiberados: aumentosAtributoLiberados,
    aumentosAtributoUsados: aumentosAtributoUsados,
    pontosAtributoPermitidos: pontosAtributoPermitidos,
    maximoAtributo: maximoAtributo,
    periciasConcedidas: periciasConcedidas,
    periciasConcedidasDetalhe: periciasConcedidasDetalhe,
    periciasLivresPermitidas: periciasLivresPermitidas,
    fonteConcedida: fonteConcedida,
    grauEfetivo: grauEfetivo,
    grausTreinamentoLiberados: grausTreinamentoLiberados,
    grausTreinamentoUsados: grausTreinamentoUsados,
    avisosGrau: avisosGrau,
    estadoGraus: estadoGraus,
    correcoesEscolhas: correcoesEscolhas,
    custoBaseRitual: custoBaseRitual,
    custoForma: custoForma,
    custoAdicionalSugerido: custoAdicionalSugerido,
    avisosForma: avisosForma,
    composicaoRecurso: composicaoRecurso,
    pvMax: pvMax,
    peMax: peMax,
    sanMax: sanMax,
    atualEfetivo: atualEfetivo,
    ajustarAtual: ajustarAtual,
    correcoesRecursos: correcoesRecursos,
    estadoRecurso: estadoRecurso,
    grauDaPericia: grauDaPericia,
    bonusDoGrau: bonusDoGrau,
    atributoDaPericia: atributoDaPericia,
    resolverReserva: resolverReserva,
    dadosPorAtributo: dadosPorAtributo,
    testePericia: testePericia,
    ataqueTeste: ataqueTeste,
    ehCritico: ehCritico,
    estadoAtaques: estadoAtaques,
    correcoesAtaques: correcoesAtaques,
    circulosLiberados: circulosLiberados,
    afinidadeLiberada: afinidadeLiberada,
    elementosAfinidade: elementosAfinidade,
    elementosRitual: elementosRitual,
    dtHabilidade: dtHabilidade,
    dtRituais: dtRituais,
    estadoHabilidades: estadoHabilidades,
    resumoResistencia: resumoResistencia,
    projetarCustos: projetarCustos,
    planoConjuracao: planoConjuracao,
    correcoesIdentificacao: correcoesIdentificacao,
    custoSugeridoRitual: custoSugeridoRitual,
    ritualAlemDoCirculo: ritualAlemDoCirculo,
    formaDoRitual: formaDoRitual,
    estadoConjuracao: estadoConjuracao,
    estadoRituais: estadoRituais,
    correcoesConjuracao: correcoesConjuracao,
    periciaDados: periciaDados,
    formatarDados: formatarDados,
    periciaBonus: periciaBonus,
    capacidadeCarga: capacidadeCarga,
    espacosUsados: espacosUsados,
    sobrecarregado: sobrecarregado,
    patenteAtual: patenteAtual,
    patenteSugerida: patenteSugerida,
    creditoAtual: creditoAtual,
    limitesItens: limitesItens,
    defesaProtecoes: defesaProtecoes,
    penalidadeCarga: penalidadeCarga,
    kitAtivo: kitAtivo,
    estadoInventario: estadoInventario,
    correcoesInventario: correcoesInventario,
    pontosTreinamentoTotal: pontosTreinamentoTotal,
    pontosTreinamentoGastos: pontosTreinamentoGastos,
    estadoPericia: estadoPericia,
    estadoTreinamento: estadoTreinamento,
    correcoesPericias: correcoesPericias,
    composicaoDefesa: composicaoDefesa,
    defesaTotal: defesaTotal,
    reacaoDisponivel: reacaoDisponivel,
    bloqueio: bloqueio,
    esquiva: esquiva,
    contraAtaque: contraAtaque,
    deslocamento: deslocamento,
    derivadasPericia: derivadasPericia,
    resistenciasAtivas: resistenciasAtivas,
    // Etapa 10
    condicoesEfetivas: condicoesEfetivas,
    modificadoresCondicoes: modificadoresCondicoes,
    modificadorDadosTeste: modificadorDadosTeste,
    dadosCondicoesPericia: dadosCondicoesPericia,
    resumoEfeitos: resumoEfeitos,
    estadoCondicoes: estadoCondicoes,
    correcoesCondicoes: correcoesCondicoes,
    passarRodada: passarRodada,
    fimDaCena: fimDaCena,
    estadoSaude: estadoSaude,
    estadoSanidade: estadoSanidade,
    statusMorrendo: statusMorrendo,
    proximoTurnoMorrendo: proximoTurnoMorrendo,
    aplicarDano: aplicarDano,
    aplicarCura: aplicarCura,
    condicaoDescansoValida: condicaoDescansoValida,
    recuperacaoDescanso: recuperacaoDescanso,
    aplicarRecuperacao: aplicarRecuperacao,
    verificarFicha: verificarFicha,
    lerNumero: lerNumero,
    contrasteWCAG: contrasteWCAG,
    retratoValido: retratoValido,
    correcoes: correcoes,
    calcularTudo: calcularTudo
  };
})(window.OP);
