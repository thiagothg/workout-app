import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { BadRequestError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

type ConsistencyDay = {
  workoutDayCompleted: boolean;
  workoutDayStarted: boolean;
};

type InputDto = {
  userId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
};

type OutputDto = {
  workoutStreak: number;
  consistencyByDay: Record<string, ConsistencyDay>;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
};

type DayjsUtcFactory = (
  date: string,
  format: string,
  strict: boolean,
) => dayjs.Dayjs;
type DayjsUtcFromDate = (date: Date) => dayjs.Dayjs;

const dayjsUtc = (date: string, format: string): dayjs.Dayjs => {
  const utcFactory = (dayjs as unknown as { utc: DayjsUtcFactory }).utc;
  return utcFactory(date, format, true);
};

const dayjsUtcFromDate = (date: Date): dayjs.Dayjs => {
  const utcFactory = (dayjs as unknown as { utc: DayjsUtcFromDate }).utc;
  return utcFactory(date);
};

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const fromDate = dayjsUtc(dto.from, "YYYY-MM-DD");
    const toDate = dayjsUtc(dto.to, "YYYY-MM-DD");

    if (!fromDate.isValid()) {
      throw new BadRequestError(
        "Invalid 'from' date format. Expected YYYY-MM-DD",
      );
    }

    if (!toDate.isValid()) {
      throw new BadRequestError(
        "Invalid 'to' date format. Expected YYYY-MM-DD",
      );
    }

    if (fromDate.isAfter(toDate)) {
      throw new BadRequestError(
        "'from' date must be before or equal to 'to' date",
      );
    }

    // Fetch all workout sessions in the date range
    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: {
            userId: dto.userId,
          },
        },
        startedAt: {
          gte: fromDate.startOf("day").toDate(),
          lte: toDate.endOf("day").toDate(),
        },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    });

    // Group sessions by date
    const consistencyByDay: Record<string, ConsistencyDay> = {};
    let completedWorkoutsCount = 0;
    let totalTimeInSeconds = 0;

    for (const session of sessions) {
      const dateKey = dayjsUtcFromDate(session.startedAt).format("YYYY-MM-DD");

      if (!consistencyByDay[dateKey]) {
        consistencyByDay[dateKey] = {
          workoutDayCompleted: false,
          workoutDayStarted: false,
        };
      }

      if (session.completedAt) {
        completedWorkoutsCount++;
        consistencyByDay[dateKey].workoutDayCompleted = true;
        consistencyByDay[dateKey].workoutDayStarted = true;

        // Calculate time spent
        const startTime = dayjsUtcFromDate(session.startedAt);
        const endTime = dayjsUtcFromDate(session.completedAt);
        const durationInSeconds = endTime.diff(startTime, "seconds");
        totalTimeInSeconds += durationInSeconds;
      } else {
        consistencyByDay[dateKey].workoutDayStarted = true;
      }
    }

    // Calculate conclusion rate
    const totalSessions = sessions.length;
    const conclusionRate =
      totalSessions > 0 ? completedWorkoutsCount / totalSessions : 0;

    // Calculate workout streak
    const workoutStreak = this.calculateStreak(consistencyByDay, toDate);

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }

  private calculateStreak(
    consistencyByDay: Record<string, ConsistencyDay>,
    endDate: dayjs.Dayjs,
  ): number {
    let streak = 0;
    let cursor = endDate;

    for (let i = 0; i < 365; i++) {
      const dateKey = cursor.format("YYYY-MM-DD");
      const dayData = consistencyByDay[dateKey];

      if (!dayData || !dayData.workoutDayCompleted) {
        break;
      }

      streak++;
      cursor = cursor.subtract(1, "day");
    }

    return streak;
  }
}
