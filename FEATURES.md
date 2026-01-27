# MCP Server Manager - Features Documentation

## Overview

MCP Server Manager is a web-based application for managing Model Context Protocol (MCP) server configurations. It provides a visual interface to add, import, organize, and export MCP server configurations for use with Claude Desktop and other MCP-compatible applications.

## Core Features

### 1. Server Management

#### Add Servers Manually
- Interactive prompt-based server creation
- Configure server name, command, and arguments
- Supports any command-line executable (node, npx, python, etc.)
- Automatic timestamp-based unique ID generation

#### View All Servers
- List view of all configured servers
- Display server name, command, and arguments
- Show source URL for scraped servers
- Real-time count of total servers

#### Select Servers
- Individual server selection via checkbox
- "Select All" / "Deselect All" toggle
- Visual indication of selected servers (purple checkmark)
- Selection count displayed in export button

#### Delete Servers
- Individual server deletion
- Bulk deletion of selected servers
- Confirmation prompt for bulk operations
- Automatic UI refresh after deletion

### 2. Import Capabilities

#### JSON File Import
- Drag-and-drop or file picker interface
- Automatic parsing and validation
- Supports multiple JSON formats:
  - Full configuration with `mcpServers` object
  - Direct `mcpServers` object
  - Q CLI agent configuration files
- Batch import of multiple servers from single file
- Success notification with import count

#### URL Scraping
- Extract MCP configurations from web pages
- Automatic detection of JSON blocks containing `mcpServers`
- Handles multiple configuration blocks on same page
- Source URL tracking for scraped servers
- CORS-compatible fetching

### 3. Export Functionality

#### Configuration Generation
- Creates Claude Desktop-compatible JSON format
- Includes only selected servers
- Preserves command, args, and env variables
- Proper JSON structure with `mcpServers` root object

#### Download Configuration
- One-click download as `claude_desktop_config.json`
- Browser-native file download
- No server-side processing required
- Disabled when no servers selected

#### Live Preview
- Real-time JSON preview of configuration
- Formatted with 2-space indentation
- Updates as server selection changes
- Scrollable for large configurations

### 4. Data Persistence

#### Local Storage
- Browser localStorage-based persistence
- No external database required
- Survives page refreshes
- Prefix-based key organization (`mcp_server:`)
- Automatic load on application start

#### Storage Operations
- List all servers with prefix filtering
- Get individual server by ID
- Set/update server data
- Delete server by ID
- JSON serialization/deserialization

### 5. User Interface

#### Tab Navigation
- Three main tabs: Manage, Import, Scrape
- Visual active tab indication
- Icon-based navigation (Database, Upload, Globe)
- Smooth transitions between views

#### Notifications
- Success/error toast notifications
- Auto-dismiss after 3 seconds
- Color-coded (green for success, red for error)
- Contextual messages for all operations

#### Responsive Design
- Gradient background (slate-900 to purple-900)
- Glassmorphism effects (backdrop blur)
- Hover states on interactive elements
- Scrollable server list (max-height: 384px)
- Mobile-friendly layout

#### Visual Feedback
- Loading states for async operations
- Disabled states for invalid actions
- Color-coded buttons by function:
  - Purple: Primary actions
  - Green: Add/Import actions
  - Red: Delete actions
  - Slate: Secondary actions

### 6. Configuration Format

#### Server Object Structure
```json
{
  "name": "server-name",
  "command": "node",
  "args": ["path/to/server.js", "--option"],
  "env": {
    "ENV_VAR": "value"
  },
  "source": "https://example.com" // Optional, for scraped servers
}
```

#### Export Format
```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {}
    }
  }
}
```

## Technical Features

### Technology Stack
- React 18.2.0 for UI components
- Vite 5.0.7 for build tooling
- Tailwind CSS 3.3.6 for styling
- Lucide React 0.294.0 for icons
- Native browser APIs (localStorage, fetch, FileReader)

### Browser Compatibility
- Modern browsers with ES6+ support
- localStorage API required
- Fetch API required
- FileReader API required for file imports

### Performance
- Client-side only (no backend required)
- Instant operations (no network latency)
- Efficient localStorage operations
- Minimal re-renders with React state management

## Use Cases

1. **Claude Desktop Configuration**: Generate and download configuration files for Claude Desktop
2. **Server Discovery**: Scrape MCP server configurations from documentation sites
3. **Configuration Management**: Centralized management of multiple MCP servers
4. **Configuration Sharing**: Export and share server configurations as JSON files
5. **Quick Testing**: Rapidly enable/disable servers by selecting/deselecting them

## Limitations

- Browser localStorage size limits (typically 5-10MB)
- CORS restrictions for URL scraping (requires CORS-enabled endpoints)
- No server-side validation or authentication
- No configuration versioning or history
- No multi-user support or synchronization

## Future Enhancement Possibilities

- Server configuration editing
- Import from GitHub repositories
- Export to multiple formats
- Configuration templates
- Server health checking
- Search and filter functionality
- Configuration validation
- Backup/restore functionality
- Dark/light theme toggle
