# Copilot Instructions - bootcamp-workout-app

This document provides essential guidance for AI assistants working with this Fastify backend codebase. It consolidates architectural patterns, conventions, and best practices for consistent, high-quality contributions.

**📌 Note:** This file unifies all project rules (`.claude/rules/`, `.cursor/rules/`, `.github/`) into a single source of truth. Refer here instead of individual rule files.

---

## Stack & Key Technologies

- **Runtime:** Node.js 24.x (required)
- **Package Manager:** npm run 10.30.0 (required; do not use npm/yarn)
- **Web Framework:** Fastify 5 + fastify-type-provider-zod
- **Language:** TypeScript (ES2024 target, strict mode)
- **Database:** PostgreSQL 16 (via Docker) + Prisma 7 ORM with PrismaPg adapter
- **Authentication:** better-auth 1.5 + better-auth/openapi plugin
- **Validation:** Zod v4 (not v3; use `z.url()`, `z.uuid()`, `z.enum()` — avoid deprecated variants)
- **Date Handling:** dayjs with UTC plugin
- **API Documentation:** Swagger + Scalar (auto-generated from Zod schemas)

## Essential Commands

```bash
# Database
docker-compose up -d                    # Start PostgreSQL 16
npm run prisma migrate dev                 # Create/apply migrations
npm run prisma studio                      # Open GUI database explorer
npm run prisma generate                    # Generate Prisma Client

# Development
npm run dev                                # Start dev server (tsx --watch on port 3000)

# Code Quality
npm run eslint .                           # Run linter
npm run prettier --write .                 # Format code
```

## Project Structure

- **`src/index.ts`** — Server entry point, plugin registration, route mounting
- **`src/routes/`** — HTTP handlers; bridge between HTTP and use cases
- **`src/usecases/`** — Pure business logic; define InputDto, execute, throw custom errors
- **`src/schemas/`** — Zod schemas for validation & OpenAPI documentation (single source of truth)
- **`src/lib/auth.ts`** — better-auth configuration and session utilities
- **`src/lib/db.ts`** — Prisma client with PrismaPg adapter
- **`src/errors/`** — Custom error classes (NotFoundError, WorkoutPlanNotActiveError, etc.)
- **`src/generated/prisma/`** — Auto-generated Prisma Client and type enums
- **`prisma/schema.prisma`** — Database schema definition
- **`prisma/migrations/`** — Migration history with sequential timestamps

## Architecture & Patterns

### Routes (src/routes/)

Routes **always** follow this pattern:

1. Retrieve session using `auth.api.getSession()`
2. Check authorization (return 401 if not authenticated)
3. Instantiate and execute a use case
4. Handle errors thrown by use case with try-catch
5. Map custom errors to appropriate HTTP status codes

**Key Requirements:**

- Use `@fastify/type-provider-zod` type provider
- Include `tags` (array) and `summary` (string) in schema for OpenAPI grouping
- Define all response codes (201, 400, 401, 404, 500) in response schema
- Always use `fromNodeHeaders(request.headers)` when calling auth functions
- Catch all errors and log with `app.log.error(error)`

**Example:**

```ts
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { NotFoundError } from "../errors/index.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema, WorkoutPlanSchema } from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["workout-plan"],
      summary: "Create a new workout plan",
      body: WorkoutPlanSchema.omit({ id: true }),
      response: {
        201: WorkoutPlanSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }
        const createWorkoutPlan = new CreateWorkoutPlan();
        const result = await createWorkoutPlan.execute({
          userId: session.user.id,
          name: request.body.name,
          workoutDays: request.body.workoutDays,
        });
        return reply.status(201).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND_ERROR",
          });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
```

### Use Cases (src/usecases/)

All business logic lives in use cases. Key principles:

- **Define InputDto and OutputDto** as interfaces in the same file
- **NEVER** handle errors — only throw custom errors
- **ALWAYS** use Prisma directly (no repositories layer)
- **Use transactions** for operations that must be atomic
- **Access database via `prisma`** export from `@src/lib/db.ts`

**Example:**

```ts
import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  name: string;
  workoutDays: Array<{
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    exercises: Array<{
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export class CreateWorkoutPlan {
  async execute(dto: InputDto) {
    const existingWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: { isActive: true, userId: dto.userId },
    });

    return prisma.$transaction(async (tx) => {
      if (existingWorkoutPlan) {
        await tx.workoutPlan.update({
          where: { id: existingWorkoutPlan.id },
          data: { isActive: false },
        });
      }

      const workoutPlan = await tx.workoutPlan.create({
        data: {
          id: crypto.randomUUID(),
          name: dto.name,
          userId: dto.userId,
          isActive: true,
          workoutDays: {
            create: dto.workoutDays.map((workoutDay) => ({
              name: workoutDay.name,
              weekDay: workoutDay.weekDay,
              isRest: workoutDay.isRest,
              estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
              exercises: {
                create: workoutDay.exercises.map((exercise) => ({
                  name: exercise.name,
                  order: exercise.order,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restTimeInSeconds: exercise.restTimeInSeconds,
                })),
              },
            })),
          },
        },
      });

      const result = await tx.workoutPlan.findUnique({
        where: { id: workoutPlan.id },
        include: { workoutDays: { include: { exercises: true } } },
      });

      if (!result) {
        throw new NotFoundError("Workout plan not found");
      }
      return result;
    });
  }
}
```

### Schemas (src/schemas/)

Zod schemas are the **single source of truth** for request validation, response serialization, and OpenAPI documentation.

**Key Requirements:**

- Use Zod v4 APIs: `z.url()`, `z.uuid()`, `z.enum(...)` — NOT deprecated variants
- Export all schemas from `@src/schemas/index.ts`
- For creation/update operations, define schemas using `.omit()` to exclude id/timestamps

**Example:**

```ts
import { z } from "zod";

export const WorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(255),
  coverImageUrl: z.url().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  workoutDays: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().trim().min(1),
      weekDay: z.enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ]),
      isRest: z.boolean(),
      estimatedDurationInSeconds: z.number().int().positive(),
      exercises: z.array(
        z.object({
          id: z.uuid(),
          name: z.string().trim().min(1),
          order: z.number().int().nonnegative(),
          sets: z.number().int().positive(),
          reps: z.number().int().positive(),
          restTimeInSeconds: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
});

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});
```

### Error Handling

Custom errors are defined in `@src/errors/index.ts` and thrown by use cases:

```ts
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class WorkoutPlanNotActiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutPlanNotActiveError";
  }
}
```

**Error Response Format:**

```ts
{
  error: string,      // User-friendly message
  code: string,       // Machine-readable code (UPPERCASE_SNAKE_CASE)
}
```

**Mapping in Routes:**
| Error Class | HTTP Status |
|-------------|-------------|
| NotFoundError | 404 |
| WorkoutPlanNotActiveError | 400 |
| ConflictError | 409 |
| BadRequestError | 400 |
| (unhandled) | 500 |

**Authorization Pattern:**

- Throw `NotFoundError` if user doesn't own the resource (security by obscuring)
- Routes check `session.user.id` against resource ownership in use case

## Database & Prisma

### Connection

The Prisma client uses **PrismaPg adapter** for optimized PostgreSQL connections:

```ts
// src/lib/db.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### Schema Overview

Key relationships (CASCADE delete enabled):

```
User ──→ WorkoutPlan ──→ WorkoutDay ──→ WorkoutExercise
           │                │
           │                └──→ WorkoutSession
           │
        (Session, Account, Verification from better-auth)
```

### Enums

Prisma enums generated in `@src/generated/prisma/enums.ts`:

- **WeekDay**: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY

Always import enums from `@src/generated/prisma/enums.js`:

```ts
import { WeekDay } from "../generated/prisma/enums.js";
```

### Migrations

- Path: `prisma/migrations/`
- Format: `YYYYMMDDHHMMSS_description/`
- Command: `npm run prisma migrate dev` (creates and applies)

## Authentication & Authorization

### Setup

better-auth is configured in `@src/lib/auth.ts` with:

- Email + password authentication
- Prisma adapter (PostgreSQL)
- OpenAPI plugin for schema generation
- Trusted origins for CORS

### Session Retrieval

In every protected route:

```ts
import { fromNodeHeaders } from "better-auth/node";

const session = await auth.api.getSession({
  headers: fromNodeHeaders(request.headers),
});

if (!session) {
  return reply.status(401).send({
    error: "Unauthorized",
    code: "UNAUTHORIZED",
  });
}

// Access user: session.user.id
```

### Authorization Rules

- Enforce resource ownership in use cases
- Throw `NotFoundError` if user doesn't own resource (don't expose that resource exists)
- Routes catch NotFoundError and return 404

## TypeScript & Code Style

### Principles

- **Always** use TypeScript; never use JavaScript
- **Never** use `any`
- **Prefer** named exports over default exports (unless required)
- **Prefer** `interface` over `type` (unless required)

### Functions

- **Always** use arrow functions (except when required)
- **Name** functions as verbs
- **Use** early returns instead of deeply nested if-statements
- **Prefer** higher-order functions (map, filter, reduce) over imperative loops
- **For 2+ parameters**, accept an object (not individual arguments)

### Naming Conventions

| Target      | Convention | Example                                 |
| ----------- | ---------- | --------------------------------------- |
| Files       | kebab-case | `workout-plan.ts`, `create-workout.ts`  |
| Directories | kebab-case | `src/routes/`, `src/usecases/`          |
| Classes     | PascalCase | `CreateWorkoutPlan`, `NotFoundError`    |
| Functions   | camelCase  | `getWorkoutPlan()`, `isWorkoutActive()` |
| Variables   | camelCase  | `userId`, `workoutDays`                 |
| Constants   | camelCase  | `defaultRepsRange`                      |
| Enums       | PascalCase | `WeekDay`                               |

### Imports

- **Always** use relative paths with `.js` extensions (required for ES modules)

```ts
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { prisma } from "../lib/db.js";
import { NotFoundError } from "../errors/index.js";
```

## Git & Commits

**Always** use Conventional Commits:

```
type(scope): description

[optional body]
```

**Types:**

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `refactor` — Code refactoring
- `chore` — Build, dependencies, maintenance
- `test` — Tests

**Examples:**

```
feat(workout-plan): add ability to duplicate plans
fix(routes): handle missing session gracefully
docs(api): update route documentation
refactor(usecases): extract common validation logic
```

## API Documentation

- **Swagger UI** available at `/docs` when server running
- **Scalar UI** available at `/scalar`
- Documentation **auto-generated** from Zod schemas using `tags` and `summary`
- **Auth routes** registered at `/api/auth/*` (managed by better-auth)

## Common Patterns & Pitfalls

### ✅ DO:

- Define DTOs as `interface` in use case files
- Use `crypto.randomUUID()` for new entity IDs
- Handle `null` and optional values explicitly with `.nullable()` and `.optional()`
- Use transactions for multi-step operations
- Log errors in routes with `app.log.error(error)`

### ❌ DON'T:

- Create repositories layer — call Prisma directly in use cases
- Handle errors in use cases — throw and let routes catch
- Use `z.string().url()` or deprecated Zod methods
- Import from `prisma` — use `@src/generated/prisma/`
- Create routes without `tags` and `summary` in schema
- Forget `fromNodeHeaders()` when retrieving session

### 🔍 Debugging Tips:

- Use `npm run prisma studio` to inspect database state
- Check OpenAPI schema at `/api/auth/open-api/generate-schema`
- Enable debug logging: `DEBUG=*` npm run dev
- Use TypeScript strict mode to catch type errors early

## Environment Setup

Create `.env.local` in project root:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/bootcamp_workout_app
```

Then bootstrap:

```bash
npm install
docker-compose up -d
npm prisma migrate dev
npm run dev
```

Server runs on `http://localhost:3000` with OpenAPI docs at `/docs`.
