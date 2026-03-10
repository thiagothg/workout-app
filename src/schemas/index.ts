import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const StartWorkoutSessionResponseSchema = z.object({
  userWorkoutSessionId: z.uuid(),
});

export const UpdateWorkoutSessionBodySchema = z.object({
  completedAt: z.string().datetime(),
});

export const UpdateWorkoutSessionResponseSchema = z.object({
  id: z.uuid(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
});

export const WorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  coverImageUrl: z.url().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  workoutDays: z.array(
    z.object({
      name: z.string().trim().min(1),
      weekDay: z.enum(WeekDay),
      isRest: z.boolean().default(false),
      estimatedDurationInSeconds: z.number().min(1),
      exercises: z.array(
        z.object({
          order: z.number().min(0),
          name: z.string().trim().min(1),
          sets: z.number().min(1),
          reps: z.number().min(1),
          restTimeInSeconds: z.number().min(1),
        }),
      ),
    }),
  ),
});
