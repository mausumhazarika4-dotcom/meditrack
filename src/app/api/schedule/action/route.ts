import { NextRequest, NextResponse } from "next/server";
import {
  markDoseTaken,
  markDoseSkipped,
  undoDoseAction,
  snoozeDose,
} from "@/lib/stockEngine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, doseId, snoozeMinutes = 10, customTakenAt } = body;

    if (!doseId) {
      return NextResponse.json(
        { success: false, error: "Dose ID is required" },
        { status: 400 }
      );
    }

    let result;
    switch (action) {
      case "take":
        result = await markDoseTaken(
          doseId,
          customTakenAt ? new Date(customTakenAt) : undefined
        );
        break;
      case "skip":
        result = await markDoseSkipped(doseId);
        break;
      case "undo":
        result = await undoDoseAction(doseId);
        break;
      case "snooze":
        result = await snoozeDose(doseId, Number(snoozeMinutes) || 10);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Invalid action '${action}'` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Schedule action error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute action" },
      { status: 500 }
    );
  }
}
