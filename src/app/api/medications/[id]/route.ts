import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settingsEngine";
import { getDateInTimezone, addDaysToDateString } from "@/lib/dateUtils";
import { reconcileDosesForRange } from "@/lib/scheduleEngine";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const med = await prisma.medication.findUnique({
      where: { id: params.id },
      include: {
        doses: {
          take: 20,
          orderBy: { scheduledTime: "desc" },
        },
        stockAdjustments: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!med) {
      return NextResponse.json(
        { success: false, error: "Medication not found" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, medication: med });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch medication" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const medId = params.id;
    const body = await req.json();
    const {
      name,
      dosage,
      instructions,
      scheduleType = "DAILY",
      daysOfWeek,
      reminderTimes,
      startDate,
      endDate,
      stockTracking = false,
      stock,
      lowStockThreshold = 5,
    } = body;

    // Validation
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Medication name is required." },
        { status: 400 }
      );
    }

    if (!dosage || typeof dosage !== "string" || !dosage.trim()) {
      return NextResponse.json(
        { success: false, error: "Dosage is required." },
        { status: 400 }
      );
    }

    if (!startDate || typeof startDate !== "string") {
      return NextResponse.json(
        { success: false, error: "Start date is required." },
        { status: 400 }
      );
    }

    if (endDate && endDate < startDate) {
      return NextResponse.json(
        { success: false, error: "End date cannot be earlier than start date." },
        { status: 400 }
      );
    }

    let parsedTimes: string[] = [];
    if (Array.isArray(reminderTimes)) {
      parsedTimes = reminderTimes.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof reminderTimes === "string") {
      try {
        parsedTimes = JSON.parse(reminderTimes);
      } catch {
        parsedTimes = [reminderTimes.trim()];
      }
    }

    if (parsedTimes.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one reminder time is required." },
        { status: 400 }
      );
    }

    const uniqueTimes = new Set(parsedTimes);
    if (uniqueTimes.size !== parsedTimes.length) {
      return NextResponse.json(
        { success: false, error: "Duplicate reminder times are not allowed." },
        { status: 400 }
      );
    }

    let finalDaysOfWeek: string | null = null;
    if (scheduleType === "SPECIFIC_DAYS") {
      if (!daysOfWeek || (typeof daysOfWeek === "string" && !daysOfWeek.trim())) {
        return NextResponse.json(
          {
            success: false,
            error: "Please select at least one day of the week.",
          },
          { status: 400 }
        );
      }
      finalDaysOfWeek = String(daysOfWeek).trim();
    }

    let parsedStock: number | null = null;
    let parsedThreshold: number | null = 5;

    if (stockTracking) {
      if (stock !== undefined && stock !== null && stock !== "") {
        const numStock = Number(stock);
        if (!Number.isInteger(numStock) || numStock < 0) {
          return NextResponse.json(
            { success: false, error: "Stock must be a non-negative whole number." },
            { status: 400 }
          );
        }
        parsedStock = numStock;
      } else {
        parsedStock = 0;
      }

      if (lowStockThreshold !== undefined && lowStockThreshold !== null) {
        const numThreshold = Number(lowStockThreshold);
        if (!Number.isInteger(numThreshold) || numThreshold < 0) {
          return NextResponse.json(
            {
              success: false,
              error: "Low-stock threshold must be a non-negative whole number.",
            },
            { status: 400 }
          );
        }
        parsedThreshold = numThreshold;
      }
    }

    parsedTimes.sort();

    const existingMed = await prisma.medication.findUnique({
      where: { id: medId },
    });

    if (!existingMed) {
      return NextResponse.json(
        { success: false, error: "Medication not found" },
        { status: 404 }
      );
    }

    const now = new Date();

    // Prospective update:
    // 1. Delete future uncompleted scheduled doses so new prospective schedule applies cleanly
    // Historical doses and any taken/skipped records are preserved untouched!
    await prisma.scheduledDose.deleteMany({
      where: {
        medicationId: medId,
        status: "SCHEDULED",
        scheduledTime: { gt: now },
      },
    });

    // 2. Update the medication
    const updatedMed = await prisma.medication.update({
      where: { id: medId },
      data: {
        name: name.trim(),
        dosage: dosage.trim(),
        instructions: instructions ? instructions.trim() : null,
        scheduleType: scheduleType === "SPECIFIC_DAYS" ? "SPECIFIC_DAYS" : "DAILY",
        daysOfWeek: finalDaysOfWeek,
        reminderTimes: JSON.stringify(parsedTimes),
        startDate,
        endDate: endDate ? endDate : null,
        stockTracking: Boolean(stockTracking),
        stock: parsedStock,
        lowStockThreshold: parsedThreshold,
      },
    });

    // 3. Reconcile doses forward for the next 7 days with the new schedule
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
      medication: updatedMed,
    });
  } catch (error: any) {
    console.error("Failed to update medication:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update medication" },
      { status: 500 }
    );
  }
}
