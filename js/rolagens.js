/* ==========================================================================
   js/rolagens.js — liga a ficha ao motor de dados (OP.rolagens)
   --------------------------------------------------------------------------
   Cada função recebe a ficha (e o que rolar) e devolve um objeto de
   resultado pronto para a tela. As rolagens não alteram a ficha: o gasto
   de munição volta em "municaoRestante" e quem chama grava pelo
   OP.state.atualizar. Usar habilidade e conjurar ritual gastam PE (e, nos
   rituais de Medo, Sanidade) pelo OP.state.aplicarCustos (a porta de
   entrada do estado para esses gastos).

   Opções comuns (todas opcionais):
   - modDados:   inteiro, soma ou tira d20 da reserva do teste
   - bonusExtra: inteiro, somado ao total dos TESTES (perícia e ataque)
   - defesaAlvo: número; se informado, o resultado diz se acerta/passa

   Eventos sem dados (uso de habilidade, conjuração) vão para o histórico
   do painel por registrarEvento.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  function inteiro(valor) {
    const n = Math.trunc(Number(valor));
    return Number.isFinite(n) ? n : 0;
  }

  /** Completa as opções com valores padrão e descarta lixo. */
  function normalizarOpcoes(opcoes) {
    const o = opcoes || {};
    const defesa = o.defesaAlvo === null || o.defesaAlvo === undefined || o.defesaAlvo === '' ? null : Number(o.defesaAlvo);
    return {
      modDados: inteiro(o.modDados),
      bonusExtra: inteiro(o.bonusExtra),
      defesaAlvo: Number.isFinite(defesa) ? defesa : null,
      critico: o.critico === true
    };
  }

  function nomePericia(idPericia) {
    const pericia = OP.data.pericias.find(function (p) { return p.id === idPericia; });
    return pericia ? pericia.nome : String(idPericia);
  }

  /**
   * Rola a reserva de um teste e monta o resultado.
   * partes: [{ rotulo, valor }] que formam o bônus (para mostrar a conta).
   */
  function montarTeste(titulo, reserva, partes, opcoes) {
    const rolagem = OP.dados.rolarReserva(reserva.qtd, reserva.modo);
    const bonus = partes.reduce(function (soma, parte) { return soma + parte.valor; }, 0);
    const resultado = {
      ok: true,
      tipo: 'teste',
      titulo: titulo,
      resultados: rolagem.resultados,
      escolhido: rolagem.escolhido,
      indiceEscolhido: rolagem.indiceEscolhido,
      qtd: rolagem.qtd,
      modo: rolagem.modo,
      modDados: opcoes.modDados,
      partesBonus: partes,
      bonus: bonus,
      total: rolagem.escolhido + bonus,
      defesaAlvo: opcoes.defesaAlvo,
      acertou: null
    };
    // Igual ou maior que a Defesa/DT acerta (ou passa).
    if (opcoes.defesaAlvo !== null) resultado.acertou = resultado.total >= opcoes.defesaAlvo;
    return resultado;
  }

  /**
   * Alterações de NEX no resultado (regra opcional): os dados que elas somaram e, com o efeito 5 da
   * Energia (o mestre anota valores de d20 no início da cena), o aviso quando um dos d20 rolados
   * repete um valor anotado.
   */
  function marcarAlteracoes(ficha, resultado, dadosAlteracoes) {
    resultado.alteracoesDados = dadosAlteracoes;
    const energia = OP.calc.efeitosAlteracoes(ficha).energia;
    if (energia.d6 !== 5 || !energia.valores.length) return;
    const repetidos = resultado.resultados.filter(function (valor) { return energia.valores.indexOf(valor) !== -1; });
    if (!repetidos.length) return;
    const dano = OP.dados.rolarFormula('1d6');
    resultado.avisoEnergia = 'Valor anotado de Energia (' + repetidos[0] + ') saiu num d20: você e as criaturas em alcance curto sofrem ' +
      (dano.ok ? dano.total : '1d6') + ' pontos de dano de Energia.';
  }

  /* ---------- Gastos opcionais preparados (efeitos automáticos de poderes) ---------- */

  /**
   * Cobra os gastos preparados que valem neste teste e tira a preparação deles.
   * Devolve { ok, prep, peAtual } ou { ok: false, erro } (PE insuficiente: nada muda e o teste não rola).
   */
  function cobrarPreparados(ficha, contexto) {
    const prep = OP.calc.efeitoDosPreparados(ficha, contexto);
    if (!prep.itens.length) return { ok: true, prep: prep, peAtual: null };
    let peAtual = null;
    if (prep.custo > 0) {
      const gasto = OP.state.gastarPE(prep.custo, ficha);
      if (!gasto.ok) {
        return { ok: false, erro: 'PE insuficiente para ' + prep.itens.map(function (i) { return i.nome; }).join(' e ') + ' (' + prep.custo + ' PE).' };
      }
      peAtual = gasto.peAtual;
    }
    const resto = ((ficha.efeitos && ficha.efeitos.preparados) || []).filter(function (p) { return prep.ids.indexOf(p.id) === -1; });
    if (ficha === OP.state.ficha) OP.state.atualizar('efeitos.preparados', resto);
    else if (ficha.efeitos) ficha.efeitos.preparados = resto;
    return { ok: true, prep: prep, peAtual: peAtual };
  }

  /** Marca no resultado o que os poderes preparados fizeram (para a tela e o histórico). */
  function marcarPreparados(resultado, cobro) {
    if (!cobro.prep.itens.length) return;
    resultado.poderes = cobro.prep.itens.map(function (i) { return i.nome + (i.unidades > 1 ? ' ×' + i.unidades : ''); });
    resultado.poderesCusto = cobro.prep.custo;
    resultado.poderesDados = cobro.prep.dados;
  }

  /** Teste de perícia: { titulo, resultados, escolhido, modo, bonus, total, ... }. */
  function rolarPericia(ficha, idPericia, opcoes) {
    const o = normalizarOpcoes(opcoes);
    const nome = nomePericia(idPericia);
    const cobro = cobrarPreparados(ficha, { tipo: 'pericia', idPericia: idPericia });
    if (!cobro.ok) return { ok: false, tipo: 'teste', titulo: nome, erro: cobro.erro };
    o.modDados += cobro.prep.dados;
    const teste = OP.calc.testePericia(ficha, idPericia, o.modDados);
    const partes = [{ rotulo: nome, valor: teste.bonus }];
    if (cobro.prep.bonus) partes.push({ rotulo: 'poderes', valor: cobro.prep.bonus });
    if (o.bonusExtra) partes.push({ rotulo: 'extra', valor: o.bonusExtra });
    const resultado = montarTeste(nome, teste.dados, partes, o);
    marcarPreparados(resultado, cobro);
    resultado.subtipo = 'pericia';
    resultado.condicoesDados = OP.calc.dadosCondicoesPericia(ficha, idPericia); // −1 = "condições: −1d20"
    marcarAlteracoes(ficha, resultado, OP.calc.dadosAlteracoesPericia(ficha, idPericia));
    return resultado;
  }

  /** Teste puro de atributo ("Teste de Força"): só os d20, sem bônus de perícia. */
  function rolarAtributo(ficha, idAtributo, opcoes) {
    const atributo = OP.data.atributos.find(function (a) { return a.id === idAtributo; });
    if (!atributo) return { ok: false, tipo: 'teste', titulo: 'Atributo', erro: 'Atributo desconhecido.' };
    const o = normalizarOpcoes(opcoes);
    const cobro = cobrarPreparados(ficha, { tipo: 'atributo', atributo: idAtributo });
    if (!cobro.ok) return { ok: false, tipo: 'teste', titulo: 'Teste de ' + atributo.nome, erro: cobro.erro };
    o.modDados += cobro.prep.dados;
    const teste = OP.calc.testeAtributo(ficha, idAtributo, o.modDados);
    const partes = [];
    if (cobro.prep.bonus) partes.push({ rotulo: 'poderes', valor: cobro.prep.bonus });
    if (o.bonusExtra) partes.push({ rotulo: 'extra', valor: o.bonusExtra });
    const resultado = montarTeste('Teste de ' + atributo.nome, teste.dados, partes, o);
    marcarPreparados(resultado, cobro);
    resultado.subtipo = 'atributo';
    marcarAlteracoes(ficha, resultado, OP.calc.dadosAlteracoesAtributo(ficha, idAtributo));
    return resultado;
  }

  function tituloAtaque(ataque) {
    return 'Ataque: ' + (String(ataque.nome || '').trim() || 'sem nome');
  }

  /**
   * Teste de ataque: o mesmo de rolarPericia, mais { critico }.
   * Com munição: bloqueia (ok: false) se municao ≤ 0; senão gasta 1
   * (devolvido em municaoRestante; armas automáticas o usuário corrige à mão).
   */
  function rolarAtaque(ficha, ataque, opcoes) {
    const o = normalizarOpcoes(opcoes);
    const titulo = tituloAtaque(ataque);
    const municao = inteiro(ataque.municao);
    if (ataque.usaMunicao === true && municao <= 0) {
      return { ok: false, bloqueado: true, tipo: 'teste', titulo: titulo, erro: 'Sem munição. Recarregue ou ajuste o contador.' };
    }

    const tipoAtaque = ataque.pericia === 'luta' ? 'corpo' : 'distancia';
    const cobro = cobrarPreparados(ficha, { tipo: 'ataque', idPericia: ataque.pericia, ataque: tipoAtaque });
    if (!cobro.ok) return { ok: false, tipo: 'teste', titulo: titulo, erro: cobro.erro };
    o.modDados += cobro.prep.dados;
    const teste = OP.calc.ataqueTeste(ficha, ataque, o.modDados);
    const bonusPericia = OP.calc.periciaBonus(ficha, ataque.pericia);
    const partes = [{ rotulo: nomePericia(ataque.pericia), valor: bonusPericia }];
    const outros = teste.bonus - bonusPericia;
    if (outros) partes.push({ rotulo: 'outros', valor: outros });
    if (cobro.prep.bonus) partes.push({ rotulo: 'poderes', valor: cobro.prep.bonus });
    if (o.bonusExtra) partes.push({ rotulo: 'extra', valor: o.bonusExtra });

    const resultado = montarTeste(titulo, teste.dados, partes, o);
    marcarPreparados(resultado, cobro);
    resultado.subtipo = 'ataque';
    resultado.condicoesDados = OP.calc.dadosCondicoesAtaque(ficha, ataque);
    marcarAlteracoes(ficha, resultado, OP.calc.dadosAlteracoesPericia(ficha, ataque.pericia));
    resultado.idAtaque = ataque.id;
    const margemEfeitos = OP.calc.bonusEfeitosAtaque(ficha, ataque).margem;
    resultado.critMargem = inteiro(ataque.critMargem) - margemEfeitos;
    resultado.critico = OP.calc.ehCritico(resultado.escolhido, resultado.critMargem);
    resultado.municaoRestante = ataque.usaMunicao === true ? municao - 1 : null;
    return resultado;
  }

  /**
   * Dano de um ataque: fórmula `dano` + danoBonus.
   * Com { critico: true }, os dados são multiplicados por critMult (o bônus fixo não).
   */
  function rolarDano(ficha, ataque, opcoes) {
    const o = normalizarOpcoes(opcoes);
    const mult = o.critico ? Math.max(2, inteiro(ataque.critMult)) : 1;
    const titulo = 'Dano: ' + (String(ataque.nome || '').trim() || 'sem nome');
    const tipoAtaque = ataque.pericia === 'luta' ? 'corpo' : 'distancia';
    const cobro = cobrarPreparados(ficha, { tipo: 'dano', ataque: tipoAtaque });
    if (!cobro.ok) return { ok: false, tipo: 'dano', titulo: titulo, erro: cobro.erro };
    const formula = OP.dados.rolarFormula(ataque.dano, { multDados: mult });
    if (!formula.ok) {
      return { ok: false, tipo: 'dano', titulo: titulo, erro: 'Fórmula de dano inválida: ' + formula.erro };
    }
    const termos = formula.termos.slice();
    let total = formula.total;
    const danoBonus = inteiro(ataque.danoBonus);
    if (danoBonus) {
      termos.push({ tipo: 'fixo', rotulo: 'bônus de dano', sinal: danoBonus < 0 ? -1 : 1, qtd: null, faces: null, resultados: [], valor: danoBonus });
      total += danoBonus;
    }
    const danoEfeitos = OP.calc.bonusEfeitosAtaque(ficha, ataque).dano + cobro.prep.dano;
    if (danoEfeitos) {
      termos.push({ tipo: 'fixo', rotulo: 'poderes', sinal: danoEfeitos < 0 ? -1 : 1, qtd: null, faces: null, resultados: [], valor: danoEfeitos });
      total += danoEfeitos;
    }
    const resultadoDano = {
      ok: true,
      tipo: 'dano',
      titulo: titulo,
      formula: String(ataque.dano),
      termos: termos,
      total: total,
      critico: o.critico,
      multDados: mult,
      tipoDano: ataque.tipoDano || ''
    };
    marcarPreparados(resultadoDano, cobro);
    return resultadoDano;
  }

  /** Fórmula digitada pelo usuário ("2d6+3"). */
  function rolarLivre(texto) {
    const formula = OP.dados.rolarFormula(texto);
    const titulo = String(texto === null || texto === undefined ? '' : texto).trim();
    if (!formula.ok) return { ok: false, tipo: 'formula', titulo: titulo || 'Fórmula', erro: formula.erro };
    return { ok: true, tipo: 'formula', titulo: titulo, formula: titulo, termos: formula.termos, total: formula.total };
  }

  /* ------------------------------------------------------------------------
     Eventos (uso de habilidade, conjuração): vão para o histórico do painel
     sem total de dados. A tela se inscreve com aoRegistrarEvento.
     ------------------------------------------------------------------------ */

  const ouvintesEvento = [];

  /** fn(evento) é chamada a cada evento registrado. */
  function aoRegistrarEvento(funcao) {
    ouvintesEvento.push(funcao);
  }

  function criarEvento(titulo, detalhe) {
    return { ok: true, tipo: 'evento', titulo: String(titulo || ''), detalhe: String(detalhe || '') };
  }

  /** Registra um evento { tipo: 'evento', titulo, detalhe } e avisa quem estiver ouvindo. */
  function registrarEvento(titulo, detalhe) {
    const evento = criarEvento(titulo, detalhe);
    ouvintesEvento.forEach(function (funcao) {
      try {
        funcao(evento);
      } catch (erro) {
        console.warn('[OP] Falha ao mostrar um evento no histórico.', erro);
      }
    });
    return evento;
  }

  /**
   * Evento de uma ação numa ficha: só vai para o histórico da tela quando é a
   * ficha aberta (as fichas de teste do OP.runTests não sujam o histórico).
   */
  function eventoDaFicha(ficha, titulo, detalhe) {
    return ficha === OP.state.ficha ? registrarEvento(titulo, detalhe) : criarEvento(titulo, detalhe);
  }

  function nomeOuPadrao(texto, padrao) {
    return String(texto || '').trim() || padrao;
  }

  /**
   * Detalhe de um gasto para o histórico:
   * "−3 PE · sobram 5 · passou do limite por turno (4/3) · −3 SAN · sobram 17 · −1 SAN permanente".
   */
  function detalheGasto(gasto) {
    const partes = [];
    if (gasto.gasto) {
      let texto = '−' + gasto.gasto + ' PE · sobram ' + gasto.peAtual;
      if (gasto.avisoLimite) texto += ' · passou do limite por turno (' + gasto.peGastoTurno + '/' + gasto.limite + ')';
      partes.push(texto);
    }
    if (gasto.san) partes.push('−' + gasto.san + ' SAN' + (gasto.sanAtual !== null && gasto.sanAtual !== undefined ? ' · sobram ' + gasto.sanAtual : ''));
    if (gasto.permanente) partes.push('−' + gasto.permanente + ' SAN permanente');
    return partes.length ? partes.join(' · ') : 'sem custo de PE';
  }

  /**
   * Usa uma habilidade: gasta custoPE (se > 0) e registra o evento.
   * Devolve o resultado de OP.state.gastarPE + { titulo, evento }.
   */
  function usarHabilidade(ficha, habilidade) {
    const titulo = 'Habilidade: ' + nomeOuPadrao(habilidade.nome, 'sem nome');
    const gasto = OP.state.gastarPE(OP.calc.custoComCondicoes(ficha, inteiro(habilidade.custoPE)), ficha);
    const resultado = Object.assign({ titulo: titulo }, gasto);
    if (gasto.ok) resultado.evento = eventoDaFicha(ficha, titulo, detalheGasto(gasto));
    return resultado;
  }

  function nomeForma(idForma) {
    const forma = OP.data.formasRitual.find(function (f) { return f.id === idForma; });
    return forma ? forma.nome : String(idForma);
  }

  /**
   * Conjura um ritual numa forma ("padrao", "discente" ou "verdadeira")
   * seguindo OP.calc.planoConjuracao: gasta o custo da forma e, se o ritual
   * for de Medo, também a Sanidade e a Sanidade permanente — tudo de uma vez
   * — e registra o evento. Forma inativa ou PE insuficiente: nada muda.
   * (A confirmação do ritual de Medo é feita pela tela antes de chamar.)
   */
  function conjurarRitual(ficha, ritual, idForma) {
    const titulo = 'Ritual: ' + nomeOuPadrao(ritual && ritual.nome, 'sem nome') + ' (' + nomeForma(idForma) + ')';
    const plano = OP.calc.planoConjuracao(ficha, ritual, idForma);
    const dt = OP.calc.dtRituais(ficha).total;
    if (!plano.ok) {
      return {
        ok: false, titulo: titulo, forma: idForma, dt: dt, medo: plano.medo, motivo: plano.motivo,
        gasto: 0, avisoLimite: false, custo: plano.pe, peAtual: plano.peAtual, san: 0, permanente: 0
      };
    }
    const gasto = OP.state.aplicarCustos({ pe: plano.pe, san: plano.san, permanente: plano.permanente }, ficha);
    const resultado = Object.assign({ titulo: titulo, forma: idForma, dt: dt, medo: plano.medo }, gasto);
    if (gasto.ok) {
      const ligado = ligarEfeitoDoRitual(ficha, ritual, idForma);
      resultado.evento = eventoDaFicha(ficha, titulo, detalheGasto(gasto) + ' · DT ' + dt + (ligado ? ' · efeito ligado' : ''));
      resultado.efeitoLigado = ligado;
    }
    return resultado;
  }

  /**
   * Rola o dano de uma forma do ritual. Dano vazio ou inválido devolve
   * { ok: false, erro } com mensagem amigável (nunca lança exceção).
   */
  function rolarDanoRitual(ficha, ritual, idForma) {
    const titulo = 'Dano: ' + nomeOuPadrao(ritual && ritual.nome, 'ritual sem nome') + ' (' + nomeForma(idForma) + ')';
    try {
      const forma = OP.calc.formaDoRitual(ritual, idForma);
      if (!forma) return { ok: false, tipo: 'dano', titulo: titulo, erro: 'Esta forma não está ativa neste ritual.' };
      const texto = String(forma.dano || '').trim();
      if (texto === '') return { ok: false, tipo: 'dano', titulo: titulo, erro: 'Esta forma não tem dano. Preencha o campo "Dano", como 2d6+3.' };
      const formula = OP.dados.rolarFormula(texto);
      if (!formula.ok) return { ok: false, tipo: 'dano', titulo: titulo, erro: 'Dano inválido: ' + formula.erro };
      const termos = formula.termos.slice();
      let total = formula.total;
      const extra = OP.calc.efeitosDaFicha(ficha).danoRitual;
      if (extra) {
        termos.push({ tipo: 'fixo', rotulo: 'poderes', sinal: extra < 0 ? -1 : 1, qtd: null, faces: null, resultados: [], valor: extra });
        total += extra;
      }
      return {
        ok: true,
        tipo: 'dano',
        titulo: titulo,
        formula: texto,
        termos: termos,
        total: total,
        critico: false,
        multDados: 1,
        tipoDano: ritual.elemento || ''
      };
    } catch (erro) {
      return { ok: false, tipo: 'dano', titulo: titulo, erro: 'Não foi possível rolar este dano.' };
    }
  }

  /** Rola a cura de uma forma do ritual (soma os bônus de cura dos poderes). Não aplica: o alvo pode ser outro ser. */
  function rolarCuraRitual(ficha, ritual, idForma) {
    const titulo = 'Cura: ' + nomeOuPadrao(ritual && ritual.nome, 'ritual sem nome') + ' (' + nomeForma(idForma) + ')';
    try {
      const forma = OP.calc.formaDoRitual(ritual, idForma);
      if (!forma) return { ok: false, tipo: 'cura', titulo: titulo, erro: 'Esta forma não está ativa neste ritual.' };
      const texto = String(forma.cura || '').trim();
      if (texto === '') return { ok: false, tipo: 'cura', titulo: titulo, erro: 'Esta forma não tem cura.' };
      const formula = OP.dados.rolarFormula(texto);
      if (!formula.ok) return { ok: false, tipo: 'cura', titulo: titulo, erro: 'Fórmula inválida: ' + formula.erro };
      const termos = formula.termos.slice();
      let total = formula.total;
      const e = OP.calc.efeitosDaFicha(ficha);
      const extra = e.cura + e.curaRitual;
      if (extra) {
        termos.push({ tipo: 'fixo', rotulo: 'poderes', sinal: extra < 0 ? -1 : 1, qtd: null, faces: null, resultados: [], valor: extra });
        total += extra;
      }
      return { ok: true, tipo: 'dano', titulo: titulo, formula: texto, termos: termos, total: total, critico: false, multDados: 1, tipoDano: '', cura: true };
    } catch (erro) {
      return { ok: false, tipo: 'cura', titulo: titulo, erro: 'Não foi possível rolar esta cura.' };
    }
  }

  /* ---------- Efeitos ativáveis e usos (poderes com efeito automático) ---------- */

  let contadorEfeitos = 0;
  function idDeEfeito() {
    contadorEfeitos += 1;
    return 'ef-' + Date.now().toString(36) + '-' + contadorEfeitos;
  }

  function gravarLista(ficha, caminho, valor) {
    if (ficha === OP.state.ficha) OP.state.atualizar(caminho, valor);
    else {
      const chave = caminho.split('.')[1];
      ficha.efeitos[chave] = valor;
    }
  }

  /** Liga o efeito de um ritual conjurado (se ele tem `ativavel`); troca o que já estiver ligado. */
  function ligarEfeitoDoRitual(ficha, ritual, idForma) {
    const chave = ritual && ritual.catalogo;
    if (!chave || !OP.calc.ativaveisDaFicha(ficha).some(function (a) { return a.chave === chave; })) return false;
    const entrada = OP.calc.novoEfeitoAtivo(ficha, chave, idDeEfeito(), idForma);
    if (!entrada) return false;
    const resto = ((ficha.efeitos && ficha.efeitos.ativos) || []).filter(function (a) { return a.chave !== chave; });
    gravarLista(ficha, 'efeitos.ativos', resto.concat([entrada]));
    return true;
  }

  /** Liga o efeito automático de um ritual numa forma, sem gastar PE. Devolve { ok, titulo, motivo?, evento? }. */
  function ligarEfeitoRitual(ficha, ritual, idForma) {
    const titulo = 'Efeito: ' + nomeOuPadrao(ritual && ritual.nome, 'ritual sem nome') + ' (' + nomeForma(idForma) + ')';
    if (!ligarEfeitoDoRitual(ficha, ritual, idForma)) return { ok: false, titulo: titulo, motivo: 'Este ritual não tem efeito automático.' };
    return { ok: true, titulo: titulo, evento: eventoDaFicha(ficha, titulo, 'efeito ligado') };
  }

  /** Liga um efeito ativável (gasta o PE dele). Devolve { ok, titulo, motivo?, evento? }. */
  function ativarEfeito(ficha, chave) {
    const a = OP.calc.ativaveisDaFicha(ficha).find(function (x) { return x.chave === chave; });
    if (!a) return { ok: false, titulo: 'Efeito', motivo: 'Este efeito não está disponível nesta ficha.' };
    const titulo = 'Ativar: ' + a.nome;
    if (a.ligado) return { ok: false, titulo: titulo, motivo: 'Já está ativo.' };
    const gasto = a.custo > 0 ? OP.state.gastarPE(OP.calc.custoComCondicoes(ficha, a.custo), ficha) : { ok: true, gasto: 0, peAtual: null };
    if (!gasto.ok) return Object.assign({ titulo: titulo }, gasto);
    const entrada = OP.calc.novoEfeitoAtivo(ficha, chave, idDeEfeito());
    gravarLista(ficha, 'efeitos.ativos', ((ficha.efeitos && ficha.efeitos.ativos) || []).concat([entrada]));
    const resultado = Object.assign({ titulo: titulo }, gasto);
    resultado.evento = eventoDaFicha(ficha, titulo, a.custo > 0 ? detalheGasto(gasto) : 'sem custo de PE');
    return resultado;
  }

  /** Desliga um efeito ativo (sem devolver PE). */
  function desativarEfeito(ficha, chave) {
    const lista = ((ficha.efeitos && ficha.efeitos.ativos) || []);
    const resto = lista.filter(function (a) { return a.chave !== chave; });
    if (resto.length === lista.length) return false;
    gravarLista(ficha, 'efeitos.ativos', resto);
    eventoDaFicha(ficha, 'Efeito encerrado: ' + nomeOuPadrao(OP.calc.ativaveisDaFicha(ficha).concat(OP.calc.usosDaFicha(ficha)).filter(function (x) { return x.chave === chave; }).map(function (x) { return x.nome; })[0], 'efeito'), '');
    return true;
  }

  function mudarRecurso(ficha, id, delta) {
    const est = OP.calc.estadoRecurso(ficha, id);
    if (est.atual === null || est.max === null) return null;
    const novo = Math.max(0, Math.min(est.max, est.atual + delta));
    if (ficha === OP.state.ficha) OP.state.atualizar('recursos.' + id + '.atual', novo);
    else ficha.recursos[id].atual = novo;
    return novo;
  }

  /**
   * Usa um "uso" de poder (cura, dano ou rolagem com dados fixos): gasta o PE, rola, soma os bônus de cura
   * e aplica o que o uso diz (recupera PV/PE/SAN; perde PV/PE/SAN). Devolve um resultado de fórmula.
   */
  function usarEfeito(ficha, idUso) {
    const uso = OP.calc.usosDaFicha(ficha).find(function (u) { return u.id === idUso; });
    if (!uso) return { ok: false, tipo: 'formula', titulo: 'Poder', erro: 'Este poder não está disponível nesta ficha.' };
    const titulo = uso.fonte + (uso.nome !== uso.fonte ? ': ' + uso.nome : '');
    const formula = OP.dados.rolarFormula(uso.rolar);
    if (!formula.ok) return { ok: false, tipo: 'formula', titulo: titulo, erro: 'Fórmula inválida: ' + formula.erro };
    const termos = formula.termos.slice();
    let total = formula.total;
    if (uso.tipo === 'cura') {
      const extra = OP.calc.bonusDeCura(ficha);
      if (extra) {
        termos.push({ tipo: 'fixo', rotulo: 'poderes', sinal: extra < 0 ? -1 : 1, qtd: null, faces: null, resultados: [], valor: extra });
        total += extra;
      }
    }
    const perdas = {};
    const perdidas = [];
    Object.keys(uso.perde || {}).forEach(function (id) {
      const r = OP.dados.rolarFormula(uso.perde[id]);
      perdas[id] = r.ok ? r.total : 0;
      if (perdas[id]) perdidas.push('−' + perdas[id] + ' ' + id.toUpperCase());
    });
    const custo = OP.calc.custoComCondicoes(ficha, uso.custo);
    const gasto = OP.state.aplicarCustos({ pe: custo + (perdas.pe || 0), san: perdas.san || 0 }, ficha);
    if (!gasto.ok) return { ok: false, tipo: 'formula', titulo: titulo, erro: gasto.motivo || 'PE insuficiente.' };
    const aplicado = [];
    if (custo) aplicado.push('−' + custo + ' PE');
    if (perdas.san) aplicado.push('−' + perdas.san + ' SAN');
    if (perdas.pe) aplicado.push('−' + perdas.pe + ' PE');
    if (perdas.pv) {
      mudarRecurso(ficha, 'pv', -perdas.pv);
      aplicado.push('−' + perdas.pv + ' PV');
    }
    if (uso.recupera) {
      const antes = OP.calc.estadoRecurso(ficha, uso.recupera).atual;
      const depois = mudarRecurso(ficha, uso.recupera, total);
      if (depois !== null) aplicado.push('+' + Math.max(0, depois - antes) + ' ' + uso.recupera.toUpperCase());
    }
    const resultado = {
      ok: true, tipo: 'dano', titulo: titulo, formula: uso.rolar, termos: termos, total: total, critico: false, multDados: 1,
      tipoDano: uso.tipo === 'dano' ? uso.elemento : '', cura: uso.tipo === 'cura', aplicado: aplicado.join(' · ')
    };
    eventoDaFicha(ficha, titulo, total + (aplicado.length ? ' · ' + aplicado.join(' · ') : ''));
    return resultado;
  }

  /** Prepara (unidades ≥ 1) ou desfaz (0) um gasto opcional para o próximo teste que combinar. */
  function prepararGasto(ficha, idGasto, unidades) {
    const lista = OP.calc.preparadosAposAlterar(ficha, idGasto, unidades);
    gravarLista(ficha, 'efeitos.preparados', lista);
  }

  OP.rolagens = {
    rolarPericia: rolarPericia,
    rolarAtributo: rolarAtributo,
    rolarAtaque: rolarAtaque,
    rolarDano: rolarDano,
    rolarLivre: rolarLivre,
    aoRegistrarEvento: aoRegistrarEvento,
    registrarEvento: registrarEvento,
    usarHabilidade: usarHabilidade,
    conjurarRitual: conjurarRitual,
    ligarEfeitoRitual: ligarEfeitoRitual,
    rolarDanoRitual: rolarDanoRitual,
    rolarCuraRitual: rolarCuraRitual,
    ativarEfeito: ativarEfeito,
    desativarEfeito: desativarEfeito,
    usarEfeito: usarEfeito,
    prepararGasto: prepararGasto
  };
})(window.OP);
