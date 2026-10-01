# QA do MVP 0.1

## Estado da entrega — 01/10/2026

O código das issues #19, #21 e #20 implementa a partida completa. A validação com
Gemini real e ambiente Vercel continua pendente na #21: não há credencial,
modelo ou projeto de publicação configurado nesta sessão.

## Evidências locais

- 137 testes de aplicação passaram, incluindo relógio controlado, contagem,
  privacidade, revisões atrasadas, pausa, estado confirmado e recuperação.
- Os 14 novos testes SQL da reconexão passaram em transação com rollback no
  Supabase de desenvolvimento. Incluem preservação do prazo, nenhuma derrota por
  desconexão e julgamento em andamento durante uma pausa.
- Três cenários Playwright passaram com duas janelas reais do Chrome, uma delas
  com viewport mobile e toque:
  1. Criação/entrada pela interface, oito rodadas, excesso de palavras, atalho de
     teclado, privacidade, placar compartilhado, epílogo e recarga final.
  2. Perda de rede, pausa confirmada pelo servidor, recarga com resposta privada
     preservada e retomada com o tempo restante.
  3. Falha narrativa simulada, respostas privadas preservadas, cooldown público e
     repetição autorizada.
- Axe não reportou violações nas telas de resultado mobile e encerramento
  desktop avaliadas com regras WCAG 2 A/AA e 2.1 AA. As capturas foram revisadas
  visualmente. Isso não substitui uma auditoria completa de acessibilidade.
- Formatação, lint, tipos e build passaram. Next.js/eslint-config-next foram
  atualizados de 16.3.5 para 16.3.8; a instalação reportou zero vulnerabilidades.

## Executar

`npm run test:e2e` exige Chrome instalado e as variáveis Supabase de um ambiente
dedicado de desenvolvimento em `.env.local`. O servidor de teste usa a porta
3100 e ativa explicitamente `UMA_FRASE_AI_PROVIDER=demo`. Não execute contra um
projeto de produção. Pare outra instância `next dev` da mesma pasta antes de
executar o teste.

Os testes criam somente salas e identidades sintéticas. A limpeza elimina
exclusivamente os IDs criados por cada execução. Capturas ficam em
`test-results/`, ignorado pelo Git; nenhuma chave ou trace de rede é publicado.

No CI, o job Database executa os mesmos cenários com Supabase local isolado e
Chrome do runner, sem credenciais hospedadas nem chamadas Gemini.

## Reconexão e autoridade

O cliente consulta o estado a cada segundo e envia presença a cada dois
segundos, independentemente de uma chamada narrativa em andamento. O servidor
considera presença vencida após seis segundos, pausa e guarda o tempo restante,
limitado ao prazo original. A reconexão só retoma depois que ambos estão
presentes. Uma leitura de presença não altera a revisão pública quando nada
visível mudou.

O frontend não muda fase, vencedor, pontuação ou prazo por conta própria. O
cronômetro visual usa `answerDeadlineAt`, o instante do servidor e o instante de
recebimento. Durante pausa, representa o tempo congelado confirmado. Estados
mais antigos são recusados pela revisão monotônica, e falha de leitura mantém a
última tela e a resposta confirmadas.

## Pendência externa

Concluir a prova publicada descrita em
[Gemini e publicação](./gemini-e-publicacao.md), usando chave real configurada
fora do repositório. Os testes de demonstração não permitem concluir nada sobre
latência, quotas ou recusas reais do Gemini.
