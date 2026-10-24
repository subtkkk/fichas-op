/* ==========================================================================
   js/exportar-md.js — resumo da ficha em Markdown (OP.exportarMd)
   --------------------------------------------------------------------------
   Gera um texto .md legível com tudo o que a ficha mostra: identificação,
   atributos, recursos, defesa, perícias (grau em texto e em número, "outros"
   e bônus total), habilidades, rituais, ataques, inventário, condições e
   biografia. Os números vêm de OP.calc.calcularTudo (os mesmos da tela).
   O texto do livro só entra nos marcos da trilha e só com acesso liberado
   (OP.livro.texto); no resto, só nomes, números e o que a pessoa escreveu.
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
    const linhas = OP.data.atributos.map(function (a) {
      return [a.nome + ' (' + a.sigla + ')', calc.atributos[a.id]];
    });
    return secao('Atributos', [tabela(['Atributo', 'Valor'], linhas)]);
  }

  /** Vitais: só PV, PE (ou PD) e SAN, com o atual e o máximo. */
  function secaoVitais(ficha, calc) {
    const semSan = Boolean(ficha.config && ficha.config.semSanidade);
    const linhas = [];
    OP.data.recursos.forEach(function (definicao) {
      if (semSan && definicao.id === 'san') return;
      const r = calc.recursos[definicao.id];
      const rotulo = semSan && definicao.id === 'pe' ? 'Pontos de Determinação (PD)' : definicao.nome + ' (' + definicao.sigla + ')';
      if (!r || r.max === null) linhas.push([rotulo, '—', '—']);
      else linhas.push([rotulo, r.atual, r.max]);
    });
    return secao('Vitais', [tabela(['Vital', 'Atual', 'Máximo'], linhas)]);
  }

  function secaoDefesa(ficha, calc) {
    const d = calc.defesa;
    const partes = ['base ' + d.base, 'AGI ' + d.valorAtributo, d.protecoesInventario ? 'proteções ' + sinal(d.protecoesInventario) : '',
      d.protecao ? 'proteção ' + sinal(d.protecao) : '', d.outros ? 'outros ' + sinal(d.outros) : '',
      d.sobrecarga ? 'sobrecarga −' + d.sobrecarga : '', d.condicoes ? 'condições ' + sinal(d.condicoes) : '',
      d.efeitos ? 'efeitos ' + sinal(d.efeitos) : ''].filter(Boolean);
    const desl = calc.deslocamento;
    return secao('Defesa e deslocamento', [lista([
      item('Defesa', d.total + ' (' + partes.join(', ') + ')'),
      d.totalCorpoACorpo !== d.total || d.totalDistancia !== d.total
        ? item('Defesa corpo a corpo / à distância', d.totalCorpoACorpo + ' / ' + d.totalDistancia) : null,
      item('Deslocamento', desl.metros + ' m (' + desl.quadrados + ' quadrados)')
    ]), tabelaReacoes(d)]);
  }

  /** Bloqueio e Esquiva (o contra-ataque fica de fora): sempre aparecem, dizendo se já estão disponíveis e o que valem. */
  function tabelaReacoes(d) {
    const linhas = (OP.data.reacoes || []).filter(function (reacao) { return reacao.id !== 'contraAtaque'; }).map(function (reacao) {
      const estado = d[reacao.id] || {};
      const pericia = achar(OP.data.pericias, reacao.pericia);
      const grau = OP.data.grausTreinamento[reacao.grauMinimo] || OP.data.grausTreinamento[1];
      const requisito = (pericia ? pericia.nome : reacao.pericia) + ' ' + grau.nome.toLowerCase();
      if (!estado.disponivel) return [reacao.nome, 'indisponível', 'requer ' + requisito];
      let valor = 'disponível';
      if (reacao.id === 'bloqueio') valor = 'reduz ' + estado.reducao + ' de dano';
      else if (reacao.id === 'esquiva') valor = sinal(estado.bonus) + ' na Defesa (Defesa ' + estado.defesaComEsquiva + ')';
      return [reacao.nome, 'disponível', valor];
    });
    return linhas.length ? tabela(['Reação', 'Situação', 'Valor / requisito'], linhas) : '';
  }

  function secaoPericias(ficha, calc) {
    const linhas = OP.data.pericias.map(function (definicao) {
      const e = calc.pericias[definicao.id];
      const salvo = (ficha.pericias && ficha.pericias[definicao.id]) || {};
      const grau = OP.data.grausTreinamento[e.grau] || OP.data.grausTreinamento[0];
      const atributo = achar(OP.data.atributos, e.atributo);
      const nome = definicao.nome + (definicao.aberta && texto(salvo.nomeAberto) ? ' (' + texto(salvo.nomeAberto) + ')' : '');
      const outros = Number(salvo.outros) || 0;
      const extras = [e.bonusAlteracoes ? 'alterações de NEX ' + sinal(e.bonusAlteracoes) : '', e.penalidadeCarga ? 'carga −' + e.penalidadeCarga : '',
        e.penalidadeKit ? 'sem kit −' + e.penalidadeKit : ''].filter(Boolean);
      return [nome, atributo ? atributo.sigla : '—', grau.nome + ' (' + sinal(grau.bonus) + ')', sinal(outros),
        sinal(e.bonus) + (extras.length ? ' (' + extras.join(', ') + ')' : '')];
    });
    const t = calc.treinamento;
    return secao('Perícias', [
      t.classeDefinida ? lista([item('Pontos de treinamento', t.gastos + ' de ' + t.total + ' usados (' + t.restantes + ' restantes)')]) : '',
      tabela(['Perícia', 'Atributo', 'Treinamento', 'Outros', 'Total'], linhas),
      'Total = treinamento + outros (+ efeitos, alterações de NEX e penalidades que valem hoje).'
    ]);
  }

  /** Descrição do livro de um marco da trilha (só com o texto liberado nesta conta; '' sem acesso). */
  function descricaoDoMarco(idTrilha, marco) {
    const trilhas = (OP.data.catalogo && OP.data.catalogo.trilhas) || {};
    const chave = trilhas[idTrilha] && trilhas[idTrilha][String(marco)];
    const t = chave && OP.livro && OP.livro.texto(chave);
    if (!t) return '';
    const partes = OP.uiLivro && OP.uiLivro.blocosDoTexto ? OP.uiLivro.blocosDoTexto(t.corpo) : null;
    if (!partes) return t.corpo.trim();
    return partes.blocos.map(function (b) { return (b.rotulo ? '**' + b.rotulo + '.** ' : '') + b.texto; }).join('\n\n');
  }

  function secaoClasseOrigemTrilha(ficha, calc) {
    const id = calc.identidade;
    const unidade = id.unidade;
    const partes = [];
    if (id.origem) partes.push(lista([item('Origem', id.origem.nome), item('Habilidade da origem', id.origem.habilidade)]));
    if (id.classe) partes.push(lista([item('Classe', id.classe.nome)]));
    function rotuloMarco(marco) {
      return unidade === 'estagio' ? 'Estágio ' + marco : 'NEX ' + marco + '%';
    }
    if (id.trilha) {
      const linhas = id.habilidadesTrilha.map(function (h) {
        return [rotuloMarco(h.marco), h.nome, h.liberada ? 'liberada' : 'bloqueada'];
      });
      const descricoes = id.habilidadesTrilha.map(function (h) {
        const d = descricaoDoMarco(id.trilha.id, h.marco);
        return d ? '#### ' + rotuloMarco(h.marco) + ' · ' + h.nome + '\n\n' + d : '';
      }).filter(Boolean);
      partes.push('### Trilha: ' + id.trilha.nome + '\n\n' + tabela(['Marco', 'Habilidade', 'Situação'], linhas) +
        (descricoes.length ? '\n\n' + descricoes.join('\n\n') : ''));
    }
    if (id.versatilidade) {
      const v = id.versatilidade;
      const d = descricaoDoMarco(v.trilha, v.marco);
      partes.push(lista([item('Versatilidade', v.nome + ' (trilha ' + v.nomeTrilha + ', ' + (v.liberada ? 'liberada' : 'bloqueada') + ')')]) +
        (d ? '\n\n#### ' + v.nome + ' (versatilidade)\n\n' + d : ''));
    }
    return secao('Origem, classe e trilha', partes);
  }

  function secaoHabilidades(ficha, calc) {
    const habilidades = Array.isArray(ficha.habilidades) ? ficha.habilidades : [];
    const nomesFonte = { classe: 'Classe', origem: 'Origem', trilha: 'Trilha', poder: 'Poderes', outro: 'Outras' };
    const partes = [];
    Object.keys(nomesFonte).forEach(function (fonte) {
      const blocos = [];
      habilidades.forEach(function (h, indice) {
        if ((h.fonte || 'outro') !== fonte) return;
        const ativacao = achar(OP.data.ativacoes, h.ativacao);
        const dt = calc.habilidades[indice] && calc.habilidades[indice].dt;
        const meta = lista([
          item('Ativação', ativacao ? ativacao.nome : ''),
          item('Custo', h.custoPE ? h.custoPE + (ficha.config && ficha.config.semSanidade ? ' PD' : ' PE') : ''),
          item('DT', dt && typeof dt.total === 'number' ? dt.total : (typeof dt === 'number' ? dt : '')),
          item('Pré-requisito', texto(h.prerequisito)),
          item('Página', texto(h.pagina))
        ]);
        blocos.push('#### ' + (texto(h.nome) || 'Sem nome') + (meta ? '\n\n' + meta : '') + (texto(h.descricao) ? '\n\n' + citacao(h.descricao) : ''));
      });
      if (blocos.length) partes.push('### ' + nomesFonte[fonte] + '\n\n' + blocos.join('\n\n'));
    });
    if (partes.length) partes.push('_Aqui entram só os nomes e o que você escreveu; a descrição do livro vai apenas nos marcos da trilha (com acesso)._');
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
      return '### ' + (texto(r.nome) || 'Sem nome') + '\n\n' + lista([
        item('Círculo', r.circulo + 'º'),
        item('Elemento', el ? el.nome : ''),
        item('Execução', texto(r.execucao)),
        item('Alcance', texto(r.alcance)),
        item('Alvo', texto(r.alvo)),
        item('Área', texto(r.area)),
        item('Duração', texto(r.duracao)),
        item('Resistência', res ? res.nomeTeste + (res.nomeEfeito ? ' — ' + res.nomeEfeito : '') + ' (DT ' + res.dt + ')' : ''),
        item('Página', texto(r.pagina))
      ]) + (formas.length ? '\n\n' + formas.join('\n') : '') + (texto(r.notas) ? '\n\n' + citacao(r.notas) : '');
    });
    const topo = lista([
      item('DT dos rituais', calc.conjuracao.dt.total),
      item('Círculos liberados', calc.conjuracao.circulosLiberados),
      item('Elemento conectado', elemento ? elemento.nome : '')
    ]);
    return secao('Rituais', [topo].concat(blocos));
  }

  function secaoAtaques(ficha, calc) {
    const ataques = Array.isArray(ficha.ataques) ? ficha.ataques : [];
    if (!ataques.length) return '';
    const linhas = ataques.map(function (a, indice) {
      const e = calc.ataques[indice];
      const pericia = achar(OP.data.pericias, a.pericia);
      const teste = e && e.teste;
      const bonus = teste ? OP.calc.formatarDados(teste.dados) + ' ' + sinal(teste.bonus) : sinal(a.testeBonus);
      const dano = texto(a.dano) + (a.danoBonus ? ' ' + sinal(a.danoBonus) : '');
      return [texto(a.nome) || 'Sem nome', pericia ? pericia.nome : a.pericia, bonus, dano, a.critMargem + '/x' + a.critMult,
        texto(a.alcance), texto(a.tipoDano), a.usaMunicao ? a.municao : ''];
    });
    return secao('Ataques', [tabela(['Ataque', 'Perícia', 'Teste', 'Dano', 'Crítico', 'Alcance', 'Tipo', 'Munição'], linhas)]);
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
      const extra = i.tipo === 'protecao' ? 'Defesa ' + sinal(i.defesa) + (i.penalidade ? ', penalidade −' + i.penalidade : '') : '';
      return [texto(i.nome) || 'Sem nome', tipo ? tipo.nome : i.tipo, cat ? cat.rotulo : i.categoria, i.espacos, i.quantidade,
        i.equipada ? 'sim' : 'não', [extra, texto(i.descricao)].filter(Boolean).join(' — ')];
    });
    return secao('Inventário', [resumo, linhas.length ? tabela(['Item', 'Tipo', 'Cat.', 'Espaços', 'Qtd.', 'Equipado', 'Notas'], linhas) : '']);
  }

  function secaoCondicoes(ficha) {
    const ativas = (ficha.condicoes && ficha.condicoes.ativas) || [];
    if (!ativas.length) return '';
    const nomes = ativas.map(function (c) {
      const base = achar(OP.data.condicoes, c.id);
      const nome = (c.personalizada && texto(c.personalizada.nome)) || (base ? base.nome : c.id);
      return '- ' + nome + (texto(c.nota) ? ' — ' + texto(c.nota) : '');
    });
    return secao('Condições ativas', [nomes.join('\n')]);
  }

  function secaoBiografia(ficha) {
    const b = ficha.biografia || {};
    const campos = [['Aparência', b.aparencia], ['Personalidade', b.personalidade], ['Histórico', b.historico],
      ['Objetivo', b.objetivo], ['Medos', b.medos], ['Notas', b.notas]];
    const partes = campos.filter(function (c) { return texto(c[1]); }).map(function (c) { return '### ' + c[0] + '\n\n' + citacao(c[1]); });
    [['Aliados', b.aliados], ['Rivais', b.rivais]].forEach(function (par) {
      const pessoas = (par[1] || []).filter(function (p) { return p && texto(p.nome); });
      if (pessoas.length) {
        partes.push('### ' + par[0] + '\n\n' + pessoas.map(function (p) {
          return '- ' + texto(p.nome) + (texto(p.nota) ? ' — ' + texto(p.nota) : '');
        }).join('\n'));
      }
    });
    return secao('Biografia', partes);
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
      secaoDefesa(ficha, calc),
      secaoPericias(ficha, calc),
      secaoClasseOrigemTrilha(ficha, calc),
      secaoHabilidades(ficha, calc),
      secaoRituais(ficha, calc),
      secaoAtaques(ficha, calc),
      secaoInventario(ficha, calc),
      secaoCondicoes(ficha),
      secaoBiografia(ficha)
    ].filter(Boolean).join('\n\n') + '\n';
  }

  function nomeArquivo(ficha) {
    return OP.fichas.nomeArquivoFicha(ficha).replace(/\.json$/, '.md');
  }

  OP.exportarMd = { gerar: gerar, nomeArquivo: nomeArquivo };
})(window.OP);
