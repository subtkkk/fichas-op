/* ==========================================================================
   js/ui-itens.js — cartões dos itens do inventário (OP.uiItens)
   --------------------------------------------------------------------------
   Cada item tem dois modos de tela (data-modo na linha), só da tela:
   - "resumo" (padrão): o cabeçalho abre e fecha o cartão (nome, natureza e, ao lado, a
     categoria atual, os espaços e a quantidade). Aberto, mostra a visão de leitura: a conta
     da categoria, o texto do livro, a descrição, as melhorias com o efeito e os
     modificadores de categoria. Só ali ficam os atalhos de jogo (quantidade e equipar).
   - "edicao": o formulário do item (campos, natureza, melhorias do livro ou próprias e
     "Modificar categoria"). Item sem nome nasce em edição. É o que a impressão usa.
   A natureza do item decide quais melhorias ele aceita; o resumo da conta
   (categoria base + melhorias + modificadores = efetiva; espaços; Defesa) fica no formulário.
   "Modificar categoria" guarda poderes e habilidades que sobem ou baixam a categoria, cada
   um com valor (com sinal) e a fonte; a efetiva pode ficar abaixo de 0.
   Entra no ciclo de desenho do js/ui.js (OP.ui.registrarExtensao). As contas ficam
   em js/calc.js (categoriaEfetivaItem, espacosDoItem, compatibilidadeMelhoria...).
   Textos do usuário e do livro entram só por textContent.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const abertos = Object.create(null);   // id do item → cartão aberto no modo resumo (só da tela)
  const editando = Object.create(null);  // id do item → modo edição (só da tela)
  const efeitosAbertos = Object.create(null); // ids de melhorias com o texto do livro aberto
  const assinaturas = new WeakMap();     // linha do item → assinatura do formulário desenhado
  const assinaturasVisao = new WeakMap(); // linha do item → assinatura da visão desenhada
  const assinaturasTopo = new WeakMap(); // linha do item → assinatura do cabeçalho desenhado
  let versaoLivro = 0;                   // muda quando o conteúdo do livro chega ou some
  let focoPendente = null;               // id da melhoria nova: foco no nome depois de desenhar
  let focoModPendente = null;            // id do modificador novo: foco na fonte depois de desenhar

  const NOMES_CLASSE = { modificacao: 'Modificação', maldicao: 'Maldição', regalia: 'Regalia' };
  const LIMITE_MODIFICADOR = 20;         // o mesmo de js/calc.js (valorDoModificador)

  function criar(tag, classe, texto) {
    return OP.ui.criarElemento(tag, classe, texto);
  }

  function definirTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  function definirAtributo(elemento, nome, valor) {
    if (elemento && elemento.getAttribute(nome) !== valor) elemento.setAttribute(nome, valor);
  }

  function rotuloCategoria(n) {
    return OP.calc.rotuloCategoria(n);
  }

  function numeroTexto(n) {
    return String(Math.round(n * 100) / 100).replace('.', ',');
  }

  function sinal(n) {
    return (n < 0 ? '−' : '+') + Math.abs(n);
  }

  /** "+ 1" / "− 2" (para contas escritas por extenso). */
  function sinalEspaco(n) {
    return (n < 0 ? '− ' : '+ ') + Math.abs(n);
  }

  function nomeNatureza(id) {
    const g = OP.data.gruposItem.find(function (x) { return x.id === id; });
    return g ? g.nome : '';
  }

  function nomeTipo(id) {
    const t = OP.data.tiposItem.find(function (x) { return x.id === id; });
    return t ? t.nome : '';
  }

  function indiceDoItem(id) {
    return OP.state.ficha.inventario.itens.findIndex(function (i) { return i.id === id; });
  }

  function caminhoDaMelhoria(indiceItem, indiceMelhoria) {
    return 'inventario.itens.' + indiceItem + '.melhorias.' + indiceMelhoria;
  }

  function caminhoDoModificador(indiceItem, indiceMod) {
    return 'inventario.itens.' + indiceItem + '.modCategoria.' + indiceMod;
  }

  function livroLiberado() {
    return Boolean(OP.data.catalogo && ((OP.data.catalogo.itens || []).length || (OP.data.catalogo.melhorias || []).length));
  }

  function nomeDoItem(item) {
    return String(item.nome || '').trim();
  }

  function nomeDaMelhoria(melhoria) {
    return melhoria.nome || (OP.calc.melhoriaDoCatalogo(melhoria.chave) || {}).nome || 'Melhoria do livro';
  }

  function modificadores(item) {
    return OP.calc.modificadoresDoItem(item);
  }

  /** Modo do item: sem nome (item novo), a primeira vez abre editando; depois vale o que a pessoa escolheu. */
  function modoDoItem(item) {
    if (editando[item.id] === undefined) editando[item.id] = nomeDoItem(item) === '';
    return editando[item.id] ? 'edicao' : 'resumo';
  }

  /* ------------------------------------------------------------------------
     Contas de um item
     ------------------------------------------------------------------------ */

  /** "base I + 1 das melhorias − 2 de modificadores". */
  function textoConta(d) {
    const partes = ['base ' + rotuloCategoria(d.categoriaBase)];
    if (d.aumento) partes.push(sinalEspaco(d.aumento) + ' das melhorias');
    if (d.ajuste) partes.push(sinalEspaco(d.ajuste) + ' de modificadores');
    return partes.join(' ');
  }

  function textoResumo(item, d) {
    const partes = [];
    const categoria = d.aumento || d.ajuste
      ? 'Categoria ' + rotuloCategoria(d.categoriaBase) + (d.aumento ? ' ' + sinalEspaco(d.aumento) + ' das melhorias' : '') +
        (d.ajuste ? ' ' + sinalEspaco(d.ajuste) + ' de modificadores' : '') + ' = ' + rotuloCategoria(d.categoriaEfetiva)
      : 'Categoria ' + rotuloCategoria(d.categoriaBase);
    let aviso = '';
    if (d.categoriaEfetiva > 4) aviso = ' (acima de IV: só com habilidades que reduzem a categoria)';
    else if (d.categoriaEfetiva < 0) aviso = ' (abaixo de 0: não conta nos limites)';
    partes.push(categoria + aviso);
    if (d.espacosEfetivos !== d.espacosBase) partes.push('espaços ' + numeroTexto(d.espacosBase) + ' → ' + numeroTexto(d.espacosEfetivos));
    if (item.tipo === 'protecao' && d.defesaEfetiva !== d.defesaBase) partes.push('Defesa ' + sinal(d.defesaBase) + ' → ' + sinal(d.defesaEfetiva));
    const aj = d.ajustes;
    if (item.tipo === 'arma' && (aj.ataque || aj.dano || aj.margem)) {
      const lista = [];
      if (aj.ataque) lista.push('ataque ' + sinal(aj.ataque));
      if (aj.dano) lista.push('dano ' + sinal(aj.dano));
      if (aj.margem) lista.push('margem de ameaça ' + sinal(aj.margem));
      partes.push('nos ataques ligados a esta arma: ' + lista.join(', '));
    }
    return partes.join(' · ') + '.';
  }

  /* ------------------------------------------------------------------------
     Cabeçalho (modo resumo)
     ------------------------------------------------------------------------ */

  /** Etiquetas do cabeçalho: [{ texto, classe, titulo }]. */
  function chipsDoItem(item, d) {
    const chips = [];
    const quantidade = Math.max(0, Math.trunc(OP.calc.numero(item.quantidade)));
    const muda = d.categoriaEfetiva !== d.categoriaBase;
    chips.push({
      texto: 'Cat. ' + rotuloCategoria(d.categoriaEfetiva),
      classe: 'item__chip item__chip--categoria' + (muda ? ' item__chip--muda' : ''),
      titulo: 'Categoria ' + rotuloCategoria(d.categoriaEfetiva) + (d.aumento || d.ajuste ? ' (' + textoConta(d) + ')' : '') +
        (d.categoriaEfetiva < 0 ? '. Abaixo de 0: não conta nos limites.' : '')
    });
    const espacos = d.espacosEfetivos * quantidade;
    if (espacos > 0 || d.espacosEfetivos > 0) {
      chips.push({
        texto: numeroTexto(espacos) + ' esp.',
        classe: 'item__chip',
        titulo: numeroTexto(d.espacosEfetivos) + (d.espacosEfetivos === 1 ? ' espaço' : ' espaços') + ' por unidade × ' + quantidade
      });
    }
    if (quantidade !== 1) chips.push({ texto: '× ' + quantidade, classe: 'item__chip', titulo: 'Quantidade ' + quantidade });
    if (item.tipo === 'protecao' && item.equipada === true) chips.push({ texto: 'equipada', classe: 'item__chip item__chip--equipada', titulo: 'Proteção equipada' });
    const avisos = d.melhorias.filter(function (x) { return !x.vale || !x.ok; }).length;
    if (avisos) chips.push({ texto: 'aviso', classe: 'item__chip item__chip--aviso', titulo: 'Aviso: ' + avisos + (avisos === 1 ? ' melhoria com problema' : ' melhorias com problema') });
    return chips;
  }

  function desenharTopo(linha, item, d) {
    const nome = nomeDoItem(item);
    const sub = nomeNatureza(item.grupo) || (item.tipo !== 'geral' ? nomeTipo(item.tipo) : '');
    const chips = chipsDoItem(item, d);
    const assinatura = JSON.stringify([nome, sub, chips]);
    if (assinaturasTopo.get(linha) === assinatura) return;
    assinaturasTopo.set(linha, assinatura);
    const titulo = linha.querySelector('[data-item-titulo]');
    definirTexto(titulo, nome || 'Item sem nome');
    titulo.classList.toggle('item__titulo--vazio', nome === '');
    const subtitulo = linha.querySelector('[data-item-sub]');
    definirTexto(subtitulo, sub);
    if (subtitulo.hidden === (sub !== '')) subtitulo.hidden = sub === '';
    const caixa = linha.querySelector('[data-item-chips]');
    OP.ui.substituirFilhos(caixa, chips.map(function (c) {
      const chip = criar('span', c.classe, c.texto);
      chip.title = c.titulo;
      return chip;
    }));
  }

  function desenharBotoes(linha, item, modo, aberto) {
    const alternar = linha.querySelector('[data-alternar-item]');
    definirAtributo(alternar, 'aria-expanded', String(aberto));
    const nome = nomeDoItem(item);
    definirAtributo(alternar, 'aria-label', (aberto ? 'Recolher ' : 'Abrir ') + (nome || 'item sem nome'));
    const editar = linha.querySelector('[data-editar-item]');
    const emEdicao = modo === 'edicao';
    definirTexto(editar, emEdicao ? 'Concluir' : 'Editar');
    definirAtributo(editar, 'aria-expanded', String(emEdicao));
    definirAtributo(editar, 'aria-label', (emEdicao ? 'Concluir a edição de ' : 'Editar ') + (nome || 'item sem nome'));
  }

  /* ------------------------------------------------------------------------
     Melhorias: linha de edição e linha de leitura
     ------------------------------------------------------------------------ */

  function criarSelecaoClasse(valor, aoMudar) {
    const select = criar('select', 'controle melhoria__classe-select');
    select.setAttribute('aria-label', 'Classe da melhoria');
    OP.data.classesMelhoria.forEach(function (c) {
      const o = criar('option', '', c.nome);
      o.value = c.id;
      select.appendChild(o);
    });
    select.value = valor;
    select.addEventListener('change', function () { aoMudar(select.value); });
    return select;
  }

  function criarIconeRemover() {
    const span = criar('span');
    span.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 4.5h11"/><path d="M6.5 4.5V3h3v1.5"/><path d="M4 4.5l.8 9h6.4l.8-9"/></svg>';
    return span.firstChild;
  }

  /** Classe, elemento e nome do livro de uma melhoria (iguais na leitura e na edição). */
  function criarIdentidadeMelhoria(melhoria) {
    const itens = [criar('span', 'melhoria__classe', NOMES_CLASSE[melhoria.classe] || 'Melhoria')];
    if (melhoria.elemento) {
      const el = OP.data.elementos.find(function (e) { return e.id === melhoria.elemento; });
      const chip = criar('span', 'melhoria__elemento', el ? el.nome : melhoria.elemento);
      chip.setAttribute('data-elemento-livro', melhoria.elemento);
      itens.push(chip);
    }
    itens.push(criar('strong', 'melhoria__nome-texto', nomeDaMelhoria(melhoria)));
    return itens;
  }

  function criarAlertaMelhoria(estado) {
    if (!estado.vale) return criar('span', 'melhoria__alerta', 'repetida: não conta');
    if (!estado.ok) return criar('span', 'melhoria__alerta', 'não combina: ' + estado.motivo);
    return null;
  }

  function criarBotaoEfeito(melhoria) {
    if (!melhoria.chave || !OP.livro || !OP.livro.texto(melhoria.chave)) return null;
    const ver = criar('button', 'botao botao--pequeno botao--fantasma', efeitosAbertos[melhoria.id] ? 'Ocultar efeito' : 'Ver efeito');
    ver.type = 'button';
    ver.setAttribute('aria-expanded', String(efeitosAbertos[melhoria.id] === true));
    ver.setAttribute('data-melhoria-efeito', melhoria.id);
    return ver;
  }

  function criarLinhaMelhoria(item, indiceItem, melhoria, indiceMelhoria, estado) {
    const li = criar('li', 'melhoria melhoria--' + melhoria.classe);
    li.setAttribute('data-melhoria', melhoria.id);
    const caminho = caminhoDaMelhoria(indiceItem, indiceMelhoria);
    const propria = !melhoria.chave;
    const topo = criar('div', 'melhoria__topo');

    if (propria) {
      topo.appendChild(criarSelecaoClasse(melhoria.classe, function (v) { OP.state.atualizar(caminho + '.classe', v); }));
      const nome = criar('input', 'controle melhoria__nome');
      nome.type = 'text';
      nome.placeholder = 'Nome da melhoria';
      nome.autocomplete = 'off';
      nome.setAttribute('aria-label', 'Nome da melhoria');
      nome.setAttribute('data-melhoria-nome', melhoria.id);
      nome.value = melhoria.nome;
      nome.addEventListener('input', function () { OP.state.atualizar(caminho + '.nome', nome.value); });
      topo.appendChild(nome);
    } else {
      criarIdentidadeMelhoria(melhoria).forEach(function (e) { topo.appendChild(e); });
    }

    const alerta = criarAlertaMelhoria(estado);
    if (alerta) topo.appendChild(alerta);

    const acoes = criar('span', 'melhoria__acoes');
    const ver = criarBotaoEfeito(melhoria);
    if (ver) acoes.appendChild(ver);
    const remover = criar('button', 'botao-icone botao-icone--perigo');
    remover.type = 'button';
    remover.setAttribute('data-melhoria-remover', melhoria.id);
    remover.title = 'Remover melhoria';
    remover.appendChild(criarIconeRemover());
    remover.appendChild(criar('span', 'visualmente-oculto', 'Remover melhoria'));
    acoes.appendChild(remover);
    topo.appendChild(acoes);
    li.appendChild(topo);

    if (efeitosAbertos[melhoria.id] && !propria && OP.uiLivro && OP.uiLivro.criarTextoLivro) {
      li.appendChild(OP.uiLivro.criarTextoLivro(melhoria.chave));
    }

    const nota = criar('input', 'controle melhoria__nota');
    nota.type = 'text';
    nota.placeholder = 'Anotação (ex.: perícia ou kit escolhido)';
    nota.autocomplete = 'off';
    nota.setAttribute('aria-label', 'Anotação da melhoria');
    nota.setAttribute('data-melhoria-nota', melhoria.id);
    nota.value = melhoria.nota;
    nota.classList.toggle('melhoria__nota--vazia', melhoria.nota === ''); // no papel, nota vazia some
    nota.addEventListener('input', function () {
      nota.classList.toggle('melhoria__nota--vazia', nota.value === '');
      OP.state.atualizar(caminho + '.nota', nota.value);
    });
    li.appendChild(nota);
    return li;
  }

  /** A mesma melhoria, só para ler: classe, nome, o que soma à categoria, efeito do livro e anotação. */
  function criarLinhaLeituraMelhoria(melhoria, estado) {
    const li = criar('li', 'melhoria melhoria--' + melhoria.classe);
    li.setAttribute('data-melhoria', melhoria.id);
    const topo = criar('div', 'melhoria__topo');
    criarIdentidadeMelhoria(melhoria).forEach(function (e) { topo.appendChild(e); });
    if (estado.aumento) topo.appendChild(criar('span', 'melhoria__categoria', 'categoria ' + sinal(estado.aumento)));
    const alerta = criarAlertaMelhoria(estado);
    if (alerta) topo.appendChild(alerta);
    const ver = criarBotaoEfeito(melhoria);
    if (ver) {
      const acoes = criar('span', 'melhoria__acoes');
      acoes.appendChild(ver);
      topo.appendChild(acoes);
    }
    li.appendChild(topo);
    if (efeitosAbertos[melhoria.id] && melhoria.chave && OP.uiLivro && OP.uiLivro.criarTextoLivro) {
      li.appendChild(OP.uiLivro.criarTextoLivro(melhoria.chave));
    }
    if (String(melhoria.nota || '').trim()) li.appendChild(criar('p', 'melhoria__anotacao', melhoria.nota));
    return li;
  }

  /* ------------------------------------------------------------------------
     Modificar categoria (edição)
     ------------------------------------------------------------------------ */

  function criarBotaoPasso(texto, passo, rotulo) {
    const botao = criar('button', 'passo__botao', texto);
    botao.type = 'button';
    botao.tabIndex = -1;
    botao.setAttribute('data-mod-passo', String(passo));
    botao.setAttribute('aria-label', rotulo);
    return botao;
  }

  function criarLinhaModificador(indiceItem, mod, indiceMod) {
    const li = criar('li', 'mod');
    li.setAttribute('data-mod', mod.id);
    const caminho = caminhoDoModificador(indiceItem, indiceMod);

    const passo = criar('div', 'passo mod__passo');
    const valor = criar('input', 'passo__valor');
    valor.type = 'number';
    valor.step = '1';
    valor.min = String(-LIMITE_MODIFICADOR);
    valor.max = String(LIMITE_MODIFICADOR);
    valor.setAttribute('aria-label', 'Valor do modificador de categoria');
    valor.setAttribute('data-mod-valor', mod.id);
    valor.value = String(OP.calc.numero(mod.valor));
    valor.addEventListener('input', function () {
      const n = Math.trunc(Number(valor.value));
      if (valor.value.trim() !== '' && Number.isFinite(n)) OP.state.atualizar(caminho + '.valor', Math.min(LIMITE_MODIFICADOR, Math.max(-LIMITE_MODIFICADOR, n)));
    });
    valor.addEventListener('change', function () {
      const atual = OP.state.obter(caminho + '.valor');
      valor.value = String(OP.calc.numero(atual)); // vazio ou fora da faixa volta ao valor guardado
    });
    passo.appendChild(criarBotaoPasso('−', -1, 'Baixar a categoria em 1'));
    passo.appendChild(valor);
    passo.appendChild(criarBotaoPasso('+', 1, 'Subir a categoria em 1'));
    li.appendChild(passo);

    const fonte = criar('input', 'controle mod__fonte');
    fonte.type = 'text';
    fonte.placeholder = 'Fonte (ex.: poder, habilidade ou ritual)';
    fonte.autocomplete = 'off';
    fonte.setAttribute('aria-label', 'Fonte do modificador de categoria');
    fonte.setAttribute('data-mod-fonte', mod.id);
    fonte.value = mod.fonte;
    fonte.addEventListener('input', function () { OP.state.atualizar(caminho + '.fonte', fonte.value); });
    li.appendChild(fonte);

    const remover = criar('button', 'botao-icone botao-icone--perigo');
    remover.type = 'button';
    remover.setAttribute('data-mod-remover', mod.id);
    remover.title = 'Remover modificador';
    remover.appendChild(criarIconeRemover());
    remover.appendChild(criar('span', 'visualmente-oculto', 'Remover modificador'));
    li.appendChild(remover);
    return li;
  }

  /** "+1 (Poder X), −2 (Habilidade Y)": o texto dos modificadores no papel. */
  function textoImpressoDosModificadores(item) {
    const lista = modificadores(item);
    if (!lista.length) return '';
    return 'Modificar categoria: ' + lista.map(function (m) {
      const fonte = String(m.fonte || '').trim();
      return sinal(Math.trunc(OP.calc.numero(m.valor))) + (fonte ? ' (' + fonte + ')' : '');
    }).join(', ') + '.';
  }

  /* ------------------------------------------------------------------------
     Visão de leitura (modo resumo, aberto)
     ------------------------------------------------------------------------ */

  function criarDado(rotulo, valor, extra) {
    const dado = criar('div', 'visao__dado');
    dado.appendChild(criar('span', 'visao__rotulo', rotulo));
    const v = criar('span', 'visao__valor', valor);
    dado.appendChild(v);
    if (extra) dado.appendChild(criar('span', 'visao__extra', extra));
    return dado;
  }

  function criarDadosDaVisao(item, d, quantidade) {
    const dados = criar('div', 'visao__dados');
    dados.appendChild(criarDado('Categoria', rotuloCategoria(d.categoriaEfetiva), d.aumento || d.ajuste ? textoConta(d) : ''));
    const porUnidade = numeroTexto(d.espacosEfetivos);
    dados.appendChild(criarDado('Espaços', quantidade !== 1 ? numeroTexto(d.espacosEfetivos * quantidade) : porUnidade,
      (quantidade !== 1 ? porUnidade + ' por unidade × ' + quantidade : '') +
      (d.espacosEfetivos !== d.espacosBase ? (quantidade !== 1 ? ' · ' : '') + 'base ' + numeroTexto(d.espacosBase) : '')));
    if (item.tipo === 'protecao') {
      dados.appendChild(criarDado('Defesa', sinal(d.defesaEfetiva), d.defesaEfetiva !== d.defesaBase ? 'base ' + sinal(d.defesaBase) : ''));
      if (OP.calc.numero(item.penalidade) > 0) dados.appendChild(criarDado('Penalidade', '−' + OP.calc.numero(item.penalidade), 'em perícias com carga'));
    }
    if (item.tipo === 'kit' && item.periciaKit) {
      const pericia = OP.data.pericias.find(function (p) { return p.id === item.periciaKit; });
      if (pericia) dados.appendChild(criarDado('Kit de', pericia.nome));
    }
    const aj = d.ajustes;
    if (item.tipo === 'arma' && (aj.ataque || aj.dano || aj.margem)) {
      const lista = [];
      if (aj.ataque) lista.push('ataque ' + sinal(aj.ataque));
      if (aj.dano) lista.push('dano ' + sinal(aj.dano));
      if (aj.margem) lista.push('margem de ameaça ' + sinal(aj.margem));
      dados.appendChild(criarDado('Nos ataques', lista.join(' · '), 'ligados a esta arma'));
    }
    return dados;
  }

  function criarSecaoVisao(titulo, quantidade) {
    const secao = criar('section', 'visao__secao');
    const cabecalho = criar('h4', 'visao__titulo', titulo);
    if (quantidade) cabecalho.appendChild(criar('span', 'visao__contagem', String(quantidade)));
    secao.appendChild(cabecalho);
    return secao;
  }

  function criarModificadoresDaVisao(item) {
    const lista = modificadores(item);
    const secao = criarSecaoVisao('Modificar categoria', lista.length);
    const ul = criar('ul', 'visao__mods');
    lista.forEach(function (m) {
      const valor = Math.trunc(OP.calc.numero(m.valor));
      const li = criar('li', 'visao__mod' + (valor < 0 ? ' visao__mod--baixa' : ''));
      li.appendChild(criar('strong', 'visao__mod-valor', sinal(valor)));
      const fonte = String(m.fonte || '').trim();
      li.appendChild(criar('span', fonte ? 'visao__mod-fonte' : 'visao__mod-fonte visao__mod-fonte--vazia', fonte || 'sem fonte'));
      ul.appendChild(li);
    });
    secao.appendChild(ul);
    return secao;
  }

  function criarAtalhosDaVisao(item, quantidade) {
    const atalhos = criar('div', 'visao__atalhos');
    const qtd = criar('div', 'passo visao__quantidade');
    const menos = criar('button', 'passo__botao', '−');
    menos.type = 'button';
    menos.setAttribute('data-item-qtd', '-1');
    menos.setAttribute('aria-label', 'Diminuir a quantidade');
    menos.disabled = quantidade <= 0;
    const mais = criar('button', 'passo__botao', '+');
    mais.type = 'button';
    mais.setAttribute('data-item-qtd', '1');
    mais.setAttribute('aria-label', 'Aumentar a quantidade');
    const valor = criar('span', 'visao__quantidade-valor', 'Qtd. ' + quantidade);
    valor.setAttribute('role', 'status');
    qtd.appendChild(menos);
    qtd.appendChild(valor);
    qtd.appendChild(mais);
    atalhos.appendChild(qtd);
    if (item.tipo === 'protecao') {
      const equipar = criar('button', 'botao botao--pequeno' + (item.equipada === true ? ' botao--ativo' : ''), item.equipada === true ? 'Equipada' : 'Equipar');
      equipar.type = 'button';
      equipar.setAttribute('data-item-equipar', '');
      equipar.setAttribute('aria-pressed', String(item.equipada === true));
      atalhos.appendChild(equipar);
    }
    return atalhos;
  }

  function desenharVisao(linha, item, d) {
    const caixa = linha.querySelector('[data-item-visao]');
    if (!caixa) return;
    const assinatura = JSON.stringify([versaoLivro, item, d, (item.melhorias || []).map(function (m) { return efeitosAbertos[m.id] === true; })]);
    if (assinaturasVisao.get(linha) === assinatura) return;
    assinaturasVisao.set(linha, assinatura);

    const quantidade = Math.max(0, Math.trunc(OP.calc.numero(item.quantidade)));
    const filhos = [criarDadosDaVisao(item, d, quantidade)];

    const chave = item.catalogo && OP.livro && OP.livro.texto(item.catalogo) ? item.catalogo : '';
    if (chave && OP.uiLivro && OP.uiLivro.criarTextoLivro) {
      const livro = criar('div', 'item__livro visao__livro');
      livro.appendChild(OP.uiLivro.criarTextoLivro(chave));
      filhos.push(livro);
    }
    if (String(item.descricao || '').trim()) filhos.push(criar('p', 'visao__texto', item.descricao));

    const melhorias = item.melhorias || [];
    if (melhorias.length) {
      const secao = criarSecaoVisao('Melhorias', melhorias.length);
      const ul = criar('ul', 'item__melhorias-lista visao__melhorias');
      melhorias.forEach(function (m, j) {
        ul.appendChild(criarLinhaLeituraMelhoria(m, d.melhorias[j] || { vale: true, ok: true, motivo: '', aumento: 0 }));
      });
      secao.appendChild(ul);
      filhos.push(secao);
    }
    if (modificadores(item).length) filhos.push(criarModificadoresDaVisao(item));
    filhos.push(criarAtalhosDaVisao(item, quantidade));
    OP.ui.substituirFilhos(caixa, filhos);
  }

  /* ------------------------------------------------------------------------
     Formulário (modo edição)
     ------------------------------------------------------------------------ */

  function assinaturaDoItem(item, d) {
    return JSON.stringify([
      versaoLivro, item.catalogo, item.tipo, item.grupo,
      (item.melhorias || []).map(function (m) { return [m.id, m.classe, m.chave, m.elemento, efeitosAbertos[m.id] === true]; }),
      d.melhorias.map(function (x) { return [x.vale, x.ok, x.motivo]; }),
      modificadores(item).map(function (m) { return m.id; })
    ]);
  }

  function desenharEfetivos(linha, item, d) {
    const chipCat = linha.querySelector('[data-efetivo-categoria]');
    const chipEsp = linha.querySelector('[data-efetivo-espacos]');
    if (chipCat) {
      const muda = d.categoriaEfetiva !== d.categoriaBase;
      if (chipCat.hidden === muda) chipCat.hidden = !muda;
      if (muda) {
        definirTexto(chipCat, '→ ' + rotuloCategoria(d.categoriaEfetiva));
        chipCat.title = 'Categoria efetiva ' + rotuloCategoria(d.categoriaEfetiva) + ' (' + textoConta(d) + ')';
      }
    }
    if (chipEsp) {
      const muda = d.espacosEfetivos !== d.espacosBase;
      if (chipEsp.hidden === muda) chipEsp.hidden = !muda;
      if (muda) {
        definirTexto(chipEsp, '→ ' + numeroTexto(d.espacosEfetivos));
        chipEsp.title = 'Espaços efetivos ' + numeroTexto(d.espacosEfetivos) + ' (base ' + numeroTexto(d.espacosBase) + ', com as melhorias)';
      }
    }
  }

  function desenharEdicao(linha, item, d, indiceItem) {
    const painel = linha.querySelector('.item__melhorias');
    const mods = linha.querySelector('.item__mods');
    if (!painel || !mods) return;
    const total = (item.melhorias || []).length;
    painel.toggleAttribute('data-sem-melhorias', total === 0);
    // texto do livro do item (dentro da descrição)
    const livro = linha.querySelector('[data-livro-item]');
    if (livro) {
      const chave = item.catalogo && OP.livro && OP.livro.texto(item.catalogo) ? item.catalogo : '';
      if (livro.getAttribute('data-chave') !== chave + '|' + versaoLivro) {
        livro.setAttribute('data-chave', chave + '|' + versaoLivro);
        livro.textContent = '';
        if (chave && OP.uiLivro && OP.uiLivro.criarTextoLivro) livro.appendChild(OP.uiLivro.criarTextoLivro(chave));
      }
    }
    definirTexto(linha.querySelector('[data-mods-impresso]'), textoImpressoDosModificadores(item));
    mods.toggleAttribute('data-sem-mods', modificadores(item).length === 0);
    definirTexto(painel.querySelector('[data-resumo-melhorias]'), textoResumo(item, d));

    const assinatura = assinaturaDoItem(item, d);
    if (assinaturas.get(linha) === assinatura) {
      atualizarCamposAbertos(linha, item);
      return;
    }
    assinaturas.set(linha, assinatura);

    const botaoLivro = painel.querySelector('[data-melhoria-livro]');
    if (botaoLivro) {
      const ha = Boolean(OP.data.catalogo && (OP.data.catalogo.melhorias || []).length);
      if (botaoLivro.hidden === ha) botaoLivro.hidden = !ha;
    }
    const lista = painel.querySelector('[data-lista-melhorias]');
    OP.ui.substituirFilhos(lista, (item.melhorias || []).map(function (m, j) {
      return criarLinhaMelhoria(item, indiceItem, m, j, d.melhorias[j] || { vale: true, ok: true, motivo: '' });
    }));
    if (focoPendente) {
      const campo = lista.querySelector('[data-melhoria-nome="' + focoPendente + '"]');
      if (campo) { campo.focus(); focoPendente = null; }
    }
    const listaMods = mods.querySelector('[data-lista-mods]');
    OP.ui.substituirFilhos(listaMods, modificadores(item).map(function (m, j) {
      return criarLinhaModificador(indiceItem, m, j);
    }));
    if (focoModPendente) {
      const campo = listaMods.querySelector('[data-mod-fonte="' + focoModPendente + '"]');
      if (campo) { campo.focus(); focoModPendente = null; }
    }
  }

  /** Campos de texto mudados de fora (desfazer, importar...) sem refazer a lista. */
  function atualizarCamposAbertos(linha, item) {
    (item.melhorias || []).forEach(function (m) {
      const nota = linha.querySelector('[data-melhoria-nota="' + m.id + '"]');
      if (nota && nota !== document.activeElement && nota.value !== m.nota) {
        nota.value = m.nota;
        nota.classList.toggle('melhoria__nota--vazia', m.nota === '');
      }
      const nome = linha.querySelector('[data-melhoria-nome="' + m.id + '"]');
      if (nome && nome !== document.activeElement && nome.value !== m.nome) nome.value = m.nome;
    });
    modificadores(item).forEach(function (m) {
      const valor = linha.querySelector('[data-mod-valor="' + m.id + '"]');
      const texto = String(OP.calc.numero(m.valor));
      if (valor && valor !== document.activeElement && valor.value !== texto) valor.value = texto;
      const fonte = linha.querySelector('[data-mod-fonte="' + m.id + '"]');
      if (fonte && fonte !== document.activeElement && fonte.value !== m.fonte) fonte.value = m.fonte;
    });
  }

  /* ------------------------------------------------------------------------
     Desenho
     ------------------------------------------------------------------------ */

  function desenharItem(linha, item, d, indiceItem) {
    const modo = modoDoItem(item);
    const aberto = modo === 'edicao' || abertos[item.id] === true;
    definirAtributo(linha, 'data-modo', modo);
    definirAtributo(linha, 'data-aberto', aberto ? 'sim' : 'nao');
    desenharTopo(linha, item, d);
    desenharBotoes(linha, item, modo, aberto);
    desenharEfetivos(linha, item, d);
    desenharEdicao(linha, item, d, indiceItem);
    if (modo === 'resumo' && aberto) desenharVisao(linha, item, d);
  }

  function desenhar(ficha, derivados) {
    if (!refs.lista) return;
    const detalhes = (derivados && derivados.inventario && derivados.inventario.itens) || {};
    const porId = Object.create(null);
    ficha.inventario.itens.forEach(function (item, indice) { porId[item.id] = { item: item, indice: indice }; });
    Array.prototype.forEach.call(refs.lista.querySelectorAll('[data-item]'), function (linha) {
      const entrada = porId[linha.dataset.item];
      const d = detalhes[linha.dataset.item];
      if (entrada && d) desenharItem(linha, entrada.item, d, entrada.indice);
    });
    if (refs.escolherItem) {
      const ha = Boolean(OP.data.catalogo && (OP.data.catalogo.itens || []).length);
      if (refs.escolherItem.hidden === ha) refs.escolherItem.hidden = !ha;
    }
  }

  /* ------------------------------------------------------------------------
     Eventos
     ------------------------------------------------------------------------ */

  function itemDoElemento(elemento) {
    const linha = elemento.closest('[data-item]');
    return linha ? linha.dataset.item : null;
  }

  function itemPorId(id) {
    const indice = indiceDoItem(id);
    return indice === -1 ? null : { item: OP.state.ficha.inventario.itens[indice], indice: indice };
  }

  function alternarCartao(idItem) {
    abertos[idItem] = !abertos[idItem];
    OP.app.redesenhar(OP.state.ficha);
  }

  function alternarEdicao(idItem) {
    editando[idItem] = !editando[idItem];
    if (!editando[idItem]) abertos[idItem] = true; // ao concluir, o cartão fica aberto para conferir
    OP.app.redesenhar(OP.state.ficha);
    if (editando[idItem]) {
      const linha = refs.lista.querySelector('[data-item="' + idItem + '"]');
      const campo = linha && linha.querySelector('.item__nome input');
      if (campo) campo.focus();
    }
  }

  function adicionarPropria(idItem) {
    const achado = itemPorId(idItem);
    if (!achado) return;
    const nova = OP.state.novaMelhoria({ classe: 'modificacao', nome: '' });
    focoPendente = nova.id;
    OP.state.atualizar('inventario.itens.' + achado.indice + '.melhorias', (achado.item.melhorias || []).concat([nova]));
  }

  function removerMelhoria(idItem, idMelhoria) {
    const achado = itemPorId(idItem);
    if (!achado) return;
    const m = (achado.item.melhorias || []).find(function (x) { return x.id === idMelhoria; });
    delete efeitosAbertos[idMelhoria];
    OP.ui.removerDeLista('inventario.itens.' + achado.indice + '.melhorias', idMelhoria, m ? String(m.nome || '').trim() : '');
  }

  function adicionarModificador(idItem) {
    const achado = itemPorId(idItem);
    if (!achado) return;
    const novo = OP.state.novoModCategoria({ valor: 1 });
    focoModPendente = novo.id;
    OP.state.atualizar('inventario.itens.' + achado.indice + '.modCategoria', modificadores(achado.item).concat([novo]));
  }

  function removerModificador(idItem, idMod) {
    const achado = itemPorId(idItem);
    if (!achado) return;
    OP.ui.removerDeLista('inventario.itens.' + achado.indice + '.modCategoria', idMod);
  }

  function passoDoModificador(idItem, idMod, passo) {
    const achado = itemPorId(idItem);
    if (!achado) return;
    const j = modificadores(achado.item).findIndex(function (m) { return m.id === idMod; });
    if (j === -1) return;
    const atual = Math.trunc(OP.calc.numero(modificadores(achado.item)[j].valor));
    OP.state.atualizar(caminhoDoModificador(achado.indice, j) + '.valor', Math.min(LIMITE_MODIFICADOR, Math.max(-LIMITE_MODIFICADOR, atual + passo)));
  }

  function mudarQuantidade(idItem, passo) {
    const achado = itemPorId(idItem);
    if (!achado) return;
    const atual = Math.max(0, Math.trunc(OP.calc.numero(achado.item.quantidade)));
    OP.state.atualizar('inventario.itens.' + achado.indice + '.quantidade', Math.max(0, atual + passo));
  }

  function alternarEquipada(idItem) {
    const achado = itemPorId(idItem);
    if (!achado) return;
    OP.state.atualizar('inventario.itens.' + achado.indice + '.equipada', achado.item.equipada !== true);
  }

  function aoClicar(evento) {
    const alvo = evento.target;
    if (!alvo || !alvo.closest || !refs.lista) return;
    const dentro = function (seletor) {
      const el = alvo.closest(seletor);
      return el && refs.lista.contains(el) ? el : null;
    };
    let el = dentro('[data-alternar-item]');
    if (el) return alternarCartao(itemDoElemento(el));
    el = dentro('[data-editar-item]');
    if (el) return alternarEdicao(itemDoElemento(el));
    el = dentro('[data-melhoria-livro]');
    if (el) {
      if (OP.uiLivro) OP.uiLivro.abrirMelhorias(itemDoElemento(el), el);
      return;
    }
    el = dentro('[data-melhoria-propria]');
    if (el) return adicionarPropria(itemDoElemento(el));
    el = dentro('[data-melhoria-remover]');
    if (el) return removerMelhoria(itemDoElemento(el), el.getAttribute('data-melhoria-remover'));
    el = dentro('[data-melhoria-efeito]');
    if (el) {
      const id = el.getAttribute('data-melhoria-efeito');
      efeitosAbertos[id] = !efeitosAbertos[id];
      OP.app.redesenhar(OP.state.ficha);
      return;
    }
    el = dentro('[data-mod-adicionar]');
    if (el) return adicionarModificador(itemDoElemento(el));
    el = dentro('[data-mod-remover]');
    if (el) return removerModificador(itemDoElemento(el), el.getAttribute('data-mod-remover'));
    el = dentro('[data-mod-passo]');
    if (el) {
      const linhaMod = el.closest('[data-mod]');
      return passoDoModificador(itemDoElemento(el), linhaMod.getAttribute('data-mod'), Number(el.getAttribute('data-mod-passo')));
    }
    el = dentro('[data-item-qtd]');
    if (el) return mudarQuantidade(itemDoElemento(el), Number(el.getAttribute('data-item-qtd')));
    el = dentro('[data-item-equipar]');
    if (el) return alternarEquipada(itemDoElemento(el));
  }

  /** Ao escolher uma natureza que implica um tipo (arma, proteção) num item "geral", o tipo acompanha. */
  function aoMudar(evento) {
    const campo = evento.target;
    if (!campo || !campo.closest || !campo.matches || !campo.matches('.item__natureza select')) return;
    const achado = itemPorId(itemDoElemento(campo));
    if (!achado) return;
    const grupo = OP.data.gruposItem.find(function (g) { return g.id === campo.value; });
    if (grupo && grupo.tipo !== 'geral' && achado.item.tipo === 'geral') OP.state.atualizar('inventario.itens.' + achado.indice + '.tipo', grupo.tipo);
  }

  /**
   * Abre o cartão do item (e a página do inventário) e põe o foco no cabeçalho dele.
   * Usado pelas Verificações ("Ir ao campo" de um aviso de item). Devolve false se o item não existe.
   */
  function mostrar(idItem) {
    if (!refs.lista || indiceDoItem(idItem) === -1) return false;
    abertos[idItem] = true;
    OP.app.redesenhar(OP.state.ficha);
    const linha = refs.lista.querySelector('[data-item="' + idItem + '"]');
    if (!linha) return false;
    if (OP.uiPaginas) OP.uiPaginas.mostrarPaginaDe(linha);
    linha.scrollIntoView({ block: 'center' });
    const alvo = linha.querySelector(linha.dataset.modo === 'edicao' ? '.item__nome input' : '[data-alternar-item]');
    if (alvo) alvo.focus({ preventScroll: true });
    return true;
  }

  /** O item saiu da lista: esquece o estado só da tela dele. */
  function esquecer(idItem) {
    delete abertos[idItem];
    delete editando[idItem];
  }

  function montar() {
    refs.lista = document.getElementById('lista-itens');
    refs.escolherItem = document.getElementById('livro-add-item');
    if (!refs.lista) return;
    document.addEventListener('click', aoClicar);
    document.addEventListener('change', aoMudar);
    if (refs.escolherItem) {
      refs.escolherItem.addEventListener('click', function () { if (OP.uiLivro) OP.uiLivro.abrirItens(refs.escolherItem); });
    }
    if (OP.livro) {
      OP.livro.aoMudar(function () {
        versaoLivro += 1;
        if (OP.app && OP.app.redesenhar) OP.app.redesenhar(OP.state.ficha); // OP.app só existe depois de main.js
      });
    }
    OP.ui.registrarExtensao({ desenhar: desenhar });
  }

  OP.uiItens = { montar: montar, esquecer: esquecer, mostrar: mostrar, livroLiberado: livroLiberado, nomeNatureza: nomeNatureza };
})(window.OP);
