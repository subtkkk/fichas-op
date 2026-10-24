/* ==========================================================================
   js/ui-defesa.js — Defesa, Esquiva, Bloqueio e RD (OP.uiDefesa)
   --------------------------------------------------------------------------
   - Defesa, Esquiva e Bloqueio (nos vitais e no Resumo do celular) são botões:
     abrem #dialogo-defesa, que mostra a conta de cada um. Antes do resultado
     da Defesa há o campo "Outros", para somar à mão os bônus de habilidades
     que a ficha não calcula. Ele grava no mesmo campo defesa.outros do painel
     "Composição, reações e RD" (um valor só; vazio = 0).
   - "RD" (redução de dano) abre #dialogo-rd: cada RD tem um valor, um nome
     opcional e os tipos de dano que ela cobre (OP.data.tiposDano), marcados
     numa lista. A lista fica em ficha.defesa.rd e as contas em OP.calc.estadoRd.
   - Aqui só tem tela; as contas ficam em js/calc.js.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const MAX_RD = 50;
  const MAX_VALOR = 999;
  const abertas = Object.create(null); // ids de RD com o painel de tipos aberto (só da tela)
  let assinaturaLista = '';            // ids das RD desenhadas no diálogo
  let fichaDesenhada = null;           // id da ficha da lista desenhada
  let focoPendente = null;             // id da RD nova: foco no valor depois de desenhar
  let ultimaRemovida = null;           // { rd, posicao, idFicha } para o Desfazer do diálogo

  function criar(tag, classe, texto) {
    return OP.ui.criarElemento(tag, classe, texto);
  }

  function definirTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  function comSinal(valor) {
    return (valor < 0 ? '−' : '+') + Math.abs(valor);
  }

  /** Inteiro entre 0 e MAX_VALOR (vazio e texto viram 0). */
  function valorRd(texto) {
    const n = Math.trunc(Number(texto));
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_VALOR) : 0;
  }

  function nomeDoTipo(idTipo) {
    const tipo = OP.data.tiposDano.find(function (t) { return t.id === idTipo; });
    return tipo ? tipo.nome : idTipo;
  }

  /** "Fogo, Frio" · "Todos os tipos" · "nenhum tipo marcado". */
  function textoTipos(ids) {
    if (!ids.length) return 'nenhum tipo marcado';
    if (ids.length === OP.data.tiposDano.length) return 'todos os tipos';
    return ids.map(nomeDoTipo).join(', ');
  }

  /* ------------------------------------------------------------------------
     Defesa, Esquiva e Bloqueio
     ------------------------------------------------------------------------ */

  function linhaCalculo(rotulo, valor, nota) {
    const linha = criar('li', 'calculo__linha');
    const texto = criar('span', 'calculo__rotulo', rotulo);
    if (nota) texto.appendChild(criar('small', 'calculo__nota-linha', nota));
    linha.appendChild(texto);
    linha.appendChild(criar('output', 'calculo__valor', valor));
    return linha;
  }

  /** Mostra ou esconde um aviso de texto (só mexe no DOM se mudar). */
  function definirAviso(elemento, texto) {
    definirTexto(elemento, texto);
    if (elemento.hidden !== !texto) elemento.hidden = !texto;
  }

  function nomeReacao(idReacao) {
    const reacao = (OP.data.reacoes || []).find(function (r) { return r.id === idReacao; });
    const pericia = reacao && OP.data.pericias.find(function (p) { return p.id === reacao.pericia; });
    return { pericia: pericia ? pericia.nome : '', reacao: reacao };
  }

  function desenharDefesa(ficha, derivados) {
    const c = derivados.defesa;
    const atributo = OP.data.atributos.find(function (a) { return a.id === c.atributo; });
    const linhas = [
      linhaCalculo('Base', String(c.base), 'valor fixo'),
      linhaCalculo(atributo ? atributo.nome + ' (' + atributo.sigla + ')' : 'Atributo', comSinal(c.valorAtributo), 'total do atributo, com os bônus'),
      linhaCalculo('Proteções equipadas', comSinal(c.protecoesInventario), (document.getElementById('nomes-protecoes') || {}).textContent || 'do Inventário'),
      linhaCalculo('Proteção manual', comSinal(c.protecao), String(ficha.defesa.protecao.nome || '').trim())
    ];
    if (c.sobrecarga) linhas.push(linhaCalculo('Sobrecarga', comSinal(-c.sobrecarga), 'carga acima do limite'));
    if (c.condicoes) linhas.push(linhaCalculo('Condições', comSinal(c.condicoes)));
    if (c.efeitos) linhas.push(linhaCalculo('Poderes e habilidades', comSinal(c.efeitos), 'efeitos automáticos'));
    OP.ui.substituirFilhos(refs.linhasDefesa, linhas);

    // Vazio quando é 0 (placeholder "0"); não mexe no campo enquanto a pessoa digita
    if (document.activeElement !== refs.outros) {
      const texto = c.outros === 0 ? '' : String(c.outros);
      if (refs.outros.value !== texto) refs.outros.value = texto;
    }
    definirTexto(refs.totalDefesa, String(c.total));

    const contraTipos = [];
    if (c.totalCorpoACorpo !== c.total) contraTipos.push('corpo a corpo ' + c.totalCorpoACorpo);
    if (c.totalDistancia !== c.total) contraTipos.push('à distância ' + c.totalDistancia);
    definirAviso(refs.tiposDefesa, contraTipos.length ? 'Contra ataques ' + contraTipos.join(' · ') + ' (por causa de condições).' : '');

    // Esquiva
    const e = c.esquiva;
    const reflexos = nomeReacao('esquiva');
    OP.ui.substituirFilhos(refs.linhasEsquiva, e.disponivel ? [
      linhaCalculo('Defesa', String(c.total), 'a de cima, já com "Outros"'),
      linhaCalculo('Bônus de ' + (reflexos.pericia || 'Reflexos'), comSinal(e.bonus), 'grau de treinamento + outros bônus da perícia')
    ] : []);
    definirTexto(refs.valorEsquiva, e.disponivel ? String(e.defesaComEsquiva) : '—');
    definirAviso(refs.avisoEsquiva, e.disponivel ? '' : 'Indisponível: ' + (reflexos.pericia || 'Reflexos') + ' precisa estar treinada.');

    // Bloqueio
    const b = c.bloqueio;
    const fortitude = nomeReacao('bloqueio');
    OP.ui.substituirFilhos(refs.linhasBloqueio, b.disponivel ? [
      linhaCalculo('Bônus de ' + (fortitude.pericia || 'Fortitude'), comSinal(b.reducao), 'grau de treinamento + outros bônus da perícia; nunca abaixo de 0')
    ] : []);
    definirTexto(refs.valorBloqueio, b.disponivel ? String(b.reducao) : '—');
    definirAviso(refs.avisoBloqueio, b.disponivel ? '' : 'Indisponível: ' + (fortitude.pericia || 'Fortitude') + ' precisa estar treinada.');
  }

  function abrirDefesa(alvo, quemAbriu) {
    const ficha = OP.state.ficha;
    const derivados = OP.calc.calcularTudo(ficha);
    desenharDefesa(ficha, derivados);
    OP.ui.abrirDialogo(refs.dlgDefesa, quemAbriu);
    Object.keys(refs.secoes).forEach(function (id) {
      refs.secoes[id].classList.toggle('calculo--foco', id === alvo && id !== 'defesa');
    });
    if (alvo && alvo !== 'defesa') refs.secoes[alvo].scrollIntoView({ block: 'nearest' });
  }

  /** Passo do campo "Outros" (− e +) e digitação: grava em defesa.outros. */
  function gravarOutros(valor) {
    const n = Math.min(Math.max(Math.trunc(Number(valor)) || 0, -MAX_VALOR), MAX_VALOR);
    OP.state.atualizar('defesa.outros', n);
  }

  function aoDigitarOutros() {
    gravarOutros(refs.outros.value);
  }

  function aoPassoOutros(evento) {
    const botao = evento.target.closest('[data-defesa-passo]');
    if (!botao) return;
    const atual = Math.trunc(Number(refs.outros.value)) || 0;
    const novo = atual + Number(botao.dataset.defesaPasso);
    refs.outros.value = novo === 0 ? '' : String(novo);
    gravarOutros(novo);
  }

  /* ------------------------------------------------------------------------
     RD (redução de dano)
     ------------------------------------------------------------------------ */

  function indiceDaRd(idRd) {
    return OP.state.ficha.defesa.rd.findIndex(function (rd) { return rd.id === idRd; });
  }

  function criarCartaoRd(rd) {
    const idPainel = 'rd-tipos-' + rd.id;
    const cartao = criar('li', 'rd-cartao');
    cartao.dataset.rdId = rd.id;

    const linha = criar('div', 'rd-cartao__linha');
    const rotuloValor = criar('label', 'rd-cartao__campo rd-cartao__campo--valor');
    rotuloValor.appendChild(criar('span', 'rd-cartao__rotulo', 'RD'));
    const valor = criar('input', 'controle controle--numero');
    valor.type = 'number';
    valor.min = '0';
    valor.max = String(MAX_VALOR);
    valor.step = '1';
    valor.inputMode = 'numeric';
    valor.setAttribute('data-rd-valor', '');
    rotuloValor.appendChild(valor);
    const rotuloNome = criar('label', 'rd-cartao__campo rd-cartao__campo--nome');
    rotuloNome.appendChild(criar('span', 'rd-cartao__rotulo', 'De onde vem (opcional)'));
    const nome = criar('input', 'controle');
    nome.type = 'text';
    nome.maxLength = 80;
    nome.autocomplete = 'off';
    nome.placeholder = 'Ex.: Pele de pedra';
    nome.setAttribute('data-rd-nome', '');
    rotuloNome.appendChild(nome);
    const remover = criar('button', 'botao-icone rd-cartao__remover');
    remover.type = 'button';
    remover.setAttribute('data-rd-remover', '');
    remover.setAttribute('aria-label', 'Remover esta RD');
    remover.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';
    linha.appendChild(rotuloValor);
    linha.appendChild(rotuloNome);
    linha.appendChild(remover);
    cartao.appendChild(linha);

    const botaoTipos = criar('button', 'rd-cartao__tipos');
    botaoTipos.type = 'button';
    botaoTipos.setAttribute('data-rd-alternar', '');
    botaoTipos.setAttribute('aria-controls', idPainel);
    botaoTipos.appendChild(criar('span', 'rd-cartao__tipos-rotulo', 'Tipos de dano'));
    botaoTipos.appendChild(criar('span', 'rd-cartao__tipos-resumo'));
    cartao.appendChild(botaoTipos);

    const painel = criar('div', 'rd-cartao__painel');
    painel.id = idPainel;
    const rapidos = criar('div', 'rd-cartao__rapidos');
    const todos = criar('button', 'botao botao--pequeno', 'Marcar todos');
    todos.type = 'button';
    todos.setAttribute('data-rd-todos', '');
    const limpar = criar('button', 'botao botao--pequeno', 'Limpar');
    limpar.type = 'button';
    limpar.setAttribute('data-rd-limpar', '');
    rapidos.appendChild(todos);
    rapidos.appendChild(limpar);
    painel.appendChild(rapidos);
    OP.data.gruposDano.forEach(function (grupo) {
      const conjunto = criar('fieldset', 'rd-cartao__grupo');
      conjunto.appendChild(criar('legend', '', grupo.nome));
      OP.data.tiposDano.filter(function (tipo) { return tipo.grupo === grupo.id; }).forEach(function (tipo) {
        const rotulo = criar('label', 'caixa rd-cartao__tipo');
        const caixa = document.createElement('input');
        caixa.type = 'checkbox';
        caixa.value = tipo.id;
        caixa.setAttribute('data-rd-tipo', tipo.id);
        rotulo.appendChild(caixa);
        rotulo.appendChild(criar('span', '', tipo.nome));
        conjunto.appendChild(rotulo);
      });
      painel.appendChild(conjunto);
    });
    cartao.appendChild(painel);
    return cartao;
  }

  /** Confere os valores do cartão com a ficha (não mexe no campo em que a pessoa digita). */
  function sincronizarCartaoRd(cartao, rd, ativo) {
    const valor = cartao.querySelector('[data-rd-valor]');
    const nome = cartao.querySelector('[data-rd-nome]');
    if (document.activeElement !== valor && valor.value !== String(rd.valor)) valor.value = String(rd.valor);
    if (document.activeElement !== nome && nome.value !== rd.nome) nome.value = rd.nome;
    const marcados = [];
    cartao.querySelectorAll('[data-rd-tipo]').forEach(function (caixa) {
      const marcada = rd.tipos[caixa.value] === true;
      if (caixa.checked !== marcada) caixa.checked = marcada;
      if (marcada) marcados.push(caixa.value);
    });
    const aberta = abertas[rd.id] === true;
    const botao = cartao.querySelector('[data-rd-alternar]');
    botao.setAttribute('aria-expanded', String(aberta));
    cartao.querySelector('.rd-cartao__painel').hidden = !aberta;
    definirTexto(cartao.querySelector('.rd-cartao__tipos-resumo'), textoTipos(marcados));
    cartao.classList.toggle('rd-cartao--incompleta', !ativo);
  }

  /** Total por tipo (as RD que cobrem o mesmo tipo se somam) em uma linha. */
  function textoTotais(rd) {
    const ids = OP.data.tiposDano.map(function (t) { return t.id; }).filter(function (id) { return rd.porTipo[id]; });
    if (!ids.length) return '';
    return 'Total por tipo: ' + ids.map(function (id) { return nomeDoTipo(id) + ' ' + rd.porTipo[id]; }).join(' · ') + '.';
  }

  function desenharDialogoRd(ficha, derivados) {
    const lista = ficha.defesa.rd;
    const assinatura = lista.map(function (rd) { return rd.id; }).join('|');
    if (assinatura !== assinaturaLista || fichaDesenhada !== ficha.id) {
      assinaturaLista = assinatura;
      fichaDesenhada = ficha.id;
      OP.ui.substituirFilhos(refs.listaRd, lista.map(criarCartaoRd));
    }
    const cartoes = refs.listaRd.children;
    lista.forEach(function (rd, indice) {
      const ativo = derivados.rd.lista[indice] && derivados.rd.lista[indice].valor > 0 && derivados.rd.lista[indice].tipos.length > 0;
      sincronizarCartaoRd(cartoes[indice], rd, ativo);
    });
    refs.vazioRd.hidden = lista.length > 0;
    refs.adicionarRd.disabled = lista.length >= MAX_RD;
    definirAviso(refs.totaisRd, textoTotais(derivados.rd));
    if (focoPendente) {
      const cartao = refs.listaRd.querySelector('[data-rd-id="' + focoPendente + '"] [data-rd-valor]');
      focoPendente = null;
      if (cartao) cartao.focus();
    }
  }

  function adicionarRd() {
    const lista = OP.state.ficha.defesa.rd;
    if (lista.length >= MAX_RD) return;
    const nova = OP.state.novaRd();
    abertas[nova.id] = true; // já abre a lista de tipos: é o que se faz a seguir
    focoPendente = nova.id;
    OP.state.atualizar('defesa.rd', lista.concat([nova]));
  }

  function removerRd(idRd) {
    const lista = OP.state.ficha.defesa.rd;
    const posicao = indiceDaRd(idRd);
    if (posicao === -1) return;
    ultimaRemovida = { rd: lista[posicao], posicao: posicao, idFicha: OP.state.ficha.id };
    delete abertas[idRd];
    OP.state.atualizar('defesa.rd', lista.filter(function (rd) { return rd.id !== idRd; }));
    refs.desfazerLinha.hidden = false;
    if (OP.uiApp && OP.uiApp.anunciar) OP.uiApp.anunciar('RD removida.');
  }

  function desfazerRemocao() {
    const guardada = ultimaRemovida;
    ultimaRemovida = null;
    refs.desfazerLinha.hidden = true;
    if (!guardada || guardada.idFicha !== OP.state.ficha.id) return;
    const lista = OP.state.ficha.defesa.rd.slice();
    if (lista.some(function (rd) { return rd.id === guardada.rd.id; })) return;
    lista.splice(Math.min(guardada.posicao, lista.length), 0, guardada.rd);
    OP.state.atualizar('defesa.rd', lista);
    if (OP.uiApp && OP.uiApp.anunciar) OP.uiApp.anunciar('Desfeito: a RD voltou.');
  }

  function aoDigitarRd(evento) {
    const cartao = evento.target.closest('[data-rd-id]');
    if (!cartao) return;
    const indice = indiceDaRd(cartao.dataset.rdId);
    if (indice === -1) return;
    if (evento.target.matches('[data-rd-valor]')) {
      OP.state.atualizar('defesa.rd.' + indice + '.valor', valorRd(evento.target.value));
    } else if (evento.target.matches('[data-rd-nome]')) {
      OP.state.atualizar('defesa.rd.' + indice + '.nome', evento.target.value.slice(0, 80));
    }
  }

  function aoMudarRd(evento) {
    const caixa = evento.target.closest('[data-rd-tipo]');
    const cartao = evento.target.closest('[data-rd-id]');
    if (!caixa || !cartao) return;
    const indice = indiceDaRd(cartao.dataset.rdId);
    if (indice === -1) return;
    OP.state.atualizar('defesa.rd.' + indice + '.tipos.' + caixa.dataset.rdTipo, caixa.checked);
  }

  function aoClicarRd(evento) {
    const cartao = evento.target.closest('[data-rd-id]');
    if (!cartao) return;
    const id = cartao.dataset.rdId;
    if (evento.target.closest('[data-rd-remover]')) {
      removerRd(id);
    } else if (evento.target.closest('[data-rd-alternar]')) {
      abertas[id] = abertas[id] !== true;
      const rd = OP.state.ficha.defesa.rd[indiceDaRd(id)];
      if (rd) sincronizarCartaoRd(cartao, rd, !cartao.classList.contains('rd-cartao--incompleta'));
    } else if (evento.target.closest('[data-rd-todos]') || evento.target.closest('[data-rd-limpar]')) {
      const marcar = Boolean(evento.target.closest('[data-rd-todos]'));
      const indice = indiceDaRd(id);
      if (indice === -1) return;
      const tipos = {};
      OP.data.tiposDano.forEach(function (tipo) { tipos[tipo.id] = marcar; });
      OP.state.atualizar('defesa.rd.' + indice + '.tipos', tipos);
    }
  }

  function abrirRd(quemAbriu) {
    assinaturaLista = ''; // refaz a lista ao abrir
    desenharDialogoRd(OP.state.ficha, OP.calc.calcularTudo(OP.state.ficha));
    OP.ui.abrirDialogo(refs.dlgRd, quemAbriu);
  }

  /* ------------------------------------------------------------------------
     Resumo na página e ciclo de desenho
     ------------------------------------------------------------------------ */

  let assinaturaResumo = null;

  /** Lista de RD que valem, na seção da Defesa (e no papel), e a contagem nos vitais. */
  function desenharResumo(derivados) {
    const validas = derivados.rd.lista.filter(function (rd) { return rd.valor > 0 && rd.tipos.length; });
    const textos = validas.map(function (rd) {
      return rd.valor + ' — ' + textoTipos(rd.tipos) + (rd.nome ? ' (' + rd.nome + ')' : '');
    });
    const assinatura = textos.join('\n');
    if (assinatura !== assinaturaResumo) {
      assinaturaResumo = assinatura;
      OP.ui.substituirFilhos(refs.resumoLista, textos.map(function (texto) { return criar('li', 'rd-resumo__item', texto); }));
      refs.resumoVazio.hidden = textos.length > 0;
    }
    const contagem = validas.length ? String(validas.length) : '—';
    const dica = validas.length ? 'RD: ' + validas.length + (validas.length === 1 ? ' ativa' : ' ativas') + '. Abra para ver ou editar.' : 'RD: redução de dano por tipo de dano. Abra para adicionar.';
    document.querySelectorAll('[data-rd-contagem]').forEach(function (saida) {
      definirTexto(saida, contagem);
      const celula = saida.closest('div');
      if (celula && celula.title !== dica) celula.title = dica;
    });
  }

  function desenhar(ficha, derivados) {
    desenharResumo(derivados);
    if (refs.dlgDefesa.open) desenharDefesa(ficha, derivados);
    if (refs.dlgRd.open) desenharDialogoRd(ficha, derivados);
  }

  function fecharAoClicar(dialogo) {
    dialogo.addEventListener('click', function (evento) {
      if (evento.target === dialogo || evento.target.closest('[data-fechar-dialogo]')) dialogo.close();
    });
  }

  function montar() {
    refs.dlgDefesa = document.getElementById('dialogo-defesa');
    refs.dlgRd = document.getElementById('dialogo-rd');
    refs.linhasDefesa = document.getElementById('defesa-dlg-linhas');
    refs.outros = document.getElementById('defesa-dlg-outros');
    refs.totalDefesa = document.getElementById('defesa-dlg-total');
    refs.tiposDefesa = document.getElementById('defesa-dlg-tipos');
    refs.linhasEsquiva = document.getElementById('defesa-dlg-esquiva-linhas');
    refs.valorEsquiva = document.getElementById('defesa-dlg-esquiva-valor');
    refs.avisoEsquiva = document.getElementById('defesa-dlg-esquiva-aviso');
    refs.linhasBloqueio = document.getElementById('defesa-dlg-bloqueio-linhas');
    refs.valorBloqueio = document.getElementById('defesa-dlg-bloqueio-valor');
    refs.avisoBloqueio = document.getElementById('defesa-dlg-bloqueio-aviso');
    refs.secoes = {
      defesa: document.getElementById('defesa-dlg-defesa'),
      esquiva: document.getElementById('defesa-dlg-esquiva'),
      bloqueio: document.getElementById('defesa-dlg-bloqueio')
    };
    refs.listaRd = document.getElementById('rd-dlg-lista');
    refs.vazioRd = document.getElementById('rd-dlg-vazio');
    refs.adicionarRd = document.getElementById('rd-dlg-adicionar');
    refs.totaisRd = document.getElementById('rd-dlg-totais');
    refs.desfazerLinha = document.getElementById('rd-dlg-desfazer-linha');
    refs.resumoLista = document.getElementById('rd-resumo-lista');
    refs.resumoVazio = document.getElementById('rd-resumo-vazio');
    if (!refs.dlgDefesa || !refs.dlgRd || !refs.outros || !refs.listaRd || !refs.resumoLista) return;

    document.addEventListener('click', function (evento) {
      const defesa = evento.target.closest('[data-abrir-defesa]');
      if (defesa) {
        abrirDefesa(defesa.dataset.abrirDefesa, defesa);
        return;
      }
      const rd = evento.target.closest('[data-abrir-rd]');
      if (rd) abrirRd(rd);
    });

    fecharAoClicar(refs.dlgDefesa);
    fecharAoClicar(refs.dlgRd);
    refs.outros.addEventListener('input', aoDigitarOutros);
    refs.dlgDefesa.addEventListener('click', aoPassoOutros);
    refs.listaRd.addEventListener('input', aoDigitarRd);
    refs.listaRd.addEventListener('change', aoMudarRd);
    refs.listaRd.addEventListener('click', aoClicarRd);
    refs.adicionarRd.addEventListener('click', adicionarRd);
    document.getElementById('rd-dlg-desfazer').addEventListener('click', desfazerRemocao);
    refs.dlgRd.addEventListener('close', function () {
      ultimaRemovida = null;
      refs.desfazerLinha.hidden = true;
    });
    OP.ui.registrarExtensao({ desenhar: desenhar });
  }

  OP.uiDefesa = {
    montar: montar,
    abrirDefesa: abrirDefesa,
    abrirRd: abrirRd
  };
})(window.OP);
