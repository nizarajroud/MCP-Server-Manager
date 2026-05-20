# Architecture

## Overview

```
User → Frontend (React/Vite) → Backend (Express) → GitHub API → nizarajroud/kiro-configs
```

## Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 18, Vite 5, Tailwind CSS | SPA for managing MCP servers |
| Backend | Express.js | Proxy to GitHub API |
| GitHub API | REST API v3 | Read/write agent configs |
| kiro-configs | GitHub repo | Source of truth for all agent configs |

## Data Flow

### Load Agents
```
User selects branch → GET /api/agents?branch=X → GitHub API → List agents/*.json
User selects agent → GET /api/agent/:name?branch=X → GitHub API → Parse mcpServers
```

### Save (commit + push)
```
User edits/toggles → PUT /api/agent/:name → GitHub API PUT /contents/agents/:name.json → Commit on branch
```

### Conflict Detection
```
On save: compare stored SHA with current SHA
  → Match: commit succeeds
  → Mismatch: prompt user "Écraser" or "Recharger"
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/branches` | List branches from kiro-configs |
| GET | `/api/agents?branch=X` | List agent files in a branch |
| GET | `/api/agent/:name?branch=X` | Get agent file content + SHA |
| PUT | `/api/agent/:name` | Commit updated agent to branch |

### PUT /api/agent/:name

**Request:**
```json
{
  "content": { "name": "exp2", "mcpServers": { ... } },
  "sha": "abc123...",
  "branch": "personal-branch",
  "message": "feat: enable server X on exp2"
}
```

**Responses:**
- `200` — Success, returns new SHA
- `409` — Conflict (file modified since last read)
- `400` — Missing required fields

## Branch Model

```
kiro-configs repo
├── main              (shared/reference config)
├── personal-branch   (personal workstation)
└── csben-branch      (other context)
```

Each branch contains:
```
agents/
├── exp2.json
├── pilot.json
└── ...
```
