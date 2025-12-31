# Plex Collection Creator

**Automatically organize your Plex library with AI-powered collections.**

![Plex Collection Creator](https://img.shields.io/badge/Plex-Collection%20Creator-E5A00D?style=for-the-badge&logo=plex&logoColor=white)

---

## What It Does

- **Finds franchises automatically** — Star Wars, Marvel, Harry Potter, etc.
- **Discovers thematic collections** — "Mind-Bending Thrillers", "90s Classics", "Award Winners"
- **Custom searches** — Ask for anything: "Find all Christmas movies" or "Movies with twist endings"
- **One-click apply** — Review suggestions and create collections directly in Plex

If you need help getting started creating collections in your Plex library, give this a try and let me know what you think.

---

## What You Need

| Requirement           | Details                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- |
| **Docker Desktop**    | [Download here](https://www.docker.com/products/docker-desktop/) — free for personal use |
| **Plex Media Server** | Running on your network                                                                  |
| **AI API Key**        | From Anthropic, OpenAI, AWS Bedrock, or Google Vertex AI                                 |

---

## Quick Start

### 1. Start the App

Open a terminal and run:

```bash
git clone https://github.com/schuettc/plex-collection-creator.git
cd plex-collection-creator
docker compose up -d
```

### 2. Open Your Browser

Go to **[http://localhost:32500](http://localhost:32500)**

![Landing Page](docs/images/01-landing.png)

---

## Setup Guide

The setup wizard walks you through three steps:

### Step 1: Connect to Plex

Click **Connect with Plex** and sign in with your Plex account. The app will find your server automatically.

![Setup Wizard](docs/images/02-setup-wizard.png)

### Step 2: Choose Your Libraries

Select which movie and TV libraries you want to analyze.

### Step 3: Add Your AI Key

Enter your API key from your chosen AI provider.

![Setup Complete](docs/images/03-setup-complete.png)

---

## Creating Collections

Once setup is complete, you'll see the Dashboard:

![Dashboard](docs/images/04-dashboard-create.png)

### 1. Scan Your Library

Click **Start Scan** to fetch your media metadata from Plex.

![Scan Complete](docs/images/05-scan-complete.png)

### 2. Run AI Analysis

Click **Analyze** and let the AI find collection opportunities.

![Analysis Complete](docs/images/06-analysis-complete.png)

### 3. Review Suggestions

Browse the AI's suggestions. Each shows the movies/shows that would be included.

![Suggestions](docs/images/07-suggestions-list.png)

You can filter by type or search for specific collections:

![Filters](docs/images/08-suggestions-filters.png)

### 4. Apply to Plex

Click **Approve** on any suggestion to create it in Plex. Or **Reject** to dismiss it.

![Collections](docs/images/09-collections.png)

---

## Custom Searches

Want something specific? Use **Custom Search** to ask for anything:

- "Find all movies directed by Christopher Nolan"
- "Create a collection of 80s action movies"
- "Group movies with surprise endings"
- "Find all holiday and Christmas movies"

---

## Getting an AI API Key

| Provider             | How to Get a Key                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Anthropic**        | Sign up at [console.anthropic.com](https://console.anthropic.com), add a payment method, create an API key |
| **OpenAI**           | Sign up at [platform.openai.com](https://platform.openai.com), add a payment method, create an API key     |
| **AWS Bedrock**      | Requires AWS account with Bedrock model access enabled                                                     |
| **Google Vertex AI** | Requires GCP project with Vertex AI API enabled                                                            |

This app uses an LLM provider to analyze your library. Be sure to keep an eye on your costs.

---

## Security & Privacy

**Your credentials are safe:**

- **API keys are encrypted** using AES-256-GCM
- **Encryption key is auto-generated** on first startup and stored in your Docker volume
- **Nothing leaves your network** — the app runs entirely on your machine
- **No telemetry or analytics** — we don't collect any data
- **Open source** — you can inspect every line of code

Your AI provider only sees the movie titles and metadata needed to suggest collections. They don't receive your Plex credentials or any personal information.

**Using your own encryption key (optional):**

If you prefer to manage your own encryption key, create a `.env` file before starting:

```bash
# Generate a secure key and create .env file
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" > .env

# Then start the app
docker compose up -d
```

---

## FAQ

**Q: Does this modify my actual media files?**
No. It only creates collections in Plex's database. Your files are never touched.

**Q: Can I undo a collection?**
Yes. Collections can be deleted from Plex at any time.

**Q: Does it work with TV shows?**
Yes! It finds series, spinoffs, and shared-universe shows.

**Q: My Plex server isn't found. What do I do?**
Make sure your Plex server is on the same network as Docker. Try using the server's IP address directly instead of the hostname.

**Q: How do I stop the app?**
Run `docker compose down` in the terminal. Your data is preserved.

**Q: How do I completely reset?**
Run `docker compose down -v` to remove all data and start fresh.

---

This is a personal project and not associated with or created by Plex. I just love their app and wanted to make something to help me create collections.

---

## License

MIT
