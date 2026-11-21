import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settingsEngine";
import { getTodaySchedule } from "@/lib/scheduleEngine";
import { chatWithAssistant, ChatMessage } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { message, history = [] } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message cannot be empty." },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Message exceeds maximum length (1000 characters)." },
        { status: 400 }
      );
    }

    // Load ground truth from database to provide accurate schedule context
    const settings = await getAppSettings();
    const todaySchedule = await getTodaySchedule(settings.timezone);
    const activeMeds = await prisma.medication.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    });

    const context = {
      todayDateStr: todaySchedule.todayDateStr,
      timezone: settings.timezone,
      medications: activeMeds.map((m) => {
        let times: string[] = [];
        try {
          times = JSON.parse(m.reminderTimes);
        } catch {}
        return {
          name: m.name,
          dosage: m.dosage,
          instructions: m.instructions,
          scheduleSummary: `${m.scheduleType === "DAILY" ? "Every day" : "Selected days"} at ${times.join(", ")}`,
          stockRemaining: m.stockTracking ? m.stock : null,
        };
      }),
      todayDoses: todaySchedule.doses.map((d) => ({
        medName: d.medNameSnapshot,
        dosage: d.dosageSnapshot,
        time: d.reminderTime,
        status: d.derivedStatus,
      })),
    };

    const reply = await chatWithAssistant(
      Array.isArray(history) ? history : [],
      message.trim(),
      context
    );

    return NextResponse.json({
      success: true,
      reply,
    });
  } catch (error: any) {
    console.error("AI Chat error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate AI response. Please try again.",
      },
      { status: 500 }
    );
  }
}
