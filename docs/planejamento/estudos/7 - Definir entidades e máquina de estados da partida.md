# Entidades e contratos da partida no frontend

> Guia de estudo da parte frontend desenvolvida na issue **#7 — Definir
> entidades e máquina de estados da partida**.

## Sumário

1. [O que foi desenvolvido](#o-que-foi-desenvolvido)
2. [O que é o domínio da aplicação](#o-que-é-o-domínio-da-aplicação)
3. [Constantes do jogo](#constantes-do-jogo)
4. [Fases da partida](#fases-da-partida)
5. [Entidades](#entidades)
6. [Tipos TypeScript e schemas Zod](#tipos-typescript-e-schemas-zod)
7. [Como os schemas foram construídos](#como-os-schemas-foram-construídos)
8. [Contagem de palavras](#contagem-de-palavras)
9. [Exportação do domínio](#exportação-do-domínio)
10. [Testes automatizados](#testes-automatizados)
11. [Fluxo futuro no frontend](#fluxo-futuro-no-frontend)
12. [O que ficou para o backend](#o-que-ficou-para-o-backend)

---

## O que foi desenvolvido

A issue #7 possui responsabilidades compartilhadas entre frontend e backend.
Nesta etapa foi implementada somente a parte necessária ao **frontend**:

- tipos de partida, jogador, rodada e resposta;
- vocabulário das fases da partida;
- constantes conhecidas do MVP;
- schemas Zod para validar a estrutura dos dados recebidos;
- contrato de contagem e limite de palavras;
- exports centralizados do domínio;
- testes dos contratos utilizados pela interface.

Não foram implementadas regras que alteram o estado da partida. Máquina de
estados, transições, pontuação e decisões autoritativas continuam pendentes
para o backend.

```text
Implementado agora
├── Como os dados são representados
├── Como o frontend valida a estrutura dos dados
└── Como o frontend conta palavras

Pendente para o backend
├── Quais transições são permitidas
├── Quando a partida avança
├── Quem pontua
└── Como pausa e retomada alteram o estado
```

---

## O que é o domínio da aplicação

O domínio representa os conceitos e as regras do produto sem depender da
tecnologia usada para exibi-los ou armazená-los.

No Uma Frase, alguns conceitos do domínio são:

- partida;
- jogador;
- rodada;
- resposta;
- fase atual;
- limite de palavras.

Esses conceitos ficam em `src/domain` porque serão utilizados por mais de uma
parte da aplicação:

```text
Frontend ─┐
          ├── src/domain
Backend  ─┘
```

O diretório de domínio não importa componentes React, rotas do Next.js,
Supabase ou Gemini. Isso mantém o contrato independente da infraestrutura.

Estrutura criada:

```text
src/domain/
├── index.ts
└── game/
    ├── entities.ts
    ├── index.ts
    ├── schemas.ts
    ├── schemas.test.ts
    ├── word-count.ts
    └── word-count.test.ts
```

---

## Constantes do jogo

As decisões já confirmadas para o MVP foram transformadas em constantes:

```ts
export const MAX_PLAYERS = 2 as const;
export const MAX_ROUNDS = 8 as const;
export const ANSWER_DURATION_SECONDS = 10 as const;
export const MIN_WORD_LIMIT = 1 as const;
export const MAX_WORD_LIMIT = 15 as const;
```

Isso evita espalhar números sem contexto pelo código:

```ts
if (players.length === 2) {
  // O que significa 2?
}
```

Com uma constante, a intenção fica explícita:

```ts
if (players.length === MAX_PLAYERS) {
  // Agora sabemos que a regra trata do limite de jogadores.
}
```

### O que significa `as const`

Sem `as const`, o TypeScript normalmente entende:

```ts
const MAX_ROUNDS = 8;
// tipo inferido: 8 para uma constante simples
```

O uso de `as const` também é importante em objetos e listas porque pede ao
TypeScript que preserve os valores literais e a imutabilidade da declaração.

No tipo `Game`, isso permite escrever:

```ts
maxRounds: typeof MAX_ROUNDS;
```

O campo não aceita qualquer número. Seu tipo é literalmente `8`:

```ts
const validGame = {
  maxRounds: 8,
};

const invalidGame = {
  maxRounds: 10, // não corresponde ao contrato do MVP
};
```

Os pesos usados para sortear limites de palavras não foram definidos. Apenas o
intervalo de 1 a 15 foi registrado, mantendo os pesos ajustáveis.

---

## Fases da partida

As fases aprovadas são declaradas em uma única lista:

```ts
export const GAME_STATUSES = [
  "waiting",
  "generating",
  "situation",
  "answering",
  "judging",
  "judging_error",
  "reveal",
  "paused",
  "finished",
] as const;
```

Cada valor representa um momento da partida:

| Fase | Significado para a interface |
| --- | --- |
| `waiting` | Aguardando jogadores no lobby |
| `generating` | Preparando a situação da rodada |
| `situation` | Exibindo a situação aos jogadores |
| `answering` | Permitindo que os jogadores respondam |
| `judging` | Aguardando o julgamento |
| `judging_error` | Julgamento falhou e poderá ser repetido |
| `reveal` | Mostrando respostas, vencedor e continuação |
| `paused` | Partida interrompida temporariamente |
| `finished` | Oito rodadas concluídas |

O tipo é derivado da própria lista:

```ts
export type GameStatus = (typeof GAME_STATUSES)[number];
```

O resultado é equivalente a:

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
```

Derivar o tipo da lista evita manter duas declarações separadas que poderiam
ficar diferentes com o tempo.

### Fases que podem ser pausadas

Também existe uma lista específica:

```ts
export const PAUSABLE_GAME_STATUSES = [
  "generating",
  "situation",
  "answering",
  "judging",
  "judging_error",
  "reveal",
] as const;
```

Ela permite tipar a fase preservada em `pausedFrom`. `waiting`, `paused` e
`finished` não aparecem porque não são fases ativas que precisem ser retomadas.

Essa lista representa o contrato de dados. A regra que decide quando pausar ou
retomar ainda será implementada no backend.

---

## Entidades

Uma entidade representa algo que possui identidade e significado dentro do
produto.

### `Game`

```ts
export type Game = {
  id: string;
  code: string;
  status: GameStatus;
  hostPlayerId: string;
  round: number;
  maxRounds: typeof MAX_ROUNDS;
  storySummary: string;
  pausedFrom: PausableGameStatus | null;
  createdAt: string;
};
```

Responsabilidades dos campos:

| Campo | Significado |
| --- | --- |
| `id` | Identificador interno da partida |
| `code` | Código usado para entrar na sala |
| `status` | Fase atual |
| `hostPlayerId` | Jogador que criou a sala |
| `round` | Número da rodada atual |
| `maxRounds` | Total fixo de oito rodadas |
| `storySummary` | Resumo acumulado da história |
| `pausedFrom` | Fase que deverá ser retomada após uma pausa |
| `createdAt` | Data de criação em formato textual ISO |

O tipo diz como uma partida é representada. Ele não contém métodos para iniciar
ou avançar a partida.

### `Player`

```ts
export type Player = {
  id: string;
  gameId: string;
  name: string;
  score: number;
  isConnected: boolean;
};
```

O `gameId` relaciona o jogador à partida. A interface poderá usar `score` para
exibir o placar e `isConnected` para mostrar presença ou desconexão.

### `Round`

```ts
export type Round = {
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
```

Uma rodada concentra o conteúdo que muda durante a partida:

- situação apresentada;
- limite de palavras;
- prazo da resposta;
- vencedor;
- justificativa;
- continuação da história;
- próxima situação.

Os campos que ainda não possuem valor utilizam `null`. Por exemplo, antes do
julgamento ainda não existe `winnerPlayerId`.

### `Answer`

```ts
export type Answer = {
  id: string;
  roundId: string;
  playerId: string;
  text: string;
  submittedAt: string;
};
```

A resposta está ligada a uma rodada e a um jogador. O tipo existe no contrato,
mas isso não significa que todas as respostas serão enviadas publicamente ao
frontend. O backend ainda deverá preservar o segredo das respostas até a fase
de revelação.

---

## Tipos TypeScript e schemas Zod

Os tipos TypeScript verificam o código durante o desenvolvimento:

```ts
const game: Game = {
  // O editor e o compilador verificam os campos aqui.
};
```

Porém, os tipos desaparecem depois da compilação. Um JSON recebido por HTTP não
carrega o tipo `Game` junto com seus dados.

Por isso foram criados schemas Zod:

```text
JSON externo
    ↓
schema Zod verifica o valor real
    ↓
objeto aceito como Game
    ↓
interface utiliza o dado tipado
```

Uma afirmação de tipo não valida nada:

```ts
const game = data as Game;
```

Ela apenas manda o TypeScript confiar no programador. O Zod examina o objeto em
tempo de execução:

```ts
const result = gameSchema.safeParse(data);

if (!result.success) {
  // Os dados recebidos não correspondem ao contrato.
  return;
}

const game = result.data;
```

O Zod é usado nas fronteiras da aplicação, como respostas HTTP, Realtime,
`localStorage` ou conteúdo vindo de serviços externos. Valores criados e
controlados internamente continuam usando normalmente os tipos TypeScript.

---

## Como os schemas foram construídos

### Enum das fases

```ts
export const gameStatusSchema = z.enum(GAME_STATUSES);
```

O schema reutiliza a mesma lista usada pelo tipo TypeScript. Assim, `answering`
é aceito e um valor desconhecido como `playing` é recusado.

### Identificadores

```ts
const identifierSchema = z.string().trim().min(1);
```

O identificador precisa:

1. ser uma string;
2. ter espaços externos removidos;
3. possuir pelo menos um caractere.

Valores vazios ou contendo apenas espaços são recusados.

### Datas

```ts
const isoDateTimeSchema = z.iso.datetime({ offset: true });
```

O formato esperado é semelhante a:

```text
2026-09-24T12:00:00.000Z
```

Isso permite que frontend e backend troquem datas em um formato textual
padronizado.

### Limite de palavras

```ts
export const wordLimitSchema = z
  .number()
  .int()
  .min(MIN_WORD_LIMIT)
  .max(MAX_WORD_LIMIT);
```

O valor precisa ser um número inteiro entre 1 e 15. O schema aceita o limite
recebido; ele não decide como o servidor fará o sorteio.

### Schema de partida

```ts
export const gameSchema: z.ZodType<Game> = z.object({
  id: identifierSchema,
  code: z.string().trim().min(1),
  status: gameStatusSchema,
  hostPlayerId: identifierSchema,
  round: z.number().int().min(0).max(MAX_ROUNDS),
  maxRounds: z.literal(MAX_ROUNDS),
  storySummary: z.string(),
  pausedFrom: pausableGameStatusSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
```

A declaração `z.ZodType<Game>` conecta o schema ao tipo TypeScript. Se o tipo e
o schema deixarem de representar a mesma estrutura, a verificação de tipos
deverá acusar a incompatibilidade.

O mesmo padrão foi aplicado a:

```ts
z.ZodType<Player>
z.ZodType<Round>
z.ZodType<Answer>
```

### `parse` e `safeParse`

`parse` devolve o valor validado ou lança um erro:

```ts
const game = gameSchema.parse(data);
```

`safeParse` devolve um resultado que pode ser tratado sem exceção:

```ts
const result = gameSchema.safeParse(data);

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error.issues);
}
```

Para respostas de API no frontend, `safeParse` costuma ser útil quando a
interface precisa apresentar um estado de erro controlado.

---

## Contagem de palavras

O frontend precisa mostrar a contagem enquanto a pessoa escreve e impedir que
o texto ultrapasse o limite da rodada.

### Função `countWords`

```ts
export function countWords(text: string): number {
  const normalizedText = text.trim();

  if (normalizedText.length === 0) return 0;

  return normalizedText.split(/\s+/u).length;
}
```

O funcionamento ocorre em três etapas.

#### 1. Remover espaços externos

```ts
text.trim()
```

```text
"   uma frase   " → "uma frase"
```

#### 2. Tratar texto vazio

```ts
if (normalizedText.length === 0) return 0;
```

Isso evita que uma string vazia seja contada como uma palavra.

#### 3. Separar por espaços

```ts
normalizedText.split(/\s+/u)
```

A expressão `/\s+/u` encontra um ou mais caracteres de espaço, incluindo:

- espaço comum;
- múltiplos espaços;
- quebra de linha;
- tabulação.

Exemplo:

```ts
countWords("  uma   frase\npor\tvez  ");
// 4
```

A pontuação anexada não cria uma nova palavra:

```ts
countWords("Ola, mundo!");
// 2
```

### Função `checkWordLimit`

```ts
export function checkWordLimit(
  text: string,
  limit: number,
): WordCountResult {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(
      "O limite de palavras deve ser um inteiro positivo.",
    );
  }

  const count = countWords(text);

  return {
    count,
    limit,
    isWithinLimit: count <= limit,
  };
}
```

Uso futuro em um campo de resposta:

```ts
const result = checkWordLimit(answerText, round.wordLimit);

console.log(result.count);
console.log(result.isWithinLimit);
```

Exemplo de resultado:

```ts
{
  count: 3,
  limit: 2,
  isWithinLimit: false,
}
```

O frontend poderá usar `isWithinLimit` para desabilitar o envio. O backend
ainda deverá repetir a validação, porque uma pessoa pode modificar ou ignorar o
código executado no navegador.

---

## Exportação do domínio

O arquivo `src/domain/game/index.ts` exporta o contrato do jogo:

```ts
export * from "./entities";
export * from "./schemas";
export * from "./word-count";
```

O arquivo `src/domain/index.ts` exporta o módulo completo:

```ts
export * from "./game";
```

Esse padrão é conhecido como **barrel export**. Ele permite importar pelo ponto
central:

```ts
import {
  gameSchema,
  countWords,
  type Game,
} from "@/domain";
```

Sem esse arquivo, seria necessário conhecer o caminho de cada implementação:

```ts
import type { Game } from "@/domain/game/entities";
import { gameSchema } from "@/domain/game/schemas";
import { countWords } from "@/domain/game/word-count";
```

O ponto central reduz o acoplamento dos consumidores à organização interna das
pastas.

---

## Testes automatizados

Foi adicionado o Vitest para executar testes unitários em TypeScript.

Comando:

```bash
npm test
```

### Testes dos schemas

`schemas.test.ts` verifica:

- todas as fases aprovadas;
- estrutura de uma partida;
- rejeição de fase desconhecida;
- estrutura de jogador;
- estrutura de rodada;
- limites mínimo e máximo de palavras;
- estrutura de resposta.

Um exemplo usa `safeParse`:

```ts
expect(
  gameSchema.safeParse({
    ...game,
    status: "unknown",
  }).success,
).toBe(false);
```

O teste demonstra que um valor desconhecido não entra silenciosamente no
frontend.

### Testes da contagem

`word-count.test.ts` verifica:

- múltiplos espaços;
- quebras de linha e tabulações;
- pontuação anexada;
- texto vazio;
- excesso do limite;
- limites inválidos.

No estado atual foram executados:

```text
2 arquivos de teste
10 testes aprovados
```

Também foram aprovados:

```bash
npm run typecheck
npm run lint
npm run build
```

---

## Fluxo futuro no frontend

Quando a API for implementada, o caminho esperado será semelhante a:

```text
1. Frontend solicita o estado da sala
              ↓
2. Servidor devolve JSON
              ↓
3. Frontend trata o JSON como unknown
              ↓
4. Zod valida a estrutura
              ↓
5. Dado válido se torna Game, Player ou Round
              ↓
6. A interface escolhe o que apresentar pela fase
```

Exemplo simplificado:

```ts
async function loadGame(): Promise<Game> {
  const response = await fetch("/api/rooms/ABC123/state");
  const data: unknown = await response.json();

  return gameSchema.parse(data);
}
```

Uma tela poderá reagir ao status:

```ts
switch (game.status) {
  case "waiting":
    // mostrar lobby
    break;
  case "answering":
    // mostrar campo de resposta e contador
    break;
  case "reveal":
    // mostrar vencedor e continuação
    break;
}
```

Esse `switch` apenas escolhe a interface. Ele não muda a fase da partida.

---

## O que ficou para o backend

Apesar do título da issue mencionar máquina de estados, ela ainda não foi
implementada nesta parte frontend.

O trabalho restante inclui:

- definir os eventos da partida;
- implementar as transições permitidas;
- recusar transições proibidas;
- garantir exatamente dois jogadores no início;
- controlar o avanço até oito rodadas;
- preservar e restaurar a fase durante uma pausa;
- decidir pontuação e vitória contra ausência;
- não pontuar quando ambos ficam ausentes;
- testar caminhos válidos, inválidos e invariantes.

Essas regras pertencem ao domínio autoritativo. Mesmo que o frontend desabilite
um botão, o servidor precisa validar novamente a ação recebida.

```text
Frontend
├── representa os dados
├── valida o formato recebido
├── mostra a fase atual
└── orienta a interação

Backend
├── autoriza ou recusa eventos
├── muda a fase
├── controla prazo e rodada
├── protege respostas
└── calcula o resultado oficial
```

---

## Resumo mental

```text
entities.ts
→ define como os dados são representados no TypeScript

schemas.ts
→ verifica valores reais recebidos em tempo de execução

word-count.ts
→ conta palavras e informa se o texto respeita o limite

index.ts
→ oferece um ponto central para importar o domínio

*.test.ts
→ demonstra e protege o comportamento esperado
```

A ideia central desta etapa é:

> O frontend conhece o formato e o vocabulário da partida, mas não possui
> autoridade para alterar sozinho as regras ou o estado oficial do jogo.
