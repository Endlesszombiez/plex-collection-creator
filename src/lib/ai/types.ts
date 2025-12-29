/**
 * Supported AI providers
 */
export type AIProvider = "anthropic" | "bedrock" | "vertex" | "openai";

/**
 * Provider display information
 */
export interface AIProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  requiredFields: AICredentialField[];
  defaultModel: string;
  models: string[];
}

/**
 * Credential field definition
 */
export interface AICredentialField {
  key: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
  helpText?: string;
}

/**
 * Credentials for each provider
 */
export interface AnthropicCredentials {
  apiKey: string;
}

export interface BedrockCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface VertexCredentials {
  projectId: string;
  location: string;
  // Service account JSON is stored as a string
  serviceAccountJson?: string;
}

export interface OpenAICredentials {
  apiKey: string;
  baseUrl?: string; // For OpenAI-compatible APIs
}

export type AICredentials =
  | { provider: "anthropic"; credentials: AnthropicCredentials }
  | { provider: "bedrock"; credentials: BedrockCredentials }
  | { provider: "vertex"; credentials: VertexCredentials }
  | { provider: "openai"; credentials: OpenAICredentials };

/**
 * Provider configuration with all details
 */
export const AI_PROVIDERS: AIProviderInfo[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models via Anthropic API",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
    ],
    requiredFields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "sk-ant-...",
        required: true,
        helpText: "Get your API key from console.anthropic.com",
      },
    ],
  },
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    description: "Claude models via AWS Bedrock",
    defaultModel: "anthropic.claude-sonnet-4-20250514-v1:0",
    models: [
      "anthropic.claude-sonnet-4-20250514-v1:0",
      "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "anthropic.claude-3-5-haiku-20241022-v1:0",
    ],
    requiredFields: [
      {
        key: "accessKeyId",
        label: "Access Key ID",
        type: "text",
        placeholder: "AKIA...",
        required: true,
      },
      {
        key: "secretAccessKey",
        label: "Secret Access Key",
        type: "password",
        placeholder: "Your secret key",
        required: true,
      },
      {
        key: "region",
        label: "Region",
        type: "select",
        required: true,
        options: [
          { value: "us-east-1", label: "US East (N. Virginia)" },
          { value: "us-west-2", label: "US West (Oregon)" },
          { value: "eu-west-1", label: "Europe (Ireland)" },
          { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
        ],
      },
    ],
  },
  {
    id: "vertex",
    name: "Google Vertex AI",
    description: "Claude models via Google Cloud",
    defaultModel: "claude-sonnet-4@20250514",
    models: [
      "claude-sonnet-4@20250514",
      "claude-3-5-sonnet-v2@20241022",
      "claude-3-5-haiku@20241022",
    ],
    requiredFields: [
      {
        key: "projectId",
        label: "Project ID",
        type: "text",
        placeholder: "my-gcp-project",
        required: true,
      },
      {
        key: "location",
        label: "Location",
        type: "select",
        required: true,
        options: [
          { value: "us-east5", label: "US East (Ohio)" },
          { value: "us-central1", label: "US Central (Iowa)" },
          { value: "europe-west1", label: "Europe West (Belgium)" },
          { value: "asia-southeast1", label: "Asia Southeast (Singapore)" },
        ],
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models or OpenAI-compatible APIs",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    requiredFields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "sk-...",
        required: true,
        helpText: "Get your API key from platform.openai.com",
      },
      {
        key: "baseUrl",
        label: "Base URL (Optional)",
        type: "text",
        placeholder: "https://api.openai.com/v1",
        required: false,
        helpText: "For OpenAI-compatible APIs (e.g., local LLMs)",
      },
    ],
  },
];

/**
 * Get provider info by ID
 */
export function getProviderInfo(providerId: AIProvider): AIProviderInfo | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId);
}
