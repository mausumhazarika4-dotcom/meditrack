import { prisma } from "./prisma";
import {
  getDateInTimezone,
  getDayOfWeekInTimezone,
  createDateForTimezone,
  addDaysToDateString,
} from "./dateUtils";
import { Medication, ScheduledDose } from "@prisma/client";

export const GRACE_PERIOD_MS = 60 * 60 * 1000; // 60 minutes

export type DerivedDoseStatus = "UPCOMING" | "DUE" | "MISSED" | "TAKEN" | "SKIPPED";

export interface ScheduledDoseWithDerivedStatus extends ScheduledDose {
  derivedStatus: DerivedDoseStatus;
  isSnoozed: boolean;
  canTake: boolean;
  canSkip: boolean;
  canSnooze: boolean;
  canUndo: boolean;
}

/**
 * Derives the active status of a scheduled dose at a given moment in time.
 */
export function deriveDoseStatus(
  dose: Pick<ScheduledDose, "status" | "scheduledTime" | "snoozedUntil">,
  now: Date = new Date()
): {
  derivedStatus: DerivedDoseStatus;
  isSnoozed: boolean;
  canTake: boolean;
  canSkip: boolean;
  canSnooze: boolean;
  canUndo: boolean;
} {
  const isSnoozed = !!(dose.snoozedUntil && new Date(dose.snoozedUntil) > now);

  if (dose.status === "TAKEN") {
    return {
      derivedStatus: "TAKEN",
      isSnoozed: false,
      canTake: false,
      canSkip: false,
      canSnooze: false,
      canUndo: true,
    };
  }

  if (dose.status === "SKIPPED") {
    return {
      derivedStatus: "SKIPPED",
      isSnoozed: false,
      canTake: false,
      canSkip: false,
      canSnooze: false,
      canUndo: true,
    };
  }

  // Dose is SCHEDULED
  const scheduledTimeMs = new Date(dose.scheduledTime).getTime();
  const nowMs = now.getTime();

  if (nowMs < scheduledTimeMs) {
    return {
      derivedStatus: "UPCOMING",
      isSnoozed,
      canTake: true,
      canSkip: true,
      canSnooze: false,
      canUndo: false,
    };
  }

  if (nowMs <= scheduledTimeMs + GRACE_PERIOD_MS) {
    return {
      derivedStatus: "DUE",
      isSnoozed,
      canTake: true,
      canSkip: true,
      canSnooze: !isSnoozed, // can snooze if not already actively snoozed
      canUndo: false,
    };
  }

  // More than 60 minutes past scheduled time and not taken/skipped
  return {
    derivedStatus: "MISSED",
    isSnoozed: false,
    canTake: true, // User can still record late taken
    canSkip: true,
    canSnooze: false,
    canUndo: false,
  };
}

/**
 * Generates and reconciles scheduled doses for active medications across a date range.
 * This function is idempotent: calling it multiple times will not create duplicates.
 */
export async function reconcileDosesForRange(
  startDateStr: string,
  endDateStr: string,
  timeZone: string,
  now: Date = new Date()
) {
  // Fetch active medications (or all medications to preserve past history)
  const medications = await prisma.medication.findMany();

  for (const med of medications) {
    let reminderTimes: string[] = [];
    try {
      reminderTimes = JSON.parse(med.reminderTimes);
    } catch {
      reminderTimes = [];
    }

    if (!Array.isArray(reminderTimes) || reminderTimes.length === 0) {
      continue;
    }

    let activeDays: number[] = [];
    if (med.scheduleType === "SPECIFIC_DAYS" && med.daysOfWeek) {
      activeDays = med.daysOfWeek
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
    }

    // Iterate through dates from startDateStr to endDateStr
    let currentDateStr = startDateStr;
    while (currentDateStr <= endDateStr) {
      // Check medication start date and optional end date
      if (currentDateStr < med.startDate) {
        currentDateStr = addDaysToDateString(currentDateStr, 1);
        continue;
      }

      if (med.endDate && currentDateStr > med.endDate) {
        currentDateStr = addDaysToDateString(currentDateStr, 1);
        continue;
      }

      // Check day of week for SPECIFIC_DAYS
      const [year, month, day] = currentDateStr.split("-").map(Number);
      const tempDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const weekday = getDayOfWeekInTimezone(tempDate, timeZone);

      if (med.scheduleType === "SPECIFIC_DAYS" && !activeDays.includes(weekday)) {
        currentDateStr = addDaysToDateString(currentDateStr, 1);
        continue;
      }

      // For each reminder time
      for (const timeStr of reminderTimes) {
        const scheduledTime = createDateForTimezone(currentDateStr, timeStr, timeZone);

        // If medication is archived, do not generate new future doses
        if (med.archived && scheduledTime.getTime() > now.getTime()) {
          continue;
        }

        // Check if dose already exists (idempotency check)
        const existing = await prisma.scheduledDose.findUnique({
          where: {
            medicationId_scheduledTime: {
              medicationId: med.id,
              scheduledTime,
            },
          },
        });

        if (!existing) {
          await prisma.scheduledDose.create({
            data: {
              medicationId: med.id,
              scheduledTime,
              scheduledDate: currentDateStr,
              reminderTime: timeStr,
              medNameSnapshot: med.name,
              dosageSnapshot: med.dosage,
              instructionsSnapshot: med.instructions,
              status: "SCHEDULED",
            },
          });
        }
      }

      currentDateStr = addDaysToDateString(currentDateStr, 1);
    }
  }
}

/**
 * Gets today's schedule with derived statuses.
 */
export async function getTodaySchedule(timeZone: string, now: Date = new Date()) {
  const todayDateStr = getDateInTimezone(now, timeZone);

  // Ensure doses for today and adjacent days are reconciled
  const pastBufferDateStr = addDaysToDateString(todayDateStr, -2);
  const futureBufferDateStr = addDaysToDateString(todayDateStr, 1);
  await reconcileDosesForRange(pastBufferDateStr, futureBufferDateStr, timeZone, now);

  const rawDoses = await prisma.scheduledDose.findMany({
    where: {
      scheduledDate: todayDateStr,
    },
    include: {
      medication: true,
    },
    orderBy: {
      scheduledTime: "asc",
    },
  });

  const dosesWithStatus: (ScheduledDoseWithDerivedStatus & {
    medication: Medication;
  })[] = rawDoses.map((dose) => {
    const derived = deriveDoseStatus(dose, now);
    return {
      ...dose,
      ...derived,
    };
  });

  // Calculate today's summary counts
  let totalScheduled = dosesWithStatus.length;
  let takenCount = 0;
  let skippedCount = 0;
  let missedCount = 0;
  let upcomingCount = 0;
  let dueCount = 0;

  for (const d of dosesWithStatus) {
    switch (d.derivedStatus) {
      case "TAKEN":
        takenCount++;
        break;
      case "SKIPPED":
        skippedCount++;
        break;
      case "MISSED":
        missedCount++;
        break;
      case "DUE":
        dueCount++;
        break;
      case "UPCOMING":
        upcomingCount++;
        break;
    }
  }

  const remainingCount = upcomingCount + dueCount;

  return {
    todayDateStr,
    summary: {
      total: totalScheduled,
      taken: takenCount,
      skipped: skippedCount,
      missed: missedCount,
      upcoming: upcomingCount,
      due: dueCount,
      remaining: remainingCount,
    },
    doses: dosesWithStatus,
  };
}
