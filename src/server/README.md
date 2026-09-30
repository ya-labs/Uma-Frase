# Server

Integracoes, repositorios e servicos que nao podem entrar no bundle do
navegador ficam neste diretorio. Modulos server-only devem importar
`server-only` para tornar essa fronteira verificavel pelo Next.js.

`contracts` guarda o estado completo da sala, incluindo respostas privadas e
resumo da historia. `ai` define as interfaces para geracao e julgamento; uma
integracao concreta com Gemini deve implementar essas portas sem alterar os
contratos compartilhados do dominio.

`environment.ts` valida a configuracao privada sob demanda. `supabase.ts` cria
o cliente administrativo sem persistencia de sessao, e `ai/gemini.ts` cria o
cliente oficial do Gemini junto ao nome do modelo configurado. Nenhum desses
modulos deve ser importado por componentes client-side.
