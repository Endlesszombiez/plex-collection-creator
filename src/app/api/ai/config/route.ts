import { NextRequest, NextResponse } from "next/server";
import {
  getAIConfig,
  saveAIConfig,
  clearAIConfig,
  normalizeCredentials,
} from "@/lib/ai/provider";
import { AIProvider, AI_PROVIDERS, getProviderInfo } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/config
 * Get current AI configuration (without exposing credentials)
 */
export async function GET() {
  try {
    const config = await getAIConfig();

    if (!config.configured || !config.provider) {
      return NextResponse.json({
        success: true,
        configured: false,
        provider: null,
        providerName: null,
      });
    }

    const providerInfo = getProviderInfo(config.provider);

    // Return provider info but mask credentials
    return NextResponse.json({
      success: true,
      configured: true,
      provider: config.provider,
      providerName: providerInfo?.name || config.provider,
      source: config.source,
    });
  } catch (error) {
    console.error("Error getting AI config:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get configuration",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/config
 * Save AI configuration
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
    const normalizedCredentials = normalizeCredentials(provider as AIProvider, credentials);
    if (providerInfo) {
      for (const field of providerInfo.requiredFields) {
        if (field.required && !normalizedCredentials[field.key]) {
          return NextResponse.json(
            { success: false, error: `${field.label} is required` },
            { status: 400 }
          );
        }
      }
    }

    // Save configuration (credentials will be encrypted)
    await saveAIConfig(provider as AIProvider, normalizedCredentials);

    return NextResponse.json({
      success: true,
      message: "Configuration saved successfully",
    });
  } catch (error) {
    console.error("Error saving AI config:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save configuration",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/config
 * Clear AI configuration
 */
export async function DELETE() {
  try {
    await clearAIConfig();

    return NextResponse.json({
      success: true,
      message: "Configuration cleared",
    });
  } catch (error) {
    console.error("Error clearing AI config:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear configuration",
      },
      { status: 500 }
    );
  }
}
