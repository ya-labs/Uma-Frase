# Domain

Contratos e regras compartilhados entre navegador e servidor ficam neste
diretorio. O modulo `game` concentra entidades, schemas, contagem de palavras,
maquina de estados e resolucao autoritativa das rodadas.

O teste `domain-infrastructure.test.ts` existe somente para comprovar a
infraestrutura de testes de regras puras em TypeScript. As regras do jogo nao
dependem de Next.js, Supabase, Realtime ou Gemini.
