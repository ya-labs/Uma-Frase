# Configuracao de ambiente

O projeto separa a configuracao publica da configuracao server-side. Somente
variaveis com o prefixo `NEXT_PUBLIC_` podem ser lidas pelo navegador. A chave
`SUPABASE_SERVICE_ROLE_KEY` e a `GEMINI_API_KEY` nunca devem receber esse
prefixo nem ser importadas por componentes client-side.

## Variaveis

| Variavel                               | Ambiente  | Uso                                |
| -------------------------------------- | --------- | ---------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | navegador | URL publica da aplicacao           |
| `NEXT_PUBLIC_SUPABASE_URL`             | navegador | URL publica do projeto Supabase    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | navegador | chave publicavel do Supabase       |
| `SUPABASE_URL`                         | servidor  | URL do mesmo projeto Supabase      |
| `SUPABASE_SERVICE_ROLE_KEY`            | servidor  | acesso administrativo ao Supabase  |
| `GEMINI_API_KEY`                       | servidor  | autenticacao da API Gemini         |
| `GEMINI_MODEL`                         | servidor  | modelo Gemini usado pela aplicacao |

`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_URL` normalmente recebem a mesma URL.
A duplicacao mantem cada cliente dependente apenas do seu proprio conjunto de
configuracoes.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local`.
2. Preencha a URL, a Publishable key e a Secret key do projeto Supabase de
   desenvolvimento.
3. Execute `npm run dev`.

`GEMINI_API_KEY` e `GEMINI_MODEL` podem permanecer vazias ate a issue de
integracao com o Gemini. A configuracao do Supabase remoto permite desenvolver
sem executar o stack local em Docker.

Os arquivos `.env*` reais sao ignorados pelo Git. Apenas `.env.example`, sem
segredos, deve ser versionado. Quando um cliente for criado com configuracao
ausente ou invalida, a aplicacao informa os nomes das variaveis com problema,
sem incluir os valores recebidos na mensagem.

## Vercel

Cadastre as mesmas variaveis em **Project Settings > Environment Variables** e
selecione os ambientes que devem recebe-las. Use valores separados quando
Preview e Production apontarem para projetos diferentes.

Depois de alterar qualquer `NEXT_PUBLIC_*`, gere um novo deploy: o Next.js
incorpora essas variaveis ao bundle durante o build. As quatro variaveis sem o
prefixo publico ficam disponiveis somente no runtime server-side.

## Uso no codigo

- `getSupabaseBrowserClient()` fornece o singleton publico do navegador.
- `createSupabaseAdminClient()` fornece um cliente privilegiado somente no
  servidor.
- `createGeminiServerClient()` fornece o SDK e o modelo configurado somente no
  servidor.

Os modulos server-side importam `server-only`, portanto o Next.js interrompe o
build caso eles sejam puxados acidentalmente para um Client Component.
