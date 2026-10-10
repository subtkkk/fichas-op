/* ==========================================================================
   js/ui-dossie.js — capa do dossiê, vitais, índice das seções e tema
   (OP.uiDossie)
   --------------------------------------------------------------------------
   Entra no ciclo de desenho do js/ui.js (OP.ui.registrarExtensao):
   - capa: monograma (iniciais do nome), código do registro (do id da ficha);
   - vitais (PV, PE, SAN): os números e as barras vêm de data-saida e
     data-largura (ui.js); aqui só o estado visual (nível da barra) e os
     botões −/+ desligados enquanto não há classe (o máximo é desconhecido);
   - índice: rola até a seção e marca a seção visível (aria-current);
   - tema: data-tema na ficha e no painel de rolagens. SÓ APARÊNCIA: não
     muda afinidade, regras nem nenhum valor da ficha. A escolha fica nas
     preferências do navegador (OP.prefs), por ficha.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  let temaAplicado = null;
  let idDesenhado = null;

  function reduzMovimento() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function definirTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  function dadosTema(id) {
    return OP.data.temas.find(function (tema) { return tema.id === id; }) || OP.data.temas[0];
  }

  /* ------------------------------------------------------------------------
     Tema visual
     ------------------------------------------------------------------------ */

  function montarSeletorTema() {
    const caixa = refs.opcoesTema;
    caixa.textContent = '';
    OP.data.temas.forEach(function (tema) {
      const rotulo = document.createElement('label');
      rotulo.className = 'seletor-tema__opcao';
      rotulo.setAttribute('data-tema-opcao', tema.id);
      rotulo.title = tema.nome + ' — ' + tema.descricao;
      rotulo.style.setProperty('--cor-amostra', tema.cor);

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'tema-ficha';
      radio.value = tema.id;
      radio.className = 'seletor-tema__radio';
      rotulo.appendChild(radio);

      const amostra = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      amostra.setAttribute('class', 'seletor-tema__icone');
      amostra.setAttribute('aria-hidden', 'true');
      amostra.setAttribute('focusable', 'false');
      const uso = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      uso.setAttribute('href', '#ic-' + tema.id);
      amostra.appendChild(uso);
      rotulo.appendChild(amostra);

      const nome = document.createElement('span');
      nome.className = 'seletor-tema__nome';
      nome.textContent = tema.nome;
      rotulo.appendChild(nome);
      caixa.appendChild(rotulo);
    });

    refs.seletorTema.addEventListener('change', function (evento) {
      const radio = evento.target.closest('input[name="tema-ficha"]');
      if (!radio || !radio.checked) return;
      const id = OP.fichas.idAtual();
      if (id) OP.prefs.definirTema(id, radio.value);
      aplicarTema(radio.value, true);
    });
  }

  /** Aplica um tema na ficha e no painel de rolagens (e no fundo, enquanto a ficha está na tela). */
  function aplicarTema(idTema, comTransicao) {
    const tema = dadosTema(idTema);
    if (temaAplicado === tema.id) return;
    const raiz = document.documentElement;
    if (comTransicao && !reduzMovimento()) {
      raiz.classList.add('trocando-tema');
      clearTimeout(refs.timerTema);
      refs.timerTema = setTimeout(function () { raiz.classList.remove('trocando-tema'); }, 700);
    }
    temaAplicado = tema.id;
    refs.vista.setAttribute('data-tema', tema.id);
    refs.rolagens.setAttribute('data-tema', tema.id);
    refs.atmosfera.setAttribute('data-tema', tema.id);
    document.body.setAttribute('data-tema-ficha', tema.id);
    refs.seloIcone.setAttribute('href', '#ic-' + tema.id);
    definirTexto(refs.temaAtual, tema.nome);
    refs.opcoesTema.querySelectorAll('input[name="tema-ficha"]').forEach(function (radio) {
      radio.checked = radio.value === tema.id;
    });
  }

  /* ------------------------------------------------------------------------
     Capa e vitais (a cada desenho)
     ------------------------------------------------------------------------ */

  /** Nível visual da barra (só cor; não é regra do jogo). */
  function nivelBarra(percentual) {
    if (percentual <= 0) return 'zero';
    if (percentual <= 25) return 'critico';
    if (percentual <= 50) return 'baixo';
    return 'ok';
  }

  function desenharVitais(derivados) {
    let semClasse = false;
    OP.data.recursos.forEach(function (recurso) {
      const estado = derivados.recursos[recurso.id];
      const elemento = refs.vitais[recurso.id];
      if (!elemento || !estado) return;
      const definido = Boolean(estado.classeDefinida);
      if (!definido) semClasse = true;
      const nivel = definido ? nivelBarra(OP.calc.numero(estado.percentual)) : 'indefinido';
      if (elemento.dataset.nivel !== nivel) elemento.dataset.nivel = nivel;
      elemento.querySelectorAll('[data-passo]').forEach(function (botao) {
        if (botao.disabled === definido) botao.disabled = !definido;
      });
    });
    refs.hudSemClasse.hidden = !semClasse;
    refs.hudTurno.classList.toggle('hud__derivado--alerta', Boolean(derivados.conjuracao && derivados.conjuracao.passouLimite));
  }

  function desenhar(ficha, derivados) {
    const nome = String(ficha.identificacao.nome || '').trim();
    definirTexto(refs.monograma, OP.uiFichas.monograma(nome));
    definirTexto(refs.codigo, OP.uiFichas.codigoRegistro(ficha.id));
    definirTexto(refs.tituloTela, nome ? 'Ficha de ' + nome : 'Ficha de agente sem nome');
    refs.campoNome.classList.toggle('campo__destaque--vazio', !nome);
    desenharVitais(derivados);

    // Outra ficha aberta: aplica o tema dela (sem animação)
    if (ficha.id !== idDesenhado) {
      idDesenhado = ficha.id;
      aplicarTema(OP.prefs.tema(ficha.id), false);
    }
  }

  /* ------------------------------------------------------------------------
     Índice das seções
     ------------------------------------------------------------------------ */

  function irParaSecao(id) {
    const secao = document.getElementById(id);
    if (!secao) return;
    secao.scrollIntoView({ behavior: reduzMovimento() ? 'auto' : 'smooth', block: 'start' });
    // Foco no título da seção (teclado e leitor de tela continuam dali)
    const titulo = secao.querySelector('.secao__titulo');
    if (titulo) {
      if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1');
      try {
        titulo.focus({ preventScroll: true });
      } catch (erro) {
        titulo.focus();
      }
    }
    marcarSecao(id);
  }

  /** Marca no índice a seção visível e, no celular, traz o item para a vista. */
  function marcarSecao(id) {
    refs.itensIndice.forEach(function (item) {
      if (item.getAttribute('data-ir-secao') === id) item.setAttribute('aria-current', 'location');
      else item.removeAttribute('aria-current');
    });
    const ativo = refs.indice.querySelector('[aria-current="location"]');
    const lista = refs.indice.querySelector('.indice__lista');
    if (ativo && lista && lista.scrollWidth > lista.clientWidth + 4) {
      const alvo = ativo.offsetLeft - (lista.clientWidth - ativo.offsetWidth) / 2;
      lista.scrollTo({ left: Math.max(0, alvo), behavior: reduzMovimento() ? 'auto' : 'smooth' });
    }
  }

  /**
   * Scrollspy: a seção ativa é a última cujo topo já passou da "linha de
   * leitura" (um terço da área visível, abaixo do que fica preso no topo).
   * Lido no máximo uma vez por quadro (requestAnimationFrame).
   */
  function secaoNaLeitura() {
    const topoFixo = parseFloat(getComputedStyle(document.body).getPropertyValue('--topo-fixo')) || 0;
    const linha = topoFixo + (window.innerHeight - topoFixo) * 0.33;
    let ativa = refs.secoes[0] || null;
    for (let i = 0; i < refs.secoes.length; i++) {
      if (refs.secoes[i].getBoundingClientRect().top <= linha) ativa = refs.secoes[i];
    }
    // No fim da página, a última seção (mesmo curta) é a ativa
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      ativa = refs.secoes[refs.secoes.length - 1];
    }
    return ativa;
  }

  function ligarScrollspy() {
    refs.secoes = refs.itensIndice
      .map(function (item) { return document.getElementById(item.getAttribute('data-ir-secao')); })
      .filter(Boolean);
    let agendado = false;
    function atualizar() {
      agendado = false;
      if (document.body.dataset.vista !== 'ficha') return;
      const ativa = secaoNaLeitura();
      if (ativa && ativa.id !== refs.secaoAtiva) {
        refs.secaoAtiva = ativa.id;
        marcarSecao(ativa.id);
      }
    }
    function agendar() {
      if (agendado) return;
      agendado = true;
      window.requestAnimationFrame(atualizar);
    }
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar);
    OP.uiApp.aoTrocarVista(function (vista) { if (vista === 'ficha') agendar(); });
    agendar();
  }

  /**
   * Altura do trilho quando ele vira a faixa presa no topo (tablet e
   * celular): vai para --altura-trilho, usado pelos cabeçalhos presos
   * (ex.: o da tabela de perícias) e pelo deslocamento das âncoras.
   */
  function medirTrilho() {
    const trilho = document.querySelector('.trilho');
    if (!trilho || !('ResizeObserver' in window)) return;
    const observador = new ResizeObserver(function () {
      const altura = Math.round(trilho.getBoundingClientRect().height);
      if (altura > 0) document.documentElement.style.setProperty('--altura-trilho', altura + 'px');
    });
    observador.observe(trilho);
  }

  /* ------------------------------------------------------------------------
     Montagem
     ------------------------------------------------------------------------ */

  function montar() {
    refs.vista = document.getElementById('vista-ficha');
    refs.rolagens = document.getElementById('rolagens');
    refs.atmosfera = document.getElementById('atmosfera');
    refs.seletorTema = document.getElementById('seletor-tema');
    refs.opcoesTema = document.getElementById('seletor-tema-opcoes');
    refs.temaAtual = document.getElementById('seletor-tema-atual');
    refs.monograma = document.getElementById('dossie-monograma');
    refs.codigo = document.getElementById('dossie-codigo');
    refs.seloIcone = document.getElementById('dossie-selo-icone');
    refs.tituloTela = document.getElementById('ficha-titulo');
    refs.campoNome = document.getElementById('campo-nome');
    refs.hudSemClasse = document.getElementById('hud-sem-classe');
    refs.hudTurno = document.getElementById('hud-turno');
    refs.indice = document.querySelector('.indice');
    refs.itensIndice = Array.prototype.slice.call(document.querySelectorAll('[data-ir-secao]'));
    refs.vitais = {};
    document.querySelectorAll('[data-vital]').forEach(function (elemento) {
      refs.vitais[elemento.getAttribute('data-vital')] = elemento;
    });

    montarSeletorTema();

    refs.indice.addEventListener('click', function (evento) {
      const link = evento.target.closest('[data-ir-secao]');
      if (!link) return;
      evento.preventDefault(); // não mexe no #hash (ele guarda a rota)
      irParaSecao(link.getAttribute('data-ir-secao'));
    });
    ligarScrollspy();
    medirTrilho();

    // O tema da ficha aberta mudou nas preferências: acompanha
    OP.prefs.aoMudar(function (prefs, tipo) {
      if (tipo !== 'temas') return;
      const id = OP.fichas.idAtual();
      if (id) aplicarTema(OP.prefs.tema(id), true);
    });

    OP.ui.registrarExtensao({ desenhar: desenhar });
  }

  OP.uiDossie = {
    montar: montar,
    aplicarTema: aplicarTema,
    irParaSecao: irParaSecao
  };
})(window.OP);
