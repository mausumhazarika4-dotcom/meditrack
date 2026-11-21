import { NextResponse } from "next/server";
import { getTodaySchedule } from "@/lib/scheduleEngine";
import { getAppSettings } from "@/lib/settingsEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getAppSettings();
    const schedule = await getTodaySchedule(settings.timezone);

    return NextResponse.json({
      success: true,
      timezone: settings.timezone,
      ...schedule,
    });
  } catch (error: any) {
    console.error("Failed to load today schedule:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load schedule" },
      { status: 500 }
    );
  }
}
