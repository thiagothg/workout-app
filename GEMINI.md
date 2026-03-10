# GEMINI.md

Este arquivo fornece contexto e diretrizes para o GEMINI trabalhar neste repositório.

## Visão Geral do Projeto

O **bootcamp-workout-app** é uma API de gerenciamento de treinos desenvolvida com uma arquitetura limpa e moderna.

### Tecnologias Principais:
- **Runtime:** Node.js 24.x (obrigatório)
- **Gerenciador de Pacotes:** pnpm 10.30.0 (obrigatório)
- **Framework Web:** Fastify 5 (com `fastify-type-provider-zod`)
- **Linguagem:** TypeScript
- **Banco de Dados:** PostgreSQL 16 (via Docker)
- **ORM:** Prisma 7
- **Autenticação:** Better-Auth 1.5
- **Validação:** Zod 4

## Comandos Principais

```bash
# Iniciar ambiente de banco de dados
docker-compose up -d

# Instalar dependências
pnpm install

# Iniciar servidor de desenvolvimento (hot-reload na porta 3000 ou PORT env)
pnpm dev

# Banco de Dados e Prisma
pnpm exec prisma migrate dev    # Criar e aplicar migrations
pnpm exec prisma generate       # Gerar Prisma Client
pnpm exec prisma studio         # Explorar dados via UI

# Qualidade de Código
pnpm exec eslint .              # Linting
pnpm exec prettier --write .    # Formatação
```

## Arquitetura e Estrutura de Pastas

O projeto segue um padrão em camadas focado em separação de preocupações:

- `src/index.ts`: Ponto de entrada, registro de plugins e configuração do servidor.
- `src/routes/`: Handlers de rotas Fastify. Fazem a ponte entre HTTP e Use Cases.
- `src/usecases/`: Lógica de negócio pura. Cada classe representa uma ação do sistema.
- `src/schemas/`: Definições Zod para validação de entrada/saída e documentação OpenAPI.
- `src/lib/`: Configurações de bibliotecas (Prisma client, Better-Auth).
- `src/errors/`: Classes de erro customizadas.
- `prisma/`: Schema do banco de dados e arquivos de migração.

## Convenções de Desenvolvimento

1. **Sempre valide entradas/saídas:** Use schemas Zod em todas as rotas.
2. **Autenticação:** Use `auth.api.getSession()` para verificar a sessão do usuário nas rotas.
3. **Persistência:** Use o Prisma Client localizado em `src/lib/db.ts`.
4. **Tratamento de Erros:** Lance erros customizados de `src/errors/` nos Use Cases e capture-os nas Rotas para retornar o status HTTP correto.
5. **Estilo de Código:**
   - Use `import ... from ".../index.js"` (extensão `.js` é necessária devido ao ESM).
   - Mantenha a ordenação de imports via `simple-import-sort`.
   - **Zod 4** para validacao (usa padrao `z.interface()`, nao `z.object()`)
6. **Migrations:** Sempre execute `prisma migrate dev` após alterar o `schema.prisma`.
- **TypeScript strict** com target ES2024 e module resolution `nodenext`
- **ESLint** com typescript-eslint, integracao com prettier e `simple-import-sort` (imports devem ser ordenados)
- **CORS** permite `http://localhost:3000` com credentials
- Variaveis de ambiente: `PORT`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`

## Documentação

- **Swagger/OpenAPI:** Disponível em `/swagger.json`.
- **Interface de Documentação (Scalar):** Disponível em `/docs`.


## Git

- **SEMPRE** use [Conventional Commits](https://www.conventionalcommits.org/) para mensagens de commit. Exemplo: `feat: add start workout session endpoint`, `fix: workout plan validation`, `docs: update architecture rules`.

Look at CLAUDE.md for more info