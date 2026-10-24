/* ==========================================================================
   js/exportar-md.js — resumo da ficha em Markdown (OP.exportarMd)
   --------------------------------------------------------------------------
   Gera um texto .md legível, pensado como guia para montar a ficha física:
   identificação, atributos, vitais (com defesa, esquiva e bloqueio), perícias
   (treinamento, "outros" e total), origem, classe, trilha, habilidades,
   rituais e inventário. Os números vêm de OP.calc.calcularTudo (os mesmos da tela).
   O texto do livro (origem, trilha, habilidades, poderes e rituais) só entra com
   o acesso liberado (OP.livro.texto); sem ele, só nomes, números e o que a
   pessoa escreveu.
   Não altera a ficha nem toca na página; quem baixa o arquivo é o ui-fichas.js.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  function achar(lista, id) {
    return (lista || []).find(function (item) { return item.id === id; }) || null;
  }

  function texto(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
  }

  /** Célula de tabela: sem quebra de linha e sem barras que quebrariam as colunas. */
  function celula(valor) {
    const s = valor === null || valor === undefined ? '' : String(valor);
    return s.replace(/\r?\n+/g, ' ').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').trim() || '—';
  }

  function sinal(n) {
    const v = Number(n) || 0;
    return (v > 0 ? '+' : v < 0 ? '−' : '+') + Math.abs(v);
  }

  /** Bloco de texto livre da pessoa, como citação (mantém as quebras de linha). */
  function citacao(valor) {
    return texto(valor).split(/\r?\n/).map(function (linha) { return '> ' + linha; }).join('\n');
  }

  function tabela(cabecalho, linhas) {
    const saida = ['| ' + cabecalho.join(' | ') + ' |', '| ' + cabecalho.map(function () { return '---'; }).join(' | ') + ' |'];
    linhas.forEach(function (linha) { saida.push('| ' + linha.map(celula).join(' | ') + ' |'); });
    return saida.join('\n');
  }

  /** "Rótulo: valor" em item de lista; devolve null se o valor estiver vazio (para sumir). */
  function item(rotulo, valor) {
    const v = valor === null || valor === undefined ? '' : String(valor).trim();
    return v === '' ? null : '- **' + rotulo + ':** ' + v;
  }

  function lista(itens) {
    return itens.filter(function (x) { return x !== null; }).join('\n');
  }

  function secao(titulo, partes) {
    const corpo = partes.filter(function (p) { return p && String(p).trim() !== ''; });
    return corpo.length ? '## ' + titulo + '\n\n' + corpo.join('\n\n') : '';
  }

  function nomeNivel(ficha, calc) {
    const nex = calc.nex;
    if (nex.unidade === 'estagio') return 'Estágio ' + nex.nivel;
    if (OP.calc.regraNexNivel(ficha)) return 'Nível ' + OP.calc.nivelDoNex(nex.nivel) + ' (NEX ' + nex.nivel + '%)';
    return 'NEX ' + nex.nivel + '%';
  }

  /* ------------------------------------------------------------------------
     Seções
     ------------------------------------------------------------------------ */

  function secaoIdentificacao(ficha, calc) {
    const ident = ficha.identificacao || {};
    const id = calc.identidade;
    const origem = id.origemOutra ? texto(ident.origemTexto) : (id.origem ? id.origem.nome : '');
    const trilha = id.trilhaOutra ? texto(ident.trilhaTexto) : (id.trilha ? id.trilha.nome : '');
    const patente = achar(OP.data.patentes, calc.inventario.patente);
    return secao('Identificação', [lista([
      item('Jogador', ident.jogador),
      item('Origem', origem),
      item('Classe', id.classe ? id.classe.nome : ''),
      item('Trilha', trilha),
      item(id.unidade === 'estagio' ? 'Estágio' : 'Progressão', nomeNivel(ficha, calc)),
      item('Patente', patente ? patente.nome : ''),
      OP.calc.regraNexNivel(ficha) ? item('NEX (exposição)', ident.nex + '%') : null,
      ficha.config && ficha.config.semSanidade ? item('Regra opcional', 'Jogando sem Sanidade (PD no lugar de PE e SAN)') : null
    ])]);
  }

  function secaoAtributos(ficha, calc) {
    return secao('Atributos', [lista(OP.data.atributos.map(function (a) {
      return item(a.nome + ' (' + a.sigla + ')', calc.atributos[a.id]);
    }))]);
  }

  /** Soma escrita: "10 base + 1 AGI − 5 sobrecarga = 13" (os termos zerados ficam de fora). */
  function conta(termos, total) {
    let saida = '';
    termos.forEach(function (t) {
      const v = Number(t[0]) || 0;
      if (v === 0 && saida !== '') return;
      saida += saida === '' ? v + ' ' + t[1] : (v < 0 ? ' − ' : ' + ') + Math.abs(v) + ' ' + t[1];
    });
    return saida + ' = ' + total;
  }

  /** Vitais: PV, PE (ou PD) e SAN (máximo), mais Defesa, Esquiva e Bloqueio com a conta e o deslocamento. */
  function secaoVitais(ficha, calc) {
    const semSan = Boolean(ficha.config && ficha.config.semSanidade);
    const linhas = [];
    OP.data.recursos.forEach(function (definicao) {
      if (semSan && definicao.id === 'san') return;
      const r = calc.recursos[definicao.id];
      const rotulo = semSan && definicao.id === 'pe' ? 'Pontos de Determinação (PD)' : definicao.nome + ' (' + definicao.sigla + ')';
      linhas.push([rotulo, !r || r.max === null ? '—' : r.max]);
    });
    const d = calc.defesa;
    const atributoDefesa = achar(OP.data.atributos, d.atributo);
    const defesaConta = conta([[d.base, 'base'], [d.valorAtributo, atributoDefesa ? atributoDefesa.sigla : 'atributo'],
      [d.protecoesInventario, 'proteções'], [d.protecao, 'proteção'], [d.outros, 'outros'], [-d.sobrecarga, 'sobrecarga'],
      [d.condicoes, 'condições'], [d.efeitos, 'efeitos']], d.total);
    const reacoes = {};
    (OP.data.reacoes || []).forEach(function (reacao) { reacoes[reacao.id] = reacao; });
    function requisito(reacao) {
      const pericia = reacao && achar(OP.data.pericias, reacao.pericia);
      const grau = reacao && (OP.data.grausTreinamento[reacao.grauMinimo] || OP.data.grausTreinamento[1]);
      return reacao ? 'indisponível (requer ' + (pericia ? pericia.nome : reacao.pericia) + ' ' + grau.nome.toLowerCase() + ')' : 'indisponível';
    }
    const esquiva = d.esquiva || {};
    const bloqueio = d.bloqueio || {};
    const defesas = [
      ['Defesa', defesaConta, d.total],
      ['Esquiva', esquiva.disponivel ? d.total + ' Defesa ' + (esquiva.bonus < 0 ? '− ' : '+ ') + Math.abs(esquiva.bonus) + ' Reflexos = ' + esquiva.defesaComEsquiva : requisito(reacoes.esquiva),
        esquiva.disponivel ? esquiva.defesaComEsquiva : '—'],
      ['Bloqueio', bloqueio.disponivel ? 'bônus de Fortitude = ' + bloqueio.reducao + ' de dano reduzido' : requisito(reacoes.bloqueio),
        bloqueio.disponivel ? 'reduz ' + bloqueio.reducao : '—']
    ];
    const desl = calc.deslocamento;
    return secao('Vitais', [
      tabela(['Vital', 'Máximo'], linhas),
      lista([item('Limite de ' + (semSan ? 'PD' : 'PE') + ' por turno', calc.nex.limitePE)]),
      tabela(['Defesa', 'Cálculo', 'Valor'], defesas),
      d.totalCorpoACorpo !== d.total || d.totalDistancia !== d.total
        ? lista([item('Defesa corpo a corpo / à distância', d.totalCorpoACorpo + ' / ' + d.totalDistancia)]) : '',
      lista([item('Deslocamento', desl.metros + ' m (' + desl.quadrados + ' quadrados)')])
    ]);
  }

  /** Marcas das perícias na tabela (a legenda vem logo abaixo dela). */
  const MARCAS_PERICIA = [
    ['somenteTreinada', '🎓', 'só pode ser usada com treinamento'],
    ['penalidadeCarga', '🎒', 'sofre penalidade de carga'],
    ['kit', '🧰', 'precisa de um kit']
  ];

  function secaoPericias(ficha, calc) {
    const linhas = OP.data.pericias.map(function (definicao) {
      const e = calc.pericias[definicao.id];
      const salvo = (ficha.pericias && ficha.pericias[definicao.id]) || {};
      const grau = OP.data.grausTreinamento[e.grau] || OP.data.grausTreinamento[0];
      const atributo = achar(OP.data.atributos, e.atributo);
      const marcas = MARCAS_PERICIA.filter(function (m) { return definicao[m[0]] === true; }).map(function (m) { return m[1]; }).join(' ');
      const nome = definicao.nome + (definicao.aberta && texto(salvo.nomeAberto) ? ' (' + texto(salvo.nomeAberto) + ')' : '') + (marcas ? ' ' + marcas : '');
      return [nome, atributo ? atributo.sigla : '—', grau.nome + ' (' + sinal(grau.bonus) + ')', sinal(Number(salvo.outros) || 0), sinal(e.bonus)];
    });
    return secao('Perícias', [
      tabela(['Perícia', 'Atributo', 'Treinamento', 'Outros', 'Total'], linhas),
      MARCAS_PERICIA.map(function (m) { return m[1] + ' ' + m[2]; }).join(' · ') +
        '. Total = treinamento + outros (+ efeitos, alterações de NEX e penalidades que valem hoje).'
    ]);
  }

  /** Blocos {rotulo, texto} do texto do livro de uma chave; null se o texto não está liberado nesta conta. */
  function blocosDoLivro(chave) {
    const t = chave && OP.livro && OP.livro.texto(chave);
    if (!t) return null;
    if (OP.uiLivro && OP.uiLivro.blocosDoTexto) return OP.uiLivro.blocosDoTexto(t.corpo).blocos;
    return [{ rotulo: '', texto: t.corpo.trim() }];
  }

  /** Parágrafos "**Rótulo.** texto" (sem os rótulos em "ignorar"); '' se não há o que mostrar. */
  function blocosEmMd(blocos, ignorar) {
    return (blocos || []).filter(function (b) { return !ignorar || ignorar.indexOf(b.rotulo) === -1; })
      .map(function (b) { return (b.rotulo ? '**' + b.rotulo + '.** ' : '') + b.texto; }).join('\n\n');
  }

  /** Descrição do livro de um marco da trilha (só com o texto liberado nesta conta; '' sem acesso). */
  function descricaoDoMarco(idTrilha, marco) {
    const trilhas = (OP.data.catalogo && OP.data.catalogo.trilhas) || {};
    return blocosEmMd(blocosDoLivro(trilhas[idTrilha] && trilhas[idTrilha][String(marco)]));
  }

  function secaoClasseOrigemTrilha(ficha, calc) {
    const id = calc.identidade;
    const unidade = id.unidade;
    const partes = [];
    if (id.origem) {
      const origens = (OP.data.catalogo && OP.data.catalogo.origens) || {};
      // O texto da origem traz a descrição e o efeito do poder; o nome do poder e as perícias já estão listados
      const descricao = blocosEmMd(blocosDoLivro(origens[id.origem.id]), ['Poder da origem', 'Perícias treinadas']);
      partes.push(lista([item('Origem', id.origem.nome), item('Poder da origem', id.origem.habilidade)]) + (descricao ? '\n\n' + descricao : ''));
    }
    if (id.classe) partes.push(lista([item('Classe', id.classe.nome)]));
    function rotuloMarco(marco) {
      return unidade === 'estagio' ? 'Estágio ' + marco : 'NEX ' + marco + '%';
    }
    // Só entram os poderes de trilha já liberados (pelo NEX ou estágio); os bloqueados ficam de fora
    if (id.trilha) {
      const liberadas = id.habilidadesTrilha.filter(function (h) { return h.liberada; });
      const linhas = liberadas.map(function (h) { return [rotuloMarco(h.marco), h.nome]; });
      const descricoes = liberadas.map(function (h) {
        const d = descricaoDoMarco(id.trilha.id, h.marco);
        return d ? '#### ' + rotuloMarco(h.marco) + ' · ' + h.nome + '\n\n' + d : '';
      }).filter(Boolean);
      partes.push('### Trilha: ' + id.trilha.nome + (linhas.length ? '\n\n' + tabela(['Marco', 'Habilidade'], linhas) : '') +
        (descricoes.length ? '\n\n' + descricoes.join('\n\n') : ''));
    }
    if (id.versatilidade && id.versatilidade.liberada) {
      const v = id.versatilidade;
      const d = descricaoDoMarco(v.trilha, v.marco);
      partes.push(lista([item('Versatilidade', v.nome + ' (trilha ' + v.nomeTrilha + ')')]) +
        (d ? '\n\n#### ' + v.nome + ' (versatilidade)\n\n' + d : ''));
    }
    return secao('Origem, classe e trilha', partes);
  }

  /** De onde vem a habilidade: origem, trilha, classe, poder (progressão) ou outros. */
  function procedencia(h, calc) {
    const id = calc.identidade;
    if (h.fonte === 'origem') return 'Origem' + (id.origem ? ' (' + id.origem.nome + ')' : '');
    if (h.fonte === 'trilha') return 'Trilha' + (id.trilha ? ' (' + id.trilha.nome + ')' : '');
    if (h.fonte === 'classe' || h.fonte === 'poder') {
      const entrada = ((OP.data.catalogo && OP.data.catalogo.poderes) || []).find(function (p) { return p.id === h.catalogo; });
      if (entrada && entrada.tipo === 'classe') {
        const classe = achar(OP.calc.classesLista(), entrada.classe);
        return 'Poder de classe' + (classe ? ' (' + classe.nome + ')' : '') + ', pela progressão';
      }
      if (entrada && entrada.tipo === 'geral') return 'Poder geral, pela progressão';
      if (entrada && entrada.tipo === 'paranormal') {
        const el = achar(OP.data.elementos, entrada.categoria);
        return 'Poder paranormal' + (el ? ' (' + el.nome + ')' : '') + ', pela progressão';
      }
      if (h.fonte === 'classe') return 'Habilidade de classe' + (id.classe ? ' (' + id.classe.nome + ')' : '');
      return 'Poder, pela progressão';
    }
    return 'Outros';
  }

  function secaoHabilidades(ficha, calc) {
    const habilidades = Array.isArray(ficha.habilidades) ? ficha.habilidades : [];
    const grupos = [
      ['Origem', function (h) { return h.fonte === 'origem'; }],
      ['Trilha', function (h) { return h.fonte === 'trilha'; }],
      ['Progressão (classe e poderes)', function (h) { return h.fonte === 'classe' || h.fonte === 'poder'; }],
      ['Outros', function (h) { return ['origem', 'trilha', 'classe', 'poder'].indexOf(h.fonte) === -1; }]
    ];
    const partes = [];
    grupos.forEach(function (grupo) {
      const blocos = [];
      habilidades.forEach(function (h, indice) {
        if (!grupo[1](h)) return;
        const livro = blocosDoLivro(h.catalogo);
        const anotacao = texto(h.descricao);
        // A da origem e as da trilha que entram sozinhas já estão descritas em "Origem, classe e trilha"
        if (/^auto-/.test(h.id) && h.fonte !== 'classe' && !anotacao) return;
        const ativacao = achar(OP.data.ativacoes, h.ativacao);
        const dt = calc.habilidades[indice] && calc.habilidades[indice].dt;
        const temPrerequisito = livro && livro.some(function (b) { return /^Pré-requisito/.test(b.rotulo); });
        const meta = lista([
          item('Vem de', procedencia(h, calc)),
          item('Ativação', ativacao ? ativacao.nome : ''),
          item('Custo', h.custoPE ? h.custoPE + (ficha.config && ficha.config.semSanidade ? ' PD' : ' PE') : ''),
          item('DT', dt && typeof dt.total === 'number' ? dt.total : (typeof dt === 'number' ? dt : '')),
          temPrerequisito ? null : item('Pré-requisito', texto(h.prerequisito))
        ]);
        const descricao = blocosEmMd(livro);
        blocos.push('#### ' + (texto(h.nome) || 'Sem nome') + '\n\n' + meta + (descricao ? '\n\n' + descricao : '') +
          (anotacao ? '\n\n' + (livro ? '**Anotações.**\n' : '') + citacao(h.descricao) : ''));
      });
      if (blocos.length) partes.push('### ' + grupo[0] + '\n\n' + blocos.join('\n\n'));
    });
    if (partes.length) partes.push('_A descrição do livro entra só quando o texto está liberado nesta conta; sem isso, só os nomes e o que você escreveu._');
    return secao('Habilidades e poderes', partes);
  }

  function secaoRituais(ficha, calc) {
    const rituais = Array.isArray(ficha.rituais) ? ficha.rituais : [];
    if (!rituais.length) return '';
    const semSan = Boolean(ficha.config && ficha.config.semSanidade);
    const unidadeCusto = semSan ? 'PD' : 'PE';
    const elemento = achar(OP.data.elementos, calc.conjuracao.elementoConectado);
    const blocos = rituais.map(function (r, indice) {
      const e = calc.rituais[indice];
      const el = achar(OP.data.elementos, r.elemento);
      const res = e && e.resistencia;
      const formas = OP.data.formasRitual.filter(function (f) { return e.formas[f.id].ativa; }).map(function (f) {
        const forma = (r.formas && r.formas[f.id]) || {};
        const ef = e.formas[f.id];
        const detalhe = [ef.custoComCondicoes + ' ' + unidadeCusto, forma.dano ? 'dano ' + forma.dano : '', forma.cura ? 'cura ' + forma.cura : ''].filter(Boolean).join(', ');
        return '- **' + f.nome + '** (' + detalhe + ')' + (texto(forma.efeito) ? '\n' + citacao(forma.efeito) : '');
      });
      const livro = blocosDoLivro(r.catalogo);
      const descricao = blocosEmMd((livro || []).filter(function (b) { return b.rotulo === 'Descrição' || /^(Discente|Verdadeir)/.test(b.rotulo); }));
      return '### ' + (texto(r.nome) || 'Sem nome') + '\n\n' + lista([
        item('Círculo', r.circulo + 'º'),
        item('Elemento', el ? el.nome : ''),
        item('Execução', texto(r.execucao)),
        item('Alcance', texto(r.alcance)),
        item('Alvo', texto(r.alvo)),
        item('Área', texto(r.area)),
        item('Duração', texto(r.duracao)),
        item('Resistência', res ? res.nomeTeste + (res.nomeEfeito ? ' — ' + res.nomeEfeito : '') + ' (DT ' + res.dt + ')' : '')
      ]) + (descricao ? '\n\n' + descricao : '') + (formas.length ? '\n\n' + formas.join('\n') : '') + (texto(r.notas) ? '\n\n' + citacao(r.notas) : '');
    });
    const topo = lista([
      item('DT dos rituais', calc.conjuracao.dt.total),
      item('Círculos liberados', calc.conjuracao.circulosLiberados),
      item('Elemento conectado', elemento ? elemento.nome : '')
    ]);
    return secao('Rituais', [topo].concat(blocos));
  }

  function secaoInventario(ficha, calc) {
    const inv = calc.inventario;
    const itens = ((ficha.inventario && ficha.inventario.itens) || []).filter(function (i) { return i && typeof i === 'object'; });
    const credito = achar(OP.data.niveisCredito, inv.credito);
    const resumo = lista([
      item('Carga', inv.espacosUsados + ' / ' + inv.capacidade + ' espaços' + (inv.sobrecarregado ? ' (sobrecarregado)' : '')),
      item('Pontos de Prestígio', inv.pontosPrestigio),
      item('Limite de crédito', credito ? credito.nome : ''),
      item('Itens por categoria', inv.limites.filter(function (l) { return l.limite > 0 || l.usados > 0; })
        .map(function (l) { return l.categoria + ' ' + l.usados + '/' + l.limite; }).join(', '))
    ]);
    const linhas = itens.map(function (i) {
      const tipo = achar(OP.data.tiposItem, i.tipo);
      const cat = achar(OP.data.categoriasItem.map(function (c) { return { id: c.valor, rotulo: c.rotulo }; }), i.categoria);
      return [texto(i.nome) || 'Sem nome', tipo ? tipo.nome : i.tipo, cat ? cat.rotulo : i.categoria, i.espacos, i.quantidade,
        i.equipada ? 'sim' : 'não'];
    });
    return secao('Inventário', [resumo, linhas.length ? tabela(['Item', 'Tipo', 'Cat.', 'Espaços', 'Qtd.', 'Equipado'], linhas) : '']);
  }

  /* ------------------------------------------------------------------------
     API
     ------------------------------------------------------------------------ */

  /** Texto Markdown da ficha (a ficha em memória, já com os padrões completos). */
  function gerar(ficha, agora) {
    const calc = OP.calc.calcularTudo(ficha);
    const ident = ficha.identificacao || {};
    const data = agora || new Date();
    const dia = data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
    const topo = '# ' + (texto(ident.nome) || 'Agente sem nome') + '\n\n_Ficha de Ordem Paranormal, exportada em ' + dia + '._';
    return [
      topo,
      secaoIdentificacao(ficha, calc),
      secaoAtributos(ficha, calc),
      secaoVitais(ficha, calc),
      secaoPericias(ficha, calc),
      secaoClasseOrigemTrilha(ficha, calc),
      secaoHabilidades(ficha, calc),
      secaoRituais(ficha, calc),
      secaoInventario(ficha, calc)
    ].filter(Boolean).join('\n\n') + '\n';
  }

  function nomeArquivo(ficha) {
    return OP.fichas.nomeArquivoFicha(ficha).replace(/\.json$/, '.md');
  }

  OP.exportarMd = { gerar: gerar, nomeArquivo: nomeArquivo };
})(window.OP);
