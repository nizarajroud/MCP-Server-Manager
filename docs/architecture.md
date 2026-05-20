# Architecture

## Overview

```
User → Frontend (React/Vite) → Backend (Express) → ~/.kiro/agents/*.json
```

## Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 18, Vite 5, Tailwind CSS | SPA for managing MCP servers |
| Backend | Express.js | File persistence API |
| Storage | localStorage + filesystem | Server configs + agent JSON files |

## Data Flow

### Import Agent
```
User uploads JSON → Frontend parses mcpServers → Stores in localStorage (with agentPath)
```

### Edit & Save
```
User edits config → Frontend sends POST /api/save-agent → Backend reads existing file → Merges mcpServers → Writes updated JSON
```

### Toggle Enable/Disable
```
User clicks Power icon → Frontend updates localStorage → POST /api/save-agent → Backend updates disabled field in agent file
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/save-agent` | Save mcpServers to agent JSON file |

### POST /api/save-agent

**Request:**
```json
{
  "agentName": "experiment",
  "mcpServers": {
    "server-name": {
      "command": "uvx",
      "args": ["package@latest"],
      "env": {},
      "disabled": false
    }
  }
}
```

**Behavior:**
1. Reads existing `~/.kiro/agents/{agentName}.json`
2. Preserves all non-mcpServers fields ($schema, tools, resources, etc.)
3. Replaces only the `mcpServers` section
4. Writes back to file

## File Structure (Agent JSON)

```json
{
  "$schema": "...",
  "name": "experiment",
  "mcpServers": {
    "server-name": {
      "command": "uvx",
      "args": ["..."],
      "env": {},
      "autoApprove": [],
      "disabled": false
    }
  },
  "tools": ["*"],
  "resources": ["file://..."]
}
```
