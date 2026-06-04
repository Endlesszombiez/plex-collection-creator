import { createAnthropic } from "@ai-sdk/anthropic";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  AIProvider,
  AnthropicCredentials,
  BedrockCredentials,
  VertexCredentials,
  OpenAICredentials,
  LMStudioCredentials,
  getProviderInfo,
} from "./types";
import { db, settings } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { eq } from "drizzle-orm";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function normalizeCredentials(
  provider: AIProvider,
  credentials: Record<string, string>
): Record<string, string> {
  const normalized = Object.fromEntries(
    Object.entries(credentials).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ])
  ) as Record<string, string>;

  if ("baseUrl" in normalized) {
    normalized.baseUrl = normalizeBaseUrl(normalized.baseUrl);
  }

  if (provider === "lmstudio") {
    normalized.apiKey = normalized.apiKey || "lm-studio";
    normalized.fastModel = normalized.fastModel || normalized.model;
  }

  return normalized;
}

function createAnthropicModel(credentials: Record<string, string>, model: string) {
  const creds = credentials as unknown as AnthropicCredentials;
  const anthropic = createAnthropic({
    apiKey: creds.apiKey,
  });
  return anthropic(model);
}

function createBedrockModel(credentials: Record<string, string>, model: string) {
  const creds = credentials as unknown as BedrockCredentials;
  const bedrock = createAmazonBedrock({
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    region: creds.region,
  });
  return bedrock(model);
}

function createVertexModel(credentials: Record<string, string>, model: string) {
  const creds = credentials as unknown as VertexCredentials;
  const vertex = createVertex({
    project: creds.projectId,
    location: creds.location,
  });
  return vertex(model);
}

function createOpenAIModel(credentials: Record<string, string>, model: string) {
  const creds = credentials as unknown as OpenAICredentials;
  const openai = createOpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl || undefined,
  });
  return openai(model);
}

function createLMStudioModel(credentials: Record<string, string>, model: string) {
  const creds = credentials as unknown as LMStudioCredentials;
  const openai = createOpenAI({
    apiKey: creds.apiKey || "lm-studio",
    baseURL: creds.baseUrl || "http://localhost:1234/v1",
  });
  return openai(model);
}

const modelFactories: Record<
  AIProvider,
  (credentials: Record<string, string>, model: string) => unknown
> = {
  anthropic: createAnthropicModel,
  bedrock: createBedrockModel,
  vertex: createVertexModel,
  openai: createOpenAIModel,
  lmstudio: createLMStudioModel,
};

/**
 * Create an AI model instance based on provider and credentials
 */
export function createAIModel(
  provider: AIProvider,
  credentials: Record<string, string>,
  modelId?: string
) {
  const providerInfo = getProviderInfo(provider);
  const normalizedCredentials = normalizeCredentials(provider, credentials);
  const model =
    modelId ||
    (provider === "lmstudio" ? normalizedCredentials.model : undefined) ||
    providerInfo?.defaultModel ||
    "";
  const factory = modelFactories[provider];

  if (!factory) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return factory(normalizedCredentials, model);
}

function getFastModelId(provider: AIProvider, credentials: Record<string, string>): string {
  const providerInfo = getProviderInfo(provider);

  if (provider === "lmstudio") {
    const creds = normalizeCredentials(provider, credentials) as unknown as LMStudioCredentials;
    return creds.fastModel || creds.model || providerInfo?.fastModel || "";
  }

  return providerInfo?.fastModel || providerInfo?.defaultModel || "";
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
    const normalizedCredentials = normalizeCredentials(provider, credentials);
    const model = createAIModel(provider, normalizedCredentials);

    // Simple test prompt
    const { text } = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    if (provider === "lmstudio") {
      if (
        message.includes("ECONNREFUSED") ||
        message.includes("fetch failed") ||
        message.includes("Failed to fetch")
      ) {
        return {
          success: false,
          message:
            "Cannot reach LM Studio. Start the Local Server and check the base URL from this app.",
        };
      }
      if (message.includes("404") || message.includes("Not Found")) {
        return {
          success: false,
          message:
            "LM Studio endpoint or model not found. Include /v1 in the base URL and use a loaded model ID.",
        };
      }
      if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
        return {
          success: false,
          message:
            "LM Studio timed out. Make sure the model is loaded and give local models time to warm up.",
        };
      }
    }

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
  credentials: Record<string, string>
): Promise<void> {
  const normalizedCredentials = normalizeCredentials(provider, credentials);
  const encryptedCredentials = encrypt(JSON.stringify(normalizedCredentials));

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
 * Check for AI credentials in environment variables.
 * Returns provider and credentials if found, null otherwise.
 */
function getCredentialsFromEnv(): {
  provider: AIProvider;
  credentials: Record<string, string>;
} | null {
  // Check Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      credentials: { apiKey: process.env.ANTHROPIC_API_KEY },
    };
  }

  // Check LM Studio
  if (process.env.LMSTUDIO_BASE_URL && process.env.LMSTUDIO_MODEL) {
    return {
      provider: "lmstudio",
      credentials: normalizeCredentials("lmstudio", {
        baseUrl: process.env.LMSTUDIO_BASE_URL,
        model: process.env.LMSTUDIO_MODEL,
        fastModel: process.env.LMSTUDIO_FAST_MODEL || "",
        apiKey: process.env.LMSTUDIO_API_KEY || "lm-studio",
      }),
    };
  }

  // Check OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      credentials: normalizeCredentials("openai", {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL || "",
      }),
    };
  }

  // Check AWS Bedrock
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      provider: "bedrock",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || "us-east-1",
      },
    };
  }

  // Check Google Vertex AI
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return {
      provider: "vertex",
      credentials: {
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
      },
    };
  }

  return null;
}

/**
 * Get AI configuration.
 * Priority: 1) Environment variables, 2) Database (encrypted)
 */
export async function getAIConfig(): Promise<{
  provider: AIProvider | null;
  credentials: Record<string, string> | null;
  configured: boolean;
  source: "env" | "database" | null;
}> {
  // Priority 1: Check environment variables
  const envConfig = getCredentialsFromEnv();
  if (envConfig) {
    return {
      provider: envConfig.provider,
      credentials: envConfig.credentials,
      configured: true,
      source: "env",
    };
  }

  // Priority 2: Check database
  const result = await db.select().from(settings).limit(1);

  if (result.length === 0 || !result[0].aiProvider || !result[0].aiCredentials) {
    return { provider: null, credentials: null, configured: false, source: null };
  }

  try {
    const credentials = JSON.parse(decrypt(result[0].aiCredentials));
    return {
      provider: result[0].aiProvider as AIProvider,
      credentials,
      configured: true,
      source: "database",
    };
  } catch (error) {
    console.error("Error decrypting AI credentials:", error);
    return { provider: null, credentials: null, configured: false, source: null };
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
 * Get a fast/cheap model for lightweight tasks (deduplication, validation, etc.)
 * Uses Haiku for Claude providers, gpt-4o-mini for OpenAI
 */
export async function getFastAIModel() {
  const config = await getAIConfig();

  if (!config.configured || !config.provider || !config.credentials) {
    return null;
  }

  const fastModelId = getFastModelId(config.provider, config.credentials);
  return createAIModel(config.provider, config.credentials, fastModelId);
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
