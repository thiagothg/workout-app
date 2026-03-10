import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { ListWorkoutPlan } from "../usecases/ListWorkoutPlan.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

const SYSTEM_PROMPT = `Você é um personal trainer virtual especialista em montagem de planos de treino. Seu objetivo é ajudar as pessoas a criar planos de treino eficazes e personalizados.

**Tone e Estilo:**
- Seja amigável, motivador e use linguagem simples (sem jargões técnicos)
- Seu público principal são pessoas leigas em musculação
- Respostas curtas e objetivas

**Fluxo de Interação:**

1. **SEMPRE comece chamando a tool "getUserTrainData"** para recuperar os dados do usuário.

2. **Se o usuário NÃO tem dados cadastrados** (retornou null):
   - Pergunte de forma simples e direta em uma única mensagem: nome, peso (kg), altura (cm), idade e % de gordura corporal
   - Após receber, chame a tool "updateUserTrainData" (convertendo peso de kg para gramas: kg × 1000)

3. **Se o usuário JÁ tem dados cadastrados:**
   - Cumprimente-o pelo nome com entusiasmo

4. **Para criar um plano de treino:**
   - Pergunte: objetivo (emagrecer, ganhar massa, melhorar resistência), dias disponíveis por semana (1-7) e restrições físicas/lesões
   - Perguntas poucas, simples e diretas
   - Use a ferramenta "getWorkoutPlans" para não criar plano duplicado se já existe

5. **Criando o plano (tool "createWorkoutPlan"):**
   - O plano DEVE ter exatamente 7 dias (MONDAY a SUNDAY)
   - Dias sem treino: isRest: true, exercises: [], estimatedDurationInSeconds: 0
   - Sempre forneça um coverImageUrl para cada dia de treino baseado no foco muscular

**Divisões de Treino por Frequência:**
- **2-3 dias/semana**: Full Body ou ABC (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros)
- **4 dias/semana**: Upper/Lower (recomendado: cada grupo 2x/semana) ou ABCD (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas, D: Ombros+Abdômen)
- **5 dias/semana**: PPLUL — Push/Pull/Legs + Upper/Lower (superior 3x, inferior 2x)
- **6 dias/semana**: PPL 2x — Push/Pull/Legs repetido

**Princípios de Montagem:**
- Músculos sinérgicos juntos (peito+tríceps, costas+bíceps)
- Exercícios compostos primeiro, isoladores depois
- 4-8 exercícios por sessão
- 3-4 séries por exercício, 8-12 reps (hipertrofia) ou 4-6 reps (força)
- Descanso: 60-90s (hipertrofia), 2-3min (compostos pesados)
- Evitar treinar o mesmo grupo em dias consecutivos
- Nomes descritivos: "Superior A - Peito e Tríceps", "Inferior - Pernas", "Descanso"

**URLs de Imagens por Foco Muscular:**

Dias superiores (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body) — alternar entre:
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL

Dias inferiores (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower) — alternar entre:
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY

Dias de descanso usam imagem de superior.`;

const upsertUserTrainDataSchema = z.object({
  weightInGrams: z.number().int().positive(),
  heightInCentimeters: z.number().int().positive(),
  age: z.number().int().positive(),
  bodyFatPercentage: z.number().int().nonnegative(),
});

const createWorkoutPlanSchema = z.object({
  name: z.string().describe("Nome do plano de treino"),
  workoutDays: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Nome do dia (ex: Peito e Tríceps, Descanso)"),
        weekDay: z.enum(WeekDay).describe("Dia da semana"),
        isRest: z
          .boolean()
          .describe("Se é dia de descanso (true) ou treino (false)"),
        estimatedDurationInSeconds: z
          .number()
          .describe("Duração estimada em segundos (0 para dias de descanso)"),
        coverImageUrl: z
          .string()
          .url()
          .describe(
            "URL da imagem de capa do dia de treino. Usar as URLs de superior ou inferior conforme o foco muscular do dia.",
          ),
        exercises: z
          .array(
            z.object({
              order: z.number().describe("Ordem do exercício no dia"),
              name: z.string().describe("Nome do exercício"),
              sets: z.number().describe("Número de séries"),
              reps: z.number().describe("Número de repetições"),
              restTimeInSeconds: z
                .number()
                .describe("Tempo de descanso entre séries em segundos"),
            }),
          )
          .describe("Lista de exercícios (vazia para dias de descanso)"),
      }),
    )
    .describe("Array com exatamente 7 dias de treino (MONDAY a SUNDAY)"),
});

export const aiRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/ai",
    schema: {
      tags: ["ai"],
      summary: "Chat with AI personal trainer",
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

        const userId = session.user.id;
        const { messages } = request.body as { messages: UIMessage[] };

        const result = streamText({
          model: openai("gpt-4o-mini"),
          system: SYSTEM_PROMPT,
          tools: {
            getUserTrainData: tool({
              description:
                "Recupera os dados de treino do usuário autenticado. Retorna null se nenhum dado foi registrado.",
              inputSchema: z.object({}),
              execute: async () => {
                const getTrainData = new GetUserTrainData();
                const data = await getTrainData.execute({ userId });
                return data;
              },
            }),
            updateUserTrainData: tool({
              description:
                "Atualiza os dados de treino do usuário (peso, altura, idade, % de gordura corporal). Peso deve estar em gramas.",
              inputSchema: upsertUserTrainDataSchema,
              execute: async (params) => {
                const upsertTrainData = new UpsertUserTrainData();
                const result = await upsertTrainData.execute({
                  userId,
                  ...params,
                });
                return result;
              },
            }),
            getWorkoutPlans: tool({
              description: "Lista todos os planos de treino do usuário.",
              inputSchema: z.object({}),
              execute: async () => {
                const listPlans = new ListWorkoutPlan();
                const plans = await listPlans.execute({ userId });
                return plans || [];
              },
            }),
            createWorkoutPlan: tool({
              description:
                "Cria um novo plano de treino com 7 dias (MONDAY a SUNDAY). Dias sem treino devem ter isRest: true e exercises: [].",
              inputSchema: createWorkoutPlanSchema,
              execute: async (params) => {
                const createPlan = new CreateWorkoutPlan();
                const plan = await createPlan.execute({
                  userId,
                  ...params,
                });
                return plan;
              },
            }),
          },
          stopWhen: stepCountIs(5),
          messages: await convertToModelMessages(messages),
        });

        const response = result.toUIMessageStreamResponse();
        reply.status(response.status as 200 | 400 | 401 | 500);

        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        return reply.send(response.body);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
