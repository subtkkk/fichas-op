# Fichas de Ordem Paranormal

Site estático para criar e usar fichas de Ordem Paranormal RPG. Leia o `README.md` antes de mexer no código.

## Projeto
- HTML, CSS e JavaScript puros, sem build e sem dependências externas. Não adicione bibliotecas, bundlers ou frameworks sem pedido explícito.
- Os dados ficam no navegador (`localStorage`). Não crie backend ou banco sem pedido.
- O código, os comentários e a interface são em português.
- Não reproduza texto do livro de regras. O projeto é uma ferramenta de fã, não oficial.

## Escolha de modelo nos subagentes (ferramenta Agent)
O modelo principal da sessão é escolhido pelo usuário com `/model`. Não tente trocá-lo. Ao abrir um subagente, escolha o parâmetro `model` pela tarefa:

- **haiku**: buscar texto ou arquivos, listar, ler trechos, tarefas mecânicas e repetitivas.
- **sonnet**: edições localizadas, correção de bug com causa clara, escrita de testes, documentação.
- **opus**: mudanças que tocam vários arquivos, depuração de problemas difíceis, decisões de arquitetura, revisão de segurança.

Na dúvida, use sonnet.

## Esforço (`effort`)
- Não defina `effort` em subagentes a menos que o usuário peça explicitamente.

## Comunicação
- Ao delegar a um subagente, diga na resposta qual modelo usei e por quê, quando isso afetar custo ou qualidade.
