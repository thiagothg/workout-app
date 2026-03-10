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
  async execute(dto: InputDto): Promise<OutputDto | null> {
    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
      include: {
        workoutDays: {
          include: {
            exercises: true,
          },
        },
      },
    });

    if (!activeWorkoutPlan) {
      return null;
    }

    return {
      id: activeWorkoutPlan.id,
      name: activeWorkoutPlan.name,
      coverImageUrl: activeWorkoutPlan.coverImageUrl,
      isActive: activeWorkoutPlan.isActive,
      createdAt: activeWorkoutPlan.createdAt,
      updatedAt: activeWorkoutPlan.updatedAt,
      workoutDays: activeWorkoutPlan.workoutDays.map((day) => ({
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
    };
  }
}
