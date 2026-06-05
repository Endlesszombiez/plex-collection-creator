import { NextRequest, NextResponse } from "next/server";
import { listAIProviderModels, normalizeCredentials } from "@/lib/ai/provider";
import { AIProvider, AI_PROVIDERS, getProviderInfo } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/models
 * List model IDs from OpenAI-compatible provider endpoints.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, credentials } = body;

    if (!provider || !AI_PROVIDERS.find((p) => p.id === provider)) {
      return NextResponse.json(
        { success: false, error: "Invalid provider" },
        { status: 400 }
      );
    }

    if (!credentials || typeof credentials !== "object") {
      return NextResponse.json(
        { success: false, error: "Credentials are required" },
        { status: 400 }
      );
    }

    const providerInfo = getProviderInfo(provider as AIProvider);
    const normalizedCredentials = normalizeCredentials(provider as AIProvider, credentials);
    if (providerInfo) {
      for (const field of providerInfo.requiredFields) {
        if (field.key === "model" || field.key === "fastModel") {
          continue;
        }

        if (field.required && !normalizedCredentials[field.key]) {
          return NextResponse.json(
            { success: false, error: `${field.label} is required` },
            { status: 400 }
          );
        }
      }
    }

    const models = await listAIProviderModels(provider as AIProvider, normalizedCredentials);

    return NextResponse.json({
      success: true,
      models,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load models";

    if (
      message.includes("ECONNREFUSED") ||
      message.includes("fetch failed") ||
      message.includes("Failed to fetch")
    ) {
      return NextResponse.json({
        success: false,
        error: "Cannot reach LM Studio. Start the Local Server and check the base URL.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
