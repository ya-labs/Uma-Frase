# Estruturando uma aplicação Next.js com TypeScript

> Guia de estudo baseado na estrutura inicial do projeto **Uma Frase**.

## Sumário

1. [O que foi construído](#o-que-foi-construído)
2. [O que é Next.js](#o-que-é-nextjs)
3. [Como uma requisição é processada](#como-uma-requisição-é-processada)
4. [Estrutura do projeto](#estrutura-do-projeto)
5. [Server Components e Client Components](#server-components-e-client-components)
6. [TypeScript em modo estrito](#typescript-em-modo-estrito)
7. [Variáveis de ambiente e segurança](#variáveis-de-ambiente-e-segurança)
8. [Comandos principais](#comandos-principais)
9. [O que ainda não foi implementado](#o-que-ainda-não-foi-implementado)

---

## O que foi construído

A issue inicial criou a **fundação técnica** do projeto. Agora existe uma
aplicação Next.js executável, organizada e preparada para receber as próximas
funcionalidades do jogo.

Tecnologias configuradas:

| Tecnologia | Versão | Responsabilidade |
| --- | ---: | --- |
| Next.js | 16.3.5 | Framework da aplicação |
| React | 19.3.0 | Construção da interface com componentes |
| TypeScript | 5.9.3 | Tipagem estática do código |
| ESLint | 9.39.5 | Análise de qualidade e padrões do código |

Também foram criados:

- App Router;
- página inicial mínima;
- estrutura para componentes, domínio, servidor e código compartilhado;
- scripts de desenvolvimento, validação e produção;
- configuração de variáveis de ambiente sem segredos reais;
- separação explícita entre código do navegador e código do servidor.

Essa entrega ainda não implementa lobby, partida, banco de dados, multiplayer
ou integração com inteligência artificial.

---

## O que é Next.js

O **React** permite criar interfaces por meio de componentes. O **Next.js** usa
o React como base e acrescenta a estrutura necessária para construir uma
aplicação web completa.

Entre os recursos oferecidos pelo Next.js estão:

- roteamento baseado em arquivos;
- renderização de componentes no servidor;
- criação de endpoints HTTP;
- otimização e geração das páginas;
- separação entre código público e código privado;
- build de produção;
- integração direta com plataformas como a Vercel.

Em outras palavras:

```text
React   = componentes e interface
Next.js = React + rotas + servidor + build + convenções de projeto
```

O projeto utiliza o **App Router**, sistema moderno de rotas do Next.js. Nele,
as pastas e os arquivos dentro de `src/app` determinam os endereços disponíveis
na aplicação.

Exemplos:

```text
src/app/page.tsx                   → /
src/app/sobre/page.tsx             → /sobre
src/app/room/[code]/page.tsx       → /room/ABC123
src/app/api/rooms/route.ts         → /api/rooms
```

As três últimas rotas são apenas exemplos. Elas ainda não existem neste
projeto.

---

## Como uma requisição é processada

Quando uma pessoa abre `http://localhost:3000`, ocorre este fluxo simplificado:

```text
1. O navegador solicita GET /
              ↓
2. O Next.js encontra src/app/page.tsx
              ↓
3. A página renderiza seus componentes React
              ↓
4. src/app/layout.tsx envolve o conteúdo da página
              ↓
5. src/app/globals.css fornece os estilos globais
              ↓
6. O servidor devolve o HTML ao navegador
```

O arquivo `page.tsx` representa uma página. O `layout.tsx` representa a
estrutura compartilhada pelas páginas abaixo dele.

Neste projeto, o layout define:

```tsx
<html lang="pt-BR">
  <body>{children}</body>
</html>
```

O Next.js substitui `children` pelo conteúdo correspondente à rota acessada.

---

## Estrutura do projeto

```text
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── application-status.tsx
├── domain/
│   └── README.md
├── lib/
│   └── application.ts
└── server/
    ├── environment.ts
    └── README.md
```

### `src/app`

Contém as páginas, layouts, estilos globais e futuras rotas HTTP da aplicação.

- `page.tsx`: página inicial correspondente à rota `/`;
- `layout.tsx`: estrutura comum das páginas e metadados do documento;
- `globals.css`: estilos mínimos aplicados à aplicação inteira.

### `src/components`

Contém componentes visuais reutilizáveis.

O componente `ApplicationStatus` exibe a confirmação de que a aplicação está
funcionando. No futuro, essa pasta poderá ser organizada assim:

```text
components/
├── lobby/
├── game/
└── results/
```

### `src/domain`

Será usada para contratos e regras centrais do jogo que podem ser
compartilhados entre navegador e servidor.

Exemplos futuros:

- entidades de partida, jogador e rodada;
- estados possíveis da partida;
- contagem e limite de palavras;
- regras de transição entre fases.

Essas regras não foram criadas nesta etapa para não antecipar outras issues.

### `src/server`

É reservada para código que deve executar somente no servidor, como:

- acesso ao banco de dados;
- uso de credenciais privadas;
- chamadas ao Gemini;
- regras autoritativas da partida;
- repositórios e serviços internos.

O arquivo `environment.ts` importa `server-only`:

```ts
import "server-only";
```

Essa importação cria uma barreira verificável pelo Next.js. Se um módulo
privado for importado acidentalmente em código destinado ao navegador, o
framework poderá acusar o uso incorreto.

### `src/lib`

É destinada a constantes e utilitários compartilhados que não pertencem
diretamente à interface, ao domínio ou aos serviços privados.

---

## Server Components e Client Components

No App Router, os componentes são executados no servidor por padrão.

### Server Component

```tsx
export function ApplicationStatus() {
  return <p>Aplicação funcionando</p>;
}
```

Como não existe a diretiva `"use client"`, esse é um **Server Component**. O
servidor renderiza o componente e envia seu resultado ao navegador.

Server Components são apropriados quando o componente:

- apenas apresenta conteúdo;
- acessa dados no servidor;
- não precisa reagir diretamente a cliques;
- não usa estado ou efeitos do navegador.

### Client Component

Quando um componente precisar de interação, estado ou APIs do navegador, ele
deve começar com `"use client"`:

```tsx
"use client";

import { useState } from "react";

export function Counter() {
  const [value, setValue] = useState(0);

  return (
    <button onClick={() => setValue(value + 1)}>
      {value}
    </button>
  );
}
```

O `Counter` precisa executar no navegador porque guarda estado e responde a
cliques.

Uma regra prática é começar com Server Components e usar `"use client"`
somente quando o comportamento realmente depender do navegador.

---

## TypeScript em modo estrito

O arquivo `tsconfig.json` contém:

```json
"strict": true
```

Isso habilita verificações rigorosas do TypeScript. Ele pode detectar durante o
desenvolvimento problemas como:

- valores possivelmente inexistentes;
- argumentos com tipos incorretos;
- propriedades ausentes;
- retornos incompatíveis;
- uso inseguro de valores opcionais.

O projeto também define o alias:

```json
"@/*": ["./src/*"]
```

Com isso, podemos escrever:

```ts
import { ApplicationStatus } from "@/components/application-status";
```

em vez de depender de caminhos relativos maiores e mais frágeis:

```ts
import { ApplicationStatus } from "../components/application-status";
```

---

## Variáveis de ambiente e segurança

O arquivo `.env.example` documenta as variáveis que serão usadas pelo projeto,
mas não contém credenciais verdadeiras:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=
```

No Next.js, o prefixo da variável define se ela pode ser exposta ao navegador:

```text
NEXT_PUBLIC_*      → pode entrar no bundle do navegador
sem NEXT_PUBLIC_   → deve permanecer no servidor
```

Por isso, as chaves administrativas do Supabase e do Gemini não usam o prefixo
`NEXT_PUBLIC_`.

Os valores reais deverão ficar em um arquivo local, como `.env.local`, ou nas
configurações de ambiente da Vercel. O `.gitignore` impede que esses arquivos
sejam versionados acidentalmente.

---

## Comandos principais

### Instalar as dependências

```bash
npm install
```

O npm lê `package.json`, instala as bibliotecas em `node_modules` e usa o
`package-lock.json` para reproduzir as versões registradas.

### Iniciar o desenvolvimento

```bash
npm run dev
```

Inicia o servidor de desenvolvimento. A aplicação fica disponível em:

```text
http://localhost:3000
```

Durante o desenvolvimento, alterações nos arquivos são refletidas rapidamente
sem a necessidade de gerar um novo build manual a cada edição.

### Verificar os tipos

```bash
npm run typecheck
```

Executa o TypeScript para procurar erros de tipagem sem gerar arquivos de
saída.

### Verificar a qualidade do código

```bash
npm run lint
```

Executa o ESLint e procura padrões inadequados, erros comuns e violações das
regras configuradas.

### Gerar a versão de produção

```bash
npm run build
```

O Next.js compila o código, executa a verificação TypeScript e prepara a versão
otimizada da aplicação.

### Executar o build de produção

```bash
npm run start
```

Esse comando deve ser usado depois de `npm run build`.

---

## Arquivos que não são versionados

O `.gitignore` exclui arquivos que são locais, temporários ou recriáveis:

| Caminho | Motivo |
| --- | --- |
| `node_modules/` | Dependências recriadas com `npm install` |
| `.next/` | Resultado temporário do Next.js |
| `.env.local` | Pode conter segredos reais |
| `*.log` | Logs locais de execução |
| `*.tsbuildinfo` | Cache incremental do TypeScript |

O código-fonte, o `package.json` e o `package-lock.json` são suficientes para
recriar o ambiente do projeto.

---

## O que ainda não foi implementado

A aplicação atual comprova que a fundação técnica funciona, mas ainda não é o
jogo completo.

Ficaram para as próximas issues:

- entidades e schemas do domínio;
- criação e entrada em salas;
- lobby para dois jogadores;
- banco de dados Supabase;
- sincronização em tempo real;
- cronômetro e rodadas;
- envio privado das respostas;
- julgamento por inteligência artificial;
- pontuação e epílogo;
- tratamento de desconexão e reconexão.

Separar essas entregas mantém cada mudança pequena, testável e fácil de
revisar.

---

## Resumo mental

```text
src/app         → páginas, layouts e rotas
src/components  → elementos visuais reutilizáveis
src/domain      → regras compartilhadas do jogo
src/server      → banco, IA, segredos e lógica privada
src/lib         → utilitários e constantes compartilhados

page.tsx        → cria a página
layout.tsx      → envolve a página
globals.css     → fornece os estilos globais
package.json    → dependências e comandos
tsconfig.json   → regras do TypeScript
.env.example    → contrato das variáveis de ambiente
```

A principal ideia é manter uma fronteira clara: a interface apresenta e
interage, o domínio representa as regras, e o servidor protege dados e decisões
que não podem ficar sob controle do navegador.
