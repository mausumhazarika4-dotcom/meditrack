import { ScheduledDose } from "@prisma/client";
import { GRACE_PERIOD_MS } from "./scheduleEngine";

export interface AdherenceResult {
  takenDoses: number;
  skippedDoses: number;
  missedDoses: number;
  eligibleScheduledDoses: number;
  percentage: number | null; // null if no eligible doses
  displayPercentage: string; // e.g. "85.7%" or "No completed dose opportunities yet"
  isZeroOpportunities: boolean;
}

/**
 * Calculates adherence percentage strictly following the formula:
 * taken doses / eligible scheduled doses * 100
 *
 * Eligible scheduled doses include:
 * - Taken doses
 * - Skipped doses
 * - Missed doses (>60m past scheduled time without recorded action)
 *
 * Excludes:
 * - Future doses (scheduledTime > now)
 * - Doses still within current grace period (scheduledTime <= now && now <= scheduledTime + GRACE_PERIOD_MS)
 *   UNLESS they have already been marked as Taken or Skipped!
 */
export function calculateAdherence(
  doses: Pick<ScheduledDose, "status" | "scheduledTime">[],
  now: Date = new Date()
): AdherenceResult {
  let takenCount = 0;
  let skippedCount = 0;
  let missedCount = 0;

  const nowMs = now.getTime();

  for (const dose of doses) {
    if (dose.status === "TAKEN") {
      takenCount++;
    } else if (dose.status === "SKIPPED") {
      skippedCount++;
    } else {
      // Unrecorded / SCHEDULED dose
      const scheduledMs = new Date(dose.scheduledTime).getTime();
      // If it's more than 60 minutes past scheduled time, it is classified as MISSED
      if (nowMs > scheduledMs + GRACE_PERIOD_MS) {
        missedCount++;
      }
      // Else: either future or currently due within grace period -> EXCLUDED!
    }
  }

  const eligibleScheduledDoses = takenCount + skippedCount + missedCount;

  if (eligibleScheduledDoses === 0) {
    return {
      takenDoses: 0,
      skippedDoses: 0,
      missedDoses: 0,
      eligibleScheduledDoses: 0,
      percentage: null,
      displayPercentage: "No completed dose opportunities yet",
      isZeroOpportunities: true,
    };
  }

  const rawRate = (takenCount / eligibleScheduledDoses) * 100;
  // Round to 1 decimal place, e.g. 85.7% or 100%
  const rounded = Math.round(rawRate * 10) / 10;
  const displayPercentage = `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;

  return {
    takenDoses: takenCount,
    skippedDoses: skippedCount,
    missedDoses: missedCount,
    eligibleScheduledDoses,
    percentage: rounded,
    displayPercentage,
    isZeroOpportunities: false,
  };
}
