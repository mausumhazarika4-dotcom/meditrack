import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settingsEngine";
import { getDateInTimezone, addDaysToDateString } from "@/lib/dateUtils";
import { reconcileDosesForRange } from "@/lib/scheduleEngine";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const medId = params.id;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "archive"; // "archive" or "unarchive"

    const isArchiving = action !== "unarchive";
    const now = new Date();

    if (isArchiving) {
      // 1. Remove future scheduled doses that haven't happened yet
      await prisma.scheduledDose.deleteMany({
        where: {
          medicationId: medId,
          status: "SCHEDULED",
          scheduledTime: { gt: now },
        },
      });

      // 2. Set archived flag
      const updatedMed = await prisma.medication.update({
        where: { id: medId },
        data: { archived: true },
      });

      return NextResponse.json({
        success: true,
        archived: true,
        medication: updatedMed,
      });
    } else {
      // Unarchive
      const updatedMed = await prisma.medication.update({
        where: { id: medId },
        data: { archived: false },
      });

      // Reconcile forward
      const settings = await getAppSettings();
      const todayStr = getDateInTimezone(now, settings.timezone);
      await reconcileDosesForRange(
        todayStr,
        addDaysToDateString(todayStr, 7),
        settings.timezone,
        now
      );

      return NextResponse.json({
        success: true,
        archived: false,
        medication: updatedMed,
      });
    }
  } catch (error: any) {
    console.error("Archive error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update archive status" },
      { status: 500 }
    );
  }
}
