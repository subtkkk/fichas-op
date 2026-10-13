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

  /** Teste de perícia: { titulo, resultados, escolhido, modo, bonus, total, ... }. */
  function rolarPericia(ficha, idPericia, opcoes) {
    const o = normalizarOpcoes(opcoes);
    const teste = OP.calc.testePericia(ficha, idPericia, o.modDados);
    const nome = nomePericia(idPericia);
    const partes = [{ rotulo: nome, valor: teste.bonus }];
    if (o.bonusExtra) partes.push({ rotulo: 'extra', valor: o.bonusExtra });
    const resultado = montarTeste(nome, teste.dados, partes, o);
    resultado.subtipo = 'pericia';
    resultado.condicoesDados = OP.calc.dadosCondicoesPericia(ficha, idPericia); // −1 = "condições: −1d20"
    return resultado;
  }

  /** Teste puro de atributo ("Teste de Força"): só os d20, sem bônus de perícia. */
  function rolarAtributo(ficha, idAtributo, opcoes) {
    const atributo = OP.data.atributos.find(function (a) { return a.id === idAtributo; });
    if (!atributo) return { ok: false, tipo: 'teste', titulo: 'Atributo', erro: 'Atributo desconhecido.' };
    const o = normalizarOpcoes(opcoes);
    const teste = OP.calc.testeAtributo(ficha, idAtributo, o.modDados);
    const partes = [];
    if (o.bonusExtra) partes.push({ rotulo: 'extra', valor: o.bonusExtra });
    const resultado = montarTeste('Teste de ' + atributo.nome, teste.dados, partes, o);
    resultado.subtipo = 'atributo';
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

    const teste = OP.calc.ataqueTeste(ficha, ataque, o.modDados);
    const bonusPericia = OP.calc.periciaBonus(ficha, ataque.pericia);
    const partes = [{ rotulo: nomePericia(ataque.pericia), valor: bonusPericia }];
    const outros = teste.bonus - bonusPericia;
    if (outros) partes.push({ rotulo: 'outros', valor: outros });
    if (o.bonusExtra) partes.push({ rotulo: 'extra', valor: o.bonusExtra });

    const resultado = montarTeste(titulo, teste.dados, partes, o);
    resultado.subtipo = 'ataque';
    resultado.condicoesDados = OP.calc.dadosCondicoesAtaque(ficha, ataque);
    resultado.idAtaque = ataque.id;
    resultado.critMargem = inteiro(ataque.critMargem);
    resultado.critico = OP.calc.ehCritico(resultado.escolhido, ataque.critMargem);
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
    return {
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
    if (gasto.ok) resultado.evento = eventoDaFicha(ficha, titulo, detalheGasto(gasto) + ' · DT ' + dt);
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
      return {
        ok: true,
        tipo: 'dano',
        titulo: titulo,
        formula: texto,
        termos: formula.termos,
        total: formula.total,
        critico: false,
        multDados: 1,
        tipoDano: ritual.elemento || ''
      };
    } catch (erro) {
      return { ok: false, tipo: 'dano', titulo: titulo, erro: 'Não foi possível rolar este dano.' };
    }
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
    rolarDanoRitual: rolarDanoRitual
  };
})(window.OP);
