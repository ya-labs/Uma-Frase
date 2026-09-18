# Roadmap de Uma Frase

## Forma de trabalho

O projeto nao utilizara milestones. O trabalho sera organizado como um fluxo
continuo de issues pequenas, independentes quando possivel e ordenadas pelo
valor necessario para chegar ao primeiro jogo completo.

## Ordem de implementacao

1. Inicializar o projeto Next.js com TypeScript e validacoes basicas.
2. Consolidar entidades, schemas Zod e maquina de estados compartilhada.
3. Criar schema do Supabase e regras de acesso server-side.
4. Implementar criacao de sala, entrada por codigo e identidade por aba.
5. Sincronizar lobby, presenca e inicio da partida entre dois clientes.
6. Implementar geracao da situacao e distribuicao do limite de palavras.
7. Implementar cronometro autoritativo de dez segundos.
8. Implementar envio privado e validacao compartilhada das respostas.
9. Integrar Gemini com retorno estruturado e validacao local.
10. Revelar vencedor, justificativa e continuacao de forma sincronizada.
11. Acrescentar oito rodadas, pontuacao, resumo narrativo e epilogo.
12. Implementar pausa, reconexao, idempotencia e recuperacao de erros.
13. Refinar tipografia, animacoes, responsividade e feedback visual.
14. Validar o fluxo completo publicado na Vercel com dois clientes reais.

## Regra de priorizacao

Nenhum modo futuro deve ser iniciado enquanto o fluxo principal de duas pessoas
nao estiver completo, sincronizado e validado. Cada issue deve preservar os
contratos compartilhados ou atualizar explicitamente consumidores e testes.

## Depois do MVP 0.1

Somente depois da validacao do nucleo poderao ser avaliados:

- partidas para ate seis jogadores;
- temas e configuracoes personalizadas;
- modos One Word, Sudden Death, Reverse, Palavra Proibida e Coop;
- contas, historico, ranking e matchmaking;
- recursos visuais, sonoros ou mobile adicionais.
