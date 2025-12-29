# Plan: Plex Collection Creator MVP

**Created**: 2025-12-28 | **Effort**: ~40-50h | **Complexity**: Medium

## 1. Objective

**Goal**: Build a Docker-based application that uses AI to automatically suggest and create Plex collections.

**Why**: Plex users spend hours manually organizing libraries into collections. AI can identify franchises, series, and thematic groupings automatically.

**Success Criteria**:
- User can go from `docker run` to first collection suggestions in under 5 minutes
- AI correctly identifies 90%+ of obvious franchises/series
- Collections apply successfully to Plex without errors
- Single container deployment works reliably

## 2. Approach

### Architecture

```
┌─────────────────────────────────────────┐
│         Single Docker Container          │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │         Next.js 14+ (App Router)    │ │
│  │  ┌─────────────┐ ┌───────────────┐ │ │
│  │  │  React UI   │ │ API Routes    │ │ │
│  │  │  (Tailwind) │ │ (Server-side) │ │ │
│  │  └─────────────┘ └───────────────┘ │ │
│  └────────────────────────────────────┘ │
│                    │                     │
│  ┌────────────────────────────────────┐ │
│  │   SQLite + Drizzle ORM (volume)    │ │
│  └────────────────────────────────────┘ │
│                                          │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌─────────┐           ┌──────────────┐
│  Plex   │           │ AI Provider  │
│ Server  │           │ (user's key) │
└─────────┘           └──────────────┘
```

### Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | Next.js 14+ (App Router) | Full-stack, API routes, SSR, single deployable |
| **Language** | TypeScript | Type safety frontend + backend |
| **Database** | SQLite + Drizzle ORM | File-based, lightweight, type-safe queries |
| **UI** | React + Tailwind + shadcn/ui | Fast development, consistent design |
| **AI Integration** | Vercel AI SDK (direct providers) | Multi-provider support: `@ai-sdk/anthropic`, `@ai-sdk/amazon-bedrock`, `@ai-sdk/google-vertex`, `@ai-sdk/openai` |
| **Plex Integration** | `plex-api` + `plex-oauth` npm | Established libraries for OAuth and API calls |
| **Container** | Docker (node:20-alpine) | Lightweight, production-ready |
| **Encryption** | crypto (Node.js built-in) | AES-256-GCM for API key storage |

### Key Design Decisions

| Decision | Choice | Alternatives Considered |
|----------|--------|------------------------|
| **ORM** | Drizzle | Prisma (heavier, requires generate step) |
| **AI SDK** | Direct providers | Vercel AI Gateway (adds Vercel dependency) |
| **UI Library** | shadcn/ui | Radix only (more setup), Material UI (heavier) |
| **Plex Auth** | OAuth PIN flow | Direct credentials (less secure) |
| **State Management** | React Server Components + Context | Redux (overkill), Zustand (extra dependency) |

### Data Model

```
Settings
├── id (pk)
├── plex_token (encrypted)
├── plex_server_url
├── ai_provider (anthropic|bedrock|vertex|openai)
├── ai_credentials (encrypted JSON)
├── selected_libraries (JSON array)
└── created_at, updated_at

Scan
├── id (pk)
├── status (pending|running|completed|failed)
├── library_count
├── item_count
├── started_at
├── completed_at
└── error_message

Suggestion
├── id (pk)
├── scan_id (fk)
├── collection_name
├── reasoning
├── items (JSON array of Plex rating keys)
├── status (pending|approved|rejected|applied)
└── created_at

AppliedCollection
├── id (pk)
├── suggestion_id (fk)
├── plex_collection_key
├── applied_at
└── item_count
```

## 3. Tasks

### Phase 1: Foundation (~8h)

| Task | Est. | Description | Dependencies | Risk |
|------|------|-------------|--------------|------|
| **F002.1** Project scaffolding | 2h | Create Next.js 14 app with TypeScript, Tailwind, shadcn/ui | None | Low |
| **F002.2** Drizzle + SQLite setup | 2h | Configure Drizzle ORM, create schema, migrations | F002.1 | Low |
| **F001.1** Dockerfile creation | 2h | Multi-stage build, node:20-alpine, volume mounts | F002.1 | Low |
| **F001.2** Docker Compose + env config | 2h | Environment variables, volume mapping, health checks | F001.1 | Low |

### Phase 2: Plex Integration (~10h)

| Task | Est. | Description | Dependencies | Risk |
|------|------|-------------|--------------|------|
| **F003.1** OAuth PIN flow setup | 3h | Generate PIN, redirect to Plex, handle callback | Phase 1 | Medium |
| **F003.2** Token storage | 1.5h | Encrypt and store auth token in SQLite | F003.1, F002.2 | Low |
| **F004.1** Server discovery | 2h | Fetch user's Plex servers via plex.tv API | F003.2 | Low |
| **F004.2** Library listing | 2h | Fetch libraries, filter Movies/TV Shows | F004.1 | Low |
| **F012.1** Settings persistence | 1.5h | Save/load selected libraries and server URL | F004.2 | Low |

### Phase 3: AI Integration (~10h)

| Task | Est. | Description | Dependencies | Risk |
|------|------|-------------|--------------|------|
| **F006.1** Provider configuration UI | 2h | Dropdown + credential inputs for each provider | Phase 1 | Low |
| **F006.2** Credential encryption | 2h | AES-256-GCM encrypt/decrypt, never log | F006.1 | Medium |
| **F006.3** AI SDK multi-provider setup | 3h | Configure @ai-sdk/anthropic, bedrock, vertex, openai | F006.2 | Medium |
| **F006.4** Connection test endpoint | 1.5h | Validate credentials with simple API call | F006.3 | Low |
| **F007.1** Prompt engineering | 1.5h | Design prompts for franchise/collection detection | F006.3 | Medium |

### Phase 4: Library Scanning & AI Analysis (~10h)

| Task | Est. | Description | Dependencies | Risk |
|------|------|-------------|--------------|------|
| **F005.1** Metadata fetching | 3h | Paginated fetch of movie/show metadata | F004.2 | Medium |
| **F005.2** Progress tracking | 2h | Real-time scan progress via server-sent events | F005.1 | Low |
| **F007.2** AI analysis pipeline | 3h | Send metadata batches, parse structured suggestions | F007.1, F005.1 | High |
| **F007.3** Suggestion storage | 2h | Store suggestions with items and reasoning | F007.2 | Low |

### Phase 5: Review & Apply Workflow (~8h)

| Task | Est. | Description | Dependencies | Risk |
|------|------|-------------|--------------|------|
| **F008.1** Suggestion list UI | 2h | Display collections with items, reasoning | F007.3 | Low |
| **F009.1** Approve/reject actions | 2h | Update suggestion status, bulk actions | F008.1 | Low |
| **F009.2** Edit before apply | 2h | Modify name, add/remove items | F009.1 | Low |
| **F010.1** Apply to Plex | 2h | Create collections via Plex API, handle errors | F009.2, F004.2 | Medium |

### Phase 6: Custom Prompts (~4h)

| Task | Est. | Description | Dependencies | Risk |
|------|------|-------------|--------------|------|
| **F011.1** Custom prompt UI | 1.5h | Text input with examples | Phase 5 | Low |
| **F011.2** Custom analysis endpoint | 2.5h | Same pipeline as auto-scan but user prompt | F011.1, F007.2 | Low |

**Total Estimated: ~50h**

## 4. Quality Strategy

### Testing Approach

| Type | Coverage Target | Focus Areas |
|------|-----------------|-------------|
| **Unit Tests** | 80%+ for core logic | Encryption, Plex API parsing, AI response parsing |
| **Integration Tests** | Key flows | OAuth flow, scan pipeline, apply collections |
| **E2E Tests** | Happy paths | First-time setup, scan & apply |

### Test Priorities
1. Credential encryption/decryption (security-critical)
2. Plex OAuth token handling (user data)
3. AI response parsing (structured output validation)
4. Collection creation API calls (data integrity)

### Validation
- Manual testing with real Plex server
- Test with multiple AI providers
- Verify Docker deployment on clean machine

## 5. Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Plex OAuth instability** | High | Medium | Fallback to manual token entry (advanced mode) |
| **AI rate limits** | Medium | Medium | Implement retry with backoff, batch sizing |
| **Large library performance** | Medium | Medium | Pagination, streaming responses, progress UI |
| **Structured AI output parsing** | High | Medium | Use AI SDK's `generateObject` with Zod schemas |
| **Bedrock/Vertex auth complexity** | Medium | Medium | Clear docs, test connection feature |

### Assumptions
- User has Plex Pass (may be required for some API features)
- User has API access to at least one supported AI provider
- Docker installed on user's machine
- Same network access to Plex server

### Out of Scope (MVP)
- P1 features (webhooks, collection management, scan history)
- Music/Photo library support
- Multi-user / hosted deployment
- Scheduled scans
- Collection artwork

## 6. Implementation Order

```
Phase 1: Foundation
    │
    ├── F002: Next.js Scaffold ─────┐
    │                               │
    └── F001: Docker Setup ─────────┤
                                    │
Phase 2: Plex Integration           │
    │                               │
    ├── F003: OAuth ────────────────┤
    │                               │
    ├── F004: Server/Library ───────┤
    │                               │
    └── F012: Settings ─────────────┤
                                    │
Phase 3: AI Integration             │
    │                               │
    └── F006: Multi-Provider ───────┤
                                    │
Phase 4: Scanning & Analysis        │
    │                               │
    ├── F005: Library Scanning ─────┤
    │                               │
    └── F007: AI Analysis ──────────┤
                                    │
Phase 5: Review & Apply             │
    │                               │
    ├── F008: Suggestion Display ───┤
    │                               │
    ├── F009: Review Workflow ──────┤
    │                               │
    └── F010: Apply to Plex ────────┤
                                    │
Phase 6: Custom Prompts             │
    │                               │
    └── F011: Custom Collections ───┘
```

## 7. File Structure (Proposed)

```
plex-collection-creator/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── plex/         # OAuth, servers, libraries, collections
│   │   │   ├── ai/           # Provider config, analyze
│   │   │   ├── scan/         # Start scan, status, suggestions
│   │   │   └── settings/     # CRUD settings
│   │   ├── page.tsx          # Home/dashboard
│   │   ├── setup/            # First-time setup flow
│   │   ├── scan/             # Scan progress & results
│   │   ├── suggestions/      # Review & apply
│   │   └── settings/         # Configuration
│   │
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── plex/             # Plex-specific components
│   │   └── suggestions/      # Collection suggestion components
│   │
│   ├── lib/                   # Shared utilities
│   │   ├── db/               # Drizzle schema, client
│   │   ├── plex/             # Plex API wrapper
│   │   ├── ai/               # AI provider abstraction
│   │   ├── encryption.ts     # Credential encryption
│   │   └── prompts/          # AI prompt templates
│   │
│   └── types/                 # TypeScript types
│
├── drizzle/                   # Migrations
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Next Steps

**Ready for review!** Once approved:

1. Begin implementation with Phase 1 (Foundation)
2. Run `/epcc-code F001` to start with Docker setup, or
3. Run `/epcc-code F002` to start with Next.js scaffolding

**Questions?** Let me know if any aspect needs more detail or if you'd like to adjust priorities.
