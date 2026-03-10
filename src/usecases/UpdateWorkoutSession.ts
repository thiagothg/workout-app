import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

type InputDto = {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  workoutSessionId: string;
  completedAt: Date;
};

export type UpdateWorkoutSessionOutputDto = {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
};

export class UpdateWorkoutSession {
  async execute(dto: InputDto): Promise<UpdateWorkoutSessionOutputDto> {
    const plan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
    });

    if (!plan || plan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
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

    const session = await prisma.workoutSession.findFirst({
      where: {
        id: dto.workoutSessionId,
        workoutDayId: dto.workoutDayId,
      },
    });

    if (!session) {
      throw new NotFoundError("Workout session not found");
    }

    const updatedSession = await prisma.workoutSession.update({
      where: { id: dto.workoutSessionId },
      data: { completedAt: dto.completedAt },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return updatedSession;
  }
}

