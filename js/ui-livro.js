/* ==========================================================================
   js/ui-livro.js — o livro na ficha (OP.uiLivro)
   --------------------------------------------------------------------------
   Só aparece com o conteúdo do livro liberado por código (js/livro.js):
   - seletores grandes de origem (título e setinha: descrição, poder e perícias) e de trilha (habilidades por NEX com a descrição);
   - "Escolher do livro" para poderes e rituais, com texto e efeitos;
   - Efeitos automáticos (página Habilidades): o que cada fonte faz sozinha e os
     botões de preparar gasto, ativar e usar;
   - Poderes para o próximo teste (página Rolagens) e Efeitos ativos (Combate).
   Os números vêm do OP.calc (estadoEfeitos); o texto do livro vem do servidor e
   só entra por textContent. Nada é guardado no navegador além do que a ficha
   já guarda (chaves e escolhas).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const abertos = Object.create(null);   // chave → texto aberto (só da tela)
  let assinatura = '';
  let derivadosAtuais = null;

  /* ------------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------------ */

  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null && texto !== '') e.textContent = texto;
    return e;
  }

  function botao(texto, classe, atributos) {
    const b = el('button', classe || 'botao botao--pequeno', texto);
    b.type = 'button';
    Object.keys(atributos || {}).forEach(function (k) { b.setAttribute(k, atributos[k]); });
    return b;
  }

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function ficha() {
    return OP.state.ficha;
  }

  function aviso(tipo, texto) {
    if (OP.uiApp && OP.uiApp.aviso) OP.uiApp.aviso(tipo, texto);
  }

  function nomePericia(id) {
    const p = OP.data.pericias.find(function (x) { return x.id === id; });
    return p ? p.nome : String(id);
  }

  function siglaAtributo(id) {
    const a = OP.data.atributos.find(function (x) { return x.id === id; });
    return a ? a.sigla : String(id).toUpperCase();
  }

  function nomeElemento(id) {
    const e = OP.data.elementos.find(function (x) { return x.id === id; });
    return e ? e.nome : String(id || '');
  }

  function nomeFonte(id) {
    return (OP.data.fontes && OP.data.fontes[id]) || id || '';
  }

  function sinal(n) {
    return (n < 0 ? '−' : '+') + Math.abs(n);
  }

  const NOMES_TIPO = { origem: 'Origem', classe: 'Classe', trilha: 'Trilha', poder: 'Poder', ritual: 'Ritual' };

  /* ------------------------------------------------------------------------
     Texto do efeito, escrito a partir dos números (sem o texto do livro)
     ------------------------------------------------------------------------ */

  function textoValor(v) {
    if (typeof v === 'number') return sinal(v);
    if (!v || typeof v !== 'object') return '';
    if (v.nivel !== undefined) return sinal(v.nivel) + ' a cada 5% de NEX';
    if (v.atr !== undefined) return (v.x !== undefined && v.x !== 1 ? sinal(v.x) + '× ' : '+') + siglaAtributo(v.atr);
    if (Array.isArray(v.tabela)) return v.tabela.map(function (p) { return 'NEX ' + p[0] + '%: ' + sinal(p[1]); }).join(', ');
    if (Array.isArray(v.soma)) return v.soma.map(textoValor).join(' ');
    if (v.metade !== undefined) return 'metade de ' + textoValor(v.metade).replace(/^\+/, '');
    return '';
  }

  function textoAlvoPericia(id) {
    if (id === 'todas' || id === undefined) return 'todas as perícias';
    if (typeof id === 'string') return nomePericia(id);
    if (Array.isArray(id)) return id.map(nomePericia).join(', ');
    if (id && id.atr) return 'perícias de ' + siglaAtributo(id.atr);
    if (id && id.escolha) return 'a perícia escolhida';
    return '';
  }

  function textoCondicao(se) {
    if (!se) return '';
    const p = [];
    if (se.nex !== undefined) p.push('NEX ' + se.nex + '%+');
    if (se.afinidade !== undefined) p.push('com afinidade' + (typeof se.afinidade === 'string' && se.afinidade !== 'qualquer' ? ' de ' + nomeElemento(se.afinidade) : ''));
    if (se.semAfinidade !== undefined) p.push('sem afinidade' + (typeof se.semAfinidade === 'string' && se.semAfinidade !== 'qualquer' ? ' de ' + nomeElemento(se.semAfinidade) : ''));
    if (se.treinado !== undefined) p.push('treinado em ' + nomePericia(se.treinado));
    if (se.classe !== undefined) p.push('classe ' + se.classe);
    if (se.forma !== undefined) p.push('forma ' + [].concat(se.forma).join('/'));
    return p.length ? ' (' + p.join(', ') + ')' : '';
  }

  function textoEfeito(ef) {
    const v = textoValor(ef.v);
    let t = '';
    switch (ef.k) {
      case 'pv': case 'pe': case 'san': t = ef.k.toUpperCase() + ' máximo ' + v; break;
      case 'def': t = 'Defesa ' + v; break;
      case 'desl': t = 'deslocamento ' + v + ' m'; break;
      case 'dt': t = 'DT dos rituais ' + v; break;
      case 'limitePE': t = 'limite de PE por turno ' + v; break;
      case 'carga': t = 'carga ' + v + ' espaços'; break;
      case 'cura': t = 'PV curados ' + v; break;
      case 'danoRitual': t = 'dano dos rituais ' + v; break;
      case 'curaRitual': t = 'cura dos rituais ' + v; break;
      case 'per': t = textoAlvoPericia(ef.id) + ' ' + v; break;
      case 'treino': t = 'treinamento em ' + textoAlvoPericia(ef.id) + ' (ou +2 se já treinado)'; break;
      case 'rd': t = 'RD ' + (ef.tipo === 'todos' ? 'a todo dano' : ef.tipo === 'fisico' ? 'física' : ef.tipo) + ' ' + v; break;
      case 'dados': t = v + 'd20 em ' + (ef.alvo === 'ataque' ? 'ataques' : ef.alvo === 'atributo' ? 'testes de ' + siglaAtributo(ef.id) : textoAlvoPericia(ef.id)); break;
      case 'ataque': t = 'testes de ataque ' + v; break;
      case 'dano': t = 'dano dos ataques ' + v; break;
      case 'margem': t = 'margem de ameaça ' + v; break;
      case 'custoRitual': t = 'custo dos rituais ' + v + ' PE'; break;
      default: return '';
    }
    return t + textoCondicao(ef.se);
  }

  function textoQuando(q) {
    const p = [];
    if (q.dano !== undefined) p.push('no dano ' + (q.dano === 'corpo' ? 'corpo a corpo' : q.dano === 'distancia' ? 'à distância' : 'dos ataques'));
    else if (q.ataque !== undefined) p.push('nos ataques' + (q.ataque === 'corpo' ? ' corpo a corpo' : q.ataque === 'distancia' ? ' à distância' : ''));
    if (q.pericia !== undefined) p.push('em ' + (q.pericia === 'todas' ? 'qualquer perícia' : q.pericia.map(nomePericia).join(', ')));
    if (q.atr !== undefined) p.push('em perícias de ' + q.atr.map(siglaAtributo).join(' ou '));
    if (q.resistencia) p.push('em testes de resistência');
    if (q.exceto !== undefined && q.exceto.length) p.push('exceto ' + q.exceto.map(nomePericia).join(', '));
    return p.join(' ');
  }

  function textoGasto(g) {
    const efeito = [];
    if (g.bonus !== undefined) efeito.push(textoValor(g.bonus));
    if (g.dados !== undefined) efeito.push(sinal(g.dados) + 'd20');
    if (g.dano !== undefined) efeito.push(textoValor(g.dano) + ' de dano');
    const custo = typeof g.custo === 'number' ? (g.custo ? g.custo + ' PE' : 'sem custo') : 'custo por NEX';
    return custo + ': ' + efeito.join(' e ') + ' ' + textoQuando(g.quando || {}) + textoCondicao(g.se);
  }

  function textoDuracao(a) {
    if (a.duracao === 'cena') return 'até o fim da cena';
    if (a.duracao === 'rodadas') return a.rodadas + (a.rodadas === 1 ? ' rodada' : ' rodadas');
    return 'até desligar';
  }

  /** Frases sobre o que a ficha faz sozinha numa definição (sem ficha): [{ tipo, texto }]. */
  function descreverDefinicao(def) {
    const linhas = [];
    if (!def) return linhas;
    (def.passivos || []).forEach(function (ef) { const t = textoEfeito(ef); if (t) linhas.push({ tipo: 'Sempre', texto: t }); });
    (def.gastos || []).forEach(function (g) { linhas.push({ tipo: 'Gasto opcional', texto: (g.nome ? g.nome + ' — ' : '') + textoGasto(g) }); });
    if (def.ativavel) {
      const a = def.ativavel;
      const efs = (a.passivos || []).map(textoEfeito).filter(Boolean).join('; ');
      linhas.push({ tipo: 'Ativável', texto: (typeof a.custo === 'number' ? (a.custo ? a.custo + ' PE' : 'sem custo') : 'custo por NEX') + ', ' + textoDuracao(a) + ': ' + efs + textoCondicao(a.se) });
    }
    (def.usos || []).forEach(function (u) {
      const acao = u.tipo === 'cura' ? 'cura' : u.tipo === 'dano' ? 'dano' : 'rolagem';
      linhas.push({ tipo: 'Botão', texto: u.nome + ' — ' + (u.custo ? u.custo + ' PE: ' : '') + acao + ' ' + u.rolar + (u.perde ? ' (perde ' + Object.keys(u.perde).map(function (k) { return u.perde[k] + ' ' + k.toUpperCase(); }).join(', ') + ')' : '') + textoCondicao(u.se) });
    });
    if (def.formas) {
      Object.keys(def.formas).forEach(function (f) {
        const x = def.formas[f];
        if (x.dano) linhas.push({ tipo: 'Ritual (' + f + ')', texto: 'dano ' + x.dano });
        if (x.cura) linhas.push({ tipo: 'Ritual (' + f + ')', texto: 'cura ' + x.cura });
      });
    }
    return linhas;
  }

  /* ------------------------------------------------------------------------
     Texto do livro (do servidor)
     ------------------------------------------------------------------------ */

  /** Linhas "Rótulo: texto" viram { rotulo, texto }; o resto é parágrafo. A 1ª linha (cabeçalho) vai à parte. */
  function blocosDoTexto(corpo) {
    const linhas = String(corpo || '').split('\n').filter(function (l) { return l.trim() !== ''; });
    const cabecalho = linhas.length ? linhas.shift() : '';
    const blocos = linhas.map(function (l) {
      const m = /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^:]{0,45}?): (.*)$/.exec(l);
      return m ? { rotulo: m[1], texto: m[2] } : { rotulo: '', texto: l };
    });
    return { cabecalho: cabecalho, blocos: blocos };
  }

  function acessoDisponivel() {
    return Boolean(OP.conta && OP.conta.estado && OP.conta.estado.disponivel);
  }

  /** Elemento com o texto do livro de uma chave, ou um aviso de que ele não está liberado. */
  function criarTextoLivro(chave, ignorar) {
    const caixa = el('div', 'livro-texto');
    const t = OP.livro && OP.livro.texto(chave);
    if (!t) {
      caixa.appendChild(el('p', 'livro-texto__nota', acessoDisponivel()
        ? 'O texto do livro não está liberado nesta conta. Entre em Conta e resgate um código.'
        : 'O texto do livro só aparece com a conta e um código de acesso.'));
      return caixa;
    }
    const partes = blocosDoTexto(t.corpo);
    if (partes.cabecalho) caixa.appendChild(el('p', 'livro-texto__cabecalho', partes.cabecalho));
    partes.blocos.forEach(function (b) {
      if (ignorar && ignorar.indexOf(b.rotulo) !== -1) return;
      const p = el('p', 'livro-texto__bloco');
      if (b.rotulo) p.appendChild(el('strong', '', b.rotulo + '. '));
      p.appendChild(document.createTextNode(b.texto));
      caixa.appendChild(p);
    });
    return caixa;
  }

  function criarListaEfeitos(def) {
    const linhas = descreverDefinicao(def);
    if (!linhas.length) return null;
    const caixa = el('div', 'livro-auto');
    caixa.appendChild(el('p', 'livro-auto__titulo', 'O que a ficha faz sozinha'));
    const ul = el('ul', 'livro-auto__lista');
    linhas.forEach(function (l) {
      const li = el('li');
      li.appendChild(el('span', 'livro-auto__tipo', l.tipo));
      li.appendChild(document.createTextNode(' ' + l.texto));
      ul.appendChild(li);
    });
    caixa.appendChild(ul);
    return caixa;
  }

  /* ------------------------------------------------------------------------
     Diálogo de escolha (origem, poderes, rituais)
     ------------------------------------------------------------------------ */

  const lista = { config: null, itens: [], aba: 'todos', sel: Object.create(null), busca: '', expandidos: Object.create(null), gatilho: null };

  /** Grupos de filtro que valem na aba atual (cada um pode se esconder em certas abas). */
  function gruposVisiveis() {
    const grupos = (lista.config && lista.config.filtros) || [];
    return grupos.filter(function (g) { return !(g.escondeEm && g.escondeEm.indexOf(lista.aba) !== -1); });
  }

  function grupoCasa(item, g) {
    const marcados = lista.sel[g.id] || [];
    if (!marcados.length) return true;
    const valores = (item.filtros && item.filtros[g.id]) || [];
    return valores.some(function (v) { return marcados.indexOf(v) !== -1; });
  }

  /**
   * Um item aparece quando casa com a aba, com a busca e com todos os grupos de filtro:
   * dentro de um grupo, qualquer marcado serve (1º OU 2º círculo); entre grupos, todos valem (círculo E elemento).
   * `ignorar` deixa um grupo de fora (para contar quanto cada botão daria).
   */
  function itemCasa(item, ignorar) {
    // config.buscaEmTodas: digitando na busca, vale todas as abas (itens e melhorias têm muitas abas)
    const buscando = Boolean(lista.config && lista.config.buscaEmTodas) && normalizar(lista.busca) !== '';
    if (!buscando && lista.aba !== 'todos' && item.abas && item.abas.indexOf(lista.aba) === -1) return false;
    if (!gruposVisiveis().every(function (g) { return g.id === ignorar || grupoCasa(item, g); })) return false;
    const termo = normalizar(lista.busca);
    return !termo || normalizar(item.busca || item.titulo).indexOf(termo) !== -1;
  }

  function haFiltros() {
    return gruposVisiveis().some(function (g) { return (lista.sel[g.id] || []).length > 0; });
  }

  function desenharLista() {
    const filtrados = lista.itens.filter(itemCasa);
    const raiz = refs.lista;
    raiz.textContent = '';
    let grupoAtual = null;
    let bloco = null;
    filtrados.forEach(function (item) {
      if (item.grupo && item.grupo !== grupoAtual) {
        grupoAtual = item.grupo;
        // Cada grupo é um bloquinho; os de elemento levam a cor dele (data-elemento)
        bloco = el('div', 'livro-bloco');
        bloco.setAttribute('role', 'group');
        bloco.setAttribute('aria-label', item.grupo);
        if (item.elemento) bloco.setAttribute('data-elemento-livro', item.elemento);
        bloco.appendChild(el('h3', 'livro-lista__grupo', item.grupo));
        raiz.appendChild(bloco);
      }
      (bloco && item.grupo ? bloco : raiz).appendChild(criarLinha(item));
    });
    refs.vazio.hidden = filtrados.length > 0;
    if (refs.resultado) {
      const total = lista.itens.filter(function (i) { return !i.semContagem && (lista.aba === 'todos' || !i.abas || i.abas.indexOf(lista.aba) !== -1); }).length;
      const filtrando = haFiltros() || normalizar(lista.busca) !== '';
      const mostrados = filtrados.filter(function (i) { return !i.semContagem; }).length;
      refs.resultado.textContent = filtrando ? 'Mostrando ' + mostrados + ' de ' + total : total + ' no total';
    }
    if (refs.limpar) refs.limpar.hidden = !haFiltros();
  }

  function criarLinha(item) {
    const aberta = lista.expandidos[item.id] === true;
    const linha = el('div', 'livro-item' + (aberta ? ' livro-item--aberto' : ''));
    const topo = el('div', 'livro-item__linha');
    const idDetalhes = 'livro-det-' + item.id;
    const alternar = el('button', 'livro-item__alternar');
    alternar.type = 'button';
    alternar.setAttribute('aria-expanded', String(aberta));
    alternar.setAttribute('aria-controls', idDetalhes);
    alternar.appendChild(el('span', 'livro-item__seta'));
    alternar.lastChild.setAttribute('aria-hidden', 'true');
    const textos = el('span', 'livro-item__textos');
    textos.appendChild(el('span', 'livro-item__titulo', item.titulo));
    if (item.meta) textos.appendChild(el('span', 'livro-item__meta', item.meta));
    alternar.appendChild(textos);
    alternar.addEventListener('click', function () {
      lista.expandidos[item.id] = !(lista.expandidos[item.id] === true);
      desenharLista();
      const novo = refs.lista.querySelector('[aria-controls="' + idDetalhes + '"]');
      if (novo) novo.focus();
    });
    topo.appendChild(alternar);
    // Uma ação (item.acao) ou várias (item.acoes, ex.: "Adicionar" e "Adicionar com ataque")
    (item.acoes || (item.acao ? [item.acao] : [])).forEach(function (acao) {
      const a = el('button', 'livro-acao' + (acao.primaria ? ' livro-acao--primaria' : ''));
      a.type = 'button';
      if (acao.icone) {
        const icone = el('span', 'livro-acao__icone livro-acao__icone--' + acao.icone);
        icone.setAttribute('aria-hidden', 'true');
        a.appendChild(icone);
      }
      a.appendChild(el('span', 'livro-acao__texto', acao.rotulo));
      a.disabled = acao.desativada === true;
      a.setAttribute('aria-label', acao.rotulo + ': ' + item.titulo);
      a.addEventListener('click', function () { acao.aoClicar(item); });
      topo.appendChild(a);
    });
    linha.appendChild(topo);
    const detalhes = el('div', 'livro-item__detalhes');
    detalhes.id = idDetalhes;
    detalhes.hidden = !aberta;
    if (aberta && item.detalhes) item.detalhes(detalhes);
    linha.appendChild(detalhes);
    return linha;
  }

  function mensagemDialogo(texto) {
    refs.mensagem.hidden = !texto;
    refs.mensagem.textContent = texto || '';
  }

  function contarAba(id) {
    // semContagem: linhas de apoio (ex.: "Regras do livro") não entram nas contas
    const contaveis = lista.itens.filter(function (i) { return !i.semContagem; });
    return id === 'todos' ? contaveis.length : contaveis.filter(function (i) { return i.abas && i.abas.indexOf(id) !== -1; }).length;
  }

  function gruposDaConfig() {
    return (lista.config && lista.config.filtros) || [];
  }

  /** Abas (uma só vale) e filtros de uso (marcam-se e desmarcam-se), com a contagem de cada um. */
  function desenharControles() {
    const c = lista.config;
    refs.abas.textContent = '';
    refs.abas.hidden = !c.abas || !c.abas.length;
    (c.abas || []).forEach(function (aba) {
      const b = el('button', 'livro-aba');
      b.type = 'button';
      b.setAttribute('data-livro-aba', aba.id);
      b.setAttribute('aria-pressed', String(aba.id === lista.aba));
      b.appendChild(el('span', 'livro-aba__nome', aba.nome));
      b.appendChild(el('span', 'livro-aba__n', String(contarAba(aba.id))));
      b.addEventListener('click', function () {
        lista.aba = aba.id;
        gruposDaConfig().forEach(function (g) { if (g.escondeEm && g.escondeEm.indexOf(lista.aba) !== -1) lista.sel[g.id] = []; });
        desenharControles();
        desenharLista();
        refs.lista.scrollTop = 0;
        const novo = refs.abas.querySelector('[data-livro-aba="' + aba.id + '"]');
        if (novo) novo.focus();
      });
      refs.abas.appendChild(b);
    });
    desenharFiltros();
  }

  /**
   * Filtros em grupos independentes (ex.: Círculo e Elemento). Todos começam desligados (mostra tudo);
   * cada botão liga e desliga; o número é quantos itens apareceriam ao marcá-lo com os outros grupos como estão.
   */
  function desenharFiltros() {
    const grupos = gruposVisiveis();
    refs.abas2.textContent = '';
    refs.abas2.hidden = !grupos.length;
    if (!grupos.length) return;
    grupos.forEach(function (g) {
      const linha = el('div', 'livro-filtros__grupo');
      linha.setAttribute('role', 'group');
      linha.setAttribute('aria-label', g.rotulo);
      linha.appendChild(el('span', 'livro-filtros__rotulo', g.rotulo));
      g.itens.forEach(function (filtro) {
        const n = lista.itens.filter(function (i) {
          return !i.semContagem && itemCasa(i, g.id) && i.filtros && i.filtros[g.id] && i.filtros[g.id].indexOf(filtro.id) !== -1;
        }).length;
        const marcado = (lista.sel[g.id] || []).indexOf(filtro.id) !== -1;
        const b = el('button', 'livro-filtro' + (n === 0 && !marcado ? ' livro-filtro--vazio' : ''));
        b.type = 'button';
        b.setAttribute('data-livro-filtro', filtro.id);
        b.setAttribute('data-livro-grupo', g.id);
        b.setAttribute('aria-pressed', String(marcado));
        b.appendChild(el('span', 'livro-filtro__ponto'));
        b.lastChild.setAttribute('aria-hidden', 'true');
        b.appendChild(el('span', 'livro-filtro__nome', filtro.nome));
        b.appendChild(el('span', 'livro-filtro__n', String(n)));
        b.addEventListener('click', function () {
          const atual = lista.sel[g.id] || [];
          lista.sel[g.id] = marcado ? atual.filter(function (u) { return u !== filtro.id; }) : atual.concat([filtro.id]);
          redesenharAposFiltro(g.id, filtro.id);
        });
        linha.appendChild(b);
      });
      refs.abas2.appendChild(linha);
    });
  }

  function redesenharAposFiltro(grupo, filtro) {
    desenharControles();
    desenharLista();
    refs.lista.scrollTop = 0;
    const novo = refs.abas2.querySelector('[data-livro-grupo="' + grupo + '"][data-livro-filtro="' + filtro + '"]');
    if (novo) novo.focus();
  }

  /**
   * Abre o diálogo de escolha. config: { titulo, dica, busca, abas: [{id,nome}], itens, gatilho,
   * abaInicial, filtros, selecaoInicial: { <grupo>: [ids marcados ao abrir] }, buscaEmTodas }.
   * item: { id, titulo, meta, grupo, abas, busca, marcado, semContagem, detalhes(corpo),
   * acao: { rotulo, aoClicar, desativada, primaria } ou acoes: [acao, ...] }.
   */
  function abrirLista(config) {
    lista.config = config;
    lista.itens = config.itens;
    lista.aba = config.abaInicial || 'todos';
    lista.sel = Object.create(null);
    Object.keys(config.selecaoInicial || {}).forEach(function (grupo) { lista.sel[grupo] = config.selecaoInicial[grupo].slice(); });
    lista.busca = '';
    lista.expandidos = Object.create(null);
    lista.gatilho = config.gatilho || null;
    refs.titulo.textContent = config.titulo;
    refs.dica.textContent = config.dica || '';
    refs.dica.hidden = !config.dica;
    refs.busca.value = '';
    refs.busca.placeholder = config.busca || 'Buscar…';
    mensagemDialogo('');
    desenharControles();
    desenharLista();
    if (!refs.dialogo.open) refs.dialogo.showModal();
    refs.lista.scrollTop = 0;
  }

  function fecharLista() {
    if (refs.dialogo.open) refs.dialogo.close();
  }

  /* ------------------------------------------------------------------------
     Origem
     ------------------------------------------------------------------------ */

  function detalhesDeOrigem(origem, chave) {
    return function (corpo) {
      const pericias = origem.pericias.length
        ? origem.pericias.map(nomePericia).join(', ')
        : (origem.escolha && origem.escolha.nota ? origem.escolha.nota : 'conforme a escolha');
      const t = OP.livro && chave ? OP.livro.texto(chave) : null;
      let descricao = '';
      let efeito = '';
      if (t) {
        blocosDoTexto(t.corpo).blocos.forEach(function (b) {
          if (b.rotulo === 'Descrição') descricao = b.texto;
          else if (b.rotulo === 'Efeito do poder') efeito = b.texto;
        });
      }
      if (descricao) corpo.appendChild(el('p', 'livro-item__descricao', descricao));
      const poder = el('div', 'livro-item__poder');
      poder.appendChild(el('p', 'livro-item__rotulo', 'Poder da origem'));
      poder.appendChild(el('p', 'livro-item__valor', origem.habilidade || '—'));
      if (efeito) poder.appendChild(el('p', 'livro-item__descricao', efeito));
      corpo.appendChild(poder);
      const per = el('div', 'livro-item__poder');
      per.appendChild(el('p', 'livro-item__rotulo', 'Perícias treinadas'));
      per.appendChild(el('p', 'livro-item__valor', pericias + (origem.profissao ? ' (' + origem.profissao + ')' : '')));
      corpo.appendChild(per);
      if (!t) {
        corpo.appendChild(el('p', 'livro-texto__nota', acessoDisponivel()
          ? 'A descrição e o efeito do poder aparecem aqui quando o conteúdo do livro estiver liberado nesta conta (botão Conta).'
          : 'A descrição e o efeito do poder aparecem aqui com a conta e um código de acesso.'));
      }
      const auto = chave ? criarListaEfeitos(OP.data.efeitos[chave]) : null;
      if (auto) corpo.appendChild(auto);
    };
  }

  /** Abre o seletor grande de origem no lugar da lista nativa. select é o <select> da origem. */
  function abrirOrigem(select, gatilho) {
    const catalogo = OP.data.catalogo || {};
    const itens = [];
    Array.prototype.forEach.call(select.querySelectorAll('option'), function (opcao) {
      if (opcao.disabled && opcao.value === '') return;
      const grupo = opcao.parentElement && opcao.parentElement.tagName === 'OPTGROUP' ? opcao.parentElement.label : '';
      const atual = select.value === opcao.value;
      const origem = OP.data.origens.find(function (o) { return o.id === opcao.value; });
      const item = {
        id: 'origem-' + (opcao.value || 'nenhuma'),
        titulo: opcao.value === '' ? 'Nenhuma' : opcao.textContent.replace(/\s+/g, ' ').trim(),
        grupo: opcao.value === '' || opcao.value === 'outra' ? '' : grupo,
        marcado: atual ? 'Atual' : '',
        busca: opcao.textContent + ' ' + (origem ? origem.pericias.map(nomePericia).join(' ') + ' ' + origem.habilidade : ''),
        meta: origem ? (origem.pericias.length ? origem.pericias.map(nomePericia).join(', ') : 'duas perícias à escolha') : '',
        acao: {
          rotulo: atual ? 'Escolhida' : 'Escolher',
          desativada: atual,
          primaria: !atual,
          icone: atual ? 'ok' : '',
          aoClicar: function () {
            select.value = opcao.value;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            fecharLista();
            if (gatilho) gatilho.focus();
          }
        }
      };
      if (origem) item.detalhes = detalhesDeOrigem(origem, catalogo.origens ? catalogo.origens[origem.id] : '');
      else if (opcao.value === 'outra') {
        item.detalhes = function (corpo) { corpo.appendChild(el('p', 'livro-texto__nota', 'Digite o nome da origem no campo que aparece ao lado. A ficha não calcula o poder dessa origem.')); };
      }
      itens.push(item);
    });
    abrirLista({
      titulo: 'Escolher a origem',
      dica: 'Toque na seta para ver a descrição, o poder e as perícias de cada origem.',
      busca: 'Buscar origem, perícia ou poder…',
      itens: itens,
      gatilho: gatilho
    });
  }

  /* ------------------------------------------------------------------------
     Trilha
     ------------------------------------------------------------------------ */

  /** Marcos da trilha em ordem: [{ marco, nome, chave }] (chave do texto do livro, '' sem o conteúdo). */
  function marcosDaTrilha(trilha) {
    const cat = (OP.data.catalogo && OP.data.catalogo.trilhas && OP.data.catalogo.trilhas[trilha.id]) || {};
    return Object.keys(trilha.habilidades).map(Number).sort(function (a, b) { return a - b; }).map(function (marco) {
      return { marco: marco, nome: trilha.habilidades[String(marco)], chave: cat[String(marco)] || '' };
    });
  }

  function detalhesDeTrilha(trilha) {
    return function (corpo) {
      const classe = OP.calc.classeDados(trilha.classe);
      const estagio = classe && classe.unidadeProgressao === 'estagio';
      const marcos = marcosDaTrilha(trilha);
      let faltouTexto = false;
      marcos.forEach(function (m) {
        const bloco = el('div', 'livro-item__poder');
        bloco.appendChild(el('p', 'livro-item__rotulo', (estagio ? 'Estágio ' + m.marco : 'NEX ' + m.marco + '%') + ' · ' + m.nome));
        const t = m.chave && OP.livro ? OP.livro.texto(m.chave) : null;
        if (t) {
          blocosDoTexto(t.corpo).blocos.forEach(function (b) {
            const p = el('p', 'livro-item__descricao');
            if (b.rotulo) p.appendChild(el('strong', '', b.rotulo + '. '));
            p.appendChild(document.createTextNode(b.texto));
            bloco.appendChild(p);
          });
        } else faltouTexto = true;
        corpo.appendChild(bloco);
      });
      if (faltouTexto) {
        corpo.appendChild(el('p', 'livro-texto__nota', acessoDisponivel()
          ? 'As descrições aparecem aqui quando o conteúdo do livro estiver liberado nesta conta (botão Conta).'
          : 'As descrições aparecem aqui com a conta e um código de acesso.'));
      }
    };
  }

  /** Abre o seletor grande de trilha no lugar da lista nativa: cada trilha mostra as habilidades por NEX e as descrições. */
  function abrirTrilha(select, gatilho) {
    const itens = [];
    Array.prototype.forEach.call(select.querySelectorAll('option'), function (opcao) {
      if (opcao.disabled && opcao.value === '') return;
      const grupo = opcao.parentElement && opcao.parentElement.tagName === 'OPTGROUP' ? opcao.parentElement.label : '';
      const atual = select.value === opcao.value;
      const trilha = OP.calc.trilhaDados(opcao.value);
      const nomes = trilha ? marcosDaTrilha(trilha).map(function (m) { return m.nome; }) : [];
      const item = {
        id: 'trilha-' + (opcao.value || 'nenhuma'),
        titulo: opcao.value === '' ? 'Nenhuma' : opcao.textContent.replace(/\s+/g, ' ').trim(),
        grupo: opcao.value === '' || opcao.value === 'outra' ? '' : grupo,
        marcado: atual ? 'Atual' : '',
        busca: opcao.textContent + ' ' + nomes.join(' '),
        meta: nomes.join(' · '),
        acao: {
          rotulo: atual ? 'Escolhida' : 'Escolher',
          desativada: atual,
          primaria: !atual,
          icone: atual ? 'ok' : '',
          aoClicar: function () {
            select.value = opcao.value;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            fecharLista();
            if (gatilho) gatilho.focus();
          }
        }
      };
      if (trilha) item.detalhes = detalhesDeTrilha(trilha);
      else if (opcao.value === 'outra') {
        item.detalhes = function (corpo) { corpo.appendChild(el('p', 'livro-texto__nota', 'Digite o nome da trilha no campo que aparece ao lado e cadastre as habilidades em Habilidades e poderes.')); };
      }
      itens.push(item);
    });
    abrirLista({
      titulo: 'Escolher a trilha',
      dica: 'Toque na seta para ver as habilidades da trilha em cada NEX, com a descrição.',
      busca: 'Buscar trilha ou habilidade…',
      itens: itens,
      gatilho: gatilho
    });
  }

  /* ------------------------------------------------------------------------
     Poderes e rituais do livro
     ------------------------------------------------------------------------ */

  function chaveNaFicha(tipo, chave) {
    const f = ficha();
    return (tipo === 'ritual' ? f.rituais : f.habilidades).some(function (x) { return x.catalogo === chave; });
  }

  function adicionarPoder(p) {
    const e = OP.data.efeitos[p.id] || {};
    const nova = OP.state.novaHabilidade({ nome: p.nome, fonte: p.tipo === 'classe' ? 'classe' : 'poder', catalogo: p.id });
    if (e.ativavel && typeof e.ativavel.custo === 'number') nova.custoPE = 0;
    OP.state.atualizar('habilidades', OP.state.obter('habilidades').concat([nova]));
    mensagemDialogo(p.nome + ' foi para a lista de habilidades.');
  }

  function formaDoCatalogo(r, id) {
    const f = r[id];
    if (!f) return null;
    const forma = { ativa: true, custoAdicional: f.custoAdicional || 0 };
    if (f.requerCirculo) forma.requerCirculo = f.requerCirculo;
    if (f.requerAfinidade) forma.requerAfinidade = true;
    return forma;
  }

  /** Ritual novo preenchido com o que o catálogo e os efeitos sabem. */
  function criarRitualDoCatalogo(r) {
    const e = OP.data.efeitos[r.id] || {};
    const formas = { padrao: {} };
    const discente = formaDoCatalogo(r, 'discente');
    const verdadeira = formaDoCatalogo(r, 'verdadeira');
    if (discente) formas.discente = discente;
    if (verdadeira) formas.verdadeira = verdadeira;
    ['padrao', 'discente', 'verdadeira'].forEach(function (id) {
      const x = e.formas && e.formas[id];
      if (!x) return;
      if (id !== 'padrao' && !formas[id]) return;
      formas[id] = formas[id] || {};
      if (x.dano) formas[id].dano = x.dano;
      if (x.cura) formas[id].cura = x.cura;
    });
    const dados = {
      nome: r.nome, circulo: r.circulo, elemento: r.elemento || '', execucao: r.execucao || '', alcance: r.alcance || '',
      alvo: r.alvo || '', area: r.area || '', duracao: r.duracao || '', catalogo: r.id, formas: formas
    };
    if (r.resistencia) dados.resistencia = { teste: r.resistencia.teste || '', efeito: r.resistencia.efeito || '' };
    return OP.state.novoRitual(dados);
  }

  function adicionarRitual(r) {
    OP.state.atualizar('rituais', OP.state.obter('rituais').concat([criarRitualDoCatalogo(r)]));
    mensagemDialogo(r.nome + ' foi para a lista de rituais.');
  }

  function metaDoRitual(r) {
    const partes = [nomeElemento(r.elemento) || 'vários elementos', r.circulo + 'º círculo'];
    if (r.execucao) partes.push(r.execucao);
    if (r.alcance) partes.push(r.alcance);
    return partes.join(' · ');
  }

  function detalhesDoCatalogo(chave, extra) {
    return function (corpo) {
      if (extra) {
        const m = el('p', 'livro-item__descricao');
        m.textContent = extra;
        corpo.appendChild(m);
      }
      corpo.appendChild(criarTextoLivro(chave));
      const auto = criarListaEfeitos(OP.data.efeitos[chave]);
      if (auto) corpo.appendChild(auto);
    };
  }

  // Poderes paranormais: os quatro elementos primeiro, depois Transmissão e Intenção, e por fim os de vários elementos
  const GRUPOS_PARANORMAIS = [
    { id: 'conhecimento', nome: 'Conhecimento' },
    { id: 'sangue', nome: 'Sangue' },
    { id: 'energia', nome: 'Energia' },
    { id: 'morte', nome: 'Morte' },
    { id: 'transmissao', nome: 'Transmissão' },
    { id: 'intencao', nome: 'Intenção' },
    { id: 'varios', nome: 'Vários elementos' }
  ];

  const CLASSES_COM_PODERES = ['combatente', 'especialista', 'ocultista'];
  const USOS_PODER = [
    { id: 'combate', nome: 'Combate', titulo: 'Combate' },
    { id: 'ambos', nome: 'Ambos', titulo: 'Combate e utilidade' },
    { id: 'utilidade', nome: 'Utilidade', titulo: 'Utilidade' }
  ];

  function abrirPoderes(gatilho) {
    const catalogo = OP.data.catalogo || {};
    const classeFicha = (ficha().identificacao || {}).classe;
    const ordemUso = function (p) { const k = USOS_PODER.findIndex(function (u) { return u.id === p.categoria; }); return k === -1 ? USOS_PODER.length : k; };
    const ordemGrupo = function (p) {
      const k = GRUPOS_PARANORMAIS.findIndex(function (g) { return g.id === p.categoria; });
      return k === -1 ? GRUPOS_PARANORMAIS.length : k;
    };
    const idAba = function (p) { return p.tipo === 'classe' ? p.classe : p.tipo; };
    const poderes = (catalogo.poderes || []).slice().sort(function (a, b) {
      if (a.tipo === 'paranormal' && b.tipo === 'paranormal') return (ordemGrupo(a) - ordemGrupo(b)) || a.nome.localeCompare(b.nome, 'pt-BR');
      return (ordemUso(a) - ordemUso(b)) || a.nome.localeCompare(b.nome, 'pt-BR');
    });
    const itens = poderes.map(function (p) {
      const grupoPar = p.tipo === 'paranormal' ? GRUPOS_PARANORMAIS.find(function (g) { return g.id === p.categoria; }) : null;
      const uso = USOS_PODER.find(function (u) { return u.id === p.categoria; });
      const naFicha = chaveNaFicha('poder', p.id);
      return {
        id: 'poder-' + p.id,
        titulo: p.nome,
        meta: p.fonte && p.fonte !== 'livro' ? nomeFonte(p.fonte) : '',
        // Paranormais: um bloco por elemento. Os demais: um bloco por uso (combate, ambos, utilidade)
        grupo: grupoPar ? grupoPar.nome : (uso ? uso.titulo : ''),
        elemento: grupoPar ? grupoPar.id : (uso ? 'uso-' + uso.id : ''),
        abas: [idAba(p)],
        filtros: { uso: p.tipo === 'paranormal' ? [] : [p.categoria] },
        busca: p.nome + ' ' + (grupoPar ? grupoPar.nome : (uso ? uso.titulo : '')),
        marcado: naFicha ? 'Na ficha' : '',
        detalhes: detalhesDoCatalogo(p.id),
        acao: {
          rotulo: naFicha ? 'Na ficha' : 'Adicionar', desativada: naFicha, primaria: !naFicha, icone: naFicha ? 'ok' : 'mais',
          aoClicar: function () { adicionarPoder(p); desenharLista(); }
        }
      };
    });
    const nomeClasse = function (id) { const c = OP.calc.classeDados(id); return c ? c.nome : id; };
    const abas = CLASSES_COM_PODERES.map(function (id) { return { id: id, nome: nomeClasse(id) }; })
      .concat([{ id: 'geral', nome: 'Gerais' }, { id: 'paranormal', nome: 'Paranormais' }]);
    abrirLista({
      titulo: 'Poderes do livro', dica: 'Abre na sua classe. Toque na seta para ler o poder e ver o que a ficha faz sozinha; Adicionar põe o poder na lista de habilidades.',
      busca: 'Buscar poder…', abas: abas, itens: itens, gatilho: gatilho,
      abaInicial: CLASSES_COM_PODERES.indexOf(classeFicha) !== -1 ? classeFicha : (classeFicha ? 'geral' : CLASSES_COM_PODERES[0]),
      filtros: [{ id: 'uso', rotulo: 'Uso', escondeEm: ['paranormal'], itens: USOS_PODER }]
    });
  }

  function abrirRituais(gatilho) {
    const catalogo = OP.data.catalogo || {};
    const rituais = (catalogo.rituais || []).slice().sort(function (a, b) {
      return (a.circulo - b.circulo) || a.nome.localeCompare(b.nome, 'pt-BR');
    });
    const itens = rituais.map(function (r) {
      const naFicha = chaveNaFicha('ritual', r.id);
      return {
        id: 'ritual-' + r.id,
        titulo: r.nome,
        meta: metaDoRitual(r),
        grupo: r.circulo + 'º círculo',
        filtros: { circulo: [String(r.circulo)], elemento: [r.elemento || 'varios'] },
        busca: r.nome + ' ' + nomeElemento(r.elemento) + ' ' + r.circulo + 'º círculo',
        marcado: naFicha ? 'Na ficha' : '',
        detalhes: detalhesDoCatalogo(r.id),
        acao: {
          rotulo: naFicha ? 'Na ficha' : 'Adicionar', desativada: naFicha, primaria: !naFicha, icone: naFicha ? 'ok' : 'mais',
          aoClicar: function () { adicionarRitual(r); desenharLista(); }
        }
      };
    });
    const elementos = OP.data.elementos.map(function (e) { return { id: e.id, nome: e.nome }; });
    if (rituais.some(function (r) { return !r.elemento; })) elementos.push({ id: 'varios', nome: 'Sem elemento' });
    abrirLista({
      titulo: 'Rituais do livro', dica: 'Adicionar já preenche círculo, elemento, alcance, duração, resistência, custos e dano do ritual.',
      busca: 'Buscar ritual…', itens: itens, gatilho: gatilho,
      filtros: [
        { id: 'circulo', rotulo: 'Círculo', itens: [1, 2, 3, 4].map(function (n) { return { id: String(n), nome: n + 'º' }; }) },
        { id: 'elemento', rotulo: 'Elemento', itens: elementos }
      ]
    });
  }

  /* ------------------------------------------------------------------------
     Itens e melhorias do livro (compêndio de itens: conteúdos "itens" e "melhorias")
     ------------------------------------------------------------------------ */

  const rotuloCategoria = function (n) { return OP.calc.rotuloCategoria(n); };

  function nomeNatureza(id) {
    const g = OP.data.gruposItem.find(function (x) { return x.id === id; });
    return g ? g.nome : '';
  }

  /** "OPRPG p. 58", "AS#09 p. 51" (a fonte de um item ou melhoria do compêndio). */
  function fonteDoCompendio(d) {
    return d.fonte ? d.fonte + (d.pag ? ' p. ' + d.pag : '') : '';
  }

  function textoEspacos(n, texto) {
    if (texto) return texto;
    return n === 0 ? 'sem espaço' : (String(n).replace('.', ',') + (n <= 1 ? ' espaço' : ' espaços'));
  }

  // Abas do seletor de itens: cada uma reúne naturezas de item
  const ABAS_ITENS = [
    { id: 'armas', nome: 'Armas', naturezas: ['arma-cac', 'arma-arremesso', 'arma-disparo', 'arma-fogo'] },
    { id: 'protecoes', nome: 'Proteções', naturezas: ['protecao-leve', 'protecao-pesada', 'escudo', 'capacete'] },
    { id: 'acessorios', nome: 'Acessórios', naturezas: ['acessorio'] },
    { id: 'explosivos', nome: 'Munições e explosivos', naturezas: ['municao', 'granada', 'explosivo'] },
    { id: 'saude', nome: 'Medicamentos e venenos', naturezas: ['medicamento', 'veneno'] },
    { id: 'operacionais', nome: 'Operacionais', naturezas: ['operacional', 'recurso', 'aliado', 'outro'] },
    { id: 'paranormais', nome: 'Paranormais', naturezas: ['paranormal'] },
    { id: 'amaldicoados', nome: 'Amaldiçoados', naturezas: ['amaldicoado'] },
    { id: 'veiculos', nome: 'Veículos e drones', naturezas: ['veiculo', 'drone'] }
  ];

  /** Item novo do inventário preenchido com o que o catálogo sabe (o texto do livro não é copiado). */
  function criarItemDoCatalogo(d) {
    const dados = { nome: d.nome, tipo: d.tipo || 'geral', grupo: d.grupo || '', categoria: Math.min(Math.max(Number(d.cat) || 0, 0), 4), espacos: Number(d.esp) || 0, catalogo: d.id };
    if (d.protecao) { dados.defesa = d.protecao.def || 0; dados.penalidade = d.protecao.pen || 0; }
    return OP.state.novoItem(dados);
  }

  /** Ataque novo ligado a uma arma do catálogo (dano, crítico, alcance e tipo do livro). */
  function criarAtaqueDaArma(d, idItem) {
    const a = d.arma || {};
    const notas = [];
    if (a.danoAlt) notas.push('Duas mãos: ' + a.danoAlt);
    if (a.danoTexto && !a.dano) notas.push('Dano: ' + a.danoTexto);
    if (a.tiposDano && a.tiposDano.length > 1) notas.push('Dano misto: ' + a.tiposDano.map(function (t) { const x = OP.data.tiposDano.find(function (y) { return y.id === t; }); return x ? x.nome : t; }).join(' + '));
    if (a.municao) notas.push('Munição: ' + a.municao + (a.capacidade ? ' (capacidade ' + a.capacidade + ')' : ''));
    return OP.state.novoAtaque({
      nome: d.nome, pericia: a.pericia === 'pontaria' ? 'pontaria' : 'luta', dano: a.dano || '',
      critMargem: a.margem || 20, critMult: a.mult || 2, alcance: a.alcance || '', tipoDano: a.tipoDano || '',
      propriedades: notas.join(' · '), itemId: idItem
    });
  }

  function adicionarItemDoLivro(d, comAtaque) {
    const novo = criarItemDoCatalogo(d);
    OP.state.atualizar('inventario.itens', OP.state.obter('inventario.itens').concat([novo]));
    if (comAtaque && d.arma) {
      OP.state.atualizar('ataques', OP.state.obter('ataques').concat([criarAtaqueDaArma(d, novo.id)]));
      mensagemDialogo(d.nome + ' foi para o inventário e ganhou um ataque.');
    } else {
      mensagemDialogo(d.nome + ' foi para o inventário.');
    }
  }

  function metaDoItem(d) {
    const partes = [nomeNatureza(d.grupo), 'categoria ' + (d.catTexto ? d.catTexto : rotuloCategoria(d.cat)), textoEspacos(d.esp, d.espTexto)];
    if (d.arma && d.arma.dano) partes.push('dano ' + d.arma.dano + (d.arma.critTexto ? ' · crítico ' + d.arma.critTexto : ''));
    if (d.elemento && d.elemento !== 'varia') partes.push(nomeElemento(d.elemento));
    return partes.filter(Boolean).join(' · ');
  }

  function abrirItens(gatilho) {
    const catalogo = OP.data.catalogo || {};
    const naFicha = {};
    ficha().inventario.itens.forEach(function (i) { if (i.catalogo) naFicha[i.catalogo] = (naFicha[i.catalogo] || 0) + 1; });
    const abaDe = function (d) { const a = ABAS_ITENS.find(function (x) { return x.naturezas.indexOf(d.grupo) !== -1; }); return a ? a.id : 'operacionais'; };
    const itens = (catalogo.itens || []).map(function (d, i) { return { d: d, i: i }; }).sort(function (a, b) {
      return (OP.data.gruposItem.findIndex(function (g) { return g.id === a.d.grupo; }) - OP.data.gruposItem.findIndex(function (g) { return g.id === b.d.grupo; })) || (a.i - b.i);
    }).map(function (x) {
      const d = x.d;
      const quantos = naFicha[d.id] || 0;
      const acoes = [{
        rotulo: 'Adicionar', primaria: true, icone: 'mais',
        aoClicar: function () { adicionarItemDoLivro(d, false); desenharLista(); }
      }];
      if (d.arma) acoes.push({ rotulo: 'Com ataque', icone: 'mais', aoClicar: function () { adicionarItemDoLivro(d, true); desenharLista(); } });
      return {
        id: 'item-' + d.id,
        titulo: d.nome,
        meta: metaDoItem(d) + (quantos ? ' · na ficha' + (quantos > 1 ? ' (' + quantos + ')' : '') : ''),
        grupo: nomeNatureza(d.grupo),
        abas: [abaDe(d)],
        filtros: { cat: [String(d.cat || 0)] },
        busca: d.nome + ' ' + nomeNatureza(d.grupo) + ' ' + (d.elemento && d.elemento !== 'varia' ? nomeElemento(d.elemento) : ''),
        detalhes: detalhesDoItemDoLivro(d),
        acoes: acoes
      };
    });
    const abas = ABAS_ITENS.filter(function (a) { return itens.some(function (i) { return i.abas[0] === a.id; }); }).map(function (a) { return { id: a.id, nome: a.nome }; });
    abrirLista({
      titulo: 'Itens do livro',
      dica: 'Adicionar já preenche o nome, a natureza, a categoria, os espaços e, nas proteções, a Defesa. "Com ataque" também cria o ataque da arma (dano, crítico, alcance e tipo). O texto do livro aparece aqui e na descrição do item; ele não é copiado para a ficha.',
      busca: 'Buscar item…', buscaEmTodas: true, abas: abas, itens: itens, gatilho: gatilho, abaInicial: abas.length ? abas[0].id : 'todos',
      filtros: [{ id: 'cat', rotulo: 'Categoria', itens: [0, 1, 2, 3, 4].map(function (n) { return { id: String(n), nome: rotuloCategoria(n) }; }) }]
    });
  }

  /** Corpo expandido de um item do livro: o texto e o que a ficha preenche. */
  function detalhesDoItemDoLivro(d) {
    return function (corpo) {
      corpo.appendChild(criarTextoLivro(d.id));
      const linhas = [];
      if (d.arma) {
        const a = d.arma;
        linhas.push('Ataque: ' + [a.pericia === 'luta' ? 'Luta' : 'Pontaria', a.dano ? 'dano ' + a.dano : '', a.margem ? 'crítico ' + a.margem + '/x' + a.mult : '', a.alcance ? a.alcance.toLowerCase() : ''].filter(Boolean).join(' · '));
      }
      if (d.protecao && (d.protecao.def || d.protecao.pen)) linhas.push('Proteção: Defesa +' + d.protecao.def + (d.protecao.pen ? ', penalidade de carga −' + d.protecao.pen : ''));
      if (d.limite) linhas.push('Regalias: até ' + d.limite);
      if (!linhas.length) return;
      const caixa = el('div', 'livro-auto');
      caixa.appendChild(el('p', 'livro-auto__titulo', 'O que a ficha preenche'));
      const ul = el('ul', 'livro-auto__lista');
      linhas.forEach(function (l) { ul.appendChild(el('li', '', l)); });
      caixa.appendChild(ul);
      corpo.appendChild(caixa);
    };
  }

  /** "Espaços −1 · Defesa +2 · Ataque +2" — o que a ficha aplica sozinha de uma melhoria do livro. */
  function ajustesEmTexto(aj) {
    if (!aj) return [];
    const sinal = function (v) { return (v < 0 ? '−' : '+') + Math.abs(v); };
    const rotulos = { esp: 'Espaços ', def: 'Defesa (proteção equipada) ', ataque: 'Testes de ataque da arma ligada ', dano: 'Dano da arma ligada ', margem: 'Margem de ameaça da arma ligada ' };
    return Object.keys(rotulos).filter(function (k) { return Number(aj[k]); }).map(function (k) { return rotulos[k] + sinal(Number(aj[k])); });
  }

  /** Quanto uma melhoria soma à categoria do item (a classe diz; a maldição depende da ordem). */
  function textoAumentoCategoria(classe) {
    if (!classe) return '';
    if (classe.id === 'maldicao') return 'categoria +' + classe.aumento[0] + ' na 1ª maldição, +' + classe.aumento[1] + ' nas seguintes';
    return classe.aumento[0] ? 'categoria +' + classe.aumento[0] : 'não muda a categoria';
  }

  function abrirMelhorias(idItem, gatilho) {
    const catalogo = OP.data.catalogo || {};
    const item = ficha().inventario.itens.find(function (i) { return i.id === idItem; });
    if (!item) return;
    const indice = ficha().inventario.itens.indexOf(item);
    const regras = catalogo.regrasDeMelhoria || {};
    const quantasNoItem = function (chave) { return (OP.state.obter('inventario.itens.' + indice + '.melhorias') || []).filter(function (m) { return m.chave === chave; }).length; };
    const linhasMel = (catalogo.melhorias || []).map(function (m) {
      const classe = OP.data.classesMelhoria.find(function (c) { return c.id === m.cls; });
      const comp = OP.calc.compatibilidadeMelhoria(item, { chave: m.id });
      const grupo = OP.data.gruposMelhoria.find(function (g) { return g.id === m.grupo; });
      const max = Math.max(1, Math.trunc(Number(m.max)) || 1);
      const tem = quantasNoItem(m.id);
      const aj = ajustesEmTexto(m.aj);
      return {
        id: 'mel-' + m.id,
        titulo: m.nome,
        meta: [classe ? classe.nome : '', m.elemento && m.elemento !== 'varia' ? nomeElemento(m.elemento) : '', textoAumentoCategoria(classe), fonteDoCompendio(m),
          comp.ok ? '' : 'não combina com este item (' + comp.motivo + ')', tem ? 'já no item' + (tem > 1 ? ' (×' + tem + ')' : '') : ''].filter(Boolean).join(' · '),
        grupo: grupo ? grupo.nome : '',
        abas: [m.cls],
        filtros: { serve: comp.ok ? ['sim'] : [] },
        busca: m.nome + ' ' + (grupo ? grupo.nome : '') + ' ' + (m.elemento && m.elemento !== 'varia' ? nomeElemento(m.elemento) : ''),
        detalhes: function (corpo) {
          corpo.appendChild(criarTextoLivro(m.id));
          if (aj.length) {
            const caixa = el('div', 'livro-auto');
            caixa.appendChild(el('p', 'livro-auto__titulo', 'O que a ficha faz sozinha'));
            const ul = el('ul', 'livro-auto__lista');
            aj.forEach(function (l) { ul.appendChild(el('li', '', l)); });
            caixa.appendChild(ul);
            corpo.appendChild(caixa);
          }
        },
        acao: {
          rotulo: tem >= max ? 'No item' : (comp.ok ? 'Adicionar' : 'Adicionar mesmo assim'), desativada: tem >= max, primaria: comp.ok && tem < max, icone: tem >= max ? 'ok' : 'mais',
          aoClicar: function () { adicionarMelhoriaDoLivro(item.id, m); desenharLista(); }
        }
      };
    });
    // Texto das regras gerais de cada classe (aparece no topo da aba)
    const linhasRegras = Object.keys(regras).map(function (cls) {
      return { id: 'regra-' + cls, titulo: 'Regras do livro', meta: 'leia antes de escolher', grupo: 'Regras', abas: [cls], filtros: { serve: ['sim'] }, busca: 'regras', semContagem: true, detalhes: function (corpo) { corpo.appendChild(criarTextoLivro(regras[cls])); } };
    });
    const itens = linhasRegras.concat(linhasMel);
    const abas = OP.data.classesMelhoria.map(function (c) { return { id: c.id, nome: c.plural }; });
    const compativeis = function (cls) { return linhasMel.filter(function (l) { return l.abas[0] === cls && l.filtros.serve.length; }).length; };
    const primeira = OP.data.classesMelhoria.find(function (c) { return compativeis(c.id) > 0; });
    abrirLista({
      titulo: 'Melhorias para ' + (String(item.nome || '').trim() || 'o item'),
      dica: 'Modificação soma +I à categoria; a 1ª maldição soma +II e as seguintes +I (só a partir de Agente especial); regalia, só para veículos, soma +I cada. A lista abre só com o que serve para este item; desligue o filtro para ver todas.',
      busca: 'Buscar melhoria…', buscaEmTodas: true, abas: abas, itens: itens, gatilho: gatilho, abaInicial: primeira ? primeira.id : abas[0].id,
      filtros: [{ id: 'serve', rotulo: 'Para este item', itens: [{ id: 'sim', nome: 'Só as que servem' }] }],
      selecaoInicial: { serve: ['sim'] }
    });
  }

  function adicionarMelhoriaDoLivro(idItem, m) {
    const itens = OP.state.obter('inventario.itens');
    const indice = itens.findIndex(function (i) { return i.id === idItem; });
    if (indice === -1) return;
    const max = Math.max(1, Math.trunc(Number(m.max)) || 1);
    if ((itens[indice].melhorias || []).filter(function (x) { return x.chave === m.id; }).length >= max) {
      mensagemDialogo(m.nome + ' já está no item (o livro não acumula).');
      return;
    }
    const elemento = m.elemento && m.elemento !== 'varia' ? m.elemento : '';
    const nova = OP.state.novaMelhoria({ classe: m.cls, chave: m.id, nome: m.nome, elemento: elemento });
    OP.state.atualizar('inventario.itens.' + indice + '.melhorias', (itens[indice].melhorias || []).concat([nova]));
    mensagemDialogo(m.nome + ' foi para o item.');
  }

  /* ------------------------------------------------------------------------
     Ações sobre a ficha (preparar, ativar, usar, escolher)
     ------------------------------------------------------------------------ */

  function aoPreparar(idGasto, unidades) {
    OP.rolagens.prepararGasto(ficha(), idGasto, unidades);
  }

  function aoAtivar(chave) {
    const r = OP.rolagens.ativarEfeito(ficha(), chave);
    if (!r.ok) aviso('aviso', r.motivo || 'Não foi possível ativar.');
  }

  function aoDesligar(chave) {
    OP.rolagens.desativarEfeito(ficha(), chave);
  }

  function aoUsar(idUso) {
    const r = OP.rolagens.usarEfeito(ficha(), idUso);
    OP.ui.mostrarResultado(r);
  }

  function aoEscolher(chave, campo, valor) {
    const id = (chave + '__' + campo).slice(0, 64);
    const resto = (ficha().efeitos.escolhas || []).filter(function (e) { return e.id !== id; });
    if (valor) resto.push({ id: id, chave: chave, campo: campo, valor: valor });
    OP.state.atualizar('efeitos.escolhas', resto);
  }

  /* ------------------------------------------------------------------------
     Blocos da ficha
     ------------------------------------------------------------------------ */

  function rotuloGasto(g) {
    const custo = g.custo ? g.custo + ' PE' : 'sem custo';
    const efeito = [];
    if (g.bonus) efeito.push(sinal(g.bonus * Math.max(1, g.preparado || 1)));
    if (g.dados) efeito.push(sinal(g.dados) + 'd20');
    if (g.dano) efeito.push(sinal(g.dano * Math.max(1, g.preparado || 1)) + (g.quando && g.quando.dano ? '' : ' dano'));
    return g.nome + ' · ' + custo + ' · ' + efeito.join(' ') + ' ' + textoQuando(g.quando);
  }

  function criarControleGasto(g) {
    const caixa = el('div', 'livro-gasto');
    const b = botao(rotuloGasto(g), 'botao botao--pequeno livro-gasto__botao' + (g.preparado ? ' botao--ligado' : ''), {
      'data-livro-preparar': g.id, 'aria-pressed': String(g.preparado > 0)
    });
    caixa.appendChild(b);
    if (g.unidadesMax > 1) {
      const rotulo = el('label', 'livro-gasto__unidades');
      rotulo.appendChild(el('span', '', 'Unidades'));
      const sel = el('select', 'controle');
      sel.setAttribute('data-livro-unidades', g.id);
      for (let i = 1; i <= g.unidadesMax; i++) {
        const o = el('option', '', i + (i > 1 ? ' (' + (g.custo + (i - 1) * g.custoExtra) + ' PE)' : ''));
        o.value = String(i);
        if (g.preparado === i || (!g.preparado && i === 1)) o.selected = true;
        sel.appendChild(o);
      }
      rotulo.appendChild(sel);
      caixa.appendChild(rotulo);
    }
    return caixa;
  }

  function criarCartaoFonte(info, estado) {
    const cartao = el('article', 'livro-fonte');
    const topo = el('div', 'livro-fonte__topo');
    const titulo = el('div', 'livro-fonte__titulo');
    titulo.appendChild(el('strong', 'livro-fonte__nome', info.nome));
    titulo.appendChild(el('span', 'selo-fonte', NOMES_TIPO[info.tipo] || info.tipo));
    topo.appendChild(titulo);
    const ler = botao(abertos[info.chave] ? 'Fechar texto' : 'Ler texto', 'botao-texto', { 'data-livro-texto': info.chave, 'aria-expanded': String(abertos[info.chave] === true) });
    topo.appendChild(ler);
    cartao.appendChild(topo);

    const linhas = estado.origens.filter(function (o) { return o.chave === info.chave; });
    if (linhas.length) {
      const ul = el('ul', 'livro-fonte__efeitos');
      linhas.forEach(function (l) { ul.appendChild(el('li', '', l.texto)); });
      cartao.appendChild(ul);
    }

    info.escolhas.forEach(function (esc) {
      const rotulo = el('label', 'livro-fonte__escolha');
      rotulo.appendChild(el('span', '', esc.rotulo));
      const sel = el('select', 'controle');
      sel.setAttribute('data-livro-escolha', info.chave);
      sel.setAttribute('data-campo-escolha', esc.id);
      const vazio = el('option', '', 'Escolher…');
      vazio.value = '';
      sel.appendChild(vazio);
      esc.opcoes.forEach(function (id) {
        const o = el('option', '', esc.tipo === 'pericia' ? nomePericia(id) : siglaAtributo(id));
        o.value = id;
        if (esc.valor === id) o.selected = true;
        sel.appendChild(o);
      });
      rotulo.appendChild(sel);
      cartao.appendChild(rotulo);
    });

    const acoes = el('div', 'livro-fonte__acoes');
    estado.gastos.filter(function (g) { return g.chave === info.chave; }).forEach(function (g) { acoes.appendChild(criarControleGasto(g)); });
    estado.ativaveis.filter(function (a) { return a.chave === info.chave; }).forEach(function (a) {
      const duracao = a.duracao === 'cena' ? 'até o fim da cena' : a.duracao === 'rodadas' ? a.rodadas + (a.rodadas === 1 ? ' rodada' : ' rodadas') : 'até desligar';
      if (a.ligado) acoes.appendChild(botao('Desligar ' + a.nome, 'botao botao--pequeno botao--ligado', { 'data-livro-desligar': a.chave }));
      else acoes.appendChild(botao('Ativar ' + a.nome + ' · ' + (a.custo ? a.custo + ' PE' : 'sem custo') + ' · ' + duracao, 'botao botao--pequeno', { 'data-livro-ativar': a.chave }));
    });
    estado.usos.filter(function (u) { return u.chave === info.chave; }).forEach(function (u) {
      const verbo = u.tipo === 'cura' ? 'Curar' : u.tipo === 'dano' ? 'Rolar dano' : 'Rolar';
      acoes.appendChild(botao(verbo + ': ' + u.nome + ' · ' + (u.custo ? u.custo + ' PE · ' : '') + u.rolar, 'botao botao--pequeno', { 'data-livro-usar': u.id }));
    });
    if (acoes.children.length) cartao.appendChild(acoes);

    if (abertos[info.chave]) cartao.appendChild(criarTextoLivro(info.chave));
    return cartao;
  }

  function assinaturaDe(estado, f) {
    return JSON.stringify([
      estado.carregado, estado.origens, estado.pendencias,
      estado.fontes.map(function (x) { return [x.chave, x.nome, x.escolhas.map(function (e) { return e.valor; })]; }),
      estado.gastos.map(function (g) { return [g.id, g.preparado, g.custo, g.bonus, g.dados, g.dano, g.unidadesMax]; }),
      estado.ativaveis.map(function (a) { return [a.chave, a.ligado, a.custo]; }),
      estado.usos.map(function (u) { return [u.id, u.custo]; }),
      (f.efeitos.ativos || []).map(function (a) { return [a.chave, a.rodadas, a.ateFimCena]; }),
      OP.livro ? OP.livro.escopos() : [], Object.keys(abertos).filter(function (k) { return abertos[k]; }),
      acessoDisponivel()
    ]);
  }

  function desenharFontes(estado) {
    const mostrar = estado.carregado || (acessoDisponivel() && !estado.carregado);
    refs.secao.hidden = !mostrar;
    if (!mostrar) return;
    refs.fontes.textContent = '';
    if (!estado.carregado) {
      refs.nota.textContent = 'O conteúdo do livro ainda não foi liberado nesta conta. Em Conta, resgate um código para ver o texto e ligar os efeitos automáticos.';
      return;
    }
    const pend = estado.pendencias;
    refs.nota.textContent = estado.fontes.length
      ? 'A ficha soma sozinha o que está listado em cada fonte. Botões: prepare um gasto para o próximo teste, ative um efeito ou use um poder.' +
        (pend.length ? ' Falta escolher: ' + pend.map(function (p) { return p.nome + ' (' + p.rotulo + ')'; }).join('; ') + '.' : '')
      : 'Nenhuma origem, classe, trilha ou poder desta ficha tem efeito automático ainda.';
    estado.fontes.forEach(function (info) { refs.fontes.appendChild(criarCartaoFonte(info, estado)); });
  }

  /** RD vinda de poderes: aparece junto das resistências (os campos manuais continuam valendo). */
  function desenharResistencias(estado) {
    if (!refs.resistencias) return;
    const rd = estado.origens.filter(function (o) { return /^RD /.test(o.texto); });
    refs.resistencias.hidden = !rd.length;
    refs.resistencias.textContent = rd.length
      ? 'Dos poderes (somam às RD da lista): ' + rd.map(function (o) { return o.texto.replace(/ \(ativo\)$/, '') + ' — ' + o.nome; }).join('; ') + '.'
      : '';
  }

  function desenharPreparados(estado) {
    const gastos = estado.gastos;
    refs.preparados.hidden = !gastos.length;
    refs.preparadosLista.textContent = '';
    gastos.forEach(function (g) { refs.preparadosLista.appendChild(criarControleGasto(g)); });
  }

  function desenharAtivos(estado, f) {
    const ativos = (f.efeitos.ativos || []);
    refs.ativos.hidden = !ativos.length;
    refs.ativosLista.textContent = '';
    ativos.forEach(function (a) {
      const info = estado.ativaveis.find(function (x) { return x.chave === a.chave; });
      const nome = info ? info.nome : a.chave;
      const li = el('li', 'cond-cartao');
      const topo = el('div', 'cond-cartao__topo');
      const titulo = el('div', 'cond-cartao__titulo');
      titulo.appendChild(el('strong', 'cond-cartao__nome', nome));
      titulo.appendChild(el('span', 'cond-cartao__categoria', a.ateFimCena ? 'até o fim da cena' : a.rodadas ? a.rodadas + (a.rodadas === 1 ? ' rodada' : ' rodadas') : 'até desligar'));
      topo.appendChild(titulo);
      const fechar = botao('Desligar', 'botao botao--pequeno', { 'data-livro-desligar': a.chave });
      topo.appendChild(fechar);
      li.appendChild(topo);
      const linhas = estado.origens.filter(function (o) { return o.chave === a.chave && /\(ativo\)$/.test(o.texto); });
      if (linhas.length) li.appendChild(el('p', 'cond-cartao__resumo', linhas.map(function (l) { return l.texto.replace(/ \(ativo\)$/, ''); }).join('; ')));
      refs.ativosLista.appendChild(li);
    });
  }

  function desenhar(f, derivados) {
    derivadosAtuais = derivados;
    const estado = derivados.efeitos;
    if (!estado || !refs.secao) return;
    const temCatalogo = Boolean(OP.data.catalogo && ((OP.data.catalogo.poderes || []).length || (OP.data.catalogo.rituais || []).length));
    refs.addPoder.hidden = !temCatalogo;
    refs.addRitual.hidden = !temCatalogo;
    const assin = assinaturaDe(estado, f);
    if (assin === assinatura) return;
    assinatura = assin;
    desenharResistencias(estado);
    desenharFontes(estado);
    desenharPreparados(estado);
    desenharAtivos(estado, f);
  }

  /* ------------------------------------------------------------------------
     Eventos
     ------------------------------------------------------------------------ */

  function tratarClique(evento) {
    const alvo = evento.target.closest('[data-livro-preparar], [data-livro-ativar], [data-livro-desligar], [data-livro-usar], [data-livro-texto]');
    if (!alvo) return;
    if (alvo.hasAttribute('data-livro-preparar')) {
      const id = alvo.getAttribute('data-livro-preparar');
      const g = derivadosAtuais.efeitos.gastos.find(function (x) { return x.id === id; });
      if (!g) return;
      let unidades = 1;
      const sel = alvo.parentElement.querySelector('[data-livro-unidades]');
      if (sel) unidades = Number(sel.value) || 1;
      aoPreparar(id, g.preparado ? 0 : unidades);
    } else if (alvo.hasAttribute('data-livro-ativar')) aoAtivar(alvo.getAttribute('data-livro-ativar'));
    else if (alvo.hasAttribute('data-livro-desligar')) aoDesligar(alvo.getAttribute('data-livro-desligar'));
    else if (alvo.hasAttribute('data-livro-usar')) aoUsar(alvo.getAttribute('data-livro-usar'));
    else if (alvo.hasAttribute('data-livro-texto')) {
      const chave = alvo.getAttribute('data-livro-texto');
      abertos[chave] = !abertos[chave];
      assinatura = '';
      desenhar(ficha(), derivadosAtuais);
    }
  }

  function tratarMudanca(evento) {
    const un = evento.target.closest('[data-livro-unidades]');
    if (un) {
      const id = un.getAttribute('data-livro-unidades');
      const g = derivadosAtuais.efeitos.gastos.find(function (x) { return x.id === id; });
      if (g && g.preparado) aoPreparar(id, Number(un.value) || 1);
      return;
    }
    const esc = evento.target.closest('[data-livro-escolha]');
    if (esc) aoEscolher(esc.getAttribute('data-livro-escolha'), esc.getAttribute('data-campo-escolha'), esc.value);
  }

  function montar() {
    refs.dialogo = document.getElementById('dialogo-livro');
    if (!refs.dialogo) return;
    refs.titulo = document.getElementById('livro-titulo-dialogo');
    refs.dica = document.getElementById('livro-dialogo-dica');
    refs.busca = document.getElementById('livro-busca');
    refs.abas = document.getElementById('livro-abas');
    refs.abas2 = document.getElementById('livro-abas2');
    refs.lista = document.getElementById('livro-lista');
    refs.vazio = document.getElementById('livro-vazio');
    refs.resultado = document.getElementById('livro-resultado');
    refs.limpar = document.getElementById('livro-limpar');
    refs.mensagem = document.getElementById('livro-mensagem');
    refs.secao = document.getElementById('secao-livro');
    refs.nota = document.getElementById('livro-nota');
    refs.fontes = document.getElementById('livro-fontes');
    refs.preparados = document.getElementById('livro-preparados');
    refs.preparadosLista = document.getElementById('livro-preparados-lista');
    refs.ativos = document.getElementById('livro-ativos');
    refs.ativosLista = document.getElementById('livro-ativos-lista');
    refs.resistencias = document.getElementById('resistencia-poderes');
    refs.addPoder = document.getElementById('livro-add-poder');
    refs.addRitual = document.getElementById('livro-add-ritual');

    refs.limpar.addEventListener('click', function () {
      lista.sel = Object.create(null);
      desenharControles();
      desenharLista();
      refs.lista.scrollTop = 0;
      const primeiro = refs.abas2.querySelector('.livro-filtro');
      if (primeiro) primeiro.focus();
    });
    refs.busca.addEventListener('input', function () { lista.busca = refs.busca.value; desenharControles(); desenharLista(); });
    refs.dialogo.addEventListener('click', function (evento) {
      if (evento.target.closest('[data-fechar-dialogo]')) fecharLista();
    });
    refs.dialogo.addEventListener('close', function () {
      if (lista.gatilho && document.contains(lista.gatilho)) lista.gatilho.focus();
    });
    refs.addPoder.addEventListener('click', function () { abrirPoderes(refs.addPoder); });
    refs.addRitual.addEventListener('click', function () { abrirRituais(refs.addRitual); });
    document.addEventListener('click', tratarClique);
    document.addEventListener('change', tratarMudanca);

    // Quando o conteúdo do livro chega (ou some), a tela refaz as contas
    if (OP.livro) {
      OP.livro.aoMudar(function () {
        assinatura = '';
        if (OP.app && OP.app.redesenhar) OP.app.redesenhar(OP.state.ficha);
      });
    }
    OP.ui.registrarExtensao({ desenhar: desenhar });
  }

  OP.uiLivro = {
    montar: montar,
    abrirOrigem: abrirOrigem,
    abrirTrilha: abrirTrilha,
    abrirPoderes: abrirPoderes,
    abrirRituais: abrirRituais,
    abrirItens: abrirItens,
    abrirMelhorias: abrirMelhorias,
    descreverDefinicao: descreverDefinicao,
    criarTextoLivro: criarTextoLivro,
    blocosDoTexto: blocosDoTexto,
    criarRitualDoCatalogo: criarRitualDoCatalogo
  };
})(window.OP);
