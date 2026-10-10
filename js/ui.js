/* ==========================================================================
   js/ui.js — interface
   --------------------------------------------------------------------------
   montar()   → roda uma vez: gera selects e cartões a partir de OP.data e
                liga os eventos.
   desenhar() → roda a cada mudança: copia a ficha e os valores calculados
                para a tela. Nunca faz contas (isso é do calc.js).

   Convenções no HTML:
   - data-campo="caminho"  campo editável ligado a OP.state (ex.: "atributos.agi.base")
   - data-tipo="texto|inteiro|decimal|booleano" como converter o valor (booleano = checkbox)
   - data-padrao="valor"   (em campos) escolher este valor grava null ("usar o padrão")
   - data-formato="sinal|dados|metros|numero|limite|teste|critico" (em saídas)
                           "+5" / "3d20 maior" / "10,5 m" / "7,5" / "—" (limite 0) /
                           "2d20 maior +6" / "19/x2"
   - data-alternar="caminho" botão liga/desliga de um valor booleano (aria-pressed)
   - data-filtro="busca|treinadas" controles de filtro da tela (não são salvos)
   - data-ir-pericia="id"  botão que rola até a linha da perícia e a destaca
   - data-acao="adicionar-item", data-remover-item="id", data-alternar-descricao="id"
                           botões do inventário
   - data-aviso-sobrecarga  parágrafo que mostra as penalidades de sobrecarga
   - data-rolar-pericia="id", data-rolar-ataque="id", data-rolar-dano="id"
                           botões que rolam e mostram o resultado no painel de rolagens
   - data-acao="adicionar-ataque", data-remover-ataque="id", data-dano-critico="id"
                           botões e caixa "crítico" dos ataques
   - data-filtro-lista="habilidades-busca|rituais-busca|rituais-elemento", data-aba-fonte="id"
                           filtros das listas de habilidades e rituais (só da tela)
   - data-usar-habilidade, data-conjurar + data-forma, data-rolar-dano-ritual + data-forma,
     data-acao="novo-turno"  gastam PE / rolam dano / zeram o PE gasto no turno
   - data-requer-circulo   select "Requer círculo" de uma forma (sugere o "+PE" da forma)
   - data-tipo="inteiroOpcional" campo numérico em que vazio grava null (automático)
   - data-tipo="opcao"     botão de rádio que grava o número do value
   - data-saida="caminho"  mostra um valor calculado (ex.: "atributos.agi")
   - data-passo="-1|1|-5|5" + data-alvo="idDoCampo"  botões que somam ao campo
   - data-reserva="caminho"   (em campos) valor calculado mostrado quando o estado é null
   - data-max-saida="caminho" (em campos) atributo max vindo de um valor calculado
   - data-largura="caminho"   (em barras) % de preenchimento vindo de um valor calculado
   Caminhos de data-saida, data-reserva, data-max-saida e data-largura são
   lidos do objeto de valores calculados (OP.calc.calcularTudo).

   SEGURANÇA: fichas podem vir de arquivos importados (não confiáveis).
   Dados da ficha só entram na página por textContent, .value ou
   setAttribute. innerHTML só recebe HTML FIXO montado aqui com dados de
   OP.data (ids da ficha entram depois, por setAttribute: ver criarComIds).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  // Elementos usados com frequência, preenchidos em montar().
  const refs = {};

  /* ------------------------------------------------------------------------
     Utilitários
     ------------------------------------------------------------------------ */

  function selecionarTodos(seletor, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(seletor));
  }

  function escaparHtml(texto) {
    const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(texto).replace(/[&<>"']/g, function (c) { return mapa[c]; });
  }

  function plural(quantidade, singular, pluralTexto) {
    return Math.abs(quantidade) === 1 ? singular : pluralTexto;
  }

  /** Aplica min/max (atributos HTML) a um número. */
  function limitar(valor, minimo, maximo) {
    let resultado = valor;
    if (minimo !== null && minimo !== '' && resultado < Number(minimo)) resultado = Number(minimo);
    if (maximo !== null && maximo !== '' && resultado > Number(maximo)) resultado = Number(maximo);
    return resultado;
  }

  /** Troca o texto de um elemento só se mudou. */
  function definirTexto(elemento, texto) {
    if (elemento.textContent !== texto) elemento.textContent = texto;
  }

  /** Cria um elemento com classe e, se houver, texto (sempre por textContent). */
  function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined && texto !== null && texto !== '') elemento.textContent = String(texto);
    return elemento;
  }

  /** Converte HTML FIXO (montado aqui, sem dados da ficha) num elemento. */
  function elementoDeHtml(html) {
    const molde = document.createElement('template');
    molde.innerHTML = html;
    return molde.content.firstElementChild;
  }

  /**
   * Cria um cartão a partir de HTML fixo e grava o id (dado da ficha) por
   * setAttribute em cada atributo listado (na raiz e nos descendentes).
   * No HTML esses atributos vão vazios: data-item, data-remover-item...
   */
  function criarComIds(html, id, atributos) {
    const raiz = elementoDeHtml(html);
    atributos.forEach(function (nome) {
      if (raiz.hasAttribute(nome)) raiz.setAttribute(nome, id);
      selecionarTodos('[' + nome + ']', raiz).forEach(function (elemento) {
        elemento.setAttribute(nome, id);
      });
    });
    return raiz;
  }

  /** Troca todos os filhos de um elemento pelos nós indicados. */
  function substituirFilhos(pai, filhos) {
    const fragmento = document.createDocumentFragment();
    filhos.forEach(function (filho) { fragmento.appendChild(filho); });
    pai.textContent = '';
    pai.appendChild(fragmento);
  }

  // Último conteúdo desenhado em cada lista de textos (evita repetir leitores de tela).
  const textosDesenhados = new WeakMap();

  /** Lista <li> com textos (por textContent); só reescreve se mudou. */
  function desenharListaTextos(lista, textos) {
    const assinatura = textos.join('\n');
    if (textosDesenhados.get(lista) === assinatura) return;
    textosDesenhados.set(lista, assinatura);
    substituirFilhos(lista, textos.map(function (texto) { return criarElemento('li', '', texto); }));
  }

  /** Sigla de um atributo pelo id ("vig" → "VIG"). */
  function siglaAtributo(id) {
    const atributo = OP.data.atributos.find(function (a) { return a.id === id; });
    return atributo ? atributo.sigla : String(id).toUpperCase();
  }

  /** Lista de siglas legível: ["agi","for"] → "AGI e FOR". */
  function siglas(ids) {
    const nomes = ids.map(siglaAtributo);
    if (nomes.length <= 1) return nomes.join('');
    return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  }

  /* ------------------------------------------------------------------------
     Montagem (uma vez)
     ------------------------------------------------------------------------ */

  function preencherSelect(select, opcoes, textoVazio) {
    const partes = [];
    if (textoVazio !== undefined) {
      partes.push('<option value="">' + escaparHtml(textoVazio) + '</option>');
    }
    opcoes.forEach(function (opcao) {
      partes.push('<option value="' + escaparHtml(opcao.valor) + '">' + escaparHtml(opcao.texto) + '</option>');
    });
    select.innerHTML = partes.join('');
  }

  function montarSelects() {
    preencherSelect(
      document.getElementById('campo-classe'),
      OP.calc.classesLista().map(function (c) { return { valor: c.id, texto: c.nome }; }),
      '— Escolha —'
    );
    preencherSelect(
      document.getElementById('campo-nex'),
      OP.data.nex.map(function (n) { return { valor: n, texto: n + '%' }; })
    );
    // Estágios (Sobrevivente): 1 até o maior estagioMax das classes de estágio
    const maximo = OP.calc.classesLista().reduce(function (maior, c) {
      return c.unidadeProgressao === 'estagio' ? Math.max(maior, OP.calc.numero(c.estagioMax)) : maior;
    }, 1);
    const estagios = [];
    for (let e = 1; e <= maximo; e++) estagios.push({ valor: e, texto: 'Estágio ' + e });
    preencherSelect(document.getElementById('campo-estagio'), estagios);
  }

  /**
   * HTML do controle numérico [−][valor][+].
   * opcoes: { id, caminho, descricao, minimo?, teclado? }
   */
  function htmlPasso(opcoes) {
    const id = escaparHtml(opcoes.id);
    const descricao = escaparHtml(opcoes.descricao);
    const minimo = opcoes.minimo !== undefined ? ' min="' + opcoes.minimo + '"' : '';
    const teclado = opcoes.teclado ? ' inputmode="' + opcoes.teclado + '"' : '';

    return '' +
      '<div class="passo">' +
        '<button type="button" class="passo__botao" tabindex="-1" data-passo="-1" data-alvo="' + id + '" aria-label="Diminuir ' + descricao + '">−</button>' +
        '<input id="' + id + '" class="passo__valor" type="number" step="1"' + minimo + teclado +
          ' data-campo="' + escaparHtml(opcoes.caminho) + '" data-tipo="inteiro">' +
        '<button type="button" class="passo__botao" tabindex="-1" data-passo="1" data-alvo="' + id + '" aria-label="Aumentar ' + descricao + '">+</button>' +
      '</div>';
  }

  /** HTML de um campo de atributo (rótulo + controle numérico). */
  function htmlCampoPasso(opcoes) {
    return '' +
      '<div class="atributo__campo atributo__campo--' + opcoes.area + '">' +
        '<label for="' + escaparHtml(opcoes.id) + '">' + escaparHtml(opcoes.rotulo) + '</label>' +
        htmlPasso({
          id: opcoes.id,
          caminho: opcoes.caminho,
          descricao: opcoes.rotulo.toLowerCase() + ' de ' + opcoes.nomeAtributo,
          minimo: opcoes.minimo,
          teclado: opcoes.teclado
        }) +
      '</div>';
  }

  /** HTML do cartão de um atributo (base, bônus e total). */
  function htmlCartaoAtributo(atributo) {
    const id = atributo.id;
    return '' +
      '<article class="atributo" data-atributo="' + escaparHtml(id) + '">' +
        '<div class="atributo__cabecalho">' +
          '<span class="atributo__sigla">' + escaparHtml(atributo.sigla) + '</span>' +
          '<span class="atributo__nome">' + escaparHtml(atributo.nome) + '</span>' +
        '</div>' +
        '<div class="atributo__total" title="Total = base + bônus">' +
          '<output data-saida="atributos.' + escaparHtml(id) + '" aria-label="Total de ' + escaparHtml(atributo.nome) + '">0</output>' +
          '<span class="atributo__total-rotulo" aria-hidden="true">total</span>' +
        '</div>' +
        htmlCampoPasso({
          id: 'atr-' + id + '-base', caminho: 'atributos.' + id + '.base', area: 'base',
          rotulo: 'Base', nomeAtributo: atributo.nome, minimo: OP.data.regrasAtributos.minimo, teclado: 'numeric'
        }) +
        htmlCampoPasso({
          id: 'atr-' + id + '-bonus', caminho: 'atributos.' + id + '.bonus', area: 'bonus',
          rotulo: 'Bônus', nomeAtributo: atributo.nome
        }) +
      '</article>';
  }

  function montarAtributos() {
    document.getElementById('grade-atributos').innerHTML =
      OP.data.atributos.map(htmlCartaoAtributo).join('');
  }

  // Informação extra mostrada no cabeçalho de alguns recursos.
  const INFO_RECURSO = {
    pe: { rotulo: 'Limite por turno', saida: 'nex.limitePE', dica: 'PE que podem ser gastos por turno (NEX ÷ 5)' }
  };

  // Botões de ajuste rápido do valor atual.
  const PASSOS_RECURSO = [-5, -1, 1, 5];

  function htmlBotaoRecurso(passo, idAlvo, nome) {
    const acao = passo < 0 ? 'Diminuir ' : 'Aumentar ';
    const rotulo = (passo < 0 ? '−' : '+') + Math.abs(passo);
    return '<button type="button" class="recurso__botao" data-passo="' + passo + '" data-alvo="' + idAlvo + '"' +
      ' aria-label="' + acao + Math.abs(passo) + ' de ' + nome + '">' + rotulo + '</button>';
  }

  function htmlInfoRecurso(idRecurso) {
    const info = INFO_RECURSO[idRecurso];
    if (!info) return '';
    return '<p class="recurso__info" title="' + escaparHtml(info.dica) + '">' +
      escaparHtml(info.rotulo) + ' <output data-saida="' + escaparHtml(info.saida) + '">0</output></p>';
  }

  /**
   * "Perda permanente: −N" (só a SAN). Vem dos rituais de Medo e reduz o
   * máximo; o campo fica editável para corrigir erros (mínimo 0).
   */
  function htmlPerdaPermanente(recurso) {
    const id = 'rec-' + escaparHtml(recurso.id) + '-perda';
    return '' +
      '<div class="recurso__perda" title="Sanidade perdida para sempre (rituais de Medo). Reduz o máximo.">' +
        '<label for="' + id + '">Perda permanente</label>' +
        '<span class="recurso__perda-valor">' +
          '<span class="recurso__perda-sinal" aria-hidden="true">−</span>' +
          '<input id="' + id + '" class="controle controle--numero" type="number" min="0" step="1" inputmode="numeric"' +
            ' data-campo="recursos.' + escaparHtml(recurso.id) + '.perdaPermanente" data-tipo="inteiro">' +
        '</span>' +
      '</div>';
  }

  /** HTML do cartão de um recurso (PV, PE ou SAN). */
  function htmlCartaoRecurso(recurso) {
    const id = escaparHtml(recurso.id);
    const nome = escaparHtml(recurso.nome);
    const idAtual = 'rec-' + id + '-atual';
    const idBonus = 'rec-' + id + '-bonus';

    return '' +
      '<article class="recurso recurso--' + id + '" data-recurso="' + id + '">' +
        '<div class="recurso__cabecalho">' +
          '<div class="recurso__titulo">' +
            '<span class="recurso__sigla">' + escaparHtml(recurso.sigla) + '</span>' +
            '<span class="recurso__nome">' + nome + '</span>' +
          '</div>' +
          htmlInfoRecurso(recurso.id) +
        '</div>' +

        // Desativado enquanto não houver classe (o máximo é desconhecido).
        '<fieldset class="recurso__controles" data-controles-recurso>' +
          '<legend class="visualmente-oculto">' + nome + ' atuais</legend>' +
          '<div class="recurso__valores">' +
            '<label class="visualmente-oculto" for="' + idAtual + '">' + nome + ' atuais</label>' +
            '<input id="' + idAtual + '" class="recurso__atual" type="number" step="1" min="0" inputmode="numeric" placeholder="—"' +
              ' data-campo="recursos.' + id + '.atual" data-tipo="inteiro"' +
              ' data-reserva="recursos.' + id + '.atual" data-max-saida="recursos.' + id + '.max">' +
            '<span class="recurso__separador" aria-hidden="true">/</span>' +
            '<output class="recurso__max" data-saida="recursos.' + id + '.max" aria-label="Máximo de ' + nome + '">—</output>' +
          '</div>' +
          '<div class="barra" aria-hidden="true">' +
            '<div class="barra__preenchimento" data-largura="recursos.' + id + '.percentual"></div>' +
          '</div>' +
          '<div class="recurso__botoes">' +
            PASSOS_RECURSO.map(function (passo) { return htmlBotaoRecurso(passo, idAtual, nome); }).join('') +
          '</div>' +
        '</fieldset>' +

        '<div class="recurso__rodape">' +
          '<div class="recurso__bonus">' +
            '<label for="' + idBonus + '">Bônus de máximo</label>' +
            htmlPasso({ id: idBonus, caminho: 'recursos.' + recurso.id + '.bonusMax', descricao: 'bônus de máximo de ' + recurso.nome }) +
          '</div>' +
          (recurso.id === 'san' ? htmlPerdaPermanente(recurso) : '') +
          '<p class="recurso__composicao">' +
            '<span class="recurso__resumo" data-composicao-resumo></span>' +
            '<span class="recurso__detalhe" data-composicao-detalhe></span>' +
          '</p>' +
        '</div>' +
      '</article>';
  }

  function montarRecursos() {
    const grade = document.getElementById('grade-recursos');
    grade.innerHTML = OP.data.recursos.map(htmlCartaoRecurso).join('');

    // Guarda os elementos que mudam a cada desenho, por id de recurso.
    refs.recursos = {};
    selecionarTodos('[data-recurso]', grade).forEach(function (cartao) {
      refs.recursos[cartao.dataset.recurso] = {
        cartao: cartao,
        controles: cartao.querySelector('[data-controles-recurso]'),
        resumo: cartao.querySelector('[data-composicao-resumo]'),
        detalhe: cartao.querySelector('[data-composicao-detalhe]')
      };
    });
  }

  /* ---------- Ícone de dado (botões de rolar) ---------- */

  const ICONE_DADO = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M8 1.5 14 5v6l-6 3.5L2 11V5z"/><path d="M8 1.5 4.5 7h7z"/><path d="M2 5l2.5 2M14 5l-2.5 2M4.5 7 8 14.5 11.5 7"/></svg>';

  /** Botão pequeno de rolar uma perícia. */
  function htmlBotaoRolarPericia(idPericia, nome, classeExtra) {
    const rotulo = 'Rolar ' + nome;
    return '<button type="button" class="botao-icone botao-icone--rolar' + (classeExtra ? ' ' + classeExtra : '') + '"' +
      ' data-rolar-pericia="' + escaparHtml(idPericia) + '" title="' + escaparHtml(rotulo) + '" aria-label="' + escaparHtml(rotulo) + '">' +
      ICONE_DADO + '</button>';
  }

  /* ---------- Perícias ---------- */

  // Ícones (SVG de traço, na cor do texto). A explicação vai no title e na legenda.
  const ICONES = {
    treinada: {
      titulo: 'Somente treinada: sem treinamento, a perícia não pode ser usada',
      legenda: 'somente treinada',
      svg: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<path d="M1.5 6 8 3l6.5 3L8 9z"/><path d="M4.5 7.6v3.1c0 .9 1.6 1.8 3.5 1.8s3.5-.9 3.5-1.8V7.6"/><path d="M14.5 6v4"/></svg>'
    },
    carga: {
      titulo: 'Penalidade de carga: sofre penalidade quando o agente carrega peso demais',
      legenda: 'penalidade de carga',
      svg: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<path d="M5.5 5.5a2.5 2.5 0 0 1 5 0"/><path d="M3.8 5.5h8.4l1.6 8H2.2z"/></svg>'
    },
    // TODO: efeito do kit, depende da regra do livro (por enquanto só o indicador).
    kit: {
      titulo: 'Esta perícia usa um kit; veja a regra no livro',
      legenda: 'usa kit (cheio = kit no inventário)',
      svg: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<path d="M2 5.5h12v8H2z"/><path d="M6 5.5V3.5h4v2"/><path d="M2 9h12"/><path d="M8 8v2"/></svg>'
    }
  };

  // Filtros da tabela: estado só da tela, não vai para a ficha.
  const filtros = { busca: '', soTreinadas: false };

  function htmlIcone(tipo) {
    const icone = ICONES[tipo];
    return '<span class="icone icone--' + tipo + '" role="img" title="' + escaparHtml(icone.titulo) + '"' +
      ' aria-label="' + escaparHtml(icone.titulo) + '">' + icone.svg + '</span>';
  }

  function htmlLegendaPericias() {
    return Object.keys(ICONES).map(function (tipo) {
      return '<span class="legenda__item">' + htmlIcone(tipo) + escaparHtml(ICONES[tipo].legenda) + '</span>';
    }).join('');
  }

  function htmlOpcoesAtributo() {
    return OP.data.atributos.map(function (a) {
      return '<option value="' + escaparHtml(a.id) + '">' + escaparHtml(a.sigla) + '</option>';
    }).join('');
  }

  function htmlOpcoesGrau() {
    return OP.data.grausTreinamento.map(function (grau, indice) {
      return '<option value="' + indice + '">' + escaparHtml(grau.nome) + '</option>';
    }).join('');
  }

  /** HTML de uma linha da tabela de perícias. */
  function htmlLinhaPericia(pericia) {
    const id = escaparHtml(pericia.id);
    const nome = escaparHtml(pericia.nome);
    const caminho = 'pericias.' + id;
    const indicadores = (pericia.somenteTreinada ? htmlIcone('treinada') : '') +
      (pericia.penalidadeCarga ? htmlIcone('carga') : '') +
      (pericia.kit ? htmlIcone('kit') : '');
    const especialidade = pericia.aberta
      ? '<input type="text" class="controle pericia__especialidade" placeholder="especialidade" autocomplete="off"' +
        ' aria-label="Especialidade de ' + nome + '" data-campo="' + caminho + '.nomeAberto" data-tipo="texto">'
      : '';

    return '' +
      '<tr class="pericia" data-pericia="' + id + '">' +
        '<td class="pericia__indicadores">' + indicadores + '</td>' +
        '<th scope="row" class="pericia__nome">' +
          '<div class="pericia__nome-conteudo">' +
            '<span class="pericia__rotulo">' + nome + '</span>' + especialidade +
            // "origem" / "classe": perícia concedida automaticamente (não gasta pontos)
            '<span class="pericia__fonte" hidden></span>' +
            '<span class="pericia__requer" hidden>requer treinamento</span>' +
            (pericia.penalidadeCarga ? '<span class="pericia__carga" hidden></span>' : '') +
          '</div>' +
        '</th>' +
        '<td class="pericia__atributo" data-rotulo="Atributo">' +
          '<select class="controle" aria-label="Atributo de ' + nome + '"' +
            ' data-campo="' + caminho + '.atributo" data-tipo="texto"' +
            ' data-padrao="' + escaparHtml(pericia.atributoPadrao) + '" data-reserva="' + caminho + '.atributo">' +
            htmlOpcoesAtributo() +
          '</select>' +
        '</td>' +
        '<td class="pericia__dados"><output data-saida="' + caminho + '.dados" data-formato="dados"></output></td>' +
        '<td class="pericia__grau" data-rotulo="Grau">' +
          '<select class="controle" aria-label="Grau de treinamento em ' + nome + '"' +
            ' data-campo="' + caminho + '.grau" data-tipo="inteiro">' + htmlOpcoesGrau() + '</select>' +
        '</td>' +
        '<td class="pericia__outros" data-rotulo="Outros">' +
          '<input type="number" step="1" class="controle controle--numero" aria-label="Outros bônus de ' + nome + '"' +
            ' data-campo="' + caminho + '.outros" data-tipo="inteiro">' +
        '</td>' +
        '<td class="pericia__bonus">' +
          '<output data-saida="' + caminho + '.bonus" data-formato="sinal" aria-label="Bônus de ' + nome + '"></output>' +
        '</td>' +
        '<td class="pericia__rolar">' + htmlBotaoRolarPericia(pericia.id, pericia.nome) + '</td>' +
        '<td class="pericia__concedida">' +
          '<label class="caixa caixa--pequena" title="Concedida: não gasta pontos de treinamento">' +
            '<input type="checkbox" aria-label="' + nome + ' concedida (não gasta pontos)"' +
              ' data-campo="' + caminho + '.concedida" data-tipo="booleano">' +
            '<span class="so-celular" aria-hidden="true">Concedida</span>' +
          '</label>' +
        '</td>' +
      '</tr>';
  }

  function montarPericias() {
    const corpo = document.getElementById('corpo-pericias');
    corpo.innerHTML = OP.data.pericias.map(htmlLinhaPericia).join('');
    document.getElementById('legenda-pericias').innerHTML = htmlLegendaPericias();

    // Guarda os elementos que mudam a cada desenho, por id de perícia.
    refs.pericias = {};
    selecionarTodos('[data-pericia]', corpo).forEach(function (linha) {
      refs.pericias[linha.dataset.pericia] = {
        linha: linha,
        requer: linha.querySelector('.pericia__requer'),
        fonte: linha.querySelector('.pericia__fonte'),
        atributo: linha.querySelector('.pericia__atributo select'),
        opcaoDestreinado: linha.querySelector('.pericia__grau option[value="0"]'),
        especialidade: linha.querySelector('.pericia__especialidade'), // só nas perícias abertas
        carga: linha.querySelector('.pericia__carga'),   // só nas perícias com carga
        kit: linha.querySelector('.icone--kit')           // só nas perícias com kit
      };
    });
  }

  /* ---------- Defesa e derivados ---------- */

  function nomePericia(idPericia) {
    const pericia = OP.data.pericias.find(function (p) { return p.id === idPericia; });
    return pericia ? pericia.nome : idPericia;
  }

  /** HTML de um cartão de reação (Bloqueio, Esquiva, Contra-ataque). */
  function htmlReacao(reacao) {
    const pericia = escaparHtml(nomePericia(reacao.pericia));
    return '' +
      '<article class="reacao" data-reacao="' + escaparHtml(reacao.id) + '">' +
        '<span class="reacao__nome">' + escaparHtml(reacao.nome) + '</span>' +
        '<p class="reacao__valor" data-reacao-valor></p>' +
        '<p class="reacao__detalhe" data-reacao-detalhe></p>' +
        '<p class="reacao__dica" data-reacao-dica hidden>requer treinamento em ' +
          '<button type="button" class="link" data-ir-pericia="' + escaparHtml(reacao.pericia) + '">' + pericia + '</button>' +
        '</p>' +
      '</article>';
  }

  /** HTML de um "teste rápido" (Iniciativa, Fortitude...). Clicar leva à perícia. */
  function htmlTeste(idPericia) {
    const id = escaparHtml(idPericia);
    const nome = escaparHtml(nomePericia(idPericia));
    return '' +
      '<div class="teste" data-teste="' + id + '">' +
        '<button type="button" class="teste__ir" data-ir-pericia="' + id + '" title="Ver ' + nome + ' na tabela de perícias">' +
          '<span class="teste__nome">' + nome + '</span>' +
          '<output class="teste__bonus" data-saida="testes.' + id + '.bonus" data-formato="sinal">+0</output>' +
          '<output class="teste__dados" data-saida="testes.' + id + '.dados" data-formato="dados">1d20 maior</output>' +
        '</button>' +
        htmlBotaoRolarPericia(idPericia, nomePericia(idPericia), 'teste__rolar') +
      '</div>';
  }

  /** Campos de resistência, agrupados como em OP.data.gruposDano. */
  function htmlResistencias() {
    return OP.data.gruposDano.map(function (grupo) {
      const campos = OP.data.tiposDano.filter(function (tipo) { return tipo.grupo === grupo.id; }).map(function (tipo) {
        const id = 'res-' + escaparHtml(tipo.id);
        return '<label class="resistencia" for="' + id + '">' +
          '<span>' + escaparHtml(tipo.nome) + '</span>' +
          '<input id="' + id + '" class="controle controle--numero" type="number" min="0" step="1" inputmode="numeric"' +
            ' data-campo="defesa.resistencias.' + escaparHtml(tipo.id) + '" data-tipo="inteiro">' +
        '</label>';
      }).join('');
      return '<fieldset class="resistencias__grupo"><legend>' + escaparHtml(grupo.nome) + '</legend>' + campos + '</fieldset>';
    }).join('');
  }

  function montarDefesa() {
    const gradeReacoes = document.getElementById('grade-reacoes');
    const gradeTestes = document.getElementById('grade-testes');
    gradeReacoes.innerHTML = OP.data.reacoes.map(htmlReacao).join('');
    gradeTestes.innerHTML = OP.data.periciasDerivadas.map(htmlTeste).join('');
    document.getElementById('grade-resistencias').innerHTML = htmlResistencias();

    refs.reacoes = {};
    selecionarTodos('[data-reacao]', gradeReacoes).forEach(function (cartao) {
      refs.reacoes[cartao.dataset.reacao] = {
        cartao: cartao,
        valor: cartao.querySelector('[data-reacao-valor]'),
        detalhe: cartao.querySelector('[data-reacao-detalhe]'),
        dica: cartao.querySelector('[data-reacao-dica]')
      };
    });
    refs.testes = selecionarTodos('[data-teste]', gradeTestes);
  }

  /* ---------- Inventário ---------- */

  // Ícones dos botões de cada item
  const ICONES_ITEM = {
    descricao: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 4h10M3 8h10M3 12h6"/></svg>',
    remover: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="M2.5 4.5h11"/><path d="M6.5 4.5V3h3v1.5"/><path d="M4 4.5l.8 9h6.4l.8-9"/></svg>'
  };

  function dadosPatente(idPatente) {
    return OP.data.patentes.find(function (p) { return p.id === idPatente; }) || OP.data.patentes[0];
  }

  function nomeCredito(idNivel) {
    const nivel = OP.data.niveisCredito.find(function (n) { return n.id === idNivel; });
    return nivel ? nivel.nome : idNivel;
  }

  function htmlLimite(categoria) {
    const chave = escaparHtml(categoria.chave);
    return '' +
      '<div class="limite" data-limite="' + chave + '">' +
        '<span class="limite__rotulo">Limite ' + escaparHtml(categoria.rotulo) + '</span>' +
        '<span class="limite__valor">' +
          '<output data-saida="inventario.limitesPorCategoria.' + chave + '.usados">0</output>/' +
          '<output data-saida="inventario.limitesPorCategoria.' + chave + '.limite" data-formato="limite">0</output>' +
        '</span>' +
      '</div>';
  }

  function htmlOpcoesTipoItem() {
    return OP.data.tiposItem.map(function (tipo) {
      return '<option value="' + escaparHtml(tipo.id) + '">' + escaparHtml(tipo.nome) + '</option>';
    }).join('');
  }

  function htmlOpcoesCategoria() {
    return OP.data.categoriasItem.map(function (categoria) {
      return '<option value="' + categoria.valor + '">' + escaparHtml(categoria.rotulo) + '</option>';
    }).join('');
  }

  /** Só as perícias que usam kit (OP.data.pericias[].kit). */
  function htmlOpcoesKit() {
    return '<option value="">Perícia do kit…</option>' +
      OP.data.pericias.filter(function (p) { return p.kit; }).map(function (p) {
        return '<option value="' + escaparHtml(p.id) + '">' + escaparHtml(p.nome) + '</option>';
      }).join('');
  }

  // Atributos que recebem o id do item (por setAttribute, em criarComIds).
  const IDS_ITEM = ['data-item', 'data-alternar-descricao', 'data-remover-item'];

  /**
   * HTML FIXO de um item (o id entra depois, por criarComIds). Os campos de
   * proteção e de kit existem em todos os itens, mas o CSS só mostra os que
   * valem para o tipo (data-tipo-item).
   */
  function htmlItem(indice) {
    const caminho = 'inventario.itens.' + indice;
    const idDescricao = 'item-desc-' + indice;
    return '' +
      '<div class="item" role="listitem" data-item>' +
        '<div class="item__nome">' +
          '<input type="text" class="controle" placeholder="Nome do item" autocomplete="off" aria-label="Nome do item"' +
            ' data-campo="' + caminho + '.nome" data-tipo="texto">' +
        '</div>' +
        '<div class="item__tipo" data-rotulo="Tipo">' +
          '<select class="controle" aria-label="Tipo do item" data-campo="' + caminho + '.tipo" data-tipo="texto">' +
            htmlOpcoesTipoItem() + '</select>' +
        '</div>' +
        '<div class="item__categoria" data-rotulo="Categoria">' +
          '<select class="controle" aria-label="Categoria do item" data-campo="' + caminho + '.categoria" data-tipo="inteiro">' +
            htmlOpcoesCategoria() + '</select>' +
        '</div>' +
        '<div class="item__espacos" data-rotulo="Espaços">' +
          '<input type="number" min="0" step="any" class="controle controle--numero" aria-label="Espaços por unidade"' +
            ' data-campo="' + caminho + '.espacos" data-tipo="decimal">' +
        '</div>' +
        '<div class="item__quantidade" data-rotulo="Qtd.">' +
          '<input type="number" min="0" step="1" inputmode="numeric" class="controle controle--numero" aria-label="Quantidade"' +
            ' data-campo="' + caminho + '.quantidade" data-tipo="inteiro">' +
        '</div>' +
        '<div class="item__detalhes">' +
          '<div class="item__det item__det--protecao">' +
            '<label class="caixa"><input type="checkbox" data-campo="' + caminho + '.equipada" data-tipo="booleano">' +
              '<span>Equipada</span></label>' +
            '<label class="item__mini"><span>Defesa</span>' +
              '<input type="number" step="1" class="controle controle--numero" data-campo="' + caminho + '.defesa" data-tipo="inteiro"></label>' +
            '<label class="item__mini"><span>Penalidade</span>' +
              '<input type="number" min="0" step="1" class="controle controle--numero" data-campo="' + caminho + '.penalidade" data-tipo="inteiro"></label>' +
          '</div>' +
          '<div class="item__det item__det--kit">' +
            '<select class="controle" aria-label="Perícia do kit" data-campo="' + caminho + '.periciaKit" data-tipo="texto" data-padrao="">' +
              htmlOpcoesKit() + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="item__acoes">' +
          '<button type="button" class="botao-icone" data-alternar-descricao aria-expanded="false"' +
            ' aria-controls="' + idDescricao + '" title="Descrição">' + ICONES_ITEM.descricao +
            '<span class="visualmente-oculto">Descrição</span></button>' +
          '<button type="button" class="botao-icone botao-icone--perigo" data-remover-item title="Remover item">' +
            ICONES_ITEM.remover + '<span class="visualmente-oculto">Remover item</span></button>' +
        '</div>' +
        '<div class="item__descricao" id="' + idDescricao + '" hidden>' +
          '<textarea class="controle" rows="3" placeholder="Descrição e anotações do item" aria-label="Descrição do item"' +
            ' data-campo="' + caminho + '.descricao" data-tipo="texto"></textarea>' +
        '</div>' +
      '</div>';
  }

  function montarInventario() {
    preencherSelect(
      document.getElementById('inv-patente'),
      OP.data.patentes.map(function (p) { return { valor: p.id, texto: p.nome }; })
    );
    // Opção vazia = "Padrão da patente" (o texto com o nível é atualizado ao desenhar)
    preencherSelect(
      document.getElementById('inv-credito'),
      OP.data.niveisCredito.map(function (n) { return { valor: n.id, texto: n.nome }; }),
      'Padrão da patente'
    );
    refs.opcaoCreditoPadrao = document.querySelector('#inv-credito option[value=""]');

    const gradeLimites = document.getElementById('limites-itens');
    gradeLimites.innerHTML = OP.data.categoriasItem
      .filter(function (categoria) { return categoria.chave !== null; })
      .map(htmlLimite).join('');
    refs.limites = {};
    selecionarTodos('[data-limite]', gradeLimites).forEach(function (elemento) {
      refs.limites[elemento.dataset.limite] = elemento;
    });

    refs.dicaPatente = document.getElementById('dica-patente');
    refs.avisosLimites = document.getElementById('avisos-limites');
    refs.listaAvisosLimites = document.getElementById('lista-avisos-limites');
    refs.painelCarga = document.getElementById('painel-carga');
    refs.composicaoCarga = document.getElementById('composicao-carga');
    refs.avisosSobrecarga = selecionarTodos('[data-aviso-sobrecarga]');
    refs.listaItens = document.getElementById('lista-itens');
    refs.itensVazio = document.getElementById('itens-vazio');
    refs.itensRenderizados = null;                // ids desenhados por último ("a|b|c")
    refs.elementosItens = Object.create(null);    // id → elementos da linha
    refs.descricoesAbertas = Object.create(null); // id → true (estado só da tela)
  }

  /* ---------- Ataques ---------- */

  function htmlOpcoesPericiaAtaque() {
    return OP.data.periciasAtaque.map(function (p) {
      return '<option value="' + escaparHtml(p.id) + '">' + escaparHtml(p.rotulo) + '</option>';
    }).join('');
  }

  function htmlOpcoesTipoDano() {
    return '<option value="">—</option>' + OP.data.tiposDano.map(function (t) {
      return '<option value="' + escaparHtml(t.id) + '">' + escaparHtml(t.nome) + '</option>';
    }).join('');
  }

  /** Campo de ataque com rótulo em cima (o <label> envolve o controle). */
  function htmlCampoAtaque(classe, rotulo, controle) {
    return '<label class="ataque__campo ataque__campo--' + classe + '">' +
      '<span class="ataque__rotulo">' + escaparHtml(rotulo) + '</span>' + controle + '</label>';
  }

  // Atributos que recebem o id do ataque (por setAttribute, em criarComIds).
  const IDS_ATAQUE = ['data-ataque', 'data-rolar-ataque', 'data-dano-critico', 'data-rolar-dano', 'data-remover-ataque'];

  /** HTML FIXO de um ataque (cartão com 4 linhas: teste, dano, detalhes, notas). */
  function htmlAtaque(indice) {
    const c = 'ataques.' + indice;
    return '' +
      '<div class="ataque" role="listitem" data-ataque>' +
        // Linha 1: identificação e teste
        '<div class="ataque__linha">' +
          htmlCampoAtaque('nome', 'Nome',
            '<input type="text" class="controle ataque__nome" placeholder="Ex.: Faca" autocomplete="off" data-campo="' + c + '.nome" data-tipo="texto">') +
          htmlCampoAtaque('pericia', 'Perícia',
            '<select class="controle" data-campo="' + c + '.pericia" data-tipo="texto">' + htmlOpcoesPericiaAtaque() + '</select>') +
          '<div class="ataque__campo ataque__campo--teste"><span class="ataque__rotulo">Teste</span>' +
            '<output class="ataque__teste" data-saida="ataques.' + indice + '.teste" data-formato="teste"></output></div>' +
          htmlCampoAtaque('outros', 'Outros',
            '<input type="number" step="1" class="controle controle--numero" data-campo="' + c + '.testeBonus" data-tipo="inteiro">') +
          '<div class="ataque__acoes">' +
            '<button type="button" class="botao-rolagem" data-rolar-ataque>' + ICONE_DADO + '<span>Rolar ataque</span></button>' +
          '</div>' +
        '</div>' +

        // Linha 2: dano e crítico
        '<div class="ataque__linha">' +
          htmlCampoAtaque('dano', 'Dano',
            '<input type="text" class="controle ataque__formula" spellcheck="false" autocomplete="off" placeholder="1d6"' +
              ' data-campo="' + c + '.dano" data-tipo="texto">' +
            '<span class="ataque__erro" data-erro-dano hidden></span>') +
          htmlCampoAtaque('dano-bonus', 'Bônus de dano',
            '<input type="number" step="1" class="controle controle--numero" data-campo="' + c + '.danoBonus" data-tipo="inteiro">') +
          '<div class="ataque__campo ataque__campo--critico">' +
            '<span class="ataque__rotulo">Crítico <output class="ataque__crit-rotulo" data-saida="ataques.' + indice + '.critico" data-formato="critico"></output></span>' +
            '<div class="ataque__critico">' +
              '<input type="number" min="2" max="20" step="1" class="controle controle--numero" aria-label="Margem de crítico"' +
                ' data-campo="' + c + '.critMargem" data-tipo="inteiro">' +
              '<span aria-hidden="true">/x</span>' +
              '<input type="number" min="2" max="10" step="1" class="controle controle--numero" aria-label="Multiplicador de crítico"' +
                ' data-campo="' + c + '.critMult" data-tipo="inteiro">' +
            '</div>' +
          '</div>' +
          htmlCampoAtaque('tipo-dano', 'Tipo de dano',
            '<select class="controle" data-campo="' + c + '.tipoDano" data-tipo="texto">' + htmlOpcoesTipoDano() + '</select>') +
          '<div class="ataque__acoes">' +
            '<label class="caixa" title="Multiplica os dados de dano pelo multiplicador de crítico">' +
              '<input type="checkbox" data-dano-critico><span>Crítico</span></label>' +
            '<button type="button" class="botao-rolagem botao-rolagem--dano" data-rolar-dano>' + ICONE_DADO + '<span>Rolar dano</span></button>' +
          '</div>' +
        '</div>' +

        // Linha 3: alcance, propriedades, munição e arma do inventário
        '<div class="ataque__linha">' +
          htmlCampoAtaque('alcance', 'Alcance',
            '<input type="text" class="controle" placeholder="Ex.: curto" autocomplete="off" data-campo="' + c + '.alcance" data-tipo="texto">') +
          htmlCampoAtaque('propriedades', 'Propriedades',
            '<input type="text" class="controle" autocomplete="off" data-campo="' + c + '.propriedades" data-tipo="texto">') +
          '<div class="ataque__campo ataque__campo--municao"><span class="ataque__rotulo">Munição</span>' +
            '<div class="ataque__municao">' +
              '<label class="caixa"><input type="checkbox" data-campo="' + c + '.usaMunicao" data-tipo="booleano"><span>usa</span></label>' +
              '<div class="ataque__contador">' +
                htmlPasso({ id: 'atq-' + indice + '-municao', caminho: c + '.municao', descricao: 'munição', minimo: 0, teclado: 'numeric' }) +
              '</div>' +
            '</div>' +
          '</div>' +
          htmlCampoAtaque('arma', 'Arma do inventário',
            '<select class="controle" data-campo="' + c + '.itemId" data-tipo="texto" data-padrao="" data-arma-inventario>' +
              '<option value="">Nenhuma</option></select>') +
        '</div>' +

        // Linha 4: notas e remover
        '<div class="ataque__linha ataque__linha--fim">' +
          htmlCampoAtaque('notas', 'Notas',
            '<input type="text" class="controle" autocomplete="off" data-campo="' + c + '.notas" data-tipo="texto">') +
          '<button type="button" class="botao-icone botao-icone--perigo" data-remover-ataque title="Remover ataque">' +
            ICONES_ITEM.remover + '<span class="visualmente-oculto">Remover ataque</span></button>' +
        '</div>' +
      '</div>';
  }

  function montarAtaques() {
    refs.listaAtaques = document.getElementById('lista-ataques');
    refs.ataquesVazio = document.getElementById('ataques-vazio');
    refs.ataquesRenderizados = null;              // ids desenhados por último
    refs.elementosAtaques = Object.create(null);  // id → elementos do cartão
    refs.armasRenderizadas = null;                // opções do select "Arma do inventário"
    refs.danoCritico = Object.create(null);       // id → o próximo dano é crítico (estado só da tela)
  }

  /** Resumo da regra de criação, montado a partir dos números de OP.data. */
  function textoRegras(r) {
    const reduzir = r.maxAtributosReduzidos === 1 ? 'um atributo' : 'até ' + r.maxAtributosReduzidos + ' atributos';
    return 'Criação: todos começam em ' + r.baseInicial + '. Distribua ' + r.pontosParaDistribuir +
      ' pontos, com máximo ' + r.maximoInicial + ' por atributo. Reduzir ' + reduzir + ' a ' + r.minimo +
      ' dá 1 ponto extra. Cada aumento de atributo do NEX soma 1 ponto (até ' + r.maximoComAumentos +
      ' por atributo; 3 no Sobrevivente). O bônus não gasta pontos.';
  }

  /* ------------------------------------------------------------------------
     Leitura e escrita de campos
     ------------------------------------------------------------------------ */

  /**
   * Converte o conteúdo de um campo para o valor do estado.
   * Devolve undefined quando a entrada está incompleta (ex.: vazio ou só "-").
   */
  function lerCampo(campo) {
    if (campo.dataset.tipo === 'booleano') return campo.checked;
    if (campo.dataset.tipo === 'decimal') {
      if (campo.value.trim() === '') return undefined;
      const decimal = Number(campo.value.replace(',', '.'));
      if (!Number.isFinite(decimal)) return undefined;
      // duas casas bastam (ex.: 1,5 m) e evitam sobras como 0,30000000000000004
      return limitar(Math.round(decimal * 100) / 100, campo.getAttribute('min'), campo.getAttribute('max'));
    }
    if (campo.dataset.tipo === 'inteiro' || campo.dataset.tipo === 'inteiroOpcional') {
      // inteiroOpcional: campo vazio grava null ("automático", ex.: custo base do ritual)
      if (campo.value.trim() === '') return campo.dataset.tipo === 'inteiroOpcional' ? null : undefined;
      const valor = Math.trunc(Number(campo.value));
      if (!Number.isFinite(valor)) return undefined;
      return limitar(valor, campo.getAttribute('min'), campo.getAttribute('max'));
    }
    // opcao: botão de rádio que grava o número do value quando marcado
    if (campo.dataset.tipo === 'opcao') {
      return campo.checked ? Math.trunc(Number(campo.value)) : undefined;
    }
    // Escolher o valor padrão grava null ("usar o padrão").
    if (campo.dataset.padrao !== undefined && campo.value === campo.dataset.padrao) return null;
    return campo.value;
  }

  /**
   * Valor que o campo deve mostrar: o do estado ou, se for null e o campo
   * tiver data-reserva, o valor calculado (ex.: PV atual null → PV máximo).
   */
  function valorExibido(campo) {
    const valor = OP.state.obter(campo.dataset.campo);
    const vazio = valor === null || valor === undefined;
    if (vazio && campo.dataset.reserva && refs.derivados) {
      return OP.state.lerCaminho(refs.derivados, campo.dataset.reserva);
    }
    return valor;
  }

  /**
   * Copia o valor do estado para o campo.
   * Se o usuário está digitando nele e o texto já corresponde ao estado,
   * não mexe (evita pular o cursor ou apagar um campo que ele limpou).
   */
  function escreverCampo(campo, forcar) {
    const valor = valorExibido(campo);
    if (campo.dataset.tipo === 'booleano') {
      const marcado = valor === true;
      if (campo.checked !== marcado) campo.checked = marcado;
      return;
    }
    if (campo.dataset.tipo === 'opcao') {
      const marcada = valor !== null && valor !== undefined && String(valor) === campo.value;
      if (campo.checked !== marcada) campo.checked = marcada;
      return;
    }
    const texto = valor === null || valor === undefined ? '' : String(valor);
    const emEdicao = campo === document.activeElement && lerCampo(campo) === valor;
    if (emEdicao && !forcar) return;
    if (campo.value !== texto) campo.value = texto;
  }

  /** Envia o valor de um campo para o estado (se for válido e diferente). */
  function enviarCampo(campo) {
    const valor = lerCampo(campo);
    if (valor === undefined) return;
    if (valor === OP.state.obter(campo.dataset.campo)) return;
    OP.state.atualizar(campo.dataset.campo, valor);
  }

  /* ------------------------------------------------------------------------
     Eventos (delegados na raiz da ficha)
     ------------------------------------------------------------------------ */

  /** Atualiza um filtro da tabela (busca ou "só treinadas") e reaplica. */
  function atualizarFiltro(controle) {
    if (controle.dataset.filtro === 'busca') filtros.busca = controle.value;
    if (controle.dataset.filtro === 'treinadas') filtros.soTreinadas = controle.checked;
    if (refs.derivados) aplicarFiltros(refs.derivados);
  }

  /** Caixa "Crítico" do dano de um ataque (estado só da tela, não vai para a ficha). */
  function atualizarMarcaCritico(caixa) {
    refs.danoCritico[caixa.dataset.danoCritico] = caixa.checked;
  }

  /** Ao ligar um ataque a uma arma do inventário, usa o nome do item se o ataque não tiver nome. */
  function preencherNomeComArma(campo) {
    const indice = Number(campo.dataset.campo.split('.')[1]);
    const ataque = OP.state.ficha.ataques[indice];
    if (!ataque || !ataque.itemId || String(ataque.nome || '').trim() !== '') return;
    const item = OP.state.ficha.inventario.itens.find(function (i) { return i.id === ataque.itemId; });
    if (item && String(item.nome || '').trim() !== '') OP.state.atualizar('ataques.' + indice + '.nome', item.nome);
  }

  function aoDigitar(evento) {
    const filtro = evento.target.closest('[data-filtro]');
    if (filtro) {
      atualizarFiltro(filtro);
      return;
    }
    const filtroLista = evento.target.closest('[data-filtro-lista]');
    if (filtroLista) {
      atualizarFiltroLista(filtroLista);
      return;
    }
    const marcaCritico = evento.target.closest('[data-dano-critico]');
    if (marcaCritico) {
      atualizarMarcaCritico(marcaCritico);
      return;
    }
    const campo = evento.target.closest('[data-campo]');
    if (!campo) return;
    if (campo.hasAttribute('data-requer-circulo')) {
      enviarRequerCirculo(campo);
      return;
    }
    enviarCampo(campo);
  }

  function aoConfirmar(evento) {
    const filtro = evento.target.closest('[data-filtro]');
    if (filtro) {
      atualizarFiltro(filtro);
      return;
    }
    const filtroLista = evento.target.closest('[data-filtro-lista]');
    if (filtroLista) {
      atualizarFiltroLista(filtroLista);
      return;
    }
    const marcaCritico = evento.target.closest('[data-dano-critico]');
    if (marcaCritico) {
      atualizarMarcaCritico(marcaCritico);
      return;
    }
    const campo = evento.target.closest('[data-campo]');
    if (!campo) return;
    if (campo.hasAttribute('data-requer-circulo')) {
      enviarRequerCirculo(campo);
      return;
    }
    enviarCampo(campo);
    escreverCampo(campo, true); // normaliza: campo numérico vazio volta ao valor salvo
    if (campo.hasAttribute('data-arma-inventario')) preencherNomeComArma(campo);
  }

  function aplicarPasso(botao) {
    const campo = document.getElementById(botao.dataset.alvo);
    if (!campo || campo.disabled) return;
    const caminho = campo.dataset.campo;
    const atual = OP.calc.numero(valorExibido(campo));
    const soma = Math.round((atual + Number(botao.dataset.passo)) * 100) / 100; // passos como 1,5
    const novo = limitar(soma, campo.getAttribute('min'), campo.getAttribute('max'));
    if (novo !== atual) OP.state.atualizar(caminho, novo);
  }

  /** Liga/desliga o valor booleano indicado em data-alternar (ex.: modo livre). */
  function alternar(botao) {
    const caminho = botao.dataset.alternar;
    OP.state.atualizar(caminho, !OP.state.obter(caminho));
  }

  /** Tira a busca e o filtro "só treinadas" (para a linha procurada aparecer). */
  function limparFiltros() {
    filtros.busca = '';
    filtros.soTreinadas = false;
    refs.buscaPericias.value = '';
    refs.filtroTreinadas.checked = false;
    if (refs.derivados) aplicarFiltros(refs.derivados);
  }

  /** Destaca uma linha da tabela por um instante (a animação está no CSS). */
  function destacarLinha(linha) {
    linha.classList.remove('pericia--destaque');
    void linha.offsetWidth; // reinicia a animação se clicar de novo
    linha.classList.add('pericia--destaque');
    clearTimeout(refs.timerDestaque);
    refs.timerDestaque = setTimeout(function () {
      linha.classList.remove('pericia--destaque');
    }, 1800);
  }

  /** Rola a página até a linha da perícia, destaca e põe o foco no grau. */
  function irParaPericia(idPericia) {
    const elementos = refs.pericias[idPericia];
    if (!elementos) return;
    if (elementos.linha.hidden) limparFiltros();

    const semAnimacao = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    elementos.linha.scrollIntoView({ behavior: semAnimacao ? 'auto' : 'smooth', block: 'center' });
    destacarLinha(elementos.linha);

    const grau = elementos.linha.querySelector('[data-campo$=".grau"]');
    if (grau) grau.focus({ preventScroll: true });
  }

  /** Acrescenta um ataque novo e põe o foco no nome dele. */
  function adicionarAtaque() {
    const novo = OP.state.novoAtaque();
    OP.state.atualizar('ataques', OP.state.obter('ataques').concat([novo]));
    const elementos = refs.elementosAtaques[novo.id];
    if (elementos) elementos.nome.focus();
  }

  function removerAtaque(idAtaque) {
    const restantes = OP.state.obter('ataques').filter(function (ataque) { return ataque.id !== idAtaque; });
    delete refs.danoCritico[idAtaque];
    OP.state.atualizar('ataques', restantes);
  }

  /** Acrescenta um item vazio ao inventário e põe o foco no nome dele. */
  function adicionarItem() {
    const novo = OP.state.novoItem();
    OP.state.atualizar('inventario.itens', OP.state.obter('inventario.itens').concat([novo]));
    const elementos = refs.elementosItens[novo.id];
    if (elementos) elementos.nome.focus();
  }

  /** Remove um item pelo id (a lista inteira é regravada pelo estado). */
  function removerItem(idItem) {
    const restantes = OP.state.obter('inventario.itens').filter(function (item) { return item.id !== idItem; });
    delete refs.descricoesAbertas[idItem];
    OP.state.atualizar('inventario.itens', restantes);
  }

  /** Abre/fecha a descrição de um item (estado só da tela, não vai para a ficha). */
  function alternarDescricao(idItem) {
    refs.descricoesAbertas[idItem] = !refs.descricoesAbertas[idItem];
    desenharItens(OP.state.ficha);
    const elementos = refs.elementosItens[idItem];
    if (elementos && refs.descricoesAbertas[idItem]) elementos.textoDescricao.focus();
  }

  function aoClicar(evento) {
    const botaoPasso = evento.target.closest('[data-passo]');
    if (botaoPasso) {
      aplicarPasso(botaoPasso);
      return;
    }
    const botaoAlternar = evento.target.closest('[data-alternar]');
    if (botaoAlternar) {
      alternar(botaoAlternar);
      return;
    }
    const botaoPericia = evento.target.closest('[data-ir-pericia]');
    if (botaoPericia) {
      irParaPericia(botaoPericia.dataset.irPericia);
      return;
    }
    const botaoDescricao = evento.target.closest('[data-alternar-descricao]');
    if (botaoDescricao) {
      alternarDescricao(botaoDescricao.dataset.alternarDescricao);
      return;
    }
    const botaoRemover = evento.target.closest('[data-remover-item]');
    if (botaoRemover) {
      removerItem(botaoRemover.dataset.removerItem);
      return;
    }
    if (evento.target.closest('[data-acao="adicionar-item"]')) {
      adicionarItem();
      return;
    }

    // Rolagens e ataques
    const rolarPericia = evento.target.closest('[data-rolar-pericia]');
    if (rolarPericia) {
      rolarPericiaNaTela(rolarPericia.dataset.rolarPericia);
      return;
    }
    const rolarAtaque = evento.target.closest('[data-rolar-ataque]');
    if (rolarAtaque) {
      rolarAtaqueNaTela(rolarAtaque.dataset.rolarAtaque);
      return;
    }
    const rolarDano = evento.target.closest('[data-rolar-dano]');
    if (rolarDano) {
      rolarDanoNaTela(rolarDano.dataset.rolarDano);
      return;
    }
    const removerAtq = evento.target.closest('[data-remover-ataque]');
    if (removerAtq) {
      removerAtaque(removerAtq.dataset.removerAtaque);
      return;
    }
    if (evento.target.closest('[data-acao="adicionar-ataque"]')) {
      adicionarAtaque();
      return;
    }
    if (tratarCliqueHabilidadesERituais(evento)) return;
  }

  function ligarEventos() {
    refs.raiz.addEventListener('input', aoDigitar);
    refs.raiz.addEventListener('change', aoConfirmar);
    refs.raiz.addEventListener('click', aoClicar);
  }

  /* ------------------------------------------------------------------------
     Desenho (a cada mudança)
     ------------------------------------------------------------------------ */

  function estadoContador(restantes) {
    if (restantes < 0) return 'excedido';
    if (restantes > 0) return 'pendente';
    return 'completo';
  }

  /** Mensagens de aviso a partir da análise (calc.analisarDistribuicao). */
  function montarAvisos(dist) {
    const r = OP.data.regrasAtributos;
    const avisos = [];
    if (dist.restantes < 0) {
      const excesso = -dist.restantes;
      avisos.push('Há ' + excesso + ' ' + plural(excesso, 'ponto gasto', 'pontos gastos') + ' além do permitido.');
    }
    if (dist.acimaDoMaximo.length) {
      avisos.push(siglas(dist.acimaDoMaximo) + ' acima do máximo' + (dist.aumentos ? '' : ' inicial') + ' (' + dist.maximo + ').');
    }
    if (dist.abaixoDoMinimo.length) {
      avisos.push(siglas(dist.abaixoDoMinimo) + ' abaixo do mínimo (' + r.minimo + ').');
    }
    if (dist.reducoesEmExcesso > 0) {
      avisos.push('Só ' + r.maxAtributosReduzidos + ' ' + plural(r.maxAtributosReduzidos, 'atributo pode', 'atributos podem') +
        ' ficar abaixo de ' + r.baseInicial + ' (reduzidos: ' + siglas(dist.reduzidos) + ').');
    }
    return avisos;
  }

  /** Ids dos atributos que devem ganhar destaque de alerta. */
  function atributosComProblema(dist) {
    const ids = dist.acimaDoMaximo.concat(dist.abaixoDoMinimo);
    if (dist.reducoesEmExcesso > 0) Array.prototype.push.apply(ids, dist.reduzidos);
    return ids;
  }

  function desenharDistribuicao(ficha, dist) {
    const livre = Boolean(ficha.config.modoLivre);

    refs.contador.dataset.estado = livre ? 'livre' : estadoContador(dist.restantes);
    refs.contadorRotulo.textContent = plural(dist.restantes, 'ponto restante', 'pontos restantes');
    const porEstagio = refs.derivados && refs.derivados.nex.unidade === 'estagio';
    definirTexto(refs.infoAumentos, 'Aumentos de atributo liberados pelo ' + (porEstagio ? 'estágio' : 'NEX') + ': ' +
      dist.aumentos + ' (total de pontos: ' + dist.permitidos + ')');

    // Avisos: visuais e não bloqueantes. Só reescreve se mudou (evita repetir leitores de tela).
    const avisos = livre ? [] : montarAvisos(dist);
    desenharListaTextos(refs.listaAvisos, avisos);
    refs.avisos.hidden = avisos.length === 0;

    const problemas = livre ? [] : atributosComProblema(dist);
    refs.cartoes.forEach(function (cartao) {
      cartao.classList.toggle('atributo--alerta', problemas.indexOf(cartao.dataset.atributo) !== -1);
    });
  }

  /** "+ 3 bônus" / "− 2 bônus" */
  function termoComSinal(valor, rotulo) {
    return (valor < 0 ? ' − ' : ' + ') + Math.abs(valor) + ' ' + rotulo;
  }

  /**
   * Textos que explicam de onde vem o máximo de um recurso.
   * resumo:  "17 inicial + 36 por NEX + 3 bônus = 56" (SAN: "… − 2 perda permanente = …")
   * detalhe: "inicial 16 + VIG 1 · por NEX 9 × (3 + VIG 1)"
   *          Sobrevivente: "… · por estágio 4 × 2" (sem atributo por estágio)
   */
  function textosComposicao(composicao) {
    if (!composicao.classeDefinida) {
      return { resumo: 'Máximo calculado após escolher a classe.', detalhe: '' };
    }
    const c = composicao;
    const porPasso = c.unidade === 'estagio' ? 'por estágio' : 'por NEX';
    const resumo = c.inicial + ' inicial' + termoComSinal(c.ganhoNex, porPasso) +
      termoComSinal(c.bonus, 'bônus') +
      (c.perdaPermanente ? ' − ' + c.perdaPermanente + ' perda permanente' : '') + ' = ' + c.max;

    const parteAtributo = c.atributo ? siglaAtributo(c.atributo) + ' ' + c.valorAtributo : '';
    const inicial = 'inicial ' + c.inicialClasse + (parteAtributo ? ' + ' + parteAtributo : '');
    const passo = c.somaAtributo
      ? porPasso + ' ' + c.passos + ' × (' + c.porNexClasse + ' + ' + parteAtributo + ')'
      : porPasso + ' ' + c.passos + ' × ' + c.porNexClasse;
    return { resumo: resumo, detalhe: inicial + ' · ' + passo };
  }

  function desenharRecursos(derivados) {
    let faltaClasse = false;
    OP.data.recursos.forEach(function (definicao) {
      const composicao = derivados.recursos[definicao.id];
      const elementos = refs.recursos[definicao.id];
      const semClasse = !composicao.classeDefinida;
      if (semClasse) faltaClasse = true;

      if (elementos.controles.disabled !== semClasse) elementos.controles.disabled = semClasse;
      elementos.cartao.classList.toggle('recurso--sem-classe', semClasse);

      const textos = textosComposicao(composicao);
      definirTexto(elementos.resumo, textos.resumo);
      definirTexto(elementos.detalhe, textos.detalhe);
    });
    refs.avisoSemClasse.hidden = !faltaClasse;
    definirTexto(refs.rotuloPassos, derivados.nex.unidade === 'estagio' ? 'Passos de estágio' : 'Passos de NEX');
  }

  /** Limites (max) de campos que dependem de valores calculados. */
  function desenharLimites(derivados) {
    refs.limitesDinamicos.forEach(function (campo) {
      const maximo = OP.state.lerCaminho(derivados, campo.dataset.maxSaida);
      if (maximo === null || maximo === undefined) {
        campo.removeAttribute('max');
      } else if (campo.getAttribute('max') !== String(maximo)) {
        campo.setAttribute('max', String(maximo));
      }
    });
  }

  /** Barras de preenchimento (largura em %, sempre entre 0 e 100). */
  function desenharBarras(derivados) {
    refs.barras.forEach(function (barra) {
      const valor = OP.calc.numero(OP.state.lerCaminho(derivados, barra.dataset.largura));
      barra.style.setProperty('--preenchimento', limitar(valor, 0, 100) + '%');
    });
  }

  /** "+5", "+0", "−2" (sinal de menos tipográfico). */
  function formatarComSinal(valor) {
    const n = OP.calc.numero(valor);
    return (n < 0 ? '−' : '+') + Math.abs(n);
  }

  /** Número com vírgula decimal e no máximo duas casas: 10.5 → "10,5". */
  function formatarNumero(valor) {
    return String(Math.round(OP.calc.numero(valor) * 100) / 100).replace('.', ',');
  }

  /** Texto de uma saída calculada, conforme data-formato. */
  function formatarSaida(valor, formato) {
    if (valor === undefined || valor === null) return '—';
    if (formato === 'sinal') return formatarComSinal(valor);
    if (formato === 'dados') return OP.calc.formatarDados(valor);
    if (formato === 'metros') return formatarNumero(valor) + ' m';
    if (formato === 'numero') return formatarNumero(valor);
    if (formato === 'limite') return OP.calc.numero(valor) === 0 ? '—' : String(valor); // "—" = não permitida
    if (formato === 'teste') return OP.calc.formatarDados(valor.dados) + ' ' + formatarComSinal(valor.bonus);
    if (formato === 'critico') return valor.margem + '/x' + valor.mult;
    return String(valor);
  }

  /** Botões liga/desliga: aria-pressed segue o valor no estado. */
  function desenharAlternadores() {
    refs.alternadores.forEach(function (botao) {
      const ligado = String(OP.state.obter(botao.dataset.alternar) === true);
      if (botao.getAttribute('aria-pressed') !== ligado) botao.setAttribute('aria-pressed', ligado);
    });
  }

  /** Busca sem acento e sem diferenciar maiúsculas ("ciencias" acha "Ciências"). */
  function normalizarBusca(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  /** Mostra/esconde linhas conforme a busca e o filtro "só treinadas". */
  function aplicarFiltros(derivados) {
    const termo = normalizarBusca(filtros.busca);
    let visiveis = 0;
    OP.data.pericias.forEach(function (definicao) {
      const elementos = refs.pericias[definicao.id];
      const especialidade = OP.state.obter('pericias.' + definicao.id + '.nomeAberto') || '';
      const casaBusca = !termo || normalizarBusca(definicao.nome + ' ' + especialidade).indexOf(termo) !== -1;
      const casaTreino = !filtros.soTreinadas || derivados.pericias[definicao.id].treinada;
      const visivel = casaBusca && casaTreino;
      if (elementos.linha.hidden === visivel) elementos.linha.hidden = !visivel;
      if (visivel) visiveis++;
    });
    refs.periciasVazio.hidden = visiveis > 0;
  }

  function desenharPericias(derivados) {
    const identidade = derivados.identidade;
    OP.data.pericias.forEach(function (definicao) {
      const estado = derivados.pericias[definicao.id];
      const elementos = refs.pericias[definicao.id];
      const linha = elementos.linha;

      linha.classList.toggle('pericia--treinada', estado.treinada);
      linha.classList.toggle('pericia--requer-treino', estado.requerTreinamento);
      linha.classList.toggle('pericia--atributo-alterado', estado.atributoAlterado);
      linha.classList.toggle('pericia--concedida', Boolean(estado.concedidaPor));
      if (elementos.requer.hidden === estado.requerTreinamento) elementos.requer.hidden = !estado.requerTreinamento;

      // Concedida pela classe/origem: etiqueta, e o grau 0 vale como Treinado (não gasta pontos)
      const fonte = estado.concedidaPor || '';
      if (elementos.fonte.hidden === Boolean(fonte)) elementos.fonte.hidden = !fonte;
      definirTexto(elementos.fonte, fonte);
      elementos.fonte.title = fonte ? 'Concedida pela ' + fonte + ': vale pelo menos Treinado e não gasta pontos de treinamento' : '';
      definirTexto(elementos.opcaoDestreinado, fonte ? 'Treinado (concedida)' : OP.data.grausTreinamento[0].nome);

      // Profissão: a origem sugere a especialidade (só como dica, não é salva)
      if (elementos.especialidade) {
        const sugestao = definicao.id === 'profissao' && identidade.profissaoSugerida ? identidade.profissaoSugerida : 'especialidade';
        if (elementos.especialidade.placeholder !== sugestao) elementos.especialidade.placeholder = sugestao;
      }

      const dica = estado.atributoAlterado ? 'Atributo alterado (padrão: ' + siglaAtributo(estado.atributoPadrao) + ')' : '';
      if (elementos.atributo.title !== dica) elementos.atributo.title = dica;

      // Etiqueta "−X carga" (proteções equipadas e/ou sobrecarga)
      if (elementos.carga) {
        const temPenalidade = estado.penalidadeCarga > 0;
        if (elementos.carga.hidden === temPenalidade) elementos.carga.hidden = !temPenalidade;
        definirTexto(elementos.carga, '−' + estado.penalidadeCarga + ' carga');
      }

      // Ícone de kit: preenchido quando o kit está no inventário
      if (elementos.kit) {
        elementos.kit.classList.toggle('icone--ativo', estado.kitAtivo);
        const titulo = estado.kitAtivo ? ICONES.kit.titulo + ' (kit no inventário)' : ICONES.kit.titulo;
        if (elementos.kit.title !== titulo) {
          elementos.kit.title = titulo;
          elementos.kit.setAttribute('aria-label', titulo);
        }
      }
    });
    aplicarFiltros(derivados);
  }

  function estadoContadorTreino(ficha, treino) {
    if (ficha.config.modoLivrePericias) return 'livre';
    if (!treino.classeDefinida) return 'indefinido';
    if (treino.gastos > treino.total) return 'excedido';
    if (treino.gastos === treino.total) return 'completo';
    return 'pendente';
  }

  function desenharTreinamento(ficha, treino) {
    const livre = Boolean(ficha.config.modoLivrePericias);
    refs.contadorTreino.dataset.estado = estadoContadorTreino(ficha, treino);

    // Aviso visual (não bloqueia) quando gasta mais do que tem.
    const mostrarAviso = !livre && treino.excedido;
    refs.avisosPericias.hidden = !mostrarAviso;
    if (mostrarAviso) {
      const excesso = treino.gastos - treino.total;
      definirTexto(refs.textoAvisoPericias,
        'Há ' + excesso + ' ' + plural(excesso, 'perícia treinada', 'perícias treinadas') + ' além do total (' +
        treino.gastos + ' ' + plural(treino.gastos, 'ponto gasto', 'pontos gastos') + ' de ' + treino.total + ').');
    }

    refs.avisoPericiasSemClasse.hidden = treino.classeDefinida;
    definirTexto(refs.composicaoTreino, treino.classeDefinida
      ? treino.daClasse + ' da classe + INT ' + treino.intelecto + termoComSinal(treino.bonus, 'bônus') + ' = ' + treino.total
      : 'Total calculado após escolher a classe.');
  }

  /**
   * Graus de treinamento (NEX 35% e 70%): contador "usados / liberados" e
   * avisos (sem bloquear; o modo livre das perícias desliga).
   */
  function desenharGraus(ficha, graus) {
    const livre = Boolean(ficha.config.modoLivrePericias);
    let estado = 'pendente';
    if (livre) estado = 'livre';
    else if (graus.excedido) estado = 'excedido';
    else if (graus.liberados > 0 && graus.usados === graus.liberados) estado = 'completo';
    else if (graus.liberados === 0 && graus.usados === 0) estado = 'indefinido';
    refs.contadorGraus.dataset.estado = estado;
    refs.contadorGraus.title = 'Graus de treinamento usados (Veterano = 1, Expert = 2) / liberados (' +
      graus.marcos + ' ' + plural(graus.marcos, 'marco', 'marcos') + ' × ' + graus.porMarco + ', base da classe + INT)';

    const avisos = [];
    if (!livre) {
      if (graus.excedido) {
        avisos.push(graus.usados + ' ' + plural(graus.usados, 'grau usado', 'graus usados') + ' para ' + graus.liberados +
          ' ' + plural(graus.liberados, 'liberado', 'liberados') + ' pelo ' + (graus.unidade === 'estagio' ? 'estágio' : 'NEX') + '.');
      }
      graus.avisos.forEach(function (aviso) {
        avisos.push(aviso.nome + ' em ' + aviso.nomeGrau + (aviso.nivelNecessario !== null
          ? ': exige NEX ' + aviso.nivelNecessario + '%.'
          : ': esta classe não ganha graus de treinamento.'));
      });
    }
    desenharListaTextos(refs.listaAvisosGraus, avisos);
    refs.avisosGraus.hidden = avisos.length === 0;
  }

  /** " + AGI 2", " − outros 1" */
  function parteComSinal(rotulo, valor) {
    return (valor < 0 ? ' − ' : ' + ') + rotulo + ' ' + Math.abs(valor);
  }

  /** Textos de cada reação quando disponível: { valor, detalhe }. */
  function textosReacao(idReacao, defesa) {
    const definicao = OP.data.reacoes.find(function (r) { return r.id === idReacao; });
    const pericia = nomePericia(definicao.pericia);
    if (idReacao === 'bloqueio') {
      return { valor: 'reduz ' + defesa.bloqueio.reducao + ' de dano', detalhe: 'bônus de ' + pericia + ', contra um ataque' };
    }
    if (idReacao === 'esquiva') {
      return {
        valor: 'Defesa vira ' + defesa.esquiva.defesaComEsquiva,
        detalhe: 'Defesa ' + defesa.total + parteComSinal(pericia, defesa.esquiva.bonus) + ', contra um ataque'
      };
    }
    return { valor: 'disponível', detalhe: 'treinado em ' + pericia };
  }

  function desenharReacoes(defesa) {
    OP.data.reacoes.forEach(function (definicao) {
      const elementos = refs.reacoes[definicao.id];
      const disponivel = defesa[definicao.id].disponivel;
      const textos = disponivel ? textosReacao(definicao.id, defesa) : { valor: 'indisponível', detalhe: '' };

      elementos.cartao.classList.toggle('reacao--disponivel', disponivel);
      elementos.cartao.classList.toggle('reacao--indisponivel', !disponivel);
      definirTexto(elementos.valor, textos.valor);
      definirTexto(elementos.detalhe, textos.detalhe);
      if (elementos.dica.hidden !== disponivel) elementos.dica.hidden = disponivel;
    });
  }

  function desenharDefesa(derivados) {
    const defesa = derivados.defesa;
    definirTexto(refs.composicaoDefesa, defesa.base +
      parteComSinal(siglaAtributo(defesa.atributo), defesa.valorAtributo) +
      parteComSinal('proteções', defesa.protecoesInventario) +
      parteComSinal('manual', defesa.protecao) +
      parteComSinal('outros', defesa.outros) +
      (defesa.sobrecarga ? ' − sobrecarga ' + defesa.sobrecarga : ''));

    const nomes = derivados.inventario.nomesProtecoes.map(function (nome) { return nome || 'sem nome'; });
    definirTexto(refs.nomesProtecoes, nomes.length ? '(' + nomes.join(', ') + ')' : '');

    const desloc = derivados.deslocamento;
    definirTexto(refs.composicaoDeslocamento, formatarNumero(desloc.base) + ' m base' +
      (desloc.bonus < 0 ? ' − ' : ' + ') + formatarNumero(Math.abs(desloc.bonus)) + ' m de bônus' +
      (desloc.sobrecarga ? ' − ' + formatarNumero(desloc.sobrecarga) + ' m de sobrecarga' : ''));
    definirTexto(refs.textoQuadrados, '(' + desloc.quadrados + ' ' + plural(desloc.quadrados, 'quadrado', 'quadrados') + ')');

    desenharReacoes(defesa);

    refs.testes.forEach(function (botao) {
      botao.classList.toggle('teste--treinado', derivados.pericias[botao.dataset.teste].treinada);
    });

    const ativas = derivados.resistenciasAtivas;
    definirTexto(refs.contagemResistencias, ativas ? ativas + ' ' + plural(ativas, 'ativa', 'ativas') : '');
  }

  /**
   * Recria as linhas de itens quando a lista muda (item novo, removido ou
   * reordenado). Nas outras mudanças as linhas ficam e só os valores mudam.
   */
  function sincronizarItens(ficha) {
    const itens = ficha.inventario.itens;
    const assinatura = itens.map(function (item) { return item.id; }).join('|');
    if (assinatura === refs.itensRenderizados) return;
    refs.itensRenderizados = assinatura;

    substituirFilhos(refs.listaItens, itens.map(function (item, indice) {
      return criarComIds(htmlItem(indice), item.id, IDS_ITEM);
    }));
    refs.elementosItens = Object.create(null);
    selecionarTodos('[data-item]', refs.listaItens).forEach(function (linha) {
      refs.elementosItens[linha.dataset.item] = {
        linha: linha,
        nome: linha.querySelector('.item__nome input'),
        descricao: linha.querySelector('.item__descricao'),
        textoDescricao: linha.querySelector('.item__descricao textarea'),
        botaoDescricao: linha.querySelector('[data-alternar-descricao]')
      };
    });
    coletarLigacoes(); // os campos novos passam a ser desenhados pelo ciclo normal
  }

  /** Estado visual de cada item: tipo (campos que aparecem), equipada e descrição. */
  function desenharItens(ficha) {
    ficha.inventario.itens.forEach(function (item) {
      const elementos = refs.elementosItens[item.id];
      if (!elementos) return;
      if (elementos.linha.dataset.tipoItem !== item.tipo) elementos.linha.dataset.tipoItem = item.tipo;
      elementos.linha.classList.toggle('item--equipada', item.tipo === 'protecao' && item.equipada === true);

      const aberta = refs.descricoesAbertas[item.id] === true;
      if (elementos.descricao.hidden === aberta) elementos.descricao.hidden = !aberta;
      elementos.botaoDescricao.setAttribute('aria-expanded', String(aberta));
      // marca o botão quando há descrição escrita
      elementos.botaoDescricao.classList.toggle('botao-icone--marcado', String(item.descricao || '').trim() !== '');
    });
    refs.itensVazio.hidden = ficha.inventario.itens.length > 0;
  }

  function textoSobrecarga(sobrecarga) {
    return 'Sobrecarregado: −' + sobrecarga.defesa + ' Defesa, −' + formatarNumero(sobrecarga.deslocamento) +
      ' m de deslocamento, −' + sobrecarga.pericias + ' em perícias com carga';
  }

  function desenharInventario(ficha, derivados) {
    const inv = derivados.inventario;
    const patente = dadosPatente(inv.patente);
    const sugerida = dadosPatente(inv.patenteSugerida);

    // Patente sugerida: só uma dica, nunca muda a escolha
    definirTexto(refs.dicaPatente, 'Com ' + inv.pontosPrestigio + ' PP, a patente sugerida é ' + sugerida.nome +
      (sugerida.id === patente.id ? ' (a atual).' : '.'));
    refs.dicaPatente.classList.toggle('painel__info--destaque', sugerida.id !== patente.id);
    definirTexto(refs.opcaoCreditoPadrao, 'Padrão da patente (' + nomeCredito(inv.creditoPatente) + ')');

    // Limites por categoria (aviso sem bloquear)
    const excedidos = [];
    inv.limites.forEach(function (limite) {
      refs.limites[limite.categoria].classList.toggle('limite--excedido', limite.excedeu);
      if (limite.excedeu && limite.limite === 0) {
        excedidos.push('Categoria ' + limite.categoria + ': ' + limite.usados + ' ' + plural(limite.usados, 'item', 'itens') +
          ', mas a patente ' + patente.nome + ' não permite essa categoria.');
      } else if (limite.excedeu) {
        excedidos.push('Categoria ' + limite.categoria + ': ' + limite.usados + ' ' + plural(limite.usados, 'item', 'itens') +
          ' para um limite de ' + limite.limite + ' (' + patente.nome + ').');
      }
    });
    refs.avisosLimites.hidden = excedidos.length === 0;
    desenharListaTextos(refs.listaAvisosLimites, excedidos);

    // Carga
    const config = OP.data.config;
    const base = inv.forca <= 0
      ? config.capacidadeForcaZero + ' (FOR ' + inv.forca + ')'
      : config.capacidadePorForca + ' × FOR ' + inv.forca;
    definirTexto(refs.composicaoCarga, base + parteComSinal('bônus', inv.capacidadeBonus) + ' = ' + formatarNumero(inv.capacidade));
    refs.painelCarga.classList.toggle('painel--sobrecarregado', inv.sobrecarregado);

    // Aviso de sobrecarga (no inventário e no deslocamento), com os valores de OP.data.config
    const aviso = textoSobrecarga(inv.sobrecarga);
    refs.avisosSobrecarga.forEach(function (elemento) {
      if (elemento.hidden === inv.sobrecarregado) elemento.hidden = !inv.sobrecarregado;
      definirTexto(elemento, aviso);
    });

    desenharItens(ficha);
  }

  function desenharTitulo(ficha) {
    // Na Central e no Arquivo o título é da tela (js/ui-app.js)
    if (document.body.dataset.vista && document.body.dataset.vista !== 'ficha') return;
    const nome = ficha.identificacao.nome.trim();
    document.title = nome ? nome + ' · Ficha de Agente' : 'Ficha de Agente · Ordem Paranormal';
  }

  /* ------------------------------------------------------------------------
     Ataques: sincronização e desenho
     ------------------------------------------------------------------------ */

  /** Recria os cartões de ataque quando a lista muda (novo, removido, reordenado). */
  function sincronizarAtaques(ficha) {
    const assinatura = ficha.ataques.map(function (ataque) { return ataque.id; }).join('|');
    if (assinatura === refs.ataquesRenderizados) return;
    refs.ataquesRenderizados = assinatura;

    substituirFilhos(refs.listaAtaques, ficha.ataques.map(function (ataque, indice) {
      return criarComIds(htmlAtaque(indice), ataque.id, IDS_ATAQUE);
    }));
    refs.elementosAtaques = Object.create(null);
    selecionarTodos('[data-ataque]', refs.listaAtaques).forEach(function (cartao) {
      refs.elementosAtaques[cartao.dataset.ataque] = {
        cartao: cartao,
        nome: cartao.querySelector('.ataque__nome'),
        formula: cartao.querySelector('.ataque__formula'),
        erroDano: cartao.querySelector('[data-erro-dano]'),
        marcaCritico: cartao.querySelector('[data-dano-critico]'),
        botaoAtaque: cartao.querySelector('[data-rolar-ataque]')
      };
    });
    refs.armasRenderizadas = null; // selects novos: recriar as opções de arma
    coletarLigacoes();
  }

  /** <option> com valor e texto vindos da ficha (por .value e textContent). */
  function criarOpcao(valor, texto) {
    const opcao = document.createElement('option');
    opcao.value = valor;
    opcao.textContent = texto;
    return opcao;
  }

  /** Opções do select "Arma do inventário": itens do tipo arma (só recria se mudarem). */
  function sincronizarOpcoesArma(ficha) {
    const armas = ficha.inventario.itens.filter(function (item) { return item.tipo === 'arma'; });
    const assinatura = armas.map(function (item) { return item.id + ':' + item.nome; }).join('|');
    if (assinatura === refs.armasRenderizadas) return;
    refs.armasRenderizadas = assinatura;
    selecionarTodos('[data-arma-inventario]', refs.listaAtaques).forEach(function (select) {
      substituirFilhos(select, [criarOpcao('', 'Nenhuma')].concat(armas.map(function (item) {
        return criarOpcao(item.id, item.nome || '(arma sem nome)');
      })));
      escreverCampo(select, true);
    });
  }

  function desenharAtaques(ficha, derivados) {
    sincronizarOpcoesArma(ficha);
    ficha.ataques.forEach(function (ataque, indice) {
      const elementos = refs.elementosAtaques[ataque.id];
      const estado = derivados.ataques[indice];
      if (!elementos || !estado) return;

      // Fórmula de dano validada em tempo real
      elementos.formula.classList.toggle('controle--invalido', !estado.danoValido);
      elementos.formula.setAttribute('aria-invalid', String(!estado.danoValido));
      if (elementos.erroDano.hidden === !estado.danoValido) elementos.erroDano.hidden = estado.danoValido;
      definirTexto(elementos.erroDano, estado.danoErro);

      // Munição: o contador só aparece quando "usa munição" está marcado
      const usa = ataque.usaMunicao === true ? 'sim' : 'nao';
      if (elementos.cartao.dataset.municao !== usa) elementos.cartao.dataset.municao = usa;
      elementos.botaoAtaque.classList.toggle('botao-rolagem--bloqueado', estado.semMunicao);
      const dica = estado.semMunicao ? 'Sem munição' : '';
      if (elementos.botaoAtaque.title !== dica) elementos.botaoAtaque.title = dica;

      const critico = refs.danoCritico[ataque.id] === true;
      if (elementos.marcaCritico.checked !== critico) elementos.marcaCritico.checked = critico;
    });
    refs.ataquesVazio.hidden = ficha.ataques.length > 0;
  }

  /* ------------------------------------------------------------------------
     Painel de rolagens (fixo; histórico só em memória, fora do auto-save)
     ------------------------------------------------------------------------ */

  const HISTORICO_MAXIMO = 30;
  const historico = [];

  function montarRolagens() {
    refs.painel = document.getElementById('rolagens');
    refs.alca = document.getElementById('rolagens-alca');
    refs.corpoPainel = document.getElementById('rolagens-corpo');
    refs.ultimo = document.getElementById('rolagens-ultimo');
    refs.resultado = document.getElementById('rolagens-resultado');
    refs.rolagemMod = document.getElementById('rolagem-mod-dados');
    refs.rolagemBonus = document.getElementById('rolagem-bonus-extra');
    refs.rolagemDefesa = document.getElementById('rolagem-defesa');
    refs.rolagemDica = document.getElementById('rolagens-dica');
    refs.formula = document.getElementById('rolagem-formula');
    refs.formulaErro = document.getElementById('rolagem-formula-erro');
    refs.historico = document.getElementById('rolagens-historico');

    // Modificador de dados: de −3 a +3
    const opcoes = [];
    for (let mod = -3; mod <= 3; mod++) {
      const texto = mod === 0 ? 'Nenhum' : formatarComSinal(mod) + ' d20';
      opcoes.push('<option value="' + mod + '"' + (mod === 0 ? ' selected' : '') + '>' + texto + '</option>');
    }
    refs.rolagemMod.innerHTML = opcoes.join('');

    refs.alca.addEventListener('click', function () { abrirPainel(refs.painel.dataset.aberto !== 'true'); });
    refs.painel.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && refs.painel.dataset.aberto === 'true') {
        abrirPainel(false);
        refs.alca.focus();
      }
    });
    [refs.rolagemMod, refs.rolagemBonus, refs.rolagemDefesa].forEach(function (campo) {
      campo.addEventListener('input', desenharDicaRolagem);
      campo.addEventListener('change', desenharDicaRolagem);
    });
    document.getElementById('rolagem-limpar-opcoes').addEventListener('click', limparOpcoesRolagem);
    document.getElementById('rolagem-limpar-historico').addEventListener('click', limparHistorico);
    document.getElementById('rolagem-formula-form').addEventListener('submit', function (evento) {
      evento.preventDefault();
      rolarFormulaNaTela();
    });
    refs.formula.addEventListener('input', function () { refs.formulaErro.hidden = true; });
    refs.resultado.addEventListener('click', function (evento) {
      const botao = evento.target.closest('[data-rolar-dano-painel]');
      if (botao) rolarDanoNaTela(botao.dataset.rolarDanoPainel);
    });
    // Usar habilidade e conjurar ritual entram no histórico como eventos (sem total)
    OP.rolagens.aoRegistrarEvento(registrarEventoNoHistorico);

    desenharDicaRolagem();
    desenharHistorico();
  }

  /** Evento sem dados (uso de habilidade, conjuração) no histórico, sem abrir o painel. */
  function registrarEventoNoHistorico(evento) {
    historico.unshift({ titulo: evento.titulo, detalhe: evento.detalhe, alvo: '', total: '', critico: false, evento: true });
    if (historico.length > HISTORICO_MAXIMO) historico.length = HISTORICO_MAXIMO;
    desenharHistorico();
  }

  function abrirPainel(aberto) {
    refs.painel.dataset.aberto = String(aberto);
    refs.alca.setAttribute('aria-expanded', String(aberto));
    refs.corpoPainel.hidden = !aberto;
    // Em telas bem largas o painel aberto vira uma coluna e a página abre espaço para ele
    document.body.classList.toggle('com-painel-rolagens', aberto);
  }

  /** Opções do painel para a próxima rolagem. */
  function opcoesRolagem() {
    const defesa = refs.rolagemDefesa.value.trim();
    return {
      modDados: Math.trunc(Number(refs.rolagemMod.value)) || 0,
      bonusExtra: Math.trunc(Number(refs.rolagemBonus.value)) || 0,
      defesaAlvo: defesa === '' || !Number.isFinite(Number(defesa)) ? null : Number(defesa)
    };
  }

  /** Resumo das opções ativas ("Próximos testes: +1 d20, +2 de bônus, contra 15"). */
  function desenharDicaRolagem() {
    const o = opcoesRolagem();
    const partes = [];
    if (o.modDados) partes.push(formatarComSinal(o.modDados) + ' d20');
    if (o.bonusExtra) partes.push(formatarComSinal(o.bonusExtra) + ' de bônus');
    if (o.defesaAlvo !== null) partes.push('contra Defesa/DT ' + o.defesaAlvo);
    refs.rolagemDica.hidden = partes.length === 0;
    definirTexto(refs.rolagemDica, partes.length ? 'Próximos testes: ' + partes.join(', ') + '.' : '');
  }

  function limparOpcoesRolagem() {
    refs.rolagemMod.value = '0';
    refs.rolagemBonus.value = '0';
    refs.rolagemDefesa.value = '';
    desenharDicaRolagem();
  }

  function limparHistorico() {
    historico.length = 0;
    desenharHistorico();
  }

  /** d20 de um teste: o escolhido em destaque, os descartados esmaecidos. */
  function criarDadosTeste(resultado) {
    const caixa = criarElemento('div', 'resultado__dados');
    resultado.resultados.forEach(function (valor, indice) {
      const classes = ['dado', indice === resultado.indiceEscolhido ? 'dado--escolhido' : 'dado--descartado'];
      if (valor === 20) classes.push('dado--20');
      if (valor === 1) classes.push('dado--1');
      caixa.appendChild(criarElemento('span', classes.join(' '), valor));
    });
    return caixa;
  }

  /** Topo do resultado: título (pode vir da ficha) e selo opcional. */
  function criarTopoResultado(titulo, selo) {
    const topo = criarElemento('div', 'resultado__topo');
    topo.appendChild(criarElemento('span', 'resultado__titulo', titulo));
    if (selo) topo.appendChild(criarElemento('span', 'selo selo--critico', selo));
    return topo;
  }

  /** Rodapé do resultado: a conta à esquerda e o total grande à direita. */
  function criarFimResultado(conta, total) {
    const fim = criarElemento('div', 'resultado__fim');
    fim.appendChild(criarElemento('p', 'resultado__conta', conta));
    const caixaTotal = criarElemento('p', 'resultado__total');
    caixaTotal.appendChild(criarElemento('span', 'visualmente-oculto', 'Total: '));
    caixaTotal.appendChild(document.createTextNode(String(total)));
    fim.appendChild(caixaTotal);
    return fim;
  }

  function textoAlvo(resultado) {
    if (resultado.acertou === null || resultado.acertou === undefined) return '';
    if (resultado.subtipo === 'ataque') {
      return (resultado.acertou ? 'Acerta' : 'Erra') + ' (Defesa ' + resultado.defesaAlvo + ')';
    }
    return (resultado.acertou ? 'Sucesso' : 'Falha') + ' (DT ' + resultado.defesaAlvo + ')';
  }

  function criarResultadoTeste(resultado) {
    const regra = resultado.qtd + 'd20, fica o ' + resultado.modo +
      (resultado.modDados ? ' (modificador ' + formatarComSinal(resultado.modDados) + ')' : '');
    const conta = resultado.escolhido + resultado.partesBonus.map(function (parte) {
      return parteComSinal(parte.rotulo, parte.valor);
    }).join('');
    const alvo = textoAlvo(resultado);

    const caixa = criarElemento('div', 'resultado' + (resultado.critico ? ' resultado--critico' : ''));
    caixa.appendChild(criarTopoResultado(resultado.titulo, resultado.critico ? 'CRÍTICO' : ''));
    caixa.appendChild(criarDadosTeste(resultado));
    caixa.appendChild(criarElemento('p', 'resultado__regra', regra));
    caixa.appendChild(criarFimResultado(conta, resultado.total));
    if (alvo) caixa.appendChild(criarElemento('p', 'resultado__alvo resultado__alvo--' + (resultado.acertou ? 'sim' : 'nao'), alvo));
    const acoes = criarAcoesResultado(resultado);
    if (acoes) caixa.appendChild(acoes);
    return caixa;
  }

  /**
   * Depois de um ataque, o próprio painel oferece "Rolar dano"
   * (assim o botão do cartão pode ficar coberto pelo painel sem atrapalhar).
   */
  function criarAcoesResultado(resultado) {
    if (resultado.subtipo !== 'ataque' || !resultado.idAtaque) return null;
    const acoes = criarElemento('div', 'resultado__acoes');
    const botao = criarElemento('button', 'botao-rolagem botao-rolagem--dano');
    botao.type = 'button';
    botao.setAttribute('data-rolar-dano-painel', resultado.idAtaque);
    botao.appendChild(elementoDeHtml(ICONE_DADO));
    botao.appendChild(criarElemento('span', '', 'Rolar dano' + (resultado.critico ? ' (crítico)' : '')));
    acoes.appendChild(botao);
    return acoes;
  }

  /** Um termo de fórmula: "2d6 [4] [5]" ou "+3". */
  function criarTermo(termo, indice) {
    if (termo.tipo === 'fixo') {
      return criarElemento('span', 'termo termo--fixo', (termo.rotulo ? termo.rotulo + ' ' : '') + formatarComSinal(termo.valor));
    }
    const sinal = termo.sinal < 0 ? '−' : (indice > 0 ? '+' : '');
    const caixa = criarElemento('span', 'termo');
    caixa.appendChild(criarElemento('span', 'termo__rotulo', sinal + termo.qtd + 'd' + termo.faces));
    termo.resultados.forEach(function (valor) {
      caixa.appendChild(criarElemento('span', 'dado dado--pequeno' + (valor === termo.faces ? ' dado--maximo' : ''), valor));
    });
    return caixa;
  }

  function criarResultadoFormula(resultado) {
    const tipo = resultado.tipoDano ? OP.data.tiposDano.find(function (t) { return t.id === resultado.tipoDano; }) : null;
    const caixa = criarElemento('div', 'resultado' + (resultado.critico ? ' resultado--critico' : ''));
    caixa.appendChild(criarTopoResultado(resultado.titulo, resultado.critico ? 'CRÍTICO ×' + resultado.multDados : ''));
    const termos = criarElemento('div', 'resultado__termos');
    resultado.termos.forEach(function (termo, indice) { termos.appendChild(criarTermo(termo, indice)); });
    caixa.appendChild(termos);
    caixa.appendChild(criarFimResultado((resultado.formula || '') + (tipo ? ' · ' + tipo.nome : ''), resultado.total));
    return caixa;
  }

  function criarResultadoErro(resultado) {
    const caixa = criarElemento('div', 'resultado resultado--erro');
    caixa.appendChild(criarTopoResultado(resultado.titulo || 'Rolagem', ''));
    caixa.appendChild(criarElemento('p', 'resultado__mensagem', resultado.erro));
    return caixa;
  }

  /** Linha curta para o histórico. */
  function resumoHistorico(resultado) {
    if (resultado.tipo === 'teste') {
      const bonus = resultado.bonus ? ' ' + formatarComSinal(resultado.bonus) : '';
      return resultado.qtd + 'd20 [' + resultado.resultados.join(', ') + '] → ' + resultado.escolhido + bonus;
    }
    return resultado.termos.map(function (termo) {
      return termo.tipo === 'fixo' ? formatarComSinal(termo.valor) : termo.qtd + 'd' + termo.faces + ' [' + termo.resultados.join(', ') + ']';
    }).join(' ');
  }

  function criarItemHistorico(entrada) {
    const item = criarElemento('li', 'historico__item' + (entrada.critico ? ' historico__item--critico' : '') +
      (entrada.evento ? ' historico__item--evento' : ''));
    item.appendChild(criarElemento('span', 'historico__titulo', entrada.titulo + (entrada.critico ? ' · CRÍTICO' : '')));
    item.appendChild(criarElemento('span', 'historico__detalhe', entrada.detalhe + (entrada.alvo ? ' · ' + entrada.alvo : '')));
    item.appendChild(criarElemento('span', 'historico__total', entrada.total));
    return item;
  }

  function desenharHistorico() {
    substituirFilhos(refs.historico, historico.length
      ? historico.map(criarItemHistorico)
      : [criarElemento('li', 'historico__vazio', 'Nenhuma rolagem ainda.')]);
  }

  /** Mostra um resultado no painel (abre o painel) e guarda no histórico. */
  function mostrarResultado(resultado) {
    abrirPainel(true);
    if (!resultado.ok) {
      substituirFilhos(refs.resultado, [criarResultadoErro(resultado)]);
      return;
    }
    substituirFilhos(refs.resultado, [resultado.tipo === 'teste' ? criarResultadoTeste(resultado) : criarResultadoFormula(resultado)]);
    definirTexto(refs.ultimo, 'último: ' + resultado.total + (resultado.critico ? ' (crítico)' : ''));

    historico.unshift({
      titulo: resultado.titulo,
      detalhe: resumoHistorico(resultado),
      alvo: resultado.tipo === 'teste' ? textoAlvo(resultado) : '',
      total: resultado.total,
      critico: resultado.critico === true
    });
    if (historico.length > HISTORICO_MAXIMO) historico.length = HISTORICO_MAXIMO;
    desenharHistorico();
  }

  function rolarPericiaNaTela(idPericia) {
    mostrarResultado(OP.rolagens.rolarPericia(OP.state.ficha, idPericia, opcoesRolagem()));
  }

  function acharAtaque(idAtaque) {
    const lista = OP.state.ficha.ataques;
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].id === idAtaque) return { ataque: lista[i], indice: i };
    }
    return null;
  }

  /** Rola o ataque; gasta munição pelo estado e marca o próximo dano como crítico. */
  function rolarAtaqueNaTela(idAtaque) {
    const achado = acharAtaque(idAtaque);
    if (!achado) return;
    const resultado = OP.rolagens.rolarAtaque(OP.state.ficha, achado.ataque, opcoesRolagem());
    if (resultado.ok) {
      refs.danoCritico[idAtaque] = resultado.critico === true;
      if (resultado.municaoRestante !== null) {
        OP.state.atualizar('ataques.' + achado.indice + '.municao', resultado.municaoRestante);
      } else {
        desenharAtaques(OP.state.ficha, refs.derivados);
      }
    }
    mostrarResultado(resultado);
  }

  /** Rola o dano (crítico se a caixa estiver marcada) e desmarca a caixa. */
  function rolarDanoNaTela(idAtaque) {
    const achado = acharAtaque(idAtaque);
    if (!achado) return;
    const critico = refs.danoCritico[idAtaque] === true;
    const resultado = OP.rolagens.rolarDano(OP.state.ficha, achado.ataque, { critico: critico });
    if (resultado.ok) {
      refs.danoCritico[idAtaque] = false;
      desenharAtaques(OP.state.ficha, refs.derivados);
    }
    mostrarResultado(resultado);
  }

  function rolarFormulaNaTela() {
    const resultado = OP.rolagens.rolarLivre(refs.formula.value);
    if (!resultado.ok) {
      refs.formulaErro.hidden = false;
      definirTexto(refs.formulaErro, resultado.erro);
      abrirPainel(true);
      return;
    }
    refs.formulaErro.hidden = true;
    mostrarResultado(resultado);
  }

  /* ------------------------------------------------------------------------
     Habilidades, poderes e rituais: utilitários comuns
     ------------------------------------------------------------------------ */

  /** Nome de um item de lista { id, nome } pelo id ('' se não achar). */
  function nomeNaLista(lista, id) {
    const achado = lista.find(function (item) { return item.id === id; });
    return achado ? achado.nome : '';
  }

  function htmlOpcoesLista(lista, textoVazio) {
    return (textoVazio !== undefined ? '<option value="">' + escaparHtml(textoVazio) + '</option>' : '') +
      lista.map(function (item) {
        return '<option value="' + escaparHtml(item.id) + '">' + escaparHtml(item.nome) + '</option>';
      }).join('');
  }

  /** Mensagem curta na tela (após usar/conjurar): tipo "ok", "aviso" ou "erro". */
  function mostrarMensagem(elemento, mensagem) {
    if (!elemento) return;
    elemento.hidden = false;
    elemento.dataset.tipo = mensagem.tipo;
    elemento.textContent = mensagem.texto;
  }

  /** Texto da mensagem de um gasto (OP.state.aplicarCustos): PE e, nos rituais de Medo, Sanidade. */
  function mensagemGasto(resultado, verbo, dt) {
    const sufixoDt = dt !== undefined ? ' DT ' + dt + '.' : '';
    if (!resultado.ok) {
      if (resultado.motivo === 'PE insuficiente') {
        return { tipo: 'erro', texto: 'PE insuficiente: custa ' + resultado.custo + ' PE e você tem ' + resultado.peAtual + '. Nada foi gasto.' };
      }
      return { tipo: 'erro', texto: resultado.motivo };
    }
    const partes = [];
    if (resultado.gasto) partes.push('−' + resultado.gasto + ' PE (sobram ' + resultado.peAtual + ')');
    if (resultado.san) {
      const sobra = resultado.sanAtual !== null && resultado.sanAtual !== undefined ? ' (sobram ' + resultado.sanAtual + ')' : '';
      partes.push('−' + resultado.san + ' SAN' + sobra);
    }
    if (resultado.permanente) partes.push('−' + resultado.permanente + ' SAN permanente');
    if (!partes.length) return { tipo: 'ok', texto: verbo + ' (sem custo de PE).' + sufixoDt };

    let texto = verbo + ': ' + partes.join(', ') + '.' + sufixoDt;
    let tipo = 'ok';
    if (resultado.avisoLimite) {
      texto += ' Passou do limite de PE por turno (' + resultado.peGastoTurno + '/' + resultado.limite + ').';
      tipo = 'aviso';
    }
    if (resultado.sanZera) {
      texto += ' A Sanidade chegou a 0!';
      tipo = 'erro';
    }
    return { tipo: tipo, texto: texto };
  }

  /** Filtros das listas (busca e elemento): estado só da tela. */
  function atualizarFiltroLista(controle) {
    const tipo = controle.dataset.filtroLista;
    if (tipo === 'habilidades-busca') filtrosHabilidades.busca = controle.value;
    if (tipo === 'rituais-busca') filtrosRituais.busca = controle.value;
    if (tipo === 'rituais-elemento') filtrosRituais.elemento = controle.value;
    desenharHabilidades(OP.state.ficha);
    if (refs.derivados) desenharRituais(OP.state.ficha, refs.derivados);
  }

  /** Cliques das seções de habilidades e rituais. Devolve true se tratou o clique. */
  function tratarCliqueHabilidadesERituais(evento) {
    const alvo = evento.target;
    const acoes = [
      ['[data-aba-fonte]', function (b) { escolherAbaFonte(b.dataset.abaFonte); }],
      ['[data-alternar-habilidade]', function (b) { alternarHabilidade(b.dataset.alternarHabilidade); }],
      ['[data-usar-habilidade]', function (b) { usarHabilidadeNaTela(b.dataset.usarHabilidade); }],
      ['[data-remover-habilidade]', function (b) { removerDaLista('habilidades', b.dataset.removerHabilidade); }],
      ['[data-acao="adicionar-habilidade"]', function () { adicionarHabilidade(); }],
      ['[data-conjurar]', function (b) { conjurarNaTela(b.dataset.conjurar, b.dataset.forma); }],
      ['[data-rolar-dano-ritual]', function (b) { rolarDanoRitualNaTela(b.dataset.rolarDanoRitual, b.dataset.forma); }],
      ['[data-remover-ritual]', function (b) { removerDaLista('rituais', b.dataset.removerRitual); }],
      ['[data-acao="adicionar-ritual"]', function () { adicionarRitual(); }],
      ['[data-acao="novo-turno"]', function () { OP.state.novoTurno(); }]
    ];
    for (let i = 0; i < acoes.length; i++) {
      const botao = alvo.closest(acoes[i][0]);
      if (botao) {
        acoes[i][1](botao);
        return true;
      }
    }
    return false;
  }

  /** Remove um elemento de uma lista da ficha (habilidades ou rituais) pelo id. */
  function removerDaLista(caminho, id) {
    const restantes = OP.state.obter(caminho).filter(function (elemento) { return elemento.id !== id; });
    OP.state.atualizar(caminho, restantes);
  }

  /* ------------------------------------------------------------------------
     Habilidades e poderes
     ------------------------------------------------------------------------ */

  const filtrosHabilidades = { fonte: 'todas', busca: '' };

  // Atributos que recebem o id da habilidade (por setAttribute, em criarComIds).
  const IDS_HABILIDADE = ['data-habilidade', 'data-alternar-habilidade', 'data-usar-habilidade', 'data-remover-habilidade'];

  /** Opções de "Calcular DT com": Nenhum (grava null) e os atributos. */
  function htmlOpcoesAtributoDT() {
    return '<option value="">Nenhum</option>' + htmlOpcoesAtributo();
  }

  /** HTML FIXO de uma habilidade (o id entra depois, por criarComIds). */
  function htmlHabilidade(indice) {
    const c = 'habilidades.' + indice;
    const idDetalhes = 'hab-detalhes-' + indice;
    return '' +
      '<article class="habilidade" role="listitem" data-habilidade>' +
        '<div class="habilidade__resumo">' +
          '<button type="button" class="habilidade__alternar" data-alternar-habilidade aria-expanded="false" aria-controls="' + idDetalhes + '">' +
            '<span class="habilidade__seta" aria-hidden="true"></span>' +
            '<span class="habilidade__textos">' +
              '<span class="habilidade__nome" data-hab-nome></span>' +
              '<span class="selo-fonte" data-hab-fonte></span>' +
              '<span class="habilidade__meta" data-hab-meta></span>' +
            '</span>' +
          '</button>' +
          '<button type="button" class="botao-rolagem botao-rolagem--usar" data-usar-habilidade>Usar</button>' +
        '</div>' +
        '<p class="mensagem-acao" data-hab-mensagem role="status" aria-live="polite" hidden></p>' +
        '<div class="habilidade__detalhes" id="' + idDetalhes + '" hidden>' +
          '<div class="campos-linha">' +
            htmlCampoAtaque('nome', 'Nome',
              '<input type="text" class="controle" autocomplete="off" data-campo="' + c + '.nome" data-tipo="texto" data-hab-campo-nome>') +
            htmlCampoAtaque('fonte', 'Fonte',
              '<select class="controle" data-campo="' + c + '.fonte" data-tipo="texto">' + htmlOpcoesLista(OP.data.fontesHabilidade) + '</select>') +
            '<div class="ataque__campo ataque__campo--custo"><span class="ataque__rotulo">Custo (PE)</span>' +
              htmlPasso({ id: 'hab-' + indice + '-custo', caminho: c + '.custoPE', descricao: 'custo em PE', minimo: 0, teclado: 'numeric' }) +
            '</div>' +
            htmlCampoAtaque('ativacao', 'Ativação',
              '<select class="controle" data-campo="' + c + '.ativacao" data-tipo="texto">' + htmlOpcoesLista(OP.data.ativacoes, '—') + '</select>') +
            htmlCampoAtaque('pagina', 'Página',
              '<input type="text" class="controle" autocomplete="off" data-campo="' + c + '.pagina" data-tipo="texto">') +
          '</div>' +
          htmlCampoAtaque('prerequisito', 'Pré-requisito',
            '<input type="text" class="controle" autocomplete="off" data-campo="' + c + '.prerequisito" data-tipo="texto">') +
          // DT para resistir à habilidade (10 + limite de PE por turno + atributo)
          '<div class="campos-linha habilidade__dt-campos">' +
            htmlCampoAtaque('atributo-dt', 'Calcular DT com',
              '<select class="controle" data-campo="' + c + '.atributoDT" data-tipo="texto" data-padrao=""' +
                ' title="DT = 10 + limite de PE por turno + atributo escolhido">' + htmlOpcoesAtributoDT() + '</select>') +
            '<div class="ataque__campo ataque__campo--custo"><span class="ataque__rotulo">Bônus de DT</span>' +
              htmlPasso({ id: 'hab-' + indice + '-dt-bonus', caminho: c + '.dtBonus', descricao: 'bônus de DT' }) +
            '</div>' +
            '<p class="habilidade__dt" data-hab-dt hidden></p>' +
          '</div>' +
          htmlCampoAtaque('descricao', 'Descrição',
            '<textarea class="controle" rows="4" placeholder="Escreva aqui o que a habilidade faz" data-campo="' + c + '.descricao" data-tipo="texto"></textarea>') +
          '<div class="habilidade__rodape">' +
            '<button type="button" class="botao-texto" data-remover-habilidade>Remover habilidade</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function montarHabilidades() {
    refs.listaHabilidades = document.getElementById('lista-habilidades');
    refs.habilidadesVazio = document.getElementById('habilidades-vazio');
    refs.habilidadesNenhuma = document.getElementById('habilidades-nenhuma');
    refs.buscaHabilidades = document.getElementById('busca-habilidades');

    const abas = [{ id: 'todas', nome: 'Todas' }].concat(OP.data.fontesHabilidade);
    const grupoAbas = document.getElementById('abas-habilidades');
    grupoAbas.innerHTML = abas.map(function (aba) {
      return '<button type="button" class="aba" data-aba-fonte="' + escaparHtml(aba.id) + '" aria-pressed="' + (aba.id === 'todas') + '">' +
        escaparHtml(aba.nome) + '</button>';
    }).join('');
    refs.abasFonte = selecionarTodos('[data-aba-fonte]', grupoAbas);

    refs.habilidadesRenderizadas = null;
    refs.elementosHabilidades = Object.create(null);
    refs.habilidadesAbertas = Object.create(null); // id → detalhes abertos (estado só da tela)
  }

  function sincronizarHabilidades(ficha) {
    const assinatura = ficha.habilidades.map(function (h) { return h.id; }).join('|');
    if (assinatura === refs.habilidadesRenderizadas) return;
    refs.habilidadesRenderizadas = assinatura;

    substituirFilhos(refs.listaHabilidades, ficha.habilidades.map(function (habilidade, indice) {
      return criarComIds(htmlHabilidade(indice), habilidade.id, IDS_HABILIDADE);
    }));
    refs.elementosHabilidades = Object.create(null);
    selecionarTodos('[data-habilidade]', refs.listaHabilidades).forEach(function (artigo) {
      refs.elementosHabilidades[artigo.dataset.habilidade] = {
        artigo: artigo,
        alternar: artigo.querySelector('[data-alternar-habilidade]'),
        nome: artigo.querySelector('[data-hab-nome]'),
        fonte: artigo.querySelector('[data-hab-fonte]'),
        meta: artigo.querySelector('[data-hab-meta]'),
        mensagem: artigo.querySelector('[data-hab-mensagem]'),
        detalhes: artigo.querySelector('.habilidade__detalhes'),
        campoNome: artigo.querySelector('[data-hab-campo-nome]'),
        dt: artigo.querySelector('[data-hab-dt]')
      };
    });
    coletarLigacoes();
  }

  /** "DT 13 = 10 + limite de PE 1 + FOR 2 + bônus 0" */
  function textoDtHabilidade(estado) {
    const p = estado.partes;
    return 'DT ' + estado.dt + ' = ' + p.base + parteComSinal('limite de PE', p.limitePE) +
      parteComSinal(siglaAtributo(estado.idAtributo), p.atributo) + parteComSinal('bônus', p.bonus);
  }

  function desenharHabilidades(ficha) {
    const termo = normalizarBusca(filtrosHabilidades.busca);
    const estados = (refs.derivados && refs.derivados.habilidades) || [];
    let visiveis = 0;
    ficha.habilidades.forEach(function (habilidade, indice) {
      const el = refs.elementosHabilidades[habilidade.id];
      if (!el) return;
      const estado = estados[indice] || { dt: null };
      const nome = String(habilidade.nome || '').trim();
      definirTexto(el.nome, nome || '(sem nome)');
      el.nome.classList.toggle('habilidade__nome--vazio', !nome);
      definirTexto(el.fonte, nomeNaLista(OP.data.fontesHabilidade, habilidade.fonte) || 'Outro');
      if (el.artigo.dataset.fonte !== habilidade.fonte) el.artigo.dataset.fonte = habilidade.fonte;

      const custo = OP.calc.numero(habilidade.custoPE);
      const meta = [custo > 0 ? custo + ' PE' : 'sem custo'];
      const ativacao = nomeNaLista(OP.data.ativacoes, habilidade.ativacao);
      if (ativacao) meta.push(ativacao);
      if (estado.dt !== null) meta.push('DT ' + estado.dt);
      if (String(habilidade.pagina || '').trim()) meta.push('p. ' + String(habilidade.pagina).trim());
      definirTexto(el.meta, meta.join(' · '));

      const temDt = estado.dt !== null;
      if (el.dt.hidden === temDt) el.dt.hidden = !temDt;
      definirTexto(el.dt, temDt ? textoDtHabilidade(estado) : '');

      const aberta = refs.habilidadesAbertas[habilidade.id] === true;
      if (el.detalhes.hidden === aberta) el.detalhes.hidden = !aberta;
      el.alternar.setAttribute('aria-expanded', String(aberta));
      el.artigo.classList.toggle('habilidade--aberta', aberta);

      const casaFonte = filtrosHabilidades.fonte === 'todas' || habilidade.fonte === filtrosHabilidades.fonte;
      const casaBusca = !termo || normalizarBusca(habilidade.nome).indexOf(termo) !== -1;
      const visivel = casaFonte && casaBusca;
      if (el.artigo.hidden === visivel) el.artigo.hidden = !visivel;
      if (visivel) visiveis++;
    });
    refs.abasFonte.forEach(function (aba) {
      aba.setAttribute('aria-pressed', String(aba.dataset.abaFonte === filtrosHabilidades.fonte));
    });
    refs.habilidadesVazio.hidden = ficha.habilidades.length > 0;
    refs.habilidadesNenhuma.hidden = ficha.habilidades.length === 0 || visiveis > 0;
  }

  function escolherAbaFonte(idFonte) {
    filtrosHabilidades.fonte = idFonte;
    desenharHabilidades(OP.state.ficha);
  }

  function alternarHabilidade(id) {
    refs.habilidadesAbertas[id] = !refs.habilidadesAbertas[id];
    desenharHabilidades(OP.state.ficha);
  }

  /** Nova habilidade: já na aba escolhida (se houver), aberta e com o foco no nome. */
  function adicionarHabilidade() {
    const fonte = filtrosHabilidades.fonte !== 'todas' ? filtrosHabilidades.fonte : 'classe';
    filtrosHabilidades.busca = '';
    refs.buscaHabilidades.value = '';
    const nova = OP.state.novaHabilidade({ fonte: fonte });
    refs.habilidadesAbertas[nova.id] = true;
    OP.state.atualizar('habilidades', OP.state.obter('habilidades').concat([nova]));
    const el = refs.elementosHabilidades[nova.id];
    if (el) el.campoNome.focus();
  }

  function usarHabilidadeNaTela(id) {
    const habilidade = OP.state.ficha.habilidades.find(function (h) { return h.id === id; });
    if (!habilidade) return;
    const resultado = OP.rolagens.usarHabilidade(OP.state.ficha, habilidade);
    const el = refs.elementosHabilidades[id];
    mostrarMensagem(el && el.mensagem, mensagemGasto(resultado, 'Usada'));
  }

  /* ------------------------------------------------------------------------
     Rituais
     ------------------------------------------------------------------------ */

  const filtrosRituais = { elemento: '', busca: '' };
  // [campo, rótulo, lista de sugestões (<datalist> de OP.data.rituaisCampos)]
  const CAMPOS_RITUAL = [
    ['execucao', 'Execução', 'execucao'], ['alcance', 'Alcance', 'alcance'], ['alvo', 'Alvo'], ['area', 'Área'],
    ['duracao', 'Duração', 'duracao'], ['pagina', 'Página']
  ];
  // Atributos que recebem o id do ritual (por setAttribute, em criarComIds).
  const IDS_RITUAL = ['data-ritual', 'data-conjurar', 'data-rolar-dano-ritual', 'data-remover-ritual'];

  function ordinal(numero) {
    return numero + 'º';
  }

  /** Opções de "Se passar no teste": os efeitos, com o resumo como dica (title). */
  function htmlOpcoesEfeito() {
    return '<option value="">—</option>' + OP.data.resistencia.efeitos.map(function (efeito) {
      return '<option value="' + escaparHtml(efeito.id) + '" title="' + escaparHtml(efeito.resumo) + '">' + escaparHtml(efeito.nome) + '</option>';
    }).join('');
  }

  function htmlOpcoesCirculo() {
    return OP.data.circulosRitual.map(function (circulo) {
      return '<option value="' + circulo + '">' + ordinal(circulo) + '</option>';
    }).join('');
  }

  /**
   * Custo de uma forma. Padrão: o custo base do ritual (só mostra). Discente e
   * Verdadeira: "+PE" (o acréscimo impresso), "Requer círculo", "Requer
   * afinidade" e o total calculado ao lado.
   */
  function htmlCustoForma(indice, definicao) {
    const c = 'rituais.' + indice + '.formas.' + definicao.id;
    const total = '<p class="forma__total">' + (definicao.opcional ? 'Total: ' : 'Custo: ') +
      '<output data-saida="rituais.' + indice + '.formas.' + definicao.id + '.custo">0</output> PE' +
      (definicao.opcional ? '' : ' <span class="forma__base">(custo base do ritual)</span>') + '</p>';
    if (!definicao.opcional) return total;
    return '' +
      '<div class="campos-linha forma__custos">' +
        '<div class="ataque__campo ataque__campo--custo"><span class="ataque__rotulo">+PE</span>' +
          htmlPasso({ id: 'rit-' + indice + '-' + definicao.id + '-adicional', caminho: c + '.custoAdicional', descricao: 'acréscimo de PE da forma ' + definicao.nome, minimo: 0, teclado: 'numeric' }) +
        '</div>' +
        htmlCampoAtaque('requer-circulo', 'Requer círculo',
          '<select class="controle" data-campo="' + c + '.requerCirculo" data-tipo="inteiro" data-requer-circulo' +
            ' title="Círculo exigido pela forma. Ao trocar, o +PE é sugerido (custo do círculo − custo base).">' + htmlOpcoesCirculo() + '</select>') +
        '<label class="caixa caixa--pequena forma__afinidade"><input type="checkbox" data-campo="' + c + '.requerAfinidade" data-tipo="booleano">' +
          '<span>Requer afinidade</span></label>' +
        total +
      '</div>';
  }

  /** Uma forma de conjuração (Padrão, Discente ou Verdadeira): HTML FIXO, o id entra depois. */
  function htmlForma(indice, definicao) {
    const c = 'rituais.' + indice + '.formas.' + definicao.id;
    const nome = escaparHtml(definicao.nome);
    const cabecalho = definicao.opcional
      ? '<span class="forma__nome">' + nome + '</span>' +
        '<label class="caixa caixa--pequena"><input type="checkbox" data-campo="' + c + '.ativa" data-tipo="booleano"><span>ativa</span></label>'
      : '<span class="forma__nome">' + nome + '</span><span class="forma__sempre">sempre disponível</span>';
    return '' +
      '<div class="forma" data-forma="' + definicao.id + '">' +
        '<div class="forma__cabecalho">' + cabecalho + '</div>' +
        '<div class="forma__corpo">' +
          htmlCustoForma(indice, definicao) +
          '<ul class="forma__avisos" data-avisos-forma hidden></ul>' +
          '<div class="campos-linha">' +
            htmlCampoAtaque('dano', 'Dano',
              '<input type="text" class="controle forma__dano" placeholder="ex.: 2d6+3" spellcheck="false" autocomplete="off"' +
                ' data-campo="' + c + '.dano" data-tipo="texto">' +
              '<span class="ataque__erro" data-erro-dano hidden></span>') +
          '</div>' +
          htmlCampoAtaque('efeito', 'Efeito',
            '<textarea class="controle" rows="2" placeholder="O que esta forma faz" data-campo="' + c + '.efeito" data-tipo="texto"></textarea>') +
          '<div class="forma__acoes">' +
            '<button type="button" class="botao-rolagem botao-rolagem--conjurar" data-conjurar data-forma="' + definicao.id + '">' +
              '<span data-texto-conjurar>Conjurar</span></button>' +
            '<button type="button" class="botao-rolagem botao-rolagem--dano" data-rolar-dano-ritual data-forma="' + definicao.id + '" hidden>' +
              ICONE_DADO + '<span>Rolar dano</span></button>' +
          '</div>' +
          '<p class="mensagem-acao" data-mensagem-forma role="status" aria-live="polite" hidden></p>' +
        '</div>' +
      '</div>';
  }

  /** HTML FIXO de um ritual (o id entra depois, por criarComIds). */
  function htmlRitual(indice) {
    const c = 'rituais.' + indice;
    return '' +
      '<article class="ritual" role="listitem" data-ritual>' +
        '<div class="ritual__cabecalho">' +
          htmlCampoAtaque('nome', 'Nome',
            '<input type="text" class="controle ritual__nome" placeholder="Nome do ritual" autocomplete="off" data-campo="' + c + '.nome" data-tipo="texto">') +
          htmlCampoAtaque('circulo', 'Círculo',
            '<select class="controle" data-campo="' + c + '.circulo" data-tipo="inteiro">' + htmlOpcoesCirculo() + '</select>') +
          // Vazio = automático pelo círculo (o placeholder mostra o valor)
          htmlCampoAtaque('custo-base', 'Custo base (PE)',
            '<input type="number" min="0" step="1" inputmode="numeric" class="controle controle--numero" data-campo="' + c + '.custoBase"' +
              ' data-tipo="inteiroOpcional" data-custo-base title="Deixe vazio para usar o custo do círculo">') +
          htmlCampoAtaque('elemento', 'Elemento',
            '<select class="controle" data-campo="' + c + '.elemento" data-tipo="texto">' + htmlOpcoesLista(OP.calc.elementosRitual(), '—') + '</select>') +
          '<div class="ataque__acoes">' +
            '<button type="button" class="botao-rolagem botao-rolagem--secundario" data-rolar-pericia="ocultismo" title="Rola Ocultismo no painel de rolagens">' +
              ICONE_DADO + '<span>Ocultismo</span></button>' +
            '<button type="button" class="botao-icone botao-icone--perigo" data-remover-ritual title="Remover ritual">' +
              ICONES_ITEM.remover + '<span class="visualmente-oculto">Remover ritual</span></button>' +
          '</div>' +
        '</div>' +
        // "Resistência: Vontade (Parcial), DT 14" (preenchido ao desenhar)
        '<p class="ritual__resistencia" data-resumo-resistencia hidden></p>' +
        '<p class="ritual__aviso" data-aviso-circulo hidden></p>' +
        '<p class="ritual__medo" data-aviso-medo hidden></p>' +
        '<div class="ritual__detalhes">' +
          CAMPOS_RITUAL.map(function (campo) {
            const lista = campo[2] ? ' list="sugestoes-ritual-' + campo[2] + '"' : '';
            return htmlCampoAtaque(campo[0], campo[1],
              '<input type="text" class="controle" autocomplete="off"' + lista + ' data-campo="' + c + '.' + campo[0] + '" data-tipo="texto">');
          }).join('') +
        '</div>' +
        '<div class="campos-linha ritual__resistencia-campos">' +
          htmlCampoAtaque('teste-resistencia', 'Teste de resistência',
            '<select class="controle" data-campo="' + c + '.resistencia.teste" data-tipo="texto" data-teste-resistencia>' +
              htmlOpcoesLista(OP.data.resistencia.testes, 'Nenhum') + '</select>') +
          htmlCampoAtaque('efeito-resistencia', 'Se passar no teste',
            '<select class="controle" data-campo="' + c + '.resistencia.efeito" data-tipo="texto" data-efeito-resistencia>' +
              htmlOpcoesEfeito() + '</select>') +
          htmlCampoAtaque('notas-resistencia', 'Notas da resistência',
            '<input type="text" class="controle" autocomplete="off" data-campo="' + c + '.resistenciaNotas" data-tipo="texto">') +
        '</div>' +
        htmlCampoAtaque('notas', 'Notas',
          '<input type="text" class="controle" autocomplete="off" data-campo="' + c + '.notas" data-tipo="texto">') +
        '<div class="ritual__formas">' +
          OP.data.formasRitual.map(function (definicao) { return htmlForma(indice, definicao); }).join('') +
        '</div>' +
      '</article>';
  }

  function htmlGrupoRitual(circulo) {
    return '' +
      '<details class="grupo-ritual" open data-grupo-circulo="' + circulo + '">' +
        '<summary>' +
          '<span class="grupo-ritual__titulo">' + ordinal(circulo) + ' círculo</span>' +
          '<span class="grupo-ritual__contagem" data-contagem-grupo></span>' +
          '<span class="grupo-ritual__bloqueado" data-bloqueado-grupo hidden>ainda não liberado pelo NEX</span>' +
        '</summary>' +
        '<div class="grupo-ritual__lista" role="list" data-lista-grupo></div>' +
        '<p class="grupo-ritual__vazio" data-vazio-grupo>Nenhum ritual neste círculo.</p>' +
      '</details>';
  }

  function montarRituais() {
    refs.gruposRituaisRaiz = document.getElementById('grupos-rituais');
    refs.gruposRituaisRaiz.innerHTML = OP.data.circulosRitual.map(htmlGrupoRitual).join('');
    refs.gruposRituais = {};
    selecionarTodos('[data-grupo-circulo]', refs.gruposRituaisRaiz).forEach(function (grupo) {
      refs.gruposRituais[grupo.dataset.grupoCirculo] = {
        grupo: grupo,
        lista: grupo.querySelector('[data-lista-grupo]'),
        contagem: grupo.querySelector('[data-contagem-grupo]'),
        bloqueado: grupo.querySelector('[data-bloqueado-grupo]'),
        vazio: grupo.querySelector('[data-vazio-grupo]')
      };
    });

    // Elemento conectado: só os elementos possíveis (não existe afinidade com Medo).
    // O filtro e o elemento do ritual listam todos, inclusive Medo.
    refs.selectAfinidade = document.getElementById('afinidade');
    refs.selectAfinidade.innerHTML = htmlOpcoesLista(OP.calc.elementosAfinidade(), 'Nenhum');
    refs.caixaAfinidade = document.getElementById('afinidade-desenvolvida');
    document.getElementById('filtro-elemento').innerHTML = htmlOpcoesLista(OP.calc.elementosRitual(), 'Todos');

    // Sugestões dos campos de texto dos rituais (<datalist>, dados de OP.data)
    const sugestoes = document.getElementById('sugestoes-ritual');
    Object.keys(OP.data.rituaisCampos).forEach(function (campo) {
      const lista = document.createElement('datalist');
      lista.id = 'sugestoes-ritual-' + campo;
      OP.data.rituaisCampos[campo].forEach(function (valor) {
        const opcao = document.createElement('option');
        opcao.value = valor;
        lista.appendChild(opcao);
      });
      sugestoes.appendChild(lista);
    });

    refs.composicaoDt = document.getElementById('composicao-dt');
    refs.dicaAfinidade = document.getElementById('dica-afinidade');
    refs.beneficiosAfinidade = document.getElementById('beneficios-afinidade');
    refs.textoCirculos = document.getElementById('texto-circulos');
    refs.painelTurno = document.getElementById('painel-turno');
    refs.avisoLimitePE = document.getElementById('aviso-limite-pe');
    refs.rituaisVazio = document.getElementById('rituais-vazio');
    refs.buscaRituais = document.getElementById('busca-rituais');
    refs.filtroElemento = document.getElementById('filtro-elemento');
    refs.rituaisRenderizados = null;
    refs.elementosRituais = Object.create(null);
  }

  /**
   * Recria os cartões quando a lista muda ou um ritual troca de círculo
   * (o cartão muda de grupo). O foco volta ao mesmo campo depois.
   */
  function sincronizarRituais(ficha) {
    const assinatura = ficha.rituais.map(function (r) { return r.id + ':' + r.circulo; }).join('|');
    if (assinatura === refs.rituaisRenderizados) return;
    refs.rituaisRenderizados = assinatura;

    const ativo = document.activeElement;
    const campoFocado = ativo && refs.gruposRituaisRaiz.contains(ativo) && ativo.dataset ? ativo.dataset.campo : null;

    const porCirculo = Object.create(null);
    OP.data.circulosRitual.forEach(function (circulo) { porCirculo[circulo] = []; });
    ficha.rituais.forEach(function (ritual, indice) {
      const circulo = porCirculo[ritual.circulo] ? ritual.circulo : OP.data.circulosRitual[0];
      porCirculo[circulo].push(criarComIds(htmlRitual(indice), ritual.id, IDS_RITUAL));
    });
    OP.data.circulosRitual.forEach(function (circulo) {
      substituirFilhos(refs.gruposRituais[circulo].lista, porCirculo[circulo]);
    });

    refs.elementosRituais = Object.create(null);
    selecionarTodos('[data-ritual]', refs.gruposRituaisRaiz).forEach(function (cartao) {
      const formas = {};
      selecionarTodos('[data-forma]', cartao).forEach(function (bloco) {
        if (!bloco.classList.contains('forma')) return;
        formas[bloco.dataset.forma] = {
          bloco: bloco,
          dano: bloco.querySelector('.forma__dano'),
          erro: bloco.querySelector('[data-erro-dano]'),
          avisos: bloco.querySelector('[data-avisos-forma]'),
          textoConjurar: bloco.querySelector('[data-texto-conjurar]'),
          botaoDano: bloco.querySelector('[data-rolar-dano-ritual]'),
          mensagem: bloco.querySelector('[data-mensagem-forma]')
        };
      });
      refs.elementosRituais[cartao.dataset.ritual] = {
        cartao: cartao,
        nome: cartao.querySelector('.ritual__nome'),
        custoBase: cartao.querySelector('[data-custo-base]'),
        aviso: cartao.querySelector('[data-aviso-circulo]'),
        avisoMedo: cartao.querySelector('[data-aviso-medo]'),
        resumoResistencia: cartao.querySelector('[data-resumo-resistencia]'),
        efeito: cartao.querySelector('[data-efeito-resistencia]'),
        formas: formas
      };
    });
    coletarLigacoes();

    if (campoFocado) {
      const campo = refs.gruposRituaisRaiz.querySelector('[data-campo="' + campoFocado + '"]');
      if (campo) campo.focus();
    }
  }

  function desenharTopoRituais(conj) {
    const p = conj.dt.partes;
    definirTexto(refs.composicaoDt, p.base +
      (conj.dt.somaLimitePE ? parteComSinal('limite de PE', p.limitePE) : '') +
      parteComSinal(siglaAtributo(conj.dt.idAtributo), p.atributo) +
      parteComSinal('bônus', p.bonus));
    definirTexto(refs.textoCirculos, conj.circulosLiberados ? 'até o ' + ordinal(conj.circulosLiberados) : 'nenhum');

    // Elemento conectado (NEX 50%) e afinidade (só depois de transcender, com elemento conectado)
    refs.selectAfinidade.disabled = !conj.afinidadeLiberada;
    refs.caixaAfinidade.disabled = !conj.elementoConectado;
    const elemento = nomeNaLista(OP.data.elementos, conj.elementoConectado);
    let dica;
    if (!conj.afinidadeLiberada && !elemento) dica = 'A conexão com um elemento vem no NEX ' + conj.nexAfinidade + '%.';
    else if (!elemento) dica = 'Escolha o elemento com que o personagem se conectou.';
    else if (!conj.afinidadeDesenvolvida) dica = 'Conectado a ' + elemento + '. A afinidade se desenvolve na primeira vez que ele transcender.';
    else dica = 'Afinidade com ' + elemento + '.';
    definirTexto(refs.dicaAfinidade, dica + ' Não existe afinidade com Medo.');
    refs.beneficiosAfinidade.classList.toggle('painel__info--destaque', conj.afinidadeDesenvolvida);

    refs.painelTurno.classList.toggle('painel--passou', conj.passouLimite);
    if (refs.avisoLimitePE.hidden === conj.passouLimite) refs.avisoLimitePE.hidden = !conj.passouLimite;
  }

  function desenharRituais(ficha, derivados) {
    const conj = derivados.conjuracao;
    desenharTopoRituais(conj);

    const termo = normalizarBusca(filtrosRituais.busca);
    const visiveisPorCirculo = {};
    OP.data.circulosRitual.forEach(function (circulo) { visiveisPorCirculo[circulo] = 0; });

    ficha.rituais.forEach(function (ritual, indice) {
      const el = refs.elementosRituais[ritual.id];
      const estado = derivados.rituais[indice];
      if (!el || !estado) return;

      const elemento = ritual.elemento || 'nenhum';
      if (el.cartao.dataset.elemento !== elemento) el.cartao.dataset.elemento = elemento;

      // Aviso (não bloqueia) quando o círculo passa do que o NEX libera
      el.cartao.classList.toggle('ritual--alem', estado.alemDoCirculo);
      if (el.aviso.hidden === estado.alemDoCirculo) el.aviso.hidden = !estado.alemDoCirculo;
      definirTexto(el.aviso, estado.alemDoCirculo
        ? 'O ' + ordinal(ritual.circulo) + ' círculo ainda não está liberado pelo NEX (liberado: ' +
          (conj.circulosLiberados ? 'até o ' + ordinal(conj.circulosLiberados) : 'nenhum') + '). Dá para cadastrar e conjurar mesmo assim.'
        : '');

      // Resistência: "Resistência: Vontade (Parcial), DT 14"
      const resistencia = estado.resistencia;
      if (el.resumoResistencia.hidden === Boolean(resistencia)) el.resumoResistencia.hidden = !resistencia;
      definirTexto(el.resumoResistencia, resistencia
        ? 'Resistência: ' + resistencia.nomeTeste + (resistencia.nomeEfeito ? ' (' + resistencia.nomeEfeito + ')' : '') + ', DT ' + resistencia.dt
        : '');
      el.resumoResistencia.title = resistencia ? resistencia.resumoEfeito : '';
      const semTeste = !resistencia;
      if (el.efeito.disabled !== semTeste) el.efeito.disabled = semTeste;
      const dicaEfeito = semTeste ? 'Escolha um teste de resistência primeiro.' : (resistencia.resumoEfeito || 'O que acontece com quem passa no teste.');
      if (el.efeito.title !== dicaEfeito) el.efeito.title = dicaEfeito;

      // Ritual de Medo: custa Sanidade (só um lembrete; a confirmação vem ao conjurar)
      if (el.avisoMedo.hidden === estado.medo) el.avisoMedo.hidden = !estado.medo;
      definirTexto(el.avisoMedo, estado.medo ? textoAvisoMedo() : '');

      // Custo base: vazio = automático pelo círculo
      const dicaBase = 'auto: ' + estado.custoBaseAuto;
      if (el.custoBase.placeholder !== dicaBase) el.custoBase.placeholder = dicaBase;

      OP.data.formasRitual.forEach(function (definicao) {
        const forma = el.formas[definicao.id];
        const info = estado.formas[definicao.id];
        if (!forma || !info) return;
        const ativa = info.ativa ? 'sim' : 'nao';
        if (forma.bloco.dataset.ativa !== ativa) forma.bloco.dataset.ativa = ativa;
        // Avisos da forma (círculo exigido / afinidade): não bloqueiam
        desenharListaTextos(forma.avisos, info.avisos.map(function (aviso) { return aviso.texto; }));
        if (forma.avisos.hidden === (info.avisos.length > 0)) forma.avisos.hidden = info.avisos.length === 0;
        const invalido = info.temDano && !info.danoValido;
        forma.dano.classList.toggle('controle--invalido', invalido);
        forma.dano.setAttribute('aria-invalid', String(invalido));
        if (forma.erro.hidden === invalido) forma.erro.hidden = !invalido;
        definirTexto(forma.erro, info.danoErro);
        if (forma.botaoDano.hidden === info.danoValido) forma.botaoDano.hidden = !info.danoValido;
        // Medo: a Sanidade aparece no botão; a perda permanente fica no lembrete do cartão.
        definirTexto(forma.textoConjurar, 'Conjurar · ' + (info.custo > 0 ? info.custo + ' PE' : 'sem custo') +
          (info.san ? ' · ' + info.san + ' SAN' : ''));
      });

      const casaElemento = !filtrosRituais.elemento || ritual.elemento === filtrosRituais.elemento;
      const casaBusca = !termo || normalizarBusca(ritual.nome).indexOf(termo) !== -1;
      const visivel = casaElemento && casaBusca;
      if (el.cartao.hidden === visivel) el.cartao.hidden = !visivel;
      if (visivel && visiveisPorCirculo[ritual.circulo] !== undefined) visiveisPorCirculo[ritual.circulo]++;
    });

    OP.data.circulosRitual.forEach(function (circulo) {
      const grupo = refs.gruposRituais[circulo];
      const quantidade = visiveisPorCirculo[circulo];
      definirTexto(grupo.contagem, quantidade ? '(' + quantidade + ')' : '');
      const bloqueado = circulo > conj.circulosLiberados;
      if (grupo.bloqueado.hidden === bloqueado) grupo.bloqueado.hidden = !bloqueado;
      if (grupo.vazio.hidden === (quantidade === 0)) grupo.vazio.hidden = quantidade > 0;
      grupo.grupo.classList.toggle('grupo-ritual--vazio', quantidade === 0); // a impressão esconde
    });
    refs.rituaisVazio.hidden = ficha.rituais.length > 0;
  }

  /** "Ritual de Medo: ao conjurar, perde Sanidade igual ao custo em PE e Sanidade permanente (Padrão 1, …)." */
  function textoAvisoMedo() {
    const regra = OP.data.config.medo;
    const perdas = OP.data.formasRitual.map(function (forma) {
      return forma.nome + ' ' + OP.calc.numero(regra.perdaPermanente[forma.id]);
    }).join(', ');
    return 'Ritual de Medo: ao conjurar, ' + (regra.sanPorCusto ? 'perde Sanidade igual ao custo em PE e ' : '') +
      'perde Sanidade permanente (' + perdas + '), que reduz o máximo.';
  }

  /**
   * Ao trocar o círculo exigido por uma forma: se o "+PE" ainda é 0 ou o
   * sugerido para o círculo anterior, troca pelo sugerido do novo
   * (custo do círculo − custo base; ex.: ritual de 1º que requer o 2º → +2).
   */
  function enviarRequerCirculo(campo) {
    const anterior = OP.state.obter(campo.dataset.campo);
    enviarCampo(campo);
    const partes = campo.dataset.campo.split('.'); // rituais.<i>.formas.<forma>.requerCirculo
    const ritual = OP.state.ficha.rituais[Number(partes[1])];
    const forma = ritual && ritual.formas[partes[3]];
    if (!forma || forma.requerCirculo === anterior) return;
    const atual = OP.calc.numero(forma.custoAdicional);
    if (atual === 0 || atual === OP.calc.custoAdicionalSugerido(ritual, anterior)) {
      OP.state.atualizar(partes.slice(0, 4).join('.') + '.custoAdicional', OP.calc.custoAdicionalSugerido(ritual, forma.requerCirculo));
    }
  }

  /**
   * Ritual novo: 1º círculo, custo base automático e foco no nome. Discente e
   * Verdadeira já vêm com o círculo exigido e o "+PE" sugeridos (state).
   */
  function adicionarRitual() {
    filtrosRituais.busca = '';
    refs.buscaRituais.value = '';
    const circulo = OP.data.circulosRitual[0];
    const novo = OP.state.novoRitual({
      circulo: circulo,
      elemento: filtrosRituais.elemento || ''
    });
    const grupo = refs.gruposRituais[circulo];
    if (grupo) grupo.grupo.open = true;
    OP.state.atualizar('rituais', OP.state.obter('rituais').concat([novo]));
    const el = refs.elementosRituais[novo.id];
    if (el) el.nome.focus();
  }

  function acharRitual(id) {
    return OP.state.ficha.rituais.find(function (r) { return r.id === id; }) || null;
  }

  /** Conjura de fato (o estado aplica tudo de uma vez) e mostra a mensagem na forma. */
  function executarConjuracao(idRitual, idForma) {
    const ritual = acharRitual(idRitual);
    if (!ritual) return;
    const resultado = OP.rolagens.conjurarRitual(OP.state.ficha, ritual, idForma);
    const el = refs.elementosRituais[idRitual];
    const forma = el && el.formas[idForma];
    mostrarMensagem(forma && forma.mensagem, mensagemGasto(resultado, 'Conjurado', resultado.ok ? resultado.dt : undefined));
  }

  /**
   * Conjurar: pede confirmação nos rituais de Medo (mostra PE, Sanidade e
   * perda permanente) e quando a forma tem avisos (círculo exigido acima do
   * liberado, afinidade que falta). Os avisos não bloqueiam. Sem PE
   * suficiente, nada muda e só aparece a mensagem.
   */
  function conjurarNaTela(idRitual, idForma) {
    const ritual = acharRitual(idRitual);
    if (!ritual) return;
    const plano = OP.calc.planoConjuracao(OP.state.ficha, ritual, idForma);
    const avisos = (plano.avisos || []).map(function (aviso) { return aviso.texto; });
    if (!plano.ok || (!plano.medo && !avisos.length)) {
      executarConjuracao(idRitual, idForma);
      return;
    }
    const nomeForma = nomeNaLista(OP.data.formasRitual, idForma) || idForma;
    const itens = ['PE: ' + plano.peAtual + ' → ' + plano.peDepois];
    if (plano.medo && plano.sanAtual !== null) itens.push('Sanidade: ' + plano.sanAtual + ' → ' + plano.sanDepois);
    if (plano.medo && plano.sanMaxDepois !== null) itens.push('Sanidade máxima: ' + (plano.sanMaxDepois + plano.permanente) + ' → ' + plano.sanMaxDepois);
    confirmar({
      titulo: plano.medo ? 'Conjurar ritual de Medo' : 'Conjurar mesmo assim?',
      texto: plano.medo
        ? 'Ritual de Medo (' + nomeForma + '): −' + plano.pe + ' PE, −' + plano.san + ' Sanidade, −' + plano.permanente + ' Sanidade permanente.'
        : 'Forma ' + nomeForma + ': −' + plano.pe + ' PE. Confira os avisos abaixo (eles não impedem a conjuração).',
      itens: itens,
      avisos: avisos,
      destaque: plano.sanZera ? 'Atenção: a Sanidade vai chegar a 0.' : '',
      textoConfirmar: 'Confirmar',
      aoConfirmar: function () { executarConjuracao(idRitual, idForma); }
    });
  }

  /* ------------------------------------------------------------------------
     Confirmação (<dialog>, nunca window.confirm)
     ------------------------------------------------------------------------ */

  let confirmacaoPendente = null;

  function montarConfirmacao() {
    refs.dialogoConfirmar = document.getElementById('dialogo-confirmar');
    refs.confirmarTitulo = document.getElementById('confirmar-titulo');
    refs.confirmarTexto = document.getElementById('confirmar-texto');
    refs.confirmarItens = document.getElementById('confirmar-itens');
    refs.confirmarAvisos = document.getElementById('confirmar-avisos');
    refs.confirmarDestaque = document.getElementById('confirmar-destaque');
    refs.confirmarOk = document.getElementById('confirmar-ok');

    refs.dialogoConfirmar.addEventListener('close', function () {
      const opcoes = confirmacaoPendente;
      confirmacaoPendente = null;
      if (!opcoes) return;
      if (refs.dialogoConfirmar.returnValue === 'confirmar') {
        if (opcoes.aoConfirmar) opcoes.aoConfirmar();
      } else if (opcoes.aoCancelar) {
        opcoes.aoCancelar();
      }
    });
  }

  /** Mostra (ou esconde, se vazia) uma lista de textos dentro da confirmação. */
  function preencherListaConfirmacao(lista, textos) {
    const itens = Array.isArray(textos) ? textos : [];
    substituirFilhos(lista, itens.map(function (texto) { return criarElemento('li', '', texto); }));
    lista.hidden = itens.length === 0;
  }

  /**
   * Abre a janela de confirmação. Todos os textos entram por textContent.
   * opcoes: { titulo, texto, itens: [texto], avisos: [texto], destaque,
   *           textoConfirmar, perigo, aoConfirmar, aoCancelar }
   * Devolve false se não deu para abrir (outra confirmação aberta).
   */
  function confirmar(opcoes) {
    const dialogo = refs.dialogoConfirmar;
    if (!dialogo || typeof dialogo.showModal !== 'function' || dialogo.open) return false;
    const o = opcoes || {};
    definirTexto(refs.confirmarTitulo, o.titulo || 'Confirmar');
    definirTexto(refs.confirmarTexto, o.texto || '');
    refs.confirmarTexto.hidden = !o.texto;
    preencherListaConfirmacao(refs.confirmarItens, o.itens);
    preencherListaConfirmacao(refs.confirmarAvisos, o.avisos);
    definirTexto(refs.confirmarDestaque, o.destaque || '');
    refs.confirmarDestaque.hidden = !o.destaque;
    definirTexto(refs.confirmarOk, o.textoConfirmar || 'Confirmar');
    refs.confirmarOk.classList.toggle('botao-barra--perigo', o.perigo === true);
    confirmacaoPendente = o;
    dialogo.returnValue = '';
    dialogo.showModal();
    return true;
  }

  /* ------------------------------------------------------------------------
     Impressão: abre o que está recolhido e mostra todo o texto (e desfaz depois)
     ------------------------------------------------------------------------ */

  const impressao = { ativa: false };

  /** Mostra tudo nas listas: sem filtros, descrições e habilidades abertas. */
  function redesenharListas() {
    const ficha = OP.state.ficha;
    if (!ficha || !refs.derivados) return;
    aplicarFiltros(refs.derivados);
    desenharItens(ficha);
    desenharHabilidades(ficha);
    desenharRituais(ficha, refs.derivados);
  }

  function prepararImpressao() {
    const ficha = OP.state.ficha;
    if (impressao.ativa || !ficha || !refs.derivados) return;
    impressao.ativa = true;

    // Guarda o estado da tela para restaurar depois
    impressao.descricoes = refs.descricoesAbertas;
    impressao.habilidades = refs.habilidadesAbertas;
    impressao.filtros = {
      pericias: Object.assign({}, filtros),
      habilidades: Object.assign({}, filtrosHabilidades),
      rituais: Object.assign({}, filtrosRituais)
    };

    // Tudo visível: sem filtros, linhas expansíveis abertas
    Object.assign(filtros, { busca: '', soTreinadas: false });
    Object.assign(filtrosHabilidades, { fonte: 'todas', busca: '' });
    Object.assign(filtrosRituais, { elemento: '', busca: '' });
    refs.descricoesAbertas = Object.create(null);
    refs.habilidadesAbertas = Object.create(null);
    ficha.inventario.itens.forEach(function (item) { refs.descricoesAbertas[item.id] = true; });
    ficha.habilidades.forEach(function (habilidade) { refs.habilidadesAbertas[habilidade.id] = true; });
    redesenharListas();

    impressao.detalhes = selecionarTodos('details', refs.raiz).filter(function (d) { return !d.open; });
    impressao.detalhes.forEach(function (d) { d.open = true; });

    // Campos vazios somem do papel; resistências 0 também
    impressao.vazios = [];
    function marcarVazio(elemento) {
      if (elemento && !elemento.classList.contains('impressao-vazio')) {
        elemento.classList.add('impressao-vazio');
        impressao.vazios.push(elemento);
      }
    }
    selecionarTodos('.resistencia', refs.raiz).forEach(function (rotulo) {
      const campo = rotulo.querySelector('input');
      if (!campo || OP.calc.numero(campo.value) === 0) marcarVazio(rotulo);
    });
    selecionarTodos('.resistencias__grupo', refs.raiz).forEach(function (grupo) {
      if (!grupo.querySelector('.resistencia:not(.impressao-vazio)')) marcarVazio(grupo);
    });
    if (!refs.raiz.querySelector('.resistencias .resistencia:not(.impressao-vazio)')) marcarVazio(refs.raiz.querySelector('.resistencias'));
    // Nos cartões e painéis, campos de texto vazios não vão para o papel
    selecionarTodos('.ataque input[type="text"], .habilidade input[type="text"], .ritual input[type="text"], .painel input[type="text"]', refs.raiz).forEach(function (campo) {
      if (campo.value.trim() === '') marcarVazio(campo.closest('.ataque__campo, .campo-texto'));
    });
    // Nos ataques e rituais: seleção vazia (arma "Nenhuma", tipo "—"), bônus de dano 0 e munição não usada
    selecionarTodos('.ataque select, .ritual select', refs.raiz).forEach(function (campo) {
      if (campo.value === '') marcarVazio(campo.closest('.ataque__campo'));
    });
    selecionarTodos('.ataque [data-campo$=".danoBonus"]', refs.raiz).forEach(function (campo) {
      if (OP.calc.numero(campo.value) === 0) marcarVazio(campo.closest('.ataque__campo'));
    });
    selecionarTodos('.ataque [data-campo$=".usaMunicao"]', refs.raiz).forEach(function (campo) {
      if (!campo.checked) marcarVazio(campo.closest('.ataque__campo'));
    });

    // Campos de texto dos cartões com a largura do próprio texto (o print.css usa width: auto)
    impressao.tamanhos = selecionarTodos('.ataque input[type="text"], .ritual input[type="text"], .painel input[type="text"]', refs.raiz).map(function (campo) {
      const anterior = { campo: campo, size: campo.getAttribute('size') };
      campo.setAttribute('size', String(Math.max(3, campo.value.length + 2)));
      return anterior;
    });

    // Cada <textarea> do tamanho do texto (e as vazias somem)
    impressao.textareas = selecionarTodos('textarea', refs.raiz).map(function (campo) {
      const anterior = { campo: campo, altura: campo.style.height };
      if (campo.value.trim() === '') {
        marcarVazio(campo.closest('.ataque__campo, .item__descricao, .descricao__campo') || campo);
      } else {
        campo.style.height = 'auto';
        campo.style.height = (campo.scrollHeight + 4) + 'px';
      }
      return anterior;
    });
  }

  function restaurarImpressao() {
    if (!impressao.ativa) return;
    impressao.ativa = false;
    refs.descricoesAbertas = impressao.descricoes;
    refs.habilidadesAbertas = impressao.habilidades;
    Object.assign(filtros, impressao.filtros.pericias);
    Object.assign(filtrosHabilidades, impressao.filtros.habilidades);
    Object.assign(filtrosRituais, impressao.filtros.rituais);
    impressao.detalhes.forEach(function (d) { d.open = false; });
    impressao.vazios.forEach(function (elemento) { elemento.classList.remove('impressao-vazio'); });
    impressao.textareas.forEach(function (anterior) { anterior.campo.style.height = anterior.altura; });
    impressao.tamanhos.forEach(function (anterior) {
      if (anterior.size === null) anterior.campo.removeAttribute('size');
      else anterior.campo.setAttribute('size', anterior.size);
    });
    redesenharListas();
  }

  function rolarDanoRitualNaTela(idRitual, idForma) {
    const ritual = acharRitual(idRitual);
    if (!ritual) return;
    mostrarResultado(OP.rolagens.rolarDanoRitual(OP.state.ficha, ritual, idForma));
  }

  /* ------------------------------------------------------------------------
     API pública
     ------------------------------------------------------------------------ */

  function montar() {
    refs.raiz = document.getElementById('ficha');
    refs.contador = document.getElementById('contador-pontos');
    refs.contadorRotulo = document.getElementById('contador-rotulo');
    refs.avisos = document.getElementById('avisos-atributos');
    refs.listaAvisos = document.getElementById('lista-avisos');
    refs.avisoSemClasse = document.getElementById('aviso-sem-classe');
    refs.contadorTreino = document.getElementById('contador-treinamento');
    refs.avisosPericias = document.getElementById('avisos-pericias');
    refs.textoAvisoPericias = document.getElementById('texto-aviso-pericias');
    refs.avisoPericiasSemClasse = document.getElementById('aviso-pericias-sem-classe');
    refs.composicaoTreino = document.getElementById('composicao-treinamento');
    refs.periciasVazio = document.getElementById('pericias-vazio');
    refs.buscaPericias = document.getElementById('busca-pericias');
    refs.filtroTreinadas = document.getElementById('filtro-treinadas');
    refs.composicaoDefesa = document.getElementById('composicao-defesa');
    refs.composicaoDeslocamento = document.getElementById('composicao-deslocamento');
    refs.textoQuadrados = document.getElementById('texto-quadrados');
    refs.contagemResistencias = document.getElementById('contagem-resistencias');
    refs.infoAumentos = document.getElementById('info-aumentos');
    refs.rotuloPassos = document.getElementById('rotulo-passos');
    refs.contadorGraus = document.getElementById('contador-graus');
    refs.avisosGraus = document.getElementById('avisos-graus');
    refs.listaAvisosGraus = document.getElementById('lista-avisos-graus');

    refs.nomesProtecoes = document.getElementById('nomes-protecoes');

    montarSelects();
    montarAtributos();
    montarRecursos();
    montarDefesa();
    montarPericias();
    montarAtaques();
    montarHabilidades();
    montarRituais();
    montarInventario();
    montarRolagens();
    montarConfirmacao();
    document.getElementById('nota-regras').textContent = textoRegras(OP.data.regrasAtributos);

    coletarLigacoes();
    ligarEventos();
    // Impressão (botão "Imprimir / PDF" ou Ctrl+P): abre tudo antes e desfaz depois.
    window.addEventListener('beforeprint', prepararImpressao);
    window.addEventListener('afterprint', restaurarImpressao);
  }

  /**
   * Guarda as listas de elementos ligados ao estado (campos, saídas, barras...).
   * Roda depois de gerar HTML: na montagem e quando a lista de itens muda.
   */
  function coletarLigacoes() {
    refs.campos = selecionarTodos('[data-campo]', refs.raiz);
    refs.saidas = selecionarTodos('[data-saida]', refs.raiz);
    refs.cartoes = selecionarTodos('[data-atributo]', refs.raiz);
    refs.limitesDinamicos = selecionarTodos('[data-max-saida]', refs.raiz);
    refs.barras = selecionarTodos('[data-largura]', refs.raiz);
    refs.alternadores = selecionarTodos('[data-alternar]', refs.raiz);
  }

  // Outras partes da tela (ex.: js/ui-classe.js) que entram no ciclo de desenho:
  // { sincronizar(ficha, derivados) antes de escrever os campos, desenhar(ficha, derivados) no fim }
  const extensoes = [];

  function registrarExtensao(extensao) {
    extensoes.push(extensao);
  }

  /** Desenha a ficha inteira a partir do estado e dos valores calculados. */
  function desenhar(ficha, derivados) {
    refs.derivados = derivados; // usado por data-reserva e pelos botões de passo

    sincronizarItens(ficha);   // recria as linhas de itens se a lista mudou
    sincronizarAtaques(ficha); // idem para os ataques
    sincronizarHabilidades(ficha);
    sincronizarRituais(ficha); // também quando um ritual muda de círculo
    extensoes.forEach(function (extensao) {
      if (extensao.sincronizar) extensao.sincronizar(ficha, derivados);
    });
    desenharLimites(derivados);
    refs.campos.forEach(function (campo) { escreverCampo(campo, false); });

    refs.saidas.forEach(function (saida) {
      const valor = OP.state.lerCaminho(derivados, saida.dataset.saida);
      definirTexto(saida, formatarSaida(valor, saida.dataset.formato));
    });

    desenharAlternadores();
    desenharDistribuicao(ficha, derivados.distribuicao);
    desenharBarras(derivados);
    desenharRecursos(derivados);
    desenharDefesa(derivados);
    desenharTreinamento(ficha, derivados.treinamento);
    desenharGraus(ficha, derivados.graus);
    desenharPericias(derivados);
    desenharInventario(ficha, derivados);
    desenharAtaques(ficha, derivados);
    desenharHabilidades(ficha);
    desenharRituais(ficha, derivados);
    desenharTitulo(ficha);
    extensoes.forEach(function (extensao) {
      if (extensao.desenhar) extensao.desenhar(ficha, derivados);
    });
  }

  OP.ui = {
    montar: montar,
    desenhar: desenhar,
    confirmar: confirmar,
    prepararImpressao: prepararImpressao,
    restaurarImpressao: restaurarImpressao,
    // Para as extensões da tela (js/ui-classe.js)
    registrarExtensao: registrarExtensao,
    coletarLigacoes: coletarLigacoes,
    criarElemento: criarElemento,
    substituirFilhos: substituirFilhos,
    desenharListaTextos: desenharListaTextos
  };
})(window.OP);
