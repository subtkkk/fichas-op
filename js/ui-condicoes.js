/* ==========================================================================
   js/ui-condicoes.js — condições, estados e descanso (OP.uiCondicoes)
   --------------------------------------------------------------------------
   Entra no ciclo de desenho do js/ui.js (OP.ui.registrarExtensao):
   - faixa de estados (saúde e sanidade), sempre com texto + ícone;
   - bloco "Morrendo" (turnos) e "Enlouquecendo" (SAN em 0). O que acontece
     depois é decisão da mesa: nada aqui trava a ficha;
   - cartões das condições ativas, adicionar (catálogo ou personalizada),
     passar rodada e fim da cena;
   - selo "cond." nos campos que as condições mudam (perícias, Defesa,
     deslocamento);
   - diálogo "Descansar".
   Os números vêm do OP.calc (estadoCondicoes, passarRodada, fimDaCena,
   recuperacaoDescanso, aplicarRecuperacao). Os efeitos do catálogo são
   SUGESTÕES a conferir no livro. Dados da ficha entram só por textContent,
   .value ou setAttribute.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const cartoes = Object.create(null); // uid -> elementos do cartão
  const LIMITE_EFEITO_GERAL = 12;  // a partir de quantas perícias o efeito é "geral"
  const selos = new WeakMap();         // elemento hospedeiro -> selo "cond."

  const SAUDE = {
    ileso: { texto: 'Ileso', nivel: 0 },
    ferido: { texto: 'Ferido', nivel: 1 },
    machucado: { texto: 'Machucado', nivel: 2 },
    morrendo: { texto: 'Morrendo', nivel: 3 }
  };
  const SANIDADE = {
    sao: { texto: 'Sã', nivel: 0 },
    perturbado: { texto: 'Perturbado', nivel: 2 },
    enlouquecendo: { texto: 'Enlouquecendo', nivel: 3 }
  };

  function definirTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  function criar(tag, classe, texto) {
    return OP.ui.criarElemento(tag, classe, texto);
  }

  /** Os selects têm botão próprio (js/ui-seletor.js): valores trocados por código precisam ser relidos. */
  function sincronizarSeletores() {
    if (OP.uiSeletor && OP.uiSeletor.atualizar) OP.uiSeletor.atualizar();
  }

  function anunciar(texto) {
    if (OP.uiApp && OP.uiApp.anunciar) OP.uiApp.anunciar(texto);
  }

  function ficha() {
    return OP.state.ficha;
  }

  function sinal(n) {
    return (n < 0 ? '−' : '+') + Math.abs(n);
  }

  /** Mensagem visível junto aos botões (o leitor de tela ouve pelo #anunciador). */
  function mensagem(texto) {
    definirTexto(refs.mensagem, texto);
    anunciar(texto);
  }

  function nomeDaCondicao(item) {
    if (item.id === 'personalizada') return String((item.personalizada && item.personalizada.nome) || '').trim() || 'Condição personalizada';
    const definicao = (OP.data.condicoes || []).find(function (c) { return c.id === item.id; });
    return definicao ? definicao.nome : String(item.id);
  }

  function lista(nomes) {
    if (nomes.length < 2) return nomes.join('');
    return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  }

  /* ------------------------------------------------------------------------
     Estados: saúde, sanidade, morrendo e enlouquecendo
     ------------------------------------------------------------------------ */

  function desenharEstado(item, texto, nivel) {
    const li = item.li;
    if (li.getAttribute('data-nivel') !== String(nivel)) {
      li.setAttribute('data-nivel', String(nivel));
      item.uso.setAttribute('href', '#ic-estado-' + nivel);
    }
    definirTexto(item.texto, texto);
  }

  function desenharEstados(estado) {
    desenharEstado(refs.saude, SAUDE[estado.saude].texto, SAUDE[estado.saude].nivel);
    desenharEstado(refs.sanidade, SANIDADE[estado.sanidade].texto, SANIDADE[estado.sanidade].nivel);

    const morrendo = estado.morrendo;
    refs.blocoMorrendo.hidden = !morrendo.morrendo;
    definirTexto(refs.turnoValor, String(morrendo.turnos));
    definirTexto(refs.turnoLimite, String(morrendo.limite));
    refs.morto.hidden = !morrendo.morto;
    refs.turnoMenos.disabled = morrendo.turnos <= 0;

    refs.blocoLouco.hidden = estado.sanidade !== 'enlouquecendo';
  }

  function mudarTurnos(novo) {
    const turnos = Math.max(0, Math.min(20, Math.trunc(novo)));
    OP.state.atualizar('condicoes.turnosMorrendo', turnos);
    const limite = OP.calc.statusMorrendo(ficha()).limite;
    anunciar(turnos === 0 ? 'Turnos morrendo zerados.' : 'Turno morrendo ' + turnos + ' de ' + limite + '.');
  }

  /* ------------------------------------------------------------------------
     Cartões das condições ativas
     ------------------------------------------------------------------------ */

  function indiceDaUid(uid) {
    return ficha().condicoes.ativas.findIndex(function (c) { return c.uid === uid; });
  }

  function criarCartao(item) {
    const uid = item.uid;
    const raiz = criar('li', 'cond-cartao');
    raiz.setAttribute('data-cond-uid', uid);

    const topo = criar('div', 'cond-cartao__topo');
    const titulo = criar('div', 'cond-cartao__titulo');
    const nome = criar('strong', 'cond-cartao__nome');
    const categoria = criar('span', 'cond-cartao__categoria');
    const conferir = criar('span', 'selo selo--conferir', 'conferir');
    conferir.setAttribute('title', 'Efeito sugerido: confira no livro de regras');
    titulo.appendChild(nome);
    titulo.appendChild(categoria);
    titulo.appendChild(conferir);
    const remover = criar('button', 'botao-icone botao-icone--perigo');
    remover.type = 'button';
    remover.setAttribute('data-cond-remover', uid);
    remover.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';
    topo.appendChild(titulo);
    topo.appendChild(remover);
    raiz.appendChild(topo);

    const resumo = criar('p', 'cond-cartao__resumo');
    const implica = criar('p', 'cond-cartao__implica');
    const lembretes = criar('p', 'cond-cartao__lembretes');
    const livro = criar('details', 'cond-cartao__livro');
    const livroTitulo = criar('summary', '', 'Texto do livro');
    const livroTexto = criar('p', 'cond-cartao__livro-texto');
    livro.appendChild(livroTitulo);
    livro.appendChild(livroTexto);
    raiz.appendChild(resumo);
    raiz.appendChild(implica);
    raiz.appendChild(lembretes);
    raiz.appendChild(livro);

    const campos = criar('div', 'cond-cartao__campos');
    const idRodadas = 'cond-rodadas-' + uid;
    const campoRodadas = criar('div', 'campo-texto');
    const rotuloRodadas = criar('label', '', 'Rodadas');
    rotuloRodadas.setAttribute('for', idRodadas);
    const rodadas = criar('input', 'controle controle--numero');
    rodadas.type = 'text';
    rodadas.id = idRodadas;
    rodadas.setAttribute('inputmode', 'numeric');
    rodadas.setAttribute('autocomplete', 'off');
    rodadas.setAttribute('spellcheck', 'false');
    rodadas.setAttribute('enterkeyhint', 'done');
    rodadas.setAttribute('placeholder', '—');
    rodadas.setAttribute('data-cond-rodadas', uid);
    campoRodadas.appendChild(rotuloRodadas);
    campoRodadas.appendChild(rodadas);

    const rotuloFim = criar('label', 'caixa');
    const fim = criar('input');
    fim.type = 'checkbox';
    fim.setAttribute('data-cond-fim', uid);
    rotuloFim.appendChild(fim);
    rotuloFim.appendChild(criar('span', '', 'Até o fim da cena'));

    const idNota = 'cond-nota-' + uid;
    const campoNota = criar('div', 'campo-texto campo-texto--largo');
    const rotuloNota = criar('label', '', 'Nota');
    rotuloNota.setAttribute('for', idNota);
    const nota = criar('input', 'controle');
    nota.type = 'text';
    nota.id = idNota;
    nota.setAttribute('maxlength', '500');
    nota.setAttribute('autocomplete', 'off');
    nota.setAttribute('placeholder', 'O que vale na mesa (digite você mesmo)');
    nota.setAttribute('data-cond-nota', uid);
    campoNota.appendChild(rotuloNota);
    campoNota.appendChild(nota);

    campos.appendChild(campoRodadas);
    campos.appendChild(rotuloFim);
    campos.appendChild(campoNota);
    raiz.appendChild(campos);

    cartoes[uid] = { raiz: raiz, nome: nome, categoria: categoria, conferir: conferir, remover: remover,
      resumo: resumo, implica: implica, lembretes: lembretes, livro: livro, livroTexto: livroTexto, rodadas: rodadas, fim: fim, nota: nota };
    return cartoes[uid];
  }

  function escreverSePreciso(campo, texto) {
    if (campo.value === texto) return;
    if (campo === document.activeElement) {
      // quem digita já tem o texto certo (ex.: "05" → 5); não mexe no cursor
      const igual = campo.hasAttribute('data-cond-rodadas')
        ? lerRodadas(campo.value) === lerRodadas(texto)
        : false;
      if (igual) return;
    }
    campo.value = texto;
  }

  /** Rodadas digitadas: vazio → null; número → 1 a 99; texto inválido → undefined (ignora). */
  function lerRodadas(texto) {
    if (String(texto).trim() === '') return null;
    return OP.calc.lerNumero(texto, { inteiro: true, min: 1, max: 99 });
  }

  function desenharCartao(elementos, item, resumoItem) {
    const nome = resumoItem.nome;
    definirTexto(elementos.nome, nome);
    definirTexto(elementos.categoria, resumoItem.categoriaNome);
    elementos.categoria.hidden = !resumoItem.categoriaNome;
    elementos.conferir.hidden = !resumoItem.conferir;
    const rotuloRemover = 'Remover condição ' + nome;
    if (elementos.remover.getAttribute('aria-label') !== rotuloRemover) {
      elementos.remover.setAttribute('aria-label', rotuloRemover);
      elementos.remover.setAttribute('title', rotuloRemover);
    }
    definirTexto(elementos.resumo, resumoItem.resumo || 'Sem efeito numérico automático: veja o texto do livro e anote na mesa o que vale.');
    const implica = resumoItem.implica && resumoItem.implica.length ? 'Inclui: ' + lista(resumoItem.implica) + '.' : '';
    definirTexto(elementos.implica, implica);
    elementos.implica.hidden = !implica;
    const lembretes = (resumoItem.lembretes || []).join(' ');
    definirTexto(elementos.lembretes, lembretes ? 'A ficha não calcula: ' + lembretes : '');
    elementos.lembretes.hidden = !lembretes;
    definirTexto(elementos.livroTexto, resumoItem.descricao || '');
    elementos.livro.hidden = !resumoItem.descricao;
    escreverSePreciso(elementos.rodadas, item.rodadas === null || item.rodadas === undefined ? '' : String(item.rodadas));
    if (elementos.fim.checked !== (item.ateFimCena === true)) elementos.fim.checked = item.ateFimCena === true;
    escreverSePreciso(elementos.nota, String(item.nota || ''));
    const rotuloRodadas = 'Rodadas de ' + nome;
    if (elementos.rodadas.getAttribute('aria-label') !== rotuloRodadas) elementos.rodadas.setAttribute('aria-label', rotuloRodadas);
    const rotuloFim = 'Até o fim da cena: ' + nome;
    if (elementos.fim.getAttribute('aria-label') !== rotuloFim) elementos.fim.setAttribute('aria-label', rotuloFim);
    const rotuloNota = 'Nota de ' + nome;
    if (elementos.nota.getAttribute('aria-label') !== rotuloNota) elementos.nota.setAttribute('aria-label', rotuloNota);
  }

  function desenharLista(estado) {
    const ativas = ficha().condicoes.ativas;
    const vistos = Object.create(null);
    const ordem = [];
    ativas.forEach(function (item, indice) {
      vistos[item.uid] = true;
      const elementos = cartoes[item.uid] || criarCartao(item);
      desenharCartao(elementos, item, estado.ativas[indice] || { nome: nomeDaCondicao(item), categoriaNome: '', resumo: '', conferir: false });
      ordem.push(elementos.raiz);
    });
    Object.keys(cartoes).forEach(function (uid) {
      if (!vistos[uid]) delete cartoes[uid];
    });
    // Só mexe no DOM se a lista (ou a ordem) mudou
    const atuais = Array.prototype.slice.call(refs.lista.children);
    const igual = atuais.length === ordem.length && atuais.every(function (el, i) { return el === ordem[i]; });
    if (!igual) OP.ui.substituirFilhos(refs.lista, ordem);
    refs.vazio.hidden = ativas.length > 0;
    refs.lista.hidden = ativas.length === 0;
    refs.soLembrete.hidden = estado.aplicarEfeitos || ativas.length === 0;
  }

  /* ------------------------------------------------------------------------
     Selo "cond." nos campos afetados
     ------------------------------------------------------------------------ */

  function selo(hospedeiro) {
    let elemento = selos.get(hospedeiro);
    if (!elemento) {
      elemento = criar('span', 'selo-cond', 'cond.');
      elemento.setAttribute('role', 'img');
      elemento.hidden = true;
      hospedeiro.insertAdjacentElement('afterend', elemento);
      selos.set(hospedeiro, elemento);
    }
    return elemento;
  }

  function marcar(hospedeiro, ativo, explicacao) {
    if (!hospedeiro) return;
    const elemento = selo(hospedeiro);
    elemento.hidden = !ativo;
    if (!ativo) return;
    if (elemento.getAttribute('title') !== explicacao) {
      elemento.setAttribute('title', explicacao);
      elemento.setAttribute('aria-label', explicacao);
    }
  }

  function textoOrigens(mod) {
    return mod.origens.map(function (o) { return o.condicao + ': ' + o.texto; }).join('; ');
  }

  function desenharSelos(derivados) {
    const mod = derivados.condicoes.mod;
    const origens = textoOrigens(mod);
    const sufixo = ' (' + origens + ').';
    // Efeito que vale para quase todas as perícias (ex.: Abalado): um selo só, no título; nas linhas só as que fogem dele
    const contagem = Object.create(null);
    OP.data.pericias.forEach(function (definicao) {
      const valor = derivados.pericias[definicao.id].dadosCondicoes;
      if (valor !== 0) contagem[valor] = (contagem[valor] || 0) + 1;
    });
    let geral = 0;
    Object.keys(contagem).forEach(function (valor) {
      if (contagem[valor] >= LIMITE_EFEITO_GERAL && contagem[valor] > (contagem[geral] || 0)) geral = Number(valor);
    });
    OP.data.pericias.forEach(function (definicao) {
      const estado = derivados.pericias[definicao.id];
      const celula = document.querySelector('[data-pericia="' + definicao.id + '"] .pericia__dados output');
      marcar(celula, estado.dadosCondicoes !== 0 && estado.dadosCondicoes !== geral,
        'Afetado por condições: ' + sinal(estado.dadosCondicoes) + 'd20 em ' + definicao.nome + sufixo);
    });
    // Defesa e testes (Iniciativa, Fortitude, Reflexos, Vontade): a mesma perícia, o mesmo selo
    document.querySelectorAll('[data-teste]').forEach(function (cartao) {
      const id = cartao.getAttribute('data-teste');
      const estadoTeste = derivados.pericias[id];
      const saida = cartao.querySelector('.teste__dados');
      if (!estadoTeste || !saida) return;
      const definicao = OP.data.pericias.find(function (p) { return p.id === id; });
      marcar(saida, estadoTeste.dadosCondicoes !== 0,
        'Afetado por condições: ' + sinal(estadoTeste.dadosCondicoes) + 'd20 em ' + (definicao ? definicao.nome : id) + sufixo);
    });
    marcar(document.getElementById('titulo-pericias'), geral !== 0,
      'Condições mudam os dados das perícias: ' + sinal(geral) + 'd20 na maioria (' + origens + ').');
    const defesa = derivados.defesa.condicoes;
    const defesaPorTipo = derivados.defesa.totalCorpoACorpo !== derivados.defesa.total || derivados.defesa.totalDistancia !== derivados.defesa.total;
    document.querySelectorAll('[data-saida="defesa.total"]').forEach(function (saida) {
      marcar(saida, defesa !== 0 || defesaPorTipo,
        'Afetada por condições: ' + (defesa !== 0 ? 'Defesa ' + sinal(defesa) : 'Defesa muda conforme o tipo de ataque') + sufixo);
    });
    const desloc = derivados.deslocamento;
    document.querySelectorAll('[data-saida="deslocamento"], [data-saida="deslocamento.metros"]').forEach(function (saida) {
      const reduzido = desloc.multiplicador !== 1 || desloc.maximo !== null;
      marcar(saida, reduzido,
        'Afetado por condições: ' + (desloc.maximo !== null && desloc.multiplicador === 1
          ? 'deslocamento máximo ' + OP.ui.formatarNumero(desloc.maximo) + ' m'
          : 'deslocamento × ' + OP.ui.formatarNumero(desloc.multiplicador)) + sufixo);
    });
  }

  /* ------------------------------------------------------------------------
     Ações: adicionar, remover, rodada, fim da cena
     ------------------------------------------------------------------------ */

  function montarEscolha() {
    const select = refs.escolha;
    const opcoes = [];
    const vazia = document.createElement('option');
    vazia.value = '';
    vazia.textContent = 'Escolha uma condição…';
    opcoes.push(vazia);
    Object.keys(OP.data.categoriasCondicao).forEach(function (idCategoria) {
      const itens = OP.data.condicoes.filter(function (c) { return c.categoria === idCategoria; });
      if (!itens.length) return;
      const grupo = document.createElement('optgroup');
      grupo.label = OP.data.categoriasCondicao[idCategoria];
      itens.forEach(function (c) {
        const opcao = document.createElement('option');
        opcao.value = c.id;
        opcao.textContent = c.nome;
        grupo.appendChild(opcao);
      });
      opcoes.push(grupo);
    });
    const personalizada = document.createElement('option');
    personalizada.value = 'personalizada';
    personalizada.textContent = 'Personalizada…';
    opcoes.push(personalizada);
    OP.ui.substituirFilhos(select, opcoes);
  }

  function cheio() {
    if (ficha().condicoes.ativas.length < OP.state.LIMITES.condicoes) return false;
    mensagem('Aviso: limite de ' + OP.state.LIMITES.condicoes + ' condições ativas atingido.');
    return true;
  }

  function adicionar(dados) {
    if (cheio()) return null;
    const nova = OP.state.novaCondicao(dados);
    OP.state.atualizar('condicoes.ativas', ficha().condicoes.ativas.concat([nova]));
    mensagem('Condição adicionada: ' + nomeDaCondicao(nova) + '.');
    return nova;
  }

  function aoAdicionar() {
    const id = refs.escolha.value;
    if (id === '') {
      mensagem('Aviso: escolha uma condição na lista.');
      refs.escolha.focus();
      return;
    }
    if (id === 'personalizada') {
      abrirPersonalizada();
      return;
    }
    const jaTem = ficha().condicoes.ativas.find(function (c) { return c.id === id; });
    if (jaTem) {
      mensagem('Aviso: ' + nomeDaCondicao(jaTem) + ' já está ativa.');
      const cartao = cartoes[jaTem.uid];
      if (cartao) cartao.rodadas.focus();
      return;
    }
    if (adicionar({ id: id })) {
      refs.escolha.value = '';
      sincronizarSeletores();
    }
  }

  function abrirPersonalizada() {
    refs.formPers.hidden = false;
    refs.persNome.value = '';
    refs.persDados.value = '';
    refs.persDefesa.value = '';
    refs.persDesloc.value = '1';
    sincronizarSeletores();
    refs.persNome.focus();
  }

  function fecharPersonalizada(voltarFoco) {
    refs.formPers.hidden = true;
    if (voltarFoco) refs.escolha.focus();
  }

  function aoEnviarPersonalizada(evento) {
    evento.preventDefault();
    const dados = OP.calc.lerNumero(refs.persDados.value, { inteiro: true, min: -10, max: 10, padrao: 0 });
    const defesa = OP.calc.lerNumero(refs.persDefesa.value, { inteiro: true, min: -50, max: 50, padrao: 0 });
    const nova = adicionar({
      id: 'personalizada',
      personalizada: {
        nome: refs.persNome.value.trim().slice(0, 80),
        dadosPericias: -Math.abs(dados), // o campo diz "dados a menos"
        defesa: defesa,
        deslocamentoMult: Number(refs.persDesloc.value)
      }
    });
    if (nova) {
      refs.escolha.value = '';
      sincronizarSeletores();
      fecharPersonalizada(true);
    }
  }

  function aoPassarRodada() {
    const resultado = OP.calc.passarRodada(ficha());
    OP.state.atualizar('condicoes.ativas', resultado.ativas);
    if (resultado.removidas.length) {
      mensagem('Rodada passada. Expirou: ' + lista(resultado.removidas.map(nomeDaCondicao)) + '.');
    } else {
      mensagem('Rodada passada. Nenhuma condição expirou.');
    }
  }

  function aoFimDaCena() {
    const resultado = OP.calc.fimDaCena(ficha());
    OP.state.atualizar('condicoes.ativas', resultado.ativas, { silencioso: true });
    OP.state.atualizar('condicoes.turnosMorrendo', resultado.turnosMorrendo);
    const partes = [];
    if (resultado.removidas.length) partes.push('saíram ' + lista(resultado.removidas.map(nomeDaCondicao)));
    else partes.push('nenhuma condição saiu');
    partes.push('turnos morrendo zerados');
    mensagem('Fim da cena: ' + partes.join('; ') + '.');
  }

  function aoClicarLista(evento) {
    const botao = evento.target.closest('[data-cond-remover]');
    if (!botao) return;
    const uid = botao.getAttribute('data-cond-remover');
    const item = ficha().condicoes.ativas.find(function (c) { return c.uid === uid; });
    if (!item) return;
    OP.ui.removerDeLista('condicoes.ativas', uid, nomeDaCondicao(item));
    refs.escolha.focus();
  }

  function aoEditarLista(evento) {
    const alvo = evento.target;
    const uidRodadas = alvo.getAttribute && alvo.getAttribute('data-cond-rodadas');
    const uidNota = alvo.getAttribute && alvo.getAttribute('data-cond-nota');
    const uidFim = alvo.getAttribute && alvo.getAttribute('data-cond-fim');
    const uid = uidRodadas || uidNota || uidFim;
    if (!uid) return;
    const indice = indiceDaUid(uid);
    if (indice === -1) return;
    const base = 'condicoes.ativas.' + indice + '.';
    if (uidRodadas) {
      const valor = lerRodadas(alvo.value);
      if (valor === undefined) return; // texto incompleto: espera
      if (valor !== ficha().condicoes.ativas[indice].rodadas) OP.state.atualizar(base + 'rodadas', valor);
    } else if (uidNota) {
      if (alvo.value !== ficha().condicoes.ativas[indice].nota) OP.state.atualizar(base + 'nota', alvo.value);
    } else if (evento.type === 'change') {
      OP.state.atualizar(base + 'ateFimCena', alvo.checked);
    }
  }

  function aoConfirmarRodadas(evento) {
    const alvo = evento.target;
    if (!alvo.getAttribute || !alvo.hasAttribute('data-cond-rodadas')) return;
    // normaliza o texto: vazio ou inválido volta ao valor salvo
    const indice = indiceDaUid(alvo.getAttribute('data-cond-rodadas'));
    if (indice === -1) return;
    const salvo = ficha().condicoes.ativas[indice].rodadas;
    alvo.value = salvo === null ? '' : String(salvo);
  }

  /* ------------------------------------------------------------------------
     Descanso
     ------------------------------------------------------------------------ */

  function tipoDescanso() {
    const marcado = refs.dialogoDescanso.querySelector('input[name="descanso-tipo"]:checked');
    return marcado ? marcado.value : 'dormir';
  }

  function nomeCondicaoDescanso(id) {
    const item = OP.data.config.descanso.condicoes.find(function (c) { return c.id === id; });
    return item ? item.nome : id;
  }

  /** Texto da conta, em palavras próprias, a partir da config. */
  function textoConta(tipo, condicao) {
    const cfg = OP.data.config.descanso;
    const limite = OP.calc.limitePEporTurno(ficha());
    const nome = nomeCondicaoDescanso(condicao);
    if (tipo === 'meditacao') {
      const fator = cfg.meditacaoPorLimitePE[condicao];
      return 'Meditação em descanso ' + nome + ': limite de PE por turno (' + limite + ') × ' + fator + ' = ' + (limite * fator) + ' PE. Só PE.';
    }
    const dormir = cfg.dormir;
    return 'Dormir em descanso ' + nome + ' (sugestão provisória, confira no livro): PV = limite de PE por turno (' + limite + ') × ' +
      dormir.pvPorLimitePE[condicao] + ', PE = ' + limite + ' × ' + dormir.pePorLimitePE[condicao] + ', SAN +' + dormir.san[condicao] + '.';
  }

  function preencherSugestao() {
    const condicao = OP.calc.condicaoDescansoValida(refs.descansoCondicao.value);
    const tipo = tipoDescanso();
    const r = OP.calc.recuperacaoDescanso(ficha(), tipo, condicao);
    refs.descansoPv.value = String(r.pv);
    refs.descansoPe.value = String(r.pe);
    refs.descansoSan.value = String(r.san);
    definirTexto(refs.descansoConta, textoConta(tipo, condicao));
    refs.dicaMeditacao.hidden = tipo !== 'meditacao';
  }

  function abrirDescanso() {
    const dialogo = refs.dialogoDescanso;
    if (!dialogo || typeof dialogo.showModal !== 'function' || dialogo.open) return;
    const salvo = OP.calc.condicaoDescansoValida(ficha().descanso && ficha().descanso.condicao);
    refs.descansoCondicao.value = salvo;
    sincronizarSeletores();
    refs.descansoCena.checked = false;
    const semClasse = !OP.calc.classeDaFicha(ficha());
    refs.semClasse.hidden = !semClasse;
    refs.descansoAplicar.disabled = semClasse;
    preencherSugestao();
    // abrirDialogo devolve o foco ao botão "Descansar" quando o diálogo fecha
    if (OP.ui.abrirDialogo) OP.ui.abrirDialogo(dialogo, pegar('botao-descansar'));
    else dialogo.showModal();
    refs.descansoCondicao.focus();
  }

  function lerQuantia(campo) {
    return OP.calc.lerNumero(campo.value, { inteiro: true, min: 0, max: 9999, padrao: 0 });
  }

  function aoAplicarDescanso(evento) {
    evento.preventDefault();
    const f = ficha();
    const condicao = OP.calc.condicaoDescansoValida(refs.descansoCondicao.value);
    const pedido = { pv: lerQuantia(refs.descansoPv), pe: lerQuantia(refs.descansoPe), san: lerQuantia(refs.descansoSan) };
    const antes = {};
    ['pv', 'pe', 'san'].forEach(function (id) { antes[id] = OP.calc.estadoRecurso(f, id).atual; });
    const novo = OP.calc.aplicarRecuperacao(f, pedido);

    const mudancas = [];
    ['pv', 'pe', 'san'].forEach(function (id) {
      if (novo[id] !== null && novo[id] !== undefined && novo[id] !== antes[id]) mudancas.push(['recursos.' + id + '.atual', novo[id]]);
    });
    if (f.descanso.condicao !== condicao) mudancas.push(['descanso.condicao', condicao]);
    let removidas = [];
    if (refs.descansoCena.checked) {
      const fim = OP.calc.fimDaCena(f);
      removidas = fim.removidas;
      mudancas.push(['condicoes.ativas', fim.ativas]);
      mudancas.push(['condicoes.turnosMorrendo', 0]);
    }
    mudancas.forEach(function (m, i) {
      OP.state.atualizar(m[0], m[1], { silencioso: i < mudancas.length - 1 });
    });

    const ganho = function (id) { return novo[id] === null || novo[id] === undefined ? 0 : Math.max(0, novo[id] - antes[id]); };
    let texto = 'Recuperou ' + ganho('pv') + ' PV, ' + ganho('pe') + ' PE, ' + ganho('san') + ' SAN';
    if (refs.descansoCena.checked) {
      texto += '. Cena encerrada' + (removidas.length ? ': saíram ' + lista(removidas.map(nomeDaCondicao)) : '');
    }
    refs.dialogoDescanso.close('aplicar');
    mensagem(texto + '.');
  }

  /* ------------------------------------------------------------------------
     Montagem
     ------------------------------------------------------------------------ */

  function pegar(id) {
    return document.getElementById(id);
  }

  function montar() {
    refs.secao = pegar('secao-condicoes');
    if (!refs.secao) return;
    refs.saude = { li: pegar('cond-estado-saude'), texto: pegar('cond-saude-texto'), uso: pegar('cond-estado-saude').querySelector('use') };
    refs.sanidade = { li: pegar('cond-estado-sanidade'), texto: pegar('cond-sanidade-texto'), uso: pegar('cond-estado-sanidade').querySelector('use') };
    refs.blocoMorrendo = pegar('cond-morrendo');
    refs.turnoValor = pegar('cond-turno-valor');
    refs.turnoLimite = pegar('cond-turno-limite');
    refs.morto = pegar('cond-morto');
    refs.turnoMenos = pegar('cond-turno-menos');
    refs.blocoLouco = pegar('cond-enlouquecendo');
    refs.lista = pegar('cond-lista');
    refs.vazio = pegar('cond-vazio');
    refs.soLembrete = pegar('cond-so-lembrete');
    refs.escolha = pegar('cond-escolha');
    refs.formPers = pegar('cond-personalizada');
    refs.persNome = pegar('cond-pers-nome');
    refs.persDados = pegar('cond-pers-dados');
    refs.persDefesa = pegar('cond-pers-defesa');
    refs.persDesloc = pegar('cond-pers-desloc');
    refs.mensagem = pegar('cond-mensagem');

    refs.dialogoDescanso = pegar('dialogo-descanso');
    refs.descansoCondicao = pegar('descanso-condicao');
    refs.descansoPv = pegar('descanso-pv');
    refs.descansoPe = pegar('descanso-pe');
    refs.descansoSan = pegar('descanso-san');
    refs.descansoConta = pegar('descanso-conta');
    refs.descansoCena = pegar('descanso-cena');
    refs.descansoAplicar = pegar('descanso-aplicar');
    refs.dicaMeditacao = pegar('descanso-dica-meditacao');
    refs.semClasse = pegar('descanso-sem-classe');

    montarEscolha();
    OP.ui.substituirFilhos(refs.descansoCondicao, OP.data.config.descanso.condicoes.map(function (c) {
      const opcao = document.createElement('option');
      opcao.value = c.id;
      opcao.textContent = c.nome;
      return opcao;
    }));

    pegar('cond-adicionar').addEventListener('click', aoAdicionar);
    pegar('cond-passar-rodada').addEventListener('click', aoPassarRodada);
    pegar('cond-fim-cena').addEventListener('click', aoFimDaCena);
    pegar('cond-turno-mais').addEventListener('click', function () { mudarTurnos(OP.calc.proximoTurnoMorrendo(ficha())); });
    pegar('cond-turno-menos').addEventListener('click', function () { mudarTurnos(ficha().condicoes.turnosMorrendo - 1); });
    pegar('cond-turno-zerar').addEventListener('click', function () { mudarTurnos(0); });
    refs.formPers.addEventListener('submit', aoEnviarPersonalizada);
    pegar('cond-pers-cancelar').addEventListener('click', function () { fecharPersonalizada(true); });
    refs.formPers.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        fecharPersonalizada(true);
      }
    });
    refs.lista.addEventListener('click', aoClicarLista);
    refs.lista.addEventListener('input', aoEditarLista);
    refs.lista.addEventListener('change', aoEditarLista);
    refs.lista.addEventListener('focusout', aoConfirmarRodadas);

    pegar('botao-descansar').addEventListener('click', abrirDescanso);
    refs.descansoCondicao.addEventListener('change', preencherSugestao);
    refs.dialogoDescanso.querySelectorAll('input[name="descanso-tipo"]').forEach(function (radio) {
      radio.addEventListener('change', preencherSugestao);
    });
    refs.dialogoDescanso.querySelectorAll('[data-fechar-descanso]').forEach(function (botao) {
      botao.addEventListener('click', function () { refs.dialogoDescanso.close('cancelar'); });
    });
    pegar('form-descanso').addEventListener('submit', aoAplicarDescanso);

    OP.ui.registrarExtensao({ desenhar: desenhar });
  }

  function desenhar(f, derivados) {
    if (!refs.secao || !derivados.condicoes) return;
    desenharEstados(derivados.condicoes);
    desenharLista(derivados.condicoes);
    desenharSelos(derivados);
  }

  OP.uiCondicoes = {
    montar: montar,
    abrirDescanso: abrirDescanso
  };
})(window.OP);
