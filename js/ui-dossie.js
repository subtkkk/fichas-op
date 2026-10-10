/* ==========================================================================
   js/ui-dossie.js — capa do dossiê, vitais, índice das seções e tema
   (OP.uiDossie)
   --------------------------------------------------------------------------
   Entra no ciclo de desenho do js/ui.js (OP.ui.registrarExtensao):
   - capa: monograma (iniciais do nome), código do registro (do id da ficha);
   - vitais (PV, PE, SAN): os números e as barras vêm de data-saida e
     data-largura (ui.js); aqui só o estado visual (nível da barra), os
     botões −/+ desligados enquanto não há classe (o máximo é desconhecido)
     e a janela de ajuste (−5…+5, dano/cura de N e desfazer o último);
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

  /**
   * Aplica um tema na ficha e no painel de rolagens (e no fundo, enquanto a
   * ficha está na tela). Com transição: a página se dissolve no tema novo
   * (View Transitions) ou, sem esse recurso, as cores deslizam (@property).
   */
  function aplicarTema(idTema, comTransicao) {
    const tema = dadosTema(idTema);
    if (temaAplicado === tema.id) return;
    const raiz = document.documentElement;
    const animar = comTransicao && !reduzMovimento() && document.body.dataset.vista === 'ficha';
    if (animar && typeof document.startViewTransition === 'function' && !raiz.dataset.transicao) {
      raiz.dataset.transicao = 'tema';
      let feita = false;
      const aplicar = function () {
        if (feita) return;
        feita = true;
        trocarTema(tema);
      };
      const reserva = setTimeout(aplicar, 300); // se o navegador atrasar a passagem, troca mesmo assim
      const terminar = function () {
        clearTimeout(reserva);
        aplicar();
        if (raiz.dataset.transicao === 'tema') delete raiz.dataset.transicao;
      };
      try {
        document.startViewTransition(aplicar).finished.then(terminar, terminar);
      } catch (erro) {
        terminar();
      }
      return;
    }
    if (animar) {
      raiz.classList.add('trocando-tema');
      clearTimeout(refs.timerTema);
      refs.timerTema = setTimeout(function () { raiz.classList.remove('trocando-tema'); }, 700);
    }
    trocarTema(tema);
  }

  function trocarTema(tema) {
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
      const abrir = elemento.querySelector('[data-abrir-vital]');
      if (abrir) {
        if (abrir.disabled === definido) abrir.disabled = !definido;
        const rotulo = definido
          ? 'Ajustar ' + recurso.sigla + ': ' + textoNumero(estado.atual) + ' de ' + textoNumero(estado.max) +
            (nivel === 'zero' ? ' (zerado)' : '')
          : recurso.sigla + ': escolha uma classe para calcular';
        if (abrir.getAttribute('aria-label') !== rotulo) abrir.setAttribute('aria-label', rotulo);
      }
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

    refs.derivados = derivados;
    desenharFolhaVital();

    // Outra ficha aberta: aplica o tema dela (sem animação)
    if (ficha.id !== idDesenhado) {
      idDesenhado = ficha.id;
      folhaVital.ultimo = {};
      if (refs.dialogoVital && refs.dialogoVital.open) refs.dialogoVital.close();
      aplicarTema(OP.prefs.tema(ficha.id), false);
    }
  }

  /* ------------------------------------------------------------------------
     Ajuste de vitais: janela no desktop, gaveta no celular. Usa o mesmo
     campo dos Recursos (rec-<id>-atual), então os limites (0 e o máximo)
     e o salvamento são os de sempre; aqui só se soma e se guarda o último
     ajuste para poder desfazer.
     ------------------------------------------------------------------------ */

  // Palavras de cada vital para tirar e somar (só o rótulo dos botões)
  const ACOES_VITAL = {
    pv: { menos: 'Dano', mais: 'Cura' },
    pe: { menos: 'Gastar', mais: 'Recuperar' },
    san: { menos: 'Perder', mais: 'Recuperar' }
  };

  const folhaVital = { id: null, ultimo: {} }; // ultimo[id] = { anterior, novo }

  function textoNumero(valor) {
    return valor === null || valor === undefined || valor === '' ? '—' : String(valor);
  }

  /** "PV zerados", "PE zerados", "Sanidade zerada" (só o fato; a regra fica com a mesa). */
  function textoZerado(recurso) {
    return recurso.id === 'san' ? 'Sanidade zerada.' : recurso.sigla + ' zerados.';
  }

  function dadosRecurso(id) {
    return OP.data.recursos.find(function (recurso) { return recurso.id === id; });
  }

  function sinal(delta) {
    return (delta < 0 ? '−' : '+') + Math.abs(delta);
  }

  function abrirFolhaVital(id) {
    const recurso = dadosRecurso(id);
    if (!recurso || !refs.dialogoVital) return;
    folhaVital.id = id;
    refs.dialogoVital.setAttribute('data-vital', id);
    definirTexto(refs.vitalSigla, recurso.sigla);
    definirTexto(refs.vitalNome, recurso.nome);
    const acoes = ACOES_VITAL[id] || { menos: 'Tirar', mais: 'Somar' };
    definirTexto(refs.vitalMenos, acoes.menos);
    definirTexto(refs.vitalMais, acoes.mais);
    refs.vitalMenos.setAttribute('aria-label', acoes.menos + ': tirar a quantia de ' + recurso.sigla);
    refs.vitalMais.setAttribute('aria-label', acoes.mais + ': somar a quantia a ' + recurso.sigla);
    refs.vitalPassos.forEach(function (botao) {
      const delta = Number(botao.getAttribute('data-vital-delta'));
      botao.setAttribute('aria-label', (delta < 0 ? 'Menos ' : 'Mais ') + Math.abs(delta) + ' ' + recurso.sigla);
    });
    refs.vitalQuantia.value = '';
    definirTexto(refs.vitalMensagem, '');
    desenharFolhaVital();
    if (!refs.dialogoVital.open) refs.dialogoVital.showModal();
    // Foco no −1 (não no campo: no celular, focar o campo abriria o teclado)
    const menosUm = refs.dialogoVital.querySelector('[data-vital-delta="-1"]');
    if (menosUm && !menosUm.disabled) menosUm.focus();
  }

  function desenharFolhaVital() {
    const id = folhaVital.id;
    if (!id || !refs.dialogoVital || !refs.dialogoVital.open || !refs.derivados) return;
    const estado = refs.derivados.recursos && refs.derivados.recursos[id];
    if (!estado) return;
    const definido = Boolean(estado.classeDefinida);
    definirTexto(refs.vitalAtual, textoNumero(estado.atual));
    definirTexto(refs.vitalMax, textoNumero(estado.max));
    const percentual = Math.max(0, Math.min(100, OP.calc.numero(estado.percentual)));
    const largura = (definido ? percentual : 0) + '%';
    if (refs.vitalBarra.style.width !== largura) refs.vitalBarra.style.width = largura;
    const nivel = definido ? nivelBarra(percentual) : 'indefinido';
    if (refs.dialogoVital.dataset.nivel !== nivel) refs.dialogoVital.dataset.nivel = nivel;
    const recurso = dadosRecurso(id);
    definirTexto(refs.vitalEstado, nivel === 'zero' && recurso ? textoZerado(recurso) : '');
    refs.vitalEstado.hidden = nivel !== 'zero';
    refs.dialogoVital.querySelectorAll('[data-vital-delta], [data-vital-aplicar]').forEach(function (botao) {
      if (botao.disabled === definido) botao.disabled = !definido;
    });
    // O valor mudou por outro caminho (campo dos Recursos, outra aba): o desfazer perde o sentido
    const ultimo = folhaVital.ultimo[id];
    if (ultimo && OP.calc.numero(estado.atual) !== ultimo.novo) delete folhaVital.ultimo[id];
    const temUltimo = Boolean(folhaVital.ultimo[id]);
    refs.vitalDesfazer.hidden = !temUltimo;
    refs.vitalUltimoLinha.hidden = !temUltimo && !refs.vitalMensagem.textContent;
  }

  function ajustarVital(delta) {
    const id = folhaVital.id;
    const recurso = dadosRecurso(id);
    if (!recurso || !delta) return;
    const resultado = OP.ui.somarAoCampo('rec-' + id + '-atual', delta);
    if (!resultado) return;
    if (resultado.novo === resultado.anterior) {
      definirTexto(refs.vitalMensagem, recurso.sigla + (delta < 0 ? ' já está no mínimo.' : ' já está no máximo.'));
      desenharFolhaVital();
      return;
    }
    folhaVital.ultimo[id] = resultado;
    definirTexto(refs.vitalMensagem, sinal(resultado.novo - resultado.anterior) + ' ' + recurso.sigla +
      ' · ' + resultado.anterior + ' → ' + resultado.novo);
    desenharFolhaVital();
  }

  function aplicarQuantia(direcao) {
    const quantia = Math.floor(Number(refs.vitalQuantia.value));
    if (!(quantia > 0)) {
      definirTexto(refs.vitalMensagem, 'Digite a quantia (um número maior que zero).');
      refs.vitalUltimoLinha.hidden = false;
      refs.vitalQuantia.focus();
      return;
    }
    refs.vitalQuantia.value = '';
    ajustarVital(direcao * quantia);
  }

  function desfazerVital() {
    const id = folhaVital.id;
    const ultimo = folhaVital.ultimo[id];
    const recurso = dadosRecurso(id);
    if (!ultimo || !recurso) return;
    delete folhaVital.ultimo[id];
    definirTexto(refs.vitalMensagem, 'Desfeito: ' + recurso.sigla + ' volta a ' + ultimo.anterior + '.');
    OP.state.atualizar('recursos.' + id + '.atual', ultimo.anterior);
    desenharFolhaVital();
  }

  function montarFolhaVital() {
    refs.dialogoVital = document.getElementById('dialogo-vital');
    if (!refs.dialogoVital) return;
    refs.vitalSigla = document.getElementById('vital-sigla');
    refs.vitalNome = document.getElementById('vital-nome');
    refs.vitalAtual = document.getElementById('vital-atual');
    refs.vitalMax = document.getElementById('vital-max');
    refs.vitalBarra = document.getElementById('vital-barra');
    refs.vitalQuantia = document.getElementById('vital-quantia');
    refs.vitalMenos = document.getElementById('vital-menos');
    refs.vitalMais = document.getElementById('vital-mais');
    refs.vitalMensagem = document.getElementById('vital-ultimo');
    refs.vitalUltimoLinha = document.getElementById('vital-ultimo-linha');
    refs.vitalDesfazer = document.getElementById('vital-desfazer');
    refs.vitalPassos = Array.prototype.slice.call(refs.dialogoVital.querySelectorAll('[data-vital-delta]'));
    refs.vitalEstado = document.getElementById('vital-estado');

    document.querySelectorAll('[data-abrir-vital]').forEach(function (botao) {
      botao.addEventListener('click', function () { abrirFolhaVital(botao.getAttribute('data-abrir-vital')); });
    });

    refs.dialogoVital.addEventListener('click', function (evento) {
      // Toque fora da janela (no fundo escurecido) fecha
      if (evento.target === refs.dialogoVital) {
        refs.dialogoVital.close();
        return;
      }
      const passo = evento.target.closest('[data-vital-delta]');
      if (passo) {
        ajustarVital(Number(passo.getAttribute('data-vital-delta')));
        return;
      }
      const aplicar = evento.target.closest('[data-vital-aplicar]');
      if (aplicar) {
        aplicarQuantia(Number(aplicar.getAttribute('data-vital-aplicar')));
        return;
      }
      if (evento.target.closest('#vital-desfazer')) {
        desfazerVital();
        return;
      }
      if (evento.target.closest('[data-fechar-vital]')) refs.dialogoVital.close();
    });

    refs.dialogoVital.addEventListener('close', function () {
      folhaVital.id = null;
      definirTexto(refs.vitalMensagem, '');
    });
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
    refs.secaoAtiva = id;
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
    const topoFixo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topo-fixo')) || 0;
    const linha = topoFixo + (window.innerHeight - topoFixo) * 0.33;
    // Seções lado a lado (atributos e recursos) têm o mesmo topo: formam um
    // grupo; vale a já marcada (ex.: a que foi clicada no índice) ou a 1ª.
    let grupo = refs.secoes.length ? [refs.secoes[0]] : [];
    let topoGrupo = -Infinity;
    for (let i = 0; i < refs.secoes.length; i++) {
      const topo = refs.secoes[i].getBoundingClientRect().top;
      if (topo > linha) continue;
      if (topo > topoGrupo + 2) {
        grupo = [refs.secoes[i]];
        topoGrupo = topo;
      } else if (Math.abs(topo - topoGrupo) <= 2) {
        grupo.push(refs.secoes[i]);
      }
    }
    let ativa = grupo[0] || null;
    for (let i = 0; i < grupo.length; i++) {
      if (grupo[i].id === refs.secaoAtiva) ativa = grupo[i];
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
    montarFolhaVital();

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
