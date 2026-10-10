# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Os jogadores da mesa de Ordem Paranormal RPG do dono do projeto. Cada jogador abre o link do site no próprio aparelho e mantém ali a ficha do seu agente (pode ter mais de uma).

## Product Purpose

Substituir a ficha de papel. O jogador cria, evolui e consulta o personagem com os cálculos das regras feitos automaticamente (atributos, PV, SAN, PE, defesa, perícias, NEX e limites), rola dados pela própria ficha e acompanha o estado do agente durante a sessão.

## Positioning

Ferramenta pessoal e não oficial, feita sob medida para uma mesa específica. Não é um produto público e não disputa espaço com ferramentas oficiais. O que a distingue é já trazer as regras do Livro v1.3, do Sobrevivendo ao Horror v1.2 e das aventuras AS como dados, sem conta e sem servidor: abre direto no navegador.

## Operating Context

- **Na mesa, presencial:** no celular, para consultar e atualizar PV, SAN e PE e para rolar perícias e ataques no meio da cena; e no notebook.
- **Fora da sessão:** para montar e evoluir personagens (criação, NEX, habilidades, rituais, inventário).
- A mesa online não foi indicada como contexto de uso.
- Cada aparelho guarda as próprias fichas. Levar uma ficha do celular para o notebook depende de exportar e importar, ou de backup.

## Capabilities and Constraints

- Site estático em HTML, CSS e JavaScript puro, sem etapa de build nem dependências, publicado no GitHub Pages.
- Não há backend nem contas: os dados ficam no `localStorage` do navegador (`op_idx_v2`, `op_f_<id>`, `op_prefs`).
- Várias fichas por navegador: criar, duplicar, excluir com confirmação, exportar e importar JSON, backup de tudo, imprimir a ficha.
- Cálculos e validações seguem as regras e são cobertos por `js/tests.js` (`OP.runTests()`).
- Conteúdo de regras: Livro de Regras v1.3, Sobrevivendo ao Horror v1.2 e aventuras AS-01 a AS-09 (`data/fontes.js`). Os dados trazem só nomes e números; descrições de habilidades, rituais e itens são digitadas pelo jogador. O projeto não reproduz texto dos livros.
- Fichas salvas e arquivos exportados de versões anteriores precisam continuar abrindo: formatos de dados e persistência são compatíveis para trás.
- Os temas elementais são só visuais. Ficam salvos por navegador nas preferências, não alteram nenhuma regra e não vão no arquivo exportado.
- Interface toda em português do Brasil, com a terminologia do jogo (agente, NEX, PV, SAN, PE, perícias, rituais, elementos).
- Exige navegador moderno.

## Brand Commitments

- Não oficial: ferramenta de fã para a própria mesa, que não deve se passar por produto oficial de Ordem Paranormal.
- Nome atual na interface: "Dossiê", com o subtítulo "Ordem Paranormal".

## Evidence on Hand

- Dados de regras em `data/*.js`.
- Não há fichas reais de jogadores no repositório; elas existem só nos navegadores de cada um. Não inventar personagens, estatísticas ou registros que pareçam ser dos usuários.
- O modelo de dados não tem retrato nem imagem de personagem.
- Não há depoimentos, métricas de uso nem analytics.

## Product Principles

1. **A ficha é fiel à regra.** Cálculos certos, e nenhuma escolha visual altera mecânica.
2. **Nada se perde.** Dados compatíveis, confirmação antes de excluir, exportar e fazer backup sempre à mão.
3. **Rápida no meio da cena.** No celular, as ações de sessão (PV, SAN, PE, rolagens) ficam a um toque.
4. **Só o que funciona.** Nenhum controle decorativo, nenhum dado simulado.
5. **Ferramenta da mesa, não serviço público.**

## Accessibility & Inclusion

Requisitos definidos pelo dono no redesign: bom contraste, navegação por teclado com foco visível, alvos de toque confortáveis no celular, respeito à preferência por movimento reduzido e efeitos de vidro (blur) que não pesem em aparelhos fracos. Linha de base verificada em outubro de 2026: WCAG 2.1 AA, sem violações no axe-core.
