import { prisma } from "./prisma";
import { getDateInTimezone, getTimeInTimezone, createDateForTimezone, addDaysToDateString } from "./dateUtils";
import { getAppSettings } from "./settingsEngine";

export async function loadDemoData() {
  const settings = await getAppSettings();
  const timeZone = settings.timezone || "UTC";
  const now = new Date();
  const todayStr = getDateInTimezone(now, timeZone);
  const nowTimeStr = getTimeInTimezone(now, timeZone);
  const [currentHour, currentMin] = nowTimeStr.split(":").map(Number);

  // Helper to format HH:mm safely
  const formatHHMM = (h: number, m: number) => {
    const safeH = ((h % 24) + 24) % 24;
    return `${String(safeH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Construct times relative to right now:
  // 1) Due dose: scheduled 15 minutes ago (within 60m grace period)
  const dueTimeStr = formatHHMM(currentHour, Math.max(0, currentMin - 15));
  // 2) Upcoming dose: scheduled 2 hours in the future
  const upcomingTimeStr = formatHHMM(currentHour + 2, currentMin);
  // 3) Missed dose: scheduled 3 hours ago (>60 min past grace period)
  const missedTimeStr = formatHHMM(currentHour - 3, currentMin);
  // 4) Taken dose: morning dose at 08:00
  const takenTimeStr = "08:00";
  // 5) Skipped dose: morning dose at 07:00
  const skippedTimeStr = "07:00";

  // Create Sample Med 1: Daily multivitamin with Due dose and Upcoming dose
  const med1 = await prisma.medication.create({
    data: {
      name: "VitaDaily Multi-Nutrient (Demo)",
      dosage: "1 capsule",
      instructions: "Take with a glass of water after breakfast",
      scheduleType: "DAILY",
      reminderTimes: JSON.stringify([dueTimeStr, upcomingTimeStr]),
      startDate: addDaysToDateString(todayStr, -7),
      stockTracking: true,
      stock: 4, // Below low stock threshold of 5! Shows low stock warning
      lowStockThreshold: 5,
      isDemo: true,
      archived: false,
    },
  });

  // Create Sample Med 2: Blood pressure support with Taken and Skipped doses
  const med2 = await prisma.medication.create({
    data: {
      name: "CardioPulse Flora (Demo)",
      dosage: "1 tablet",
      instructions: "Take with morning meal",
      scheduleType: "DAILY",
      reminderTimes: JSON.stringify([takenTimeStr, skippedTimeStr]),
      startDate: addDaysToDateString(todayStr, -14),
      stockTracking: true,
      stock: 22,
      lowStockThreshold: 5,
      isDemo: true,
      archived: false,
    },
  });

  // Create Sample Med 3: Joint comfort with Missed dose (selected weekdays: Mon, Wed, Fri)
  const med3 = await prisma.medication.create({
    data: {
      name: "OptiFlex Joint Comfort (Demo)",
      dosage: "2 softgels",
      instructions: "Take before lunch with plenty of fluid",
      scheduleType: "SPECIFIC_DAYS",
      daysOfWeek: "0,1,2,3,4,5,6", // All days for reliable demo testing across any weekday
      reminderTimes: JSON.stringify([missedTimeStr]),
      startDate: addDaysToDateString(todayStr, -5),
      stockTracking: true,
      stock: 12,
      lowStockThreshold: 5,
      isDemo: true,
      archived: false,
    },
  });

  // Seed specific dose records for today demonstrating each status:
  // 1. Due dose
  await prisma.scheduledDose.create({
    data: {
      medicationId: med1.id,
      scheduledTime: createDateForTimezone(todayStr, dueTimeStr, timeZone),
      scheduledDate: todayStr,
      reminderTime: dueTimeStr,
      medNameSnapshot: med1.name,
      dosageSnapshot: med1.dosage,
      instructionsSnapshot: med1.instructions,
      status: "SCHEDULED", // Will dynamically derive as DUE
    },
  });

  // 2. Upcoming dose
  await prisma.scheduledDose.create({
    data: {
      medicationId: med1.id,
      scheduledTime: createDateForTimezone(todayStr, upcomingTimeStr, timeZone),
      scheduledDate: todayStr,
      reminderTime: upcomingTimeStr,
      medNameSnapshot: med1.name,
      dosageSnapshot: med1.dosage,
      instructionsSnapshot: med1.instructions,
      status: "SCHEDULED", // Will dynamically derive as UPCOMING
    },
  });

  // 3. Taken dose
  await prisma.scheduledDose.create({
    data: {
      medicationId: med2.id,
      scheduledTime: createDateForTimezone(todayStr, takenTimeStr, timeZone),
      scheduledDate: todayStr,
      reminderTime: takenTimeStr,
      medNameSnapshot: med2.name,
      dosageSnapshot: med2.dosage,
      instructionsSnapshot: med2.instructions,
      status: "TAKEN",
      takenAt: createDateForTimezone(todayStr, takenTimeStr, timeZone),
    },
  });

  // 4. Skipped dose
  await prisma.scheduledDose.create({
    data: {
      medicationId: med2.id,
      scheduledTime: createDateForTimezone(todayStr, skippedTimeStr, timeZone),
      scheduledDate: todayStr,
      reminderTime: skippedTimeStr,
      medNameSnapshot: med2.name,
      dosageSnapshot: med2.dosage,
      instructionsSnapshot: med2.instructions,
      status: "SKIPPED",
    },
  });

  // 5. Missed dose
  await prisma.scheduledDose.create({
    data: {
      medicationId: med3.id,
      scheduledTime: createDateForTimezone(todayStr, missedTimeStr, timeZone),
      scheduledDate: todayStr,
      reminderTime: missedTimeStr,
      medNameSnapshot: med3.name,
      dosageSnapshot: med3.dosage,
      instructionsSnapshot: med3.instructions,
      status: "SCHEDULED", // More than 60m ago -> will derive as MISSED
    },
  });

  // Also add some past historical doses for med2 for adherence demonstration
  for (let i = 1; i <= 3; i++) {
    const pastDateStr = addDaysToDateString(todayStr, -i);
    await prisma.scheduledDose.create({
      data: {
        medicationId: med2.id,
        scheduledTime: createDateForTimezone(pastDateStr, takenTimeStr, timeZone),
        scheduledDate: pastDateStr,
        reminderTime: takenTimeStr,
        medNameSnapshot: med2.name,
        dosageSnapshot: med2.dosage,
        instructionsSnapshot: med2.instructions,
        status: "TAKEN",
        takenAt: createDateForTimezone(pastDateStr, takenTimeStr, timeZone),
      },
    });
  }

  return { success: true };
}

export async function clearDemoData() {
  // Only remove medications marked isDemo: true, and their cascaded doses/adjustments
  // This guarantees user-created data is never deleted!
  const demoMeds = await prisma.medication.findMany({
    where: { isDemo: true },
    select: { id: true },
  });

  const demoIds = demoMeds.map((m) => m.id);

  if (demoIds.length > 0) {
    await prisma.scheduledDose.deleteMany({
      where: { medicationId: { in: demoIds } },
    });
    await prisma.stockAdjustment.deleteMany({
      where: { medicationId: { in: demoIds } },
    });
    await prisma.medication.deleteMany({
      where: { id: { in: demoIds } },
    });
  }

  return { count: demoIds.length };
}
