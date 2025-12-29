import { createAnthropic } from "@ai-sdk/anthropic";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  AIProvider,
  AICredentials,
  AnthropicCredentials,
  BedrockCredentials,
  VertexCredentials,
  OpenAICredentials,
  getProviderInfo,
} from "./types";
import { db, settings } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { eq } from "drizzle-orm";

/**
 * Create an AI model instance based on provider and credentials
 */
export function createAIModel(
  provider: AIProvider,
  credentials: Record<string, string>,
  modelId?: string
) {
  const providerInfo = getProviderInfo(provider);
  const model = modelId || providerInfo?.defaultModel || "";

  switch (provider) {
    case "anthropic": {
      const creds = credentials as unknown as AnthropicCredentials;
      const anthropic = createAnthropic({
        apiKey: creds.apiKey,
      });
      return anthropic(model);
    }

    case "bedrock": {
      const creds = credentials as unknown as BedrockCredentials;
      const bedrock = createAmazonBedrock({
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        region: creds.region,
      });
      return bedrock(model);
    }

    case "vertex": {
      const creds = credentials as unknown as VertexCredentials;
      const vertex = createVertex({
        project: creds.projectId,
        location: creds.location,
      });
      return vertex(model);
    }

    case "openai": {
      const creds = credentials as unknown as OpenAICredentials;
      const openai = createOpenAI({
        apiKey: creds.apiKey,
        baseURL: creds.baseUrl || undefined,
      });
      return openai(model);
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Test AI provider connection with a simple prompt
 */
export async function testAIConnection(
  provider: AIProvider,
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  try {
    const startTime = Date.now();
    const model = createAIModel(provider, credentials);

    // Simple test prompt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { text } = await generateText({
      model: model as any, // Type assertion needed due to AI SDK package version mismatches
      prompt: "Reply with exactly: OK",
    });

    const latencyMs = Date.now() - startTime;

    if (text.toLowerCase().includes("ok")) {
      return {
        success: true,
        message: `Connected successfully (${latencyMs}ms)`,
        latencyMs,
      };
    }

    return {
      success: true,
      message: `Connected (unexpected response: ${text.substring(0, 50)})`,
      latencyMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Parse common error messages
    if (message.includes("401") || message.includes("Unauthorized")) {
      return { success: false, message: "Invalid API key or credentials" };
    }
    if (message.includes("403") || message.includes("Forbidden")) {
      return { success: false, message: "Access denied - check permissions" };
    }
    if (message.includes("404") || message.includes("Not Found")) {
      return { success: false, message: "Model or endpoint not found" };
    }
    if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      return { success: false, message: "Connection timeout" };
    }

    return { success: false, message };
  }
}

/**
 * Save AI configuration to database (encrypted)
 */
export async function saveAIConfig(
  provider: AIProvider,
  credentials: Record<string, string>,
  model?: string
): Promise<void> {
  const encryptedCredentials = encrypt(JSON.stringify(credentials));

  const config = {
    provider,
    model: model || getProviderInfo(provider)?.defaultModel,
  };

  const existing = await db.select().from(settings).limit(1);

  if (existing.length > 0) {
    await db
      .update(settings)
      .set({
        aiProvider: provider,
        aiCredentials: encryptedCredentials,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, existing[0].id));
  } else {
    await db.insert(settings).values({
      aiProvider: provider,
      aiCredentials: encryptedCredentials,
    });
  }
}

/**
 * Get AI configuration from database
 */
export async function getAIConfig(): Promise<{
  provider: AIProvider | null;
  credentials: Record<string, string> | null;
  configured: boolean;
}> {
  const result = await db.select().from(settings).limit(1);

  if (result.length === 0 || !result[0].aiProvider || !result[0].aiCredentials) {
    return { provider: null, credentials: null, configured: false };
  }

  try {
    const credentials = JSON.parse(decrypt(result[0].aiCredentials));
    return {
      provider: result[0].aiProvider as AIProvider,
      credentials,
      configured: true,
    };
  } catch (error) {
    console.error("Error decrypting AI credentials:", error);
    return { provider: null, credentials: null, configured: false };
  }
}

/**
 * Get a configured AI model instance from stored settings
 */
export async function getConfiguredAIModel() {
  const config = await getAIConfig();

  if (!config.configured || !config.provider || !config.credentials) {
    return null;
  }

  return createAIModel(config.provider, config.credentials);
}

/**
 * Clear AI configuration
 */
export async function clearAIConfig(): Promise<void> {
  const existing = await db.select().from(settings).limit(1);

  if (existing.length > 0) {
    await db
      .update(settings)
      .set({
        aiProvider: null,
        aiCredentials: null,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, existing[0].id));
  }
}
