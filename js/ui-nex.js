/* ==========================================================================
   js/ui-nex.js — Alterações de NEX (OP.uiNex)
   --------------------------------------------------------------------------
   Regra opcional "NEX e Experiência" (ficha.config.nexENivel). O painel só
   aparece com a regra ligada (js/ui-regras.js) e mostra:
   - o NEX de exposição (campo manual) e o elemento da ficha;
   - as escolhas das alterações (perícia com −5, atributo somado ao PE);
   - os cartões de cada alteração (NEX 25%, 35%, 50% e as do elemento em
     60%, 75% e 90%) com o texto do livro por inteiro e o que a ficha aplica;
   - a Energia: sorteio do 1d6 de cada cena e seus efeitos;
   - os extras: Forma Monstruosa, escuridão e a perda de PE do NEX 90% de Morte.
   Os números vêm de OP.calc (efeitosAlteracoes) e os textos de
   data/alteracoes-nex.js. Entra no ciclo de desenho pelo
   OP.ui.registrarExtensao. Texto do usuário só por textContent.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const abertos = {};          // id do cartão -> aberto pelo usuário (ou fechado, se false)
  const selos = new WeakMap(); // elemento hospedeiro -> selo "alt."
  let assinatura = '';

  function criar(tag, classe, texto) {
    return OP.ui.criarElemento(tag, classe, texto);
  }

  function ficha() {
    return OP.state.ficha;
  }

  function sinal(n) {
    return (n < 0 ? '−' : '+') + Math.abs(n);
  }

  function nomePericia(id) {
    const p = OP.data.pericias.find(function (x) { return x.id === id; });
    return p ? p.nome : id;
  }

  function nomeAtributo(id) {
    const a = OP.data.atributos.find(function (x) { return x.id === id; });
    return a ? a.nome : id;
  }

  function lista(itens) {
    return itens.length > 1 ? itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1] : itens[0] || '';
  }

  /** Agrupa { idPericia: n } por valor: "−1d20 em Ciências, Medicina e Tecnologia". */
  function textosDados(mapa) {
    const porValor = {};
    Object.keys(mapa || {}).forEach(function (id) {
      (porValor[mapa[id]] = porValor[mapa[id]] || []).push(nomePericia(id));
    });
    return Object.keys(porValor).sort(function (a, b) { return Number(a) - Number(b); }).map(function (valor) {
      return sinal(Number(valor)) + 'd20 em ' + lista(porValor[valor]);
    });
  }

  /** O que a ficha faz sozinha com uma alteração (frases curtas), dado o que já foi escolhido. */
  function textosEfeitos(alteracao, salvas, efeitos) {
    const e = alteracao.efeitos || {};
    const frases = [];
    if (e.ocultismoSemTreino) frases.push('Pode usar Ocultismo sem treino.');
    Object.keys(e.bonusPericiaTreinada || {}).forEach(function (id) {
      frases.push(sinal(e.bonusPericiaTreinada[id]) + ' em ' + nomePericia(id) + ' (se for treinado).');
    });
    if (e.escolhaPenalidade) {
      const esc = e.escolhaPenalidade;
      const escolhida = esc.opcoes.indexOf(salvas[esc.campo]) !== -1 ? salvas[esc.campo] : '';
      frases.push(escolhida ? sinal(esc.valor) + ' em ' + nomePericia(escolhida) + '.' : 'Falta escolher a perícia com ' + sinal(esc.valor) + '.');
    }
    if (e.escolhaAtributoPE) {
      const esc = e.escolhaAtributoPE;
      const escolhido = esc.opcoes.indexOf(salvas[esc.campo]) !== -1 ? salvas[esc.campo] : '';
      frases.push(escolhido && efeitos.bonusPE
        ? '+' + efeitos.bonusPE.valor + ' no total de PE (' + nomeAtributo(escolhido) + ').'
        : 'Falta escolher o atributo somado ao PE.');
    }
    textosDados(e.dadosPorPericia).forEach(function (t) { frases.push(t + '.'); });
    textosDados(e.penalidadeDadosPorPericia).forEach(function (t) { frases.push(t + '.'); });
    if (e.condicaoPermanente) {
      frases.push(e.condicaoPermanente.escuridao
        ? 'Condição mantida: cego fora da escuridão (ofuscado, −2d20, na escuridão).'
        : 'Condição mantida: ' + (e.condicaoPermanente.nomeExibido || 'Ofuscado') + '.');
    }
    (e.reducaoRitual || []).forEach(function (r) {
      frases.push('Ritual ' + r.nome + ': −1 PE no custo, se já o conhece' + (r.nota ? ' (' + r.nota + ')' : '') + '.');
    });
    (e.lembretes || []).forEach(function (t) { frases.push('Por sua conta: ' + t.charAt(0).toLowerCase() + t.slice(1)); });
    return frases;
  }

  /* ------------------------------------------------------------------------
     Cartões das alterações
     ------------------------------------------------------------------------ */

  function criarCartao(alteracao, grupo, ativa, salvas, efeitos) {
    const aberto = abertos[alteracao.id] === undefined ? ativa : abertos[alteracao.id];
    const cartao = criar('details', 'alteracao alteracao--' + (ativa ? 'ativa' : 'aguardando'));
    cartao.open = aberto;
    cartao.setAttribute('data-alteracao', alteracao.id);
    const resumo = criar('summary', 'alteracao__resumo');
    resumo.appendChild(criar('span', 'alteracao__nex', alteracao.titulo));
    resumo.appendChild(criar('span', 'alteracao__grupo', grupo));
    resumo.appendChild(criar('span', 'alteracao__estado', ativa ? 'ativa' : 'a partir do ' + alteracao.titulo));
    cartao.appendChild(resumo);
    cartao.appendChild(criar('p', 'alteracao__narrativa', alteracao.narrativa));
    cartao.appendChild(criar('p', 'alteracao__texto', alteracao.texto));
    const frases = textosEfeitos(alteracao, salvas, efeitos);
    if (frases.length) {
      const caixa = criar('div', 'alteracao__efeitos');
      caixa.appendChild(criar('p', 'alteracao__efeitos-titulo', ativa ? 'O que a ficha aplica' : 'O que a ficha aplicará'));
      const ul = criar('ul', 'alteracao__efeitos-lista');
      frases.forEach(function (f) { ul.appendChild(criar('li', '', f)); });
      caixa.appendChild(ul);
      cartao.appendChild(caixa);
    }
    if (alteracao.efeitos && alteracao.efeitos.energia) {
      cartao.appendChild(criar('p', 'alteracao__efeitos-titulo', 'Tabela de Energia (1d6)'));
      const tabela = criar('ol', 'alteracao__tabela');
      OP.data.alteracoesNex.tabelaEnergia.forEach(function (linha) {
        const li = criar('li', '', linha.texto);
        li.value = linha.d6;
        tabela.appendChild(li);
      });
      cartao.appendChild(tabela);
    }
    cartao.addEventListener('toggle', function () { abertos[alteracao.id] = cartao.open; });
    return cartao;
  }

  function desenharCartoes(f, efeitos) {
    const dados = OP.data.alteracoesNex;
    const salvas = f.alteracoesNex || {};
    const itens = dados.gerais.map(function (a) { return { a: a, grupo: 'Gerais' }; });
    if (efeitos.elemento) {
      dados.elementos[efeitos.elemento].alteracoes.forEach(function (a) { itens.push({ a: a, grupo: dados.elementos[efeitos.elemento].nome }); });
    }
    const chave = JSON.stringify([efeitos.elemento, efeitos.alcancadas, salvas.penalidade25, salvas.atributo35, salvas.penalidade35,
      efeitos.bonusPE && efeitos.bonusPE.valor, salvas.sangueSuspenso, salvas.escuridao]);
    if (chave === assinatura) return;
    assinatura = chave;
    OP.ui.substituirFilhos(refs.cartoes, itens.map(function (item) {
      return criarCartao(item.a, item.grupo, efeitos.alcancadas.indexOf(item.a.id) !== -1, salvas, efeitos);
    }));
  }

  /* ------------------------------------------------------------------------
     Energia, extras e ações
     ------------------------------------------------------------------------ */

  function sorteioEnergia() {
    const f = ficha();
    const e = OP.calc.efeitosAlteracoes(f);
    const n = e.intensidadeEnergia;
    if (!e.ativa || !n) return;
    const rolagem = OP.rolagens.rolarLivre('1d6');
    if (!rolagem.ok) return;
    rolagem.titulo = 'Energia: efeito da cena';
    OP.ui.mostrarResultado(rolagem);
    const d6 = rolagem.total;
    const valores = d6 === 5 ? OP.dados.rolarReserva(n, 'maior').resultados : [];
    OP.state.atualizar('alteracoesNex.energia', { d6: d6, valores: valores, intensidade: n }, { silencioso: d6 === 4 });
    if (d6 === 4) {
      const confuso = OP.state.novaCondicao({ id: 'confuso', rodadas: n, nota: 'Energia (efeito 4 da cena)' });
      OP.state.atualizar('condicoes.ativas', OP.state.obter('condicoes.ativas').concat([confuso]));
    }
  }

  function limparEnergia() {
    OP.state.atualizar('alteracoesNex.energia', { d6: 0, valores: [], intensidade: 0 });
  }

  /** Perde pontos de Sanidade (ou de PD, com "Jogando sem Sanidade"). Devolve o nome do recurso. */
  function perderMental(pontos) {
    const f = ficha();
    const id = OP.calc.semSanidade(f) ? 'pe' : 'san';
    const estado = OP.calc.estadoRecurso(f, id);
    if (!estado.classeDefinida) return null;
    OP.state.atualizar('recursos.' + id + '.atual', Math.max(0, OP.calc.numero(estado.atual) - pontos));
    return id === 'pe' ? 'PD' : 'Sanidade';
  }

  function esqueciTique() {
    const e = OP.calc.efeitosAlteracoes(ficha());
    const pontos = e.energia.intensidade || 1;
    const nome = perderMental(pontos);
    if (nome && OP.uiApp) OP.uiApp.aviso('aviso', 'Tique esquecido: −' + pontos + ' de ' + nome + '.');
  }

  function interacaoSocial() {
    const e = OP.calc.efeitosAlteracoes(ficha());
    const estado = OP.calc.estadoRecurso(ficha(), 'pe');
    if (!e.interacaoSocialPE || !estado.classeDefinida) return;
    OP.state.atualizar('recursos.pe.atual', Math.max(0, OP.calc.numero(estado.atual) - e.interacaoSocialPE));
    if (OP.uiApp) OP.uiApp.aviso('aviso', 'Primeira interação social da cena: −' + e.interacaoSocialPE + ' PE.');
  }

  function textoEfeitoEnergia(energia, semSanidade) {
    const n = energia.intensidade;
    const linha = OP.data.alteracoesNex.tabelaEnergia.find(function (l) { return l.d6 === energia.d6; });
    const partes = [];
    if (!linha) return partes;
    switch (energia.d6) {
      case 1: partes.push('Aplicado: −' + n + 'd20 em testes de Presença e nas perícias baseadas nele (exceto Vontade), até o fim da cena.'); break;
      case 2: partes.push('O mestre pode usar este efeito ' + n + (n === 1 ? ' vez' : ' vezes') + ' nesta cena (par ou ímpar).'); break;
      case 3: partes.push('Se você esquecer o tique, perde ' + n + (semSanidade ? ' PD.' : ' de Sanidade.')); break;
      case 4: partes.push('Confuso por ' + n + (n === 1 ? ' rodada' : ' rodadas') + ' (já está na lista de Condições).'); break;
      case 5: partes.push('Valores anotados (d20): ' + energia.valores.join(', ') + '. A ficha avisa quando um d20 de um teste repetir um deles.'); break;
      default: partes.push('Nenhum efeito colateral por enquanto.');
    }
    return partes;
  }

  function desenharEnergia(f, e) {
    const visivel = e.ativa && e.intensidadeEnergia > 0;
    refs.energia.hidden = !visivel;
    if (!visivel) return;
    const energia = e.energia;
    const semSanidade = OP.calc.semSanidade(f);
    refs.energiaLimpar.hidden = !energia.d6;
    refs.energiaTique.hidden = energia.d6 !== 3;
    const textoTique = 'Esqueci o tique (−' + (energia.intensidade || 1) + (semSanidade ? ' PD)' : ' SAN)');
    if (refs.energiaTique.textContent !== textoTique) refs.energiaTique.textContent = textoTique;
    const filhos = [];
    if (energia.d6) {
      const linha = OP.data.alteracoesNex.tabelaEnergia.find(function (l) { return l.d6 === energia.d6; });
      filhos.push(criar('p', 'nex-energia__numero', 'Efeito ' + energia.d6 + ' (intensidade ' + energia.intensidade + ')'));
      if (linha) filhos.push(criar('p', 'nex-energia__texto', linha.texto));
      textoEfeitoEnergia(energia, semSanidade).forEach(function (t) { filhos.push(criar('p', 'nex-energia__aplicado', t)); });
    } else {
      filhos.push(criar('p', 'nex-energia__vazio', 'Nenhum efeito sorteado nesta cena.'));
    }
    const chave = JSON.stringify([energia, semSanidade]);
    if (refs.energiaEfeito.getAttribute('data-chave') !== chave) {
      refs.energiaEfeito.setAttribute('data-chave', chave);
      OP.ui.substituirFilhos(refs.energiaEfeito, filhos);
    }
  }

  /* ------------------------------------------------------------------------
     Selo "alt." nos campos afetados (perícias e testes de Defesa)
     ------------------------------------------------------------------------ */

  function marcarSelo(hospedeiro, ativo, explicacao) {
    if (!hospedeiro) return;
    let selo = selos.get(hospedeiro);
    if (!selo) {
      if (!ativo) return;
      selo = criar('span', 'selo-cond selo-alt', 'alt.');
      selo.setAttribute('role', 'img');
      selo.hidden = true;
      hospedeiro.insertAdjacentElement('afterend', selo);
      selos.set(hospedeiro, selo);
    }
    selo.hidden = !ativo;
    if (!ativo) return;
    if (selo.getAttribute('title') !== explicacao) {
      selo.setAttribute('title', explicacao);
      selo.setAttribute('aria-label', explicacao);
    }
  }

  function explicacaoSelo(estado, nome) {
    const partes = [];
    if (estado.dadosAlteracoes) partes.push(sinal(estado.dadosAlteracoes) + 'd20');
    if (estado.bonusAlteracoes) partes.push(sinal(estado.bonusAlteracoes) + ' no bônus');
    return 'Afetado por alterações de NEX: ' + partes.join(' e ') + ' em ' + nome + '.';
  }

  function desenharSelos(derivados) {
    OP.data.pericias.forEach(function (definicao) {
      const estado = derivados.pericias[definicao.id];
      const afetado = Boolean(estado) && (estado.dadosAlteracoes !== 0 || estado.bonusAlteracoes !== 0);
      const celula = document.querySelector('[data-pericia="' + definicao.id + '"] .pericia__dados output');
      marcarSelo(celula, afetado, afetado ? explicacaoSelo(estado, definicao.nome) : '');
      const teste = document.querySelector('[data-teste="' + definicao.id + '"] .teste__dados');
      if (teste) marcarSelo(teste, afetado, afetado ? explicacaoSelo(estado, definicao.nome) : '');
    });
  }

  /* ------------------------------------------------------------------------
     Ciclo de desenho
     ------------------------------------------------------------------------ */

  function mostrar(elemento, deveMostrar) {
    if (elemento.hidden === deveMostrar) elemento.hidden = !deveMostrar;
  }

  function desenhar(f, derivados) {
    const ativa = OP.calc.regraNexNivel(f);
    mostrar(refs.secao, ativa);
    if (!ativa) {
      desenharSelos(derivados); // some com a regra desligada
      return;
    }
    const e = OP.calc.efeitosAlteracoes(f);
    const conj = derivados.conjuracao;
    const porEstagio = derivados.nex.unidade === 'estagio';

    const resumo = (porEstagio
      ? 'A progressão do Sobrevivente segue o estágio. '
      : 'Nível ' + OP.calc.nivelDaFicha(f) + ' (progressão: PV, PE, SAN, limite de PE e círculos; equivale a NEX ' + OP.calc.nexDoNivel(OP.calc.nivelDaFicha(f)) + '%). ') +
      'O NEX (exposição) vale para afinidade e alterações. 1 nível = 5% de NEX.';
    if (refs.resumo.textContent !== resumo) refs.resumo.textContent = resumo;

    // Escolhas: cada uma aparece quando a alteração foi alcançada
    mostrar(refs.campoPenalidade25, e.alcancadas.indexOf('g25') !== -1);
    mostrar(refs.campoAtributo35, e.alcancadas.indexOf('g35') !== -1);
    mostrar(refs.campoPenalidade35, e.alcancadas.indexOf('g35') !== -1);
    refs.selectElemento.disabled = !conj.afinidadeLiberada;
    const semElemento = e.nex >= conj.nexAfinidade && !e.elemento;
    mostrar(refs.semElemento, semElemento);
    const pend = e.pendencias.map(function (p) { return p.alteracao + ': ' + p.rotulo.toLowerCase(); });
    mostrar(refs.pendencia, pend.length > 0);
    const textoPend = pend.length ? 'Falta escolher — ' + pend.join('; ') + '.' : '';
    if (refs.pendencia.textContent !== textoPend) refs.pendencia.textContent = textoPend;

    // Extras
    mostrar(refs.campoSangue, e.suspensaoDisponivel && e.elemento === 'sangue');
    mostrar(refs.campoEscuridao, e.escuridaoAlternavel);
    mostrar(refs.interacaoSocial, e.interacaoSocialPE > 0);
    const textoSocial = 'Primeira interação social da cena: −' + e.interacaoSocialPE + ' PE';
    if (refs.interacaoSocial.textContent !== textoSocial && e.interacaoSocialPE > 0) refs.interacaoSocial.textContent = textoSocial;
    mostrar(refs.extras, !refs.campoSangue.hidden || !refs.campoEscuridao.hidden || !refs.interacaoSocial.hidden);

    desenharEnergia(f, e);
    desenharCartoes(f, e);
    desenharSelos(derivados);
  }

  /* ------------------------------------------------------------------------
     Montagem
     ------------------------------------------------------------------------ */

  function montarTextoLivro() {
    const secoes = OP.data.regraNexNivel.secoes.filter(function (s) { return s.id === 'ganhando-nex' || s.id === 'progressao-nex'; });
    OP.ui.substituirFilhos(refs.livroCorpo, secoes.reduce(function (filhos, secao) {
      filhos.push(criar('h3', 'subtitulo', secao.titulo));
      secao.paragrafos.forEach(function (p) { filhos.push(criar('p', 'dialogo__texto', p)); });
      return filhos;
    }, []));
  }

  function montarElementos() {
    const opcoes = [{ id: '', nome: 'Nenhum' }].concat(OP.calc.elementosAfinidade());
    OP.ui.substituirFilhos(refs.selectElemento, opcoes.map(function (el) {
      const o = document.createElement('option');
      o.value = el.id;
      o.textContent = el.nome;
      return o;
    }));
  }

  function montar() {
    refs.secao = document.getElementById('secao-alteracoes');
    if (!refs.secao) return;
    refs.resumo = document.getElementById('nex-resumo');
    refs.selectElemento = document.getElementById('alt-elemento');
    refs.campoPenalidade25 = document.getElementById('nex-campo-penalidade25');
    refs.campoAtributo35 = document.getElementById('nex-campo-atributo35');
    refs.campoPenalidade35 = document.getElementById('nex-campo-penalidade35');
    refs.semElemento = document.getElementById('nex-sem-elemento');
    refs.pendencia = document.getElementById('nex-pendencia');
    refs.extras = document.getElementById('nex-extras');
    refs.campoSangue = document.getElementById('nex-campo-sangue');
    refs.campoEscuridao = document.getElementById('nex-campo-escuridao');
    refs.interacaoSocial = document.getElementById('nex-interacao-social');
    refs.energia = document.getElementById('nex-energia');
    refs.energiaLimpar = document.getElementById('nex-energia-limpar');
    refs.energiaTique = document.getElementById('nex-energia-tique');
    refs.energiaEfeito = document.getElementById('nex-energia-efeito');
    refs.cartoes = document.getElementById('nex-cartoes');
    refs.livroCorpo = document.getElementById('nex-livro-corpo');

    montarElementos();
    montarTextoLivro();
    document.getElementById('nex-energia-sortear').addEventListener('click', sorteioEnergia);
    refs.energiaLimpar.addEventListener('click', limparEnergia);
    refs.energiaTique.addEventListener('click', esqueciTique);
    refs.interacaoSocial.addEventListener('click', interacaoSocial);
    OP.ui.registrarExtensao({ desenhar: desenhar });
  }

  OP.uiNex = {
    montar: montar,
    sortearEnergia: sorteioEnergia
  };
})(window.OP);
