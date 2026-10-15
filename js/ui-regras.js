/* ==========================================================================
   js/ui-regras.js — regras opcionais (OP.uiRegras)
   --------------------------------------------------------------------------
   - Botão discreto "regras opcionais" na faixa do agente; abre um diálogo com
     as regras opcionais, ligadas POR FICHA (ficha.config). Começa com
     "Jogando sem Sanidade" (Sobrevivendo ao Horror): PD no lugar de PE e SAN, e
     "NEX e Experiência" (Novas regras opcionais): nível para a progressão e NEX
     só para a exposição (painel em js/ui-nex.js; contas em js/calc.js; textos
     do livro em data/alteracoes-nex.js).
   - Os números da regra ficam em data/classes.js (pdInicial/pdPorNex) e as
     contas em js/calc.js; aqui só tem tela.
   - Com a regra ligada: <body data-sem-sanidade="sim"> (o CSS esconde a SAN) e
     os rótulos "PE" / "Pontos de Esforço" viram "PD" / "Pontos de Determinação"
     nos textos da ficha. Isso é feito por um observador que troca só texto e
     os atributos aria-label/title (nunca valores de campos nem a biografia) e
     desfaz tudo ao desligar. Texto dos dados da ficha segue por textContent.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  let ligada = false;
  let observador = null;

  // Troca de rótulos (e a volta). A ordem importa: o mais longo primeiro.
  const PARA_PD = [
    [/Pontos de Esforço/g, 'Pontos de Determinação'],
    [/pontos de esforço/g, 'pontos de determinação'],
    [/\bPE\b/g, 'PD']
  ];
  const PARA_PE = [
    [/Pontos de Determinação/g, 'Pontos de Esforço'],
    [/pontos de determinação/g, 'pontos de esforço'],
    [/\bPD\b/g, 'PE']
  ];

  // Onde a troca vale (a ficha e os diálogos/avisos que falam de PE) e o que ela nunca toca
  const RAIZES = ['ficha', 'dialogo-vital', 'dialogo-descanso', 'dialogo-confirmar', 'avisos-app', 'anunciador'];
  const EXCLUIR = 'input, textarea, select, option, script, style, [data-pagina="biografia"], [data-sem-troca]'; // texto
  const EXCLUIR_ATRIBUTOS = '[data-pagina="biografia"], [data-sem-troca]'; // rótulos (aria-label/title) de campos podem trocar
  const ATRIBUTOS = ['aria-label', 'title'];

  function substituir(texto, tabela) {
    let resultado = texto;
    tabela.forEach(function (par) { resultado = resultado.replace(par[0], par[1]); });
    return resultado;
  }

  function dentroDoExcluido(elemento) {
    return Boolean(elemento && elemento.closest && elemento.closest(EXCLUIR));
  }

  function atributosProtegidos(elemento) {
    return Boolean(elemento && elemento.closest && elemento.closest(EXCLUIR_ATRIBUTOS));
  }

  function trocarNo(no, tabela) {
    if (no.nodeType === 3) {
      if (dentroDoExcluido(no.parentElement)) return;
      const novo = substituir(no.nodeValue, tabela);
      if (novo !== no.nodeValue) no.nodeValue = novo;
      return;
    }
    if (no.nodeType !== 1 || atributosProtegidos(no)) return;
    trocarAtributos(no, tabela);
    const andador = document.createTreeWalker(no, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let atual = andador.nextNode();
    while (atual) {
      if (atual.nodeType === 3) {
        if (!dentroDoExcluido(atual.parentElement)) {
          const novo = substituir(atual.nodeValue, tabela);
          if (novo !== atual.nodeValue) atual.nodeValue = novo;
        }
      } else if (!atributosProtegidos(atual)) {
        trocarAtributos(atual, tabela);
      }
      atual = andador.nextNode();
    }
  }

  function trocarAtributos(elemento, tabela) {
    ATRIBUTOS.forEach(function (nome) {
      const valor = elemento.getAttribute(nome);
      if (!valor) return;
      const novo = substituir(valor, tabela);
      if (novo !== valor) elemento.setAttribute(nome, novo);
    });
  }

  function aoMutar(registros) {
    registros.forEach(function (registro) {
      if (registro.type === 'childList') {
        registro.addedNodes.forEach(function (no) { trocarNo(no, PARA_PD); });
      } else if (registro.type === 'characterData') {
        trocarNo(registro.target, PARA_PD);
      } else if (registro.type === 'attributes' && !atributosProtegidos(registro.target)) {
        trocarAtributos(registro.target, PARA_PD);
      }
    });
  }

  function raizes() {
    return RAIZES.map(function (id) { return document.getElementById(id); }).filter(Boolean);
  }

  /** Liga ou desliga a troca PE ⇄ PD nos textos (idempotente). */
  function aplicarRotulos(deveLigar) {
    if (deveLigar === ligada) return;
    ligada = deveLigar;
    if (observador) { observador.disconnect(); observador = null; }
    const tabela = ligada ? PARA_PD : PARA_PE;
    raizes().forEach(function (raiz) { trocarNo(raiz, tabela); });
    if (!ligada) return;
    observador = new MutationObserver(aoMutar);
    raizes().forEach(function (raiz) {
      observador.observe(raiz, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
    });
  }

  /* ------------------------------------------------------------------------
     Diálogo
     ------------------------------------------------------------------------ */

  function preencherTabelaPd() {
    const corpo = refs.tabela.querySelector('tbody');
    OP.ui.substituirFilhos(corpo, Object.keys(OP.data.classes).map(function (id) {
      const classe = OP.data.classes[id];
      const porEstagio = classe.unidadeProgressao === 'estagio';
      const linha = document.createElement('tr');
      const nome = document.createElement('th');
      nome.scope = 'row';
      nome.textContent = classe.nome;
      const inicial = document.createElement('td');
      inicial.textContent = classe.pdInicial + ' + PRE';
      const ganho = document.createElement('td');
      ganho.textContent = porEstagio ? classe.pdPorNex + ' por estágio' : classe.pdPorNex + ' + PRE';
      linha.appendChild(nome);
      linha.appendChild(inicial);
      linha.appendChild(ganho);
      return linha;
    }));
  }

  function abrir() {
    refs.caixa.checked = OP.calc.semSanidade(OP.state.ficha);
    refs.caixaNex.checked = OP.calc.regraNexNivel(OP.state.ficha);
    if (OP.ui.abrirDialogo) OP.ui.abrirDialogo(refs.dialogo, refs.botao);
    else refs.dialogo.showModal();
    refs.caixa.focus();
  }

  function aoMudarRegra() {
    OP.state.atualizar('config.semSanidade', refs.caixa.checked === true);
    if (OP.uiApp && OP.uiApp.anunciar) {
      OP.uiApp.anunciar(refs.caixa.checked ? 'Jogando sem Sanidade ligado: PD no lugar de PE e SAN.' : 'Jogando sem Sanidade desligado.');
    }
  }

  /* ------------------------------------------------------------------------
     NEX e Experiência
     ------------------------------------------------------------------------ */

  function preencherLivroNex() {
    const dados = OP.data.regraNexNivel;
    const filhos = [];
    function bloco(titulo, paragrafos, classe) {
      const caixa = document.createElement('div');
      caixa.className = classe;
      const h = document.createElement('h3');
      h.className = 'subtitulo';
      h.textContent = titulo;
      caixa.appendChild(h);
      paragrafos.forEach(function (texto) {
        const p = document.createElement('p');
        p.className = 'dialogo__texto';
        p.textContent = texto;
        caixa.appendChild(p);
      });
      filhos.push(caixa);
    }
    dados.secoes.forEach(function (secao) { bloco(secao.titulo, secao.paragrafos, 'regra-livro__secao'); });
    dados.caixas.forEach(function (caixa) { bloco(caixa.titulo, caixa.paragrafos, 'regra-livro__secao regra-livro__secao--caixa'); });
    OP.ui.substituirFilhos(refs.livroNex, filhos);
  }

  /** Liga: o NEX da regra padrão vira o nível equivalente e o NEX de exposição começa em 0. Desliga: o NEX volta a ser o do nível. */
  function trocarNexENivel(ligar) {
    const f = OP.state.ficha;
    if (ligar) {
      OP.state.atualizar('identificacao.nivel', OP.calc.nivelDoNex(f.identificacao.nex), { silencioso: true });
      OP.state.atualizar('identificacao.nex', 0, { silencioso: true });
    } else {
      OP.state.atualizar('identificacao.nex', OP.calc.nexDoNivel(OP.calc.nivelDaFicha(f)), { silencioso: true });
    }
    OP.state.atualizar('config.nexENivel', ligar);
    if (OP.uiApp && OP.uiApp.anunciar) {
      OP.uiApp.anunciar(ligar ? 'NEX e Experiência ligado: nível para a progressão, NEX para a exposição.' : 'NEX e Experiência desligado.');
    }
  }

  function aoMudarRegraNex() {
    const ligar = refs.caixaNex.checked === true;
    const f = OP.state.ficha;
    const exposicao = OP.calc.numero(f.identificacao.nex);
    if (ligar || exposicao === 0 || !OP.ui.confirmar) {
      trocarNexENivel(ligar);
      return;
    }
    // Desligar descarta o NEX de exposição: pede confirmação
    const nivel = OP.calc.nivelDaFicha(f);
    const aberto = OP.ui.confirmar({
      titulo: 'Desligar NEX e Experiência?',
      texto: 'O NEX da ficha volta a ser o equivalente ao nível (nível ' + nivel + ' = NEX ' + OP.calc.nexDoNivel(nivel) + '%) e o NEX de exposição atual (' + exposicao + '%) é descartado.',
      textoConfirmar: 'Desligar',
      perigo: true,
      aoConfirmar: function () { trocarNexENivel(false); },
      aoCancelar: function () { refs.caixaNex.checked = true; }
    });
    if (!aberto) refs.caixaNex.checked = true;
  }

  /* ------------------------------------------------------------------------
     Ciclo de desenho
     ------------------------------------------------------------------------ */

  function desenhar(ficha) {
    const sem = OP.calc.semSanidade(ficha);
    document.body.setAttribute('data-sem-sanidade', sem ? 'sim' : 'nao');
    aplicarRotulos(sem);
    const nex = OP.calc.regraNexNivel(ficha);
    document.body.setAttribute('data-nex-nivel', nex ? 'sim' : 'nao');
    const ligadas = (sem ? 1 : 0) + (nex ? 1 : 0);
    refs.marca.hidden = ligadas === 0;
    const textoMarca = ' · ' + ligadas + (ligadas === 1 ? ' ligada' : ' ligadas');
    if (ligadas && refs.marca.textContent !== textoMarca) refs.marca.textContent = textoMarca;
    if (refs.dialogo.open && refs.caixa.checked !== sem) refs.caixa.checked = sem;
    if (refs.dialogo.open && refs.caixaNex.checked !== nex && !document.getElementById('dialogo-confirmar').open) refs.caixaNex.checked = nex;
  }

  function montar() {
    refs.botao = document.getElementById('botao-regras-opcionais');
    refs.marca = document.getElementById('regras-opcionais-marca');
    refs.dialogo = document.getElementById('dialogo-regras');
    refs.caixa = document.getElementById('regra-sem-sanidade');
    refs.tabela = document.getElementById('regra-sem-sanidade-tabela');
    refs.caixaNex = document.getElementById('regra-nex-nivel');
    refs.livroNex = document.getElementById('regra-nex-nivel-livro-corpo');
    if (!refs.botao || !refs.dialogo || !refs.caixa || !refs.tabela || !refs.caixaNex || !refs.livroNex) return;
    preencherTabelaPd();
    preencherLivroNex();
    refs.caixaNex.addEventListener('change', aoMudarRegraNex);
    refs.botao.addEventListener('click', abrir);
    refs.caixa.addEventListener('change', aoMudarRegra);
    refs.dialogo.addEventListener('click', function (evento) {
      if (evento.target.closest('[data-fechar-dialogo]')) refs.dialogo.close();
    });
    OP.ui.registrarExtensao({ desenhar: desenhar });
  }

  OP.uiRegras = {
    montar: montar,
    abrir: abrir,
    trocarNexENivel: trocarNexENivel
  };
})(window.OP);
