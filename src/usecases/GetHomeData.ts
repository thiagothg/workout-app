import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { BadRequestError, NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

type InputDto = {
  userId: string;
  date: string; // YYYY-MM-DD
};

type ConsistencyDay = {
  workoutDayCompleted: boolean;
  workoutDayStarted: boolean;
};

type TodayWorkoutDay = {
  workoutPlanId: string;
  id: string;
  name: string;
  isRest: boolean;
  weekDay: WeekDay;
  estimatedDurationInSeconds: number;
  coverImageUrl?: string;
  exercisesCount: number;
};

export type OutputDto = {
  activeWorkoutPlanId: string;
  todayWorkoutDay: TodayWorkoutDay;
  workoutStreak: number;
  consistencyByDay: Record<string, ConsistencyDay>;
};

type DayjsUtcFactory = (date: string, format: string, strict: boolean) => dayjs.Dayjs;
type DayjsUtcFromDate = (date: Date) => dayjs.Dayjs;

const dayjsUtc = (date: string, format: string): dayjs.Dayjs => {
  const utcFactory = (dayjs as unknown as { utc: DayjsUtcFactory }).utc;
  return utcFactory(date, format, true);
};

const dayjsUtcFromDate = (date: Date): dayjs.Dayjs => {
  const utcFactory = (dayjs as unknown as { utc: DayjsUtcFromDate }).utc;
  return utcFactory(date);
};

const weekDayFromDate = (date: dayjs.Dayjs): WeekDay => {
  const day = date.day();
  switch (day) {
    case 0:
      return WeekDay.SUNDAY;
    case 1:
      return WeekDay.MONDAY;
    case 2:
      return WeekDay.TUESDAY;
    case 3:
      return WeekDay.WEDNESDAY;
    case 4:
      return WeekDay.THURSDAY;
    case 5:
      return WeekDay.FRIDAY;
    case 6:
      return WeekDay.SATURDAY;
    default:
      return WeekDay.MONDAY;
  }
};

export class GetHomeData {
  async execute(dto: InputDto): Promise<OutputDto> {
    const targetDate = dayjsUtc(dto.date, "YYYY-MM-DD");
    if (!targetDate.isValid()) {
      throw new BadRequestError("Invalid date");
    }

    const weekStart = targetDate.startOf("week"); // Sunday in UTC
    const weekEnd = targetDate.endOf("week"); // Saturday 23:59:59.999 in UTC
  
    const activePlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: {
        workoutDays: {
          include: {
            exercises: { select: { id: true } },
          },
        },
      },
    });
    
    if (!activePlan) {
      throw new NotFoundError("No active workout plan found");
    }

    const targetWeekDay = weekDayFromDate(targetDate);
    const todayDay = activePlan.workoutDays.find((d) => d.weekDay === targetWeekDay);
    
    if (!todayDay) {
      throw new NotFoundError("Workout day not found for provided date");
    }

    const sessionsInWeek = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: activePlan.id,
        },
        startedAt: {
          gte: weekStart.toDate(),
          lte: weekEnd.toDate(),
        },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    });
    

    const consistencyByDay: Record<string, ConsistencyDay> = {};
    for (let i = 0; i < 7; i++) {
      const dayKey = weekStart.add(i, "day").format("YYYY-MM-DD");
      consistencyByDay[dayKey] = {
        workoutDayCompleted: false,
        workoutDayStarted: false,
      };
    }

    for (const s of sessionsInWeek) {
      const key = dayjsUtcFromDate(s.startedAt).format("YYYY-MM-DD");
      const current = consistencyByDay[key];
      if (!current) continue;

      if (s.completedAt) {
        current.workoutDayCompleted = true;
        current.workoutDayStarted = true;
      } else {
        current.workoutDayStarted = true;
      }
    }
   

    const completedSessionsForStreak = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: activePlan.id,
        },
        completedAt: { not: null },
        startedAt: {
          lte: targetDate.endOf("day").toDate(),
          gte: targetDate.subtract(365, "day").startOf("day").toDate(),
        },
      },
      select: {
        startedAt: true,
      },
    });
    
    const completedDates = new Set(
      completedSessionsForStreak.map((s) =>
        dayjsUtcFromDate(s.startedAt).format("YYYY-MM-DD"),
      ),
    );

    let streak = 0;
    let cursor = targetDate;
    for (let i = 0; i < 365; i++) {
      const key = cursor.format("YYYY-MM-DD");
      if (!completedDates.has(key)) break;
      streak++;
      cursor = cursor.subtract(1, "day");
    }
    
    return {
      activeWorkoutPlanId: activePlan.id,
      todayWorkoutDay: {
        workoutPlanId: activePlan.id,
        id: todayDay.id,
        name: todayDay.name,
        isRest: todayDay.isRest,
        weekDay: todayDay.weekDay,
        estimatedDurationInSeconds: todayDay.estimatedDurationInSeconds,
        coverImageUrl: activePlan.coverImageUrl ?? undefined,
        exercisesCount: todayDay.exercises.length,
      },
      workoutStreak: streak,
      consistencyByDay,
    };
  }
}
