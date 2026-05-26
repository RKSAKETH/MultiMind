# MultiMind — Multi-Agent AI Workspace

> Four AI agents. One problem. Real-time collaborative intelligence.

MultiMind deploys four specialized AI agents — Strategist, Critic, Technical Expert, and Creative — to simultaneously analyze any problem you submit, streaming their responses in real time. Once all agents complete, a fifth synthesis call unifies their insights into a final comprehensive answer.

---

## Project Structure

```
MultiMind/
├── web/          # Next.js 14 App Router (frontend + API routes)
└── ws-server/    # Standalone Express + Socket.io server (agent orchestration)
```

---

## Prerequisites

- **Node.js** 18+
- **npm** 9+
- A **Neon** PostgreSQL database ([neon.tech](https://neon.tech))
- A **Clerk** account ([clerk.com](https://clerk.com))
- A **Google Gemini** API key ([ai.google.dev](https://ai.google.dev))
- A **Pinecone** account with an index of **384 dimensions, cosine metric** ([pinecone.io](https://pinecone.io))

---

## Quick Start

### 1. Clone and enter the project

```bash
cd MultiMind
```

### 2. Set up `ws-server`

```bash
cd ws-server
cp .env.example .env
# Fill in: GEMINI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME
npm install
npm run dev
```

The WebSocket server starts on **http://localhost:4000**.

### 3. Set up `web`

Open a new terminal:

```bash
cd web
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY,
#          DATABASE_URL (Neon connection string)
npm install
npm run db:push    # Creates all tables in Neon
npm run dev
```

The Next.js app starts on **http://localhost:3000**.

---

## Environment Variables

### `ws-server/.env`

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX_NAME` | Name of your Pinecone index (must be 384-dim, cosine) |
| `PORT` | Port for ws-server (default: 4000) |

### `web/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_WS_SERVER_URL` | URL of ws-server (default: http://localhost:4000) |

---

## Pinecone Setup

Create a Pinecone index with these settings:
- **Dimensions**: `384`
- **Metric**: `cosine`
- **Cloud**: Any (e.g., AWS us-east-1)

The ws-server uses four namespaces within this index: `strategist`, `critic`, `technical`, `creative`.

---

## Architecture

```
Browser ──────────────────────── Next.js (web/)
  │                                   │
  │  Socket.io                        │  REST API
  ▼                                   ▼
ws-server/ ────────────────────── Neon PostgreSQL
  │                               (via Drizzle ORM)
  ├─ Orchestrator
  │    ├─ Transformers.js (embeddings)
  │    ├─ Pinecone (per-agent memory)
  │    └─ Gemini API (4 parallel streams + synthesis)
```

## Socket.io Events

| Direction | Event | Payload |
|---|---|---|
| Client → Server | `start_debate` | `{ problem, userId, sessionId }` |
| Server → Client | `agent_token` | `{ agentId, token }` |
| Server → Client | `agent_done` | `{ agentId }` |
| Server → Client | `synthesis_token` | `{ token }` |
| Server → Client | `debate_done` | `{}` |

---

## Database Schema

| Table | Columns |
|---|---|
| `users` | id, clerk_id, email, created_at |
| `sessions` | id, user_id, problem, created_at |
| `agent_turns` | id, session_id, agent_id, agent_name, content, created_at |
| `syntheses` | id, session_id, content, created_at |

---

## Note on First Run

On the first request, Transformers.js will download the `all-MiniLM-L6-v2` model (~90MB) to a local cache directory. This is a one-time download — subsequent starts reuse the cached model.
