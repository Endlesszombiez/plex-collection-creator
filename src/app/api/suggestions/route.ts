import { NextResponse } from "next/server";
import { db, suggestions } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/suggestions
 * Fetch all suggestions, optionally filtered by status.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let results;
    if (status) {
      results = await db
        .select()
        .from(suggestions)
        .where(eq(suggestions.status, status))
        .orderBy(desc(suggestions.createdAt));
    } else {
      results = await db.select().from(suggestions).orderBy(desc(suggestions.createdAt));
    }

    // Parse items JSON for each suggestion
    const parsed = results.map((s) => ({
      ...s,
      items: JSON.parse(s.items),
    }));

    return NextResponse.json({
      success: true,
      suggestions: parsed,
    });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch suggestions",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/suggestions
 * Update suggestion status (approve/reject).
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing id or status" },
        { status: 400 }
      );
    }

    if (!["pending", "approved", "rejected", "applied"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    await db
      .update(suggestions)
      .set({ status })
      .where(eq(suggestions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating suggestion:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update suggestion",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/suggestions
 * Delete a suggestion.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing id" },
        { status: 400 }
      );
    }

    await db.delete(suggestions).where(eq(suggestions.id, parseInt(id, 10)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting suggestion:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete suggestion",
      },
      { status: 500 }
    );
  }
}
