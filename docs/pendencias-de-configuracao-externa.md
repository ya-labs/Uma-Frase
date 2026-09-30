# Pendências de configuração externa

Este documento reúne as ações manuais que precisam acontecer fora do
repositório para desenvolver e publicar o MVP. Configuração de ambiente, schema
e regras de acesso continuam documentados em
[`configuracao-de-ambiente.md`](configuracao-de-ambiente.md) e
[`banco-de-dados.md`](banco-de-dados.md).

Nunca registre senhas ou chaves reais no GitHub, no repositório ou em conversas.
Use `.env.local` no desenvolvimento e variáveis protegidas na plataforma de
deploy.

## Antes da issue #17: Docker e Supabase

### Instalar o Docker

- [ ] Instalar Docker Engine ou Docker Desktop na máquina de desenvolvimento.
- [ ] Garantir que o usuário atual consiga acessar o daemon do Docker.
- [ ] Executar `docker run hello-world` com sucesso.
- [ ] Confirmar que `npm run db:start` inicia o Supabase local.

O Supabase CLI usa containers para executar o banco, a API e os demais serviços
locais. A instalação deve seguir a
[documentação oficial do Docker](https://docs.docker.com/engine/install/ubuntu/).

### Criar o projeto de desenvolvimento no Supabase

- [ ] Criar um projeto de desenvolvimento na organização responsável pelo Uma
      Frase, em uma região próxima dos usuários esperados.
- [ ] Gerar uma senha forte para o banco e guardá-la em um gerenciador de
      senhas.
- [ ] Obter no painel o Project ref, a Project URL, a Publishable key e a Secret
      key.
- [ ] Preencher `.env.local` sem versionar o arquivo.
- [ ] Autorizar o login do Supabase CLI quando o vínculo com o projeto for
      realizado.

Configuração local esperada:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

O nome `SUPABASE_SERVICE_ROLE_KEY` permanece no projeto por compatibilidade com
a configuração atual, mas deve receber a Secret key moderna. Ela ignora RLS e
fica restrita ao servidor. A Publishable key pode ser usada pelo navegador e
continua limitada pelas permissões públicas do banco. Consulte a
[documentação de chaves do Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Não crie tabelas, policies ou publicações Realtime manualmente no Dashboard. O
desenvolvimento deve:

1. vincular o repositório com `supabase link`;
2. visualizar as mudanças com `supabase db push --dry-run`;
3. aplicar as migrations somente depois da revisão;
4. validar schema, RLS e testes no projeto remoto.

Somente o Project ref pode ser compartilhado para preparar o vínculo. A senha
do banco e a Secret key não devem ser enviadas pelo chat.

## Antes da issue #21: Gemini

- [ ] Criar ou selecionar um projeto no Google AI Studio.
- [ ] Gerar uma chave da Gemini API e armazená-la fora do repositório.
- [ ] Escolher o modelo gratuito disponível no momento da integração.
- [ ] Preencher `GEMINI_API_KEY` e `GEMINI_MODEL` em `.env.local` e, depois, na
      Vercel.
- [ ] Confirmar os limites e as condições de uso do plano gratuito.

A chave deve existir somente no ambiente server-side. O jogo não deve enviar
dados pessoais, segredos ou histórico bruto indefinido ao provedor. A criação
da chave começa pelo
[Google AI Studio](https://ai.google.dev/aistudio).

## Antes da validação publicada: Vercel

- [ ] Importar `ya-labs/Uma-Frase` em um projeto da Vercel.
- [ ] Manter `main` como branch de produção.
- [ ] Cadastrar as variáveis públicas e server-side nos ambientes adequados.
- [ ] Usar valores separados quando Preview e Production apontarem para
      projetos Supabase diferentes.
- [ ] Atualizar `NEXT_PUBLIC_APP_URL` com a URL pública correspondente.
- [ ] Gerar um novo deploy após alterar qualquer variável `NEXT_PUBLIC_*`.
- [ ] Validar o fluxo publicado com dois navegadores ou dispositivos reais.

As variáveis devem ser cadastradas em **Project Settings > Environment
Variables**, conforme a
[documentação da Vercel](https://vercel.com/docs/environment-variables).

## O que não precisa ser configurado agora

- Supabase Auth, porque o MVP não possui login.
- Supabase Storage e Edge Functions.
- Tabelas, policies ou funções criadas manualmente pelo Dashboard.
- Domínio personalizado.
- Projeto Supabase definitivo de produção antes do fluxo principal estar
  jogável.
- Gemini antes da issue #21.
- Vercel antes da etapa de validação publicada.

## Divisão de responsabilidade

| Ação                                                  | Responsável                                        |
| ----------------------------------------------------- | -------------------------------------------------- |
| Instalar Docker e liberar acesso ao daemon            | Pessoa desenvolvedora                              |
| Criar contas, projetos e credenciais externas         | Pessoa desenvolvedora                              |
| Guardar senhas e chaves fora do repositório e do chat | Pessoa desenvolvedora                              |
| Versionar schema, RLS, Realtime e funções             | Desenvolvimento no repositório                     |
| Executar `link`, `dry-run` e migrations revisadas     | Desenvolvimento autorizado                         |
| Integrar Gemini e validar seus retornos               | Issue backend correspondente                       |
| Configurar variáveis e validar o deploy               | Pessoa desenvolvedora com apoio do desenvolvimento |
