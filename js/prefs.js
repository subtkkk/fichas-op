/* ==========================================================================
   js/prefs.js — preferências do navegador (OP.prefs)
   --------------------------------------------------------------------------
   Ficam fora da ficha (não vão para exportar/importar), na chave
   "op_prefs" do OP.storage: { fontes: { livro: true, SaH: false, ... } }.
   Fontes desligadas escondem origens e trilhas daquela fonte nos selects
   (a escolhida nunca some). Padrão: todas ligadas.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const CHAVE = 'op_prefs';
  const ouvintes = [];

  function ehObjeto(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
  }

  /** Preferências salvas, completas e validadas (só fontes conhecidas, valores booleanos). */
  function ler() {
    let salvo = null;
    try {
      salvo = JSON.parse(OP.storage.ler(CHAVE) || 'null');
    } catch (erro) {
      salvo = null;
    }
    const fontesSalvas = ehObjeto(salvo) && ehObjeto(salvo.fontes) ? salvo.fontes : {};
    const fontes = {};
    Object.keys(OP.data.fontes).forEach(function (id) {
      fontes[id] = Object.prototype.hasOwnProperty.call(fontesSalvas, id) ? fontesSalvas[id] !== false : true;
    });
    return { fontes: fontes };
  }

  function gravar(prefs) {
    return OP.storage.gravar(CHAVE, JSON.stringify(prefs));
  }

  /** { idFonte: true/false } para todas as fontes de OP.data.fontes. */
  function fontesAtivas() {
    return ler().fontes;
  }

  /** A fonte está ligada? Fonte desconhecida conta como ligada. */
  function fonteAtiva(id) {
    const fontes = fontesAtivas();
    return Object.prototype.hasOwnProperty.call(fontes, id) ? fontes[id] : true;
  }

  /** Liga ou desliga uma fonte e avisa quem estiver ouvindo. */
  function definirFonte(id, ligada) {
    if (!Object.prototype.hasOwnProperty.call(OP.data.fontes, id)) return false;
    const prefs = ler();
    prefs.fontes[id] = ligada === true;
    const ok = gravar(prefs);
    ouvintes.forEach(function (funcao) { funcao(prefs); });
    return ok;
  }

  /** fn(prefs) a cada mudança nas preferências. */
  function aoMudar(funcao) {
    ouvintes.push(funcao);
  }

  OP.prefs = {
    CHAVE: CHAVE,
    ler: ler,
    fontesAtivas: fontesAtivas,
    fonteAtiva: fonteAtiva,
    definirFonte: definirFonte,
    aoMudar: aoMudar
  };
})(window.OP);
