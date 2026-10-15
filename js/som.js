/* ==========================================================================
   js/som.js — sons das rolagens (OP.som)
   --------------------------------------------------------------------------
   - Tudo sintetizado na hora com a Web Audio API: nenhum arquivo de áudio,
     nada de rede (o site abre por file://).
   - Rolagem comum: dados chacoalhando (vários estalos curtos) e uma batida
     final. 20 natural num d20: o mesmo chacoalhar e, depois, um arpejo
     brilhante que sobe.
   - Só toca depois de um gesto da pessoa (clicar em rolar), que é o que os
     navegadores exigem. Desligável em Aparência (preferência "som", padrão
     ligado) e sem efeito se o navegador não tiver Web Audio.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  let contexto = null;
  let ruido = null;
  let silenciado = false; // OP.runTests liga: os testes clicam em botões de rolar

  function criarContexto() {
    if (contexto) return contexto;
    const Classe = window.AudioContext || window.webkitAudioContext;
    if (!Classe) return null;
    try {
      contexto = new Classe();
    } catch (erro) {
      contexto = null;
    }
    return contexto;
  }

  /** Meio segundo de ruído branco, reaproveitado em todos os estalos. */
  function bufferDeRuido(ctx) {
    if (ruido && ruido.sampleRate === ctx.sampleRate) return ruido;
    const tamanho = Math.floor(ctx.sampleRate * 0.5);
    ruido = ctx.createBuffer(1, tamanho, ctx.sampleRate);
    const dados = ruido.getChannelData(0);
    for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1;
    return ruido;
  }

  /** Um estalo de dado batendo: ruído filtrado, curtinho, que some rápido. */
  function estalo(ctx, saida, quando, volume, grave) {
    const fonte = ctx.createBufferSource();
    fonte.buffer = bufferDeRuido(ctx);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = grave ? 900 + Math.random() * 700 : 1800 + Math.random() * 2800;
    filtro.Q.value = 1.4;
    const ganho = ctx.createGain();
    const duracao = 0.018 + Math.random() * 0.02;
    ganho.gain.setValueAtTime(0.0001, quando);
    ganho.gain.exponentialRampToValueAtTime(volume, quando + 0.002);
    ganho.gain.exponentialRampToValueAtTime(0.0001, quando + duracao);
    fonte.connect(filtro);
    filtro.connect(ganho);
    ganho.connect(saida);
    fonte.start(quando, Math.random() * 0.3);
    fonte.stop(quando + duracao + 0.02);
  }

  /** O chacoalhar: estalos que ficam mais espaçados e mais fracos, com uma batida no fim. Devolve a duração. */
  function chacoalhar(ctx, saida, inicio) {
    const estalos = 9 + Math.floor(Math.random() * 4);
    let t = 0;
    for (let i = 0; i < estalos; i++) {
      const fracao = i / estalos;
      estalo(ctx, saida, inicio + t, 0.55 * (1 - fracao * 0.75), i % 3 === 0);
      t += 0.022 + fracao * 0.05 + Math.random() * 0.02;
    }
    // batida final do dado assentando
    const batida = ctx.createOscillator();
    const ganho = ctx.createGain();
    batida.type = 'sine';
    batida.frequency.setValueAtTime(150, inicio + t);
    batida.frequency.exponentialRampToValueAtTime(55, inicio + t + 0.09);
    ganho.gain.setValueAtTime(0.0001, inicio + t);
    ganho.gain.exponentialRampToValueAtTime(0.45, inicio + t + 0.005);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + t + 0.12);
    batida.connect(ganho);
    ganho.connect(saida);
    batida.start(inicio + t);
    batida.stop(inicio + t + 0.14);
    return t + 0.12;
  }

  /** Arpejo brilhante (dó, mi, sol, dó oitava acima) com um reflexo agudo: o 20 natural. */
  function arpejo(ctx, saida, inicio) {
    const notas = [1046.5, 1318.5, 1568, 2093];
    notas.forEach(function (frequencia, i) {
      const t = inicio + i * 0.085;
      [1, 2.005].forEach(function (parcial, j) {
        const osc = ctx.createOscillator();
        const ganho = ctx.createGain();
        osc.type = j === 0 ? 'triangle' : 'sine';
        osc.frequency.value = frequencia * parcial;
        const pico = (j === 0 ? 0.28 : 0.09) * (i === notas.length - 1 ? 1.15 : 1);
        ganho.gain.setValueAtTime(0.0001, t);
        ganho.gain.exponentialRampToValueAtTime(pico, t + 0.012);
        ganho.gain.exponentialRampToValueAtTime(0.0001, t + (i === notas.length - 1 ? 0.7 : 0.28));
        osc.connect(ganho);
        ganho.connect(saida);
        osc.start(t);
        osc.stop(t + 0.75);
      });
    });
  }

  function ligado() {
    if (silenciado) return false;
    try {
      return OP.prefs.aparencia().som !== 'nao';
    } catch (erro) {
      return true;
    }
  }

  /** Toca a rolagem; natural20 acrescenta o arpejo. Devolve true se tocou. */
  function tocar(natural20) {
    if (!ligado()) return false;
    const ctx = criarContexto();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        const retomado = ctx.resume();
        if (retomado && typeof retomado.catch === 'function') retomado.catch(function () {});
      }
      const mestre = ctx.createGain();
      mestre.gain.value = 0.95;
      mestre.connect(ctx.destination);
      const inicio = ctx.currentTime + 0.01;
      const duracao = chacoalhar(ctx, mestre, inicio);
      if (natural20 === true) arpejo(ctx, mestre, inicio + duracao + 0.04);
      return true;
    } catch (erro) {
      return false;
    }
  }

  /** Som certo para um resultado de rolagem: 20 natural (o d20 escolhido) ou rolagem comum. */
  function tocarResultado(resultado) {
    if (!resultado || resultado.ok === false) return false;
    const natural20 = resultado.tipo === 'teste' && resultado.escolhido === 20;
    return tocar(natural20);
  }

  function silenciar(valor) {
    silenciado = valor === true;
  }

  OP.som = {
    tocar: tocar,
    tocarResultado: tocarResultado,
    silenciar: silenciar
  };
})(window.OP);
