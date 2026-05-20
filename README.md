# MCP Server Manager

Web application to manage Model Context Protocol (MCP) server configurations across multiple Kiro agents.

## Features

- Import agent JSON files and visualize all MCP servers
- Edit server configurations (command, args, env)
- Enable/disable servers with one click (persisted to agent file)
- Add new MCP servers to an existing agent
- Batch activate/deactivate selections
- Export configurations for Claude Desktop

## Architecture

```
frontend/ (React + Vite, port 3000)  →  backend/ (Express, port 3001)  →  ~/.kiro/agents/*.json
```

## Quick Start

```bash
# One-command setup
make setup

# Start the application
make dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:3001

## Project Structure

```
├── frontend/          # React + Vite SPA
├── backend/           # Express API (file persistence)
├── .kiro/             # Steering & product docs
├── .github/workflows/ # CI/CD pipelines
├── scripts/           # Dev scripts
├── docs/              # Architecture docs
├── Makefile           # Common commands
└── start-app.sh       # Start frontend + backend
```

## Available Commands

| Command | Description |
|---------|-------------|
| `make setup` | Install all dependencies |
| `make dev` | Start frontend + backend |
| `make stop` | Stop running servers |
| `make test` | Run all tests |
| `make lint` | Lint frontend code |
| `make build` | Build frontend for production |
| `make clean` | Stop servers and remove logs |

## Development

### Prerequisites
- Node.js 20+
- WSL2 (for Windows users)

### Environment Variables
Copy `.env.example` and adjust:
```bash
cp .env.example .env
```

### Git Conventions
- Branch: `feat/<name>`, `fix/<name>`, `chore/<name>`
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- PRs required for `main`

## Tech Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS, Lucide React
- **Backend**: Express.js (ES Modules)
- **Testing**: Vitest (frontend), Jest (backend)
- **CI/CD**: GitHub Actions (path-filtered)
