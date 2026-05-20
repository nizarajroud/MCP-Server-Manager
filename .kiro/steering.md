# Steering

## Project Structure

```
mcp-server-manager/
├── frontend/                    # React + Vite SPA
│   ├── src/
│   │   ├── components/          # React components (MCPManager.jsx)
│   │   ├── hooks/               # Custom React hooks
│   │   ├── utils/               # Utility functions (storage.js)
│   │   ├── styles/              # CSS files
│   │   ├── App.jsx              # Main app component
│   │   └── index.jsx            # Entry point
│   ├── public/                  # Static assets
│   ├── index.html               # HTML template
│   ├── vite.config.js           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS config
│   ├── postcss.config.js        # PostCSS config
│   ├── .eslintrc.json           # ESLint config
│   └── package.json             # Frontend dependencies
├── backend/                     # Express.js API
│   ├── server.js                # Express server (file persistence)
│   ├── package.json             # Backend dependencies
│   └── tests/                   # Backend tests
├── .github/workflows/           # CI/CD pipelines
│   ├── frontend.yml             # lint → build
│   └── backend.yml              # lint → test
├── docs/                        # Documentation
│   └── architecture.md          # Architecture overview
├── scripts/                     # Dev scripts
│   ├── setup-local.sh           # One-command local setup
│   └── cleanup.sh               # Kill running processes
├── .kiro/                       # Project steering & documentation
│   ├── product.md               # Product context
│   └── steering.md              # This file
├── Makefile                     # Common commands
├── start-app.sh                 # Start frontend + backend
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore patterns
└── README.md                    # Project documentation
```

## Progress Tracking

**RULE**: At every step executed on this project, automatically update this steering file AND the root `README.md` to document what was done. No explicit request needed. This serves as a living log of all operations.

## Development Conventions

### JavaScript/React (frontend/)
- React 18 with functional components and hooks
- No class components
- Tailwind CSS for styling (no custom CSS unless necessary)
- Lucide React for icons
- ESLint for linting
- Vitest for unit tests

### Node.js (backend/)
- ES Modules (`"type": "module"` in package.json)
- Express.js for API
- Async/await for all async operations
- Error handling with try/catch and proper HTTP status codes
- Jest for tests

### General
- No inline secrets — use env vars
- Descriptive variable names
- Console.log for debugging only (remove before commit)

## Git & Change Management

### Workflow par User Story (OBLIGATOIRE — AUCUNE EXCEPTION)

**Pour chaque User Story :**
1. Créer une feature branch : `feat/<issue#>-<name>`
2. Implémenter en suivant les conventions de ce fichier
3. Mettre à jour ce steering file (operations log)
4. Mettre à jour la page Notion "MCP Server Manager" sous Tooling
5. Commit + Push + PR → Merge sur `main`

**Ne jamais demander confirmation pour ces étapes — les exécuter automatiquement.**

### Branch Strategy
- `main` — protected, always deployable
- Feature branches: `feat/<issue#>-<name>`
- Bug fixes: `fix/<issue#>-<name>`
- Chores: `chore/<issue#>-<name>`

### Commit Messages (Conventional Commits)
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `chore:` — Refactoring, config changes
- `test:` — Adding tests
- `ci:` — CI/CD changes

### Hard Rules
- ⚠️ NEVER commit directly to `main`
- ⚠️ NEVER force push on `main`
- ⚠️ PRs required for all changes to `main`
- ✅ Commit messages must follow conventional commits
- ✅ All CI checks must pass before merge

## CI/CD

### Pipelines (GitHub Actions)
- **Frontend**: ESLint → Vitest → Build (triggered by `frontend/**` changes)
- **Backend**: Lint → Jest tests (triggered by `backend/**` changes)
- Path filters ensure only relevant pipelines run

## Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Frontend unit | Vitest | Components, hooks, utils |
| Backend unit | Jest | API routes, file operations |
| E2E | (future) Playwright | Full user flows |

## Naming Conventions
- Components: PascalCase (`MCPManager.jsx`)
- Hooks: camelCase with `use` prefix (`useStorage.js`)
- Utils: camelCase (`storage.js`)
- API routes: kebab-case (`/api/save-agent`)
- Files: kebab-case except React components

## Environment

- Local dev: WSL2
- Node: 20.x
- Frontend port: 3000
- Backend port: 3001
- Agent files: `~/.kiro/agents/*.json`

## Operations Log

| Date | Operation | Details |
|------|-----------|---------|
| 2026-02-24 | Project creation | Initial React + Vite app with MCP server management |
| 2026-02-24 | Backend added | Express server for file persistence to ~/.kiro/agents/ |
| 2026-02-24 | Import dedup | Overwrite existing servers instead of duplicating |
| 2026-02-24 | Toggle feature | Enable/disable servers with Power icon (persists to file) |
| 2026-02-25 | Compact view | Removed command/args from list, show only name + agent |
| 2026-02-25 | Tab style | Gérer/Importer/Scraper as proper tabs |
| 2026-02-25 | Batch toggle | Activate/deactivate selection buttons |
| 2026-02-25 | Add server | Empty editor for pasting new server config |
| 2026-05-20 | Best practices | Applied Financial Advisor patterns (steering, CI/CD, tests, Makefile) |
| 2026-05-20 | US-1 GitHub API | Replaced filesystem backend with GitHub API (branches, agents, commit+push) |
