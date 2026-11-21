import { NextRequest, NextResponse } from "next/server";
import { refillStock } from "@/lib/stockEngine";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const medId = params.id;
    const body = await req.json();
    const { quantity } = body;

    const numQuantity = Number(quantity);
    if (!Number.isInteger(numQuantity) || numQuantity <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Refill quantity must be a positive whole number (e.g. 10, 30).",
        },
        { status: 400 }
      );
    }

    const updatedMed = await refillStock(medId, numQuantity);

    return NextResponse.json({
      success: true,
      medication: updatedMed,
    });
  } catch (error: any) {
    console.error("Refill error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to refill stock" },
      { status: 500 }
    );
  }
}
