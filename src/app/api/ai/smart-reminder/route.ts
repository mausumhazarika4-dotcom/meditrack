import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePersonalizedReminder } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let { doseId, medicationName, dosage, reminderTime, instructions } = body;

    // If doseId is provided, look up the dose snapshot in DB
    if (doseId) {
      const dose = await prisma.scheduledDose.findUnique({
        where: { id: doseId },
      });
      if (dose) {
        medicationName = dose.medNameSnapshot;
        dosage = dose.dosageSnapshot;
        reminderTime = dose.reminderTime;
        instructions = dose.instructionsSnapshot;
      }
    }

    if (!medicationName || !dosage) {
      return NextResponse.json(
        { success: false, error: "Medication name and dosage are required." },
        { status: 400 }
      );
    }

    const reminderText = await generatePersonalizedReminder({
      medicationName,
      dosage,
      reminderTime: reminderTime || "scheduled time",
      instructions: instructions || null,
    });

    return NextResponse.json({
      success: true,
      reminderText,
    });
  } catch (error: any) {
    console.error("Smart Reminder error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate smart reminder.",
      },
      { status: 500 }
    );
  }
}
