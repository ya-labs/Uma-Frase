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

## Salas

`rooms` centraliza identidade, autorizacao, estado filtrado e as operacoes do
lobby. As rotas em `app/api/rooms` apenas validam o transporte e delegam para
esse servico:

- `POST /api/rooms` cria a sala;
- `POST /api/rooms/:code/join` ocupa ou recupera uma vaga;
- `GET /api/rooms/:code/state` retorna a visao do jogador;
- `POST /api/rooms/:code/presence` atualiza presenca;
- `POST /api/rooms/:code/start` inicia a partida pelo host.

O token bruto fica no `sessionStorage` da aba e segue no cabecalho `Bearer`.
Somente o hash chega ao banco. As funcoes SQL fazem bloqueio e transicoes
atomicas; o cliente administrativo continua restrito ao servidor.

O canal Realtime e uma notificacao publica sem estado privado. Seu conteudo nao
e autoritativo: ao recebe-lo, o navegador refaz a leitura HTTP autenticada.
