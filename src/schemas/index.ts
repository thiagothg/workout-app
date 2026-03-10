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
  completedAt: z.iso.datetime(),
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
      id: z.uuid(),
      name: z.string().trim().min(1),
      weekDay: z.enum(WeekDay),
      isRest: z.boolean(),
      estimatedDurationInSeconds: z.number().min(1),
      exercises: z.array(
        z.object({
          id: z.uuid(),
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

export const CreateWorkoutPlanResponseSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  coverImageUrl: z.url().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  workoutDays: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().trim().min(1),
      weekDay: z.enum(WeekDay),
      isRest: z.boolean(),
      estimatedDurationInSeconds: z.number().min(1),
      exercises: z.array(
        z.object({
          id: z.uuid(),
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

export const HomeParamsSchema = z.object({
  date: z.string(),
});

export const WorkoutPlanDetailsSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  coverImageUrl: z.url().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  workoutDays: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().trim().min(1),
      weekDay: z.enum(WeekDay),
      isRest: z.boolean(),
      estimatedDurationInSeconds: z.number().min(1),
      exercisesCount: z.number().int().min(0),
    }),
  ),
});

export const WorkoutExerciseSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  order: z.number().int().nonnegative(),
  workoutDayId: z.uuid(),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  restTimeInSeconds: z.number().int().nonnegative(),
});

export const WorkoutSessionSchema = z.object({
  id: z.uuid(),
  workoutDayId: z.uuid(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
});

export const WorkoutDayDetailsSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  isRest: z.boolean(),
  estimatedDurationInSeconds: z.number().min(1),
  weekDay: z.enum(WeekDay),
  exercises: z.array(WorkoutExerciseSchema),
  sessions: z.array(WorkoutSessionSchema),
});

export const HomeResponseSchema = z.object({
  activeWorkoutPlanId: z.uuid(),
  todayWorkoutDay: z.object({
    workoutPlanId: z.uuid(),
    id: z.uuid(),
    name: z.string(),
    isRest: z.boolean(),
    weekDay: z.enum(WeekDay),
    estimatedDurationInSeconds: z.number(),
    coverImageUrl: z.string().optional(),
    exercisesCount: z.number().int().min(0),
  }),
  workoutStreak: z.number().int().min(0),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
});

export const StatsQuerySchema = z.object({
  from: z
    .string()
    .refine(
      (val) => /^\d{4}-\d{2}-\d{2}$/.test(val),
      "Invalid date format. Expected YYYY-MM-DD",
    ),
  to: z
    .string()
    .refine(
      (val) => /^\d{4}-\d{2}-\d{2}$/.test(val),
      "Invalid date format. Expected YYYY-MM-DD",
    ),
});

export const StatsResponseSchema = z.object({
  workoutStreak: z.number().int().nonnegative(),
  consistencyByDay: z.record(
    z.string(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
  completedWorkoutsCount: z.number().int().nonnegative(),
  conclusionRate: z.number().min(0).max(1),
  totalTimeInSeconds: z.number().int().nonnegative(),
});
