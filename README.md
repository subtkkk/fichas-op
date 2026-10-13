# Dossiê · Fichas de Ordem Paranormal

Site para criar, evoluir e usar fichas de agentes de **Ordem Paranormal RPG**.

A ficha calcula sozinha o que as regras mandam: atributos, PV, PE, SAN, defesa, perícias, NEX e limites. Ela também rola os dados e acompanha o estado do agente durante a sessão.

Feito para os jogadores de uma mesa específica, cada um no próprio celular ou notebook.

> Ferramenta de fã, **não oficial**, para uso pessoal da mesa. Não é um serviço público e não deve ser redistribuída. Nenhum texto do livro de regras é reproduzido aqui.

## Como abrir

**Publicado:** <https://subtkkk.github.io/fichas-op/>

**No computador, a partir do código:** o site é estático, sem instalação nem build. Basta servir a pasta e abrir no navegador:

```bash
python3 -m http.server 8000
# depois abra http://localhost:8000
```

Precisa de um navegador atual (Chrome, Edge, Safari ou Firefox recentes).

## O que dá para fazer

**Central e Arquivo**
- A Central mostra a última ficha usada, as atualizadas recentemente e a situação do arquivo neste navegador.
- O Arquivo lista todas as fichas, com busca, filtro por classe e ordenação.
- Cada ficha pode ser duplicada, exportada e excluída. A exclusão pede confirmação e ainda oferece **Desfazer**.
- Importar é por botão ou arrastando o `.json` para a página. Se a ficha já existir no navegador, dá para **Substituir** (com Desfazer) ou **Importar como nova**.
- O backup baixa todas as fichas de uma vez.

**A ficha**
- Identificação, origem, classe e trilha com progressão por NEX (ou estágio, no Sobrevivente). As fontes de origens e trilhas podem ser escolhidas por livro.
- Atributos num mostrador com um d20 para cada um. Base, bônus e a distribuição de pontos (com "modo livre") ficam atrás de "Editar atributos".
- Recursos (PV, PE, SAN) com o cálculo do máximo à vista e perda permanente de Sanidade.
- Defesa, reações, deslocamento e resistências a dano.
- Perícias numa linha só: ícones (somente treinada, carga, kit, concedida), nome, sigla do atributo (com uma seta para baixo quando o teste rola o menor dado), **grau** (botão com chevrons: um = Treinado, dois = Veterano, três = Expert; clique para trocar), **outros** bônus, **total** e rolar. A sigla do atributo é um botão discreto: clique nela para trocar o atributo da perícia (ou "Voltar ao padrão"); trocado, ela fica em destaque com um ponto. Em "Editar perícias" aparece também a caixa Concedida. Perícias que exigem kit (Crime, Enganação, Medicina, Tecnologia) sofrem −5 no bônus sem o kit delas no inventário; o kit limpa a penalidade (valor em `data/config.js`, `penalidadeSemKit`).
- Ataques, habilidades e poderes, rituais (com formas Discente e Verdadeira, DT, afinidade e custo de Medo), inventário com patente, crédito e carga, e biografia (retrato, aliados, rivais e diário).
- **Condições e estados:** faixa de Saúde (ileso, ferido, machucado, morrendo) e de Sanidade (sã, perturbada, enlouquecendo), sempre com texto e ícone; bloco de **Morrendo** com a contagem de turnos; cartões de condições com rodadas, "até o fim da cena" e nota; condição personalizada; **Passar rodada** e **Fim da cena**. As 35 condições do livro trazem o **texto do livro** e os efeitos que a ficha aplica sozinha (dados em perícias, atributos, ataques, Iniciativa, Percepção e Reflexos; Defesa, inclusive contra corpo a corpo e à distância; deslocamento; +1 PE do Alquebrado; resistência a dano do Petrificado). Segue a regra das *Clarificações de regras*: efeitos iguais não se acumulam (vale o mais severo), efeitos diferentes se somam. O que a ficha não calcula (ações, dano por rodada, testes de Vigor) aparece como lembrete no cartão. Os efeitos podem ser desligados em "Aplicar efeitos das condições" (os campos afetados ganham o selo **cond.**).
- **Descansar:** diálogo com a condição de descanso, Dormir ou Meditação e as quantias de PV, PE e SAN já sugeridas (editáveis). Nada limita o uso por interlúdio.
- **Biografia:** retrato (reduzido para 320 px e guardado no navegador), aparência, personalidade, histórico, objetivo, medos, aliados, rivais, anotações e **diário** com entradas dobráveis. Entram na exportação e na impressão (o diário só com "Incluir diário na impressão").
- **Verificações:** painel recolhível no topo da ficha com os avisos que não bloqueiam nada (atributos, pontos, graus, rituais, carga, PV acima do máximo…), com "Ir ao campo". O modo livre os esconde.
- **Visão de mesa:** perícias em uma linha, e ataques e rituais em resumo com os botões de rolar e conjurar. "Editar" abre o formulário completo.
- **Ajuste de vitais:** tocar em PV, PE ou SAN abre −5/−1/+1/+5, dano ou cura de uma quantia, e Desfazer. No celular, é uma gaveta.
- Remover qualquer item da ficha mostra Desfazer por alguns segundos.
- "Termos da ficha" é um glossário recolhido com NEX, DT, graus e outros termos.
- As listas de escolha abrem um painel próprio, com as opções agrupadas por livro, busca nas listas longas e, no celular, uma gaveta.

**Rolagens**
- Painel com o resultado de cada teste (todos os d20 e qual valeu), dano, crítico, modificador de dados, bônus extra, DT do alvo, fórmula livre (ex.: `2d6+3`) e histórico.

**Aparência, celular e acessibilidade**
- **Aparência** (botão no cabeçalho): tema do site (Automático, Escuro, Claro e Alto contraste), tamanho do texto (14, 16, 18 e 20 px) e animações (Automático, Sim, Não). Fica nas preferências do navegador, nunca na ficha, e vale sem piscar ao recarregar.
- No celular, a barra de seções fica no rodapé (Resumo, Perícias, Combate, Inventário, Rituais, Biografia e Rolagens), o painel de Rolagens vira uma gaveta e os diálogos de formulário ocupam a tela. Alvos de toque têm 44 px.
- Tudo funciona só com o teclado (a tecla **?** abre a ajuda), com foco sempre visível. Leitores de tela anunciam rolagens, descanso, rodadas e alertas.

**Temas por ficha e impressão**
- Seis temas elementais por ficha: Neutro, Sangue, Morte, Conhecimento, Energia e Medo. Eles mudam só a aparência e nunca as regras.
- **Imprimir / PDF** gera a ficha completa num layout próprio para papel.

## Onde ficam os dados

Tudo fica no **próprio navegador** (`localStorage`). Não há servidor nem conta.

| Chave | Conteúdo |
|---|---|
| `op_idx_v2` | Índice das fichas (ordem, ficha aberta) |
| `op_f_<id>` | Cada ficha |
| `op_prefs` | Preferências: livros ativos, tema elemental de cada ficha e aparência do site (tema, tamanho do texto, animações, diário na impressão) |
| `op_ficha_atual` | Formato antigo, migrado automaticamente |

Isso tem algumas consequências:
- **Cada aparelho tem as suas fichas.** Para levar uma ficha do celular para o notebook, exporte e importe o `.json`.
- O tema elemental e a aparência do site ficam nas preferências do navegador e **não** vão no arquivo exportado.
- O retrato fica dentro da ficha (JPEG pequeno, até 400 mil caracteres). Se o armazenamento do navegador encher, o site avisa e manda exportar a ficha, sem perder o que está na memória. A Central mostra "Armazenamento usado".
- Sem `localStorage` (por exemplo, alguns modos privados), o site funciona só na memória. Ele avisa que não conseguiu salvar e oferece exportar um backup, e a Central marca o armazenamento como temporário.
- Arquivos exportados:
  - formato `op-ficha` (`ficha-<nome>.json`) ou `op-backup` (`fichas-backup-AAAA-MM-DD.json`);
  - versão do modelo 10 (fichas antigas abrem normalmente: a antiga "Descrição" vira "Biografia");
  - até 2 MB.
- A importação aceita versões anteriores e recusa as mais novas que o site.

## Regras e conteúdo

Os dados de jogo vêm do Livro de Regras v1.3, do Sobrevivendo ao Horror v1.2 e das aventuras AS-01 a AS-09 (`data/fontes.js`).

Os arquivos trazem **só nomes e números**. As descrições de habilidades, rituais e itens são digitadas pelo jogador.

## Estrutura

```
index.html          Página única: Central, Arquivo e Ficha (rotas #/central, #/arquivo, #/ficha/<id>)
css/
  style.css         Tela: design system, temas, componentes e responsivo
  print-base.css    Impressão: layout da ficha no papel
  print.css         Impressão: ajustes e o que fica fora do papel
js/
  main.js           Inicialização e ciclo de atualização
  state.js          Estado da ficha, modelo, migração e importação
  calc.js           Fórmulas da ficha
  dados.js          Motor de dados
  rolagens.js       Liga a ficha ao motor de dados
  fichas.js         Várias fichas no navegador (salvar, abrir, excluir, exportar)
  storage.js        Acesso ao localStorage (ou memória)
  prefs.js          Preferências do navegador (livros, tema elemental por ficha e aparência do site)
  ui.js             Interface da ficha
  ui-classe.js      Origem, classe, trilha e progressão
  ui-dossie.js      Capa do dossiê, vitais, ajuste de vital, índice e tema
  ui-fichas.js      Central, Arquivo e operações com fichas
  ui-app.js         Navegação entre telas e avisos
  ui-seletor.js     Painel próprio das listas de escolha (no lugar do menu nativo)
  ui-condicoes.js   Condições, estados, Morrendo e diálogo Descansar
  ui-biografia.js   Retrato, aliados, rivais e diário
  ui-verificacoes.js  Painel de verificações
  ui-aparencia.js   Tema, tamanho do texto, animações, Sobre e ajuda de teclado
  ui-auditoria.js   Auditorias de layout, contraste e acessibilidade (para os testes)
  tests.js          Verificações das fórmulas
  tests-etapa10.js  Verificações da Etapa 10
data/               Dados de jogo (classes, origens, trilhas, perícias, rituais, condições…) e temas
                    (temas.js = aparência do site; temas-ficha.js = temas elementais por ficha)
fonts/              Fontes locais (Cormorant Garamond e IBM Plex, licença OFL)
```

## Desenvolvimento

- HTML, CSS e JavaScript puro, sem dependências e sem etapa de build: edite e recarregue.
- Os scripts compartilham o objeto global `OP`. O fluxo é `OP.state.atualizar` → `OP.calc` → `OP.ui.desenhar`. As telas ligam os campos por atributos (`data-campo`, `data-saida`, `data-passo`…).
- **Testes das fórmulas:** abra o site e rode `OP.runTests()` no console do navegador. O esperado é `{ total: 482, aprovados: 482, falhas: 0 }`. Em janela estreita (até 480 px) o teste de layout também confere a rolagem horizontal. As auditorias ficam em `OP.ui.auditarLayout()`, `auditarContraste(tema)`, `auditarAcessibilidade()`, `auditarTitulos()` e `auditarAlvosToque()`.
- **Cores:** o CSS da tela não tem cor fixa fora de variáveis. As paletas (`--cor-*`, em `#rrggbb`) ficam no começo do `css/style.css`: escuro em `:root`, claro em `[data-tema="claro"]` (e no `@media (prefers-color-scheme: light)` do modo Automático) e alto contraste em `[data-tema="contraste"]`. O `css/print.css` mantém fundo branco e texto preto, qualquer que seja o tema.
- **Compatibilidade:** fichas salvas e arquivos exportados de versões anteriores precisam continuar abrindo. Mudanças no modelo passam pela migração em `js/state.js`.

## Design

- [`PRODUCT.md`](PRODUCT.md): para quem é o site, onde é usado, restrições e princípios.
- [`DESIGN.md`](DESIGN.md): o sistema visual ("O Dossiê Vivo"), com tokens, tipografia, componentes e regras. O arquivo `.impeccable/design.json` complementa com escalas de tom, sombras e componentes de referência.
- As skills do [Impeccable](https://impeccable.style) estão em `.claude/skills/impeccable` para uso com o Claude Code (`/impeccable critique`, `/impeccable polish`…).

## Créditos

Ordem Paranormal RPG pertence aos seus criadores e editora. Este projeto não tem relação oficial com eles.

As fontes Cormorant Garamond e IBM Plex são distribuídas sob a SIL Open Font License (ver `fonts/`).
