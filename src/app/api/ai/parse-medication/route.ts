import { NextRequest, NextResponse } from "next/server";
import { parseMedicationNaturalLanguage } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { success: false, error: "Please provide a medication description or prescription note." },
        { status: 400 }
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Text exceeds maximum character limit (2000)." },
        { status: 400 }
      );
    }

    const draft = await parseMedicationNaturalLanguage(text);

    return NextResponse.json({
      success: true,
      draft,
    });
  } catch (error: any) {
    console.error("AI Parse error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to extract medication details from text.",
      },
      { status: 500 }
    );
  }
}
