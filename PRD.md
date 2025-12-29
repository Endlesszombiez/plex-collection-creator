# Product Requirement Document: Plex Collection Creator

**Created**: 2025-12-28
**Version**: 1.0
**Status**: Draft
**Complexity**: Medium

---

## Executive Summary

A Docker-based application that uses AI to automatically analyze Plex media libraries and create intelligent collections. Users authenticate with their Plex account, provide their own AI API key, and the system suggests collections that can be reviewed and applied.

## Problem Statement

Plex users with large media libraries spend significant time manually organizing content into collections. Identifying franchises (Harry Potter, MCU), thematic groupings, and logical categories requires knowledge of the content and tedious manual work. An AI-powered tool can analyze library metadata and intelligently suggest collections, saving hours of curation effort.

## Target Users

### Primary Users
- Plex server administrators with medium-to-large libraries (100+ movies/shows)
- Tech-savvy users comfortable running Docker containers
- Users who want organized, browsable collections without manual curation

### User Pain Points
- Time-consuming manual collection creation
- Difficulty identifying all films in a franchise
- Inconsistent collection organization
- New content doesn't get added to relevant collections

## Goals & Success Criteria

### Product Goals
1. Reduce time to organize Plex library from hours to minutes
2. Discover collection opportunities users might miss
3. Provide a simple, single-container deployment experience

### Success Metrics
- User can go from `docker run` to first collection suggestions in under 5 minutes
- AI correctly identifies 90%+ of obvious franchises/series
- Collections apply successfully to Plex without errors

### Acceptance Criteria
- [ ] Single `docker run` command starts the application
- [ ] User can authenticate with Plex OAuth
- [ ] User can configure their preferred AI provider
- [ ] System scans Movies and TV Shows libraries
- [ ] AI suggests collections with reasoning
- [ ] User can review, approve, or reject suggestions
- [ ] Approved collections are created in Plex
- [ ] Custom prompts allow user-defined collection criteria

## Core Features

### Must Have (P0 - MVP)

1. **Plex Authentication**
   - OAuth-based authentication with Plex
   - Store auth token securely for subsequent sessions
   - Access user's Plex servers and libraries

2. **Library Scanning**
   - Fetch all items from Movies libraries
   - Fetch all items from TV Shows libraries
   - Extract relevant metadata (title, year, genres, actors, directors, etc.)

3. **Multi-Provider AI Integration**
   - Support Anthropic API (direct)
   - Support Amazon Bedrock (Claude models)
   - Support Google Vertex AI (Claude models)
   - Support OpenAI-compatible APIs
   - User provides their own API credentials
   - Secure credential storage (encrypted, never logged)

4. **Intelligent Collection Suggestions**
   - Identify franchises automatically (Harry Potter, Star Wars, MCU, etc.)
   - Detect series/sequels by title patterns
   - Suggest thematic collections based on content analysis
   - Provide reasoning for each suggestion

5. **Custom Collection Prompts**
   - User can define custom criteria ("Movies set in New York")
   - AI analyzes library against custom criteria
   - Results presented same as automatic suggestions

6. **Review & Apply Workflow**
   - Display all suggestions with included items
   - User can approve, reject, or modify each suggestion
   - Batch apply approved collections to Plex
   - Show success/failure status for each

7. **Docker Deployment**
   - Single container with all dependencies
   - SQLite database (file-based, no external DB)
   - Volume mount for persistent data
   - Environment variables for configuration

### Should Have (P1)

1. **Webhook Integration**
   - Receive Plex webhooks for new content
   - Auto-trigger collection analysis for new items
   - Suggest additions to existing collections

2. **Collection Management**
   - View existing Plex collections
   - Edit collections created by the app
   - Delete collections
   - Merge duplicate collections

3. **Scan History**
   - Track previous scans and suggestions
   - Avoid re-suggesting rejected collections
   - Show what's changed since last scan

### Nice to Have (P2)

1. **Hosted Service Option**
   - Clerk authentication for multi-user
   - PostgreSQL database backend
   - AWS CDK deployment option

2. **Smart Scheduling**
   - Scheduled periodic scans
   - Configurable scan frequency

3. **Collection Templates**
   - Pre-built prompt templates (Decades, Awards Winners, etc.)
   - Community-shared templates

## User Journeys

### Primary Journey: First-Time Setup & Scan

1. User runs `docker run` command with API key environment variable
2. User opens browser to `http://localhost:3000`
3. App prompts for Plex authentication
4. User clicks "Sign in with Plex" and completes OAuth flow
5. App displays available Plex servers/libraries
6. User selects libraries to scan
7. User configures AI provider (selects provider, enters credentials)
8. User clicks "Scan Library"
9. App fetches library data and sends to AI for analysis
10. App displays suggested collections with reasoning
11. User reviews each suggestion, approving or rejecting
12. User clicks "Apply Approved Collections"
13. App creates collections in Plex
14. User sees success confirmation

### Secondary Journey: Custom Collection Creation

1. User navigates to "Custom Collections"
2. User enters prompt: "Movies where the main character is a musician"
3. App analyzes library against criteria
4. Suggestions displayed for review
5. User approves and applies

### Secondary Journey: New Content Trigger (P1)

1. User adds new movie to Plex
2. Plex sends webhook to app (if configured)
3. App analyzes new item against existing collections and patterns
4. App suggests collection additions
5. User reviews and applies (or auto-apply if configured)

## Technical Approach

### Architecture Overview

```
┌────────────────────────────────────────┐
│         Single Docker Container         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     Next.js Application         │   │
│  │  ┌───────────┐ ┌─────────────┐  │   │
│  │  │  React UI │ │ API Routes  │  │   │
│  │  └───────────┘ └─────────────┘  │   │
│  └─────────────────────────────────┘   │
│                  │                      │
│  ┌─────────────────────────────────┐   │
│  │    SQLite Database (file)       │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────┬──────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
┌─────────┐              ┌──────────────┐
│  Plex   │              │ AI Provider  │
│ Server  │              │ (User's Key) │
└─────────┘              └──────────────┘
```

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 14+ | Full-stack React, API routes, single deployable |
| Language | TypeScript | Type safety, consistent frontend/backend |
| Database | SQLite | File-based, no external dependencies |
| ORM | Drizzle or Prisma | Type-safe database access |
| UI | React + Tailwind | Fast development, good DX |
| Container | Docker | Portable, consistent deployment |
| Plex API | plex-api (npm) | Established library |
| AI SDK | Vercel AI SDK | Multi-provider support built-in |

### Data Model (Core Entities)

- **Settings**: AI provider config, Plex connection info
- **ScanHistory**: Record of scans with timestamps
- **Suggestion**: AI-generated collection suggestions
- **AppliedCollection**: Collections created in Plex

### AI Integration Design

The Vercel AI SDK provides unified interface for multiple providers:
- Anthropic (direct API)
- Amazon Bedrock
- Google Vertex AI
- OpenAI-compatible

User credentials stored encrypted in SQLite, passed at runtime.

### Future-Proofing for Hosted Option

Design decisions that enable later hosting:
- All config via environment variables
- Database layer abstracted (swap SQLite for PostgreSQL)
- Auth flow designed for OAuth (add Clerk later)
- API routes structure supports standalone backend extraction

## Constraints

### Technical Constraints
- Must work on same network as Plex server (for local deployment)
- Dependent on Plex API stability
- AI quality dependent on library metadata quality
- Rate limits vary by AI provider

### Security Considerations
- User API keys encrypted at rest
- Keys never logged or exposed in responses
- Plex tokens stored securely
- Open source allows security auditing

## Out of Scope (v1)

- Music and Photo library support
- Mobile app
- Multi-user hosted service (deferred)
- Automated scheduling (deferred to P1)
- Collection artwork generation
- Direct Plex server installation (plugin)

## Open Questions

1. Should we support other AI providers beyond Claude/OpenAI (Gemini, Llama)?
2. What's the ideal batch size for AI analysis (full library vs. chunked)?
3. Should collection suggestions include confidence scores?

## Dependencies

- Plex API availability and OAuth stability
- AI provider API availability
- User has Docker installed
- User has AI provider account with API access

## Next Steps

This PRD feeds into the EPCC workflow:

**Recommended Path (Greenfield)**:
1. Review & approve this PRD
2. Run `/epcc-plan` to create implementation plan
3. Begin development with `/epcc-code`
4. Finalize with `/epcc-commit`

---

**End of PRD**
