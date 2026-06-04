# AI Provider Scaffold

## Purpose

This document describes the code scaffold for adding first-class AI providers to Plex Collection Creator, starting with LM Studio Local Server alongside the existing Anthropic, OpenAI, Amazon Bedrock, and Google Vertex AI integrations.

The current app already uses the Vercel AI SDK through `generateText`, so provider expansion should preserve that model-facing surface. The main change is to make provider identity, credentials, model defaults, and adapter behavior explicit instead of baking all OpenAI-compatible servers into the OpenAI provider entry.

## Current Repo Shape

Core AI files:

- `src/lib/ai/types.ts`: provider IDs, credential field metadata, default models, and UI-facing provider catalog.
- `src/lib/ai/provider.ts`: provider model creation, connection testing, encrypted config persistence, environment variable discovery, full-model lookup, fast-model lookup, and clearing config.
- `src/app/api/ai/config/route.ts`: reads, validates, saves, and clears AI config.
- `src/app/api/ai/test/route.ts`: validates and tests a submitted provider config.
- `src/hooks/use-ai-config.ts`: client hook for config state, test, save, and clear actions.
- `src/components/ai/ai-config-card.tsx`: provider selection and credential form.
- `src/app/api/suggestions/generate/route.ts`: automatic collection generation through `getConfiguredAIModel`.
- `src/app/api/suggestions/custom/route.ts`: custom prompt generation through `getConfiguredAIModel` and `getFastAIModel`.
- `src/lib/embeddings/multi-pass-analyzer.ts`: multi-pass AI orchestration through `getConfiguredAIModel`, `getFastAIModel`, and `generateText`.

Storage:

- `src/lib/db/schema.ts` stores `settings.aiProvider` as text and `settings.aiCredentials` as encrypted JSON.
- Existing persisted provider values are expected to be `anthropic`, `bedrock`, `vertex`, or `openai`.
- Adding a provider ID such as `lmstudio` does not require a database schema migration because the column is plain text.

Dependencies:

- `@ai-sdk/openai` is already installed and supports OpenAI-compatible HTTP endpoints through `createOpenAI({ baseURL })`.
- LM Studio Local Server can use that OpenAI-compatible adapter with a local base URL and a model ID loaded in LM Studio.

## Recommended Provider Model

Introduce a provider registry that separates provider metadata from provider adapter behavior.

```ts
export type AIProvider =
  | "anthropic"
  | "bedrock"
  | "vertex"
  | "openai"
  | "lmstudio";

export interface AIProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  requiredFields: AICredentialField[];
  defaultModel: string;
  fastModel: string;
  models: string[];
  local?: boolean;
  openAICompatible?: boolean;
}
```

Add explicit credential types:

```ts
export interface LMStudioCredentials {
  baseUrl: string;
  model: string;
  fastModel?: string;
  apiKey?: string;
}
```

LM Studio provider metadata:

```ts
{
  id: "lmstudio",
  name: "LM Studio",
  description: "Local OpenAI-compatible server",
  defaultModel: "local-model",
  fastModel: "local-model",
  models: ["local-model"],
  local: true,
  openAICompatible: true,
  requiredFields: [
    {
      key: "baseUrl",
      label: "Base URL",
      type: "text",
      placeholder: "http://host.docker.internal:1234/v1",
      required: true,
      helpText: "Use http://localhost:1234/v1 when running outside Docker, or host.docker.internal from Docker."
    },
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "Loaded model identifier",
      required: true,
      helpText: "Use the model identifier shown by LM Studio Local Server."
    },
    {
      key: "fastModel",
      label: "Fast Model (Optional)",
      type: "text",
      placeholder: "Same as model",
      required: false,
      helpText: "Optional smaller local model for validation and deduplication."
    }
  ]
}
```

## Adapter Scaffold

Keep `createAIModel(provider, credentials, modelId?)` as the public function used by the rest of the app, but split internals into adapter helpers.

```ts
type ModelFactory = (
  credentials: Record<string, string>,
  modelId?: string
) => ReturnType<ReturnType<typeof createOpenAI>>;

const modelFactories: Record<AIProvider, ModelFactory> = {
  anthropic: createAnthropicModel,
  bedrock: createBedrockModel,
  vertex: createVertexModel,
  openai: createOpenAIModel,
  lmstudio: createLMStudioModel,
};
```

LM Studio adapter:

```ts
function createLMStudioModel(
  credentials: Record<string, string>,
  modelId?: string
) {
  const creds = credentials as unknown as LMStudioCredentials;
  const openai = createOpenAI({
    apiKey: creds.apiKey || "lm-studio",
    baseURL: normalizeBaseUrl(creds.baseUrl || "http://localhost:1234/v1"),
  });

  return openai(modelId || creds.model || getProviderInfo("lmstudio")!.defaultModel);
}
```

Normalization helper:

```ts
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}
```

The dummy `apiKey` is intentional for OpenAI-compatible local servers that ignore auth but whose SDK adapter still expects a key-shaped value.

## Fast Model Scaffold

Replace the hardcoded `FAST_MODELS` object with metadata-backed lookup:

```ts
function getFastModelId(
  provider: AIProvider,
  credentials: Record<string, string>
): string {
  if (provider === "lmstudio") {
    const creds = credentials as unknown as LMStudioCredentials;
    return creds.fastModel || creds.model || getProviderInfo(provider)!.fastModel;
  }

  return getProviderInfo(provider)!.fastModel;
}
```

Then `getFastAIModel()` should call `createAIModel(config.provider, config.credentials, getFastModelId(...))`.

## Environment Variables

Add LM Studio environment support after hosted API keys or before OpenAI, depending on the desired default. Recommended precedence is explicit local configuration before generic OpenAI because `OPENAI_BASE_URL` can be used for multiple compatible servers.

```env
# LM Studio Local Server
LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1
LMSTUDIO_MODEL=
LMSTUDIO_FAST_MODEL=
LMSTUDIO_API_KEY=lm-studio
```

Provider detection:

```ts
if (process.env.LMSTUDIO_BASE_URL && process.env.LMSTUDIO_MODEL) {
  return {
    provider: "lmstudio",
    credentials: {
      baseUrl: process.env.LMSTUDIO_BASE_URL,
      model: process.env.LMSTUDIO_MODEL,
      fastModel: process.env.LMSTUDIO_FAST_MODEL || "",
      apiKey: process.env.LMSTUDIO_API_KEY || "lm-studio",
    },
  };
}
```

## API Validation

The existing config and test routes already validate against `AI_PROVIDERS` and `requiredFields`. Once `lmstudio` is added to `AI_PROVIDERS`, both routes will accept and validate it without route-specific branching.

Add server-side normalization before saving:

- Trim `baseUrl`.
- Remove trailing slashes.
- Default `apiKey` to `lm-studio`.
- Default `fastModel` to `model` when omitted.

This keeps encrypted database credentials complete and predictable.

## UI Scaffold

`AIConfigCard` already renders providers and credential fields from `AI_PROVIDERS`, so first-class LM Studio support primarily needs metadata.

Recommended UI refinements:

- Use a single-column provider grid on small screens if five providers feel cramped.
- For LM Studio, show Base URL and Model as the only required fields.
- Keep API Key optional and hidden from the default path unless the local server is configured to require one.
- Show local-server help text with Docker guidance:
  - Outside Docker: `http://localhost:1234/v1`
  - Inside Docker: `http://host.docker.internal:1234/v1`

## Test Connection Behavior

The current test prompt asks the model to reply with exactly `OK`. Local models may include extra text, but the current implementation accepts any response containing `ok`, which is tolerant enough.

Additional LM Studio-specific error mapping should recognize:

- `ECONNREFUSED`: LM Studio server is not running or base URL is wrong.
- `fetch failed`: cannot reach local server from the app container.
- `404`: model name or `/v1` endpoint path is wrong.
- timeout: local model is unloaded, too large, or still warming up.

## Documentation Touchpoints

Update these docs when implementing:

- `.env.example`: add LM Studio variables.
- `README.md`: add LM Studio to requirements, setup guide, credential storage, and privacy notes.
- Optional: add a short local-server troubleshooting section for Docker networking.

## Compatibility Notes

Existing OpenAI `baseUrl` support can technically connect to LM Studio today if the user supplies an OpenAI-compatible URL and an API key placeholder. First-class `lmstudio` support is still worth adding because it:

- avoids implying that users need an OpenAI account,
- provides correct local-server defaults,
- supports explicit model and fast-model fields,
- allows provider-specific troubleshooting,
- makes privacy expectations clearer in the UI and docs.

