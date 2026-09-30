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

## Desenvolvimento com Docker

Quando um runtime compativel com Docker estiver disponivel, depois de instalar
as dependencias execute:

```bash
npm run db:start
npm run db:reset
npm run db:test
npm run db:lint
```

`db:reset` recria o banco do zero a partir das migrations. `db:test` executa os
casos pgTAP de integridade, funcoes atomicas e acesso positivo/negativo. O lint
usa o analisador do Postgres fornecido pelo Supabase CLI.

Nenhum desses comandos conecta a um projeto remoto. O mesmo fluxo e executado
pelo job `Database` do GitHub Actions em pull requests, portanto a ausencia de
Docker em uma maquina corporativa nao impede a validacao automatizada.

## Desenvolvimento remoto sem Docker

Na maquina corporativa, a aplicacao usa um projeto Supabase remoto reservado
para desenvolvimento. Vincule explicitamente o projeto e revise as migrations
antes de aplica-las:

```bash
npx supabase link --project-ref PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list --linked
npx supabase db lint --linked --schema public --level warning --fail-on error
```

`db push` aplica somente migrations ainda ausentes no historico remoto. Ele
altera o banco e nao substitui a revisao previa nem os testes pgTAP do CI.
Nunca use `db reset --linked` em um ambiente com dados que devam ser
preservados.

As credenciais do projeto remoto ficam apenas em `.env.local`. O Project ref,
a URL e as chaves nao devem ser fixados nos scripts ou na documentacao, pois
cada ambiente possui valores proprios.
