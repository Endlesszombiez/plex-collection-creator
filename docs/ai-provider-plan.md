# AI Provider Expansion Plan

## Goal

Add a maintainable AI provider architecture with first-class LM Studio Local Server support while preserving the existing OpenAI, Anthropic, Amazon Bedrock, and Google Vertex AI integrations.

The first implementation target is LM Studio because it can reuse the existing `@ai-sdk/openai` adapter through an OpenAI-compatible local endpoint.

## Phase 1: Provider Registry Cleanup

1. Extend `src/lib/ai/types.ts`.
   - Add `lmstudio` to `AIProvider`.
   - Add `LMStudioCredentials`.
   - Add `fastModel`, `local`, and `openAICompatible` metadata fields to `AIProviderInfo`.
   - Add `fastModel` values for all existing providers.
   - Add a full `LM Studio` provider entry.

2. Preserve existing provider IDs.
   - Do not rename `openai`, `anthropic`, `bedrock`, or `vertex`.
   - Existing encrypted database configs should continue to decrypt and run.

3. Decide whether to keep OpenAI-compatible custom endpoints under OpenAI.
   - Recommended: keep `openai.baseUrl` for generic compatibility.
   - Add `lmstudio` only for local LM Studio defaults and better UX.

## Phase 2: Provider Adapter Refactor

1. Refactor `src/lib/ai/provider.ts`.
   - Keep exported functions stable: `createAIModel`, `testAIConnection`, `saveAIConfig`, `getAIConfig`, `getConfiguredAIModel`, `getFastAIModel`, and `clearAIConfig`.
   - Move switch branches into small provider-specific factory functions.
   - Add `createLMStudioModel` using `createOpenAI`.

2. Replace `FAST_MODELS`.
   - Read fast defaults from `AI_PROVIDERS`.
   - For LM Studio, prefer `credentials.fastModel`, then `credentials.model`, then provider default.

3. Normalize credentials.
   - Add `normalizeCredentials(provider, credentials)`.
   - Trim URL and model fields.
   - Remove trailing slashes from base URLs.
   - Default LM Studio `apiKey` to `lm-studio`.
   - Default LM Studio `fastModel` to `model` if omitted.

4. Improve provider-specific test errors.
   - Map local server connection failures to actionable LM Studio messages.
   - Keep existing hosted-provider auth and permission errors.

## Phase 3: Environment Configuration

1. Update `.env.example`.
   - Add `LMSTUDIO_BASE_URL`.
   - Add `LMSTUDIO_MODEL`.
   - Add `LMSTUDIO_FAST_MODEL`.
   - Add optional `LMSTUDIO_API_KEY`.
   - Add `OPENAI_BASE_URL`, which provider code already reads but the example currently omits.

2. Update environment detection in `getCredentialsFromEnv`.
   - Add LM Studio detection.
   - Recommended priority:
     1. Anthropic
     2. LM Studio
     3. OpenAI
     4. Amazon Bedrock
     5. Google Vertex AI
   - This keeps explicit local setup from being swallowed by generic OpenAI settings.

3. Document Docker networking.
   - Native/local Next dev: `http://localhost:1234/v1`.
   - Docker app container to host LM Studio: `http://host.docker.internal:1234/v1`.
   - Linux Docker may need `extra_hosts` or host networking if `host.docker.internal` is unavailable.

## Phase 4: UI and API Wiring

1. API routes should need little change.
   - `src/app/api/ai/config/route.ts` and `src/app/api/ai/test/route.ts` already validate provider IDs and required fields from `AI_PROVIDERS`.
   - Add credential normalization before save and before test.

2. Update `src/components/ai/ai-config-card.tsx`.
   - Confirm five providers render cleanly.
   - Consider responsive `grid-cols-1 sm:grid-cols-2`.
   - For LM Studio, rely on metadata fields for Base URL, Model, and optional Fast Model.

3. Update `src/hooks/use-ai-config.ts` only if API response shape changes.
   - No hook changes are required for a simple provider addition.

4. Confirm setup flow.
   - `src/app/setup/page.tsx` uses `AIConfigCard`, so the new provider should appear automatically.

## Phase 5: Analysis Path Validation

1. Validate automatic analysis.
   - `src/app/api/suggestions/generate/route.ts` calls `getConfiguredAIModel`.
   - `src/lib/embeddings/multi-pass-analyzer.ts` calls both full and fast models.
   - Confirm LM Studio works for franchise, creator, thematic, completeness, and validation passes.

2. Validate custom search.
   - `src/app/api/suggestions/custom/route.ts` uses full and fast models for audit, new collection discovery, dedupe, and validation.
   - Confirm fast model fallback works when `fastModel` is omitted.

3. Watch JSON strictness.
   - Local models are more likely than hosted Claude/OpenAI models to wrap JSON in prose.
   - Existing parsers remove markdown fences but expect valid JSON afterward.
   - If local test runs show parse failures, add a shared `extractJsonObject` helper before broad provider changes.

## Phase 6: Documentation

1. Update `README.md`.
   - Add LM Studio to the AI provider list.
   - Add a short "Using LM Studio" subsection.
   - Explain that Plex metadata stays on the machine when using a local model.
   - Keep the warning that metadata is sent to whichever AI provider is configured.

2. Add troubleshooting notes.
   - LM Studio server must be started.
   - A model must be loaded.
   - The app must use the `/v1` base URL.
   - Docker users should use `host.docker.internal`.
   - Slower local models may make analysis take longer than hosted APIs.

3. Optionally add screenshots later.
   - Only after the UI has been implemented and verified.

## Phase 7: Test Plan

1. Static checks.
   - Run `npm run lint`.
   - Run `npm run build`.

2. Unit-level smoke checks, if no test framework exists.
   - Import `AI_PROVIDERS` and confirm `getProviderInfo("lmstudio")` returns required fields.
   - Confirm credential normalization for LM Studio base URLs and defaults.

3. Manual API checks.
   - Start LM Studio Local Server.
   - Run the app in the intended mode, Docker or local dev.
   - POST `/api/ai/test` with:
     ```json
     {
       "provider": "lmstudio",
       "credentials": {
         "baseUrl": "http://host.docker.internal:1234/v1",
         "model": "loaded-model-id"
       }
     }
     ```
   - Confirm response returns `success: true`.

4. Manual product checks.
   - Configure LM Studio through setup.
   - Scan a small Plex library.
   - Run automatic analysis.
   - Run a custom search.
   - Confirm suggestions save and render.

## Phase 8: Future Provider Additions

After LM Studio is working, the same scaffold can support:

- Ollama through an OpenAI-compatible endpoint or a dedicated adapter.
- OpenRouter through `createOpenAI` with a hosted base URL and API key.
- vLLM or llama.cpp server through OpenAI-compatible endpoints.
- Additional hosted SDK providers already present in Vercel AI SDK.

For each new provider:

1. Add a provider ID and credential type.
2. Add provider metadata.
3. Add or reuse an adapter factory.
4. Add environment variable detection.
5. Add provider-specific test error messages.
6. Update README setup and privacy language.

## Implementation Order

Recommended first PR:

1. `src/lib/ai/types.ts`
2. `src/lib/ai/provider.ts`
3. `.env.example`
4. `README.md`
5. small UI layout adjustment in `src/components/ai/ai-config-card.tsx`

Recommended second PR if needed:

1. Shared JSON extraction helper for local model tolerance.
2. Provider-specific timeout configuration.
3. Optional model discovery endpoint for LM Studio `/v1/models`.

This keeps the first change focused on first-class provider support and leaves model-output hardening for evidence from real local-model testing.

