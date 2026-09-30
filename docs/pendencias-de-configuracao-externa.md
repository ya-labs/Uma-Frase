# Pendências de configuração externa

Este documento reúne as ações manuais que precisam acontecer fora do
repositório para desenvolver e publicar o MVP. Configuração de ambiente, schema
e regras de acesso continuam documentados em
[`configuracao-de-ambiente.md`](configuracao-de-ambiente.md) e
[`banco-de-dados.md`](banco-de-dados.md).

Nunca registre senhas ou chaves reais no GitHub, no repositório ou em conversas.
Use `.env.local` no desenvolvimento e variáveis protegidas na plataforma de
deploy.

## Antes da issue #17: Supabase remoto de desenvolvimento

### Decisão para a máquina corporativa

O Docker não está disponível na máquina corporativa e não deve bloquear o
desenvolvimento. O fluxo adotado usa um projeto Supabase remoto exclusivo para
desenvolvimento. A suíte completa de banco continua executada pelo GitHub
Actions em um runner com Docker.

O Next.js roda localmente com `npm run dev` e usa as credenciais do projeto
remoto em `.env.local`. As migrations continuam versionadas no repositório e
são aplicadas pelo Supabase CLI somente depois de revisão.

### Estado da configuração do Supabase

- [x] Criar um projeto de desenvolvimento na organização responsável pelo Uma
      Frase.
- [x] Confirmar que a região escolhida atende aos usuários esperados.
- [x] Confirmar que a senha forte do banco está guardada em um gerenciador de
      senhas.
- [x] Obter no painel o Project ref, a Project URL, a Publishable key e a Secret
      key.
- [x] Preencher `.env.local` sem versionar o arquivo.
- [x] Autorizar o login do Supabase CLI e vincular o repositório ao projeto de
      desenvolvimento.
- [x] Revisar a migration inicial com `supabase db push --dry-run`.
- [x] Aplicar a migration revisada e confirmar o histórico remoto.
- [x] Executar o lint remoto sem erros e confirmar as tabelas esperadas.
- [x] Confirmar que `npm run dev` carrega a aplicação com a configuração remota.

O vínculo local fica em `supabase/.temp`, que é ignorado pelo Git. O Project ref
pode ser compartilhado para preparar o vínculo, mas não deve ser fixado na
documentação como se todos os ambientes usassem o mesmo projeto.

### Fluxo remoto sem Docker

Depois de instalar as dependências e autenticar o CLI:

```bash
npx supabase link --project-ref PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list --linked
npx supabase db lint --linked --schema public --level warning --fail-on error
```

`db push` altera o banco remoto e só deve ser executado depois da revisão do
`dry-run`. Nunca execute `supabase db reset --linked` em um ambiente com dados
que precisam ser preservados.

### Docker opcional

- [ ] Instalar um runtime compatível com Docker somente se a política da
      máquina permitir e houver necessidade de executar todo o stack local.
- [ ] Quando disponível, confirmar `docker run hello-world` e
      `npm run db:start`.

Sem Docker, `db:start`, `db:reset`, `db:test` e `db:lint` local não ficam
disponíveis. Isso não bloqueia a issue #17: o job `Database` do GitHub Actions
executa essas validações em pull requests.

### Configuração local esperada

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

Não crie tabelas, policies ou publicações Realtime manualmente no Dashboard.
Somente migrations versionadas e revisadas devem alterar o schema. A senha do
banco, o token pessoal do CLI e a Secret key não devem ser enviados pelo chat.

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
| Liberar Docker local quando permitido e necessário    | Pessoa desenvolvedora e suporte da empresa         |
| Criar contas, projetos e credenciais externas         | Pessoa desenvolvedora                              |
| Guardar senhas e chaves fora do repositório e do chat | Pessoa desenvolvedora                              |
| Versionar schema, RLS, Realtime e funções             | Desenvolvimento no repositório                     |
| Executar `link`, `dry-run` e migrations revisadas     | Desenvolvimento autorizado                         |
| Executar a suíte de banco sem Docker local            | GitHub Actions                                     |
| Integrar Gemini e validar seus retornos               | Issue backend correspondente                       |
| Configurar variáveis e validar o deploy               | Pessoa desenvolvedora com apoio do desenvolvimento |
