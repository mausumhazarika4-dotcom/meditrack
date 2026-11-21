import { NextResponse } from "next/server";
import { clearDemoData } from "@/lib/demoData";

export async function POST() {
  try {
    const result = await clearDemoData();
    return NextResponse.json({
      success: true,
      message: `Cleared ${result.count} demo medications and their records. User data was preserved.`,
    });
  } catch (error: any) {
    console.error("Failed to clear demo data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear demo data" },
      { status: 500 }
    );
  }
}
