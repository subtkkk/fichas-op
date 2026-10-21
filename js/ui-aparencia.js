/* ==========================================================================
   js/ui-aparencia.js — aparência do site, "Sobre" e ajuda de teclado
   (OP.uiAparencia, OP.ui.aplicarAparencia)
   --------------------------------------------------------------------------
   - OP.ui.aplicarAparencia(prefs) põe data-tema, data-fonte e data-movimento
     no <html> (a mesma lógica do script mínimo do <head>, que roda antes da
     primeira pintura). prefs: { tema, tamanhoFonte, movimento }.
   - Diálogo "Aparência": tema do site, tema da ficha aberta (o seletor é
     montado por js/ui-dossie.js), tamanho do texto, animações e som. Guarda
     em OP.prefs (op_prefs) — NUNCA na ficha — e vale na hora.
   - Diálogo "Sobre": projeto de fã, versões e atalho para o backup.
   - Tecla "?" (fora de campos de texto) abre a "Ajuda de teclado".
   - Diálogos: showModal(), título por aria-labelledby, Esc fecha e o foco
     volta ao botão que abriu.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const SONS = [
    { id: 'sim', nome: 'Ligado' },
    { id: 'nao', nome: 'Desligado' }
  ];
  const MOVIMENTOS = [
    { id: 'auto', nome: 'Automático' },
    { id: 'sim', nome: 'Sim' },
    { id: 'nao', nome: 'Não' }
  ];

  /* ------------------------------------------------------------------------
     Aplicar a aparência no <html>
     ------------------------------------------------------------------------ */

  /**
   * tema "auto" não põe atributo (o CSS segue o sistema); "escuro", "claro" e
   * "contraste" põem data-tema. tamanhoFonte p/m/g/gg → data-fonte. movimento
   * "sim"/"nao" → data-movimento; "auto" tira o atributo (vale o sistema).
   */
  function aplicarAparencia(prefs) {
    const p = prefs || OP.prefs.aparencia();
    const raiz = document.documentElement;
    if (p.tema === 'escuro' || p.tema === 'claro' || p.tema === 'contraste') raiz.setAttribute('data-tema', p.tema);
    else raiz.removeAttribute('data-tema');
    const tamanhos = (OP.data.tamanhosFonte || []).map(function (t) { return t.id; });
    raiz.setAttribute('data-fonte', tamanhos.indexOf(p.tamanhoFonte) !== -1 ? p.tamanhoFonte : 'm');
    if (p.movimento === 'sim' || p.movimento === 'nao') raiz.setAttribute('data-movimento', p.movimento);
    else raiz.removeAttribute('data-movimento');
    // A cor da barra do navegador acompanha o fundo do tema
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const fundo = getComputedStyle(raiz).getPropertyValue('--cor-fundo').trim();
      if (/^#[0-9a-fA-F]{6}$/.test(fundo)) meta.setAttribute('content', fundo);
    }
  }

  /* ------------------------------------------------------------------------
     Diálogos
     ------------------------------------------------------------------------ */

  /** Abre um <dialog> como modal e devolve o foco a quem abriu quando ele fecha. */
  function abrirDialogo(dialogo, quemAbriu) {
    if (!dialogo || typeof dialogo.showModal !== 'function' || dialogo.open) return false;
    const origem = quemAbriu || document.activeElement;
    dialogo.showModal();
    dialogo.addEventListener('close', function devolver() {
      dialogo.removeEventListener('close', devolver);
      if (origem && origem.isConnected && typeof origem.focus === 'function') {
        try {
          origem.focus({ preventScroll: true });
        } catch (erro) {
          origem.focus();
        }
      }
    });
    return true;
  }

  function criarRadio(nome, valor, texto, marcado, detalhe) {
    const rotulo = document.createElement('label');
    rotulo.className = 'caixa aparencia__opcao';
    const entrada = document.createElement('input');
    entrada.type = 'radio';
    entrada.name = nome;
    entrada.value = valor;
    entrada.checked = marcado;
    const span = document.createElement('span');
    span.textContent = texto;
    rotulo.appendChild(entrada);
    rotulo.appendChild(span);
    if (detalhe) {
      const mini = document.createElement('small');
      mini.className = 'aparencia__detalhe';
      mini.textContent = detalhe;
      rotulo.appendChild(mini);
    }
    return rotulo;
  }

  function montarGrupo(idContainer, nome, opcoes, atual) {
    const container = document.getElementById(idContainer);
    OP.ui.substituirFilhos(container, opcoes.map(function (o) {
      return criarRadio(nome, o.id, o.nome, o.id === atual, o.detalhe);
    }));
  }

  function marcarGrupo(nome, valor) {
    document.querySelectorAll('input[name="' + nome + '"]').forEach(function (r) { r.checked = r.value === valor; });
  }

  /**
   * quemAbriu: quem recebe o foco ao fechar (padrão: o botão da barra).
   * grupoFoco: id do grupo que recebe o foco ao abrir (padrão: tema do site);
   * "seletor-tema" é o tema da ficha, usado pelo botão "Tema" do dossiê.
   */
  function abrirAparencia(quemAbriu, grupoFoco) {
    const p = OP.prefs.aparencia();
    marcarGrupo('aparencia-tema', p.tema);
    marcarGrupo('aparencia-fonte', p.tamanhoFonte);
    marcarGrupo('aparencia-movimento', p.movimento);
    marcarGrupo('aparencia-som', p.som);
    if (OP.uiDossie) OP.uiDossie.sincronizarSeletor();
    abrirDialogo(refs.aparencia, quemAbriu || refs.botaoAparencia);
    const grupo = grupoFoco === 'seletor-tema' && !document.getElementById('seletor-tema').disabled
      ? 'tema-ficha'
      : 'aparencia-tema';
    const marcado = refs.aparencia.querySelector('input[name="' + grupo + '"]:checked');
    if (marcado) marcado.focus();
  }

  function aoMudarAparencia(evento) {
    const alvo = evento.target;
    if (!alvo || alvo.type !== 'radio') return;
    const mudanca = {};
    if (alvo.name === 'aparencia-tema') mudanca.tema = alvo.value;
    else if (alvo.name === 'aparencia-fonte') mudanca.tamanhoFonte = alvo.value;
    else if (alvo.name === 'aparencia-movimento') mudanca.movimento = alvo.value;
    else if (alvo.name === 'aparencia-som') mudanca.som = alvo.value;
    else return;
    const gravou = OP.prefs.definirAparencia(mudanca);
    aplicarAparencia(OP.prefs.aparencia());
    if (alvo.name === 'aparencia-som' && alvo.value === 'sim' && OP.som) OP.som.tocar(false); // amostra
    if (!gravou && OP.uiApp) OP.uiApp.aviso('aviso', 'Aviso: não foi possível guardar a aparência neste navegador (vale só até fechar a página).');
  }

  /* ------------------------------------------------------------------------
     Sobre
     ------------------------------------------------------------------------ */

  function abrirSobre() {
    document.getElementById('sobre-versao').textContent = String(OP.versao || '—');
    document.getElementById('sobre-modelo').textContent = String(OP.state.VERSAO_MODELO);
    const uso = OP.storage.uso();
    const mb = uso.usado / (1024 * 1024);
    const usado = mb >= 1 ? (Math.round(mb * 10) / 10).toString().replace('.', ',') + ' MB' : Math.max(1, Math.round(uso.usado / 1024)) + ' KB';
    document.getElementById('sobre-uso').textContent = usado + ' de ~' + Math.round(uso.limite / (1024 * 1024)) + ' MB';
    const aviso = document.getElementById('sobre-uso-aviso');
    aviso.hidden = uso.fracao <= 0.8;
    if (!aviso.hidden) {
      aviso.textContent = 'Aviso: o armazenamento está em ' + Math.round(uso.fracao * 100) + '% da cota. Exporte um backup e apague o que não usa mais.';
    }
    abrirDialogo(refs.sobre, refs.botaoSobre);
  }

  /* ------------------------------------------------------------------------
     Teclas
     ------------------------------------------------------------------------ */

  function digitando(alvo) {
    return Boolean(alvo) && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));
  }

  function abrirAjuda(quemAbriu) {
    if (document.querySelector('dialog[open]')) return;
    abrirDialogo(refs.ajuda, quemAbriu || document.activeElement);
  }

  function aoTecla(evento) {
    if (evento.key !== '?' || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (digitando(evento.target)) return;
    evento.preventDefault();
    abrirAjuda();
  }

  /* ------------------------------------------------------------------------
     Montagem
     ------------------------------------------------------------------------ */

  function montar() {
    refs.aparencia = document.getElementById('dialogo-aparencia');
    refs.sobre = document.getElementById('dialogo-sobre');
    refs.ajuda = document.getElementById('dialogo-ajuda');
    refs.botaoAparencia = document.getElementById('botao-aparencia');
    refs.botaoSobre = document.getElementById('botao-sobre');
    if (!refs.aparencia) return;

    const p = OP.prefs.aparencia();
    montarGrupo('aparencia-tema-opcoes', 'aparencia-tema', OP.data.temas, p.tema);
    montarGrupo('aparencia-fonte-opcoes', 'aparencia-fonte', OP.data.tamanhosFonte.map(function (t) {
      return { id: t.id, nome: t.nome, detalhe: t.px + ' px' };
    }), p.tamanhoFonte);
    montarGrupo('aparencia-movimento-opcoes', 'aparencia-movimento', MOVIMENTOS, p.movimento);
    montarGrupo('aparencia-som-opcoes', 'aparencia-som', SONS, p.som);

    refs.botaoAparencia.addEventListener('click', function () { abrirAparencia(); });
    refs.botaoSobre.addEventListener('click', abrirSobre);
    refs.aparencia.addEventListener('change', aoMudarAparencia);
    document.getElementById('sobre-backup').addEventListener('click', function () {
      if (OP.uiFichas) OP.uiFichas.baixarBackup();
    });
    document.getElementById('sobre-teclado').addEventListener('click', function () {
      refs.sobre.close();
      abrirDialogo(refs.ajuda, refs.botaoSobre);
    });
    // Fechar: botões com data-fechar-dialogo fecham o diálogo em que estão
    [refs.aparencia, refs.sobre, refs.ajuda].forEach(function (dialogo) {
      dialogo.addEventListener('click', function (evento) {
        if (evento.target.closest('[data-fechar-dialogo]')) dialogo.close();
      });
    });
    document.addEventListener('keydown', aoTecla);

    // O mesmo ajuste vale se a preferência mudar em outra aba
    window.addEventListener('storage', function (evento) {
      if (evento.key === OP.prefs.CHAVE) aplicarAparencia(OP.prefs.aparencia());
    });
    aplicarAparencia(p);
  }

  OP.ui.aplicarAparencia = aplicarAparencia;
  OP.ui.abrirDialogo = abrirDialogo;
  OP.uiAparencia = {
    montar: montar,
    abrirAparencia: abrirAparencia,
    abrirAjuda: abrirAjuda,
    abrirDialogo: abrirDialogo
  };
})(window.OP);
