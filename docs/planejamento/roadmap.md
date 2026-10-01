# Roadmap de Uma Frase

## Forma de trabalho

O projeto nao utilizara milestones. O trabalho sera organizado em lotes com
issues amplas por responsavel. Como regra, cada lote tera uma issue de frontend
para Nicolas e uma issue de backend para Marco. Uma issue de integracao sera
criada somente quando existir uma entrega conjunta que nao caiba com seguranca
nas duas responsabilidades.

Cada pessoa manterá no maximo uma issue e uma branch ativas. Uma branch pertence
a uma unica issue e termina em um unico Pull Request. Tarefas internas nao
geram novas branches: elas formam um checklist de prompts para IA dentro da
issue.

## Checklist como prompts para IA

Cada item do checklist pode produzir uma alteracao grande, mas precisa ser
autocontido e verificavel. O prompt deve informar:

- objetivo;
- contexto e fontes de verdade;
- entrega esperada;
- limites e itens fora do escopo;
- dependencias e contratos que devem ser preservados;
- criterios de aceite;
- comandos e cenarios de validacao;
- informacoes necessarias para o proximo prompt.

Modelo:

```md
- [ ] Implemente [objetivo].

  Contexto:
  - [estado atual, contratos e dependencias]

  Entrega:
  - [comportamentos e resultados esperados]

  Limites:
  - [o que nao deve ser alterado ou antecipado]

  Criterios de aceite:
  - [resultado observavel e validacoes obrigatorias]
```

Ao concluir um prompt, a pessoa revisa o diff, executa as validacoes e cria um
commit de checkpoint na mesma branch. O proximo prompt parte desse estado. O PR
e aberto somente quando todos os prompts da issue estiverem concluidos.

## Trabalho compartilhado

Duas pessoas ou duas IAs nao escrevem simultaneamente na mesma branch. Quando
uma issue exigir contribuicao dos dois responsaveis, o trabalho ocorre por
revezamento:

1. a pessoa atual conclui e valida seu prompt;
2. o worktree fica limpo, com commit e push realizados;
3. o repasse informa commit, validacoes, contratos alterados, parte concluida e
   trabalho restante;
4. a proxima pessoa atualiza a branch antes de continuar;
5. enquanto isso, a primeira pessoa pode trabalhar em outra issue independente.

A `main` permanece protegida e como base de integracao. Nao sera criada uma
branch `dev` permanente. Branches concluidas devem ser removidas depois do
merge para reduzir ruido operacional.

## Ordem de implementacao

Os itens abaixo indicam a ordem das capacidades do produto. Eles podem ser
agrupados como prompts dentro das issues amplas de frontend e backend; nao
representam obrigatoriamente uma issue ou branch individual.

1. Inicializar o projeto Next.js com TypeScript e validacoes basicas.
2. Consolidar entidades, schemas Zod e maquina de estados compartilhada.
3. Criar schema do Supabase e regras de acesso server-side.
4. Implementar criacao de sala, entrada por codigo e identidade por aba.
5. Sincronizar lobby, presenca e inicio da partida entre dois clientes.
6. Implementar geracao da situacao e distribuicao do limite de palavras.
7. Implementar cronometro autoritativo de um minuto, encerrando antes se ambos enviarem.
8. Implementar envio privado e validacao compartilhada das respostas.
9. Integrar Gemini com retorno estruturado e validacao local.
10. Revelar vencedor, justificativa e continuacao de forma sincronizada.
11. Acrescentar oito rodadas, pontuacao, resumo narrativo e epilogo.
12. Implementar pausa, reconexao, idempotencia e recuperacao de erros.
13. Refinar tipografia, animacoes, responsividade e feedback visual.
14. Validar o fluxo completo publicado na Vercel com dois clientes reais.

## Regra de priorizacao

Nenhum modo futuro deve ser iniciado enquanto o fluxo principal de duas pessoas
nao estiver completo, sincronizado e validado. Cada prompt deve preservar os
contratos compartilhados ou atualizar explicitamente consumidores e testes. O
limite de trabalho em andamento e de uma issue por pessoa.

## Depois do MVP 0.1

Somente depois da validacao do nucleo poderao ser avaliados:

- partidas para ate seis jogadores;
- temas e configuracoes personalizadas;
- modos One Word, Sudden Death, Reverse, Palavra Proibida e Coop;
- contas, historico, ranking e matchmaking;
- recursos visuais, sonoros ou mobile adicionais.
