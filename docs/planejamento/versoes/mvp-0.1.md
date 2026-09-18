# MVP 0.1

## Objetivo

Entregar uma versao jogavel de Uma Frase para duas pessoas, com uma partida de
oito rodadas, julgamento por IA, continuidade narrativa, pontuacao e epilogo.

## Fluxo da partida

1. Uma pessoa cria a sala e recebe um codigo.
2. A segunda pessoa entra informando o codigo e um nome.
3. O host inicia quando os dois jogadores estiverem presentes.
4. A IA gera a situacao inicial.
5. O jogo revela a situacao e, em seguida, o limite de palavras.
6. Comeca um cronometro de dez segundos controlado pelo servidor.
7. Os jogadores escrevem e enviam uma unica frase.
8. As respostas permanecem privadas ate ambos enviarem ou o prazo terminar.
9. A IA escolhe o vencedor, justifica e continua a historia.
10. O vencedor recebe um ponto e a rodada seguinte comeca.
11. Depois da oitava rodada, o jogo mostra o placar e um epilogo.

## Regras de envio

- Todos recebem o mesmo limite de palavras na rodada.
- O frontend mostra a contagem em tempo real e bloqueia excesso.
- O servidor repete a validacao e rejeita respostas acima do limite.
- Ao zerar o cronometro, o cliente tenta enviar o texto valido atual.
- Campo vazio representa ausencia de resposta.
- Se apenas um jogador responder, ele vence automaticamente.
- Se ambos ficarem sem resposta, ninguem pontua e a IA gera a proxima situacao.
- A contagem considera palavras separadas por espaco; pontuacao anexada nao cria
  outra palavra.

## Distribuicao do limite

O limite e gerado pelo servidor, depois da situacao, com distribuicao ponderada:

- 1 palavra: evento especial, muito raro;
- 2 a 3 palavras: raro;
- 4 a 7 palavras: comum;
- 8 a 10 palavras: comum;
- 11 a 15 palavras: raro.

Os pesos exatos permanecem ajustaveis durante testes de diversao.

## Arquitetura

### Aplicacao

- Next.js com App Router;
- TypeScript;
- deploy na Vercel;
- rotas HTTP server-side para mutacoes e chamadas de IA.

### Estado e multiplayer

- Supabase Postgres como fonte de verdade;
- Supabase Realtime para avisar clientes sobre mudancas;
- leitura do estado publico apos cada notificacao;
- respostas armazenadas separadamente e indisponiveis aos clientes antes da
  revelacao;
- operacoes de envio e resolucao idempotentes.

### Inteligencia artificial

- Gemini API no plano gratuito;
- chave armazenada somente no ambiente server-side da Vercel;
- modelo configurado por variavel de ambiente;
- retorno validado localmente com schema Zod;
- uma nova tentativa automatica em falhas transitorias;
- estado `judging_error` para repeticao manual sem perder respostas.

O plano gratuito pode usar conteudo para melhoria dos produtos do provedor.
Nenhum dado pessoal ou sensivel deve ser enviado nos prompts.

## Modelo de dominio

### Game

```ts
type GameStatus =
  | "waiting"
  | "generating"
  | "situation"
  | "answering"
  | "judging"
  | "judging_error"
  | "reveal"
  | "paused"
  | "finished";

type Game = {
  id: string;
  code: string;
  status: GameStatus;
  hostPlayerId: string;
  round: number;
  maxRounds: 8;
  storySummary: string;
  pausedFrom: GameStatus | null;
  createdAt: string;
};
```

### Player

```ts
type Player = {
  id: string;
  gameId: string;
  name: string;
  score: number;
  isConnected: boolean;
};
```

### Round e Answer

```ts
type Round = {
  id: string;
  gameId: string;
  number: number;
  status: GameStatus;
  situation: string;
  wordLimit: number;
  answerDeadlineAt: string | null;
  winnerPlayerId: string | null;
  reason: string | null;
  continuation: string | null;
  nextSituation: string | null;
};

type Answer = {
  id: string;
  roundId: string;
  playerId: string;
  text: string;
  submittedAt: string;
};
```

O schema persistido podera separar ou complementar esses campos sem alterar o
contrato publico do dominio.

## Identidade e reconexao

- Nao havera login.
- Cada aba recebe um token opaco proprio, mantido em `sessionStorage`.
- O servidor armazena apenas uma representacao protegida do token.
- O token permite recuperar a vaga no mesmo navegador.
- Uma desconexao pausa a partida e preserva o estado.
- A reconexao retoma a fase interrompida sem derrota automatica.

## Contrato HTTP inicial

```text
POST /api/rooms
POST /api/rooms/:code/join
POST /api/rooms/:code/start
GET  /api/rooms/:code/state
POST /api/rooms/:code/answer
POST /api/rooms/:code/resolve
POST /api/rooms/:code/pause
POST /api/rooms/:code/resume
```

O token do jogador acompanha as chamadas autenticadas da sala. Toda mutacao
valida fase, jogador, rodada e prazo no servidor.

## Contrato inicial da IA

```ts
type JudgeResult = {
  winnerPlayerId: string | null;
  reason: string;
  continuation: string;
  nextSituation: string;
  updatedStorySummary: string;
};
```

O servidor deve rejeitar vencedor inexistente, jogador sem resposta, campos
ausentes e valores semanticamente invalidos. A IA recebe regras, resumo da
historia, situacao, limite e respostas, sem historico bruto indefinido.

## Estados da interface

- home;
- criacao ou entrada na sala;
- lobby;
- geracao da situacao;
- exibicao da situacao;
- revelacao do limite;
- resposta com contador e cronometro;
- espera pelo outro jogador;
- julgamento;
- revelacao do vencedor;
- pausa e reconexao;
- erro recuperavel da IA;
- placar e epilogo.

## Estrutura de diretorios proposta

```text
src/
├── app/
│   ├── page.tsx
│   ├── room/[code]/page.tsx
│   └── api/rooms/
├── components/
│   ├── lobby/
│   ├── game/
│   └── results/
├── domain/game/
│   ├── entities.ts
│   ├── schemas.ts
│   ├── state-machine.ts
│   ├── word-count.ts
│   └── word-limit.ts
├── server/
│   ├── ai/
│   ├── rooms/
│   ├── realtime/
│   └── repositories/
└── lib/
    ├── supabase-client.ts
    └── supabase-server.ts

supabase/
└── migrations/
```

## Divisao de responsabilidades

Antes do trabalho paralelo, os dois desenvolvedores definem juntos entidades,
schemas, maquina de estados, contratos HTTP e payload da IA.

### Nicolas

- home, entrada e lobby;
- tela da partida;
- contador e cronometro;
- revelacao, placar e feedback visual;
- estados de espera, pausa, reconexao e erro.

### Marco

- schema e acesso ao banco;
- salas, tokens e regras da partida;
- sincronizacao Realtime;
- limite de palavras e controle de rodadas;
- prompts, Gemini e validacao do retorno.

## Criterios de pronto

- Dois clientes distintos entram na mesma sala.
- Ambos visualizam a mesma situacao, limite e prazo.
- Respostas acima do limite sao recusadas pelo servidor.
- Nenhum jogador le a resposta adversaria antes da revelacao.
- O encerramento simultaneo produz apenas uma resolucao.
- Ambos visualizam o mesmo vencedor, justificativa, continuacao e placar.
- O fluxo completa oito rodadas e gera um epilogo.
- Uma desconexao permite recuperar a vaga e continuar a partida.
- Segredos do Supabase e Gemini nao aparecem no bundle do navegador.
