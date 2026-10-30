/* ==========================================================================
   js/livro.js — conteúdo do livro liberado por código (OP.livro)
   --------------------------------------------------------------------------
   Tudo que vem do livro (texto, lista de poderes e rituais, efeitos automáticos)
   fica SÓ no servidor (js/conta.js, worker/). Aqui o que o servidor entregou vira:
   - OP.data.catalogo: listas para escolher (origens, trilhas, habilidades de classe,
     poderes e rituais), montadas na hora;
   - OP.data.efeitos: efeitos automáticos por chave (formato em data/efeitos.js);
   - OP.livro.texto(chave): o texto de cada item.
   Nada disso é guardado no navegador: só na memória da página. Sem acesso (ou sem
   a API), tudo fica vazio e a ficha funciona manualmente, como sempre.

   Cada item do servidor tem o texto do livro e, no fim, uma linha "§AUTO§{...}"
   com { t: 'origem'|'classe'|'trilha'|'poder'|'ritual', …, ef: {efeitos} }
   (gerada por tools/gerar-conteudo.mjs).

   Os conteúdos "itens" e "melhorias" (compêndio de itens, tools/gerar-arsenal.mjs) levam
   { t: 'item', … } e { t: 'melhoria', … } (ou { t: 'regra' }); formato no cabeçalho de
   tools/gerar-arsenal.mjs. Eles entram em OP.data.catalogo.itens e .melhorias (listas) e
   em .itemPorChave e .melhoriaPorChave (busca por chave, usada por js/calc.js).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const ESCOPOS = ['origens', 'habilidades', 'rituais', 'itens', 'melhorias'];
  const MARCADOR = '\n\n§AUTO§';

  const textos = Object.create(null); // chave → { titulo, corpo, escopo }
  const ouvintes = [];
  let carregando = null;
  let carga = { carregando: false, escopos: {} }; // o que chegou de cada conteúdo (para a tela da Conta explicar)

  function catalogoVazio() {
    return {
      origens: {}, trilhas: {}, classe: {}, poderes: [], rituais: [],
      itens: [], melhorias: [], itemPorChave: {}, melhoriaPorChave: {}, regrasDeMelhoria: {}
    };
  }

  /** Separa o texto do livro dos dados da ficha. Dados ilegíveis são ignorados (o texto continua). */
  function separar(texto) {
    const i = String(texto).indexOf(MARCADOR);
    if (i === -1) return { corpo: String(texto), meta: null };
    let meta = null;
    try {
      const lido = JSON.parse(String(texto).slice(i + MARCADOR.length));
      if (lido && typeof lido === 'object' && !Array.isArray(lido)) meta = lido;
    } catch (erro) { /* linha danificada: só o texto */ }
    return { corpo: String(texto).slice(0, i), meta: meta };
  }

  /** Coloca um item no catálogo. */
  function registrar(catalogo, efeitos, escopo, item) {
    const partes = separar(item.texto);
    const c = carga.escopos[escopo] = carga.escopos[escopo] || { itens: 0, comDados: 0, erro: '' };
    c.itens += 1;
    if (partes.meta && typeof partes.meta.t === 'string') c.comDados += 1;
    textos[item.chave] = { titulo: item.titulo, corpo: partes.corpo, escopo: escopo };
    const m = partes.meta;
    if (!m || typeof m.t !== 'string') return;
    const chave = item.chave;
    if (m.t === 'origem' && typeof m.origem === 'string') catalogo.origens[m.origem] = chave;
    else if (m.t === 'trilha' && typeof m.trilha === 'string' && Number.isFinite(m.marco)) {
      (catalogo.trilhas[m.trilha] = catalogo.trilhas[m.trilha] || {})[String(m.marco)] = chave;
    } else if (m.t === 'classe' && typeof m.classe === 'string') {
      (catalogo.classe[m.classe] = catalogo.classe[m.classe] || []).push({ chave: chave, nome: item.titulo });
    } else if (m.t === 'poder') {
      catalogo.poderes.push({ id: chave, nome: item.titulo, tipo: m.tipo, categoria: m.categoria, classe: m.classe || '', fonte: m.fonte || 'livro' });
    } else if (m.t === 'ritual') {
      const r = Object.assign({}, m, { id: chave, nome: item.titulo });
      delete r.t;
      delete r.ef;
      catalogo.rituais.push(r);
    } else if (m.t === 'item' || m.t === 'melhoria') {
      const dados = Object.assign({}, m, { id: chave, nome: item.titulo });
      delete dados.t;
      (m.t === 'item' ? catalogo.itens : catalogo.melhorias).push(dados);
      (m.t === 'item' ? catalogo.itemPorChave : catalogo.melhoriaPorChave)[chave] = dados;
    } else if (m.t === 'regra' && typeof m.cls === 'string') {
      catalogo.regrasDeMelhoria[m.cls] = chave;
    }
    if (m.ef && typeof m.ef === 'object') {
      const problemas = OP.calc.validarEfeitos(chave, m.ef);
      if (problemas.length) console.warn('[OP] Efeitos de "' + chave + '" ignorados: ' + problemas.join('; '));
      else efeitos[chave] = m.ef;
    }
  }

  function limpar() {
    Object.keys(textos).forEach(function (k) { delete textos[k]; });
    OP.data.catalogo = catalogoVazio();
    OP.data.efeitos = {};
  }

  function avisar() {
    ouvintes.forEach(function (fn) {
      try { fn(); } catch (erro) { console.warn('[OP] Falha ao avisar a mudança do conteúdo do livro.', erro); }
    });
  }

  /** Escopos do livro que esta conta pode ler. */
  function escopos() {
    const acessos = (OP.conta && OP.conta.estado && OP.conta.estado.acessos) || [];
    return ESCOPOS.filter(function (e) { return acessos.some(function (a) { return a.escopo === e; }); });
  }

  /** (Re)carrega o conteúdo liberado. Sem acesso, esvazia tudo. Resolve quando termina. */
  function carregar() {
    const lista = escopos();
    carga = { carregando: lista.length > 0, escopos: {} };
    const cargaDaRodada = carga;
    avisar();
    const rodada = (carregando = (async function () {
      const catalogo = catalogoVazio();
      const efeitos = {};
      const lidos = Object.create(null);
      for (let i = 0; i < lista.length; i++) {
        try {
          const itens = await OP.conta.conteudo(lista[i]);
          cargaDaRodada.escopos[lista[i]] = { itens: 0, comDados: 0, erro: '' };
          itens.forEach(function (item) { registrar(catalogo, efeitos, lista[i], item); });
          lidos[lista[i]] = true;
        } catch (erro) {
          // sem acesso a este: segue com os outros, e a Conta mostra o motivo
          cargaDaRodada.escopos[lista[i]] = { itens: 0, comDados: 0, erro: erro && erro.message ? erro.message : 'erro' };
        }
      }
      if (carregando !== rodada) return; // chegou uma carga mais nova
      cargaDaRodada.carregando = false;
      Object.keys(textos).forEach(function (k) { if (!lidos[textos[k].escopo]) delete textos[k]; });
      OP.data.catalogo = catalogo;
      OP.data.efeitos = efeitos;
      avisar();
    })());
    return rodada;
  }

  /** O texto do livro de um item (ou null se não estiver liberado). */
  function texto(chave) {
    return textos[chave] || null;
  }

  /** Frase para a tela da Conta sobre o que chegou do servidor ('' se não há acesso a conteúdo do livro). */
  function resumo() {
    const nomes = escopos();
    if (!nomes.length) return '';
    if (carga.carregando) return 'Carregando o conteúdo do livro…';
    const partes = [];
    let semDados = false;
    nomes.forEach(function (n) {
      const c = carga.escopos[n];
      if (!c) return;
      if (c.erro) partes.push('Não foi possível carregar «' + n + '»: ' + c.erro);
      else if (!c.itens) partes.push('«' + n + '» está vazio no servidor.');
      else if (!c.comDados) semDados = true;
    });
    if (semDados) partes.push('O conteúdo publicado é de uma versão antiga (só texto, sem os dados de automação). Publique de novo os arquivos mais recentes no painel do administrador.');
    const cat = OP.data.catalogo || {};
    const poderes = (cat.poderes || []).length;
    const rituais = (cat.rituais || []).length;
    const efeitos = Object.keys(OP.data.efeitos || {}).length;
    const itens = (cat.itens || []).length;
    const melhorias = (cat.melhorias || []).length;
    if (poderes || rituais) partes.unshift('Livro carregado: ' + poderes + ' poderes, ' + rituais + ' rituais e ' + efeitos + ' fontes com efeito automático.');
    if (itens || melhorias) partes.unshift('Itens carregados: ' + itens + ' itens e ' + melhorias + ' melhorias (modificações, maldições e regalias).');
    return partes.join(' ');
  }

  function disponivel(escopo) {
    return escopos().indexOf(escopo) !== -1 && Object.keys(textos).some(function (k) { return textos[k].escopo === escopo; });
  }

  function aoMudar(fn) {
    ouvintes.push(fn);
  }

  OP.data.catalogo = catalogoVazio();
  OP.data.efeitos = OP.data.efeitos || {};

  OP.livro = {
    carregar: carregar,
    limpar: limpar,
    texto: texto,
    disponivel: disponivel,
    resumo: resumo,
    aoMudar: aoMudar,
    escopos: escopos,
    _registrar: function (escopo, item) { // para testes
      registrar(OP.data.catalogo, OP.data.efeitos, escopo, item);
    },
    _esquecerTextos: function (chaves) { // para testes
      chaves.forEach(function (k) { delete textos[k]; });
    }
  };
})(window.OP);
