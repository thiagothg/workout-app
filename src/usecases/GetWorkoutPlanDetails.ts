import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

// Data Transfer Object
interface InputDto {
  userId: string;
  workoutPlanId: string;
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
    coverImageUrl?: string;
    estimatedDurationInSeconds: number;
    exercisesCount: number;
  }>;
}

export class GetWorkoutPlanDetails {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: {
        id: dto.workoutPlanId,
      },
      include: {
        workoutDays: {
          include: {
            exercises: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }

    if (workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    return {
      id: workoutPlan.id,
      name: workoutPlan.name,
      coverImageUrl: workoutPlan.coverImageUrl,
      isActive: workoutPlan.isActive,
      createdAt: workoutPlan.createdAt,
      updatedAt: workoutPlan.updatedAt,
      workoutDays: workoutPlan.workoutDays.map((day) => ({
        id: day.id,
        name: day.name,
        weekDay: day.weekDay,
        isRest: day.isRest,
        estimatedDurationInSeconds: day.estimatedDurationInSeconds,
        exercisesCount: day.exercises.length,
      })),
    };
  }
}
