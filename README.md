# MCP Server Manager

A web application to manage your Model Context Protocol (MCP) servers.

## Features

- Manage MCP server configurations
- Import servers from JSON
- Scrape server configurations from URLs
- Export configurations for Claude Desktop
- Local storage persistence

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

If you encounter symlink issues on WSL:
```bash
node node_modules/vite/bin/vite.js
```

## Build

```bash
npm run build
```

## Usage

1. Add servers manually or import from JSON
2. Select the servers you want to include
3. Download the configuration file
4. Copy to your Claude Desktop config location

## Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Utility functions
│   ├── styles/         # CSS files
│   ├── App.jsx         # Main app component
│   └── index.jsx       # Entry point
├── public/             # Static assets
├── index.html          # HTML template
└── package.json        # Dependencies
```


pkill -f "node.*vite"  # MCP-Server-Manager
