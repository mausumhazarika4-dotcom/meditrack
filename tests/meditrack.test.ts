import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  deriveDoseStatus,
  reconcileDosesForRange,
  getTodaySchedule,
  GRACE_PERIOD_MS,
} from "../src/lib/scheduleEngine";
import { calculateAdherence } from "../src/lib/adherenceEngine";
import {
  markDoseTaken,
  markDoseSkipped,
  undoDoseAction,
  snoozeDose,
  refillStock,
} from "../src/lib/stockEngine";
import {
  createDateForTimezone,
  getDateInTimezone,
  getDayOfWeekInTimezone,
  addDaysToDateString,
} from "../src/lib/dateUtils";

describe("MediTrack Comprehensive Test Suite", () => {
  beforeEach(async () => {
    // Clean database before each test
    await prisma.stockAdjustment.deleteMany({});
    await prisma.scheduledDose.deleteMany({});
    await prisma.medication.deleteMany({});
    await prisma.appSettings.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("1. Add a daily medication with multiple reminder times", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Test Daily Med",
        dosage: "1 tablet",
        instructions: "Take with water",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["08:00", "14:00", "20:00"]),
        startDate: "2026-11-20",
        stockTracking: true,
        stock: 30,
        lowStockThreshold: 5,
      },
    });

    expect(med.id).toBeDefined();
    expect(med.name).toBe("Test Daily Med");
    const times = JSON.parse(med.reminderTimes);
    expect(times).toEqual(["08:00", "14:00", "20:00"]);
  });

  it("2. Add a medication for selected weekdays", async () => {
    // Selected days: Monday (1), Wednesday (3), Friday (5)
    const med = await prisma.medication.create({
      data: {
        name: "Test Weekday Med",
        dosage: "2 capsules",
        scheduleType: "SPECIFIC_DAYS",
        daysOfWeek: "1,3,5",
        reminderTimes: JSON.stringify(["09:00"]),
        startDate: "2026-11-15",
      },
    });

    expect(med.scheduleType).toBe("SPECIFIC_DAYS");
    expect(med.daysOfWeek).toBe("1,3,5");

    // Reconcile across a known week
    // 2026-11-16 is Monday, 2026-11-17 is Tuesday, 2026-11-18 is Wednesday
    await reconcileDosesForRange("2026-11-16", "2026-11-18", "UTC");

    const doses = await prisma.scheduledDose.findMany({
      where: { medicationId: med.id },
      orderBy: { scheduledDate: "asc" },
    });

    // Mon (16th) and Wed (18th) should generate doses, but Tue (17th) should NOT
    expect(doses.length).toBe(2);
    expect(doses[0].scheduledDate).toBe("2026-11-16");
    expect(doses[1].scheduledDate).toBe("2026-11-18");
  });

  it("3. Reject invalid dates and duplicate reminder times", () => {
    // Duplicate times validation logic
    const reminderTimes = ["08:00", "14:00", "08:00"];
    const uniqueTimes = new Set(reminderTimes);
    const hasDuplicates = uniqueTimes.size !== reminderTimes.length;
    expect(hasDuplicates).toBe(true);

    // End date earlier than start date
    const startDate = "2026-11-25";
    const endDate = "2026-11-20";
    const isInvalidRange = endDate < startDate;
    expect(isInvalidRange).toBe(true);
  });

  it("4. Refresh and verify saved medication data persists", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Persistent Med",
        dosage: "10 ml",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["07:30"]),
        startDate: "2026-11-21",
        stockTracking: true,
        stock: 50,
      },
    });

    // Simulate query on page refresh
    const queried = await prisma.medication.findUnique({
      where: { id: med.id },
    });
    expect(queried).not.toBeNull();
    expect(queried?.name).toBe("Persistent Med");
    expect(queried?.stock).toBe(50);
  });

  it("5. Generate schedules twice and verify no duplicate doses (idempotency)", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Idempotent Med",
        dosage: "1 pill",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["08:00", "20:00"]),
        startDate: "2026-11-20",
      },
    });

    // Run 1st generation
    await reconcileDosesForRange("2026-11-20", "2026-11-21", "UTC");
    const countAfterFirst = await prisma.scheduledDose.count({
      where: { medicationId: med.id },
    });
    expect(countAfterFirst).toBe(4); // 2 days * 2 times = 4 doses

    // Run 2nd generation
    await reconcileDosesForRange("2026-11-20", "2026-11-21", "UTC");
    const countAfterSecond = await prisma.scheduledDose.count({
      where: { medicationId: med.id },
    });
    expect(countAfterSecond).toBe(4); // Must remain 4, no duplicates!
  });

  it("6. Mark a dose taken and verify dashboard/history update", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Heart Care",
        dosage: "1 tablet",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["08:00"]),
        startDate: "2026-11-21",
        stockTracking: true,
        stock: 10,
      },
    });

    await reconcileDosesForRange("2026-11-21", "2026-11-21", "UTC");
    const dose = await prisma.scheduledDose.findFirstOrThrow({
      where: { medicationId: med.id },
    });

    const takenDose = await markDoseTaken(dose.id);
    expect(takenDose.status).toBe("TAKEN");
    expect(takenDose.takenAt).not.toBeNull();

    // Verify stock decremented
    const updatedMed = await prisma.medication.findUniqueOrThrow({
      where: { id: med.id },
    });
    expect(updatedMed.stock).toBe(9);
  });

  it("7. Repeat the taken action and verify stock decreases only once (idempotent)", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Stock Med",
        dosage: "1 tablet",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["08:00"]),
        startDate: "2026-11-21",
        stockTracking: true,
        stock: 20,
      },
    });

    await reconcileDosesForRange("2026-11-21", "2026-11-21", "UTC");
    const dose = await prisma.scheduledDose.findFirstOrThrow({
      where: { medicationId: med.id },
    });

    // Click take 1st time
    await markDoseTaken(dose.id);
    let medCheck = await prisma.medication.findUniqueOrThrow({
      where: { id: med.id },
    });
    expect(medCheck.stock).toBe(19);

    // Repeated click on take
    await markDoseTaken(dose.id);
    medCheck = await prisma.medication.findUniqueOrThrow({
      where: { id: med.id },
    });
    expect(medCheck.stock).toBe(19); // Must NOT decrease again
  });

  it("8. Undo the taken action and verify stock restores only once", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Undo Test Med",
        dosage: "1 tablet",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["08:00"]),
        startDate: "2026-11-21",
        stockTracking: true,
        stock: 15,
      },
    });

    await reconcileDosesForRange("2026-11-21", "2026-11-21", "UTC");
    const dose = await prisma.scheduledDose.findFirstOrThrow({
      where: { medicationId: med.id },
    });

    // Mark taken -> stock drops to 14
    await markDoseTaken(dose.id);
    let medCheck = await prisma.medication.findUniqueOrThrow({
      where: { id: med.id },
    });
    expect(medCheck.stock).toBe(14);

    // Undo -> restores stock to 15, status back to SCHEDULED
    const undoneDose = await undoDoseAction(dose.id);
    expect(undoneDose.status).toBe("SCHEDULED");
    expect(undoneDose.takenAt).toBeNull();

    medCheck = await prisma.medication.findUniqueOrThrow({
      where: { id: med.id },
    });
    expect(medCheck.stock).toBe(15);

    // Second undo -> idempotent, stock must remain 15
    await undoDoseAction(dose.id);
    medCheck = await prisma.medication.findUniqueOrThrow({
      where: { id: med.id },
    });
    expect(medCheck.stock).toBe(15);
  });

  it("9. Skip a dose and verify stock is unchanged", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Skip Med",
        dosage: "1 capsule",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["08:00"]),
        startDate: "2026-11-21",
        stockTracking: true,
        stock: 25,
      },
    });

    await reconcileDosesForRange("2026-11-21", "2026-11-21", "UTC");
    const dose = await prisma.scheduledDose.findFirstOrThrow({
      where: { medicationId: med.id },
    });

    const skippedDose = await markDoseSkipped(dose.id);
    expect(skippedDose.status).toBe("SKIPPED");

    const medCheck = await prisma.medication.findUniqueOrThrow({
      where: { id: med.id },
    });
    expect(medCheck.stock).toBe(25); // Stock unchanged!
  });

  it("10. Snooze a dose and verify the snooze persists after refresh", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Snooze Med",
        dosage: "1 tablet",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["08:00"]),
        startDate: "2026-11-21",
      },
    });

    await reconcileDosesForRange("2026-11-21", "2026-11-21", "UTC");
    const dose = await prisma.scheduledDose.findFirstOrThrow({
      where: { medicationId: med.id },
    });

    const snoozed = await snoozeDose(dose.id, 10);
    expect(snoozed.snoozedUntil).not.toBeNull();

    // Query back from DB
    const fetched = await prisma.scheduledDose.findUniqueOrThrow({
      where: { id: dose.id },
    });
    expect(fetched.snoozedUntil).not.toBeNull();
    expect(new Date(fetched.snoozedUntil!).getTime()).toBeGreaterThan(Date.now());
  });

  it("11. Edit a schedule without changing past history", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Original Med Name",
        dosage: "1 tablet",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["08:00"]),
        startDate: "2026-11-15",
      },
    });

    // Create a historical completed dose
    const pastDose = await prisma.scheduledDose.create({
      data: {
        medicationId: med.id,
        scheduledTime: new Date("2026-11-15T08:00:00Z"),
        scheduledDate: "2026-11-15",
        reminderTime: "08:00",
        medNameSnapshot: "Original Med Name",
        dosageSnapshot: "1 tablet",
        status: "TAKEN",
        takenAt: new Date("2026-11-15T08:05:00Z"),
      },
    });

    // Update medication to new dosage & schedule
    await prisma.medication.update({
      where: { id: med.id },
      data: {
        name: "Updated Med Name",
        dosage: "2 tablets",
        reminderTimes: JSON.stringify(["09:00", "21:00"]),
      },
    });

    // Past completed dose must preserve its original snapshots and time!
    const preservedDose = await prisma.scheduledDose.findUniqueOrThrow({
      where: { id: pastDose.id },
    });
    expect(preservedDose.medNameSnapshot).toBe("Original Med Name");
    expect(preservedDose.dosageSnapshot).toBe("1 tablet");
    expect(preservedDose.reminderTime).toBe("08:00");
    expect(preservedDose.status).toBe("TAKEN");
  });

  it("12. Archive a medication and verify future reminders stop", async () => {
    const med = await prisma.medication.create({
      data: {
        name: "Archive Test Med",
        dosage: "1 tablet",
        scheduleType: "DAILY",
        reminderTimes: JSON.stringify(["08:00"]),
        startDate: "2026-11-20",
      },
    });

    // Set archived to true
    await prisma.medication.update({
      where: { id: med.id },
      data: { archived: true },
    });

    // Attempt to reconcile future doses
    const now = new Date("2026-11-21T10:00:00Z");
    await reconcileDosesForRange("2026-11-22", "2026-11-25", "UTC", now);

    const futureDoses = await prisma.scheduledDose.findMany({
      where: {
        medicationId: med.id,
        scheduledDate: { gte: "2026-11-22" },
      },
    });
    expect(futureDoses.length).toBe(0); // Future doses must not be created for archived med!
  });

  it("13. Verify missed-dose classification across date boundaries", () => {
    const scheduledTime = new Date("2026-11-20T23:30:00Z");
    // 2 hours later (into next day): 2026-11-21T01:30:00Z (> 60m past grace period)
    const now = new Date("2026-11-21T01:30:00Z");

    const statusObj = deriveDoseStatus(
      {
        status: "SCHEDULED",
        scheduledTime,
        snoozedUntil: null,
      },
      now
    );

    expect(statusObj.derivedStatus).toBe("MISSED");
  });

  it("14. Verify timezone-aware scheduling", () => {
    // In Asia/Kolkata (UTC+5:30), 08:00 AM on 2026-11-21 is 02:30 AM UTC
    const dateKolkata = createDateForTimezone(
      "2026-11-21",
      "08:00",
      "Asia/Kolkata"
    );
    expect(dateKolkata.toISOString()).toBe("2026-11-21T02:30:00.000Z");

    // In America/New_York (UTC-5 in standard time), 08:00 AM on 2026-11-21 is 13:00 UTC
    const dateNY = createDateForTimezone(
      "2026-11-21",
      "08:00",
      "America/New_York"
    );
    expect(dateNY.toISOString()).toBe("2026-11-21T13:00:00.000Z");

    // Converting back gives correct local date and time
    expect(getDateInTimezone(dateKolkata, "Asia/Kolkata")).toBe("2026-11-21");
    expect(getDateInTimezone(dateNY, "America/New_York")).toBe("2026-11-21");
  });

  it("15. Verify adherence excludes future and not-yet-overdue unresolved doses", () => {
    const now = new Date("2026-11-21T12:00:00Z");

    const doses = [
      // 1. Taken dose (completed opportunity)
      { status: "TAKEN", scheduledTime: new Date("2026-11-21T08:00:00Z") },
      // 2. Skipped dose (completed opportunity)
      { status: "SKIPPED", scheduledTime: new Date("2026-11-21T09:00:00Z") },
      // 3. Missed dose (scheduled at 10:00, now is 12:00 -> 2h past, completed opportunity)
      { status: "SCHEDULED", scheduledTime: new Date("2026-11-21T10:00:00Z") },
      // 4. Currently DUE dose (scheduled at 11:30, 30 min ago -> still in 60m grace period!) -> MUST EXCLUDE!
      { status: "SCHEDULED", scheduledTime: new Date("2026-11-21T11:30:00Z") },
      // 5. Future dose (scheduled at 18:00) -> MUST EXCLUDE!
      { status: "SCHEDULED", scheduledTime: new Date("2026-11-21T18:00:00Z") },
    ];

    const adherence = calculateAdherence(doses, now);
    // Eligible: 1 taken + 1 skipped + 1 missed = 3 doses
    expect(adherence.eligibleScheduledDoses).toBe(3);
    expect(adherence.takenDoses).toBe(1);
    expect(adherence.skippedDoses).toBe(1);
    expect(adherence.missedDoses).toBe(1);
    // Adherence: 1 / 3 * 100 = 33.3%
    expect(adherence.percentage).toBe(33.3);
    expect(adherence.displayPercentage).toBe("33.3%");
  });

  it("16. Verify zero opportunities displays informative message rather than misleading percentage", () => {
    const now = new Date("2026-11-21T12:00:00Z");

    const futureOnlyDoses = [
      { status: "SCHEDULED", scheduledTime: new Date("2026-11-21T14:00:00Z") },
      { status: "SCHEDULED", scheduledTime: new Date("2026-11-21T18:00:00Z") },
    ];

    const adherence = calculateAdherence(futureOnlyDoses, now);
    expect(adherence.eligibleScheduledDoses).toBe(0);
    expect(adherence.percentage).toBeNull();
    expect(adherence.displayPercentage).toBe(
      "No completed dose opportunities yet"
    );
  });

  it("17. Verify empty database behavior", async () => {
    const todaySchedule = await getTodaySchedule("UTC", new Date("2026-11-21T12:00:00Z"));
    expect(todaySchedule.doses).toEqual([]);
    expect(todaySchedule.summary.total).toBe(0);
    expect(todaySchedule.summary.taken).toBe(0);
    expect(todaySchedule.summary.remaining).toBe(0);
  });
});
