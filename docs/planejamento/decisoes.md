# Decisoes de planejamento

## 2026-09-18

### Produto e versao

- O nome oficial do jogo e **Uma Frase**.
- A primeira versao planejada e **MVP 0.1**.
- O projeto nao utilizara milestones. Na data, o desenvolvimento seguiria por
  issues pequenas em ordem continua; essa granularidade foi substituida pela
  decisao de 2026-09-30.

### Plataforma e arquitetura

- A aplicacao usara Next.js e TypeScript.
- O deploy sera feito na Vercel, e nao no GitHub Pages, porque o jogo precisa de
  rotas server-side e integracao segura com IA.
- Supabase Postgres sera a fonte de verdade.
- Supabase Realtime notificara os clientes sobre alteracoes de estado.
- O servidor sera autoridade sobre fases, prazos, respostas e pontuacao.

### Inteligencia artificial

- O MVP usara Gemini API no plano gratuito.
- O modelo permanecera configuravel por ambiente.
- A chave ficara apenas no servidor.
- As respostas seguirao schema estruturado e validacao local.
- Dados pessoais ou sensiveis nao serao enviados ao provedor.

### Partida

- A partida tera dois jogadores e oito rodadas.
- Nao havera login.
- Cada rodada tera um minuto para resposta, encerrando antes se ambos enviarem.
- O limite sera revelado depois da situacao.
- Respostas serao secretas ate o encerramento da rodada.
- Uma resposta vence automaticamente contra uma ausencia.
- Duas ausencias nao geram ponto.
- Desconexao pausa a partida e permite reconexao sem derrota automatica.

### Conteudo

- A classificacao sera adulta.
- Serao permitidos violencia ficcional, humor sombrio, palavroes e situacoes
  moralmente desconfortaveis.
- Serao excluidos sexo explicito, violencia sexual, ataques a grupos protegidos
  e incentivo a dano no mundo real.

## 2026-09-30

### Desenvolvimento orientado por prompts de IA

- O trabalho continuara sem milestones.
- Cada lote tera, como regra, uma issue ampla de frontend para Nicolas e uma
  issue ampla de backend para Marco.
- Cada pessoa manterá no maximo uma issue e uma branch ativas.
- Uma branch pertence a uma unica issue e termina em um unico Pull Request.
- Cada item do checklist sera um prompt grande, autocontido e verificavel para
  IA, com objetivo, contexto, entrega, limites, dependencias, criterios de
  aceite e validacoes.
- Cada prompt concluido gera um commit de checkpoint na mesma branch.
- Duas pessoas ou duas IAs nao trabalharao simultaneamente na mesma branch.
- Trabalho compartilhado usara revezamento com worktree limpo, commit, push e
  repasse explicito de contexto.
- A `main` permanecera protegida e nao sera criada uma branch `dev` permanente.
- Branches concluidas deverao ser removidas depois do merge.
- Issues futuras serao maiores; tarefas internas serao checklists, nao novas
  issues e branches por padrao.

## Decisoes pendentes

- Pesos exatos da distribuicao dos limites de palavras.
- Duracao visual entre a situacao e a revelacao do limite.
- Modelo Gemini gratuito a ser selecionado no momento da integracao.
- Identidade visual, tipografia, sons e intensidade das animacoes.
- Politica de expiracao e limpeza de salas abandonadas.
