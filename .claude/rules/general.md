# CLAUDE.md

Este arquivo fornece orientações ao Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Stack

- Node.js (ES modules)
- pnpm como package manager
- TypeScript (target ES2024)
- Fastify com Zod type provider
- Prisma ORM com PostgreSQL (usando pg adapter)
- better-auth para autenticação

## Comandos

```bash
# Desenvolvimento
pnpm dev                    # Inicia servidor dev com watch mode (tsx --watch)

# Build
pnpm build                  # Build com tsup

# Banco de dados
pnpm prisma generate        # Gera o Prisma client (também roda no postinstall)
pnpm prisma migrate dev     # Executa migrations em desenvolvimento
pnpm prisma studio          # Abre o Prisma Studio GUI

# Linting
pnpm eslint .               # Executa ESLint
```

## Arquitetura

### Estrutura de Diretórios

- `src/` - Código fonte da aplicação
  - `lib/db.ts` - Setup do client do banco (Prisma com pg adapter)
  - `entities/` - Interfaces TypeScript para entidades de domínio
  - `errors/` - Arquivos com classes de erro
  - `schemas/` - Schemas Zod para validação de request/response
  - `usecases/` - Classes de lógica de negócio (padrão use case)
  - `generated/` - Prisma client gerado automaticamente (output em `generated/prisma/`)
- `prisma/` - Schema e migrations do Prisma

### Documentação da API

Swagger UI disponível em `/docs` quando o servidor está rodando (porta 4949).

## Git / Commits

- **SEMPRE** use Conventional Commits para mensagens de commit. Formato: `type(scope): description`.
- Tipos comuns: `feat` (nova funcionalidade), `fix` (correção de bug), `docs` (documentação), `refactor` (refatoração), `chore` (tarefas de manutenção), `test` (testes).

## MCPs

- **SEMPRE** use Context7 para buscar documentações
- **SEMPRE** use Serena para semantic code retrieval e editing tools.