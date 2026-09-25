# Validacao local

Use Node.js 20.19 ou uma versao mais recente compativel com o campo `engines`
do `package.json`. Instale as dependencias reproduziveis do lockfile com:

```bash
npm ci
```

As validacoes podem ser executadas separadamente:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Durante o desenvolvimento, use `npm run test:watch` para manter os testes em
execucao e `npm run format` para aplicar a formatacao.

O workflow `.github/workflows/ci.yml` executa essas verificacoes em toda
pull request e em pushes para `main`. Como os passos fazem parte do mesmo job,
uma falha interrompe as validacoes seguintes e impede que o job seja aprovado.

Os testes atuais sao intencionalmente minimos: um comprova a execucao de regras
puras em TypeScript na camada de dominio e outro renderiza um componente React.
As regras completas do jogo pertencem as issues especificas de dominio.
