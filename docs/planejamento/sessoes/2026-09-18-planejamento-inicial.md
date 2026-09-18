# Sessao de planejamento inicial — 2026-09-18

## Contexto

O planejamento partiu da especificacao inicial de um jogo multiplayer de
narrativa gerada por IA, originalmente descrito como One Sentence Only. Durante
a conversa, o nome oficial foi definido como Uma Frase e o recorte inicial como
MVP 0.1.

O workspace ainda nao possui um repositorio Git funcional: o diretorio `.git`
esta vazio. Por isso, nao foi possivel associar esta documentacao a issue,
branch, commit ou remote. Nenhuma mutacao Git foi realizada.

## Decisoes tomadas

- Next.js e TypeScript na Vercel;
- Supabase Postgres e Realtime para estado compartilhado;
- Gemini gratuito para narracao e julgamento;
- duas pessoas, oito rodadas e dez segundos por resposta;
- estado e cronometro controlados pelo servidor;
- respostas privadas ate a revelacao;
- pausa e reconexao sem derrota automatica;
- classificacao adulta com limites explicitos de conteudo;
- desenvolvimento continuo por issues, sem milestones.

## Impactos

- GitHub Pages foi descartado porque exigiria um backend separado.
- O estado nao podera permanecer apenas em memoria na Vercel.
- O frontend nao podera ser autoridade sobre limite, prazo ou vencedor.
- A integracao com IA precisara de schema, validacao e tratamento de falha.
- Os contratos compartilhados devem ser definidos antes da divisao do trabalho.

## Pendencias

- inicializar e configurar o repositorio Git;
- definir pesos numericos do sorteio de palavras;
- escolher o modelo Gemini gratuito disponivel durante a implementacao;
- definir a expiracao de salas abandonadas;
- criar as primeiras issues a partir da ordem de implementacao;
- definir identidade visual depois da validacao do fluxo principal.
