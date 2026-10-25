/* ==========================================================================
   js/ui-nuvem.js — telas da nuvem (OP.uiNuvem)
   --------------------------------------------------------------------------
   - Conta: a chave "Salvar minhas fichas na conta", o estado da sincronia e
     o botão "Sincronizar agora".
   - Compartilhar (botão na página Agente): liga/desliga o link da ficha,
     escolhe "só visualizar" ou "visualizar e editar", copia o link e gera um
     novo.
   - Faixa no alto quando a ficha na tela veio de um link: de quem é, se dá
     para editar, "Entrar para editar", "Salvar uma cópia" e "Sair".
   - Modo "só visualizar": os campos da ficha ficam desativados (o estado
     também recusa qualquer mudança: ver OP.state.definirSomenteLeitura).
   Aqui só tem tela; a lógica fica em js/nuvem.js. Tudo por textContent.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const desativados = new Set(); // campos que este módulo desativou no modo "só visualizar"
  let pedidoAtual = 0;           // descarta respostas atrasadas do diálogo Compartilhar

  function definirTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  function conta() {
    return OP.conta.estado;
  }

  function horaDe(data) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /* ------------------------------------------------------------------------
     Conta: fichas na conta
     ------------------------------------------------------------------------ */

  function textoDaSincronia(e) {
    if (!e.ativo) return 'Desligado: as fichas ficam só neste navegador.';
    if (e.sincronizando) return 'Sincronizando…';
    if (e.erro) return 'Não foi possível sincronizar: ' + e.erro;
    return e.ultimo ? 'Tudo sincronizado às ' + horaDe(e.ultimo) + '.' : 'Aguardando a primeira sincronização.';
  }

  function desenharConta() {
    if (!refs.secaoNuvem) return;
    const c = conta();
    const conectado = Boolean(c && c.conectado);
    refs.secaoNuvem.hidden = !(conectado && c.nuvem);
    refs.nuvemIndisponivel.hidden = !(conectado && !c.nuvem);
    if (!conectado || !c.nuvem) return;
    const e = OP.nuvem.estado;
    if (refs.nuvemAtivo.checked !== e.ativo) refs.nuvemAtivo.checked = e.ativo;
    definirTexto(refs.nuvemStatus, textoDaSincronia(e));
    refs.nuvemAgora.disabled = !e.ativo || e.sincronizando;
  }

  /* ------------------------------------------------------------------------
     Compartilhar
     ------------------------------------------------------------------------ */

  function mostrarAviso(texto) {
    refs.aviso.hidden = !texto;
    refs.aviso.textContent = texto || '';
  }

  /** Por que ainda não dá para compartilhar (ou '' se dá). acao: o que o botão faz. */
  function bloqueioDoCompartilhar() {
    const c = conta();
    if (OP.fichas.ehRascunho()) return { texto: 'Esta ficha em branco ainda não foi salva. Escreva algo nela primeiro.', acao: null };
    if (!c || !c.disponivel) return { texto: 'O compartilhamento por link precisa do servidor do site (não funciona com o arquivo aberto direto no computador).', acao: null };
    if (!c.conectado) return { texto: 'Para compartilhar, entre com o Discord: a ficha fica guardada na sua conta e o link abre ela de lá.', acao: 'conta', rotulo: 'Entrar com o Discord' };
    if (!c.nuvem) return { texto: 'As fichas na conta ainda não foram ativadas neste servidor. Quem administra o site precisa rodar o worker/schema.sql de novo no banco.', acao: null };
    if (!OP.nuvem.estado.ativo) return { texto: 'O link abre a ficha a partir da sua conta, e "Salvar minhas fichas na conta" está desligado.', acao: 'ligar', rotulo: 'Ligar e continuar' };
    return null;
  }

  function modoEscolhido() {
    return refs.modoEditar.checked ? 'editar' : 'ver';
  }

  function mostrarLink(link) {
    refs.ligado.checked = Boolean(link);
    refs.opcoes.hidden = !link;
    if (!link) return;
    refs.modoVer.checked = link.modo === 'ver';
    refs.modoEditar.checked = link.modo === 'editar';
    refs.link.value = link.url;
  }

  function ocupado(sim) {
    refs.ligado.disabled = sim;
    refs.modoVer.disabled = sim;
    refs.modoEditar.disabled = sim;
    refs.novo.disabled = sim;
    refs.copiar.disabled = sim;
  }

  /** Executa uma mudança no link (liga, troca o modo, gera novo, desliga) e redesenha com o resultado. */
  async function mudarLink(acao, mensagemSucesso) {
    const meu = ++pedidoAtual;
    mostrarAviso('Salvando…');
    ocupado(true);
    try {
      const link = await acao();
      if (meu !== pedidoAtual) return;
      mostrarLink(link);
      mostrarAviso(mensagemSucesso || '');
    } catch (erro) {
      if (meu !== pedidoAtual) return;
      mostrarAviso(erro && erro.message === 'sem-api' ? 'Sem conexão com o servidor. Tente de novo.' : (erro && erro.message) || 'Não foi possível concluir.');
      // volta ao que o servidor realmente tem
      try {
        mostrarLink(await OP.nuvem.lerLink(OP.fichas.idAtual()));
      } catch (outro) { /* fica como está */ }
    }
    if (meu === pedidoAtual) ocupado(false);
  }

  async function abrirCompartilhar() {
    const meu = ++pedidoAtual;
    mostrarAviso('');
    const bloqueio = bloqueioDoCompartilhar();
    refs.bloqueio.hidden = !bloqueio;
    refs.corpo.hidden = Boolean(bloqueio);
    OP.ui.abrirDialogo(refs.dialogo, refs.botao);
    if (bloqueio) {
      definirTexto(refs.bloqueioTexto, bloqueio.texto);
      refs.bloqueioBotao.hidden = !bloqueio.acao;
      definirTexto(refs.bloqueioBotao, bloqueio.rotulo || '');
      refs.bloqueioBotao.dataset.acao = bloqueio.acao || '';
      return;
    }
    const ficha = OP.state.ficha;
    definirTexto(refs.nome, String(ficha.identificacao.nome || '').trim() || 'sem nome');
    refs.opcoes.hidden = true;
    ocupado(true);
    mostrarAviso('Conferindo a conta…');
    try {
      await OP.nuvem.sincronizar(); // a ficha precisa estar na conta antes de ter link
      const link = await OP.nuvem.lerLink(ficha.id);
      if (meu !== pedidoAtual) return;
      mostrarLink(link);
      mostrarAviso('');
    } catch (erro) {
      if (meu !== pedidoAtual) return;
      mostrarAviso((erro && erro.message) || 'Não foi possível ler o link.');
    }
    if (meu === pedidoAtual) ocupado(false);
  }

  function aoLigar() {
    const id = OP.fichas.idAtual();
    if (refs.ligado.checked) {
      mudarLink(function () { return OP.nuvem.definirLink(id, modoEscolhido(), false); }, 'Link criado. Copie e mande para quem quiser.');
    } else {
      mudarLink(async function () { await OP.nuvem.pararLink(id); return null; }, 'Link desligado: quem o tinha não abre mais a ficha.');
    }
  }

  function aoTrocarModo() {
    const id = OP.fichas.idAtual();
    mudarLink(function () { return OP.nuvem.definirLink(id, modoEscolhido(), false); },
      modoEscolhido() === 'editar' ? 'Agora quem abrir o link pode editar (entrando com o Discord).' : 'Agora o link é só para visualizar.');
  }

  function aoGerarNovo() {
    const id = OP.fichas.idAtual();
    const abriu = OP.ui.confirmar({
      titulo: 'Gerar um link novo?',
      texto: 'O link atual para de funcionar para todo mundo que o recebeu. Você terá de mandar o novo.',
      textoConfirmar: 'Gerar link novo',
      perigo: true,
      aoConfirmar: function () {
        mudarLink(function () { return OP.nuvem.definirLink(id, modoEscolhido(), true); }, 'Link novo criado. O anterior não funciona mais.');
      }
    });
    if (!abriu) refs.novo.focus();
  }

  async function copiarLink() {
    const texto = refs.link.value;
    if (!texto) return;
    let copiou = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
        copiou = true;
      }
    } catch (erro) { /* tenta o jeito antigo */ }
    if (!copiou) {
      refs.link.select();
      try { copiou = document.execCommand('copy'); } catch (erro) { copiou = false; }
    }
    mostrarAviso(copiou ? 'Link copiado.' : 'Não deu para copiar sozinho: selecione o link e copie.');
    if (!copiou) refs.link.select();
  }

  function aoBloqueio() {
    const acao = refs.bloqueioBotao.dataset.acao;
    if (acao === 'conta') {
      refs.dialogo.close();
      OP.conta.abrir();
    } else if (acao === 'ligar') {
      OP.nuvem.definirAtivo(true);
      abrirCompartilharDeNovo();
    }
  }

  function abrirCompartilharDeNovo() {
    refs.dialogo.close();
    abrirCompartilhar();
  }

  /* ------------------------------------------------------------------------
     Faixa da ficha de link e modo "só visualizar"
     ------------------------------------------------------------------------ */

  function desenharFaixa() {
    const e = OP.nuvem.estado.externa;
    document.body.dataset.externa = e ? 'sim' : 'nao';
    refs.faixa.hidden = !e;
    if (!e) return;
    const conectado = Boolean(conta() && conta().conectado);
    definirTexto(refs.faixaTitulo, 'Ficha de ' + e.dono + '.');
    let detalhe;
    if (e.editavel) detalhe = 'Você pode editar: o que mudar vai para a ficha do dono.';
    else if (e.modo === 'editar' && !conectado) detalhe = 'O dono liberou a edição. Entre com o Discord para editar.';
    else detalhe = 'Somente visualização: o dono não liberou a edição.';
    definirTexto(refs.faixaDetalhe, detalhe);
    refs.faixaEntrar.hidden = !(e.modo === 'editar' && !conectado && Boolean(conta() && conta().disponivel));
  }

  /** Desativa (ou devolve) os campos da ficha conforme o modo "só visualizar". */
  function aplicarSomenteLeitura() {
    const ligado = OP.state.somenteLeitura();
    document.body.dataset.somenteLeitura = ligado ? 'sim' : 'nao';
    if (!ligado) {
      desativados.forEach(function (campo) { campo.disabled = false; });
      desativados.clear();
      return;
    }
    desativados.forEach(function (campo) { if (!campo.isConnected) desativados.delete(campo); });
    document.querySelectorAll('#ficha input, #ficha select, #ficha textarea').forEach(function (campo) {
      if (campo.disabled || campo.type === 'search' || campo.closest('[data-leitura-ok]')) return;
      campo.disabled = true;
      desativados.add(campo);
    });
  }

  function aoMudarNuvem() {
    desenharConta();
    desenharFaixa();
    aplicarSomenteLeitura();
    if (OP.fichas.ehExterna()) OP.fichas.reemitirStatus(); // o indicador de salvamento depende do link
  }

  function salvarCopia() {
    const id = OP.state.ficha.id;
    const novo = OP.fichas.duplicar(id);
    if (!novo) {
      OP.uiApp.aviso('erro', 'Não foi possível salvar a cópia.');
      return;
    }
    OP.uiApp.aviso('ok', 'Cópia salva no seu arquivo.', {
      acao: { rotulo: 'Abrir', fazer: function () { OP.uiApp.irPara('ficha', novo); } }
    });
  }

  /* ------------------------------------------------------------------------
     Montagem
     ------------------------------------------------------------------------ */

  function montar() {
    refs.secaoNuvem = document.getElementById('conta-nuvem');
    refs.nuvemIndisponivel = document.getElementById('conta-nuvem-indisponivel');
    refs.nuvemAtivo = document.getElementById('conta-nuvem-ativo');
    refs.nuvemStatus = document.getElementById('conta-nuvem-status');
    refs.nuvemAgora = document.getElementById('conta-nuvem-agora');
    refs.botao = document.getElementById('botao-compartilhar');
    refs.dialogo = document.getElementById('dialogo-compartilhar');
    refs.bloqueio = document.getElementById('compartilhar-bloqueio');
    refs.bloqueioTexto = document.getElementById('compartilhar-bloqueio-texto');
    refs.bloqueioBotao = document.getElementById('compartilhar-abrir-conta');
    refs.corpo = document.getElementById('compartilhar-corpo');
    refs.nome = document.getElementById('compartilhar-nome');
    refs.ligado = document.getElementById('compartilhar-ligado');
    refs.opcoes = document.getElementById('compartilhar-opcoes');
    refs.modoVer = document.getElementById('compartilhar-modo-ver');
    refs.modoEditar = document.getElementById('compartilhar-modo-editar');
    refs.link = document.getElementById('compartilhar-link');
    refs.copiar = document.getElementById('compartilhar-copiar');
    refs.novo = document.getElementById('compartilhar-novo');
    refs.aviso = document.getElementById('compartilhar-aviso');
    refs.faixa = document.getElementById('faixa-compartilhada');
    refs.faixaTitulo = document.getElementById('faixa-compartilhada-titulo');
    refs.faixaDetalhe = document.getElementById('faixa-compartilhada-detalhe');
    refs.faixaEntrar = document.getElementById('faixa-compartilhada-entrar');
    if (!refs.dialogo || !refs.botao || !refs.faixa || !refs.secaoNuvem) return;

    refs.nuvemAtivo.addEventListener('change', function () { OP.nuvem.definirAtivo(refs.nuvemAtivo.checked); });
    refs.nuvemAgora.addEventListener('click', function () { OP.nuvem.sincronizar(); });

    refs.botao.addEventListener('click', abrirCompartilhar);
    refs.ligado.addEventListener('change', aoLigar);
    refs.modoVer.addEventListener('change', aoTrocarModo);
    refs.modoEditar.addEventListener('change', aoTrocarModo);
    refs.copiar.addEventListener('click', copiarLink);
    refs.novo.addEventListener('click', aoGerarNovo);
    refs.bloqueioBotao.addEventListener('click', aoBloqueio);
    refs.link.addEventListener('focus', function () { refs.link.select(); });
    refs.dialogo.addEventListener('click', function (evento) {
      if (evento.target === refs.dialogo || evento.target.closest('[data-fechar-dialogo]')) refs.dialogo.close();
    });
    refs.dialogo.addEventListener('close', function () { pedidoAtual += 1; });

    refs.faixaEntrar.addEventListener('click', function () { OP.conta.abrir(); });
    document.getElementById('faixa-compartilhada-copia').addEventListener('click', salvarCopia);
    document.getElementById('faixa-compartilhada-sair').addEventListener('click', function () { OP.uiApp.irPara('central'); });

    OP.nuvem.aoMudar(aoMudarNuvem);
    OP.ui.registrarExtensao({ desenhar: aplicarSomenteLeitura });
    aoMudarNuvem();
  }

  OP.uiNuvem = { montar: montar, abrirCompartilhar: abrirCompartilhar };
})(window.OP);
