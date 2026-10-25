/* ==========================================================================
   js/ui-itens.js — natureza e melhorias dos itens do inventário (OP.uiItens)
   --------------------------------------------------------------------------
   Cada item do inventário tem um botão "Natureza e melhorias" que abre um painel
   com a natureza do item (decide quais melhorias ele aceita), o resumo da conta
   (categoria base + melhorias = efetiva; espaços; Defesa), a lista de melhorias
   (modificações, maldições e regalias) e os botões para acrescentar uma do livro
   (OP.uiLivro.abrirMelhorias) ou uma própria. No item aparecem também a categoria
   efetiva e os espaços efetivos quando mudam, e o botão "Escolher do livro…" do
   inventário (OP.uiLivro.abrirItens).
   Entra no ciclo de desenho do js/ui.js (OP.ui.registrarExtensao). As contas ficam
   em js/calc.js (categoriaEfetivaItem, espacosDoItem, compatibilidadeMelhoria...).
   Textos do usuário e do livro entram só por textContent.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const abertas = Object.create(null);   // ids de itens com o painel aberto (só da tela)
  const efeitosAbertos = Object.create(null); // ids de melhorias com o texto do livro aberto
  const assinaturas = new WeakMap();     // linha do item → assinatura do que foi desenhado
  let versaoLivro = 0;                   // muda quando o conteúdo do livro chega ou some
  let focoPendente = null;               // id da melhoria nova: foco no nome depois de desenhar
  let aberturasGuardadas = null;         // painéis abertos na tela, guardados durante a impressão

  const NOMES_CLASSE = { modificacao: 'Modificação', maldicao: 'Maldição', regalia: 'Regalia' };

  function criar(tag, classe, texto) {
    return OP.ui.criarElemento(tag, classe, texto);
  }

  function definirTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
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

  function nomeNatureza(id) {
    const g = OP.data.gruposItem.find(function (x) { return x.id === id; });
    return g ? g.nome : '';
  }

  function indiceDoItem(id) {
    return OP.state.ficha.inventario.itens.findIndex(function (i) { return i.id === id; });
  }

  function caminhoDaMelhoria(indiceItem, indiceMelhoria) {
    return 'inventario.itens.' + indiceItem + '.melhorias.' + indiceMelhoria;
  }

  function livroLiberado() {
    return Boolean(OP.data.catalogo && ((OP.data.catalogo.itens || []).length || (OP.data.catalogo.melhorias || []).length));
  }

  /* ------------------------------------------------------------------------
     Resumo da conta de um item
     ------------------------------------------------------------------------ */

  function textoResumo(item, d) {
    const partes = [];
    const categoria = d.aumento > 0
      ? 'Categoria ' + rotuloCategoria(d.categoriaBase) + ' + ' + d.aumento + ' das melhorias = ' + rotuloCategoria(d.categoriaEfetiva)
      : 'Categoria ' + rotuloCategoria(d.categoriaBase);
    partes.push(categoria + (d.categoriaEfetiva > 4 ? ' (acima de IV: só com habilidades que reduzem a categoria)' : ''));
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
     Linha de uma melhoria
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
      topo.appendChild(criar('span', 'melhoria__classe', NOMES_CLASSE[melhoria.classe] || 'Melhoria'));
      if (melhoria.elemento) {
        const el = OP.data.elementos.find(function (e) { return e.id === melhoria.elemento; });
        const chip = criar('span', 'melhoria__elemento', el ? el.nome : melhoria.elemento);
        chip.setAttribute('data-elemento-livro', melhoria.elemento);
        topo.appendChild(chip);
      }
      topo.appendChild(criar('strong', 'melhoria__nome-texto', melhoria.nome || (OP.calc.melhoriaDoCatalogo(melhoria.chave) || {}).nome || 'Melhoria do livro'));
    }

    if (!estado.vale) topo.appendChild(criar('span', 'melhoria__alerta', 'repetida: não conta'));
    else if (!estado.ok) topo.appendChild(criar('span', 'melhoria__alerta', 'não combina: ' + estado.motivo));

    const acoes = criar('span', 'melhoria__acoes');
    if (!propria && OP.livro && OP.livro.texto(melhoria.chave)) {
      const ver = criar('button', 'botao botao--pequeno botao--fantasma', efeitosAbertos[melhoria.id] ? 'Ocultar efeito' : 'Ver efeito');
      ver.type = 'button';
      ver.setAttribute('aria-expanded', String(efeitosAbertos[melhoria.id] === true));
      ver.setAttribute('data-melhoria-efeito', melhoria.id);
      acoes.appendChild(ver);
    }
    const remover = criar('button', 'botao-icone botao-icone--perigo');
    remover.type = 'button';
    remover.setAttribute('data-melhoria-remover', melhoria.id);
    remover.title = 'Remover melhoria';
    remover.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 4.5h11"/><path d="M6.5 4.5V3h3v1.5"/><path d="M4 4.5l.8 9h6.4l.8-9"/></svg>';
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

  /* ------------------------------------------------------------------------
     Painel de cada item
     ------------------------------------------------------------------------ */

  function assinaturaDoItem(item, d) {
    return JSON.stringify([
      versaoLivro, abertas[item.id] === true, item.catalogo, item.tipo, item.grupo,
      (item.melhorias || []).map(function (m) { return [m.id, m.classe, m.chave, m.elemento, efeitosAbertos[m.id] === true]; }),
      d.melhorias.map(function (x) { return [x.vale, x.ok, x.motivo]; })
    ]);
  }

  function desenharEfetivos(linha, item, d) {
    const chipCat = linha.querySelector('[data-efetivo-categoria]');
    const chipEsp = linha.querySelector('[data-efetivo-espacos]');
    if (chipCat) {
      const muda = d.aumento > 0;
      if (chipCat.hidden === muda) chipCat.hidden = !muda;
      if (muda) {
        definirTexto(chipCat, '→ ' + rotuloCategoria(d.categoriaEfetiva));
        chipCat.title = 'Categoria efetiva ' + rotuloCategoria(d.categoriaEfetiva) + ' (base ' + rotuloCategoria(d.categoriaBase) + ' + ' + d.aumento + ' das melhorias)';
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

  function desenharItem(linha, item, d, indiceItem) {
    desenharEfetivos(linha, item, d);
    const botao = linha.querySelector('[data-alternar-melhorias]');
    const painel = linha.querySelector('.item__melhorias');
    if (!botao || !painel) return;
    const aberto = abertas[item.id] === true;
    if (painel.hidden === aberto) painel.hidden = !aberto;
    botao.setAttribute('aria-expanded', String(aberto));
    const total = (item.melhorias || []).length;
    const contagem = botao.querySelector('[data-contagem-melhorias]');
    if (contagem) {
      if (contagem.hidden === (total > 0)) contagem.hidden = total === 0;
      definirTexto(contagem, total > 0 ? String(total) : '');
      contagem.setAttribute('aria-hidden', 'true');
    }
    definirTexto(botao.querySelector('.visualmente-oculto'), total > 0 ? 'Natureza e melhorias (' + total + ')' : 'Natureza e melhorias');
    botao.classList.toggle('botao-icone--marcado', total > 0);
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
    const assinatura = assinaturaDoItem(item, d);
    if (assinaturas.get(linha) === assinatura) {
      atualizarCamposAbertos(linha, item);
      return;
    }
    assinaturas.set(linha, assinatura);

    const resumo = painel.querySelector('[data-resumo-melhorias]');
    definirTexto(resumo, textoResumo(item, d));
    const botaoLivro = painel.querySelector('[data-melhoria-livro]');
    if (botaoLivro) {
      const ha = Boolean(OP.data.catalogo && (OP.data.catalogo.melhorias || []).length);
      if (botaoLivro.hidden === ha) botaoLivro.hidden = !ha;
    }
    const lista = painel.querySelector('[data-lista-melhorias]');
    const filhos = (item.melhorias || []).map(function (m, j) {
      return criarLinhaMelhoria(item, indiceItem, m, j, d.melhorias[j] || { vale: true, ok: true, motivo: '' });
    });
    OP.ui.substituirFilhos(lista, filhos);
    if (focoPendente) {
      const campo = lista.querySelector('[data-melhoria-nome="' + focoPendente + '"]');
      if (campo) { campo.focus(); focoPendente = null; }
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

  function alternarPainel(idItem) {
    abertas[idItem] = !abertas[idItem];
    OP.app.redesenhar(OP.state.ficha);
    if (abertas[idItem]) {
      const linha = refs.lista.querySelector('[data-item="' + idItem + '"]');
      const campo = linha && linha.querySelector('.item__natureza select');
      if (campo) campo.focus();
    }
  }

  function adicionarPropria(idItem) {
    const indice = indiceDoItem(idItem);
    if (indice === -1) return;
    const item = OP.state.ficha.inventario.itens[indice];
    const nova = OP.state.novaMelhoria({ classe: 'modificacao', nome: '' });
    focoPendente = nova.id;
    OP.state.atualizar('inventario.itens.' + indice + '.melhorias', (item.melhorias || []).concat([nova]));
  }

  function removerMelhoria(idItem, idMelhoria) {
    const indice = indiceDoItem(idItem);
    if (indice === -1) return;
    const m = (OP.state.ficha.inventario.itens[indice].melhorias || []).find(function (x) { return x.id === idMelhoria; });
    delete efeitosAbertos[idMelhoria];
    OP.ui.removerDeLista('inventario.itens.' + indice + '.melhorias', idMelhoria, m ? String(m.nome || '').trim() : '');
  }

  function aoClicar(evento) {
    const alvo = evento.target;
    if (!alvo || !alvo.closest) return;
    const alternar = alvo.closest('[data-alternar-melhorias]');
    if (alternar && refs.lista && refs.lista.contains(alternar)) {
      alternarPainel(itemDoElemento(alternar));
      return;
    }
    const doLivro = alvo.closest('[data-melhoria-livro]');
    if (doLivro && refs.lista && refs.lista.contains(doLivro)) {
      if (OP.uiLivro) OP.uiLivro.abrirMelhorias(itemDoElemento(doLivro), doLivro);
      return;
    }
    const propria = alvo.closest('[data-melhoria-propria]');
    if (propria && refs.lista && refs.lista.contains(propria)) {
      adicionarPropria(itemDoElemento(propria));
      return;
    }
    const remover = alvo.closest('[data-melhoria-remover]');
    if (remover && refs.lista && refs.lista.contains(remover)) {
      removerMelhoria(itemDoElemento(remover), remover.getAttribute('data-melhoria-remover'));
      return;
    }
    const efeito = alvo.closest('[data-melhoria-efeito]');
    if (efeito && refs.lista && refs.lista.contains(efeito)) {
      const id = efeito.getAttribute('data-melhoria-efeito');
      efeitosAbertos[id] = !efeitosAbertos[id];
      OP.app.redesenhar(OP.state.ficha);
    }
  }

  /** Ao escolher uma natureza que implica um tipo (arma, proteção) num item "geral", o tipo acompanha. */
  function aoMudar(evento) {
    const campo = evento.target;
    if (!campo || !campo.closest || !campo.matches || !campo.matches('.item__natureza select')) return;
    const idItem = itemDoElemento(campo);
    const indice = indiceDoItem(idItem);
    if (indice === -1) return;
    const grupo = OP.data.gruposItem.find(function (g) { return g.id === campo.value; });
    const item = OP.state.ficha.inventario.itens[indice];
    if (grupo && grupo.tipo !== 'geral' && item.tipo === 'geral') OP.state.atualizar('inventario.itens.' + indice + '.tipo', grupo.tipo);
  }

  /**
   * Impressão (chamada por OP.ui.prepararImpressao e restaurarImpressao): no papel tudo sai junto,
   * então o painel dos itens que têm melhorias abre; depois volta como estava.
   */
  function imprimir(ligar) {
    const ficha = OP.state.ficha;
    if (!ficha || !refs.lista) return;
    if (ligar) {
      aberturasGuardadas = Object.assign(Object.create(null), abertas);
      ficha.inventario.itens.forEach(function (item) { if ((item.melhorias || []).length) abertas[item.id] = true; });
    } else if (aberturasGuardadas) {
      Object.keys(abertas).forEach(function (k) { delete abertas[k]; });
      Object.assign(abertas, aberturasGuardadas);
      aberturasGuardadas = null;
    }
    desenhar(ficha, OP.calc.calcularTudo(ficha));
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

  OP.uiItens = { montar: montar, imprimir: imprimir, livroLiberado: livroLiberado, nomeNatureza: nomeNatureza };
})(window.OP);
