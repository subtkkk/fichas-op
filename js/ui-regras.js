/* ==========================================================================
   js/ui-regras.js — regras opcionais (OP.uiRegras)
   --------------------------------------------------------------------------
   - Botão discreto "regras opcionais" na faixa do agente; abre um diálogo com
     as regras opcionais, ligadas POR FICHA (ficha.config). Começa com
     "Jogando sem Sanidade" (Sobrevivendo ao Horror): PD no lugar de PE e SAN.
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
     Ciclo de desenho
     ------------------------------------------------------------------------ */

  function desenhar(ficha) {
    const sem = OP.calc.semSanidade(ficha);
    document.body.setAttribute('data-sem-sanidade', sem ? 'sim' : 'nao');
    aplicarRotulos(sem);
    refs.marca.hidden = !sem;
    if (refs.dialogo.open && refs.caixa.checked !== sem) refs.caixa.checked = sem;
  }

  function montar() {
    refs.botao = document.getElementById('botao-regras-opcionais');
    refs.marca = document.getElementById('regras-opcionais-marca');
    refs.dialogo = document.getElementById('dialogo-regras');
    refs.caixa = document.getElementById('regra-sem-sanidade');
    refs.tabela = document.getElementById('regra-sem-sanidade-tabela');
    if (!refs.botao || !refs.dialogo || !refs.caixa || !refs.tabela) return;
    preencherTabelaPd();
    refs.botao.addEventListener('click', abrir);
    refs.caixa.addEventListener('change', aoMudarRegra);
    refs.dialogo.addEventListener('click', function (evento) {
      if (evento.target.closest('[data-fechar-dialogo]')) refs.dialogo.close();
    });
    OP.ui.registrarExtensao({ desenhar: desenhar });
  }

  OP.uiRegras = {
    montar: montar,
    abrir: abrir
  };
})(window.OP);
