import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import {
  ConflictError,
  NotFoundError,
  WorkoutPlanNotActiveError,
} from "../errors/index.js";
import { auth } from "../lib/auth.js";
import {
  CreateWorkoutPlanResponseSchema,
  ErrorSchema,
  StartWorkoutSessionResponseSchema,
  UpdateWorkoutSessionBodySchema,
  UpdateWorkoutSessionResponseSchema,
  WorkoutDayDetailsSchema,
  WorkoutPlanDetailsSchema,
  WorkoutPlanSchema,
} from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetWorkoutDayDetails } from "../usecases/GetWorkoutDayDetails.js";
import { GetWorkoutPlanDetails } from "../usecases/GetWorkoutPlanDetails.js";
import { ListWorkoutPlan } from "../usecases/ListWorkoutPlan.js";
import { StartWorkoutSession } from "../usecases/StartWorkoutSession.js";
import { UpdateWorkoutSession } from "../usecases/UpdateWorkoutSession.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["workout-plan"],
      summary: "Create a new workout plan",
      body: WorkoutPlanSchema.omit({
        id: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }),
      response: {
        201: CreateWorkoutPlanResponseSchema,
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
          coverImageUrl: request.body.coverImageUrl ?? undefined,
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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["workout-plan"],
      summary: "List the active workout plan for the user",
      response: {
        200: WorkoutPlanSchema.nullable(),
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

        const activeWorkoutPlan = await new ListWorkoutPlan().execute({
          userId: session.user.id,
        });

        if (!activeWorkoutPlan) {
          return reply.status(404).send({
            error: "No active workout plan found",
            code: "NOT_FOUND",
          });
        }

        return reply.status(200).send(activeWorkoutPlan);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  const getDetailsParamsSchema = z.object({
    id: z.uuid(),
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      tags: ["workout-plan"],
      summary: "Get details of a specific workout plan",
      params: getDetailsParamsSchema,
      response: {
        200: WorkoutPlanDetailsSchema,
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

        const { id } = request.params;

        const result = await new GetWorkoutPlanDetails().execute({
          userId: session.user.id,
          workoutPlanId: id,
        });

        return reply.status(200).send(result);
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

  const getDayDetailsParamsSchema = z.object({
    workoutPlanId: z.uuid(),
    workoutDayId: z.uuid(),
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:workoutPlanId/days/:workoutDayId",
    schema: {
      tags: ["workout-plan"],
      summary:
        "Get details of a specific workout day with exercises and sessions",
      params: getDayDetailsParamsSchema,
      response: {
        200: WorkoutDayDetailsSchema,
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

        const { workoutPlanId, workoutDayId } = request.params;

        const result = await new GetWorkoutDayDetails().execute({
          userId: session.user.id,
          workoutPlanId,
          workoutDayId,
        });

        return reply.status(200).send(result);
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

  const startSessionParamsSchema = z.object({
    workoutPlanId: z.uuid(),
    workoutDayId: z.uuid(),
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/:workoutPlanId/days/:workoutDayId/sessions",
    schema: {
      tags: ["workout-plan"],
      summary: "Start a workout session for a plan day",
      params: startSessionParamsSchema,
      response: {
        201: StartWorkoutSessionResponseSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
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
        const { workoutPlanId, workoutDayId } = request.params;
        const result = await new StartWorkoutSession().execute({
          userId: session.user.id,
          workoutPlanId,
          workoutDayId,
        });
        return reply.status(201).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof WorkoutPlanNotActiveError) {
          return reply.status(400).send({
            error: error.message,
            code: "WORKOUT_PLAN_NOT_ACTIVE",
          });
        }
        if (error instanceof ConflictError) {
          return reply.status(409).send({
            error: error.message,
            code: "CONFLICT",
          });
        }
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

  const updateSessionParamsSchema = z.object({
    workoutPlanId: z.uuid(),
    workoutDayId: z.uuid(),
    workoutSessionId: z.uuid(),
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/:workoutPlanId/days/:workoutDayId/sessions/:workoutSessionId",
    schema: {
      tags: ["workout-plan"],
      summary: "Update a workout session for a plan day",
      params: updateSessionParamsSchema,
      body: UpdateWorkoutSessionBodySchema,
      response: {
        200: UpdateWorkoutSessionResponseSchema,
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

        const { workoutPlanId, workoutDayId, workoutSessionId } =
          request.params;

        const result = await new UpdateWorkoutSession().execute({
          userId: session.user.id,
          workoutPlanId,
          workoutDayId,
          workoutSessionId,
          completedAt: new Date(request.body.completedAt),
        });

        return reply.status(200).send(result);
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
