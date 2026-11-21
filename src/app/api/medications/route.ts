import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settingsEngine";
import { getDateInTimezone, addDaysToDateString } from "@/lib/dateUtils";
import { reconcileDosesForRange } from "@/lib/scheduleEngine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const showArchived = searchParams.get("archived") === "true";

    const medications = await prisma.medication.findMany({
      where: {
        archived: showArchived,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: { doses: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      medications,
    });
  } catch (error: any) {
    console.error("Failed to list medications:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to list medications" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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
        { success: false, error: "Dosage is required (e.g., '1 tablet', '5 ml')." },
        { status: 400 }
      );
    }

    if (!startDate || typeof startDate !== "string") {
      return NextResponse.json(
        { success: false, error: "Start date is required (YYYY-MM-DD)." },
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

    // Check for duplicate reminder times
    const uniqueTimes = new Set(parsedTimes);
    if (uniqueTimes.size !== parsedTimes.length) {
      return NextResponse.json(
        { success: false, error: "Duplicate reminder times are not allowed." },
        { status: 400 }
      );
    }

    // Validate selected days for SPECIFIC_DAYS
    let finalDaysOfWeek: string | null = null;
    if (scheduleType === "SPECIFIC_DAYS") {
      if (!daysOfWeek || (typeof daysOfWeek === "string" && !daysOfWeek.trim())) {
        return NextResponse.json(
          {
            success: false,
            error: "Please select at least one day of the week for this schedule.",
          },
          { status: 400 }
        );
      }
      finalDaysOfWeek = String(daysOfWeek).trim();
    }

    // Validate stock and threshold
    let parsedStock: number | null = null;
    let parsedThreshold: number | null = 5;

    if (stockTracking) {
      if (stock !== undefined && stock !== null && stock !== "") {
        const numStock = Number(stock);
        if (!Number.isInteger(numStock) || numStock < 0) {
          return NextResponse.json(
            {
              success: false,
              error: "Stock must be a non-negative whole number (0 or greater).",
            },
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

    // Sort reminder times chronologically
    parsedTimes.sort();

    const medication = await prisma.medication.create({
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

    if (stockTracking && parsedStock !== null && parsedStock > 0) {
      await prisma.stockAdjustment.create({
        data: {
          medicationId: medication.id,
          amount: parsedStock,
          balanceAfter: parsedStock,
          reason: "INITIAL_SET",
        },
      });
    }

    // Immediately reconcile doses for today so it appears on the dashboard immediately
    const settings = await getAppSettings();
    const todayStr = getDateInTimezone(new Date(), settings.timezone);
    await reconcileDosesForRange(
      todayStr,
      addDaysToDateString(todayStr, 2),
      settings.timezone
    );

    return NextResponse.json({
      success: true,
      medication,
    });
  } catch (error: any) {
    console.error("Failed to create medication:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create medication" },
      { status: 500 }
    );
  }
}
