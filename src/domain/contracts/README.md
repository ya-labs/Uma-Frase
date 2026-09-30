# Shared contracts

Este modulo descreve dados, nao implementa transporte ou infraestrutura.

## HTTP

Cada operacao em `roomHttpContracts` possui metodo, caminho, schema do comando
e schema da resposta. Os comandos representam a entrada logica completa que o
frontend produz e o servidor valida:

- `roomCode` corresponde ao parametro `:code` do caminho;
- `playerToken` e uma credencial opaca e deve viajar em um cabecalho protegido,
  nunca na URL;
- os demais campos correspondem ao corpo JSON quando a operacao possuir corpo.

Todas as respostas usam `{ ok: true, data }` ou `{ ok: false, error }`. Os
schemas sao estritos para rejeitar campos inesperados em vez de remove-los
silenciosamente.

## Estado e Realtime

`RoomState` combina somente a visao publica e a visao privada do jogador atual.
O estado completo, com todas as respostas e o resumo da historia, pertence a
`src/server/contracts` e nao e exportado pelo barrel do dominio.

O evento `room_state_changed` carrega apenas o codigo da sala. Ao recebe-lo, o
cliente consulta novamente o endpoint de estado; o evento nunca substitui o
estado canonico do servidor.

## IA

`judgeResultSchema` valida a estrutura da saida do provedor. Depois dessa
validacao, `createEligibleJudgeResultSchema` aplica a regra contextual que
permite como vencedor somente um dos jogadores que responderam. A IA recebe
exatamente duas respostas; zero ou uma resposta sao resolvidas pelas regras do
dominio sem chamar o provedor.

As interfaces server-only em `src/server/ai` isolam os futuros adapters de IA
dos contratos compartilhados.
