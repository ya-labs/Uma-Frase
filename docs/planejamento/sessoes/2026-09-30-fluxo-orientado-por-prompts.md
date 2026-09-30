# Fluxo orientado por prompts de IA — 2026-09-30

## Contexto

Nicolas e Marco decidiram desenvolver todo o projeto com auxilio de IA. O fluxo
anterior dividia o roadmap em muitas issues pequenas, cada uma com sua propria
branch e Pull Request. Essa granularidade aumentava o custo operacional e
interrompia a continuidade das sessoes de desenvolvimento.

## Decisao

O projeto passara a utilizar issues amplas por responsavel e lote. Cada pessoa
mantera no maximo uma issue e uma branch ativas. As entregas internas serao
checklists cujos itens funcionam como prompts grandes, autocontidos e
verificaveis para IA.

Cada prompt deve declarar objetivo, contexto, entrega, limites, dependencias,
criterios de aceite e validacoes. Depois da execucao, a pessoa revisa o diff,
executa as validacoes e cria um commit de checkpoint. Um unico Pull Request sera
aberto ao concluir todos os prompts da issue.

## Colaboracao

Frontend e backend podem avancar em paralelo em branches separadas. Quando uma
issue precisar dos dois responsaveis, a branch sera compartilhada por
revezamento, nunca por escrita simultanea. O repasse deve registrar:

- hash do commit;
- validacoes executadas;
- contratos alterados;
- parte concluida;
- trabalho restante;
- pessoa para quem a branch foi liberada.

## Impactos

- reduz a quantidade de branches e Pull Requests;
- preserva rastreabilidade com uma issue por branch;
- fornece contexto completo para novas sessoes de IA;
- facilita reversao por meio dos commits de checkpoint;
- exige prompts objetivos mesmo quando a alteracao for grande;
- exige integracao previa dos contratos compartilhados;
- mantem a `main` protegida e elimina a necessidade de uma branch `dev`.

## Limites

- A decisao nao altera arquitetura, escopo ou regras do MVP 0.1.
- Issues ja concluidas nao serao reescritas.
- Issues atuais podem terminar no formato em que foram iniciadas.
- O novo modelo sera aplicado prioritariamente aos proximos lotes.

## Pendencias

- reorganizar as issues futuras do roadmap em entregas amplas de frontend e
  backend;
- definir os primeiros checklists de prompts quando o proximo lote for aberto;
- avaliar a exclusao automatica de branches apos merge.
