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

  /* ---------- Regra opcional NEX e Experiência: nível x NEX ---------- */

  const NIVEL_MAXIMO = 20; // nível 20 equivale a NEX 99%

  /** A regra opcional "NEX e Experiência" está ligada nesta ficha? */
  function regraNexNivel(ficha) {
    return Boolean(ficha && ficha.config && ficha.config.nexENivel === true);
  }

  /** NEX (em %) equivalente a um nível: 1 nível = 5% (nível 20 = 99%). */
  function nexDoNivel(nivel) {
    const n = Math.min(NIVEL_MAXIMO, Math.max(1, Math.trunc(numero(nivel)) || 1));
    return n >= NIVEL_MAXIMO ? 99 : n * 5;
  }

  /** Nível equivalente a um NEX da regra padrão (5% = 1 ... 99% = 20). */
  function nivelDoNex(nex) {
    const n = numero(nex);
    if (n >= 99) return NIVEL_MAXIMO;
    return Math.min(NIVEL_MAXIMO, Math.max(1, Math.floor(n / 5)));
  }

  /** Nível de experiência da ficha (1 a 20). */
  function nivelDaFicha(ficha) {
    const bruto = Math.trunc(numero(ficha && ficha.identificacao && ficha.identificacao.nivel));
    return Math.min(NIVEL_MAXIMO, Math.max(1, bruto || 1));
  }

  /**
   * NEX que vale para a progressão (PV/PE/SAN, limite de PE, círculos, tabela da classe):
   * na regra padrão é o NEX da ficha; com NEX e Experiência é o equivalente ao nível.
   */
  function nexProgressao(ficha) {
    if (regraNexNivel(ficha)) return nexDoNivel(nivelDaFicha(ficha));
    return numero(ficha && ficha.identificacao && ficha.identificacao.nex);
  }

  /** NEX de exposição (afinidade, alterações, poderes paranormais): o campo NEX da ficha. */
  function nexExposicao(ficha) {
    return numero(ficha && ficha.identificacao && ficha.identificacao.nex);
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
    return unidadeProgressao(ficha) === 'estagio' ? estagioDaFicha(ficha) : nexProgressao(ficha);
  }

  /**
   * Passos usados por PV, PE e SAN:
   * classes de NEX → passosNex(nex) (NEX 5% = 0, 99% = 19);
   * Sobrevivente → estágio − 1.
   */
  function passosProgressao(ficha) {
    return unidadeProgressao(ficha) === 'estagio' ? estagioDaFicha(ficha) - 1 : passosNex(nexProgressao(ficha));
  }

  /**
   * Limite de PE gastos por turno = NEX ÷ 5 (5% → 1, 10% → 2, 99% → 20).
   * Com uma ficha: classes com limitePEFixo (Sobrevivente) usam esse valor.
   * Com um número: atalho pelo NEX (como nas etapas anteriores).
   */
  function limitePEporTurno(fichaOuNex) {
    if (fichaOuNex !== null && typeof fichaOuNex === 'object') {
      const classe = classeDaFicha(fichaOuNex);
      const extra = efeitosDaFicha(fichaOuNex).limitePE;
      if (classe && typeof classe.limitePEFixo === 'number') return classe.limitePEFixo + extra;
      return limitePEporTurno(fichaOuNex.identificacao ? nexProgressao(fichaOuNex) : 0) + extra;
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

  /**
   * Regra opcional "Jogando sem Sanidade" ligada nesta ficha? Os pontos de esforço
   * e a sanidade se juntam nos Pontos de Determinação (PD): a ficha segue usando o
   * recurso "pe" como PD e a SAN fica de fora (os valores dela não são apagados).
   */
  function semSanidade(ficha) {
    return Boolean(ficha && ficha.config && ficha.config.semSanidade === true);
  }

  /** Campo de config.* que troca o atributo de cada recurso (null = o padrão da regra). */
  const CAMPO_ATRIBUTO_RECURSO = { pv: 'atributoPV', pe: 'atributoPE', san: 'atributoSAN' };

  /**
   * Atributo que entra na conta do máximo do recurso: o escolhido em config
   * (algumas habilidades calculam PV, PE/PD ou SAN com outro atributo) ou, sem
   * escolha válida, o padrão da regra (PV = VIG, PE/PD = PRE, SAN = nenhum).
   */
  function atributoDoRecurso(ficha, idRecurso) {
    const definicao = definicaoRecurso(idRecurso);
    const campo = CAMPO_ATRIBUTO_RECURSO[idRecurso];
    const escolhido = ficha && ficha.config && campo ? ficha.config[campo] : null;
    if (ehAtributoValido(escolhido)) return escolhido;
    return definicao ? definicao.atributo : null;
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
    const atributo = atributoDoRecurso(ficha, idRecurso);
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
      bonusEfeitos: 0,    // poderes e habilidades com efeito automático (data/efeitos*.js)
      bonusAlteracoes: 0, // PE: atributo escolhido no NEX 35% (regra opcional NEX e Experiência)
      atributoAlteracoes: null,
      max: 0
    };
    if (!composicao.classeDefinida) return composicao;

    // Regra opcional "Jogando sem Sanidade": os PE viram PD, com inicial e ganho por NEX próprios (por classe)
    const campoInicial = idRecurso === 'pe' && semSanidade(ficha) ? 'pdInicial' : definicao.campoInicial;
    const campoPorNex = idRecurso === 'pe' && semSanidade(ficha) ? 'pdPorNex' : definicao.campoPorNex;
    composicao.inicialClasse = numero(classe[campoInicial]);
    composicao.porNexClasse = numero(classe[campoPorNex]);
    composicao.inicial = composicao.inicialClasse + composicao.valorAtributo;
    composicao.porNex = composicao.porNexClasse + (composicao.somaAtributo ? composicao.valorAtributo : 0);
    composicao.ganhoNex = composicao.porNex * composicao.passos;
    if (idRecurso === 'pe') {
      const alteracoes = efeitosAlteracoes(ficha);
      if (alteracoes.bonusPE) {
        composicao.bonusAlteracoes = alteracoes.bonusPE.valor;
        composicao.atributoAlteracoes = alteracoes.bonusPE.atributo;
      }
    }
    composicao.bonusEfeitos = numero(efeitosDaFicha(ficha)[idRecurso]);
    composicao.max = Math.max(0, composicao.inicial + composicao.ganhoNex + composicao.bonus + composicao.bonusAlteracoes + composicao.bonusEfeitos - composicao.perdaPermanente);
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
    return Math.max(0, capacidadeBase(ficha) + numero(inventarioSalvo(ficha).capacidadeBonus) + efeitosDaFicha(ficha).carga);
  }

  /* ---------- Melhorias dos itens (modificações, maldições e regalias) ----------
     A categoria, os espaços e a Defesa de um item são os BASE (campos do item) mais o que as
     melhorias mudam. A categoria vem das regras de data/melhorias.js (não precisa do livro);
     os ajustes numéricos (espaços, Defesa, ataque, dano, margem) vêm do catálogo do livro e só
     valem com o conteúdo liberado. Sem ele, a ficha funciona manualmente, como sempre. */

  const ROMANOS_CATEGORIA = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  /** Rótulo de uma categoria: 0, I a IV e, com melhorias, V, VI... (acima de X, o número; abaixo de 0, "−1"...). */
  function rotuloCategoria(n) {
    if (n < 0) return '−' + Math.abs(n);
    return ROMANOS_CATEGORIA[n] !== undefined ? ROMANOS_CATEGORIA[n] : String(n);
  }

  /** Melhorias de um item (só os objetos). */
  function melhoriasDoItem(item) {
    return item && Array.isArray(item.melhorias) ? item.melhorias.filter(function (m) { return m !== null && typeof m === 'object'; }) : [];
  }

  function classeDeMelhoria(id) {
    return OP.data.classesMelhoria.find(function (c) { return c.id === id; }) || null;
  }

  function grupoDeItem(id) {
    return OP.data.gruposItem.find(function (g) { return g.id === id; }) || null;
  }

  function grupoDeMelhoria(id) {
    return OP.data.gruposMelhoria.find(function (g) { return g.id === id; }) || null;
  }

  /** Dados do item no catálogo do livro ({ nome, grupo, cat, esp, arma, protecao, limite... }) ou null. */
  function itemDoCatalogo(chave) {
    const mapa = catalogoLivro().itemPorChave;
    return chave && mapa && temChave(mapa, chave) ? mapa[chave] : null;
  }

  /** Dados da melhoria no catálogo do livro ({ nome, cls, grupo, aj, so, somente, tambem, exclui, max }) ou null. */
  function melhoriaDoCatalogo(chave) {
    const mapa = catalogoLivro().melhoriaPorChave;
    return chave && mapa && temChave(mapa, chave) ? mapa[chave] : null;
  }

  /** Quantas vezes a melhoria pode entrar no mesmo item (padrão 1; o catálogo pode dizer mais). */
  function maximoDaMelhoria(melhoria) {
    const entrada = melhoriaDoCatalogo(melhoria.chave);
    const max = entrada ? Math.trunc(numero(entrada.max)) : 0;
    return max >= 1 ? max : 1;
  }

  /**
   * Melhorias do item que valem: as repetidas além do máximo (o livro não acumula)
   * ficam de fora da conta, mas continuam na lista (e geram aviso).
   */
  function melhoriasQueValem(item) {
    const usos = Object.create(null);
    return melhoriasDoItem(item).filter(function (m) {
      const id = m.chave || ('nome:' + String(m.nome || '').trim().toLowerCase() + '|' + m.classe);
      usos[id] = (usos[id] || 0) + 1;
      return usos[id] <= maximoDaMelhoria(m);
    });
  }

  /**
   * Quanto as melhorias somam à categoria (data/melhorias.js): modificação +I cada; a 1ª maldição +II
   * e as seguintes +I; regalia de veículo +I cada. Contam as melhorias que valem.
   */
  function aumentoDeCategoria(item) {
    return aumentosDasMelhorias(item).reduce(function (soma, n) { return soma + n; }, 0);
  }

  /** O que cada melhoria soma à categoria (na ordem de item.melhorias; 0 para as que não valem). */
  function aumentosDasMelhorias(item) {
    const vale = melhoriasQueValem(item);
    const contados = Object.create(null);
    return melhoriasDoItem(item).map(function (m) {
      const classe = classeDeMelhoria(m.classe);
      if (!classe || vale.indexOf(m) === -1) return 0;
      const i = contados[classe.id] || 0;
      contados[classe.id] = i + 1;
      return numero(classe.aumento[Math.min(i, classe.aumento.length - 1)]);
    });
  }

  function categoriaBaseItem(item) {
    return Math.max(0, Math.trunc(numero(item.categoria)));
  }

  /** Modificadores de categoria do item (só os objetos): [{ id, valor, fonte }]. */
  function modificadoresDoItem(item) {
    return item && Array.isArray(item.modCategoria) ? item.modCategoria.filter(function (m) { return m !== null && typeof m === 'object'; }) : [];
  }

  /** Valor de um modificador: inteiro com sinal, entre −20 e +20. */
  function valorDoModificador(modificador) {
    return Math.min(20, Math.max(-20, Math.trunc(numero(modificador && modificador.valor))));
  }

  /** Soma dos modificadores de categoria do item (habilidades e poderes que sobem ou baixam a categoria). */
  function ajusteDeCategoria(item) {
    return modificadoresDoItem(item).reduce(function (soma, m) { return soma + valorDoModificador(m); }, 0);
  }

  /**
   * Categoria que conta para a patente: a base mais o aumento das melhorias e os modificadores.
   * Pode passar de IV e pode ficar abaixo de 0 (só 1 a 4 entram nos limites da patente).
   */
  function categoriaEfetivaItem(item) {
    return categoriaBaseItem(item) + aumentoDeCategoria(item) + ajusteDeCategoria(item);
  }

  /** Soma dos ajustes numéricos das melhorias do catálogo: { esp, def, ataque, dano, margem }. */
  function ajustesDoItem(item) {
    const r = { esp: 0, def: 0, ataque: 0, dano: 0, margem: 0 };
    melhoriasQueValem(item).forEach(function (m) {
      const entrada = melhoriaDoCatalogo(m.chave);
      const aj = entrada && entrada.aj && typeof entrada.aj === 'object' ? entrada.aj : null;
      if (!aj) return;
      Object.keys(r).forEach(function (k) { r[k] += numero(aj[k]); });
    });
    return r;
  }

  /** Espaços de UMA unidade: os do item mais o que as melhorias mudam, nunca abaixo de 0. */
  function espacosDoItem(item) {
    return Math.max(0, Math.round((numero(item.espacos) + ajustesDoItem(item).esp) * 100) / 100);
  }

  /** Defesa do item (proteções): a do item mais o que as melhorias dão. */
  function defesaDoItem(item) {
    return numero(item.defesa) + ajustesDoItem(item).def;
  }

  /** Natureza do item: a escolhida na ficha ou, se vazia, a do item do livro. '' = desconhecida. */
  function grupoDoItem(item) {
    if (typeof item.grupo === 'string' && item.grupo !== '' && grupoDeItem(item.grupo)) return item.grupo;
    const entrada = itemDoCatalogo(item.catalogo);
    return entrada && grupoDeItem(entrada.grupo) ? entrada.grupo : '';
  }

  function nomesDosGrupos(ids) {
    return ids.map(function (id) { const g = grupoDeItem(id); return g ? g.nome.toLowerCase() : id; }).join(', ');
  }

  /**
   * A melhoria serve para este item? { ok, incerto, motivo }.
   * Regras (as mesmas de tools/gerar-arsenal.mjs): o grupo da melhoria diz que naturezas ela aceita
   * (data/melhorias.js); no catálogo, "so" restringe essas naturezas, "somente" limita a itens do livro
   * e "tambem" aceita outros itens. incerto: não dá para saber (melhoria própria ou sem dados do
   * livro, item sem natureza) — nesses casos a ficha não reclama.
   */
  function compatibilidadeMelhoria(item, melhoria) {
    const entrada = melhoriaDoCatalogo(melhoria.chave);
    if (!entrada) return { ok: true, incerto: true, motivo: '' };
    const grupo = grupoDeMelhoria(entrada.grupo);
    if (!grupo) return { ok: true, incerto: true, motivo: '' };
    if (Array.isArray(entrada.tambem) && item.catalogo && entrada.tambem.indexOf(item.catalogo) !== -1) return { ok: true, incerto: false, motivo: '' };
    if (Array.isArray(entrada.somente) && entrada.somente.length) {
      if (!item.catalogo) return { ok: true, incerto: true, motivo: '' };
      if (entrada.somente.indexOf(item.catalogo) === -1) {
        const nomes = entrada.somente.map(function (c) { const e = itemDoCatalogo(c); return e ? e.nome : c; });
        return { ok: false, incerto: false, motivo: 'serve só para ' + nomes.join(' e ') };
      }
    }
    const natureza = grupoDoItem(item);
    if (!natureza) return { ok: true, incerto: true, motivo: '' };
    const alvos = Array.isArray(entrada.so) && entrada.so.length ? entrada.so.filter(function (a) { return grupo.alvos.indexOf(a) !== -1; }) : grupo.alvos;
    if (alvos.indexOf(natureza) !== -1) return { ok: true, incerto: false, motivo: '' };
    return { ok: false, incerto: false, motivo: 'serve para ' + nomesDosGrupos(alvos) };
  }

  /** Espaços usados = soma de espaços (com as melhorias) × quantidade de TODOS os itens. */
  function espacosUsados(ficha) {
    const total = itensDaFicha(ficha).reduce(function (soma, item) {
      return soma + espacosDoItem(item) * quantidadeItem(item);
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
        return categoriaEfetivaItem(item) === categoria.valor; // a categoria que conta é a efetiva (com as melhorias)
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
    return protecoesEquipadas(ficha).reduce(function (soma, item) { return soma + defesaDoItem(item); }, 0);
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

  /** Penalidade (positiva) por não ter o kit da perícia no inventário; 0 se não exige kit ou se tem o kit. */
  function penalidadeSemKit(ficha, idPericia) {
    const definicao = definicaoPericia(idPericia) || {};
    return definicao.kit && !kitAtivo(ficha, idPericia) ? Math.max(0, numero(OP.data.config.penalidadeSemKit)) : 0;
  }

  /** Itens cuja categoria efetiva passa da maior categoria (IV): [{ id, nome, categoria }]. */
  function itensAcimaDeIV(ficha) {
    const maxima = OP.data.categoriasItem[OP.data.categoriasItem.length - 1].valor;
    return itensDaFicha(ficha).filter(function (item) { return categoriaEfetivaItem(item) > maxima; })
      .map(function (item) { return { id: item.id, nome: String(item.nome || '').trim(), categoria: categoriaEfetivaItem(item) }; });
  }

  /**
   * O que a tela mostra de cada item com melhorias: { [id]: { categoriaBase, categoriaEfetiva, aumento (das melhorias),
   * ajuste (dos modificadores de categoria), espacosBase, espacosEfetivos, defesaBase, defesaEfetiva, ajustes,
   * melhorias: [{ id, vale, ok, incerto, motivo, aumento }] } } (melhorias na ordem de item.melhorias).
   */
  function detalhesDosItens(ficha) {
    const r = Object.create(null);
    itensDaFicha(ficha).forEach(function (item) {
      if (typeof item.id !== 'string') return;
      const vale = melhoriasQueValem(item);
      const aumentos = aumentosDasMelhorias(item);
      r[item.id] = {
        categoriaBase: categoriaBaseItem(item),
        categoriaEfetiva: categoriaEfetivaItem(item),
        aumento: aumentoDeCategoria(item),
        ajuste: ajusteDeCategoria(item),
        espacosBase: Math.max(0, numero(item.espacos)),
        espacosEfetivos: espacosDoItem(item),
        defesaBase: numero(item.defesa),
        defesaEfetiva: defesaDoItem(item),
        ajustes: ajustesDoItem(item),
        melhorias: melhoriasDoItem(item).map(function (m, j) {
          const comp = compatibilidadeMelhoria(item, m);
          return { id: m.id, vale: vale.indexOf(m) !== -1, ok: comp.ok, incerto: comp.incerto, motivo: comp.motivo, aumento: aumentos[j] };
        })
      };
    });
    return r;
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
      itens: detalhesDosItens(ficha),
      acimaDeIV: itensAcimaDeIV(ficha),
      defesaProtecoes: defesaProtecoes(ficha),
      nomesProtecoes: protecoesEquipadas(ficha).map(function (item) { return item.nome; }),
      penalidadeCarga: penalidadeCarga(ficha)
    };
  }

  /**
   * Correções para dados inválidos do inventário: patente inexistente volta
   * à primeira, crédito inexistente volta ao padrão (null), tipo inválido vira
   * "geral", categoria fica entre 0 e 4, kit sem perícia válida vira null,
   * natureza desconhecida vira "" e melhoria de classe desconhecida vira modificação.
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
      if (typeof item.grupo === 'string' && item.grupo !== '' && !grupoDeItem(item.grupo)) {
        correcoes.push({ caminho: caminho + '.grupo', valor: '' });
      }
      (Array.isArray(item.melhorias) ? item.melhorias : []).forEach(function (melhoria, j) {
        if (melhoria !== null && typeof melhoria === 'object' && !classeDeMelhoria(melhoria.classe)) {
          correcoes.push({ caminho: caminho + '.melhorias.' + j + '.classe', valor: 'modificacao' });
        }
      });
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
  function periciasConcedidasBaseDetalhe(ficha) {
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

  /** Ids das perícias concedidas só pela classe e pela origem (sem efeitos de poderes). */
  function periciasConcedidasBase(ficha) {
    return periciasConcedidasBaseDetalhe(ficha).map(function (item) { return item.id; });
  }

  /** Perícias concedidas pela classe, pela origem e por efeitos de poderes ("treino"): [{ id, fonte }]. */
  function periciasConcedidasDetalhe(ficha) {
    const lista = periciasConcedidasBaseDetalhe(ficha);
    treinosDeEfeitos(ficha).concede.forEach(function (id) {
      if (!lista.some(function (item) { return item.id === id; })) lista.push({ id: id, fonte: 'poder' });
    });
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
    return resolverReserva(atributo ? totalAtributo(ficha, atributo) : 0, dadosCondicoesPericia(ficha, idPericia) + dadosAlteracoesPericia(ficha, idPericia));
  }

  /** Texto dos dados: { qtd: 3, modo: 'maior' } → "3d20 maior". */
  function formatarDados(dados) {
    return dados.qtd + 'd20 ' + dados.modo;
  }

  /**
   * Bônus da perícia = bônus do grau + outros
   *   − config.penalidadeSemKit (se a perícia exige kit e o kit não está no inventário)
   *   − penalidade de carga (se a perícia tem o sinalizador de carga).
   * O atributo fica de fora.
   * Usado também por Bloqueio, Esquiva e Iniciativa: manter nome e formato
   * (recebe ficha e id, devolve número).
   */
  function periciaBonus(ficha, idPericia) {
    const definicao = definicaoPericia(idPericia) || {};
    let bonus = bonusDoGrau(grauEfetivo(ficha, idPericia)) + numero(periciaSalva(ficha, idPericia).outros);
    bonus -= penalidadeSemKit(ficha, idPericia);
    if (definicao.penalidadeCarga) bonus -= penalidadeCarga(ficha);
    bonus += bonusAlteracoesPericia(ficha, idPericia); // alterações de NEX (regra opcional)
    bonus += bonusEfeitosPericia(ficha, idPericia);    // poderes e habilidades com efeito automático
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
      dadosAlteracoes: dadosAlteracoesPericia(ficha, idPericia), // idem, das alterações de NEX
      bonusAlteracoes: bonusAlteracoesPericia(ficha, idPericia),
      grau: grau,
      grauSalvo: grauDaPericia(ficha, idPericia),
      concedidaPor: fonteConcedida(ficha, idPericia), // 'classe' | 'origem' | null
      treinada: grau >= 1,
      requerTreinamento: definicao.somenteTreinada === true && grau === 0 && !(idPericia === 'ocultismo' && efeitosAlteracoes(ficha).ocultismoSemTreino),
      bonus: periciaBonus(ficha, idPericia),
      penalidadeCarga: definicao.penalidadeCarga ? penalidadeCarga(ficha) : 0,
      kitAtivo: definicao.kit ? kitAtivo(ficha, idPericia) : false,
      penalidadeKit: penalidadeSemKit(ficha, idPericia)
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
      condicoes: modificadoresCondicoes(ficha).defesa, // o mais severo entre as condições ativas
      efeitos: efeitosDaFicha(ficha).def // poderes e habilidades com efeito automático
    };
    composicao.total = composicao.base + composicao.valorAtributo + composicao.protecoesInventario +
      composicao.protecao + composicao.outros - composicao.sobrecarga + composicao.condicoes + composicao.efeitos;
    // Defesa contra um tipo de ataque (Caído: −5 contra corpo a corpo, +5 contra à distância)
    const mod = modificadoresCondicoes(ficha);
    composicao.totalCorpoACorpo = composicao.total - composicao.condicoes + mod.defesaCorpoACorpo;
    composicao.totalDistancia = composicao.total - composicao.condicoes + mod.defesaDistancia;
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
    const bonus = numero(defesaSalva(ficha).deslocamentoBonus) + efeitosDaFicha(ficha).desl;
    const sobrecarga = sobrecarregado(ficha) ? numero(config.sobrecarga.deslocamento) : 0;
    const mod = modificadoresCondicoes(ficha);
    const multiplicador = mod.deslocamentoMult;
    const maximo = mod.deslocamentoMax;
    const passo = OP.data.regrasDefesa.metrosPorQuadrado;
    const metrosAntes = Math.max(0, base + bonus - sobrecarga);
    // Reduzir (Lento) arredonda para baixo, para o incremento de 1,5 m (um quadrado)
    let metros = multiplicador < 1
      ? Math.floor(metrosAntes * multiplicador / passo + 1e-9) * passo
      : Math.round(metrosAntes * multiplicador * 100) / 100;
    if (maximo !== null && maximo !== undefined) metros = Math.min(metros, Math.max(0, numero(maximo)));
    metros = Math.round(metros * 100) / 100;
    // a pequena folga evita erro de arredondamento (ex.: 10,5 / 1,5)
    const quadrados = Math.floor(metros / passo + 1e-9);
    return {
      base: base, bonus: bonus, sobrecarga: sobrecarga, metros: metros, quadrados: quadrados,
      multiplicador: multiplicador, maximo: maximo === undefined ? null : maximo, metrosAntesCondicoes: metrosAntes
    };
  }

  /** Dados e bônus de uma perícia (para Iniciativa, Fortitude, Reflexos e Vontade). */
  function derivadasPericia(ficha, idPericia) {
    return {
      dados: periciaDados(ficha, idPericia),
      bonus: periciaBonus(ficha, idPericia)
    };
  }

  /**
   * RD (redução de dano) cadastrada na ficha, na ordem da lista:
   * [{ id, nome, valor (inteiro ≥ 0), tipos: [ids de OP.data.tiposDano marcados] }].
   * Entradas que não são objetos saem; ids de tipo desconhecidos ficam de fora.
   */
  function listaRd(ficha) {
    const bruta = defesaSalva(ficha).rd;
    return (Array.isArray(bruta) ? bruta : []).filter(function (rd) {
      return rd !== null && typeof rd === 'object';
    }).map(function (rd) {
      const marcados = rd.tipos && typeof rd.tipos === 'object' ? rd.tipos : {};
      return {
        id: rd.id,
        nome: typeof rd.nome === 'string' ? rd.nome.trim() : '',
        valor: Math.max(0, Math.trunc(numero(rd.valor))),
        tipos: OP.data.tiposDano.filter(function (tipo) { return marcados[tipo.id] === true; }).map(function (tipo) { return tipo.id; })
      };
    });
  }

  /**
   * Estado da RD: a lista, quantas valem (valor > 0 e ao menos um tipo marcado)
   * e o total por tipo (as RD que cobrem o tipo se somam).
   */
  function estadoRd(ficha) {
    const lista = listaRd(ficha);
    const porTipo = {};
    let ativas = 0;
    lista.forEach(function (rd) {
      if (rd.valor <= 0 || !rd.tipos.length) return;
      ativas += 1;
      rd.tipos.forEach(function (idTipo) { porTipo[idTipo] = (porTipo[idTipo] || 0) + rd.valor; });
    });
    return { lista: lista, ativas: ativas, porTipo: porTipo };
  }

  /** Quantas RD valem (valor maior que 0 e ao menos um tipo de dano marcado). */
  function resistenciasAtivas(ficha) {
    return estadoRd(ficha).ativas;
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
      dados: resolverReserva(atributo ? totalAtributo(ficha, atributo) : 0, numero(modDados) + dadosCondicoesPericia(ficha, idPericia) + dadosAlteracoesPericia(ficha, idPericia) + dadosEfeitosPericia(ficha, idPericia)),
      bonus: periciaBonus(ficha, idPericia)
    };
  }

  /** Teste puro de um atributo (sem perícia): { dados: { qtd, modo }, bonus: 0 }. As condições que mexem no atributo entram. */
  function testeAtributo(ficha, idAtributo, modDados) {
    const dadosCond = modificadorDadosTeste(modificadoresCondicoes(ficha), { atributo: idAtributo });
    return { dados: resolverReserva(totalAtributo(ficha, idAtributo), numero(modDados) + dadosCond + dadosAlteracoesAtributo(ficha, idAtributo) + dadosEfeitosAtributo(ficha, idAtributo)), bonus: 0 };
  }

  /**
   * Teste de ataque: o atributo vem da perícia do ataque (padrão ou o escolhido
   * na ficha) e bonus = periciaBonus(perícia) + testeBonus do ataque.
   */
  function ataqueTeste(ficha, ataque, modDados) {
    // dadosCondicoesAtaque já traz as condições da perícia e as de ataque (ex.: Agarrado, Caído)
    const atributo = atributoDaPericia(ficha, ataque.pericia);
    return {
      dados: resolverReserva(atributo ? totalAtributo(ficha, atributo) : 0, numero(modDados) + dadosCondicoesAtaque(ficha, ataque) + dadosAlteracoesPericia(ficha, ataque.pericia) + dadosEfeitosAtaque(ficha, ataque)),
      bonus: periciaBonus(ficha, ataque.pericia) + numero(ataque.testeBonus) + bonusEfeitosAtaque(ficha, ataque).teste
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
     Regra opcional NEX e Experiência: alterações de NEX
     (textos e números em data/alteracoes-nex.js). Só valem com ficha.config.nexENivel.
     O elemento é o elemento conectado da ficha (um só por ficha). Os efeitos ficam
     SEPARADOS dos das condições: dados de alteração somam com os de condição
     (fontes diferentes), e dentro das alterações um estágio novo troca o anterior
     ("aumenta para"). Tudo cumulativo, como diz o livro.
     ------------------------------------------------------------------------ */

  const ELEMENTOS_ALTERACOES = ['sangue', 'morte', 'conhecimento', 'energia'];

  function normalizarNome(texto) {
    return String(texto === null || texto === undefined ? '' : texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function alteracoesSalvas(ficha) {
    const salvo = ficha && ficha.alteracoesNex;
    return salvo !== null && typeof salvo === 'object' && !Array.isArray(salvo) ? salvo : {};
  }

  /** Elemento das alterações: o elemento conectado, se for Sangue, Morte, Conhecimento ou Energia. */
  function elementoDasAlteracoes(ficha) {
    const id = ficha && ficha.conjuracao && ficha.conjuracao.elementoConectado;
    return ELEMENTOS_ALTERACOES.indexOf(id) !== -1 ? id : null;
  }

  /** Alterações já alcançadas pelo NEX (exposição): as gerais e as do elemento. [] com a regra desligada. */
  function alteracoesAlcancadas(ficha) {
    const dados = OP.data.alteracoesNex;
    if (!regraNexNivel(ficha) || !dados) return [];
    const nex = nexExposicao(ficha);
    const elemento = elementoDasAlteracoes(ficha);
    let lista = dados.gerais.slice();
    if (elemento && dados.elementos[elemento]) lista = lista.concat(dados.elementos[elemento].alteracoes);
    return lista.filter(function (alteracao) { return alteracao.nex <= nex; });
  }

  function efeitosAlteracoesNeutros() {
    return {
      ativa: false, nex: 0, elemento: null, alcancadas: [],
      ocultismoSemTreino: false,
      bonusPericia: {},                                   // bônus fixos por perícia (+2 Ocultismo, −5 das escolhas)
      dadosPericias: 0,
      dadosAtributos: { agi: 0, for: 0, int: 0, pre: 0, vig: 0 },
      dadosPorPericia: {},                                // dados (+/−) por perícia
      dadosAtaque: 0,
      dadosAtaqueCorpoACorpo: 0,
      bonusPE: null,                                      // { atributo, valor }: atributo escolhido no NEX 35%
      condicoes: [],                                      // condições mantidas pelas alterações: { id, efeitos, nome }
      reducaoRitual: [],                                  // rituais com −1 PE: { nome, nota, norm }
      lembretes: [],
      pendencias: [],                                     // escolhas por fazer: { campo, rotulo, alteracao }
      interacaoSocialPE: 0,                               // NEX 90% de Morte: PE perdidos na 1ª interação social da cena
      suspensaoDisponivel: false,                         // NEX 90% de Sangue: Forma Monstruosa suspende as penalidades
      escuridaoAlternavel: false,                         // NEX 90% de Conhecimento: cego fora da escuridão
      intensidadeEnergia: 0,                              // 1, 2 ou 3 (NEX 60%, 75% ou 90% de Energia)
      energia: { d6: 0, valores: [], intensidade: 0 }     // efeito sorteado da cena
    };
  }

  const ALTERACOES_NEUTRAS = efeitosAlteracoesNeutros();

  function somarEm(mapa, id, valor) {
    mapa[id] = (mapa[id] || 0) + valor;
  }

  /** Tudo o que as alterações de NEX fazem nesta ficha (ver efeitosAlteracoesNeutros). */
  function efeitosAlteracoes(ficha) {
    if (!regraNexNivel(ficha)) return ALTERACOES_NEUTRAS;
    const r = efeitosAlteracoesNeutros();
    const salvas = alteracoesSalvas(ficha);
    const alcancadas = alteracoesAlcancadas(ficha);
    r.ativa = true;
    r.nex = nexExposicao(ficha);
    r.elemento = elementoDasAlteracoes(ficha);
    r.alcancadas = alcancadas.map(function (a) { return a.id; });

    const bons = {};
    const penalidades = {};
    let condicao = null;
    alcancadas.forEach(function (alteracao) {
      const e = alteracao.efeitos || {};
      if (e.ocultismoSemTreino) r.ocultismoSemTreino = true;
      Object.keys(e.bonusPericiaTreinada || {}).forEach(function (id) {
        if (grauEfetivo(ficha, id) >= 1) somarEm(r.bonusPericia, id, numero(e.bonusPericiaTreinada[id]));
      });
      if (e.escolhaPenalidade) {
        const esc = e.escolhaPenalidade;
        if (esc.opcoes.indexOf(salvas[esc.campo]) !== -1) somarEm(r.bonusPericia, salvas[esc.campo], numero(esc.valor));
        else r.pendencias.push({ campo: esc.campo, rotulo: esc.rotulo, alteracao: alteracao.titulo });
      }
      if (e.escolhaAtributoPE) {
        const esc = e.escolhaAtributoPE;
        if (esc.opcoes.indexOf(salvas[esc.campo]) !== -1) r.bonusPE = { atributo: salvas[esc.campo], valor: totalAtributo(ficha, salvas[esc.campo]) };
        else r.pendencias.push({ campo: esc.campo, rotulo: esc.rotulo, alteracao: alteracao.titulo });
      }
      Object.assign(bons, e.dadosPorPericia || {});
      Object.assign(penalidades, e.penalidadeDadosPorPericia || {});
      if (e.condicaoPermanente) condicao = e.condicaoPermanente;
      (e.reducaoRitual || []).forEach(function (ritual) {
        r.reducaoRitual.push({ nome: ritual.nome, nota: ritual.nota || '', norm: normalizarNome(ritual.nome) });
      });
      (e.lembretes || []).forEach(function (texto) { r.lembretes.push(texto); });
      if (e.interacaoSocialPE) r.interacaoSocialPE = numero(e.interacaoSocialPE);
      if (e.suspensao === 'sangue') r.suspensaoDisponivel = true;
      if (e.escuridaoAlternavel) r.escuridaoAlternavel = true;
      if (e.energia) r.intensidadeEnergia = numero(e.energia);
    });

    // Forma Monstruosa (+2 PE): as penalidades causadas pelas alterações de Sangue ficam suspensas
    if (r.elemento === 'sangue' && salvas.sangueSuspenso === true && r.suspensaoDisponivel) {
      Object.keys(penalidades).forEach(function (id) { delete penalidades[id]; });
    }
    Object.keys(bons).forEach(function (id) { somarEm(r.dadosPorPericia, id, numero(bons[id])); });
    Object.keys(penalidades).forEach(function (id) { somarEm(r.dadosPorPericia, id, numero(penalidades[id])); });

    // Condição que a alteração mantém (Conhecimento: ofuscado, e cego fora da escuridão no NEX 90%)
    if (condicao) {
      const efetiva = salvas.escuridao === true && condicao.escuridao ? condicao.escuridao : condicao;
      const definicao = definicaoCondicao(efetiva.id);
      if (definicao) {
        r.condicoes.push({
          id: efetiva.id, efeitos: efetiva.efeitos || null,
          nome: definicao.nome + ' (alteração de NEX)', nomeCurto: efetiva.nomeExibido || definicao.nome
        });
      }
    }

    // Energia: o efeito 1 do 1d6 (−Xd20 em Presença e nas perícias baseadas, exceto Vontade)
    const energia = salvas.energia && typeof salvas.energia === 'object' ? salvas.energia : {};
    if (r.intensidadeEnergia > 0) {
      const d6 = Math.min(6, Math.max(0, Math.trunc(numero(energia.d6))));
      const intensidade = Math.min(3, Math.max(1, Math.trunc(numero(energia.intensidade)) || r.intensidadeEnergia));
      r.energia = {
        d6: d6, intensidade: intensidade,
        valores: Array.isArray(energia.valores) ? energia.valores.map(function (v) { return Math.trunc(numero(v)); }) : []
      };
      if (d6 === 1) {
        r.dadosAtributos.pre -= intensidade;
        somarEm(r.dadosPorPericia, 'vontade', intensidade);
      }
    }
    return r;
  }

  /** Bônus fixo das alterações numa perícia (+2 em Ocultismo para treinados, −5 das escolhas). */
  function bonusAlteracoesPericia(ficha, idPericia) {
    return numero(efeitosAlteracoes(ficha).bonusPericia[idPericia]);
  }

  /** Dados das alterações no teste de uma perícia (soma com os das condições: são fontes diferentes). */
  function dadosAlteracoesPericia(ficha, idPericia) {
    const e = efeitosAlteracoes(ficha);
    if (!e.ativa) return 0;
    return modificadorDadosTeste(e, { atributo: atributoDaPericia(ficha, idPericia), ehPericia: true, idPericia: idPericia });
  }

  /** Dados das alterações num teste puro de atributo. */
  function dadosAlteracoesAtributo(ficha, idAtributo) {
    const e = efeitosAlteracoes(ficha);
    return e.ativa ? modificadorDadosTeste(e, { atributo: idAtributo }) : 0;
  }

  /** −1 PE no custo do ritual se uma alteração de NEX o reduz (o personagem já o conhece: está na lista). 0 ou 1. */
  function reducaoCustoRitual(ficha, ritual) {
    const e = efeitosAlteracoes(ficha);
    if (!e.ativa || !ritual) return 0;
    const nome = normalizarNome(ritual.nome);
    return nome && e.reducaoRitual.some(function (r) { return r.norm === nome; }) ? 1 : 0;
  }

  /** Custo de um ritual com as condições (Alquebrado) e a redução das alterações de NEX; nunca abaixo de 0. */
  function custoRitualFinal(ficha, ritual, custoBase) {
    const comCondicoes = custoComCondicoes(ficha, custoBase);
    return comCondicoes > 0 ? Math.max(0, comCondicoes - reducaoCustoRitual(ficha, ritual) + ajusteCustoRitualEfeitos(ficha, ritual)) : comCondicoes;
  }

  /** Valor do d6 de Energia: nível de intensidade pelo NEX, e a perda de Sanidade/PD do "tique" esquecido. */
  function intensidadeEnergia(ficha) {
    return efeitosAlteracoes(ficha).intensidadeEnergia;
  }

  /** Correções das escolhas das alterações (valor que não existe volta ao vazio). */
  function correcoesAlteracoesNex(ficha) {
    const correcoes = [];
    const salvas = alteracoesSalvas(ficha);
    const dados = OP.data.alteracoesNex;
    if (!dados) return correcoes;
    const campos = {};
    dados.gerais.forEach(function (a) {
      const e = a.efeitos || {};
      if (e.escolhaPenalidade) campos[e.escolhaPenalidade.campo] = e.escolhaPenalidade.opcoes;
      if (e.escolhaAtributoPE) campos[e.escolhaAtributoPE.campo] = e.escolhaAtributoPE.opcoes;
    });
    Object.keys(campos).forEach(function (campo) {
      const valor = salvas[campo];
      if (valor !== '' && campos[campo].indexOf(valor) === -1) correcoes.push({ caminho: 'alteracoesNex.' + campo, valor: '' });
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
   * (Presença), ou o escolhido em ficha.config.atributoDT (algumas habilidades
   * trocam o atributo), + bônus manual (conjuracao.dtBonus).
   * Ex.: PRE 3 e NEX 5% → 14; PRE 5 e NEX 99% → 35.
   * Devolve { total, partes: { base, limitePE, atributo, bonus }, idAtributo, somaLimitePE }.
   */
  function dtRituais(ficha) {
    const regra = OP.data.config.dtRitual;
    const escolhido = ficha.config && ficha.config.atributoDT;
    const idAtributo = ehAtributoValido(escolhido) ? escolhido : regra.atributo;
    const dt = dtHabilidade(ficha, idAtributo);
    const bonus = numero(ficha.conjuracao && ficha.conjuracao.dtBonus);
    const efeitos = efeitosDaFicha(ficha).dt;
    return {
      total: dt.total + bonus + efeitos,
      partes: Object.assign({}, dt.partes, { bonus: bonus, efeitos: efeitos }),
      idAtributo: idAtributo,
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
    // Sem Sanidade: a perda de Sanidade vira perda de PD (não conta no limite por turno, e não há perda permanente)
    const semSan = semSanidade(ficha);
    const pe = inteiroNaoNegativo(c.pe);
    const perdaMental = semSan ? inteiroNaoNegativo(c.san) : 0;
    const san = semSan ? 0 : inteiroNaoNegativo(c.san);
    const permanente = semSan ? 0 : inteiroNaoNegativo(c.permanente);
    const limite = limitePEporTurno(ficha);
    const gastoAntes = inteiroNaoNegativo(ficha.conjuracao && ficha.conjuracao.peGastoTurno);
    const estadoPe = estadoRecurso(ficha, 'pe');

    const projecao = {
      ok: true,
      motivo: '',
      pe: pe,
      san: san,
      perdaMental: perdaMental,
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

    if (pe > 0 || perdaMental > 0) {
      if (!estadoPe.classeDefinida) return Object.assign(projecao, { ok: false, motivo: 'Escolha uma classe para calcular o PE.' });
      if (pe > estadoPe.atual) return Object.assign(projecao, { ok: false, motivo: 'PE insuficiente' });
      // A perda mental (só sem Sanidade) tira PD até 0, sem impedir a conjuração
      projecao.peDepois = Math.max(0, estadoPe.atual - pe - perdaMental);
      projecao.mudancas.push({ caminho: 'recursos.pe.atual', valor: projecao.peDepois });
      if (pe > 0) {
        projecao.peGastoTurnoDepois = gastoAntes + pe;
        projecao.avisoLimite = projecao.peGastoTurnoDepois > limite;
        projecao.mudancas.push({ caminho: 'conjuracao.peGastoTurno', valor: projecao.peGastoTurnoDepois });
      }
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
      pe: custoRitualFinal(ficha, ritual, custo),
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
    const liberados = circulosLiberados(nexProgressao(ficha));
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
    return numero(ritual.circulo) > circulosLiberados(nexProgressao(ficha));
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
    const nex = nexProgressao(ficha);
    const conjuracao = ficha.conjuracao || {};
    const limite = limitePEporTurno(ficha);
    const gasto = Math.max(0, numero(conjuracao.peGastoTurno));
    const conectado = afinidadeValida(conjuracao.elementoConectado) ? conjuracao.elementoConectado : null;
    return {
      dt: dtRituais(ficha),
      circulosLiberados: circulosLiberados(nex),
      afinidadeLiberada: afinidadeLiberada(nexExposicao(ficha)), // a afinidade segue o NEX (exposição)
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
        const textoCura = String(forma.cura || '').trim();
        const analiseCura = textoCura ? OP.dados.analisarFormula(textoCura) : { ok: false, erro: '' };
        const custo = custoForma(ritual, definicao.id);
        formas[definicao.id] = {
          ativa: definicao.id === 'padrao' || forma.ativa === true,
          custo: custo,
          custoComCondicoes: custoRitualFinal(ficha, ritual, custo),
          reducaoAlteracao: custo > 0 ? reducaoCustoRitual(ficha, ritual) : 0,
          adicional: definicao.id === 'padrao' ? 0 : inteiroNaoNegativo(forma.custoAdicional),
          requerCirculo: definicao.id === 'padrao' ? null : circuloValido(forma.requerCirculo),
          requerAfinidade: definicao.id !== 'padrao' && forma.requerAfinidade === true,
          avisos: avisosForma(ficha, ritual, definicao.id),
          san: medo && regraMedo.sanPorCusto ? custo : 0,
          permanente: medo ? inteiroNaoNegativo(regraMedo.perdaPermanente[definicao.id]) : 0,
          temDano: texto !== '',
          danoValido: texto !== '' && analise.ok,
          danoErro: texto !== '' && !analise.ok ? analise.erro : '',
          temCura: textoCura !== '',
          curaValida: textoCura !== '' && analiseCura.ok,
          curaErro: textoCura !== '' && !analiseCura.ok ? analiseCura.erro : ''
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
    if (regraNexNivel(ficha)) {
      // NEX e Experiência: o NEX é a exposição (0 a 99, qualquer inteiro: +1%, +2%, + círculo do ritual...)
      const exposicao = Math.min(99, Math.max(0, Math.trunc(numero(identificacao.nex))));
      if (identificacao.nex !== exposicao) correcoes.push({ caminho: 'identificacao.nex', valor: exposicao });
    } else if (OP.data.nex.indexOf(identificacao.nex) === -1) {
      correcoes.push({ caminho: 'identificacao.nex', valor: nexValido(identificacao.nex) });
    }
    if (identificacao.nivel !== nivelDaFicha(ficha)) correcoes.push({ caminho: 'identificacao.nivel', valor: nivelDaFicha(ficha) });
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

  /**
   * Habilidades que a ficha ganha sozinha: a da origem, as da classe (marcos da progressão), as da trilha já
   * liberadas pelo NEX (ou estágio) e a da versatilidade (a partir do NEX 50%). Devolve [{ id, nome, fonte, catalogo }].
   * O id leva a origem/trilha/marco: trocar a origem ou a trilha troca as habilidades. Ids "auto-…".
   * catalogo é a chave do livro (só existe com o conteúdo liberado; vazio sem ele).
   */
  function habilidadesAutomaticas(ficha) {
    const lista = [];
    const ident = (ficha && ficha.identificacao) || {};
    const cat = catalogoLivro();
    function id(partes) {
      return ('auto-' + partes.join('-')).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    }
    const origem = origemDados(ident.origem);
    if (origem && origem.habilidade) {
      lista.push({ id: id(['origem', origem.id]), nome: origem.habilidade, fonte: 'origem', catalogo: (cat.origens && cat.origens[origem.id]) || '' });
    }
    // Habilidades da classe (Ataque especial, Eclético, Perito, Escolhido pelo Outro Lado...): os marcos da tabela de
    // progressão, uma vez só cada (ex.: Ataque especial vale a partir do NEX 5%), já liberados pelo NEX ou estágio
    const classe = classeDaFicha(ficha);
    if (classe && Array.isArray(classe.progressao)) {
      const nivel = nivelProgressao(ficha);
      const vistas = Object.create(null);
      classe.progressao.forEach(function (linha) {
        if (nivelDaLinha(linha) > nivel) return;
        (linha.itens || []).forEach(function (marco) {
          if (!marco || (marco.tipo !== 'marco' && marco.tipo !== 'circulo') || typeof marco.rotulo !== 'string') return;
          const base = marco.rotulo.replace(/\s*\([^)]*\)\s*$/, '').trim();
          const chave = normalizarNome(base);
          if (!chave || vistas[chave]) return;
          vistas[chave] = true;
          const livro = (cat.classe && cat.classe[classe.id]) || [];
          const achada = livro.find(function (h) { return normalizarNome(h.nome) === chave; });
          lista.push({ id: id(['classe', classe.id, chave]), nome: base.charAt(0).toUpperCase() + base.slice(1), fonte: 'classe',
            catalogo: (achada && achada.chave) || '' });
        });
      });
    }
    const trilha = trilhaDaFicha(ficha);
    if (trilha) {
      habilidadesTrilha(ficha).forEach(function (h) {
        if (!h.liberada) return;
        lista.push({ id: id(['trilha', trilha.id, h.marco]), nome: h.nome, fonte: 'trilha',
          catalogo: (cat.trilhas && cat.trilhas[trilha.id] && cat.trilhas[trilha.id][String(h.marco)]) || '' });
      });
    }
    const versat = habilidadeVersatilidade(ficha);
    if (versat && versat.liberada) {
      lista.push({ id: id(['versatilidade', versat.trilha, versat.marco]), nome: versat.nome, fonte: 'trilha',
        catalogo: (cat.trilhas && cat.trilhas[versat.trilha] && cat.trilhas[versat.trilha][String(versat.marco)]) || '' });
    }
    return lista;
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

  function nomeDaPericiaCond(id) {
    const definicao = definicaoPericia(id);
    return definicao ? definicao.nome : String(id);
  }

  function textoMetros(n) {
    return String(Math.round(n * 100) / 100).replace('.', ',') + ' m';
  }

  /** Objeto (nunca nulo) dentro de um campo de efeitos. */
  function mapaDe(efeitos, campo) {
    const valor = efeitos && efeitos[campo];
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
  }

  /** Resumo dos números de um efeito: "−1d20 em perícias; Defesa −2". '' se não houver efeito. */
  function resumoEfeitos(efeitos) {
    if (!efeitos || typeof efeitos !== 'object') return '';
    const partes = [];
    const dadosPericias = numero(efeitos.dadosPericias);
    if (dadosPericias) partes.push(textoMenos(dadosPericias) + 'd20 em perícias');
    const atributos = mapaDe(efeitos, 'dadosAtributos');
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
    const porPericia = mapaDe(efeitos, 'dadosPorPericia');
    Object.keys(porPericia).forEach(function (id) {
      if (numero(porPericia[id])) partes.push(textoMenos(numero(porPericia[id])) + 'd20 em ' + nomeDaPericiaCond(id));
    });
    if (numero(efeitos.dadosAtaque)) partes.push(textoMenos(numero(efeitos.dadosAtaque)) + 'd20 em ataques');
    if (numero(efeitos.dadosAtaqueCorpoACorpo)) partes.push(textoMenos(numero(efeitos.dadosAtaqueCorpoACorpo)) + 'd20 em ataques corpo a corpo');
    const defesa = numero(efeitos.defesa);
    if (defesa) partes.push('Defesa ' + textoMenos(defesa));
    if (numero(efeitos.defesaCorpoACorpo)) partes.push('Defesa ' + textoMenos(numero(efeitos.defesaCorpoACorpo)) + ' contra corpo a corpo');
    if (numero(efeitos.defesaDistancia)) partes.push('Defesa ' + textoMenos(numero(efeitos.defesaDistancia)) + ' contra ataques à distância');
    if (efeitos.deslocamentoMult !== undefined && efeitos.deslocamentoMult !== null) {
      const mult = numero(efeitos.deslocamentoMult);
      if (mult === 0) partes.push('não se move');
      else if (mult === 0.5) partes.push('deslocamento pela metade');
      else if (mult !== 1) partes.push('deslocamento × ' + formatarMult(mult));
    }
    if (efeitos.deslocamentoMax !== undefined && efeitos.deslocamentoMax !== null) {
      partes.push('deslocamento máximo ' + textoMetros(numero(efeitos.deslocamentoMax)));
    }
    if (numero(efeitos.custoPE)) partes.push(textoMenos(numero(efeitos.custoPE)) + ' PE no custo de habilidades e rituais');
    if (numero(efeitos.resistenciaDano)) partes.push('resistência a dano ' + numero(efeitos.resistenciaDano));
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
    return {
      dadosPericias: 0,
      dadosAtributos: { agi: 0, for: 0, int: 0, pre: 0, vig: 0 },
      dadosPorPericia: {},
      dadosAtaque: 0,
      dadosAtaqueCorpoACorpo: 0, // total nos ataques corpo a corpo (já com o de todos os ataques)
      defesa: 0,
      defesaCorpoACorpo: 0, // total contra corpo a corpo (já com o geral)
      defesaDistancia: 0, // total contra ataques à distância (já com o geral)
      deslocamentoMult: 1,
      deslocamentoMax: null,
      custoPE: 0,
      resistenciaDano: 0,
      origens: []
    };
  }

  /**
   * Efeitos de uma condição como pares { chave: valor } (só os diferentes de neutro).
   * Chaves: campos simples, "atr.<id>" e "per.<idPericia>".
   */
  function chavesDeEfeitos(efeitos) {
    const chaves = {};
    if (!efeitos || typeof efeitos !== 'object') return chaves;
    ['dadosPericias', 'dadosAtaque', 'dadosAtaqueCorpoACorpo', 'defesa', 'defesaCorpoACorpo', 'defesaDistancia',
      'custoPE', 'resistenciaDano'].forEach(function (campo) {
      if (numero(efeitos[campo])) chaves[campo] = numero(efeitos[campo]);
    });
    ['deslocamentoMult', 'deslocamentoMax'].forEach(function (campo) {
      if (efeitos[campo] !== undefined && efeitos[campo] !== null) chaves[campo] = numero(efeitos[campo]);
    });
    const atributos = mapaDe(efeitos, 'dadosAtributos');
    IDS_ATRIBUTOS_COND.forEach(function (id) {
      if (numero(atributos[id])) chaves['atr.' + id] = numero(atributos[id]);
    });
    const porPericia = mapaDe(efeitos, 'dadosPorPericia');
    Object.keys(porPericia).forEach(function (id) {
      if (numero(porPericia[id])) chaves['per.' + id] = numero(porPericia[id]);
    });
    return chaves;
  }

  /**
   * Como cada efeito acumula (Clarificações de regras: efeitos iguais não se
   * acumulam, vale o mais severo; penalidades e bônus se acumulam entre si):
   * - soma: vale a pior penalidade (menor valor negativo) + o melhor bônus (maior positivo);
   * - min / max: vale o menor / o maior (deslocamento, custo em PE, resistência).
   */
  function regraDeAcumulo(chave) {
    if (chave === 'deslocamentoMult' || chave === 'deslocamentoMax') return 'min';
    if (chave === 'custoPE' || chave === 'resistenciaDano') return 'max';
    return 'soma';
  }

  /**
   * Junta os efeitos de várias condições por chave.
   * Devolve { valores: { chave: valorFinal }, contribui: [bool por item] }.
   */
  function resolverAcumulo(itens) {
    const porChave = Object.create(null);
    itens.forEach(function (item, indice) {
      const chaves = chavesDeEfeitos(item.efeitos);
      Object.keys(chaves).forEach(function (chave) {
        (porChave[chave] = porChave[chave] || []).push({ indice: indice, valor: chaves[chave] });
      });
    });
    const valores = {};
    const contribui = itens.map(function () { return false; });
    Object.keys(porChave).forEach(function (chave) {
      const lista = porChave[chave];
      const regra = regraDeAcumulo(chave);
      let escolhidos;
      if (regra === 'min' || regra === 'max') {
        const alvo = lista.reduce(function (a, b) { return (regra === 'min' ? b.valor < a : b.valor > a) ? b.valor : a; }, lista[0].valor);
        valores[chave] = alvo;
        escolhidos = [alvo];
      } else {
        const negativos = lista.filter(function (x) { return x.valor < 0; }).map(function (x) { return x.valor; });
        const positivos = lista.filter(function (x) { return x.valor > 0; }).map(function (x) { return x.valor; });
        const pior = negativos.length ? Math.min.apply(null, negativos) : 0;
        const melhor = positivos.length ? Math.max.apply(null, positivos) : 0;
        valores[chave] = pior + melhor;
        escolhidos = [];
        if (negativos.length) escolhidos.push(pior);
        if (positivos.length) escolhidos.push(melhor);
      }
      lista.forEach(function (x) {
        if (escolhidos.indexOf(x.valor) !== -1) contribui[x.indice] = true;
      });
    });
    return { valores: valores, contribui: contribui };
  }

  /**
   * Resultado de modificadoresCondicoes escrito como efeitos (para resumoEfeitos):
   * os totais contra corpo a corpo e à distância só aparecem quando diferem do geral.
   */
  function efeitosDeModificadores(mod) {
    const efeitos = {
      dadosPericias: mod.dadosPericias, dadosAtributos: mod.dadosAtributos, dadosPorPericia: mod.dadosPorPericia,
      dadosAtaque: mod.dadosAtaque, defesa: mod.defesa, deslocamentoMult: mod.deslocamentoMult,
      deslocamentoMax: mod.deslocamentoMax, custoPE: mod.custoPE, resistenciaDano: mod.resistenciaDano
    };
    if (mod.dadosAtaqueCorpoACorpo !== mod.dadosAtaque) efeitos.dadosAtaqueCorpoACorpo = mod.dadosAtaqueCorpoACorpo;
    if (mod.defesaCorpoACorpo !== mod.defesa) efeitos.defesaCorpoACorpo = mod.defesaCorpoACorpo - mod.defesa;
    if (mod.defesaDistancia !== mod.defesa) efeitos.defesaDistancia = mod.defesaDistancia - mod.defesa;
    return efeitos;
  }

  /** Dois efeitos do mesmo tipo (geral e específico) não se acumulam: vale o pior; sinais opostos se somam. */
  function combinarEfeitos(a, b) {
    if (a < 0 && b < 0) return Math.min(a, b);
    if (a > 0 && b > 0) return Math.max(a, b);
    return a + b;
  }

  /**
   * Efeitos de todas as condições da ficha:
   * { dadosPericias, dadosAtributos: {agi,for,int,pre,vig}, dadosPorPericia: {id: n},
   *   dadosAtaque, dadosAtaqueCorpoACorpo, defesa, defesaCorpoACorpo, defesaDistancia,
   *   deslocamentoMult, deslocamentoMax, custoPE, resistenciaDano, origens: [{ condicao, texto }] }.
   * - efeitos iguais não se acumulam: por efeito vale o mais severo (resolverAcumulo);
   *   efeitos diferentes se somam;
   * - cada id conta uma vez (condicoesEfetivas, com as implicadas); as personalizadas entram como as demais;
   * - dadosAtaqueCorpoACorpo, defesaCorpoACorpo e defesaDistancia já são os TOTAIS contra esse tipo
   *   de ataque (geral e específico não se acumulam);
   * - com ficha.condicoes.aplicarEfeitos falso, tudo neutro.
   */
  function modificadoresCondicoes(ficha) {
    const salvas = condicoesSalvas(ficha);
    const resultado = modificadoresNeutros();
    if (salvas.aplicarEfeitos === false) return resultado;

    // Condições que as alterações de NEX mantêm (Conhecimento: ofuscado; no NEX 90%, cego): entram como as demais,
    // então "efeitos iguais não se acumulam" vale também contra uma condição colocada à mão.
    const mantidas = efeitosAlteracoes(ficha).condicoes;
    const comMantidas = mantidas.length
      ? Object.assign({}, salvas, { ativas: listaAtivas(salvas).concat(mantidas.filter(function (c) { return !c.efeitos; }).map(function (c) { return { id: c.id }; })) })
      : salvas;
    const itens = condicoesEfetivas(comMantidas).map(function (id) {
      const definicao = definicaoCondicao(id);
      return { nome: definicao.nome, efeitos: definicao.efeitos || null };
    });
    mantidas.filter(function (c) { return c.efeitos; }).forEach(function (c) {
      itens.push({ nome: c.nome, efeitos: c.efeitos });
    });
    listaAtivas(salvas).forEach(function (item) {
      if (item.id !== 'personalizada') return;
      const nome = item.personalizada && String(item.personalizada.nome || '').trim();
      itens.push({ nome: nome || 'Condição personalizada', efeitos: efeitosDaPersonalizada(item.personalizada) });
    });

    const junto = resolverAcumulo(itens);
    const v = junto.valores;
    function valor(chave, padrao) { return v[chave] !== undefined ? v[chave] : padrao; }
    resultado.dadosPericias = valor('dadosPericias', 0);
    IDS_ATRIBUTOS_COND.forEach(function (id) { resultado.dadosAtributos[id] = valor('atr.' + id, 0); });
    Object.keys(v).forEach(function (chave) {
      if (chave.indexOf('per.') === 0) resultado.dadosPorPericia[chave.slice(4)] = v[chave];
    });
    resultado.dadosAtaque = valor('dadosAtaque', 0);
    resultado.dadosAtaqueCorpoACorpo = combinarEfeitos(resultado.dadosAtaque, valor('dadosAtaqueCorpoACorpo', 0));
    resultado.defesa = valor('defesa', 0);
    resultado.defesaCorpoACorpo = combinarEfeitos(resultado.defesa, valor('defesaCorpoACorpo', 0));
    resultado.defesaDistancia = combinarEfeitos(resultado.defesa, valor('defesaDistancia', 0));
    resultado.deslocamentoMult = valor('deslocamentoMult', 1);
    resultado.deslocamentoMax = valor('deslocamentoMax', null);
    resultado.custoPE = valor('custoPE', 0);
    resultado.resistenciaDano = valor('resistenciaDano', 0);

    itens.forEach(function (item, indice) {
      const texto = resumoEfeitos(item.efeitos);
      if (!texto) return;
      resultado.origens.push({
        condicao: item.nome,
        texto: junto.contribui[indice] ? texto : texto + ' (não acumula: vale o mais severo)'
      });
    });
    return resultado;
  }

  /**
   * Dados a somar (negativo = tirar) num teste. opcoes:
   * - ehPericia: soma dadosPericias (e dadosPorPericia da perícia idPericia);
   * - atributo: soma dadosAtributos desse atributo (vale também no teste puro de atributo);
   * - ataque: "corpo" (Luta) ou "distancia"/true: soma os dados de ataque das condições.
   */
  function modificadorDadosTeste(mod, opcoes) {
    const o = opcoes || {};
    const m = mod || {};
    const doAtributo = m.dadosAtributos && o.atributo ? numero(m.dadosAtributos[o.atributo]) : 0;
    const daPericia = o.ehPericia && o.idPericia && m.dadosPorPericia ? numero(m.dadosPorPericia[o.idPericia]) : 0;
    let doAtaque = 0;
    if (o.ataque === 'corpo') doAtaque = numero(m.dadosAtaqueCorpoACorpo);
    else if (o.ataque) doAtaque = numero(m.dadosAtaque);
    return Math.trunc((o.ehPericia ? numero(m.dadosPericias) : 0) + doAtributo + daPericia + doAtaque);
  }

  /** Dados das condições no teste de uma perícia da ficha. */
  function dadosCondicoesPericia(ficha, idPericia) {
    return modificadorDadosTeste(modificadoresCondicoes(ficha), {
      atributo: atributoDaPericia(ficha, idPericia), ehPericia: true, idPericia: idPericia
    });
  }

  /** Dados das condições num ataque: os da perícia do ataque (Luta ou Pontaria) mais os dos testes de ataque. */
  function dadosCondicoesAtaque(ficha, ataque) {
    const idPericia = ataque && ataque.pericia;
    return modificadorDadosTeste(modificadoresCondicoes(ficha), {
      atributo: atributoDaPericia(ficha, idPericia), ehPericia: true, idPericia: idPericia,
      ataque: idPericia === 'luta' ? 'corpo' : 'distancia'
    });
  }

  /** Acréscimo no custo de PE (Alquebrado) — só vale para o que já custa PE. */
  function custoComCondicoes(ficha, custoBase) {
    const base = Math.max(0, Math.trunc(numero(custoBase)));
    return base > 0 ? base + Math.max(0, Math.trunc(modificadoresCondicoes(ficha).custoPE)) : base;
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
    // Sem Sanidade: dormir recupera só PV (os PD voltam com a ação de relaxar, que a ficha não modela)
    if (semSanidade(ficha)) return { pv: limite * numero(cfg.dormir.pvPorLimitePE[id]), pe: 0, san: 0 };
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
          categoriaNome: 'Personalizada', resumo: resumoEfeitos(efeitosDaPersonalizada(p)), conferir: false,
          lembretes: [], descricao: ''
        };
      }
      const definicao = definicaoCondicao(item.id);
      if (!definicao) return null;
      // O resumo inclui o que as condições implicadas trazem (ex.: Exausto → Debilitado, Lento e Vulnerável)
      const sozinha = modificadoresCondicoes({ condicoes: { ativas: [{ id: definicao.id }], aplicarEfeitos: true } });
      return {
        id: definicao.id, nome: definicao.nome, categoria: definicao.categoria,
        categoriaNome: (OP.data.categoriasCondicao || {})[definicao.categoria] || '',
        resumo: resumoEfeitos(efeitosDeModificadores(sozinha)), conferir: definicao.conferir === true,
        lembretes: Array.isArray(definicao.lembretes) ? definicao.lembretes.slice() : [],
        descricao: typeof definicao.descricao === 'string' ? definicao.descricao : '',
        implica: (definicao.implica || []).map(function (id) { const d = definicaoCondicao(id); return d ? d.nome : id; })
      };
    });
    const efetivas = condicoesEfetivas(salvas);
    return {
      saude: pv.classeDefinida ? estadoSaude(pv.atual, pv.max) : 'ileso',
      sanidade: san.classeDefinida && !semSanidade(ficha) ? estadoSanidade(san.atual, san.max) : 'sao',
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
      if (c.caminho === 'identificacao.nex') aviso('nex-invalido', 'identificacao', regraNexNivel(ficha) ? 'nex-exposicao' : 'campo-nex', regraNexNivel(ficha) ? 'NEX fora do intervalo de 0% a 99% (' + ficha.identificacao.nex + '%).' : 'NEX fora da tabela (' + ficha.identificacao.nex + '%).');
      if (c.caminho === 'identificacao.nivel') aviso('nivel-invalido', 'identificacao', 'campo-nivel', 'Nível fora do intervalo de 1 a ' + NIVEL_MAXIMO + '.');
      if (c.caminho === 'identificacao.estagio') aviso('estagio-invalido', 'identificacao', 'campo-estagio', 'Estágio fora do intervalo da classe.');
    });
    // NEX e Experiência: alteração sem a escolha feita (a perícia ou o atributo ainda não foram marcados)
    efeitosAlteracoes(ficha).pendencias.forEach(function (p) {
      aviso('alteracao-sem-escolha-' + p.campo, 'alteracoes', 'alt-' + p.campo, 'Alteração de ' + p.alteracao + ' sem escolha: ' + p.rotulo.toLowerCase() + '.');
    });

    // Efeitos automáticos de poderes: escolha que ainda falta (ex.: a perícia de um treinamento)
    pendenciasDeEfeitos(ficha).forEach(function (p) {
      aviso('efeito-sem-escolha-' + p.chave + '-' + p.campo, 'livro', null, p.nome + ': falta escolher ' + String(p.rotulo).toLowerCase() + '.');
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
      aviso('sobrecarga', 'inventario', 'inv-carga-abrir', 'Sobrecarregado: ' + inventario.espacosUsados + ' de ' + inventario.capacidade + ' espaços.');
    }
    inventario.limites.forEach(function (limite) {
      if (!limite.excedeu) return;
      if (limite.limite === 0) {
        aviso('categoria-acima-patente', 'inventario', 'inv-patente-abrir', 'Itens de categoria ' + limite.categoria + ' acima da patente (a patente não permite).');
      } else {
        aviso('limite-itens', 'inventario', 'inv-patente-abrir', 'Categoria ' + limite.categoria + ': ' + limite.usados + ' itens para o limite de ' + limite.limite + '.');
      }
    });
    verificarMelhorias(ficha, aviso);
    return lista;
  }

  /** Avisos sobre as melhorias dos itens (incompatível, repetida, em conflito, categoria acima de IV, patente, regalias). */
  function verificarMelhorias(ficha, aviso) {
    const nomeDe = function (item) { return '"' + (String(item.nome || '').trim() || 'item sem nome') + '"'; };
    const nomeMel = function (m) { return '"' + (String(m.nome || '').trim() || (melhoriaDoCatalogo(m.chave) || {}).nome || 'melhoria sem nome') + '"'; };
    let temMaldicao = false;
    itensDaFicha(ficha).forEach(function (item) {
      const lista = melhoriasDoItem(item);
      if (!lista.length) return;
      const vale = melhoriasQueValem(item);
      lista.forEach(function (m) {
        if (m.classe === 'maldicao') temMaldicao = true;
        const comp = compatibilidadeMelhoria(item, m);
        if (!comp.ok) {
          aviso('melhoria-incompativel', 'inventario', null, 'Item ' + nomeDe(item) + ': a melhoria ' + nomeMel(m) + ' não combina com este item (' + comp.motivo + ').', item.id);
        }
        if (vale.indexOf(m) === -1) {
          aviso('melhoria-repetida', 'inventario', null, 'Item ' + nomeDe(item) + ': ' + nomeMel(m) + ' está repetida; o livro não acumula, então a repetição não conta.', item.id);
        }
        const entrada = melhoriaDoCatalogo(m.chave);
        (entrada && Array.isArray(entrada.exclui) ? entrada.exclui : []).forEach(function (outra) {
          const conflito = lista.find(function (x) { return x.chave === outra; });
          if (conflito && lista.indexOf(conflito) > lista.indexOf(m)) {
            aviso('melhoria-conflito', 'inventario', null, 'Item ' + nomeDe(item) + ': ' + nomeMel(m) + ' não pode ser combinada com ' + nomeMel(conflito) + '.', item.id);
          }
        });
      });
      // Regalias de veículo: o limite vem da ficha do veículo no livro
      const doLivro = itemDoCatalogo(item.catalogo);
      const regalias = vale.filter(function (m) { return m.classe === 'regalia'; }).length;
      if (doLivro && numero(doLivro.limite) > 0 && regalias > numero(doLivro.limite)) {
        aviso('regalias-acima-limite', 'inventario', null, 'Veículo ' + nomeDe(item) + ': ' + regalias + ' regalias para um limite de ' + numero(doLivro.limite) + '.', item.id);
      }
    });
    itensAcimaDeIV(ficha).forEach(function (a) {
      const rotulo = a.categoria <= 4 ? String(a.categoria) : 'categoria ' + a.categoria;
      aviso('item-acima-iv', 'inventario', null, 'Item ' + (a.nome ? '"' + a.nome + '"' : 'sem nome') + ': com as melhorias chega à ' + rotulo + ', acima da categoria IV. Só habilidades que reduzem a categoria permitem levá-lo (registre-as em "Modificar categoria" do item).', a.id);
    });
    // Itens amaldiçoados só a partir de uma patente (data/melhorias.js)
    const classeMaldicao = classeDeMelhoria('maldicao');
    if (temMaldicao && classeMaldicao && classeMaldicao.patenteMinima) {
      const minima = OP.data.patentes.findIndex(function (p) { return p.id === classeMaldicao.patenteMinima; });
      const atual = OP.data.patentes.findIndex(function (p) { return p.id === patenteAtual(ficha); });
      if (minima > atual && atual !== -1) {
        aviso('maldicao-patente', 'inventario', 'inv-patente-abrir', 'Há itens com maldição, mas a patente ' + dadosPatente(patenteAtual(ficha)).nome + ' ainda não dá acesso a itens amaldiçoados (a partir de ' + OP.data.patentes[minima].nome + ').');
      }
    }
  }

  /* ------------------------------------------------------------------------
     Efeitos automáticos de origens, habilidades, poderes e rituais
     Os dados (OP.data.efeitos e OP.data.catalogo) só existem com o conteúdo do
     livro liberado (js/livro.js); sem ele tudo aqui devolve valores neutros.
     Formato: data/efeitos.js.
     ------------------------------------------------------------------------ */

  const GRUPO_FISICO = ['cortante', 'impacto', 'perfurante', 'balistico'];
  const PERICIAS_RESISTENCIA = ['fortitude', 'reflexos', 'vontade'];

  function definicoesEfeitos() {
    return OP.data.efeitos !== null && typeof OP.data.efeitos === 'object' ? OP.data.efeitos : {};
  }

  function catalogoLivro() {
    return OP.data.catalogo !== null && typeof OP.data.catalogo === 'object' ? OP.data.catalogo : {};
  }

  function temEfeitosCarregados() {
    return Object.keys(definicoesEfeitos()).length > 0;
  }

  function listaDeEfeitos(ficha, campo) {
    const e = ficha && ficha.efeitos;
    return e && Array.isArray(e[campo]) ? e[campo].filter(function (x) { return x !== null && typeof x === 'object'; }) : [];
  }

  function nomeDaFonte(chave) {
    const t = OP.livro && OP.livro.texto ? OP.livro.texto(chave) : null;
    return t ? t.titulo : chave;
  }

  /**
   * Fontes de efeitos desta ficha: [{ chave, nome, tipo, base, def }].
   * base: 'exposicao' (poderes paranormais usam o NEX de exposição) ou 'progressao'.
   */
  function fontesEfeitos(ficha) {
    const defs = definicoesEfeitos();
    if (!temEfeitosCarregados() || !ficha) return [];
    const cat = catalogoLivro();
    const fontes = [];
    const vistas = Object.create(null);
    function incluir(chave, tipo, base) {
      if (!chave || vistas[chave] || !defs[chave]) return;
      vistas[chave] = true;
      fontes.push({ chave: chave, nome: nomeDaFonte(chave), tipo: tipo, base: base || 'progressao', def: defs[chave] });
    }
    const ident = ficha.identificacao || {};
    if (cat.origens) incluir(cat.origens[ident.origem], 'origem');
    const classe = classeDaFicha(ficha);
    if (classe && cat.classe) (cat.classe[classe.id] || []).forEach(function (h) { incluir(h.chave, 'classe'); });
    const trilha = trilhaDaFicha(ficha);
    if (trilha && cat.trilhas && cat.trilhas[trilha.id]) {
      habilidadesTrilha(ficha).forEach(function (h) { if (h.liberada) incluir(cat.trilhas[trilha.id][String(h.marco)], 'trilha'); });
    }
    const versat = habilidadeVersatilidade(ficha);
    if (versat && versat.liberada && cat.trilhas && cat.trilhas[versat.trilha]) incluir(cat.trilhas[versat.trilha][String(versat.marco)], 'trilha');
    const poderes = Array.isArray(cat.poderes) ? cat.poderes : [];
    (Array.isArray(ficha.habilidades) ? ficha.habilidades : []).forEach(function (h) {
      if (!h || typeof h.catalogo !== 'string' || !h.catalogo) return;
      const p = poderes.find(function (x) { return x.id === h.catalogo; });
      incluir(h.catalogo, 'poder', p && p.tipo === 'paranormal' ? 'exposicao' : 'progressao');
    });
    (Array.isArray(ficha.rituais) ? ficha.rituais : []).forEach(function (r) {
      if (r && typeof r.catalogo === 'string' && r.catalogo) incluir(r.catalogo, 'ritual');
    });
    return fontes;
  }

  function nivelDaFonte(ficha, fonte) {
    if (fonte && fonte.base === 'exposicao') return nivelDoNex(nexExposicao(ficha));
    return unidadeProgressao(ficha) === 'estagio' ? estagioDaFicha(ficha) : nivelDoNex(nexProgressao(ficha));
  }

  function nexDaFonte(ficha, fonte) {
    if (fonte && fonte.base === 'exposicao') return nexExposicao(ficha);
    return unidadeProgressao(ficha) === 'estagio' ? estagioDaFicha(ficha) : nexProgressao(ficha);
  }

  /** Valor (V) de um efeito: ver data/efeitos.js. */
  function valorDeEfeito(ficha, v, fonte) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (v === null || typeof v !== 'object') return 0;
    if (v.nivel !== undefined) return Math.floor(numero(v.nivel) * nivelDaFonte(ficha, fonte) + 1e-9);
    if (v.atr !== undefined) return Math.floor(totalAtributo(ficha, v.atr) * (v.x === undefined ? 1 : numero(v.x)) + 1e-9);
    if (Array.isArray(v.tabela)) {
      const nex = nexDaFonte(ficha, fonte);
      let achado = 0;
      v.tabela.forEach(function (par) { if (Array.isArray(par) && nex >= numero(par[0])) achado = numero(par[1]); });
      return achado;
    }
    if (Array.isArray(v.soma)) return v.soma.reduce(function (s, parte) { return s + valorDeEfeito(ficha, parte, fonte); }, 0);
    if (v.metade !== undefined) return Math.floor(valorDeEfeito(ficha, v.metade, fonte) / 2);
    return 0;
  }

  /** Tem afinidade desenvolvida com o elemento ('qualquer' = com algum)? */
  function temAfinidadeEfeito(ficha, elemento) {
    const c = (ficha && ficha.conjuracao) || {};
    if (c.afinidadeDesenvolvida !== true || !afinidadeValida(c.elementoConectado)) return false;
    return elemento === 'qualquer' || c.elementoConectado === elemento;
  }

  /** Condição (se) de um efeito, gasto ou ativável. Sem "se", vale. */
  function condicaoDeEfeito(ficha, se, fonte, ignorarTreino, forma) {
    if (se === undefined || se === null) return true;
    if (typeof se !== 'object') return false;
    if (se.nex !== undefined && nexDaFonte(ficha, fonte) < numero(se.nex)) return false;
    if (se.afinidade !== undefined && !temAfinidadeEfeito(ficha, se.afinidade === true ? 'qualquer' : se.afinidade)) return false;
    if (se.semAfinidade !== undefined && temAfinidadeEfeito(ficha, se.semAfinidade === true ? 'qualquer' : se.semAfinidade)) return false;
    if (se.classe !== undefined && (ficha.identificacao || {}).classe !== se.classe) return false;
    if (se.treinado !== undefined && !ignorarTreino && grauEfetivo(ficha, se.treinado) < 1) return false;
    if (se.forma !== undefined && [].concat(se.forma).indexOf(forma || 'padrao') === -1) return false;
    return true;
  }

  /** Escolha da pessoa (id do campo) numa fonte; '' se não escolheu. */
  function escolhaDeEfeito(ficha, chave, campo) {
    const achada = listaDeEfeitos(ficha, 'escolhas').find(function (e) { return e.chave === chave && e.campo === campo; });
    return achada && typeof achada.valor === 'string' ? achada.valor : '';
  }

  function escolhasDaFonte(def) {
    return def && Array.isArray(def.escolhas) ? def.escolhas : [];
  }

  /** Ids de perícia de um alvo (id, lista, 'todas', { atr }, { escolha }); null se a escolha falta. */
  function periciasDoAlvo(ficha, fonte, alvo) {
    if (alvo === 'todas') return OP.data.pericias.map(function (p) { return p.id; });
    if (typeof alvo === 'string') return [alvo];
    if (Array.isArray(alvo)) return alvo.slice();
    if (alvo && typeof alvo === 'object' && alvo.atr) {
      return OP.data.pericias.filter(function (p) { return atributoDaPericia(ficha, p.id) === alvo.atr; }).map(function (p) { return p.id; });
    }
    if (alvo && typeof alvo === 'object' && alvo.escolha) {
      const v = escolhaDeEfeito(ficha, fonte.chave, alvo.escolha);
      return v ? [v] : null;
    }
    return [];
  }

  function efeitosNeutrosDaFicha() {
    return {
      ativo: false,
      pv: 0, pe: 0, san: 0, def: 0, desl: 0, dt: 0, limitePE: 0, carga: 0, cura: 0, danoRitual: 0, curaRitual: 0,
      per: {},
      rd: {},
      dadosPericia: {},     // id da perícia → d20
      dadosTodasPericias: 0,
      dadosAtributo: {},
      dadosAtaque: { corpo: 0, distancia: 0 },
      ataque: { corpo: 0, distancia: 0 },
      dano: { corpo: 0, distancia: 0 },
      margem: { corpo: 0, distancia: 0 },
      custoRitual: [],      // { v, circulo, elemento }
      origens: [],          // { chave, nome, texto }: de onde vem cada bônus (para a tela)
      pendencias: []        // { chave, nome, campo, rotulo }
    };
  }

  function somarMapa(mapa, id, valor) {
    mapa[id] = (mapa[id] || 0) + valor;
  }

  function sinalNum(n) {
    return (n < 0 ? '−' : '+') + Math.abs(n);
  }

  function nomePericiaEf(id) {
    const p = definicaoPericia(id);
    return p ? p.nome : String(id);
  }

  /** Anota que falta uma escolha da pessoa para o efeito valer. */
  function pendenciaDeEscolha(r, fonte, campo) {
    const esc = escolhasDaFonte(fonte.def).find(function (e) { return e.id === campo; });
    r.pendencias.push({ chave: fonte.chave, nome: fonte.nome, campo: campo, rotulo: esc ? esc.rotulo : campo });
  }

  /** Aplica uma lista de efeitos passivos de uma fonte ao resumo r. */
  function aplicarPassivos(ficha, fonte, lista, r, sufixo, forma) {
    (Array.isArray(lista) ? lista : []).forEach(function (ef) {
      if (!ef || typeof ef !== 'object' || !condicaoDeEfeito(ficha, ef.se, fonte, ef.k === 'treino', forma)) return;
      const v = valorDeEfeito(ficha, ef.v, fonte);
      let texto = '';
      switch (ef.k) {
        case 'pv': case 'pe': case 'san':
          r[ef.k] += v;
          texto = ef.k.toUpperCase() + ' ' + sinalNum(v);
          break;
        case 'def': r.def += v; texto = 'Defesa ' + sinalNum(v); break;
        case 'desl': r.desl += v; texto = 'deslocamento ' + sinalNum(v) + ' m'; break;
        case 'dt': r.dt += v; texto = 'DT dos rituais ' + sinalNum(v); break;
        case 'limitePE': r.limitePE += v; texto = 'limite de PE por turno ' + sinalNum(v); break;
        case 'carga': r.carga += v; texto = 'carga ' + sinalNum(v) + ' espaços'; break;
        case 'cura': r.cura += v; texto = 'PV curados ' + sinalNum(v); break;
        case 'danoRitual': r.danoRitual += v; texto = 'dano dos rituais ' + sinalNum(v); break;
        case 'curaRitual': r.curaRitual += v; texto = 'cura dos rituais ' + sinalNum(v); break;
        case 'per': {
          const ids = periciasDoAlvo(ficha, fonte, ef.id);
          if (ids === null) { pendenciaDeEscolha(r, fonte, ef.id.escolha); return; }
          ids.forEach(function (id) { somarMapa(r.per, id, v); });
          texto = (ef.id === 'todas' ? 'todas as perícias' : ids.map(nomePericiaEf).join(', ')) + ' ' + sinalNum(v);
          break;
        }
        case 'treino': {
          const ids = periciasDoAlvo(ficha, fonte, ef.id);
          if (ids === null) { pendenciaDeEscolha(r, fonte, ef.id.escolha); return; }
          texto = 'treinamento em ' + ids.map(nomePericiaEf).join(', ') + ' (ou +2 se já treinada)';
          break;
        }
        case 'rd': somarMapa(r.rd, ef.tipo, v); texto = 'RD ' + (ef.tipo === 'todos' ? 'a todo dano' : ef.tipo) + ' ' + sinalNum(v); break;
        case 'dados': {
          if (ef.alvo === 'pericia') {
            if (ef.id === 'todas' || ef.id === undefined) r.dadosTodasPericias += v;
            else {
              const ids = periciasDoAlvo(ficha, fonte, ef.id);
              if (ids === null) { pendenciaDeEscolha(r, fonte, ef.id.escolha); return; }
              ids.forEach(function (id) { somarMapa(r.dadosPericia, id, v); });
            }
          } else if (ef.alvo === 'atributo') somarMapa(r.dadosAtributo, ef.id, v);
          else if (ef.alvo === 'ataque') {
            if (ef.tipo !== 'distancia') r.dadosAtaque.corpo += v;
            if (ef.tipo !== 'corpo') r.dadosAtaque.distancia += v;
          }
          texto = sinalNum(v) + 'd20 em ' + (ef.alvo === 'ataque' ? 'ataques' : ef.alvo === 'atributo' ? 'testes de ' + ef.id : ef.id === 'todas' || ef.id === undefined ? 'perícias' : (ef.id && ef.id.escolha ? periciasDoAlvo(ficha, fonte, ef.id) : [].concat(ef.id)).map(nomePericiaEf).join(', '));
          break;
        }
        case 'ataque': case 'dano': case 'margem': {
          const m = r[ef.k];
          if (ef.tipo !== 'distancia') m.corpo += v;
          if (ef.tipo !== 'corpo') m.distancia += v;
          texto = { ataque: 'testes de ataque ', dano: 'dano ', margem: 'margem de ameaça ' }[ef.k] + sinalNum(v) + (ef.tipo === 'corpo' ? ' (corpo a corpo)' : ef.tipo === 'distancia' ? ' (à distância)' : '');
          break;
        }
        case 'custoRitual': r.custoRitual.push({ v: v, circulo: ef.circulo, elemento: ef.elemento }); texto = 'custo dos rituais ' + sinalNum(v) + ' PE'; break;
        default: return;
      }
      if (texto) r.origens.push({ chave: fonte.chave, nome: fonte.nome, texto: texto + (sufixo || '') });
    });
  }

  /** Tudo o que os efeitos passivos e os efeitos ativos ligados fazem nesta ficha (ver efeitosNeutrosDaFicha). */
  function efeitosDaFicha(ficha) {
    const r = efeitosNeutrosDaFicha();
    const fontes = fontesEfeitos(ficha);
    if (!fontes.length) return r;
    r.ativo = true;
    fontes.forEach(function (fonte) { aplicarPassivos(ficha, fonte, fonte.def.passivos, r); });
    listaDeEfeitos(ficha, 'ativos').forEach(function (ativo) {
      const fonte = fontes.find(function (f) { return f.chave === ativo.chave; });
      const a = fonte && fonte.def.ativavel;
      if (!a) return;
      if (!condicaoDeEfeito(ficha, a.se, fonte, false)) return;
      aplicarPassivos(ficha, fonte, a.passivos, r, ' (ativo)', ativo.forma);
    });
    return r;
  }

  /** Bônus fixo de efeitos numa perícia (inclui o +2 de "treino" quando já era treinada). */
  function bonusEfeitosPericia(ficha, idPericia) {
    const r = efeitosDaFicha(ficha);
    if (!r.ativo) return 0;
    let total = numero(r.per[idPericia]);
    if (treinosDeEfeitos(ficha).bonus.indexOf(idPericia) !== -1) total += 2;
    return total;
  }

  /**
   * Perícias de efeitos "treino", sem passar por efeitosDaFicha (grauEfetivo depende daqui, e uma condição
   * "treinado" de outro efeito depende de grauEfetivo: assim não há laço).
   */
  function idsDeTreino(ficha) {
    const ids = [];
    function coletar(fonte, lista, forma) {
      (Array.isArray(lista) ? lista : []).forEach(function (ef) {
        if (!ef || ef.k !== 'treino' || !condicaoDeEfeito(ficha, ef.se, fonte, true, forma)) return;
        const alvo = periciasDoAlvo(ficha, fonte, ef.id);
        if (alvo) alvo.forEach(function (id) { ids.push(id); });
      });
    }
    const fontes = fontesEfeitos(ficha);
    fontes.forEach(function (fonte) { coletar(fonte, fonte.def.passivos); });
    listaDeEfeitos(ficha, 'ativos').forEach(function (ativo) {
      const fonte = fontes.find(function (f) { return f.chave === ativo.chave; });
      if (fonte && fonte.def.ativavel && condicaoDeEfeito(ficha, fonte.def.ativavel.se, fonte, true)) coletar(fonte, fonte.def.ativavel.passivos, ativo.forma);
    });
    return ids;
  }

  /** Perícias trazidas por efeitos "treino": { concede: [ids novos], bonus: [ids que já eram treinadas] }. */
  function treinosDeEfeitos(ficha) {
    const resultado = { concede: [], bonus: [] };
    const brutos = idsDeTreino(ficha);
    if (!brutos.length) return resultado;
    const base = periciasConcedidasBase(ficha);
    brutos.forEach(function (id) {
      if (grauDaPericia(ficha, id) >= 1 || base.indexOf(id) !== -1) {
        if (resultado.bonus.indexOf(id) === -1) resultado.bonus.push(id);
      } else if (resultado.concede.indexOf(id) === -1) {
        resultado.concede.push(id);
      }
    });
    return resultado;
  }

  /** Resistência a um tipo de dano vinda de efeitos (soma o que vale para todos e para o grupo físico). */
  function resistenciaEfeitos(ficha, idTipo) {
    const r = efeitosDaFicha(ficha);
    if (!r.ativo) return 0;
    return numero(r.rd[idTipo]) + numero(r.rd.todos) + (GRUPO_FISICO.indexOf(idTipo) !== -1 ? numero(r.rd.fisico) : 0);
  }

  function dadosEfeitosPericia(ficha, idPericia) {
    const r = efeitosDaFicha(ficha);
    if (!r.ativo) return 0;
    return numero(r.dadosTodasPericias) + numero(r.dadosPericia[idPericia]) + numero(r.dadosAtributo[atributoDaPericia(ficha, idPericia)]);
  }

  function dadosEfeitosAtributo(ficha, idAtributo) {
    const r = efeitosDaFicha(ficha);
    return r.ativo ? numero(r.dadosAtributo[idAtributo]) : 0;
  }

  function tipoDeAtaque(ataque) {
    return ataque && ataque.pericia === 'luta' ? 'corpo' : 'distancia';
  }

  /** Dados de efeitos num ataque: os da perícia do ataque e os de ataque. */
  function dadosEfeitosAtaque(ficha, ataque) {
    const r = efeitosDaFicha(ficha);
    if (!r.ativo) return 0;
    return dadosEfeitosPericia(ficha, ataque && ataque.pericia) + numero(r.dadosAtaque[tipoDeAtaque(ataque)]);
  }

  /** Bônus fixos num ataque: { teste, dano, margem }, dos efeitos automáticos e das melhorias da arma ligada. */
  function bonusEfeitosAtaque(ficha, ataque) {
    const r = efeitosDaFicha(ficha);
    const t = tipoDeAtaque(ataque);
    const bonus = r.ativo ? { teste: numero(r.ataque[t]), dano: numero(r.dano[t]), margem: numero(r.margem[t]) } : { teste: 0, dano: 0, margem: 0 };
    // Melhorias da arma do inventário ligada ao ataque (Certeira +2 no ataque, Cruel +2 no dano, Perigosa +2 na margem...)
    const arma = armaDoAtaque(ficha, ataque);
    if (arma) {
      const aj = ajustesDoItem(arma);
      bonus.teste += aj.ataque;
      bonus.dano += aj.dano;
      bonus.margem += aj.margem;
    }
    return bonus;
  }

  /* ---------- Gastos opcionais (preparados antes do teste) ---------- */

  function idDoGasto(chave, gasto) {
    return chave + '__' + gasto;
  }

  /** Quantas unidades o gasto permite (V da definição; mínimo 1). */
  function unidadesMaximas(ficha, fonte, g) {
    return g.unidades === undefined ? 1 : Math.max(1, valorDeEfeito(ficha, g.unidades, fonte));
  }

  /** Custo em PE de n unidades de um gasto. */
  function custoDoGasto(ficha, fonte, g, unidades) {
    const base = Math.max(0, valorDeEfeito(ficha, g.custo, fonte));
    const extra = g.custoExtra === undefined ? base : Math.max(0, valorDeEfeito(ficha, g.custoExtra, fonte));
    return base + Math.max(0, unidades - 1) * extra;
  }

  /** Todos os gastos opcionais da ficha, com a preparação atual: [{ id, chave, fonte, gasto, nome, ... }]. */
  function gastosDaFicha(ficha) {
    const preparados = listaDeEfeitos(ficha, 'preparados');
    const lista = [];
    fontesEfeitos(ficha).forEach(function (fonte) {
      (Array.isArray(fonte.def.gastos) ? fonte.def.gastos : []).forEach(function (g) {
        if (!g || typeof g !== 'object' || !condicaoDeEfeito(ficha, g.se, fonte, false)) return;
        const id = idDoGasto(fonte.chave, g.id);
        const prep = preparados.find(function (p) { return p.id === id; });
        const max = unidadesMaximas(ficha, fonte, g);
        const unidades = prep ? limitarEntre(Math.trunc(numero(prep.unidades)) || 1, 1, max) : 0;
        lista.push({
          id: id, chave: fonte.chave, fonte: fonte.nome, gasto: g.id, nome: g.nome || fonte.nome, quando: g.quando || {},
          custo: custoDoGasto(ficha, fonte, g, 1), custoExtra: g.custoExtra === undefined ? custoDoGasto(ficha, fonte, g, 1) : valorDeEfeito(ficha, g.custoExtra, fonte),
          unidadesMax: max, preparado: unidades,
          bonus: g.bonus === undefined ? 0 : valorDeEfeito(ficha, g.bonus, fonte),
          dados: g.dados === undefined ? 0 : numero(g.dados),
          dano: g.dano === undefined ? 0 : valorDeEfeito(ficha, g.dano, fonte),
          def: g, fonteObj: fonte
        });
      });
    });
    return lista;
  }

  /**
   * O gasto vale neste teste? contexto: { tipo: 'pericia' | 'atributo' | 'ataque' | 'dano',
   * idPericia, atributo, ataque: 'corpo'|'distancia' }. Um ataque também é um teste da perícia dele.
   */
  function gastoVale(ficha, gasto, contexto) {
    const q = gasto.quando || {};
    const c = contexto || {};
    const chaves = Object.keys(q);
    if (!chaves.length) return false;
    const ehTeste = c.tipo === 'pericia' || c.tipo === 'ataque';
    const idPericia = c.idPericia;
    const atributo = c.atributo || (idPericia ? atributoDaPericia(ficha, idPericia) : null);
    if (q.dano !== undefined) {
      if (c.tipo !== 'dano') return false;
      if (q.dano !== 'todos' && q.dano !== c.ataque) return false;
    } else if (q.ataque !== undefined) {
      if (c.tipo !== 'ataque') return false;
      if (q.ataque !== 'todos' && q.ataque !== c.ataque) return false;
    } else if (!(ehTeste || c.tipo === 'atributo')) {
      return false;
    }
    if (q.pericia !== undefined) {
      if (!ehTeste || !idPericia) return false;
      if (q.pericia !== 'todas' && q.pericia.indexOf(idPericia) === -1) return false;
    }
    if (q.atr !== undefined && (!atributo || q.atr.indexOf(atributo) === -1)) return false;
    if (q.exceto !== undefined && idPericia && q.exceto.indexOf(idPericia) !== -1) return false;
    if (q.resistencia === true && PERICIAS_RESISTENCIA.indexOf(idPericia) === -1) return false;
    return true;
  }

  /** Gastos da ficha que valem neste teste (prontos para mostrar), com a preparação atual. */
  function gastosParaTeste(ficha, contexto) {
    return gastosDaFicha(ficha).filter(function (g) { return gastoVale(ficha, g, contexto); });
  }

  /**
   * O que os gastos PREPARADOS que valem neste teste fazem: { bonus, dados, dano, custo, itens, ids }.
   * Não gasta nada nem altera a ficha: quem rola paga (OP.rolagens) e limpa a preparação.
   */
  function efeitoDosPreparados(ficha, contexto) {
    const r = { bonus: 0, dados: 0, dano: 0, custo: 0, itens: [], ids: [] };
    gastosParaTeste(ficha, contexto).forEach(function (g) {
      if (!g.preparado) return;
      const n = g.preparado;
      r.bonus += g.bonus * n;
      r.dados += g.dados * n;
      r.dano += g.dano * n;
      r.custo += custoDoGasto(ficha, g.fonteObj, g.def, n);
      r.itens.push({ id: g.id, nome: g.nome, unidades: n });
      r.ids.push(g.id);
    });
    return r;
  }

  /** Lista de preparados depois de preparar (unidades ≥ 1) ou desfazer (0) um gasto. Não altera a ficha. */
  function preparadosAposAlterar(ficha, idGasto, unidades) {
    const g = gastosDaFicha(ficha).find(function (x) { return x.id === idGasto; });
    const resto = listaDeEfeitos(ficha, 'preparados').filter(function (p) { return p.id !== idGasto; });
    if (!g || unidades < 1) return resto;
    resto.push({ id: g.id, chave: g.chave, gasto: g.gasto, unidades: limitarEntre(Math.trunc(unidades), 1, g.unidadesMax) });
    return resto;
  }

  /* ---------- Efeitos ativáveis (cena, rodadas, manual) ---------- */

  /** Fonte (com definição) pela chave, ou null. */
  function fonteDeEfeito(ficha, chave) {
    return fontesEfeitos(ficha).find(function (f) { return f.chave === chave; }) || null;
  }

  /** Efeitos ativáveis da ficha: [{ chave, nome, custo, duracao, rodadas, ativo, passivos }]. */
  function ativaveisDaFicha(ficha) {
    const ativos = listaDeEfeitos(ficha, 'ativos');
    const lista = [];
    fontesEfeitos(ficha).forEach(function (fonte) {
      const a = fonte.def.ativavel;
      if (!a || typeof a !== 'object' || !condicaoDeEfeito(ficha, a.se, fonte, false)) return;
      const ligado = ativos.find(function (x) { return x.chave === fonte.chave; });
      lista.push({
        chave: fonte.chave, nome: fonte.nome, tipo: fonte.tipo, custo: Math.max(0, valorDeEfeito(ficha, a.custo, fonte)),
        duracao: a.duracao || 'manual', rodadas: a.rodadas || null, ligado: Boolean(ligado), ativo: ligado || null
      });
    });
    return lista;
  }

  /** Entrada de efeito ativo nova para uma fonte (o id e a contagem seguem a duração). */
  function novoEfeitoAtivo(ficha, chave, id, forma) {
    const a = ativaveisDaFicha(ficha).find(function (x) { return x.chave === chave; });
    if (!a) return null;
    return {
      id: id, chave: chave, forma: forma === 'discente' || forma === 'verdadeira' ? forma : '',
      rodadas: a.duracao === 'rodadas' && a.rodadas ? limitarEntre(Math.trunc(numero(a.rodadas)), 1, 99) : null,
      ateFimCena: a.duracao === 'cena'
    };
  }

  /** Passa uma rodada nos efeitos ativos: { ativos, removidos }. Não altera a ficha. */
  function passarRodadaEfeitos(ficha) {
    const ativos = [];
    const removidos = [];
    listaDeEfeitos(ficha, 'ativos').forEach(function (item) {
      if (item.rodadas === null || item.rodadas === undefined) { ativos.push(item); return; }
      const restantes = Math.trunc(numero(item.rodadas)) - 1;
      if (restantes <= 0) removidos.push(item);
      else ativos.push(Object.assign({}, item, { rodadas: restantes }));
    });
    return { ativos: ativos, removidos: removidos };
  }

  /** Fim da cena nos efeitos ativos: saem os "até o fim da cena". Não altera a ficha. */
  function fimDaCenaEfeitos(ficha) {
    const ativos = [];
    const removidos = [];
    listaDeEfeitos(ficha, 'ativos').forEach(function (item) {
      if (item.ateFimCena === true) removidos.push(item);
      else ativos.push(item);
    });
    return { ativos: ativos, removidos: removidos };
  }

  /* ---------- Usos (botões que rolam e aplicam) ---------- */

  /** Usos da ficha: [{ id, chave, fonte, nome, custo, rolar, tipo, recupera, perde, elemento }]. */
  function usosDaFicha(ficha) {
    const lista = [];
    fontesEfeitos(ficha).forEach(function (fonte) {
      (Array.isArray(fonte.def.usos) ? fonte.def.usos : []).forEach(function (u) {
        if (!u || typeof u !== 'object' || !condicaoDeEfeito(ficha, u.se, fonte, false)) return;
        lista.push({
          id: idDoGasto(fonte.chave, u.id), chave: fonte.chave, uso: u.id, fonte: fonte.nome, nome: u.nome || fonte.nome,
          custo: Math.max(0, valorDeEfeito(ficha, u.custo, fonte)), rolar: u.rolar || '', tipo: u.tipo || 'rolagem',
          recupera: u.recupera || '', perde: u.perde || null, elemento: u.elemento || ''
        });
      });
    });
    return lista;
  }

  /** Bônus de PV curados pelos poderes desta ficha. */
  function bonusDeCura(ficha) {
    return efeitosDaFicha(ficha).cura;
  }

  /** Redução (ou acréscimo) de efeitos no custo de PE de um ritual. */
  function ajusteCustoRitualEfeitos(ficha, ritual) {
    const r = efeitosDaFicha(ficha);
    if (!r.ativo || !ritual) return 0;
    const circulo = numero(ritual.circulo);
    return r.custoRitual.reduce(function (soma, c) {
      const okCirculo = c.circulo === undefined || [].concat(c.circulo).indexOf(circulo) !== -1;
      const okElemento = c.elemento === undefined || c.elemento === ritual.elemento;
      return okCirculo && okElemento ? soma + c.v : soma;
    }, 0);
  }

  /** Pendências: escolhas que faltam (para avisar na tela). */
  function pendenciasDeEfeitos(ficha) {
    const vistas = Object.create(null);
    return efeitosDaFicha(ficha).pendencias.filter(function (p) {
      const k = p.chave + ':' + p.campo;
      if (vistas[k]) return false;
      vistas[k] = true;
      return true;
    });
  }

  /* ---------- Validação das definições (usada ao carregar e nos testes) ---------- */

  const REGEX_DADOS = /^\s*(\d*d\d+|\d+)(\s*[+-]\s*(\d*d\d+|\d+))*\s*$/i;
  const KINDS_VALOR = ['pv', 'pe', 'san', 'def', 'desl', 'dt', 'limitePE', 'carga', 'cura', 'danoRitual', 'curaRitual', 'per', 'treino', 'rd', 'dados', 'ataque', 'dano', 'margem', 'custoRitual'];

  function problemaValor(v, onde) {
    if (typeof v === 'number') return Number.isFinite(v) ? '' : onde + ': número inválido';
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return onde + ': valor inválido';
    const chaves = Object.keys(v).filter(function (k) { return k !== 'x'; });
    if (chaves.length !== 1) return onde + ': valor precisa de exatamente uma forma (nivel, atr, tabela, soma ou metade)';
    const k = chaves[0];
    if (k === 'nivel') return typeof v.nivel === 'number' ? '' : onde + ': nivel precisa ser número';
    if (k === 'atr') return ehAtributoValido(v.atr) ? '' : onde + ': atributo desconhecido "' + v.atr + '"';
    if (k === 'tabela') {
      return Array.isArray(v.tabela) && v.tabela.length && v.tabela.every(function (p) { return Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number'; })
        ? '' : onde + ': tabela precisa de pares [nex, valor]';
    }
    if (k === 'soma') {
      if (!Array.isArray(v.soma) || !v.soma.length) return onde + ': soma precisa de uma lista';
      for (let i = 0; i < v.soma.length; i++) { const p = problemaValor(v.soma[i], onde); if (p) return p; }
      return '';
    }
    if (k === 'metade') return problemaValor(v.metade, onde);
    return onde + ': forma de valor desconhecida "' + k + '"';
  }

  function problemaCondicao(se, onde) {
    if (se === undefined) return '';
    if (se === null || typeof se !== 'object' || Array.isArray(se)) return onde + ': "se" inválido';
    const ok = ['nex', 'afinidade', 'semAfinidade', 'treinado', 'classe', 'forma'];
    const estranha = Object.keys(se).find(function (k) { return ok.indexOf(k) === -1; });
    if (estranha) return onde + ': condição desconhecida "' + estranha + '"';
    if (se.nex !== undefined && typeof se.nex !== 'number') return onde + ': nex precisa ser número';
    if (se.afinidade !== undefined && se.afinidade !== true && se.afinidade !== 'qualquer' && !elementoValido(se.afinidade)) return onde + ': elemento desconhecido';
    if (se.semAfinidade !== undefined && se.semAfinidade !== true && se.semAfinidade !== 'qualquer' && !elementoValido(se.semAfinidade)) return onde + ': elemento desconhecido';
    if (se.treinado !== undefined && !idPericiaValido(se.treinado)) return onde + ': perícia desconhecida "' + se.treinado + '"';
    if (se.classe !== undefined && !classeDados(se.classe)) return onde + ': classe desconhecida "' + se.classe + '"';
    if (se.forma !== undefined && ![].concat(se.forma).every(function (f) { return f === 'padrao' || f === 'discente' || f === 'verdadeira'; })) return onde + ': forma inválida';
    return '';
  }

  function problemaAlvoPericia(id, onde, escolhas) {
    if (id === 'todas') return '';
    if (typeof id === 'string') return idPericiaValido(id) ? '' : onde + ': perícia desconhecida "' + id + '"';
    if (Array.isArray(id)) {
      const ruim = id.find(function (x) { return !idPericiaValido(x); });
      return id.length && ruim === undefined ? '' : onde + ': lista de perícias inválida' + (ruim !== undefined ? ' ("' + ruim + '")' : '');
    }
    if (id && typeof id === 'object' && id.atr) return ehAtributoValido(id.atr) ? '' : onde + ': atributo desconhecido';
    if (id && typeof id === 'object' && id.escolha) return escolhas.indexOf(id.escolha) !== -1 ? '' : onde + ': escolha "' + id.escolha + '" não existe em "escolhas"';
    return onde + ': alvo de perícia inválido';
  }

  function problemaPassivo(ef, onde, escolhas) {
    if (ef === null || typeof ef !== 'object') return onde + ': efeito inválido';
    if (KINDS_VALOR.indexOf(ef.k) === -1) return onde + ': tipo de efeito desconhecido "' + ef.k + '"';
    const c = problemaCondicao(ef.se, onde);
    if (c) return c;
    if (ef.k !== 'treino') {
      const pv = problemaValor(ef.v, onde);
      if (pv) return pv;
    }
    if (ef.k === 'per') return problemaAlvoPericia(ef.id, onde, escolhas);
    if (ef.k === 'treino') return ef.id === undefined ? onde + ': treino precisa de id' : problemaAlvoPericia(ef.id, onde, escolhas);
    if (ef.k === 'rd') return ef.tipo === 'todos' || ef.tipo === 'fisico' || tipoDanoValido(ef.tipo) ? '' : onde + ': tipo de dano desconhecido "' + ef.tipo + '"';
    if (ef.k === 'dados') {
      if (ef.alvo === 'pericia') return ef.id === undefined || ef.id === 'todas' ? '' : problemaAlvoPericia(ef.id, onde, escolhas);
      if (ef.alvo === 'atributo') return ehAtributoValido(ef.id) ? '' : onde + ': atributo desconhecido';
      if (ef.alvo === 'ataque') return ef.tipo === undefined || ef.tipo === 'todos' || ef.tipo === 'corpo' || ef.tipo === 'distancia' ? '' : onde + ': tipo de ataque inválido';
      return onde + ': alvo de dados inválido';
    }
    if ((ef.k === 'ataque' || ef.k === 'dano' || ef.k === 'margem') && ef.tipo !== undefined && ef.tipo !== 'todos' && ef.tipo !== 'corpo' && ef.tipo !== 'distancia') return onde + ': tipo inválido';
    if (ef.k === 'custoRitual') {
      if (ef.elemento !== undefined && !elementoValido(ef.elemento)) return onde + ': elemento desconhecido';
      if (ef.circulo !== undefined && ![].concat(ef.circulo).every(function (x) { return typeof x === 'number' && x >= 1 && x <= 4; })) return onde + ': círculo inválido';
    }
    return '';
  }

  function problemaQuando(q, onde) {
    if (q === null || typeof q !== 'object' || Array.isArray(q) || !Object.keys(q).length) return onde + ': "quando" inválido';
    const ok = ['pericia', 'atr', 'exceto', 'ataque', 'dano', 'resistencia'];
    const estranha = Object.keys(q).find(function (k) { return ok.indexOf(k) === -1; });
    if (estranha) return onde + ': "quando" desconhecido "' + estranha + '"';
    if (q.pericia !== undefined && q.pericia !== 'todas' && !(Array.isArray(q.pericia) && q.pericia.length && q.pericia.every(idPericiaValido))) return onde + ': perícias inválidas';
    if (q.atr !== undefined && !(Array.isArray(q.atr) && q.atr.length && q.atr.every(ehAtributoValido))) return onde + ': atributos inválidos';
    if (q.exceto !== undefined && !(Array.isArray(q.exceto) && q.exceto.every(idPericiaValido))) return onde + ': exceções inválidas';
    if (q.ataque !== undefined && ['corpo', 'distancia', 'todos'].indexOf(q.ataque) === -1) return onde + ': ataque inválido';
    if (q.dano !== undefined && ['corpo', 'distancia', 'todos'].indexOf(q.dano) === -1) return onde + ': dano inválido';
    return '';
  }

  /** Problemas de uma definição de efeitos (lista de frases; vazia = tudo certo). */
  function validarEfeitos(chave, def) {
    const p = [];
    const nome = String(chave);
    if (def === null || typeof def !== 'object' || Array.isArray(def)) return [nome + ': definição inválida'];
    const permitidas = ['passivos', 'gastos', 'ativavel', 'usos', 'escolhas', 'formas'];
    Object.keys(def).forEach(function (k) { if (permitidas.indexOf(k) === -1) p.push(nome + ': campo desconhecido "' + k + '"'); });
    const escolhas = Array.isArray(def.escolhas) ? def.escolhas : [];
    const idsEscolha = escolhas.map(function (e) { return e && e.id; });
    if (def.escolhas !== undefined) {
      if (!Array.isArray(def.escolhas)) p.push(nome + ': escolhas precisa ser lista');
      else escolhas.forEach(function (e, i) {
        const onde = nome + ' escolhas[' + i + ']';
        if (!e || typeof e.id !== 'string' || !e.id || typeof e.rotulo !== 'string' || (e.tipo !== 'pericia' && e.tipo !== 'atributo') || !Array.isArray(e.opcoes) || !e.opcoes.length) p.push(onde + ': precisa de id, rotulo, tipo (pericia|atributo) e opcoes');
        else if (!e.opcoes.every(e.tipo === 'pericia' ? idPericiaValido : ehAtributoValido)) p.push(onde + ': opção desconhecida');
      });
    }
    function lista(campo, fn) {
      if (def[campo] === undefined) return;
      if (!Array.isArray(def[campo])) { p.push(nome + ': ' + campo + ' precisa ser lista'); return; }
      def[campo].forEach(function (item, i) { const m = fn(item, nome + ' ' + campo + '[' + i + ']'); if (m) p.push(m); });
    }
    lista('passivos', function (ef, onde) { return problemaPassivo(ef, onde, idsEscolha); });
    lista('gastos', function (g, onde) {
      if (!g || typeof g !== 'object' || typeof g.id !== 'string' || !g.id) return onde + ': gasto precisa de id';
      const q = problemaQuando(g.quando, onde); if (q) return q;
      const c = problemaCondicao(g.se, onde); if (c) return c;
      const vc = problemaValor(g.custo, onde + ' custo'); if (vc) return vc;
      if (g.custoExtra !== undefined) { const ve = problemaValor(g.custoExtra, onde + ' custoExtra'); if (ve) return ve; }
      if (g.unidades !== undefined) { const vu = problemaValor(g.unidades, onde + ' unidades'); if (vu) return vu; }
      if (g.bonus === undefined && g.dados === undefined && g.dano === undefined) return onde + ': gasto sem bonus, dados nem dano';
      if (g.bonus !== undefined) { const vb = problemaValor(g.bonus, onde + ' bonus'); if (vb) return vb; }
      if (g.dano !== undefined) { const vd = problemaValor(g.dano, onde + ' dano'); if (vd) return vd; }
      if (g.dados !== undefined && typeof g.dados !== 'number') return onde + ': dados precisa ser número';
      return '';
    });
    if (def.ativavel !== undefined) {
      const a = def.ativavel;
      const onde = nome + ' ativavel';
      if (a === null || typeof a !== 'object' || Array.isArray(a)) p.push(onde + ': inválido');
      else {
        const vc = problemaValor(a.custo, onde + ' custo'); if (vc) p.push(vc);
        if (['cena', 'rodadas', 'manual'].indexOf(a.duracao) === -1) p.push(onde + ': duracao precisa ser cena, rodadas ou manual');
        if (a.duracao === 'rodadas' && !(typeof a.rodadas === 'number' && a.rodadas >= 1)) p.push(onde + ': duracao "rodadas" precisa de rodadas');
        const cs = problemaCondicao(a.se, onde); if (cs) p.push(cs);
        if (!Array.isArray(a.passivos) || !a.passivos.length) p.push(onde + ': passivos precisa de uma lista');
        else a.passivos.forEach(function (ef, i) { const m = problemaPassivo(ef, onde + ' passivos[' + i + ']', idsEscolha); if (m) p.push(m); });
      }
    }
    lista('usos', function (u, onde) {
      if (!u || typeof u !== 'object' || typeof u.id !== 'string' || !u.id) return onde + ': uso precisa de id';
      if (['cura', 'dano', 'rolagem'].indexOf(u.tipo) === -1) return onde + ': tipo precisa ser cura, dano ou rolagem';
      const vc = problemaValor(u.custo, onde + ' custo'); if (vc) return vc;
      if (typeof u.rolar !== 'string' || !REGEX_DADOS.test(u.rolar)) return onde + ': "rolar" precisa ser uma fórmula de dados (ex.: 2d8+2)';
      if (u.recupera !== undefined && ['pv', 'pe', 'san'].indexOf(u.recupera) === -1) return onde + ': recupera inválido';
      if (u.perde !== undefined) {
        if (u.perde === null || typeof u.perde !== 'object') return onde + ': perde inválido';
        const ruim = Object.keys(u.perde).find(function (k) { return ['pv', 'pe', 'san'].indexOf(k) === -1 || typeof u.perde[k] !== 'string' || !REGEX_DADOS.test(u.perde[k]); });
        if (ruim) return onde + ': perde.' + ruim + ' inválido';
      }
      if (u.elemento !== undefined && !elementoValido(u.elemento)) return onde + ': elemento desconhecido';
      return '';
    });
    if (def.formas !== undefined) {
      if (def.formas === null || typeof def.formas !== 'object' || Array.isArray(def.formas)) p.push(nome + ': formas inválido');
      else Object.keys(def.formas).forEach(function (id) {
        const f = def.formas[id];
        if (['padrao', 'discente', 'verdadeira'].indexOf(id) === -1 || f === null || typeof f !== 'object') { p.push(nome + ' formas.' + id + ': inválida'); return; }
        ['dano', 'cura'].forEach(function (c) {
          if (f[c] !== undefined && (typeof f[c] !== 'string' || !REGEX_DADOS.test(f[c]))) p.push(nome + ' formas.' + id + '.' + c + ': fórmula de dados inválida');
        });
        Object.keys(f).forEach(function (c) { if (c !== 'dano' && c !== 'cura') p.push(nome + ' formas.' + id + ': campo desconhecido "' + c + '"'); });
      });
    }
    return p;
  }

  /** Resumo dos efeitos para a tela: o que está valendo, o que dá para preparar, ativar ou usar e o que falta escolher. */
  function estadoEfeitos(ficha) {
    const r = efeitosDaFicha(ficha);
    return {
      carregado: temEfeitosCarregados(),
      ativo: r.ativo,
      origens: r.origens,
      gastos: gastosDaFicha(ficha),
      ativaveis: ativaveisDaFicha(ficha),
      usos: usosDaFicha(ficha),
      pendencias: pendenciasDeEfeitos(ficha),
      fontes: fontesEfeitos(ficha).map(function (f) {
        return { chave: f.chave, nome: f.nome, tipo: f.tipo, escolhas: escolhasDaFonte(f.def).map(function (e) {
          return { id: e.id, rotulo: e.rotulo, tipo: e.tipo, opcoes: e.opcoes, valor: escolhaDeEfeito(ficha, f.chave, e.id) };
        }) };
      }),
      rd: r.rd
    };
  }

  /** Correções dos efeitos salvos na ficha: preparados, ativos e escolhas que não existem mais saem. */
  function correcoesEfeitos(ficha) {
    const lista = [];
    if (!temEfeitosCarregados()) return lista; // sem o conteúdo carregado, nada é apagado
    const fontes = fontesEfeitos(ficha);
    const ativaveis = ativaveisDaFicha(ficha).map(function (a) { return a.chave; });
    const gastos = gastosDaFicha(ficha);
    const ativos = listaDeEfeitos(ficha, 'ativos');
    const bons = ativos.filter(function (a) { return ativaveis.indexOf(a.chave) !== -1; });
    if (bons.length !== ativos.length) lista.push({ caminho: 'efeitos.ativos', valor: bons });
    const prep = listaDeEfeitos(ficha, 'preparados');
    const prepBons = prep.filter(function (p) { return gastos.some(function (g) { return g.id === p.id; }); });
    if (prepBons.length !== prep.length) lista.push({ caminho: 'efeitos.preparados', valor: prepBons });
    const esc = listaDeEfeitos(ficha, 'escolhas');
    const escBons = esc.filter(function (e) {
      const f = fontes.find(function (x) { return x.chave === e.chave; });
      const d = f && escolhasDaFonte(f.def).find(function (x) { return x.id === e.campo; });
      return d && d.opcoes.indexOf(e.valor) !== -1;
    });
    if (escBons.length !== esc.length) lista.push({ caminho: 'efeitos.escolhas', valor: escBons });
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
      correcoesCondicoes(ficha),
      correcoesAlteracoesNex(ficha),
      correcoesEfeitos(ficha)
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
      rd: estadoRd(ficha),
      inventario: estadoInventario(ficha),
      ataques: estadoAtaques(ficha),
      habilidades: estadoHabilidades(ficha),
      conjuracao: estadoConjuracao(ficha),
      rituais: estadoRituais(ficha),
      condicoes: estadoCondicoes(ficha),
      efeitos: estadoEfeitos(ficha)
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
    habilidadesAutomaticas: habilidadesAutomaticas,
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
    custoComCondicoes: custoComCondicoes,
    custoAdicionalSugerido: custoAdicionalSugerido,
    avisosForma: avisosForma,
    composicaoRecurso: composicaoRecurso,
    pvMax: pvMax,
    peMax: peMax,
    atributoDoRecurso: atributoDoRecurso,
    semSanidade: semSanidade,
    regraNexNivel: regraNexNivel,
    nexDoNivel: nexDoNivel,
    nivelDoNex: nivelDoNex,
    nivelDaFicha: nivelDaFicha,
    nexProgressao: nexProgressao,
    nexExposicao: nexExposicao,
    efeitosAlteracoes: efeitosAlteracoes,
    alteracoesAlcancadas: alteracoesAlcancadas,
    elementoDasAlteracoes: elementoDasAlteracoes,
    dadosAlteracoesPericia: dadosAlteracoesPericia,
    dadosAlteracoesAtributo: dadosAlteracoesAtributo,
    bonusAlteracoesPericia: bonusAlteracoesPericia,
    reducaoCustoRitual: reducaoCustoRitual,
    custoRitualFinal: custoRitualFinal,
    normalizarNome: normalizarNome,
    NIVEL_MAXIMO: NIVEL_MAXIMO,
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
    testeAtributo: testeAtributo,
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
    penalidadeSemKit: penalidadeSemKit,
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
    estadoRd: estadoRd,
    // Etapa 10
    condicoesEfetivas: condicoesEfetivas,
    modificadoresCondicoes: modificadoresCondicoes,
    modificadorDadosTeste: modificadorDadosTeste,
    dadosCondicoesPericia: dadosCondicoesPericia,
    dadosCondicoesAtaque: dadosCondicoesAtaque,
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
    calcularTudo: calcularTudo,
    // Efeitos automáticos de habilidades, poderes e rituais
    validarEfeitos: validarEfeitos,
    fontesEfeitos: fontesEfeitos,
    efeitosDaFicha: efeitosDaFicha,
    valorDeEfeito: valorDeEfeito,
    gastosDaFicha: gastosDaFicha,
    gastosParaTeste: gastosParaTeste,
    efeitoDosPreparados: efeitoDosPreparados,
    preparadosAposAlterar: preparadosAposAlterar,
    custoDoGasto: custoDoGasto,
    ativaveisDaFicha: ativaveisDaFicha,
    novoEfeitoAtivo: novoEfeitoAtivo,
    passarRodadaEfeitos: passarRodadaEfeitos,
    fimDaCenaEfeitos: fimDaCenaEfeitos,
    usosDaFicha: usosDaFicha,
    bonusDeCura: bonusDeCura,
    bonusEfeitosAtaque: bonusEfeitosAtaque,
    rotuloCategoria: rotuloCategoria,
    melhoriasDoItem: melhoriasDoItem,
    melhoriasQueValem: melhoriasQueValem,
    aumentoDeCategoria: aumentoDeCategoria,
    modificadoresDoItem: modificadoresDoItem,
    ajusteDeCategoria: ajusteDeCategoria,
    aumentosDasMelhorias: aumentosDasMelhorias,
    categoriaEfetivaItem: categoriaEfetivaItem,
    ajustesDoItem: ajustesDoItem,
    espacosDoItem: espacosDoItem,
    defesaDoItem: defesaDoItem,
    grupoDoItem: grupoDoItem,
    itemDoCatalogo: itemDoCatalogo,
    melhoriaDoCatalogo: melhoriaDoCatalogo,
    compatibilidadeMelhoria: compatibilidadeMelhoria,
    resistenciaEfeitos: resistenciaEfeitos,
    pendenciasDeEfeitos: pendenciasDeEfeitos,
    ajusteCustoRitualEfeitos: ajusteCustoRitualEfeitos,
    escolhasDaFonte: escolhasDaFonte,
    escolhaDeEfeito: escolhaDeEfeito,
    fonteDeEfeito: fonteDeEfeito,
    temEfeitosCarregados: temEfeitosCarregados
  };
})(window.OP);
