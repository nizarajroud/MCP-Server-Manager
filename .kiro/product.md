# Product Context

## Overview

Web application to manage Model Context Protocol (MCP) server configurations across multiple Kiro agents. Provides a centralized UI to import, edit, enable/disable, and persist MCP server configs directly to agent JSON files.

## Problem Statement

Managing MCP server configurations across multiple agents requires manually editing JSON files. This tool provides a visual interface to manage all configurations in one place, with direct file persistence.

## Target Users

- Developers using Kiro CLI with multiple agents
- Teams managing shared MCP server configurations
- Anyone needing to quickly enable/disable MCP servers across agents

## Core Use Cases

1. **Import** — Load agent JSON files to visualize all MCP servers
2. **Edit** — Modify server configurations (command, args, env)
3. **Toggle** — Enable/disable servers with one click (persisted to file)
4. **Add** — Add new MCP servers to an existing agent
5. **Export** — Download merged configurations for Claude Desktop

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS |
| Backend | Express.js (file persistence API) |
| Storage | Browser localStorage + filesystem (via backend) |
| Icons | Lucide React |
| Dev Server | Vite HMR (port 3000) |
| API Server | Express (port 3001) |

## Architecture Pattern

**Frontend + Lightweight Backend** — React SPA communicates with a local Express server that has filesystem access to read/write agent JSON files in `~/.kiro/agents/`.
