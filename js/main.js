/* ==========================================================================
   js/main.js — inicialização e ciclo de atualização
   --------------------------------------------------------------------------
   Ciclo: OP.state.atualizar() → corrige limites → recalcula (calc)
          → redesenha (ui) → agenda o salvamento (fichas, 400 ms).
   Telas: Central de operações, Arquivo e Ficha (js/ui-app.js, pelo #hash).
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
   * só salva se precisou corrigir algo — e nunca o rascunho em branco
   * (sem fichas salvas), que só entra no arquivo quando for editado.
   */
  function aoMudarFicha(ficha, caminho) {
    const corrigiu = redesenhar(ficha);
    if (caminho === '*' && OP.fichas.ehRascunho()) return;
    if (caminho !== '*' || corrigiu) OP.fichas.agendarSalvamento();
  }

  function iniciar() {
    // Abre a ficha atual (ou migra a da Etapa 1). Sem nenhuma ficha salva,
    // fica um rascunho em branco e a Central mostra o estado vazio.
    OP.fichas.iniciar({ criarSeVazio: false });
    OP.ui.montar();
    OP.uiFichas.montar();
    OP.uiClasse.montar();  // origem, classe, trilha e progressão (entra no ciclo de desenho do ui.js)
    OP.uiDossie.montar();  // capa, vitais e tema (também no ciclo de desenho)
    OP.uiPaginas.montar(); // abas (computador), índice e setas (celular)
    OP.uiSeletor.montar(); // listas de escolha com o painel do dossiê no lugar da nativa
    OP.uiCondicoes.montar();   // condições, estados e descanso
    OP.uiBiografia.montar();   // retrato, aliados, rivais e diário
    OP.uiVerificacoes.montar(); // painel de verificações
    OP.uiAparencia.montar();   // tema, tamanho do texto, animações, Sobre e ajuda de teclado
    OP.uiRegras.montar();      // regras opcionais (por ficha): Jogando sem Sanidade
    OP.state.aoMudar(aoMudarFicha);
    const corrigiu = redesenhar(OP.state.ficha);
    // Se a ficha salva tinha valores fora dos limites, já grava a versão corrigida.
    if (corrigiu && !OP.fichas.ehRascunho()) OP.fichas.salvarAtual();
    OP.uiApp.montar();     // lê o #hash e mostra a tela certa
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
