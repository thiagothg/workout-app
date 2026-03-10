import { ConflictError } from "../errors/index.js";
import { NotFoundError } from "../errors/index.js";
import { WorkoutPlanNotActiveError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

export interface OutputDto {
  userWorkoutSessionId: string;
}

export class StartWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const plan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
    });

    if (!plan) {
      throw new NotFoundError("Workout plan not found");
    }

    if (plan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    if (!plan.isActive) {
      throw new WorkoutPlanNotActiveError("Workout plan is not active");
    }

    const day = await prisma.workoutDay.findFirst({
      where: {
        id: dto.workoutDayId,
        workoutPlanId: plan.id,
      },
    });

    if (!day) {
      throw new NotFoundError("Workout day not found");
    }

    const existingSession = await prisma.workoutSession.findFirst({
      where: { workoutDayId: dto.workoutDayId },
    });

    if (existingSession) {
      throw new ConflictError("Workout session already started for this day");
    }

    const session = await prisma.workoutSession.create({
      data: {
        workoutDayId: dto.workoutDayId,
        startedAt: new Date(),
      },
    });

    return { userWorkoutSessionId: session.id };
  }
}
