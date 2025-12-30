# Plex Collection Creator

AI-powered collection suggestions for your Plex media library. Automatically detect franchises, series, and thematic groupings using AI analysis.

![Plex Collection Creator](https://img.shields.io/badge/Plex-Collection%20Creator-E5A00D?style=for-the-badge&logo=plex&logoColor=white)

![Dashboard](docs/images/08-suggestions-filters.png)

## Features

- **AI-Powered Analysis** - Uses AI to identify franchises, sequels, and thematic collections
- **Multi-Provider Support** - Works with Anthropic, Amazon Bedrock, Google Vertex AI, or OpenAI
- **Custom Prompts** - Create collections based on your own criteria ("Find all Christmas movies")
- **One-Click Apply** - Review suggestions and apply them directly to Plex
- **Secure** - All credentials encrypted with AES-256-GCM

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Plex Media Server (on same network)
- API key from one of: Anthropic, OpenAI, Amazon Bedrock, or Google Vertex AI

### 1. Clone and Start

```bash
git clone https://github.com/schuettc/plex-collection-creator.git
cd plex-collection-creator
docker compose up -d
```

### 2. Open the App

Navigate to [http://localhost:32500](http://localhost:32500)

### 3. Connect & Configure

1. **Connect Plex** - Sign in with your Plex account via OAuth
2. **Select Libraries** - Choose which movie/TV libraries to analyze
3. **Configure AI** - Add your AI provider credentials

![Setup Wizard](docs/images/03-setup-complete.png)

### 4. Create Collections

1. **Scan Library** - Fetch metadata from your Plex server
2. **Run AI Analysis** - Get intelligent collection suggestions
3. **Review & Apply** - Approve suggestions and create collections in Plex

![Analysis Complete](docs/images/06-analysis-complete.png)

## Configuration

### AI Providers

Configure one of the following AI providers in the app:

| Provider | What You Need |
|----------|---------------|
| **Anthropic** | API key from [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | API key from [platform.openai.com](https://platform.openai.com) |
| **Amazon Bedrock** | AWS credentials with Bedrock access |
| **Google Vertex AI** | GCP project with Vertex AI enabled |

### Environment Variables (Optional)

You can pre-configure credentials via environment variables instead of the UI:

```bash
# Create .env file
cp .env.example .env

# Edit with your credentials
ENCRYPTION_KEY=your-32-byte-hex-key  # Generate with: openssl rand -hex 32
ANTHROPIC_API_KEY=sk-ant-...
# OR
OPENAI_API_KEY=sk-...
# OR
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

Then start with:

```bash
docker compose up -d
```

## Data Persistence

Your data (Plex connection, AI config, scan history) is stored in a Docker volume.

### Data Lifecycle

| Command | Effect |
|---------|--------|
| `docker compose down` | Stops container, **keeps data** |
| `docker compose down -v` | Stops container, **deletes data** |
| `docker compose up -d` | Starts container, uses existing data |

### Backup Your Data

```bash
# Export database to current directory
docker run --rm \
  -v plex-collecton-creator_plex-collections-data:/data \
  -v $(pwd):/backup \
  alpine cp /data/plex-collections.db /backup/plex-backup.db
```

### Restore From Backup

```bash
# Import database from backup
docker run --rm \
  -v plex-collecton-creator_plex-collections-data:/data \
  -v $(pwd):/backup \
  alpine cp /backup/plex-backup.db /data/plex-collections.db
```

### Reset Everything

```bash
# Stop and remove all data
docker compose down -v

# Start fresh
docker compose up -d
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Generate database
npm run db:generate
npm run db:push

# Start dev server
npm run dev
```

### Build Docker Image

```bash
# Build locally
docker compose build

# Build with no cache
docker compose build --no-cache
```

### Database Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations (dev mode)
npm run db:push
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Single Docker Container          │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │         Next.js 16 (App Router)    │ │
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
│ Server  │           │ (your key)   │
└─────────┘           └──────────────┘
```

## Troubleshooting

### "Cannot connect to Plex server"

- Ensure your Plex server is on the same network as the Docker container
- Try using the server's IP address instead of hostname
- Check that remote access is enabled in Plex settings

### "AI analysis failed"

- Verify your API key is correct
- Check you have sufficient credits/quota with your AI provider
- For Bedrock: ensure your AWS credentials have `bedrock:InvokeModel` permission

### "Port 32500 already in use"

```bash
# Find what's using the port
lsof -i :32500

# Kill the process
kill -9 <PID>

# Or change the port in docker-compose.yml
ports:
  - "32501:3000"  # Use a different port
```

### View Container Logs

```bash
docker compose logs -f
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: SQLite + Drizzle ORM
- **UI**: React + Tailwind CSS + shadcn/ui
- **AI**: Vercel AI SDK (multi-provider)
- **Auth**: Plex OAuth

## License

MIT
