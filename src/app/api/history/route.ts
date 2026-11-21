import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settingsEngine";
import { getDateInTimezone, addDaysToDateString } from "@/lib/dateUtils";
import { reconcileDosesForRange, deriveDoseStatus } from "@/lib/scheduleEngine";
import { calculateAdherence } from "@/lib/adherenceEngine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const settings = await getAppSettings();
    const timeZone = settings.timezone;
    const now = new Date();
    const todayStr = getDateInTimezone(now, timeZone);

    // Default to last 7 days if not provided
    const startDate = searchParams.get("startDate") || addDaysToDateString(todayStr, -7);
    const endDate = searchParams.get("endDate") || todayStr;
    const medicationId = searchParams.get("medicationId") || "all";
    const statusFilter = searchParams.get("status") || "all";

    // Ensure database has reconciled doses for this query range
    await reconcileDosesForRange(startDate, endDate, timeZone, now);

    // Build Prisma query
    const whereClause: any = {
      scheduledDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (medicationId !== "all") {
      whereClause.medicationId = medicationId;
    }

    const rawDoses = await prisma.scheduledDose.findMany({
      where: whereClause,
      include: {
        medication: true,
      },
      orderBy: [{ scheduledDate: "desc" }, { scheduledTime: "desc" }],
    });

    // Derive status for all fetched doses
    const allDosesWithStatus = rawDoses.map((dose) => {
      const derived = deriveDoseStatus(dose, now);
      return {
        ...dose,
        ...derived,
      };
    });

    // Calculate adherence across all doses in this query scope
    const adherence = calculateAdherence(allDosesWithStatus, now);

    // Apply status filter if specified
    const filteredDoses = allDosesWithStatus.filter((d) => {
      if (statusFilter === "all") return true;
      return d.derivedStatus === statusFilter;
    });

    return NextResponse.json({
      success: true,
      startDate,
      endDate,
      adherence,
      doses: filteredDoses,
    });
  } catch (error: any) {
    console.error("History query error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch history" },
      { status: 500 }
    );
  }
}
