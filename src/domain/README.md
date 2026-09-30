# Domain

Contratos e regras compartilhados entre navegador e servidor ficam neste
diretorio. O modulo `game` concentra entidades, schemas, contagem de palavras,
maquina de estados e resolucao autoritativa das rodadas.

O modulo `contracts` define os limites entre frontend e backend:

- comandos e respostas HTTP, sem implementar rotas;
- estado publico e estado privado do jogador; o estado completo fica isolado em
  `src/server/contracts`;
- notificacao Realtime minima, usada apenas para solicitar novamente o estado
  canonico;
- erros estruturados de validacao, autorizacao, fase e dependencia externa;
- entradas e saidas estruturadas da IA, sem acoplamento com o Gemini.

Os schemas sao estritos. Dados privados enviados por engano no estado publico
sao rejeitados em vez de removidos silenciosamente.

O teste `domain-infrastructure.test.ts` existe somente para comprovar a
infraestrutura de testes de regras puras em TypeScript. As regras do jogo nao
dependem de Next.js, Supabase, Realtime ou Gemini.
