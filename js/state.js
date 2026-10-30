/* ==========================================================================
   js/state.js — estado central da ficha
   --------------------------------------------------------------------------
   - Guarda o objeto único `ficha` em OP.state.ficha.
   - Toda mudança passa por OP.state.atualizar(caminho, valor), que avisa os
     ouvintes registrados (o main.js recalcula, redesenha e agenda o salvamento).
   - modeloVazio() é a ficha completa; completarPadroes() completa e migra
     qualquer ficha (de qualquer etapa) e é o ÚNICO lugar com valores padrão.
   - sanitizar() e lerImportacao() tratam arquivos importados, que NUNCA
     são confiáveis.
   - A gravação no navegador (várias fichas) fica em js/fichas.js.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  // v2: recursos.{pv,pe,san}.bonus → bonusMax
  // v3: perícias completas (uma entrada por perícia) e bônus de pontos de treinamento
  // v4: defesa completa (proteção, outros, deslocamento, resistências); defesa.bonus → outros
  // v5: inventário completo (patente, PP, crédito, capacidade e itens com id)
  // v6: ataques completos (com id)
  // v7: habilidades, rituais (com formas) e conjuração
  // v8: id da ficha; "versao" → "versaoModelo"; SAN com perda permanente;
  //     habilidade com atributoDT e dtBonus; ritual com resistência
  //     estruturada { teste, efeito } e resistenciaNotas (texto livre)
  // v9: origem e trilha por id (+ origemTexto/trilhaTexto), estágio,
  //     versatilidade e escolhas de perícias; conjuracao.afinidade →
  //     elementoConectado + afinidadeDesenvolvida; ritual com custoBase e
  //     formas com custoAdicional, requerCirculo e requerAfinidade
  // v10: condicoes (ativas, turnos morrendo, bônus do limite, insano, aplicar efeitos),
  //     descanso e biografia (retrato, textos, aliados, rivais e diário);
  //     "descricao" virou "biografia" (anotacoes → notas)
  // v11: habilidades e rituais com "catalogo" (chave do livro, para os efeitos automáticos),
  //     forma de ritual com "cura" e a seção "efeitos" (ativos, preparados e escolhas)
  // v12: defesa.rd (lista de RD por tipo de dano; defesa.resistencias foi convertida)
  // v13: itens com natureza (grupo), chave do catálogo e melhorias (modificações, maldições e regalias)
  // v14: itens com modificadores de categoria (valor com sinal e fonte), para habilidades que sobem ou baixam a categoria
  const VERSAO_MODELO = 14;
  // Segmentos de caminho e chaves recusados, para nunca mexer em protótipos.
  const CHAVES_PROIBIDAS = ['__proto__', 'prototype', 'constructor'];
  // Ids de fichas e de itens de lista: letras, números, "_" e "-" (até 64).
  const PADRAO_ID = /^[A-Za-z0-9_-]{1,64}$/;

  // Importação: formatos, limites e tamanho máximo do arquivo.
  const FORMATO_FICHA = 'op-ficha';
  const FORMATO_BACKUP = 'op-backup';
  const LIMITE_TEXTO = 5000;
  const LIMITE_LISTA = 500;
  const LIMITE_ARQUIVO = 2 * 1024 * 1024;

  // Etapa 10: limites próprios de algumas listas e textos (o resto usa LIMITE_LISTA e LIMITE_TEXTO).
  const MAX_CONDICOES = 50;
  const MAX_DIARIO = 200;
  const MAX_PESSOAS = 100; // aliados e rivais
  const MAX_RD = 50;       // entradas de RD (redução de dano)
  const MAX_MELHORIAS = 30; // melhorias por item
  const MAX_MOD_CATEGORIA = 20; // modificadores de categoria por item
  const LIMITES_LISTA = {
    'inventario.itens[].melhorias': MAX_MELHORIAS,
    'inventario.itens[].modCategoria': MAX_MOD_CATEGORIA,
    'condicoes.ativas': MAX_CONDICOES,
    'efeitos.ativos': 100,
    'efeitos.preparados': 100,
    'efeitos.escolhas': 300,
    'defesa.rd': MAX_RD,
    'biografia.diario': MAX_DIARIO,
    'biografia.aliados': MAX_PESSOAS,
    'biografia.rivais': MAX_PESSOAS
  };
  const LIMITES_TEXTO = {
    'biografia.notas': 20000,
    'biografia.diario[].texto': 20000,
    'biografia.diario[].titulo': 200,
    'biografia.diario[].data': 10,
    'biografia.aliados[].nome': 200,
    'biografia.rivais[].nome': 200,
    'condicoes.ativas[].nota': 500,
    'condicoes.ativas[].personalizada.nome': 80,
    'defesa.rd[].nome': 80,
    'inventario.itens[].melhorias[].nome': 120,
    'inventario.itens[].melhorias[].chave': 80,
    'inventario.itens[].melhorias[].nota': 500,
    'inventario.itens[].modCategoria[].fonte': 200
  };

  const ouvintes = [];
  const ouvintesBloqueio = [];
  let somenteLeitura = false;
  let contadorIds = 0; // junto com a hora, garante ids únicos (itens, ataques...)

  /* ------------------------------------------------------------------------
     Utilitários de objeto e caminho ("atributos.agi.base")
     ------------------------------------------------------------------------ */

  function ehObjetoSimples(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
  }

  function temPropria(objeto, chave) {
    return objeto !== null && objeto !== undefined && Object.prototype.hasOwnProperty.call(objeto, chave);
  }

  /** Cópia profunda de dados JSON. Devolve undefined se não der para copiar. */
  function clonar(valor) {
    if (valor === undefined) return undefined;
    try {
      return JSON.parse(JSON.stringify(valor));
    } catch (erro) {
      return undefined;
    }
  }

  /** Id aceito para fichas e itens de lista (sem chaves perigosas). */
  function idValido(id) {
    return typeof id === 'string' && PADRAO_ID.test(id) && CHAVES_PROIBIDAS.indexOf(id) === -1;
  }

  /** Lê um valor por caminho em qualquer objeto. Devolve undefined se não existir. */
  function lerCaminho(objeto, caminho) {
    return String(caminho).split('.').reduce(function (atual, chave) {
      return temPropria(atual, chave) ? atual[chave] : undefined;
    }, objeto);
  }

  function dividirCaminho(caminho) {
    const partes = String(caminho).split('.');
    const invalido = partes.some(function (parte) {
      return parte === '' || CHAVES_PROIBIDAS.indexOf(parte) !== -1;
    });
    if (invalido) throw new Error('[OP] Caminho inválido: ' + caminho);
    return partes;
  }

  /** Escreve um valor por caminho, criando objetos intermediários se faltarem. */
  function escreverCaminho(objeto, caminho, valor) {
    const partes = dividirCaminho(caminho);
    const ultima = partes.pop();
    let alvo = objeto;
    partes.forEach(function (chave) {
      if (!ehObjetoSimples(alvo[chave]) && !Array.isArray(alvo[chave])) alvo[chave] = {};
      alvo = alvo[chave];
    });
    alvo[ultima] = valor;
  }

  /**
   * Junta dados salvos com um modelo padrão.
   * - Campos que faltam ganham o valor padrão.
   * - Valores salvos com tipo errado são descartados.
   * - Chaves extras do salvo são mantidas (completar não apaga nada).
   */
  function mesclarComPadrao(padrao, salvo) {
    if (padrao === null) return salvo === undefined ? null : salvo;
    if (salvo === undefined || salvo === null) return padrao;

    if (Array.isArray(padrao)) return Array.isArray(salvo) ? salvo : padrao;

    if (ehObjetoSimples(padrao)) {
      if (!ehObjetoSimples(salvo)) return padrao;
      const resultado = {};
      Object.keys(padrao).forEach(function (chave) {
        resultado[chave] = mesclarComPadrao(padrao[chave], salvo[chave]);
      });
      Object.keys(salvo).forEach(function (chave) {
        if (!temPropria(padrao, chave) && CHAVES_PROIBIDAS.indexOf(chave) === -1) {
          resultado[chave] = salvo[chave];
        }
      });
      return resultado;
    }

    return typeof salvo === typeof padrao ? salvo : padrao;
  }

  /* ------------------------------------------------------------------------
     Modelo de dados (o único lugar com os valores padrão)
     ------------------------------------------------------------------------ */

  /** Atributo novo: base inicial do sistema e nenhum bônus. */
  function novoAtributo() {
    return { base: OP.data.regrasAtributos.baseInicial, bonus: 0 };
  }

  /**
   * Recurso (PV, PE, SAN). O máximo NÃO é salvo: é sempre calculado (js/calc.js).
   * atual: null em ficha nova (assume o máximo até o usuário mexer).
   * bonusMax: bônus manual somado ao máximo (poderes, itens etc.).
   */
  function novoRecurso() {
    return { atual: null, bonusMax: 0 };
  }

  /** Sanidade: um recurso com perda permanente (rituais de Medo), que reduz o máximo. */
  function novaSanidade() {
    return Object.assign(novoRecurso(), { perdaPermanente: 0 });
  }

  /**
   * Perícia nova:
   * grau: índice de OP.data.grausTreinamento (0 destreinado ... 3 expert)
   * outros: bônus manual (aceita negativo)
   * atributo: null = usa o padrão da perícia; senão, id do atributo escolhido
   * concedida: veio de graça (origem, classe ou poder) e não gasta pontos
   * nomeAberto: especialidade das perícias abertas (ex.: Profissão)
   */
  function novaPericia() {
    return { grau: 0, outros: 0, atributo: null, concedida: false, nomeAberto: '' };
  }

  /** Uma entrada para cada perícia de OP.data.pericias. */
  function novasPericias() {
    const pericias = {};
    OP.data.pericias.forEach(function (pericia) {
      pericias[pericia.id] = novaPericia();
    });
    return pericias;
  }

  /** Tipos de dano de uma RD: uma marca (true/false) para cada tipo de OP.data.tiposDano. */
  function novosTiposRd() {
    const tipos = {};
    OP.data.tiposDano.forEach(function (tipo) {
      tipos[tipo.id] = false;
    });
    return tipos;
  }

  /**
   * Uma RD (redução de dano): valor que reduz o dano recebido dos tipos marcados em "tipos"
   * (mapa id de OP.data.tiposDano → marcado). nome é opcional (de onde ela vem).
   */
  function rdPadrao() {
    return { id: '', nome: '', valor: 0, tipos: novosTiposRd() };
  }

  /**
   * Defesa e derivados (os totais são calculados em js/calc.js).
   * protecao: proteção manual; outros: bônus manual de Defesa (habilidades etc.).
   * deslocamentoBonus: bônus manual de deslocamento, em metros.
   * rd: lista de RD por tipo de dano (rdPadrao).
   */
  function novaDefesa() {
    return {
      protecao: { nome: '', defesa: 0 },
      outros: 0,
      deslocamentoBonus: 0,
      rd: []
    };
  }

  /**
   * Inventário (capacidade, limites e penalidades são calculados em js/calc.js).
   * patente: id de OP.data.patentes (todo personagem começa como Recruta).
   * creditoNivel: null = usa o crédito da patente; senão, id de OP.data.niveisCredito.
   * capacidadeBonus: bônus manual de capacidade, em espaços.
   */
  function novoInventario() {
    return {
      patente: OP.data.patentes[0].id,
      pontosPrestigio: 0,
      creditoNivel: null,
      capacidadeBonus: 0,
      itens: []
    };
  }

  /**
   * Item com todos os campos (o id é preenchido por novoItem).
   * defesa/penalidade: só valem para tipo "protecao" (penalidade é positiva).
   * periciaKit: só vale para tipo "kit" (id de uma perícia com kit).
   */
  function itemPadrao() {
    return {
      id: '',
      nome: '',
      tipo: 'geral',              // 'geral' | 'arma' | 'protecao' | 'kit'
      grupo: '',                  // natureza do item (id de OP.data.gruposItem); '' = não informada
      categoria: 0,               // categoria BASE, 0 a 4 (0 = sem limite); as melhorias somam (OP.calc.categoriaEfetivaItem)
      espacos: 0,
      quantidade: 1,
      equipada: false,
      defesa: 0,
      penalidade: 0,
      periciaKit: null,
      catalogo: '',               // chave do item no livro (js/livro.js); liga o item ao texto e aos dados do livro
      melhorias: [],              // modificações, maldições e regalias (ver melhoriaPadrao)
      modCategoria: [],           // modificadores de categoria de outras fontes (ver modCategoriaPadrao)
      descricao: ''
    };
  }

  /**
   * Melhoria de um item (data/melhorias.js): modificação, maldição ou regalia.
   * classe: id de OP.data.classesMelhoria. chave: a do catálogo do livro ('' = melhoria própria,
   * sem dados do livro). nome: o que aparece (vale para a própria e para a do livro). elemento: de uma maldição.
   */
  function melhoriaPadrao() {
    return { id: '', classe: 'modificacao', chave: '', nome: '', elemento: '', nota: '' };
  }

  /**
   * Modificador de categoria de um item: habilidades e poderes que sobem ou baixam a categoria
   * (a efetiva pode ficar abaixo de 0). valor: inteiro com sinal; fonte: de onde veio (texto livre).
   */
  function modCategoriaPadrao() {
    return { id: '', valor: 0, fonte: '' };
  }

  /**
   * Ataque com todos os campos (o id é preenchido por novoAtaque).
   * pericia: 'luta' (corpo a corpo) ou 'pontaria' (à distância).
   * critMargem/critMult: notação "margem/xmultiplicador" (19/x2 → 19 e 2).
   * itemId: id opcional de um item do inventário do tipo "arma".
   */
  function ataquePadrao() {
    return {
      id: '',
      nome: '',
      pericia: 'luta',
      testeBonus: 0,
      dano: '1d6',
      danoBonus: 0,
      critMargem: 20,
      critMult: 2,
      alcance: '',
      tipoDano: '',
      propriedades: '',
      usaMunicao: false,
      municao: 0,
      itemId: null,
      notas: ''
    };
  }

  /**
   * Habilidade ou poder (a descrição é escrita pelo usuário).
   * fonte: 'classe' | 'origem' | 'trilha' | 'poder' | 'outro'
   * ativacao: id de OP.data.ativacoes ('' = não informado)
   * atributoDT: null (sem DT) ou id do atributo usado na DT ('agi', 'for'...)
   * dtBonus: bônus manual somado à DT da habilidade
   */
  function habilidadePadrao() {
    return {
      id: '',
      nome: '',
      fonte: 'classe',
      custoPE: 0,
      ativacao: '',
      prerequisito: '',
      pagina: '',
      atributoDT: null,
      dtBonus: 0,
      catalogo: '',               // chave do livro (data/catalogo.js); liga a habilidade aos efeitos automáticos
      descricao: ''
    };
  }

  /**
   * Uma forma de conjuração. A Padrão custa o custo base do ritual (sem
   * campo próprio). Discente e Verdadeira:
   * - custoAdicional: o "+N PE" impresso, somado ao custo base;
   * - requerCirculo: círculo exigido (1 a 4; null = preencher pelo círculo do ritual);
   * - requerAfinidade: a forma exige afinidade com o elemento do ritual.
   * efeito: texto do usuário; dano: fórmula opcional ("2d6+3").
   */
  function formaPadrao(opcional) {
    if (!opcional) return { efeito: '', dano: '', cura: '' };
    return { ativa: false, custoAdicional: 0, requerCirculo: null, requerAfinidade: false, efeito: '', dano: '', cura: '' };
  }

  /**
   * Ritual. A forma Padrão sempre existe; Discente e Verdadeira só valem
   * quando "ativa" está marcada.
   * custoBase: null = automático pelo círculo (config.custoRitualPorCirculo);
   *   senão, um número digitado pelo usuário.
   * resistencia: { teste, efeito } — teste '' = o ritual não permite teste;
   *   ids de OP.data.resistencia.testes e .efeitos.
   * resistenciaNotas: texto livre sobre a resistência.
   */
  function ritualPadrao() {
    return {
      id: '',
      nome: '',
      circulo: 1,
      custoBase: null,
      elemento: '',
      execucao: '',
      alcance: '',
      alvo: '',
      area: '',
      duracao: '',
      resistencia: { teste: '', efeito: '' },
      resistenciaNotas: '',
      pagina: '',
      notas: '',
      catalogo: '',               // chave do livro (data/catalogo.js); liga o ritual aos efeitos automáticos
      formas: {
        padrao: formaPadrao(false),
        discente: formaPadrao(true),
        verdadeira: formaPadrao(true)
      }
    };
  }

  /**
   * Conjuração:
   * - dtBonus: bônus manual da DT de rituais;
   * - elementoConectado: elemento com que o personagem se conectou no NEX 50% (id ou null);
   * - afinidadeDesenvolvida: a afinidade se desenvolveu (depois de transcender);
   * - peGastoTurno: PE gasto no turno atual (aviso de limite por turno).
   */
  function novaConjuracao() {
    return { dtBonus: 0, elementoConectado: null, afinidadeDesenvolvida: false, peGastoTurno: 0 };
  }

  /**
   * Alterações de NEX (regra opcional NEX e Experiência):
   * - penalidade25: perícia com −5 do NEX 25% (diplomacia | enganacao | intimidacao | '');
   * - atributo35: atributo somado ao PE no NEX 35% (agi | for | int | vig | '');
   * - penalidade35: perícia com −5 do NEX 35% (atletismo | fortitude | reflexos | '');
   * - sangueSuspenso: Forma Monstruosa ativa (as penalidades do Sangue ficam suspensas);
   * - escuridao: o personagem está numa área de escuridão (NEX 90% de Conhecimento: ofuscado em vez de cego);
   * - energia: efeito da cena sorteado { d6: 0 (nenhum) a 6, valores: d20 anotados do efeito 5, intensidade }.
   * O elemento é o elemento conectado (conjuracao.elementoConectado).
   */
  function novasAlteracoesNex() {
    return {
      penalidade25: '',
      atributo35: '',
      penalidade35: '',
      sangueSuspenso: false,
      escuridao: false,
      energia: { d6: 0, valores: [], intensidade: 0 }
    };
  }

  /** Escolhas de perícias da origem e da classe (ids de OP.data.pericias). */
  function novasEscolhas() {
    return {
      origem: {
        livres: [],      // escolha "livre": ids escolhidos (até escolha.qtd)
        conjunto: null,  // escolha "conjunto": índice do par escolhido (0 ou 1)
        elemento: null   // escolha "elemento": id do elemento (a perícia vem do mapa)
      },
      classe: {
        grupos: []       // uma escolha por grupo de classe.pericias.escolhas (id ou null)
      }
    };
  }

  /**
   * Condição ativa. id do catálogo (OP.data.condicoes) ou "personalizada",
   * que usa o bloco `personalizada` (dadosPericias e defesa negativos tiram
   * dados/Defesa; deslocamentoMult 1 = normal, 0.5 = metade, 0 = não se move).
   * rodadas: null (sem contagem) ou 1 a 99.
   * uid: chave única desta entrada na ficha (a personalizada pode repetir o id).
   */
  function condicaoAtivaPadrao() {
    return {
      uid: '',
      id: '',
      rodadas: null,
      ateFimCena: false,
      nota: '',
      personalizada: { nome: '', dadosPericias: 0, defesa: 0, deslocamentoMult: 1 }
    };
  }

  /** Efeito de habilidade, poder ou ritual ligado (data/efeitos*.js). rodadas: null (sem contagem) ou 1 a 99. */
  function efeitoAtivoPadrao() {
    return { id: '', chave: '', forma: '', rodadas: null, ateFimCena: false };
  }

  /** Gasto opcional preparado para o próximo teste que combinar com ele. */
  function efeitoPreparadoPadrao() {
    return { id: '', chave: '', gasto: '', unidades: 1 };
  }

  /** Escolha da pessoa usada por um efeito (perícia ou atributo). */
  function efeitoEscolhaPadrao() {
    return { id: '', chave: '', campo: '', valor: '' };
  }

  /** Aliado ou rival da biografia. */
  function pessoaPadrao() {
    return { id: '', nome: '', nota: '' };
  }

  /** Entrada do diário: data "AAAA-MM-DD" (texto livre se vier de fora). */
  function entradaDiarioPadrao() {
    return { id: '', data: '', titulo: '', texto: '' };
  }

  /** A ficha completa, com todas as seções das Etapas 1 a 10. */
  function modeloVazio() {
    return {
      id: '',                     // id da ficha no navegador (preenchido por js/fichas.js)
      versaoModelo: VERSAO_MODELO,

      // Preferências desta ficha
      config: {
        modoLivre: false,         // desliga os avisos de criação dos atributos
        modoLivrePericias: false, // desliga o aviso de pontos de treinamento excedidos
        semSanidade: false,       // regra opcional "Jogando sem Sanidade": PD no lugar de PE e SAN
        nexENivel: false,         // regra opcional "NEX e Experiência": o nível (1 a 20) vira a progressão e o NEX, a exposição
        atributoPV: null,         // atributo do cálculo do PV (null = VIG); algumas habilidades usam outro
        atributoPE: null,         // atributo do cálculo do PE ou PD (null = PRE)
        atributoSAN: null,        // atributo do cálculo da SAN (null = nenhum)
        atributoDT: null          // atributo da DT de rituais (null = PRE)
      },

      // Regra opcional NEX e Experiência: escolhas e estado das alterações de NEX (js/calc.js, js/ui-nex.js)
      alteracoesNex: novasAlteracoesNex(),

      identificacao: {
        nome: '',
        jogador: '',
        origem: '',               // id de OP.data.origens, 'outra' (texto em origemTexto) ou ''
        origemTexto: '',
        classe: '',               // id de OP.data.classes ('' = não escolhida)
        trilha: '',               // id de OP.data.trilhas (da classe), 'outra' (texto em trilhaTexto) ou ''
        trilhaTexto: '',
        versatilidade: '',        // NEX 50%: id de outra trilha da classe ou ''
        nex: 5,                   // em %, um dos valores de OP.data.nex
        estagio: 1,               // Sobrevivente: estágio (1 a classe.estagioMax)
        nivel: 1,                 // regra NEX e Experiência: nível de experiência (1 a 20); 1 nível = 5% de NEX
        escolhas: novasEscolhas()
      },

      atributos: {
        agi: novoAtributo(),
        for: novoAtributo(),
        int: novoAtributo(),
        pre: novoAtributo(),
        vig: novoAtributo()
      },

      recursos: {
        pv: novoRecurso(),
        pe: novoRecurso(),
        san: novaSanidade()
      },

      pericias: novasPericias(),  // idPericia -> { grau, outros, atributo, concedida, nomeAberto }
      pontosTreinamento: {
        bonus: 0                  // bônus manual somado ao total de pontos
      },

      defesa: novaDefesa(),
      inventario: novoInventario(),
      ataques: [],                // lista de ataques (ver ataquePadrao)
      habilidades: [],            // lista de habilidades e poderes (ver habilidadePadrao)
      rituais: [],                // lista de rituais (ver ritualPadrao)
      conjuracao: novaConjuracao(),

      // Efeitos automáticos de habilidades, poderes e rituais (data/efeitos*.js; js/calc.js).
      // ativos: efeitos ligados { id, chave, rodadas, ateFimCena }; preparados: gastos opcionais
      // para o próximo teste { id, chave, gasto, unidades }; escolhas: { id, chave, campo, valor }.
      efeitos: { ativos: [], preparados: [], escolhas: [] },

      // Etapa 10: condições e estados. turnosMorrendo conta os turnos já iniciados
      // com PV 0; bonusLimiteMorrendo soma ao limite do config (características).
      condicoes: {
        ativas: [],
        turnosMorrendo: 0,
        bonusLimiteMorrendo: 0,
        insano: false,
        aplicarEfeitos: true
      },

      // Etapa 10: condição de descanso escolhida (config.descanso.condicoes)
      descanso: { condicao: 'normal' },

      // Etapa 10: biografia (antiga "descricao"). retrato: data URL validada.
      biografia: {
        retrato: '',
        aparencia: '',
        personalidade: '',
        historico: '',
        objetivo: '',
        medos: '',
        aliados: [],
        rivais: [],
        notas: '',
        diario: []
      }
    };
  }

  /** Moldes dos elementos de cada lista da ficha (usados por sanitizar). */
  const MOLDES_LISTA = {
    'inventario.itens': itemPadrao,
    'inventario.itens.melhorias': melhoriaPadrao,
    'inventario.itens.modCategoria': modCategoriaPadrao,
    ataques: ataquePadrao,
    habilidades: habilidadePadrao,
    rituais: ritualPadrao,
    'condicoes.ativas': condicaoAtivaPadrao,
    'defesa.rd': rdPadrao,
    'efeitos.ativos': efeitoAtivoPadrao,
    'efeitos.preparados': efeitoPreparadoPadrao,
    'efeitos.escolhas': efeitoEscolhaPadrao,
    'biografia.aliados': pessoaPadrao,
    'biografia.rivais': pessoaPadrao,
    'biografia.diario': entradaDiarioPadrao
  };

  /* ------------------------------------------------------------------------
     Criação de elementos de lista (com id)
     ------------------------------------------------------------------------ */

  /** Id único e simples: prefixo + hora em base 36 + contador. */
  function novoId(prefixo) {
    contadorIds += 1;
    return prefixo + '-' + Date.now().toString(36) + '-' + contadorIds;
  }

  /** Cria um elemento completo a partir do molde e de dados parciais (ou vazio). */
  function criarComMolde(molde, prefixo, dados) {
    const elemento = mesclarComPadrao(molde(), dados);
    if (!idValido(elemento.id)) elemento.id = novoId(prefixo);
    return elemento;
  }

  function novaMelhoria(dados) {
    return criarComMolde(melhoriaPadrao, 'mel', dados);
  }

  function novoModCategoria(dados) {
    return criarComMolde(modCategoriaPadrao, 'cat', dados);
  }

  /** Item completo; as melhorias e os modificadores ganham ids únicos e o limite por item. */
  function novoItem(dados) {
    const item = criarComMolde(itemPadrao, 'item', dados);
    item.melhorias = normalizarLista(item.melhorias, novaMelhoria, 'mel').slice(0, MAX_MELHORIAS);
    item.modCategoria = normalizarLista(item.modCategoria, novoModCategoria, 'cat').slice(0, MAX_MOD_CATEGORIA);
    return item;
  }

  function novoAtaque(dados) {
    return criarComMolde(ataquePadrao, 'atq', dados);
  }

  function novaHabilidade(dados) {
    return criarComMolde(habilidadePadrao, 'hab', dados);
  }

  function novaRd(dados) {
    return criarComMolde(rdPadrao, 'rd', dados);
  }

  function semAcentoMinusculo(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  /**
   * Mantém na lista de habilidades a da origem e as da trilha (ids "auto-…", ver OP.calc.habilidadesAutomaticas):
   * entram sozinhas ao escolher a origem ou alcançar o NEX da trilha e saem quando a origem/trilha muda
   * ou o NEX cai abaixo do marco. Uma habilidade que a pessoa já tinha com a mesma fonte e nome é adotada
   * (vira automática, mantendo o que ela escreveu). Devolve true se a lista mudou.
   */
  function sincronizarHabilidadesAutomaticas(ficha) {
    const alvo = ficha || api.ficha;
    if (!alvo || !Array.isArray(alvo.habilidades)) return false;
    const desejadas = OP.calc.habilidadesAutomaticas(alvo);
    const ids = Object.create(null);
    desejadas.forEach(function (d) { ids[d.id] = d; });
    let mudou = false;
    const lista = [];
    alvo.habilidades.forEach(function (h) {
      if (h && typeof h.id === 'string' && h.id.indexOf('auto-') === 0 && !ids[h.id]) { mudou = true; return; } // saiu
      lista.push(h);
    });
    desejadas.forEach(function (d) {
      const existente = lista.find(function (h) { return h && h.id === d.id; });
      if (existente) {
        if (d.catalogo && existente.catalogo !== d.catalogo) {
          lista[lista.indexOf(existente)] = Object.assign({}, existente, { catalogo: d.catalogo });
          mudou = true;
        }
        return;
      }
      const alvoNome = semAcentoMinusculo(d.nome);
      const adotada = lista.find(function (h) {
        return h && h.fonte === d.fonte && !(typeof h.id === 'string' && h.id.indexOf('auto-') === 0) && semAcentoMinusculo(h.nome) === alvoNome;
      });
      if (adotada) {
        lista[lista.indexOf(adotada)] = Object.assign({}, adotada, { id: d.id, catalogo: d.catalogo || adotada.catalogo });
      } else {
        const nova = novaHabilidade({ id: d.id, nome: d.nome, fonte: d.fonte, catalogo: d.catalogo });
        if (d.fonte === 'origem') lista.unshift(nova); // a da origem fica sempre na frente
        else lista.push(nova);
      }
      mudou = true;
    });
    if (mudou) gravarEm(alvo, 'habilidades', lista, true);
    return mudou;
  }

  /** Condição ativa nova (id do catálogo ou "personalizada"); o uid é sempre novo. */
  function novaCondicao(dados) {
    const condicao = mesclarComPadrao(condicaoAtivaPadrao(), dados);
    condicao.uid = novoId('cond');
    return condicao;
  }

  function novaPessoa(dados) {
    return criarComMolde(pessoaPadrao, 'pes', dados);
  }

  function novaEntradaDiario(dados) {
    return criarComMolde(entradaDiarioPadrao, 'dia', dados);
  }

  function novoRitual(dados) {
    const migrado = migrarRitual(dados);
    const ritual = criarComMolde(ritualPadrao, 'rit', migrado);
    completarFormas(ritual, ehObjetoSimples(migrado) ? migrado.formas : null);
    return ritual;
  }

  /* ---------- Custos dos rituais (usados nas migrações e nos padrões) ---------- */

  function inteiroNaoNegativo(valor) {
    const n = Math.trunc(Number(valor));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** Círculo válido (1 a 4); qualquer outro valor vira 1. */
  function circuloDoRitual(valor) {
    const n = Math.trunc(Number(valor));
    return n >= 1 && n <= 4 ? n : 1;
  }

  /** Custo em PE de um círculo (config.custoRitualPorCirculo). */
  function custoDoCirculo(circulo) {
    const tabela = OP.data.config.custoRitualPorCirculo || {};
    return inteiroNaoNegativo(tabela[circulo]);
  }

  /** Custo base em uso: o digitado (custoBase) ou, se null, o do círculo. */
  function custoBaseEfetivo(ritual) {
    const base = ritual.custoBase;
    if (typeof base === 'number' && Number.isFinite(base)) return inteiroNaoNegativo(base);
    return custoDoCirculo(circuloDoRitual(ritual.circulo));
  }

  /**
   * Preenche o que NÃO veio nos dados das formas Discente e Verdadeira
   * (o que veio fica como está):
   * - requerCirculo: Discente = círculo + 1 e Verdadeira = círculo + 2 (até o 4º);
   * - requerAfinidade: só a Verdadeira, como nos livros;
   * - custoAdicional: custo do círculo exigido − custo base (o "+N PE" impresso).
   */
  function completarFormas(ritual, formasSalvas) {
    const circulo = circuloDoRitual(ritual.circulo);
    const salvas = ehObjetoSimples(formasSalvas) ? formasSalvas : {};
    [['discente', 1], ['verdadeira', 2]].forEach(function (par) {
      const forma = ritual.formas[par[0]];
      const salva = ehObjetoSimples(salvas[par[0]]) ? salvas[par[0]] : {};
      if (typeof forma.requerCirculo !== 'number' || !Number.isFinite(forma.requerCirculo)) {
        forma.requerCirculo = Math.min(4, circulo + par[1]);
      }
      if (!temPropria(salva, 'requerAfinidade')) forma.requerAfinidade = par[0] === 'verdadeira';
      if (!temPropria(salva, 'custoAdicional')) {
        forma.custoAdicional = Math.max(0, custoDoCirculo(circuloDoRitual(forma.requerCirculo)) - custoBaseEfetivo(ritual));
      }
    });
  }

  /**
   * Completa uma lista salva (itens, ataques, habilidades, rituais) com os
   * campos padrão e garante ids válidos e únicos. Entradas que não são objetos saem.
   */
  function normalizarLista(lista, criar, prefixo) {
    const vistos = Object.create(null);
    return (Array.isArray(lista) ? lista : []).filter(ehObjetoSimples).map(function (dados) {
      const elemento = criar(dados);
      if (vistos[elemento.id]) elemento.id = novoId(prefixo);
      vistos[elemento.id] = true;
      return elemento;
    });
  }

  /* ------------------------------------------------------------------------
     Migrações e padrões
     ------------------------------------------------------------------------ */

  /** Cópia rasa de um objeto sem uma chave. */
  function semChave(objeto, chave) {
    const copia = Object.assign({}, objeto);
    delete copia[chave];
    return copia;
  }

  /**
   * Migrações de um ritual (conferem o conteúdo, não a versão). Não altera
   * o objeto recebido e pode ser chamada de novo sem efeito.
   * - Etapa 7 → 8: "resistencia" era texto livre. O texto vai para
   *   resistenciaNotas e a resistência vira { teste: '', efeito: '' }.
   * - Etapa 8 → 9: cada forma tinha um "custo" total. A Padrão passa a usar o
   *   custo base do ritual (custoBase fica null se o custo antigo era o do
   *   círculo; senão guarda o número antigo). Discente e Verdadeira ganham
   *   custoAdicional = máximo entre 0 e (custo antigo − custo base). O custo
   *   base usado é o do círculo, ou o número antigo da Padrão se ele era
   *   outro (assim o total antigo se mantém).
   */
  function migrarRitual(dados) {
    if (!ehObjetoSimples(dados)) return dados;
    let copia = dados;
    function copiar() {
      if (copia === dados) copia = Object.assign({}, dados);
    }

    if (typeof dados.resistencia === 'string') {
      copiar();
      const texto = copia.resistencia;
      const notas = typeof copia.resistenciaNotas === 'string' ? copia.resistenciaNotas : '';
      if (notas.trim() === '') copia.resistenciaNotas = texto;
      else if (texto.trim() !== '') copia.resistenciaNotas = texto + ' · ' + notas;
      copia.resistencia = { teste: '', efeito: '' };
    }

    const formas = copia.formas;
    const temCustoAntigo = ehObjetoSimples(formas) && ['padrao', 'discente', 'verdadeira'].some(function (id) {
      return ehObjetoSimples(formas[id]) && temPropria(formas[id], 'custo');
    });
    if (temCustoAntigo) {
      copiar();
      copia.formas = Object.assign({}, formas);
      const custoCirculo = custoDoCirculo(circuloDoRitual(copia.circulo));
      let base = typeof copia.custoBase === 'number' && Number.isFinite(copia.custoBase) ? copia.custoBase : null;
      const padrao = copia.formas.padrao;
      if (ehObjetoSimples(padrao) && temPropria(padrao, 'custo')) {
        const antigo = inteiroNaoNegativo(padrao.custo);
        if (base === null && antigo !== custoCirculo) base = antigo;
        copia.formas.padrao = semChave(padrao, 'custo');
      }
      copia.custoBase = base;
      const baseEfetiva = base === null ? custoCirculo : inteiroNaoNegativo(base);
      ['discente', 'verdadeira'].forEach(function (id) {
        const forma = copia.formas[id];
        if (!ehObjetoSimples(forma) || !temPropria(forma, 'custo')) return;
        const nova = semChave(forma, 'custo');
        if (!temPropria(nova, 'custoAdicional')) nova.custoAdicional = Math.max(0, inteiroNaoNegativo(forma.custo) - baseEfetiva);
        copia.formas[id] = nova;
      });
    }
    return copia;
  }

  /** "Tropa  de Choque" → "tropa de choque" (sem acento, minúsculo, espaços simples). */
  function normalizarNome(texto) {
    return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function existeId(lista, id) {
    return Array.isArray(lista) && lista.some(function (item) { return item.id === id; });
  }

  /**
   * Etapa 8 → 9: origem e trilha eram texto livre e viram ids.
   * - Texto igual (sem acento, minúsculo) ao nome de uma origem → id dela;
   * - trilha: compara só com as trilhas da classe da ficha;
   * - sem correspondência: o valor vira 'outra' e o texto vai para
   *   origemTexto/trilhaTexto (se ainda estiver vazio).
   * Confere o conteúdo (ids conhecidos e 'outra' ficam como estão). ALTERA o objeto.
   */
  function migrarIdentificacao(ident) {
    function converter(campo, campoTexto, candidatas, todas) {
      const valor = ident[campo];
      if (typeof valor !== 'string' || valor === '' || valor === 'outra' || existeId(todas, valor)) return;
      if (valor.trim() === '') {
        ident[campo] = '';
        return;
      }
      const alvo = normalizarNome(valor);
      const achada = candidatas.find(function (item) { return normalizarNome(item.nome) === alvo; });
      if (achada) {
        ident[campo] = achada.id;
        return;
      }
      if (typeof ident[campoTexto] !== 'string' || ident[campoTexto].trim() === '') ident[campoTexto] = valor;
      ident[campo] = 'outra';
    }
    const origens = Array.isArray(OP.data.origens) ? OP.data.origens : [];
    const trilhas = Array.isArray(OP.data.trilhas) ? OP.data.trilhas : [];
    converter('origem', 'origemTexto', origens, origens);
    converter('trilha', 'trilhaTexto', trilhas.filter(function (t) { return t.classe === ident.classe; }), trilhas);
  }

  /**
   * Etapa 8 → 9: conjuracao.afinidade (um elemento) vira elementoConectado
   * com afinidadeDesenvolvida = true; o campo antigo sai. ALTERA o objeto.
   */
  function migrarConjuracao(conjuracao) {
    if (!temPropria(conjuracao, 'afinidade')) return;
    const elemento = conjuracao.afinidade;
    const possivel = (OP.data.elementos || []).some(function (e) { return e.id === elemento && e.afinidadePossivel === true; });
    if (possivel && (conjuracao.elementoConectado === null || conjuracao.elementoConectado === undefined)) {
      conjuracao.elementoConectado = elemento;
      conjuracao.afinidadeDesenvolvida = true;
    }
    delete conjuracao.afinidade;
  }

  /**
   * Etapa 9 → 10: move o conteúdo de `descricao` para `biografia`
   * (aparencia, personalidade, historico, objetivo e anotacoes → notas).
   * ALTERA o objeto recebido.
   */
  function migrarDescricao(salvo) {
    const antiga = salvo.descricao;
    if (!ehObjetoSimples(antiga)) return;
    if (!ehObjetoSimples(salvo.biografia)) salvo.biografia = {};
    const bio = salvo.biografia;
    [['aparencia', 'aparencia'], ['personalidade', 'personalidade'], ['historico', 'historico'],
      ['objetivo', 'objetivo'], ['anotacoes', 'notas']].forEach(function (par) {
      const velho = typeof antiga[par[0]] === 'string' ? antiga[par[0]] : '';
      if (velho.trim() === '') return;
      const novo = typeof bio[par[1]] === 'string' ? bio[par[1]] : '';
      if (novo.trim() === '') bio[par[1]] = velho;
      else if (novo !== velho) bio[par[1]] = novo + '\n\n' + velho;
    });
  }

  /** Versão do modelo em que os dados foram salvos (1 se não informada). */
  function versaoDosDados(salvo) {
    if (typeof salvo.versaoModelo === 'number' && Number.isFinite(salvo.versaoModelo)) return salvo.versaoModelo;
    if (typeof salvo.versao === 'number' && Number.isFinite(salvo.versao)) return salvo.versao;
    return 1;
  }

  /**
   * v11 → v12: defesa.resistencias (tipo → número) vira defesa.rd. Os tipos com o mesmo
   * valor entram juntos numa RD só. Confere o conteúdo, não a versão; ALTERA o objeto.
   */
  function migrarResistencias(defesa) {
    if (!temPropria(defesa, 'resistencias')) return;
    const antigas = defesa.resistencias;
    delete defesa.resistencias;
    if (!ehObjetoSimples(antigas)) return;
    const lista = Array.isArray(defesa.rd) ? defesa.rd : [];
    const porValor = Object.create(null);
    OP.data.tiposDano.forEach(function (tipo) {
      const valor = Math.trunc(Number(antigas[tipo.id]));
      if (!Number.isFinite(valor) || valor === 0) return;
      if (!porValor[valor]) {
        porValor[valor] = novaRd({ valor: valor });
        lista.push(porValor[valor]);
      }
      porValor[valor].tipos[tipo.id] = true;
    });
    defesa.rd = lista;
  }

  /**
   * Atualiza dados salvos por versões antigas do modelo, antes da mescla.
   * ALTERA o objeto recebido (quem chama passa uma cópia).
   */
  function migrar(salvo) {
    if (!ehObjetoSimples(salvo)) return salvo;
    const versao = versaoDosDados(salvo);

    // v1 → v2: o bônus dos recursos passou a se chamar bonusMax.
    if (versao < 2 && ehObjetoSimples(salvo.recursos)) {
      Object.keys(salvo.recursos).forEach(function (id) {
        const recurso = salvo.recursos[id];
        if (!ehObjetoSimples(recurso) || !temPropria(recurso, 'bonus')) return;
        if (!temPropria(recurso, 'bonusMax')) recurso.bonusMax = recurso.bonus;
        delete recurso.bonus;
      });
    }

    // v3 → v4: o bônus de Defesa passou a se chamar "outros".
    if (versao < 4 && ehObjetoSimples(salvo.defesa) && temPropria(salvo.defesa, 'bonus')) {
      if (!temPropria(salvo.defesa, 'outros')) salvo.defesa.outros = salvo.defesa.bonus;
      delete salvo.defesa.bonus;
    }

    // v7 → v9: resistência e custos dos rituais (confere o conteúdo, não a versão).
    if (Array.isArray(salvo.rituais)) salvo.rituais = salvo.rituais.map(migrarRitual);

    // v8 → v9: origem/trilha por id e afinidade → elemento conectado.
    if (ehObjetoSimples(salvo.identificacao)) migrarIdentificacao(salvo.identificacao);
    if (ehObjetoSimples(salvo.conjuracao)) migrarConjuracao(salvo.conjuracao);

    // v9 → v10: "descricao" virou "biografia" (anotacoes → notas). Nada se perde:
    // se os dois lados têm texto, o texto antigo vai depois do novo.
    if (temPropria(salvo, 'descricao')) {
      migrarDescricao(salvo);
      delete salvo.descricao;
    }

    // v11 → v12: a resistência por tipo (um número para cada tipo) virou a lista de RD.
    if (ehObjetoSimples(salvo.defesa)) migrarResistencias(salvo.defesa);

    // v7 → v8: "versao" passou a se chamar "versaoModelo".
    delete salvo.versao;
    salvo.versaoModelo = VERSAO_MODELO;
    return salvo;
  }

  /** Número inteiro limitado a [minimo, maximo]; não numérico vira `padrao`. */
  function inteiroEntre(valor, minimo, maximo, padrao) {
    const n = Math.trunc(Number(valor));
    if (!Number.isFinite(n)) return padrao;
    return Math.min(Math.max(n, minimo), maximo);
  }

  /**
   * Confere o bloco de condições (ficha já completa ou sanitizada):
   * ids só do catálogo ou "personalizada" (outros saem; o mesmo id do catálogo
   * não repete), rodadas inteiro de 1 a 99 ou null, turnos morrendo de 0 a 20,
   * no máximo 50 condições e números da personalizada em faixas razoáveis.
   * Devolve quantas condições saíram. ALTERA o objeto.
   */
  function normalizarCondicoes(ficha, rel) {
    const c = ficha.condicoes;
    const catalogo = OP.data.condicoes || [];
    const vistos = Object.create(null);
    const uids = Object.create(null);
    let removidas = 0;
    c.ativas = (Array.isArray(c.ativas) ? c.ativas : []).filter(function (item) {
      const ok = ehObjetoSimples(item) && (item.id === 'personalizada' ||
        (typeof item.id === 'string' && catalogo.some(function (d) { return d.id === item.id; }) && !vistos[item.id]));
      if (ok && item.id !== 'personalizada') vistos[item.id] = true;
      if (!ok) removidas += 1;
      return ok;
    }).slice(0, MAX_CONDICOES).map(function (item) {
      item.uid = idValido(item.uid) && !uids[item.uid] ? item.uid : novoId('cond');
      uids[item.uid] = true;
      const bruto = item.rodadas;
      item.rodadas = bruto === null || bruto === undefined ? null : inteiroEntre(bruto, 1, 99, null);
      item.ateFimCena = item.ateFimCena === true;
      item.nota = typeof item.nota === 'string' ? item.nota.slice(0, LIMITES_TEXTO['condicoes.ativas[].nota']) : '';
      const p = ehObjetoSimples(item.personalizada) ? item.personalizada : {};
      item.personalizada = {
        nome: typeof p.nome === 'string' ? p.nome.slice(0, LIMITES_TEXTO['condicoes.ativas[].personalizada.nome']) : '',
        dadosPericias: inteiroEntre(p.dadosPericias, -10, 10, 0),
        defesa: inteiroEntre(p.defesa, -50, 50, 0),
        deslocamentoMult: [0, 0.5, 1].indexOf(Number(p.deslocamentoMult)) !== -1 ? Number(p.deslocamentoMult) : 1
      };
      return item;
    });
    if (removidas && rel) anotar(rel.descartados, 'condicoes.ativas');
    c.turnosMorrendo = inteiroEntre(c.turnosMorrendo, 0, 20, 0);
    c.bonusLimiteMorrendo = inteiroEntre(c.bonusLimiteMorrendo, 0, 10, 0);
    c.insano = c.insano === true;
    c.aplicarEfeitos = c.aplicarEfeitos !== false;
    return removidas;
  }

  /** Confere a biografia: retrato só se for uma imagem em data URL válida; o resto vira "" . ALTERA o objeto. */
  function normalizarBiografia(ficha, rel) {
    const b = ficha.biografia;
    if (b.retrato !== '' && !OP.calc.retratoValido(b.retrato)) {
      b.retrato = '';
      if (rel) anotar(rel.corrigidos, 'biografia.retrato');
    }
  }

  /** Condição de descanso conhecida (senão "normal"). ALTERA o objeto. */
  function normalizarDescanso(ficha) {
    ficha.descanso.condicao = OP.calc.condicaoDescansoValida(ficha.descanso.condicao);
  }

  /**
   * Completa uma ficha (de qualquer etapa) com todos os campos do modelo,
   * recursivamente e sem sobrescrever o que já existe, aplicando as
   * migrações e garantindo ids válidos nas listas.
   * Não altera o objeto recebido e é idempotente:
   * completarPadroes(completarPadroes(x)) é igual a completarPadroes(x).
   */
  function completarPadroes(ficha) {
    const copia = clonar(ficha);
    const salvo = migrar(ehObjetoSimples(copia) ? copia : {});
    const completa = mesclarComPadrao(modeloVazio(), salvo);
    completa.versaoModelo = VERSAO_MODELO;
    if (completa.id !== '' && !idValido(completa.id)) completa.id = '';
    completa.inventario.itens = normalizarLista(completa.inventario.itens, novoItem, 'item');
    completa.ataques = normalizarLista(completa.ataques, novoAtaque, 'atq');
    completa.habilidades = normalizarLista(completa.habilidades, novaHabilidade, 'hab');
    completa.rituais = normalizarLista(completa.rituais, novoRitual, 'rit');
    completa.defesa.rd = normalizarLista(completa.defesa.rd, novaRd, 'rd');
    completa.biografia.aliados = normalizarLista(completa.biografia.aliados, novaPessoa, 'pes').slice(0, MAX_PESSOAS);
    completa.biografia.rivais = normalizarLista(completa.biografia.rivais, novaPessoa, 'pes').slice(0, MAX_PESSOAS);
    completa.biografia.diario = normalizarLista(completa.biografia.diario, novaEntradaDiario, 'dia').slice(0, MAX_DIARIO);
    normalizarCondicoes(completa);
    normalizarBiografia(completa);
    normalizarDescanso(completa);
    return completa;
  }

  /* ------------------------------------------------------------------------
     Sanitização (dados importados NÃO são confiáveis)
     ------------------------------------------------------------------------ */

  // Campos com padrão null: tipo aceito além de null.
  const TIPOS_ANULAVEIS = {
    atual: 'numero',
    atributo: 'texto',
    creditoNivel: 'texto',
    periciaKit: 'texto',
    itemId: 'texto',
    atributoDT: 'texto',
    elementoConectado: 'texto',
    conjunto: 'numero',
    elemento: 'texto',
    custoBase: 'numero',
    requerCirculo: 'numero',
    rodadas: 'numero'
  };

  // Listas de valores simples (ids de perícia ou null), não de objetos.
  const LISTAS_SIMPLES = {
    'identificacao.escolhas.origem.livres': true,
    'identificacao.escolhas.classe.grupos': true
  };

  function novoRelatorio() {
    return {
      ignorados: Object.create(null),   // chaves que não existem no modelo
      corrigidos: Object.create(null),  // valores de tipo errado (viraram o padrão)
      textos: Object.create(null),      // textos cortados
      listas: Object.create(null),      // listas cortadas
      descartados: Object.create(null)  // entradas de lista que não eram objetos
    };
  }

  function juntarCaminho(base, chave) {
    return base ? base + '.' + chave : String(chave);
  }

  function anotar(mapa, caminho) {
    mapa[caminho.length > 80 ? caminho.slice(0, 77) + '…' : caminho] = true;
  }

  /** Tamanho máximo do texto de um campo: o do retrato, o próprio do campo ou o geral. */
  function limiteTexto(caminho) {
    // Retrato grande demais não é cortado (um corte deixaria a imagem corrompida): normalizarBiografia recusa.
    if (caminho === 'biografia.retrato') return Infinity;
    return temPropria(LIMITES_TEXTO, caminho) ? LIMITES_TEXTO[caminho] : LIMITE_TEXTO;
  }

  function sanitizarTexto(valor, padrao, caminho, rel) {
    let texto;
    if (typeof valor === 'string') texto = valor;
    else if ((typeof valor === 'number' && Number.isFinite(valor)) || typeof valor === 'boolean') {
      texto = String(valor);
      anotar(rel.corrigidos, caminho);
    } else {
      anotar(rel.corrigidos, caminho);
      return padrao;
    }
    const limite = limiteTexto(caminho);
    if (texto.length > limite) {
      anotar(rel.textos, caminho);
      texto = texto.slice(0, limite);
    }
    return texto;
  }

  function sanitizarNumero(valor, padrao, caminho, rel) {
    if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
    if (typeof valor === 'string' && valor.trim() !== '' && Number.isFinite(Number(valor))) {
      anotar(rel.corrigidos, caminho);
      return Number(valor);
    }
    anotar(rel.corrigidos, caminho);
    return padrao;
  }

  function sanitizarAnulavel(chave, valor, caminho, rel) {
    if (valor === null) return null;
    const tipo = TIPOS_ANULAVEIS[chave];
    if (tipo === 'numero' && typeof valor === 'number' && Number.isFinite(valor)) return valor;
    if (tipo === 'texto' && typeof valor === 'string') return valor.slice(0, LIMITE_TEXTO);
    anotar(rel.corrigidos, caminho);
    return null;
  }

  function sanitizarLista(caminho, valor, rel) {
    if (!Array.isArray(valor)) {
      anotar(rel.corrigidos, caminho);
      return [];
    }
    const molde = MOLDES_LISTA[caminho.replace(/\[\]/g, '')];
    let lista = valor;
    const limiteLista = temPropria(LIMITES_LISTA, caminho) ? LIMITES_LISTA[caminho] : LIMITE_LISTA;
    if (lista.length > limiteLista) {
      anotar(rel.listas, caminho);
      lista = lista.slice(0, limiteLista);
    }
    // Listas de ids (escolhas de perícias): texto curto ou null
    if (LISTAS_SIMPLES[caminho]) {
      return lista.map(function (item) {
        if (item === null || (typeof item === 'string' && item.length <= 64)) return item;
        anotar(rel.corrigidos, caminho);
        return null;
      });
    }
    if (!molde) return []; // lista que o modelo não conhece
    const resultado = [];
    lista.forEach(function (elemento) {
      if (!ehObjetoSimples(elemento)) {
        anotar(rel.descartados, caminho);
        return;
      }
      resultado.push(sanitizarValor(molde(), elemento, caminho + '[]', rel));
    });
    return resultado;
  }

  /** Confere um valor contra o padrão do modelo (recursivo). */
  function sanitizarValor(padrao, valor, caminho, rel) {
    const chave = caminho.split('.').pop().replace(/\[\]$/, '');
    if (padrao === null) return valor === undefined ? null : sanitizarAnulavel(chave, valor, caminho, rel);
    if (valor === undefined) return clonar(padrao);
    if (Array.isArray(padrao)) return sanitizarLista(caminho, valor, rel);

    if (ehObjetoSimples(padrao)) {
      if (!ehObjetoSimples(valor)) {
        anotar(rel.corrigidos, caminho);
        return clonar(padrao);
      }
      const resultado = {};
      Object.keys(padrao).forEach(function (k) {
        resultado[k] = sanitizarValor(padrao[k], temPropria(valor, k) ? valor[k] : undefined, juntarCaminho(caminho, k), rel);
      });
      Object.keys(valor).forEach(function (k) {
        if (!temPropria(padrao, k)) anotar(rel.ignorados, juntarCaminho(caminho, k));
      });
      return resultado;
    }

    if (typeof padrao === 'string') return sanitizarTexto(valor, padrao, caminho, rel);
    if (typeof padrao === 'number') return sanitizarNumero(valor, padrao, caminho, rel);
    if (typeof padrao === 'boolean') {
      if (typeof valor === 'boolean') return valor;
      anotar(rel.corrigidos, caminho);
      return padrao;
    }
    return padrao;
  }

  /** "a, b, c e mais 4" (no máximo 8 nomes). */
  function listaCurta(mapa) {
    const nomes = Object.keys(mapa);
    const mostrados = nomes.slice(0, 8).join(', ');
    return nomes.length > 8 ? mostrados + ' e mais ' + (nomes.length - 8) : mostrados;
  }

  function textosRelatorio(rel) {
    const textos = [];
    if (Object.keys(rel.ignorados).length) textos.push('Campos ignorados (não existem nesta ficha): ' + listaCurta(rel.ignorados) + '.');
    if (Object.keys(rel.corrigidos).length) textos.push('Valores inválidos trocados pelo padrão: ' + listaCurta(rel.corrigidos) + '.');
    if (Object.keys(rel.textos).length) textos.push('Textos cortados no tamanho máximo (' + LIMITE_TEXTO + ' caracteres na maioria dos campos): ' + listaCurta(rel.textos) + '.');
    if (Object.keys(rel.listas).length) textos.push('Listas cortadas no limite de itens (' + LIMITE_LISTA + ' na maioria): ' + listaCurta(rel.listas) + '.');
    if (Object.keys(rel.descartados).length) textos.push('Entradas inválidas descartadas em: ' + listaCurta(rel.descartados) + '.');
    return textos;
  }

  /**
   * Confere uma ficha (de qualquer origem) contra o modelo:
   * - descarta chaves desconhecidas;
   * - força os tipos (texto, número finito, booleano, lista) e troca
   *   valores inválidos pelo padrão;
   * - corta textos em 5000 caracteres e listas em 500 itens.
   * Textos continuam textos: "<script>" fica como está (a tela só usa
   * textContent/.value). As migrações rodam antes, numa cópia.
   * avisos (opcional): lista que recebe frases sobre o que foi ignorado/corrigido.
   */
  function sanitizar(obj, avisos) {
    const rel = novoRelatorio();
    let base = clonar(obj);
    if (!ehObjetoSimples(base)) base = {};
    base = migrar(base);
    const resultado = sanitizarValor(modeloVazio(), base, '', rel);
    normalizarCondicoes(resultado, rel);
    normalizarBiografia(resultado, rel);
    normalizarDescanso(resultado);
    if (Array.isArray(avisos)) Array.prototype.push.apply(avisos, textosRelatorio(rel));
    return resultado;
  }

  /* ------------------------------------------------------------------------
     Exportar e importar
     ------------------------------------------------------------------------ */

  /** Envelope de uma ficha exportada (o .json baixado). */
  function envelopeFicha(ficha) {
    return {
      formato: FORMATO_FICHA,
      versao: VERSAO_MODELO,
      exportadoEm: new Date().toISOString(),
      ficha: completarPadroes(ficha)
    };
  }

  /** Envelope do backup de várias fichas. */
  function envelopeBackup(fichas) {
    return {
      formato: FORMATO_BACKUP,
      versao: VERSAO_MODELO,
      exportadoEm: new Date().toISOString(),
      fichas: (Array.isArray(fichas) ? fichas : []).map(completarPadroes)
    };
  }

  function nomeParaAviso(ficha, indice) {
    const nome = ficha && ficha.identificacao && typeof ficha.identificacao.nome === 'string' ? ficha.identificacao.nome.trim() : '';
    return nome ? '"' + (nome.length > 40 ? nome.slice(0, 39) + '…' : nome) + '"' : 'nº ' + (indice + 1);
  }

  /**
   * Lê o texto de um arquivo importado. NUNCA lança exceção.
   * Devolve { ok, fichas, avisos, erro }:
   * - recusa texto que não é JSON, formato desconhecido e versão maior que a atual;
   * - aceita versões antigas (migradas por completarPadroes);
   * - cada ficha passa por sanitizar e completarPadroes.
   * O id original é mantido aqui; quem grava (js/fichas.js) troca se já existir.
   */
  function lerImportacao(texto) {
    function falha(erro) {
      return { ok: false, fichas: [], avisos: [], erro: erro };
    }
    try {
      if (typeof texto !== 'string' || texto.trim() === '') return falha('O arquivo está vazio.');
      if (texto.length > LIMITE_ARQUIVO) return falha('O arquivo passa de 2 MB.');

      let dados;
      try {
        dados = JSON.parse(texto);
      } catch (erro) {
        return falha('O arquivo está danificado ou não é um .json de ficha.');
      }
      if (!ehObjetoSimples(dados)) return falha('Este arquivo não é uma ficha do Dossiê. Use um .json baixado em Exportar ou Backup.');
      if (!temPropria(dados, 'formato')) {
        return falha('Este arquivo não é uma ficha do Dossiê. Use um .json baixado em Exportar ou Backup.');
      }
      if (dados.formato !== FORMATO_FICHA && dados.formato !== FORMATO_BACKUP) {
        return falha('Este arquivo é de outro programa ou site. Use um .json baixado em Exportar ou Backup do Dossiê.');
      }

      const versao = dados.versao;
      if (typeof versao !== 'number' || !Number.isFinite(versao) || versao < 1) return falha('O arquivo está incompleto (falta a versão). Exporte a ficha de novo e tente outra vez.');
      if (versao > VERSAO_MODELO) {
        return falha('Este arquivo foi gerado por uma versão mais nova do site (versão ' + versao + '; esta é a ' +
          VERSAO_MODELO + '). Atualize a página antes de importar.');
      }

      let brutas;
      if (dados.formato === FORMATO_FICHA) {
        if (!ehObjetoSimples(dados.ficha)) return falha('O arquivo não contém uma ficha.');
        brutas = [dados.ficha];
      } else {
        if (!Array.isArray(dados.fichas)) return falha('O backup não contém a lista de fichas.');
        brutas = dados.fichas;
      }

      const avisos = [];
      if (brutas.length > LIMITE_LISTA) {
        avisos.push('O backup tem ' + brutas.length + ' fichas; só as ' + LIMITE_LISTA + ' primeiras foram lidas.');
        brutas = brutas.slice(0, LIMITE_LISTA);
      }

      const fichas = [];
      for (let i = 0; i < brutas.length; i++) {
        const bruta = brutas[i];
        if (!ehObjetoSimples(bruta)) {
          avisos.push('A entrada nº ' + (i + 1) + ' não é uma ficha e foi ignorada.');
          continue;
        }
        if (versaoDosDados(bruta) > VERSAO_MODELO) {
          return falha('Este arquivo tem uma ficha gerada por uma versão mais nova do site. Atualize a página antes de importar.');
        }
        const copia = clonar(bruta) || {};
        // Ficha sem versão própria: vale a versão do arquivo.
        if (typeof copia.versaoModelo !== 'number' && typeof copia.versao !== 'number') copia.versaoModelo = versao;
        const avisosFicha = [];
        const ficha = completarPadroes(sanitizar(copia, avisosFicha));
        const prefixo = brutas.length > 1 ? 'Ficha ' + nomeParaAviso(ficha, i) + ': ' : '';
        avisosFicha.forEach(function (aviso) { avisos.push(prefixo + aviso); });
        fichas.push(ficha);
      }
      if (!fichas.length) return falha('Nenhuma ficha válida no arquivo.');
      return { ok: true, fichas: fichas, avisos: avisos, erro: '' };
    } catch (erro) {
      return falha('Não foi possível ler o arquivo.');
    }
  }

  /* ------------------------------------------------------------------------
     Atualização e ouvintes
     ------------------------------------------------------------------------ */

  /** Lê um campo da ficha atual. */
  function obter(caminho) {
    return lerCaminho(api.ficha, caminho);
  }

  /**
   * ÚNICA porta de entrada para mudar a ficha: grava e avisa os ouvintes.
   * opcoes.silencioso = true grava sem avisar; usado pelo ciclo de
   * atualização para corrigir valores sem entrar em laço e para aplicar
   * várias mudanças de uma vez (avisando só no fim).
   */
  function atualizar(caminho, valor, opcoes) {
    if (somenteLeitura) {
      // Ficha vista por link (só visualizar): nada muda. Só as tentativas da pessoa avisam (as correções silenciosas, não).
      if (!(opcoes && opcoes.silencioso)) ouvintesBloqueio.forEach(function (funcao) { funcao(caminho); });
      return;
    }
    escreverCaminho(api.ficha, caminho, valor);
    if (!(opcoes && opcoes.silencioso)) notificar(caminho);
  }

  /** Liga ou desliga o modo "só visualizar" (ficha aberta por um link sem edição). */
  function definirSomenteLeitura(ligado) {
    somenteLeitura = ligado === true;
  }

  /** fn(caminho) quando alguém tenta mudar a ficha no modo "só visualizar". */
  function aoBloquear(funcao) {
    ouvintesBloqueio.push(funcao);
  }

  /** Troca a ficha inteira (abrir, importar, recarregar): avisa com caminho "*". */
  function substituir(novaFicha) {
    api.ficha = completarPadroes(novaFicha);
    notificar('*');
  }

  /** Registra uma função chamada a cada mudança: fn(ficha, caminho). */
  function aoMudar(funcao) {
    ouvintes.push(funcao);
  }

  function notificar(caminho) {
    ouvintes.forEach(function (funcao) {
      funcao(api.ficha, caminho);
    });
  }

  /* ------------------------------------------------------------------------
     Custos: PE, Sanidade e Sanidade permanente
     As funções agem na ficha aberta. Com "fichaAlvo" (usado pelos testes),
     agem só naquele objeto, sem redesenhar nem salvar.
     ------------------------------------------------------------------------ */

  /** Grava um valor na ficha alvo: pela porta de entrada (se for a aberta) ou direto. */
  function gravarEm(ficha, caminho, valor, silencioso) {
    if (ficha === api.ficha) atualizar(caminho, valor, { silencioso: silencioso === true });
    else escreverCaminho(ficha, caminho, valor);
  }

  /**
   * Aplica de UMA vez os custos { pe, san, permanente } (a conta é de
   * OP.calc.projetarCustos). Se faltar PE, nada muda.
   * Devolve { ok, motivo, avisoLimite, gasto, limite, peGastoTurno, peAtual, custo,
   *           san, permanente, sanAtual, perdaPermanente, sanZera }.
   */
  function aplicarCustos(custos, fichaAlvo) {
    const ficha = fichaAlvo || api.ficha;
    const p = OP.calc.projetarCustos(ficha, custos);
    const resultado = {
      ok: p.ok,
      motivo: p.motivo,
      avisoLimite: p.ok && p.avisoLimite,
      gasto: p.ok ? p.pe : 0,
      limite: p.limite,
      peGastoTurno: p.ok ? p.peGastoTurnoDepois : p.peGastoTurno,
      peAtual: p.ok ? p.peDepois : p.peAtual,
      custo: p.pe,
      san: p.ok ? p.san : 0,
      permanente: p.ok ? p.permanente : 0,
      sanAtual: p.ok ? p.sanDepois : p.sanAtual,
      perdaPermanente: p.ok ? p.perdaDepois : p.perdaAntes,
      sanZera: p.ok && p.sanZera
    };
    if (!p.ok || p.mudancas.length === 0) return resultado;

    // Tudo em silêncio e um único aviso no fim: um redesenho e um salvamento.
    p.mudancas.forEach(function (mudanca) {
      gravarEm(ficha, mudanca.caminho, mudanca.valor, true);
    });
    if (ficha === api.ficha) notificar(p.mudancas[0].caminho);
    return resultado;
  }

  /**
   * Gasta n PE do PE atual efetivo (null conta como o máximo).
   * - n ≤ 0: ok, nada muda;
   * - n > PE atual: recusa (ok false, motivo "PE insuficiente") e nada muda;
   * - senão: tira n do PE atual e soma n em conjuracao.peGastoTurno;
   *   avisoLimite = gasto no turno passou do limite de PE por turno (só aviso).
   */
  function gastarPE(n, fichaAlvo) {
    return aplicarCustos({ pe: n }, fichaAlvo);
  }

  /** Começa um turno novo: zera o PE gasto no turno. */
  function novoTurno(fichaAlvo) {
    gravarEm(fichaAlvo || api.ficha, 'conjuracao.peGastoTurno', 0, false);
  }

  /* ------------------------------------------------------------------------
     API pública
     ------------------------------------------------------------------------ */
  const api = {
    ficha: null,
    VERSAO_MODELO: VERSAO_MODELO,
    modeloVazio: modeloVazio,
    criarFichaVazia: modeloVazio, // nome antigo (Etapas 1 a 7)
    completarPadroes: completarPadroes,
    sanitizar: sanitizar,
    lerImportacao: lerImportacao,
    envelopeFicha: envelopeFicha,
    envelopeBackup: envelopeBackup,
    idValido: idValido,
    novoItem: novoItem,
    novaMelhoria: novaMelhoria,
    novoModCategoria: novoModCategoria,
    novoAtaque: novoAtaque,
    novaRd: novaRd,
    novaHabilidade: novaHabilidade,
    sincronizarHabilidadesAutomaticas: sincronizarHabilidadesAutomaticas,
    novoRitual: novoRitual,
    novaCondicao: novaCondicao,
    novaPessoa: novaPessoa,
    novaEntradaDiario: novaEntradaDiario,
    LIMITES: { condicoes: MAX_CONDICOES, diario: MAX_DIARIO, pessoas: MAX_PESSOAS, textoDiario: 20000, textoNotas: 20000, texto: LIMITE_TEXTO },
    definirSomenteLeitura: definirSomenteLeitura,
    somenteLeitura: function () { return somenteLeitura; },
    aoBloquear: aoBloquear,
    aplicarCustos: aplicarCustos,
    gastarPE: gastarPE,
    novoTurno: novoTurno,
    lerCaminho: lerCaminho,
    obter: obter,
    atualizar: atualizar,
    substituir: substituir,
    aoMudar: aoMudar
  };

  OP.state = api;
})(window.OP);
