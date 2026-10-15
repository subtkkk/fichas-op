/* ==========================================================================
   js/ui-classe.js — origem, classe, trilha e progressão
   --------------------------------------------------------------------------
   Entra no ciclo de desenho do js/ui.js (OP.ui.registrarExtensao):
   - sincronizar(): antes de o ui.js escrever os campos, recria o que
     depende da escolha (opções dos selects de origem/trilha/versatilidade,
     controles de escolha de perícias) e religa os campos (data-campo);
   - desenhar(): no fim, atualiza textos, a tabela de progressão e os
     contadores.
   O site só guarda nomes e números: "Adicionar às habilidades" cria a
   habilidade só com o nome (a descrição o usuário digita).
   Dados entram na página só por textContent, .value ou setAttribute.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const assinaturas = {};

  /* ------------------------------------------------------------------------
     Utilitários
     ------------------------------------------------------------------------ */

  function criar(tag, classe, texto) {
    return OP.ui.criarElemento(tag, classe, texto);
  }

  function opcao(valor, texto) {
    const elemento = document.createElement('option');
    elemento.value = valor;
    elemento.textContent = texto;
    return elemento;
  }

  function nomeFonte(id) {
    return Object.prototype.hasOwnProperty.call(OP.data.fontes, id) ? OP.data.fontes[id] : id;
  }

  function nomePericia(id) {
    const pericia = OP.data.pericias.find(function (p) { return p.id === id; });
    return pericia ? pericia.nome : id;
  }

  function nomesPericias(ids) {
    return ids.map(nomePericia).join(', ');
  }

  function semAcento(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  /** "NEX 10%" ou "Estágio 2". */
  function textoNivel(nivel, unidade, porNivel) {
    if (unidade === 'estagio') return 'Estágio ' + nivel;
    // NEX e Experiência: 1 nível = 5% de NEX (nível 20 = 99%)
    return porNivel ? 'Nível ' + OP.calc.nivelDoNex(nivel) + ' (equivale a NEX ' + nivel + '%)' : 'NEX ' + nivel + '%';
  }

  /** Linha "Rótulo: valor" de um painel. */
  function linhaInfo(rotulo, valor) {
    const linha = criar('p', 'identidade__info');
    linha.appendChild(criar('span', 'identidade__rotulo', rotulo + ': '));
    linha.appendChild(document.createTextNode(valor));
    return linha;
  }

  /** A ficha já tem uma habilidade com este nome e esta fonte? */
  function habilidadeExiste(ficha, nome, fonte) {
    const alvo = semAcento(nome);
    return ficha.habilidades.some(function (h) { return h.fonte === fonte && semAcento(h.nome) === alvo; });
  }

  /** Botão "Adicionar às habilidades" (ou "Nas habilidades" se já existir). */
  function botaoAdicionar(ficha, nome, fonte) {
    const existe = habilidadeExiste(ficha, nome, fonte);
    const botao = criar('button', 'botao-barra botao-barra--pequeno identidade__adicionar', existe ? 'Nas habilidades ✓' : 'Adicionar às habilidades');
    botao.type = 'button';
    botao.setAttribute('data-adicionar-habilidade', nome);
    botao.setAttribute('data-fonte-habilidade', fonte);
    botao.setAttribute('aria-label', existe ? nome + ' já está nas habilidades' : 'Adicionar ' + nome + ' às habilidades');
    botao.disabled = existe;
    return botao;
  }

  /** Assinatura das habilidades (para saber quando os botões mudam). */
  function assinaturaHabilidades(ficha) {
    return ficha.habilidades.map(function (h) { return h.fonte + ':' + semAcento(h.nome); }).join('|');
  }

  /**
   * Recria o conteúdo de um contêiner, devolvendo o foco ao campo que o
   * tinha (pelo data-campo), e religa os campos ao ciclo do ui.js.
   */
  function recriar(conteiner, filhos) {
    const ativo = document.activeElement;
    const campoFocado = ativo && conteiner.contains(ativo) && ativo.getAttribute ? ativo.getAttribute('data-campo') : null;
    OP.ui.substituirFilhos(conteiner, filhos);
    if (campoFocado) {
      const campo = selecionarPorCampo(conteiner, campoFocado);
      if (campo) campo.focus();
    }
    return true;
  }

  function selecionarPorCampo(raiz, caminho) {
    const campos = raiz.querySelectorAll('[data-campo]');
    for (let i = 0; i < campos.length; i++) {
      if (campos[i].getAttribute('data-campo') === caminho) return campos[i];
    }
    return null;
  }

  function mostrarMensagem(tipo, texto) {
    refs.mensagem.hidden = !texto;
    refs.mensagem.dataset.tipo = tipo;
    refs.mensagem.textContent = tipo === 'aviso' && texto && !/^aviso:/i.test(texto) ? 'Aviso: ' + texto : texto;
  }

  /* ------------------------------------------------------------------------
     Opções dos selects (agrupadas por fonte, filtradas pelas fontes ativas)
     ------------------------------------------------------------------------ */

  /**
   * <optgroup> por fonte (na ordem de data/fontes.js). Fontes desligadas
   * somem, mas a opção escolhida sempre aparece.
   */
  function opcoesAgrupadas(lista, escolhido, ativas) {
    const ordem = Object.keys(OP.data.fontes);
    lista.forEach(function (item) {
      if (ordem.indexOf(item.fonte) === -1) ordem.push(item.fonte);
    });
    const grupos = [];
    ordem.forEach(function (fonte) {
      const itens = lista.filter(function (item) {
        return item.fonte === fonte && (ativas[fonte] !== false || item.id === escolhido);
      });
      if (!itens.length) return;
      const grupo = document.createElement('optgroup');
      grupo.label = nomeFonte(fonte);
      itens.forEach(function (item) { grupo.appendChild(opcao(item.id, item.nome)); });
      grupos.push(grupo);
    });
    return grupos;
  }

  /** Recria as opções de origem, trilha e versatilidade quando algo que as afeta muda. */
  function sincronizarSelects(ficha) {
    const ativas = OP.prefs.fontesAtivas();
    const chaveFontes = JSON.stringify(ativas);
    const ident = ficha.identificacao;
    let mudou = false;

    const chaveOrigem = chaveFontes + '|' + ident.origem;
    if (chaveOrigem !== assinaturas.origens) {
      assinaturas.origens = chaveOrigem;
      OP.ui.substituirFilhos(refs.selectOrigem, [opcao('', '— Escolha —')]
        .concat(opcoesAgrupadas(OP.data.origens, ident.origem, ativas), [opcao('outra', 'Outra (texto livre)')]));
      mudou = true;
    }

    const chaveTrilha = chaveFontes + '|' + ident.classe + '|' + ident.trilha;
    if (chaveTrilha !== assinaturas.trilhas) {
      assinaturas.trilhas = chaveTrilha;
      const trilhas = OP.calc.trilhasDaClasse(ident.classe);
      OP.ui.substituirFilhos(refs.selectTrilha, [opcao('', ident.classe ? '— Escolha —' : '— Escolha a classe —')]
        .concat(opcoesAgrupadas(trilhas, ident.trilha, ativas), [opcao('outra', 'Outra (texto livre)')]));
      mudou = true;
    }
    return mudou;
  }

  /* ------------------------------------------------------------------------
     Painéis: origem, classe e trilha
     ------------------------------------------------------------------------ */

  /** Controles da escolha de perícias da origem (livre, conjunto ou elemento). */
  function controlesEscolhaOrigem(origem, identidade) {
    const escolha = origem.escolha;
    const caixa = criar('div', 'identidade__escolha');
    caixa.appendChild(criar('p', 'identidade__nota', escolha.nota || 'Escolha de perícias'));
    const base = 'identificacao.escolhas.origem.';

    if (escolha.tipo === 'livre') {
      for (let i = 0; i < Math.max(0, Math.trunc(OP.calc.numero(escolha.qtd))); i++) {
        const rotulo = criar('label', 'identidade__campo');
        rotulo.appendChild(criar('span', 'identidade__rotulo', 'Perícia ' + (i + 1)));
        const select = criar('select', 'controle');
        select.setAttribute('data-campo', base + 'livres.' + i);
        select.setAttribute('data-tipo', 'texto');
        select.setAttribute('data-padrao', '');
        select.appendChild(opcao('', '— escolha —'));
        identidade.periciasLivres.forEach(function (id) { select.appendChild(opcao(id, nomePericia(id))); });
        rotulo.appendChild(select);
        caixa.appendChild(rotulo);
      }
    } else if (escolha.tipo === 'conjunto') {
      const grupo = criar('div', 'identidade__opcoes');
      grupo.setAttribute('role', 'radiogroup');
      grupo.setAttribute('aria-label', escolha.nota || 'Perícias da origem');
      escolha.opcoes.forEach(function (par, indice) {
        const rotulo = criar('label', 'caixa caixa--pequena');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'origem-conjunto';
        radio.value = String(indice);
        radio.setAttribute('data-campo', base + 'conjunto');
        radio.setAttribute('data-tipo', 'opcao');
        rotulo.appendChild(radio);
        rotulo.appendChild(criar('span', '', nomesPericias(par)));
        grupo.appendChild(rotulo);
      });
      caixa.appendChild(grupo);
    } else if (escolha.tipo === 'elemento') {
      const rotulo = criar('label', 'identidade__campo');
      rotulo.appendChild(criar('span', 'identidade__rotulo', 'Elemento'));
      const select = criar('select', 'controle');
      select.setAttribute('data-campo', base + 'elemento');
      select.setAttribute('data-tipo', 'texto');
      select.setAttribute('data-padrao', '');
      select.appendChild(opcao('', '— escolha —'));
      Object.keys(escolha.mapa).forEach(function (idElemento) {
        const elemento = OP.data.elementos.find(function (e) { return e.id === idElemento; });
        select.appendChild(opcao(idElemento, (elemento ? elemento.nome : idElemento) + ' (' + nomePericia(escolha.mapa[idElemento]) + ')'));
      });
      rotulo.appendChild(select);
      caixa.appendChild(rotulo);
    }
    return caixa;
  }

  function sincronizarOrigem(ficha, identidade) {
    const ident = ficha.identificacao;
    const origem = identidade.origem;
    const chave = ident.origem + '|' + (origem ? habilidadeExiste(ficha, origem.habilidade, 'origem') : '');
    if (chave === assinaturas.origem) return false;
    assinaturas.origem = chave;

    const filhos = [];
    if (!origem) {
      filhos.push(criar('p', 'identidade__vazio', identidade.origemOutra
        ? 'Origem fora da lista: escreva o nome abaixo do campo Origem, marque as perícias dela na coluna "Conc." e cadastre a habilidade em Habilidades e poderes.'
        : 'Escolha a origem na Identificação.'));
      return recriar(refs.conteudoOrigem, filhos);
    }
    filhos.push(criar('p', 'identidade__nome', origem.nome));
    filhos.push(linhaInfo('Fonte', nomeFonte(origem.fonte)));
    filhos.push(linhaInfo('Perícias', origem.pericias.length ? nomesPericias(origem.pericias) : 'conforme a escolha abaixo'));
    if (origem.profissao) filhos.push(linhaInfo('Profissão', origem.profissao));
    if (origem.escolha) filhos.push(controlesEscolhaOrigem(origem, identidade));
    const habilidade = criar('div', 'identidade__habilidade');
    habilidade.appendChild(linhaInfo('Habilidade', origem.habilidade));
    habilidade.appendChild(botaoAdicionar(ficha, origem.habilidade, 'origem'));
    filhos.push(habilidade);
    return recriar(refs.conteudoOrigem, filhos);
  }

  function sincronizarClasse(ficha, identidade) {
    const classe = identidade.classe;
    const chave = classe ? classe.id : '';
    if (chave === assinaturas.classe) return false;
    assinaturas.classe = chave;

    const filhos = [];
    if (!classe) {
      filhos.push(criar('p', 'identidade__vazio', 'Escolha a classe na Identificação.'));
      return recriar(refs.conteudoClasse, filhos);
    }
    filhos.push(criar('p', 'identidade__nome', classe.nome));
    filhos.push(linhaInfo('Fonte', nomeFonte(classe.fonte)));
    filhos.push(linhaInfo('Progressão', classe.unidadeProgressao === 'estagio'
      ? 'por estágio (1 a ' + classe.estagioMax + '); limite de ' + classe.limitePEFixo + ' PE por turno'
      : 'por NEX (5% a 99%)'));
    filhos.push(linhaInfo('Proficiências', classe.proficiencias.join(', ')));
    const fixas = classe.pericias.fixas || [];
    const escolhas = classe.pericias.escolhas || [];
    if (fixas.length) filhos.push(linhaInfo('Perícias da classe', nomesPericias(fixas)));
    escolhas.forEach(function (opcoes, indice) {
      const rotulo = criar('label', 'identidade__campo');
      rotulo.appendChild(criar('span', 'identidade__rotulo', 'Perícia: ' + opcoes.map(nomePericia).join(' ou ')));
      const select = criar('select', 'controle');
      select.setAttribute('data-campo', 'identificacao.escolhas.classe.grupos.' + indice);
      select.setAttribute('data-tipo', 'texto');
      select.setAttribute('data-padrao', '');
      select.appendChild(opcao('', '— escolha —'));
      opcoes.forEach(function (id) { select.appendChild(opcao(id, nomePericia(id))); });
      rotulo.appendChild(select);
      filhos.push(rotulo);
    });
    if (!fixas.length && !escolhas.length) filhos.push(linhaInfo('Perícias da classe', 'nenhuma fixa (use os pontos de treinamento)'));
    filhos.push(linhaInfo('Treinamento', classe.pontosTreinamento + ' + INT pontos; graus ' +
      (typeof classe.grauTreinamentoBase === 'number' ? classe.grauTreinamentoBase + ' + INT por marco' : 'não se aplicam')));
    if (typeof classe.rituaisIniciais === 'number') {
      filhos.push(linhaInfo('Rituais da classe', classe.rituaisIniciais + ' no início, +1 a cada avanço de NEX'));
    }
    return recriar(refs.conteudoClasse, filhos);
  }

  /** Item da lista de habilidades da trilha: marco, nome, situação e botão. */
  function itemHabilidade(ficha, habilidade, unidade, rotuloExtra) {
    const item = criar('li', 'trilha__habilidade ' + (habilidade.liberada ? 'trilha__habilidade--liberada' : 'trilha__habilidade--bloqueada'));
    item.appendChild(criar('span', 'trilha__marco', textoNivel(habilidade.marco, unidade, OP.calc.regraNexNivel(ficha))));
    item.appendChild(criar('span', 'trilha__nome', habilidade.nome + (rotuloExtra ? ' (' + rotuloExtra + ')' : '')));
    item.appendChild(criar('span', 'trilha__situacao', habilidade.liberada ? 'liberada' : 'bloqueada'));
    item.appendChild(botaoAdicionar(ficha, habilidade.nome, 'trilha'));
    return item;
  }

  function sincronizarTrilha(ficha, identidade) {
    const ident = ficha.identificacao;
    const ativas = OP.prefs.fontesAtivas();
    const chave = [ident.classe, ident.trilha, identidade.nivel, ident.versatilidade, identidade.versatilidadeLiberada,
      JSON.stringify(ativas), assinaturaHabilidades(ficha)].join('|');
    if (chave === assinaturas.trilha) return false;
    assinaturas.trilha = chave;

    const filhos = [];
    const classe = identidade.classe;
    const trilha = identidade.trilha;
    if (!classe) {
      filhos.push(criar('p', 'identidade__vazio', 'Escolha a classe para ver as trilhas.'));
    } else if (identidade.trilhaOutra) {
      filhos.push(criar('p', 'identidade__vazio', 'Trilha fora da lista: escreva o nome abaixo do campo Trilha e cadastre as habilidades em Habilidades e poderes.'));
    } else if (!trilha) {
      filhos.push(criar('p', 'identidade__vazio', 'Escolha a trilha na Identificação.'));
    } else {
      filhos.push(criar('p', 'identidade__nome', trilha.nome));
      filhos.push(linhaInfo('Fonte', nomeFonte(trilha.fonte)));
      if (trilha.especial) filhos.push(criar('p', 'aviso-neutro identidade__especial', trilha.especial));
      const lista = criar('ul', 'trilha__habilidades');
      identidade.habilidadesTrilha.forEach(function (h) { lista.appendChild(itemHabilidade(ficha, h, identidade.unidade)); });
      filhos.push(lista);
    }

    // Versatilidade (NEX 50%): a 1ª habilidade de outra trilha da classe
    if (classe && classe.unidadeProgressao !== 'estagio') {
      const bloco = criar('div', 'trilha__versatilidade');
      const rotulo = criar('label', 'identidade__campo');
      rotulo.appendChild(criar('span', 'identidade__rotulo', 'Trilha de versatilidade (NEX 50%)'));
      const select = criar('select', 'controle');
      select.setAttribute('data-campo', 'identificacao.versatilidade');
      select.setAttribute('data-tipo', 'texto');
      select.appendChild(opcao('', '— Nenhuma —'));
      const outras = OP.calc.trilhasDaClasse(classe.id).filter(function (t) { return t.id !== ident.trilha; });
      opcoesAgrupadas(outras, ident.versatilidade, ativas).forEach(function (grupo) { select.appendChild(grupo); });
      select.disabled = !identidade.versatilidadeLiberada && ident.versatilidade === '';
      rotulo.appendChild(select);
      bloco.appendChild(rotulo);
      if (identidade.versatilidade) {
        const lista = criar('ul', 'trilha__habilidades');
        const v = identidade.versatilidade;
        lista.appendChild(itemHabilidade(ficha, { marco: v.marco, nome: v.nome, liberada: v.liberada }, 'nex', v.nomeTrilha));
        bloco.appendChild(lista);
      } else if (!identidade.versatilidadeLiberada) {
        bloco.appendChild(criar('p', 'identidade__nota', 'Liberada no NEX 50%: escolha outra trilha da classe e ganhe a 1ª habilidade dela.'));
      }
      filhos.push(bloco);
    }
    return recriar(refs.conteudoTrilha, filhos);
  }

  /* ------------------------------------------------------------------------
     Progressão da classe
     ------------------------------------------------------------------------ */

  function contador(rotulo, valor, excedido, dica) {
    const item = criar('li', 'progressao__contador' + (excedido ? ' progressao__contador--excedido' : ''));
    item.appendChild(criar('span', 'progressao__contador-rotulo', rotulo));
    item.appendChild(criar('span', 'progressao__contador-valor', valor));
    if (dica) item.title = dica;
    return item;
  }

  function desenharContadores(progressao) {
    const itens = [];
    if (progressao.classeDefinida) {
      itens.push(contador('Poderes de classe', progressao.poderes.liberados + ' liberados · ' + progressao.poderes.cadastrados + ' cadastrados',
        progressao.poderes.cadastrados > progressao.poderes.liberados, 'Cadastrados = habilidades com a fonte "Poder"'));
      itens.push(contador('Aumentos de atributo', progressao.aumentos.liberados + ' liberados · ' + progressao.aumentos.usados + ' usados',
        progressao.aumentos.usados > progressao.aumentos.liberados, 'Usados = soma das bases dos atributos − 9'));
      itens.push(contador('Graus de treinamento', progressao.graus.usados + ' / ' + progressao.graus.liberados,
        progressao.graus.excedido, 'Usados (Veterano = 1, Expert = 2) / liberados'));
      if (progressao.rituais) {
        itens.push(contador('Rituais concedidos pela classe', progressao.rituais.concedidos + ' · ' + progressao.rituais.cadastrados + ' cadastrados',
          false, 'Os rituais concedidos pela classe não contam no limite de rituais conhecidos'));
      }
    }
    const chave = itens.map(function (i) { return i.textContent + i.className; }).join('|');
    if (chave === assinaturas.contadores) return;
    assinaturas.contadores = chave;
    OP.ui.substituirFilhos(refs.contadores, itens);
  }

  function desenharTabela(progressao, porNivel) {
    const chave = JSON.stringify([progressao.unidade, progressao.nivel, progressao.linhas, porNivel]);
    if (chave === assinaturas.progressao) return;
    assinaturas.progressao = chave;

    refs.tabela.hidden = !progressao.classeDefinida;
    refs.semClasse.hidden = progressao.classeDefinida;
    refs.colunaNivel.textContent = progressao.unidade === 'estagio' ? 'Estágio' : (porNivel ? 'Nível (NEX)' : 'NEX');

    const linhas = progressao.linhas.map(function (linha) {
      const tr = criar('tr', 'progressao__linha' +
        (linha.alcancada ? ' progressao__linha--alcancada' : '') + (linha.atual ? ' progressao__linha--atual' : ''));
      if (linha.atual) tr.setAttribute('aria-current', 'step');
      const th = criar('th', '', progressao.unidade === 'estagio' ? String(linha.nivel)
        : (porNivel ? OP.calc.nivelDoNex(linha.nivel) + ' (' + linha.nivel + '%)' : linha.nivel + '%'));
      th.scope = 'row';
      tr.appendChild(th);
      const td = criar('td', '');
      linha.itens.forEach(function (item) {
        const etiqueta = criar('span', 'progressao__item progressao__item--' + item.tipo,
          item.rotulo + (item.trilha ? ': ' + item.trilha : ''));
        td.appendChild(etiqueta);
      });
      if (linha.atual) td.appendChild(criar('span', 'progressao__atual', 'atual'));
      tr.appendChild(td);
      return tr;
    });
    OP.ui.substituirFilhos(refs.corpoTabela, linhas);
  }

  function desenharProximo(progressao, porNivel) {
    let texto = '';
    if (progressao.classeDefinida) {
      texto = progressao.proximo
        ? 'Próximo marco: ' + textoNivel(progressao.proximo.nivel, progressao.proximo.unidade, porNivel) + ' — ' + progressao.proximo.rotulos.join(', ')
        : 'Todos os marcos alcançados';
    }
    if (refs.proximo.textContent !== texto) refs.proximo.textContent = texto;
  }

  /* ------------------------------------------------------------------------
     Ciclo de desenho (OP.ui.registrarExtensao)
     ------------------------------------------------------------------------ */

  function sincronizar(ficha, derivados) {
    const identidade = derivados.identidade;
    let mudou = sincronizarSelects(ficha);
    mudou = sincronizarOrigem(ficha, identidade) || mudou;
    mudou = sincronizarClasse(ficha, identidade) || mudou;
    mudou = sincronizarTrilha(ficha, identidade) || mudou;
    if (mudou) OP.ui.coletarLigacoes(); // os campos novos passam a ser escritos pelo ui.js
  }

  function desenhar(ficha, derivados) {
    const ident = ficha.identificacao;
    // Texto livre só com "Outra"
    refs.origemTexto.hidden = ident.origem !== 'outra';
    refs.trilhaTexto.hidden = ident.trilha !== 'outra';
    refs.selectTrilha.disabled = !ident.classe && ident.trilha === '';

    // NEX ou Estágio (Sobrevivente)
    // Regra opcional NEX e Experiência: o campo é o Nível (o NEX de exposição fica em "Alterações de NEX")
    const porEstagio = derivados.nex.unidade === 'estagio';
    const porNivel = OP.calc.regraNexNivel(ficha) && !porEstagio;
    refs.selectNex.hidden = porEstagio || porNivel;
    refs.selectNivel.hidden = !porNivel;
    refs.selectEstagio.hidden = !porEstagio;
    refs.rotuloNivel.textContent = porEstagio ? 'Estágio' : (porNivel ? 'Nível' : 'NEX');
    refs.rotuloNivel.htmlFor = porEstagio ? 'campo-estagio' : (porNivel ? 'campo-nivel' : 'campo-nex');

    desenharContadores(derivados.progressao);
    desenharTabela(derivados.progressao, porNivel);
    desenharProximo(derivados.progressao, porNivel);
  }

  /* ------------------------------------------------------------------------
     Ações: adicionar habilidade e fontes
     ------------------------------------------------------------------------ */

  function adicionarHabilidade(nome, fonte) {
    const ficha = OP.state.ficha;
    if (habilidadeExiste(ficha, nome, fonte)) {
      mostrarMensagem('aviso', '"' + nome + '" já está em Habilidades e poderes.');
      return;
    }
    const nova = OP.state.novaHabilidade({ nome: nome, fonte: fonte });
    OP.state.atualizar('habilidades', OP.state.obter('habilidades').concat([nova]));
    mostrarMensagem('ok', '"' + nome + '" foi adicionada em Habilidades e poderes. A descrição é sua: escreva lá.');
  }

  function aoClicar(evento) {
    const botao = evento.target.closest('[data-adicionar-habilidade]');
    if (botao && !botao.disabled) {
      adicionarHabilidade(botao.getAttribute('data-adicionar-habilidade'), botao.getAttribute('data-fonte-habilidade'));
    }
  }

  /** Caixas da janela "Fontes" (uma por fonte, com quantas origens e trilhas ela tem). */
  function montarFontes() {
    const itens = Object.keys(OP.data.fontes).map(function (id) {
      const origens = OP.data.origens.filter(function (o) { return o.fonte === id; }).length;
      const trilhas = OP.data.trilhas.filter(function (t) { return t.fonte === id; }).length;
      const item = criar('li', 'fontes__item');
      const rotulo = criar('label', 'caixa');
      const caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.setAttribute('data-fonte', id);
      rotulo.appendChild(caixa);
      rotulo.appendChild(criar('span', 'fontes__nome', nomeFonte(id)));
      item.appendChild(rotulo);
      const partes = [];
      if (origens) partes.push(origens + (origens === 1 ? ' origem' : ' origens'));
      if (trilhas) partes.push(trilhas + (trilhas === 1 ? ' trilha' : ' trilhas'));
      item.appendChild(criar('span', 'fontes__contagem', partes.join(', ') || 'sem origens nem trilhas'));
      return item;
    });
    OP.ui.substituirFilhos(refs.listaFontes, itens);
  }

  function abrirFontes() {
    const ativas = OP.prefs.fontesAtivas();
    refs.listaFontes.querySelectorAll('[data-fonte]').forEach(function (caixa) {
      caixa.checked = ativas[caixa.getAttribute('data-fonte')] !== false;
    });
    if (!refs.dialogoFontes.open) refs.dialogoFontes.showModal();
  }

  function montar() {
    refs.secao = document.querySelector('.secao--identidade');
    refs.mensagem = document.getElementById('identidade-mensagem');
    refs.conteudoOrigem = document.getElementById('conteudo-origem');
    refs.conteudoClasse = document.getElementById('conteudo-classe');
    refs.conteudoTrilha = document.getElementById('conteudo-trilha');
    refs.selectOrigem = document.getElementById('campo-origem');
    refs.origemTexto = document.getElementById('campo-origem-texto');
    refs.selectTrilha = document.getElementById('campo-trilha');
    refs.trilhaTexto = document.getElementById('campo-trilha-texto');
    refs.selectNex = document.getElementById('campo-nex');
    refs.selectNivel = document.getElementById('campo-nivel');
    refs.selectEstagio = document.getElementById('campo-estagio');
    refs.rotuloNivel = document.getElementById('rotulo-nivel');
    refs.contadores = document.getElementById('progressao-contadores');
    refs.tabela = document.getElementById('tabela-progressao');
    refs.corpoTabela = document.getElementById('corpo-progressao');
    refs.colunaNivel = document.getElementById('progressao-coluna');
    refs.semClasse = document.getElementById('progressao-sem-classe');
    refs.proximo = document.getElementById('progressao-proximo');
    refs.dialogoFontes = document.getElementById('dialogo-fontes');
    refs.listaFontes = document.getElementById('lista-fontes');

    refs.secao.addEventListener('click', aoClicar);
    document.getElementById('botao-fontes').addEventListener('click', abrirFontes);
    refs.dialogoFontes.addEventListener('click', function (evento) {
      if (evento.target === refs.dialogoFontes || evento.target.closest('[data-fechar-fontes]')) refs.dialogoFontes.close();
    });
    refs.listaFontes.addEventListener('change', function (evento) {
      const caixa = evento.target.closest('[data-fonte]');
      if (caixa) OP.prefs.definirFonte(caixa.getAttribute('data-fonte'), caixa.checked);
    });
    // Fontes mudaram: refaz as listas (a preferência fica fora da ficha).
    // Mudança de tema (só aparência) não precisa redesenhar a ficha.
    OP.prefs.aoMudar(function (prefs, tipo) {
      if (tipo !== 'fontes') return;
      if (OP.state.ficha) OP.app.redesenhar(OP.state.ficha);
    });

    montarFontes();
    OP.ui.registrarExtensao({ sincronizar: sincronizar, desenhar: desenhar });
  }

  OP.uiClasse = {
    montar: montar,
    abrirFontes: abrirFontes
  };
})(window.OP);
