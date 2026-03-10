import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

// Data Transfer Object
interface InputDto {
  userId: string;
}

export interface OutputDto {
  id: string;
  name: string;
  coverImageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  workoutDays: Array<{
    id: string;
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    exercises: Array<{
      id: string;
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export class ListWorkoutPlan {
  async execute(dto: InputDto): Promise<OutputDto[] | null> {
    const workoutPlans = await prisma.workoutPlan.findMany({
      where: {
        userId: dto.userId,
      },
      include: {
        workoutDays: {
          include: {
            exercises: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!workoutPlans) {
      return null;
    }

    return workoutPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      coverImageUrl: plan.coverImageUrl,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      workoutDays: plan.workoutDays.map((day) => ({
        id: day.id,
        name: day.name,
        weekDay: day.weekDay,
        isRest: day.isRest,
        estimatedDurationInSeconds: day.estimatedDurationInSeconds,
        exercises: day.exercises.map((exercise) => ({
          id: exercise.id,
          order: exercise.order,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          restTimeInSeconds: exercise.restTimeInSeconds,
        })),
      })),
    }));
  }
}
