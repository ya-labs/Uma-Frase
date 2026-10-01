# Motor autoritativo de rodadas

As rotas HTTP autenticam o token opaco da aba e enviam somente seu hash ao
Postgres. As operações `open_round`, `submit_round_answer` e `tick_round`
adquirem primeiro o mesmo bloqueio de partida. As permissões são exclusivas de
`service_role`: clientes não consultam tabelas nem invocam as RPCs.

O servidor sorteia uma vez o limite usando os pesos ajustáveis
`[1,2,2,10,10,10,10,10,10,10,2,2,2,2,2]`. A situação é exibida por dois segundos
antes de abrir um prazo de dez segundos calculado pelo banco. Leituras e
operações conferem o prazo; não há worker dependente de memória de uma instância.
Sem clientes conectados, a transição vencida é confirmada na próxima operação,
sem aceitar respostas tardias nem estender um prazo já iniciado.

Cada jogador possui uma resposta por rodada. Repetir o mesmo texto retorna o
mesmo registro, inclusive depois do encerramento; outro texto é recusado.
Pontuação anexada não adiciona palavras. O conjunto de separadores Unicode é o
mesmo de `String.trim` e `\s` no domínio JavaScript. O limite de transporte é
2.000 caracteres, além do limite de palavras da rodada.

Uma resposta concede um ponto; nenhuma não concede ponto; duas encaminham para
`judging`. A integração narrativa e as próximas rodadas pertencem à #21. O
estado privado da sala é projetado por `buildRoomState`, que só publica textos
adversários e resultado em `reveal`/`finished`.

## Verificação

- `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`.
- `supabase test db --local` no CI com Docker (pgTAP e rollback).
- `supabase db lint --linked --schema public --level warning --fail-on error` no desenvolvimento.
- `node --env-file=.env.local scripts/verify-round-engine.mjs`: teste opt-in de
  concorrência no projeto de desenvolvimento, com sala sintética e remoção
  exclusivamente dos IDs criados pela execução. Nunca aponta para produção.
