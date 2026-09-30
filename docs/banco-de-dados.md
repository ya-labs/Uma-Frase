# Banco de dados

O schema inicial do jogo vive em migrations versionadas dentro de
`supabase/migrations`. Ele modela partidas, dois jogadores por partida, ate oito
rodadas e uma resposta por jogador em cada rodada.

## Modelo de acesso

As tabelas ficam no schema `public` para integracao com o Supabase, mas todas
possuem RLS habilitada e negam acesso direto aos papeis `anon` e
`authenticated`. O navegador recebe estado pelas rotas HTTP da aplicacao e usa
Realtime apenas como notificacao; ele nao consulta as tabelas do jogo.

Somente o cliente server-side, inicializado sem token de usuario e com a chave
privilegiada, usa o papel `service_role`. As funcoes
`create_game_with_host` e `join_game` sao atomicas, usam `security definer` com
`search_path` vazio e podem ser executadas apenas por esse papel.

Os tokens de reconexao nunca sao persistidos em texto puro. A coluna
`reconnect_token_hash` recebe apenas a representacao protegida produzida pelo
servidor.

## Desenvolvimento local

Um runtime compativel com Docker precisa estar ativo. Depois de instalar as
dependencias:

```bash
npm run db:start
npm run db:reset
npm run db:test
npm run db:lint
```

`db:reset` recria o banco do zero a partir das migrations. `db:test` executa os
casos pgTAP de integridade, funcoes atomicas e acesso positivo/negativo. O lint
usa o analisador do Postgres fornecido pelo Supabase CLI.

Nenhum desses comandos conecta a um projeto remoto. Publicacao futura deve
primeiro usar `supabase db push --dry-run` em um ambiente explicitamente
vinculado e revisado.
