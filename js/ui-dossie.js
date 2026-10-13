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
   - tema: data-elemento na ficha e no painel de rolagens. SÓ APARÊNCIA: não
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
    return OP.uiApp ? OP.uiApp.reduzMovimento() : Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function definirTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  function dadosTema(id) {
    return OP.data.temasFicha.find(function (tema) { return tema.id === id; }) || OP.data.temasFicha[0];
  }

  /* ------------------------------------------------------------------------
     Tema visual
     ------------------------------------------------------------------------ */

  function montarSeletorTema() {
    const caixa = refs.opcoesTema;
    caixa.textContent = '';
    OP.data.temasFicha.forEach(function (tema) {
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
    refs.vista.setAttribute('data-elemento', tema.id);
    refs.rolagens.setAttribute('data-elemento', tema.id);
    refs.atmosfera.setAttribute('data-elemento', tema.id);
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

  /** Um "−5"/"+3" sobe do valor por um instante quando PV, PE ou SAN mudam (feedback do ajuste). */
  const ultimoValor = {};
  function mostrarVariacao(elemento, id, atual) {
    const anterior = ultimoValor[id];
    ultimoValor[id] = atual;
    if (anterior === undefined || anterior === null || atual === null || anterior === atual) return;
    const delta = atual - anterior;
    const valor = elemento.querySelector('.vital__valor');
    if (!valor) return;
    const marca = document.createElement('span');
    marca.className = 'vital__variacao vital__variacao--' + (delta < 0 ? 'menos' : 'mais');
    marca.setAttribute('aria-hidden', 'true');
    marca.textContent = (delta < 0 ? '−' : '+') + Math.abs(delta);
    valor.appendChild(marca);
    window.setTimeout(function () { if (marca.parentNode) marca.parentNode.removeChild(marca); }, 1300);
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
      mostrarVariacao(elemento, recurso.id, definido ? OP.calc.numero(estado.atual) : null);
      elemento.querySelectorAll('[data-passo]').forEach(function (botao) {
        if (botao.disabled === definido) botao.disabled = !definido;
      });
      const abrir = elemento.querySelector('[data-abrir-vital]');
      if (abrir) {
        if (abrir.disabled === definido) abrir.disabled = !definido;
        const textoNivel = { zero: ' (zerado)', critico: ' (crítico)', baixo: ' (baixo)' }[nivel] || '';
        const rotulo = definido
          ? 'Ajustar ' + recurso.sigla + ': ' + textoNumero(estado.atual) + ' de ' + textoNumero(estado.max) + textoNivel
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
    // Celular/tablet: "Marina Duarte · Combatente · NEX 35%" no topo (a faixa do agente só existe no computador)
    const classe = OP.data.classes[ficha.identificacao.classe];
    const nivel = classe && classe.unidadeProgressao === 'estagio'
      ? 'Estágio ' + OP.calc.numero(ficha.identificacao.estagio)
      : 'NEX ' + OP.calc.numero(ficha.identificacao.nex) + '%';
    definirTexto(refs.trilhoAgente, [nome || 'Agente sem nome', classe ? classe.nome : 'sem classe', nivel].join(' · '));
    // Outra ficha: o primeiro valor dela não é uma variação
    if (ficha.id !== idDesenhado) Object.keys(ultimoValor).forEach(function (id) { delete ultimoValor[id]; });
    desenharVitais(derivados);

    refs.derivados = derivados;
    desenharFolhaVital();

    // Outra ficha aberta: aplica o tema dela (sem animação)
    if (ficha.id !== idDesenhado) {
      idDesenhado = ficha.id;
      Object.keys(ultimoValor).forEach(function (id) { delete ultimoValor[id]; });
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
    // Abre primeiro: desenharFolhaVital só desenha com a folha aberta (senão ela abriria com "— / —")
    if (!refs.dialogoVital.open) refs.dialogoVital.showModal();
    desenharFolhaVital();
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

  /**
   * PV: usa OP.calc.aplicarDano / aplicarCura (PV nunca abaixo de 0 nem acima do
   * máximo pela cura) e avisa um possível dano massivo, sem automatizar nada.
   * Devolve { anterior, novo, massivo } ou null. Os outros vitais usam o campo.
   */
  function somarVital(id, delta) {
    if (id !== 'pv' || !refs.derivados || !refs.derivados.recursos) {
      const feito = OP.ui.somarAoCampo('rec-' + id + '-atual', delta);
      return feito ? { anterior: feito.anterior, novo: feito.novo, massivo: false } : null;
    }
    const estado = refs.derivados.recursos.pv;
    if (!estado.classeDefinida) return null;
    const anterior = OP.calc.numero(estado.atual);
    let novo = anterior;
    let massivo = false;
    if (delta < 0) {
      const dano = OP.calc.aplicarDano(anterior, estado.max, -delta);
      novo = dano.pv;
      massivo = dano.massivo;
    } else {
      novo = OP.calc.aplicarCura(anterior, estado.max, delta);
    }
    if (novo !== anterior) OP.state.atualizar('recursos.pv.atual', novo);
    return { anterior: anterior, novo: novo, massivo: massivo };
  }

  function ajustarVital(delta) {
    const id = folhaVital.id;
    const recurso = dadosRecurso(id);
    if (!recurso || !delta) return;
    const resultado = somarVital(id, delta);
    definirTexto(refs.vitalMassivo, resultado && resultado.massivo && resultado.novo !== resultado.anterior
      ? 'Aviso: possível dano massivo (CONFERIR NO LIVRO).' : '');
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
    const quantia = OP.calc.lerNumero(refs.vitalQuantia.value, { inteiro: true, min: 0, padrao: 0 });
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
    refs.vitalMassivo = document.getElementById('vital-massivo');

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
      definirTexto(refs.vitalMassivo, '');
    });
  }

  /* ------------------------------------------------------------------------
     Ir até uma seção: a troca de página é do OP.uiPaginas
     ------------------------------------------------------------------------ */

  function irParaSecao(id) {
    if (OP.uiPaginas) OP.uiPaginas.irParaSecao(id);
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
    refs.trilhoAgente = document.getElementById('trilho-agente');
    refs.hudSemClasse = document.getElementById('hud-sem-classe');
    refs.hudTurno = document.getElementById('hud-turno');
    refs.vitais = {};
    document.querySelectorAll('[data-vital]').forEach(function (elemento) {
      refs.vitais[elemento.getAttribute('data-vital')] = elemento;
    });

    montarSeletorTema();
    montarFolhaVital();

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
