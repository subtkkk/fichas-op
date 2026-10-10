/* ==========================================================================
   js/dados.js — motor de dados (OP.dados)
   --------------------------------------------------------------------------
   - Gerador aleatório trocável (OP.dados.setRng) para testes previsíveis.
   - Reserva de d20 (fica com o maior ou com o menor).
   - Analisador próprio de fórmulas ("2d6+3"): NÃO usa eval nem new Function.
   Nada aqui toca no DOM nem na ficha.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const LIMITES = {
    dadosPorTermo: 50,     // no máximo 50 dados por termo (antes do multiplicador)
    facesMinimo: 2,
    facesMaximo: 1000,
    termos: 30,            // proteção contra fórmulas gigantes
    caracteres: 200,
    numeroMaximo: 1000000,
    reservaMaxima: 50      // d20 numa reserva de teste
  };

  /* ------------------------------------------------------------------------
     Gerador aleatório
     ------------------------------------------------------------------------ */

  /** Número em [0, 1): crypto.getRandomValues quando existir, senão Math.random. */
  function geradorPadrao() {
    const cripto = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : null;
    if (cripto && typeof cripto.getRandomValues === 'function') {
      const buffer = new Uint32Array(1);
      cripto.getRandomValues(buffer);
      return buffer[0] / 4294967296; // 2^32
    }
    return Math.random();
  }

  let gerador = geradorPadrao;

  /**
   * Troca o gerador (fn devolve um número em [0, 1)).
   * Sem argumento (ou algo que não é função), volta ao gerador padrão.
   */
  function setRng(fn) {
    gerador = typeof fn === 'function' ? fn : geradorPadrao;
  }

  /** Gerador em uso (para salvar e restaurar nos testes). */
  function getRng() {
    return gerador;
  }

  function inteiro(valor) {
    const n = Math.trunc(Number(valor));
    return Number.isFinite(n) ? n : 0;
  }

  /* ------------------------------------------------------------------------
     Dados
     ------------------------------------------------------------------------ */

  /** Um dado de N faces: Math.floor(r × faces) + 1, sempre entre 1 e faces. */
  function d(faces) {
    const f = Math.max(1, inteiro(faces));
    let r = Number(gerador());
    if (!Number.isFinite(r) || r < 0) r = 0;
    if (r >= 1) r = 0.999999999;
    return Math.min(f, Math.floor(r * f) + 1);
  }

  /**
   * Rola uma reserva de d20 e escolhe o maior ("maior") ou o menor ("menor").
   * Devolve { resultados, escolhido, indiceEscolhido, qtd, modo }.
   */
  function rolarReserva(qtd, modo) {
    const quantidade = Math.min(LIMITES.reservaMaxima, Math.max(1, inteiro(qtd)));
    const modoFinal = modo === 'menor' ? 'menor' : 'maior';
    const resultados = [];
    for (let i = 0; i < quantidade; i++) resultados.push(d(20));

    let indiceEscolhido = 0;
    resultados.forEach(function (valor, indice) {
      const melhor = modoFinal === 'menor' ? valor < resultados[indiceEscolhido] : valor > resultados[indiceEscolhido];
      if (melhor) indiceEscolhido = indice;
    });
    return {
      resultados: resultados,
      escolhido: resultados[indiceEscolhido],
      indiceEscolhido: indiceEscolhido,
      qtd: quantidade,
      modo: modoFinal
    };
  }

  /* ------------------------------------------------------------------------
     Fórmulas ("2d6+3", "1d8+1d4+2", "d10")
     ------------------------------------------------------------------------ */

  function falha(mensagem) {
    return { ok: false, erro: mensagem, termos: [], total: 0 };
  }

  // Um termo: sinal opcional + (NdM ou M) ou número inteiro. "d10" = 1d10.
  const PADRAO_TERMO = /([+-]?)(?:(\d*)d(\d+)|(\d+))/y;

  /**
   * Analisa uma fórmula sem rolar nada. Nunca lança exceção.
   * Devolve { ok: true, erro: '', termos: [{ tipo, sinal, qtd, faces, valor }] }
   * ou { ok: false, erro: 'mensagem curta', termos: [] }.
   */
  function analisarFormula(texto) {
    try {
      if (typeof texto !== 'string' && typeof texto !== 'number') return falha('Digite uma fórmula, como 2d6+3.');
      const original = String(texto);
      if (original.length > LIMITES.caracteres) return falha('Fórmula longa demais.');
      // "2d6 3" (dois termos sem sinal entre eles) é ambíguo
      if (/[0-9d]\s+[0-9d]/i.test(original.trim())) return falha('Separe os termos com + ou −, como 2d6+3.');

      const limpo = original.toLowerCase().replace(/\s+/g, '').replace(/−/g, '-');
      if (limpo === '') return falha('Digite uma fórmula, como 2d6+3.');

      const termos = [];
      let posicao = 0;
      while (posicao < limpo.length) {
        PADRAO_TERMO.lastIndex = posicao;
        const encontrado = PADRAO_TERMO.exec(limpo);
        if (!encontrado || encontrado.index !== posicao) {
          const resto = limpo.slice(posicao);
          if (resto === '+' || resto === '-') return falha('A fórmula não pode terminar com + ou −.');
          return falha('Não entendi "' + resto.slice(0, 8) + '". Use termos como 2d6, d10 ou 3, separados por + ou −.');
        }
        if (termos.length > 0 && encontrado[1] === '') {
          return falha('Separe os termos com + ou −, como 2d6+3.');
        }
        const sinal = encontrado[1] === '-' ? -1 : 1;

        if (encontrado[3] !== undefined) {
          const qtd = encontrado[2] === '' ? 1 : parseInt(encontrado[2], 10);
          const faces = parseInt(encontrado[3], 10);
          if (qtd < 1) return falha('A quantidade de dados precisa ser pelo menos 1.');
          if (qtd > LIMITES.dadosPorTermo) return falha('No máximo ' + LIMITES.dadosPorTermo + ' dados por termo.');
          if (faces < LIMITES.facesMinimo || faces > LIMITES.facesMaximo) {
            return falha('Os dados precisam ter de ' + LIMITES.facesMinimo + ' a ' + LIMITES.facesMaximo + ' faces.');
          }
          termos.push({ tipo: 'dado', sinal: sinal, qtd: qtd, faces: faces, valor: 0 });
        } else {
          const valor = parseInt(encontrado[4], 10);
          if (valor > LIMITES.numeroMaximo) return falha('Número grande demais.');
          termos.push({ tipo: 'fixo', sinal: sinal, qtd: null, faces: null, valor: sinal * valor });
        }
        if (termos.length > LIMITES.termos) return falha('Termos demais na fórmula.');
        posicao = PADRAO_TERMO.lastIndex;
      }
      return { ok: true, erro: '', termos: termos };
    } catch (erro) {
      return falha('Fórmula inválida.');
    }
  }

  /**
   * Rola uma fórmula. Nunca lança exceção.
   * opcoes.multDados multiplica a QUANTIDADE de dados de cada termo (não os
   * números fixos): é o que o crítico usa. CONFERIR NO LIVRO
   * Devolve { ok, erro, termos: [{ tipo, sinal, qtd, faces, resultados, valor }], total }.
   */
  function rolarFormula(texto, opcoes) {
    const analise = analisarFormula(texto);
    if (!analise.ok) return analise;
    try {
      const mult = Math.max(1, inteiro(opcoes && opcoes.multDados !== undefined ? opcoes.multDados : 1));
      let total = 0;
      const termos = analise.termos.map(function (termo) {
        if (termo.tipo === 'fixo') {
          total += termo.valor;
          return { tipo: 'fixo', sinal: termo.sinal, qtd: null, faces: null, resultados: [], valor: termo.valor };
        }
        const qtd = termo.qtd * mult;
        const resultados = [];
        for (let i = 0; i < qtd; i++) resultados.push(d(termo.faces));
        const soma = resultados.reduce(function (a, b) { return a + b; }, 0);
        const valor = termo.sinal * soma;
        total += valor;
        return { tipo: 'dado', sinal: termo.sinal, qtd: qtd, faces: termo.faces, resultados: resultados, valor: valor };
      });
      return { ok: true, erro: '', termos: termos, total: total };
    } catch (erro) {
      return falha('Não foi possível rolar esta fórmula.');
    }
  }

  OP.dados = {
    LIMITES: LIMITES,
    setRng: setRng,
    getRng: getRng,
    d: d,
    rolarReserva: rolarReserva,
    analisarFormula: analisarFormula,
    rolarFormula: rolarFormula
  };
})(window.OP);
