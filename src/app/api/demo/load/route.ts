import { NextResponse } from "next/server";
import { loadDemoData } from "@/lib/demoData";

export async function POST() {
  try {
    await loadDemoData();
    return NextResponse.json({ success: true, message: "Demo data loaded successfully." });
  } catch (error: any) {
    console.error("Failed to load demo data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load demo data" },
      { status: 500 }
    );
  }
}
