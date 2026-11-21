import { NextRequest, NextResponse } from "next/server";
import { getAppSettings, updateAppSettings } from "@/lib/settingsEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getAppSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { timezone, reminderSound, largeText } = body;

    const settings = await updateAppSettings({
      timezone,
      reminderSound,
      largeText,
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
