# Gemini e publicação do MVP

## Provedor

O adaptador usa `@google/genai` exclusivamente no servidor e valida todo retorno
com Zod. A credencial e o modelo são obrigatórios em `GEMINI_API_KEY` e
`GEMINI_MODEL`; nenhum modelo é escolhido implicitamente. Uma resposta do
provedor não escreve no banco: somente uma RPC transacional confirma o resultado.

Cada trabalho possui uma reserva de 55 segundos no Postgres. A chamada tem
timeout de 20 segundos e permite uma única repetição para falhas transitórias
(408, 429, 5xx, rede/timeout), com intervalo de um segundo. O retry interno do SDK
está desativado. Falhas estruturais e de credencial não são repetidas. Falha no
julgamento preserva as respostas em `judging_error`; a repetição manual respeita
um cooldown de cinco segundos. Falhas de geração/epílogo preservam sua fase e
expõem apenas um indicador genérico recuperável.

O resultado atômico inclui vencedor elegível ou `null`, justificativa,
continuação, próxima situação, resumo substituto e placar. O host confirma o
avanço após a revelação, para que ambos possam ler o resultado. Na oitava
rodada, uma nova reserva gera um epílogo estruturado e encerra a partida.

Os prompts usam aliases anônimos, não nomes, tokens ou IDs do banco. O resumo é
limitado a 6.000 caracteres, a situação e cada resposta a 2.000. Emails,
documentos, telefones e URLs reconhecíveis são removidos antes do envio. Isso não
é garantia de anonimização de texto livre: os jogadores não devem informar
dados pessoais ou sensíveis. Conteúdo enviado ao plano gratuito pode ser usado
pelo provedor; o modelo e suas quotas precisam ser conferidos antes de publicar.

As regras permitem violência ficcional, humor sombrio e linguagem forte, mas
proíbem sexo explícito, violência sexual, ataques a grupos protegidos e incentivo
a dano real. Os filtros do provedor podem recusar conteúdo mesmo permitido pelo
jogo. Não se desabilitam todas as proteções para contornar uma recusa.

Referências verificadas na implementação:
[saída estruturada](https://ai.google.dev/gemini-api/docs/structured-output),
[falhas e retry](https://ai.google.dev/gemini-api/docs/troubleshooting),
[configurações de segurança](https://ai.google.dev/gemini-api/docs/safety-settings).

## Desenvolvimento sem chave

`UMA_FRASE_AI_PROVIDER=demo npm run dev` ativa explicitamente um provedor
determinístico. Ele não é um julgamento Gemini e nunca é fallback automático
para credencial ausente. Não configure essa variável na publicação Gemini.

## Publicar na Vercel

1. Vincule o repositório à Vercel usando o preset Next.js e Node compatível com
   `package.json`. Use um projeto Supabase dedicado ao ambiente.
2. Configure as variáveis públicas de `.env.example`, com
   `NEXT_PUBLIC_APP_URL` igual à URL publicada. Chave pública/publishable não é
   service role.
3. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` e
   `GEMINI_MODEL` como variáveis server-side. Nunca use prefixo `NEXT_PUBLIC_`
   para segredos nem cole credenciais em issues, logs ou PRs.
4. Confira migrations com `supabase db push --linked --dry-run`, aplique apenas
   as pendentes no ambiente escolhido e execute lint/testes. Não faça reset de
   um projeto vinculado.
5. Verifique se o plano permite as rotas com `maxDuration = 60`. Cada requisição
   executa no máximo um trabalho narrativo; o epílogo é uma requisição separada.
6. Abra dois clientes distintos, jogue oito rodadas e confira privacidade,
   excesso de palavras, ausência, pausa/reconexão, resultado e epílogo.
7. Simule erro de provedor, verifique recuperação sem perder respostas e
   registre latência, recusas e quotas reais observadas. Não presuma quotas
   fixas a partir do modelo de demonstração.

## Evidência desta entrega

129 testes de aplicação, 15 novos testes SQL transacionais, lint SQL e build
passaram. O script `scripts/verify-narrative-engine.mjs` completou oito rodadas
com chamadas concorrentes numa sala sintética de desenvolvimento e removeu
somente essa sala após o teste.

A chamada Gemini real e o fluxo publicado **não foram validados**: credencial,
modelo e projeto Vercel não estão configurados nesta sessão. O último checklist
da #21 permanece pendente até essa prova. Teste de demonstração não substitui a
validação publicada.
