import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settingsEngine";
import { getDateInTimezone, addDaysToDateString } from "@/lib/dateUtils";
import { reconcileDosesForRange, deriveDoseStatus } from "@/lib/scheduleEngine";
import { calculateAdherence } from "@/lib/adherenceEngine";
import { generateAdherenceInsights } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getAppSettings();
    const timeZone = settings.timezone;
    const now = new Date();
    const todayStr = getDateInTimezone(now, timeZone);
    const fourteenDaysAgoStr = addDaysToDateString(todayStr, -14);

    // Reconcile past 14 days to have complete dose history
    await reconcileDosesForRange(fourteenDaysAgoStr, todayStr, timeZone, now);

    // Fetch active medications
    const activeMeds = await prisma.medication.findMany({
      where: { archived: false },
    });

    // Check low stock
    const lowStockMeds = activeMeds
      .filter((m) => m.stockTracking && m.stock !== null && m.stock <= (m.lowStockThreshold ?? 5))
      .map((m) => `${m.name} (${m.stock} doses left)`);

    // Fetch doses in the 14-day window
    const rawDoses = await prisma.scheduledDose.findMany({
      where: {
        scheduledDate: {
          gte: fourteenDaysAgoStr,
          lte: todayStr,
        },
      },
      orderBy: { scheduledTime: "desc" },
    });

    const dosesWithDerivedStatus = rawDoses.map((d) => ({
      ...d,
      ...deriveDoseStatus(d, now),
    }));

    const adherence = calculateAdherence(dosesWithDerivedStatus, now);

    const recentDosesSample = dosesWithDerivedStatus.slice(0, 15).map((d) => ({
      date: d.scheduledDate,
      time: d.reminderTime,
      medName: d.medNameSnapshot,
      status: d.derivedStatus,
    }));

    const insights = await generateAdherenceInsights({
      adherencePercentage: adherence.percentage,
      displayPercentage: adherence.displayPercentage,
      totalScheduled: adherence.eligibleScheduledDoses,
      takenCount: adherence.takenDoses,
      skippedCount: adherence.skippedDoses,
      missedCount: adherence.missedDoses,
      lowStockMedications: lowStockMeds,
      activeMedicationsCount: activeMeds.length,
      recentDosesSample,
    });

    return NextResponse.json({
      success: true,
      insights,
      adherence,
      activeMedicationsCount: activeMeds.length,
      lowStockMeds,
    });
  } catch (error: any) {
    console.error("AI Insights error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate AI insights.",
      },
      { status: 500 }
    );
  }
}
