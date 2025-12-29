import { NextRequest, NextResponse } from "next/server";
import { testAIConnection } from "@/lib/ai/provider";
import { AIProvider, AI_PROVIDERS, getProviderInfo } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/test
 * Test AI provider connection with provided credentials
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, credentials } = body;

    // Validate provider
    if (!provider || !AI_PROVIDERS.find((p) => p.id === provider)) {
      return NextResponse.json(
        { success: false, error: "Invalid provider" },
        { status: 400 }
      );
    }

    // Validate credentials are provided
    if (!credentials || typeof credentials !== "object") {
      return NextResponse.json(
        { success: false, error: "Credentials are required" },
        { status: 400 }
      );
    }

    // Validate required fields
    const providerInfo = getProviderInfo(provider as AIProvider);
    if (providerInfo) {
      for (const field of providerInfo.requiredFields) {
        if (field.required && !credentials[field.key]) {
          return NextResponse.json(
            { success: false, error: `${field.label} is required` },
            { status: 400 }
          );
        }
      }
    }

    // Test the connection
    const result = await testAIConnection(provider as AIProvider, credentials);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error("Error testing AI connection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to test connection",
      },
      { status: 500 }
    );
  }
}
