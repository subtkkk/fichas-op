/* ==========================================================================
   js/ui-fichas.js — barra superior, janela "Fichas", importar/exportar,
   impressão e avisos de salvamento
   --------------------------------------------------------------------------
   Dados das fichas (nomes etc.) só entram na página por textContent,
   .value ou setAttribute — nunca por innerHTML: arquivos importados não
   são confiáveis. Confirmações usam <dialog> (OP.ui.confirmar), nunca
   window.confirm.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const LIMITE_ARQUIVO = 2 * 1024 * 1024; // 2 MB
  const refs = {};

  /* ------------------------------------------------------------------------
     Utilitários
     ------------------------------------------------------------------------ */

  /** Cria um elemento com classe e texto (sempre por textContent). */
  function criar(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined && texto !== null && texto !== '') elemento.textContent = String(texto);
    return elemento;
  }

  function doisDigitos(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function hora(data) {
    return doisDigitos(data.getHours()) + ':' + doisDigitos(data.getMinutes());
  }

  function dataCurta(data) {
    return doisDigitos(data.getDate()) + '/' + doisDigitos(data.getMonth() + 1) + '/' + data.getFullYear();
  }

  function mesmoDia(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function nomeClasse(id) {
    const classe = OP.calc.classeDados(id);
    return classe ? classe.nome : 'Sem classe';
  }

  function nomeExibido(nome) {
    const texto = String(nome || '').trim();
    return texto || 'Sem nome';
  }

  /** "Ocultista · NEX 5%" (Sobrevivente: "Sobrevivente · Estágio 2"). */
  function resumoClasseNex(classe, nex, estagio) {
    const dados = OP.calc.classeDados(classe);
    if (dados && dados.unidadeProgressao === 'estagio') return dados.nome + ' · Estágio ' + (Number(estagio) || 1);
    return nomeClasse(classe) + ' · NEX ' + (Number(nex) || 0) + '%';
  }

  /** Baixa um texto como arquivo (Blob + <a download>; funciona em file://). */
  function baixar(nomeArquivo, texto) {
    try {
      const blob = new Blob([texto], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (erro) {
      return false;
    }
  }

  /** Mensagem dentro da janela "Fichas": tipo "ok", "aviso" ou "erro". */
  function mostrarMensagem(tipo, texto) {
    refs.mensagem.hidden = !texto;
    refs.mensagem.dataset.tipo = tipo;
    refs.mensagem.textContent = texto || '';
  }

  /* ------------------------------------------------------------------------
     Barra superior: nome da ficha e indicador de salvamento
     ------------------------------------------------------------------------ */

  function desenharNomeAtual(ficha) {
    const nome = nomeExibido(ficha && ficha.identificacao && ficha.identificacao.nome);
    if (refs.nome.textContent !== nome) refs.nome.textContent = nome;
  }

  /** "Salvo às HH:MM" / "Salvando…" / "Não salvo" e o aviso vermelho de falha. */
  function mostrarStatus(status) {
    let texto;
    let estado;
    if (status.estado === 'pendente') {
      texto = 'Salvando…';
      estado = 'pendente';
    } else if (status.estado === 'falha') {
      texto = 'Não salvo';
      estado = 'falha';
    } else if (status.quando) {
      texto = mesmoDia(status.quando, new Date())
        ? 'Salvo às ' + hora(status.quando)
        : 'Salvo em ' + dataCurta(status.quando);
      estado = 'ok';
    } else {
      texto = 'Salvo neste navegador';
      estado = 'ok';
    }
    if (refs.status.textContent !== texto) refs.status.textContent = texto;
    refs.status.dataset.estado = estado;
    // O aviso fica até uma gravação dar certo (mesmo enquanto digita).
    refs.faixaFalha.hidden = !status.falhou;
  }

  /* ------------------------------------------------------------------------
     Janela "Fichas"
     ------------------------------------------------------------------------ */

  const ACOES_LINHA = [
    { id: 'abrir', rotulo: 'Abrir' },
    { id: 'duplicar', rotulo: 'Duplicar' },
    { id: 'exportar', rotulo: 'Exportar' },
    { id: 'excluir', rotulo: 'Excluir' }
  ];

  function criarLinha(linha, aberta) {
    const nome = nomeExibido(linha.nome);
    const item = criar('li', 'ficha-linha' + (aberta ? ' ficha-linha--atual' : ''));

    const info = criar('div', 'ficha-linha__info');
    const titulo = criar('p', 'ficha-linha__titulo');
    titulo.appendChild(criar('span', 'ficha-linha__nome', nome));
    if (aberta) titulo.appendChild(criar('span', 'ficha-linha__selo', 'aberta'));
    info.appendChild(titulo);
    const data = new Date(linha.atualizadoEm);
    const quando = Number.isFinite(data.getTime()) ? ' · ' + dataCurta(data) + ' ' + hora(data) : '';
    info.appendChild(criar('p', 'ficha-linha__meta', resumoClasseNex(linha.classe, linha.nex, linha.estagio) + quando));
    item.appendChild(info);

    const acoes = criar('div', 'ficha-linha__acoes');
    ACOES_LINHA.forEach(function (acao) {
      const botao = criar('button', 'botao-barra botao-barra--pequeno' + (acao.id === 'excluir' ? ' botao-barra--perigo' : ''), acao.rotulo);
      botao.type = 'button';
      botao.setAttribute('data-ficha-acao', acao.id);
      botao.setAttribute('data-ficha-id', linha.id);
      botao.setAttribute('aria-label', acao.rotulo + ' a ficha ' + nome);
      if (acao.id === 'abrir' && aberta) botao.disabled = true;
      acoes.appendChild(botao);
    });
    item.appendChild(acoes);
    return item;
  }

  function desenharLista() {
    const aberta = OP.fichas.idAtual();
    const linhas = OP.fichas.listar();
    const itens = linhas.map(function (linha) { return criarLinha(linha, linha.id === aberta); });
    if (!itens.length) itens.push(criar('li', 'fichas__vazio', 'Nenhuma ficha salva neste navegador.'));
    refs.lista.textContent = '';
    itens.forEach(function (item) { refs.lista.appendChild(item); });
    refs.contagem.textContent = linhas.length === 1 ? '1 ficha' : linhas.length + ' fichas';
  }

  function abrirDialogo() {
    OP.fichas.salvarPendente(); // a lista mostra a data e o nome mais recentes
    mostrarMensagem('ok', '');
    desenharLista();
    if (!refs.dialogo.open) refs.dialogo.showModal();
  }

  function fecharDialogo() {
    if (refs.dialogo.open) refs.dialogo.close();
  }

  function novaFicha() {
    const id = OP.fichas.criar();
    const resultado = OP.fichas.abrir(id);
    if (!resultado.ok) {
      desenharLista();
      mostrarMensagem('erro', resultado.erro);
      return;
    }
    fecharDialogo();
    const campoNome = document.getElementById('campo-nome');
    if (campoNome) campoNome.focus();
  }

  function abrirFicha(id) {
    const resultado = OP.fichas.abrir(id);
    if (!resultado.ok) {
      mostrarMensagem('erro', resultado.erro);
      return;
    }
    fecharDialogo();
  }

  function duplicarFicha(id) {
    const novo = OP.fichas.duplicar(id);
    desenharLista();
    if (!novo) {
      mostrarMensagem('erro', 'Não foi possível duplicar esta ficha.');
      return;
    }
    const copia = OP.fichas.listar().find(function (linha) { return linha.id === novo; });
    mostrarMensagem('ok', 'Cópia criada: ' + nomeExibido(copia && copia.nome) + '.');
  }

  function exportarFicha(id) {
    const texto = OP.fichas.exportarTexto(id);
    if (texto === null) {
      mostrarMensagem('erro', 'Não foi possível ler esta ficha para exportar.');
      return;
    }
    const ficha = id === OP.fichas.idAtual() ? OP.state.ficha : OP.fichas.ler(id);
    if (!baixar(OP.fichas.nomeArquivoFicha(ficha), texto)) mostrarMensagem('erro', 'O navegador não deixou baixar o arquivo.');
  }

  function excluirFicha(id) {
    const linha = OP.fichas.listar().find(function (l) { return l.id === id; });
    const nome = nomeExibido(linha && linha.nome);
    OP.ui.confirmar({
      titulo: 'Excluir ficha',
      texto: 'Excluir "' + nome + '"? Não dá para desfazer. Para guardar uma cópia, use Exportar antes.',
      textoConfirmar: 'Excluir',
      perigo: true,
      aoConfirmar: function () {
        const eraAberta = id === OP.fichas.idAtual();
        OP.fichas.excluir(id);
        desenharLista();
        mostrarMensagem('ok', 'Ficha "' + nome + '" excluída.' + (eraAberta ? ' Outra ficha foi aberta.' : ''));
      }
    });
  }

  function baixarBackup() {
    const texto = OP.fichas.backupTexto();
    if (!baixar(OP.fichas.nomeArquivoBackup(new Date()), texto)) {
      if (refs.dialogo.open) mostrarMensagem('erro', 'O navegador não deixou baixar o arquivo.');
    }
  }

  /** Cliques dentro da janela (delegados). */
  function aoClicarDialogo(evento) {
    // Clique no fundo escurecido (fora do conteúdo) fecha a janela.
    if (evento.target === refs.dialogo) {
      fecharDialogo();
      return;
    }
    if (evento.target.closest('[data-fechar-fichas]')) {
      fecharDialogo();
      return;
    }
    const acaoTopo = evento.target.closest('[data-acao-fichas]');
    if (acaoTopo) {
      const acao = acaoTopo.getAttribute('data-acao-fichas');
      if (acao === 'nova') novaFicha();
      if (acao === 'importar') refs.arquivo.click();
      if (acao === 'backup') baixarBackup();
      return;
    }
    const botao = evento.target.closest('[data-ficha-acao]');
    if (!botao) return;
    const id = botao.getAttribute('data-ficha-id');
    const acao = botao.getAttribute('data-ficha-acao');
    if (acao === 'abrir') abrirFicha(id);
    if (acao === 'duplicar') duplicarFicha(id);
    if (acao === 'exportar') exportarFicha(id);
    if (acao === 'excluir') excluirFicha(id);
  }

  /* ------------------------------------------------------------------------
     Importar (botão ou arrastar e soltar)
     ------------------------------------------------------------------------ */

  function resumoFicha(ficha) {
    return nomeExibido(ficha.identificacao.nome) + ' — ' +
      resumoClasseNex(ficha.identificacao.classe, ficha.identificacao.nex, ficha.identificacao.estagio);
  }

  /** Mostra o resumo e só grava depois da confirmação. Importar SEMPRE cria fichas novas. */
  function confirmarImportacao(resultado) {
    const total = resultado.fichas.length;
    OP.ui.confirmar({
      titulo: total === 1 ? 'Importar ficha' : 'Importar ' + total + ' fichas',
      texto: (total === 1 ? 'A ficha abaixo entra como nova' : 'As fichas abaixo entram como novas') +
        '; nenhuma ficha existente é alterada.',
      itens: resultado.fichas.map(resumoFicha),
      avisos: resultado.avisos,
      textoConfirmar: 'Importar',
      aoConfirmar: function () {
        const gravacao = OP.fichas.importar(resultado.fichas);
        desenharLista();
        const quantas = gravacao.ids.length === 1 ? '1 ficha importada' : gravacao.ids.length + ' fichas importadas';
        mostrarMensagem(gravacao.ok ? 'ok' : 'aviso', gravacao.ok
          ? quantas + '. Use "Abrir" para ver.'
          : quantas + ', mas o navegador não conseguiu salvar: exporte um backup antes de fechar a página.');
      }
    });
  }

  function importarArquivo(arquivo) {
    if (!arquivo) return;
    if (!refs.dialogo.open) abrirDialogo();
    if (arquivo.size > LIMITE_ARQUIVO) {
      mostrarMensagem('erro', 'O arquivo passa de 2 MB e não foi importado.');
      return;
    }
    mostrarMensagem('ok', 'Lendo o arquivo…');
    const leitor = new FileReader();
    leitor.onload = function () {
      const resultado = OP.state.lerImportacao(typeof leitor.result === 'string' ? leitor.result : '');
      if (!resultado.ok) {
        mostrarMensagem('erro', 'Não foi possível importar: ' + resultado.erro);
        return;
      }
      mostrarMensagem('ok', '');
      confirmarImportacao(resultado);
    };
    leitor.onerror = function () {
      mostrarMensagem('erro', 'Não foi possível ler o arquivo.');
    };
    leitor.readAsText(arquivo);
  }

  function temArquivos(evento) {
    const tipos = evento.dataTransfer && evento.dataTransfer.types;
    return Boolean(tipos) && Array.prototype.indexOf.call(tipos, 'Files') !== -1;
  }

  /** Arrastar um .json para a página (ou para a janela) importa. */
  function ligarArrastar() {
    document.addEventListener('dragover', function (evento) {
      if (!temArquivos(evento)) return;
      evento.preventDefault();
      evento.dataTransfer.dropEffect = 'copy';
      document.body.classList.add('arrastando-arquivo');
    });
    document.addEventListener('dragleave', function (evento) {
      if (evento.relatedTarget === null) document.body.classList.remove('arrastando-arquivo');
    });
    document.addEventListener('drop', function (evento) {
      document.body.classList.remove('arrastando-arquivo');
      if (!temArquivos(evento)) return;
      evento.preventDefault();
      importarArquivo(evento.dataTransfer.files && evento.dataTransfer.files[0]);
    });
  }

  /* ------------------------------------------------------------------------
     Outra aba e impressão
     ------------------------------------------------------------------------ */

  /** Avisa (nunca recarrega sozinho) quando a ficha aberta muda em outra aba. */
  function aoAlterarFora(tipo) {
    if (tipo === 'ficha') refs.faixaOutraAba.hidden = false;
    if (refs.dialogo.open) desenharLista();
  }

  function recarregar() {
    OP.fichas.recarregarAtual();
    refs.faixaOutraAba.hidden = true;
  }

  function imprimir() {
    fecharDialogo();
    window.print();
  }

  /* ------------------------------------------------------------------------
     Montagem
     ------------------------------------------------------------------------ */

  function montar() {
    refs.nome = document.getElementById('nome-ficha-atual');
    refs.status = document.getElementById('status-salvamento');
    refs.faixaFalha = document.getElementById('faixa-falha-salvamento');
    refs.faixaOutraAba = document.getElementById('faixa-outra-aba');
    refs.dialogo = document.getElementById('dialogo-fichas');
    refs.lista = document.getElementById('lista-fichas');
    refs.contagem = document.getElementById('fichas-contagem');
    refs.mensagem = document.getElementById('fichas-mensagem');
    refs.arquivo = document.getElementById('importar-arquivo');

    document.getElementById('botao-fichas').addEventListener('click', abrirDialogo);
    document.getElementById('botao-imprimir').addEventListener('click', imprimir);
    document.getElementById('botao-backup-agora').addEventListener('click', baixarBackup);
    document.getElementById('botao-recarregar-ficha').addEventListener('click', recarregar);
    refs.dialogo.addEventListener('click', aoClicarDialogo);
    refs.arquivo.addEventListener('change', function () {
      const arquivo = refs.arquivo.files && refs.arquivo.files[0];
      refs.arquivo.value = ''; // permite escolher o mesmo arquivo de novo
      importarArquivo(arquivo);
    });
    ligarArrastar();

    OP.fichas.aoMudarStatus(mostrarStatus);
    OP.fichas.aoAlterarFora(aoAlterarFora);
    OP.state.aoMudar(desenharNomeAtual);
    desenharNomeAtual(OP.state.ficha);
    mostrarStatus(OP.fichas.status());
  }

  OP.uiFichas = {
    montar: montar,
    abrirDialogo: abrirDialogo
  };
})(window.OP);
