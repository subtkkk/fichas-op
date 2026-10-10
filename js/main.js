/* ==========================================================================
   js/main.js — inicialização e ciclo de atualização
   --------------------------------------------------------------------------
   Ciclo: OP.state.atualizar() → corrige limites → recalcula (calc)
          → redesenha (ui) → agenda o salvamento (fichas, 400 ms).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  /**
   * Aplica as correções que o calc.js indicar (ex.: atual acima do novo máximo,
   * atributo de perícia inválido). Grava em modo silencioso para não disparar
   * o ciclo de novo. Devolve true se algo mudou.
   */
  function aplicarCorrecoes(ficha) {
    const correcoes = OP.calc.correcoes(ficha);
    correcoes.forEach(function (correcao) {
      OP.state.atualizar(correcao.caminho, correcao.valor, { silencioso: true });
    });
    return correcoes.length > 0;
  }

  /** Corrige limites, recalcula os valores derivados e redesenha a tela. */
  function redesenhar(ficha) {
    const corrigiu = aplicarCorrecoes(ficha);
    OP.ui.desenhar(ficha, OP.calc.calcularTudo(ficha));
    return corrigiu;
  }

  /**
   * Chamado pelo estado a cada mudança na ficha.
   * Trocar a ficha inteira (caminho "*": abrir, recarregar) não é edição:
   * só salva se precisou corrigir algo.
   */
  function aoMudarFicha(ficha, caminho) {
    const corrigiu = redesenhar(ficha);
    if (caminho !== '*' || corrigiu) OP.fichas.agendarSalvamento();
  }

  function iniciar() {
    OP.fichas.iniciar();   // abre a ficha atual (ou migra a da Etapa 1, ou cria uma)
    OP.ui.montar();
    OP.uiFichas.montar();
    OP.uiClasse.montar();  // origem, classe, trilha e progressão (entra no ciclo de desenho do ui.js)
    OP.state.aoMudar(aoMudarFicha);
    const corrigiu = redesenhar(OP.state.ficha);
    // Se a ficha salva tinha valores fora dos limites, já grava a versão corrigida.
    if (corrigiu) OP.fichas.salvarAtual();
  }

  OP.app = {
    iniciar: iniciar,
    redesenhar: redesenhar
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window.OP);
