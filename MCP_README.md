# Alchemy Bug Tracker MCP Server

This directory contains an MCP (Model Context Protocol) server for the Alchemy Bug Tracker. This allows AI agents (like Claude Desktop) to directly interact with your bug tracker (list bugs, view details, create bugs).

## Prerequisites

- Python 3.10+
- Dependencies installed:
  ```bash
  pip install -r backend/requirements.txt
  pip install mcp
  ```
- A valid `.env` file in the `backend/` directory or root with Supabase credentials.

## Running the Server

To run the server manually (usually not needed as the Agent runs it):

```bash
python -m backend.mcp_server
```

## Configuring Claude Desktop

To use this with Claude Desktop, add the following to your `claude_desktop_config.json` (typically located in `%APPDATA%\Claude\` on Windows or `~/Library/Application Support/Claude/` on macOS):

```json
{
  "mcpServers": {
    "alchemy-tracker": {
      "command": "python",
      "args": [
        "-m",
        "backend.mcp_server"
      ],
      "cwd": "C:\\Users\\A022419767\\Documents\\alchemy-28-11-25",
      "env": {
        "PYTHONPATH": "C:\\Users\\A022419767\\Documents\\alchemy-28-11-25"
      }
    }
  }
}
```

> **Note:** Make sure to update the absolute paths if you move the project.

## Available Tools

The server exposes the following tools to the AI:

1.  **`list_bugs`**: Lists recent bugs (summary view).
2.  **`get_bug_details`**: specific bug details by ID (e.g. `BUG-001`).
3.  **`create_bug`**: Creates a new bug with summary, description, priority, etc.
