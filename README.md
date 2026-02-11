# frc-docs-mcp

An MCP (Model Context Protocol) server that gives AI coding assistants instant access to FRC (FIRST Robotics Competition) documentation. Search and read docs from WPILib, CTRE Phoenix 6, REV Robotics, Limelight, and AdvantageKit — all without leaving your editor.

No API keys required. All 1,272 documentation pages ship pre-indexed with the package.

## Documentation Sources

| Library | Pages | Source |
|---------|-------|--------|
| WPILib | 410 | [docs.wpilib.org](https://docs.wpilib.org/en/stable) |
| CTRE Phoenix 6 | 110 | [v6.docs.ctr-electronics.com](https://v6.docs.ctr-electronics.com/en/stable) |
| REV Robotics | 651 | [docs.revrobotics.com](https://docs.revrobotics.com) |
| Limelight | 52 | [docs.limelightvision.io](https://docs.limelightvision.io) |
| AdvantageKit | 49 | [docs.advantagekit.org](https://docs.advantagekit.org) |

## Installation

### Claude Code

Run this in your terminal:

```bash
claude mcp add frc-docs -- npx -y frc-docs-mcp
```

Or add it to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "frc-docs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "frc-docs-mcp"]
    }
  }
}
```

### Cursor

Go to **Cursor Settings > MCP** and add a new server:

```json
{
  "mcpServers": {
    "frc-docs": {
      "command": "npx",
      "args": ["-y", "frc-docs-mcp"]
    }
  }
}
```

Or add it to your project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "frc-docs": {
      "command": "npx",
      "args": ["-y", "frc-docs-mcp"]
    }
  }
}
```

### Windsurf

Add to your Windsurf MCP config (`~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "frc-docs": {
      "command": "npx",
      "args": ["-y", "frc-docs-mcp"]
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "frc-docs": {
      "command": "npx",
      "args": ["-y", "frc-docs-mcp"]
    }
  }
}
```

### Any MCP Client

The server runs over stdio. Use any MCP-compatible client with:

```bash
npx -y frc-docs-mcp
```

## Tools

### `search_frc_docs`

Search across all FRC documentation libraries.

**Parameters:**
- `query` (string, required) — Search query (e.g., "PID controller", "swerve drive", "motor configuration")
- `library` (string, optional) — Filter to a specific library: `"WPILib"`, `"CTRE Phoenix 6"`, `"REV Robotics"`, `"Limelight"`, or `"AdvantageKit"`
- `limit` (number, optional) — Max results to return (1-50, default: 10)

### `read_documentation`

Read the full content of a documentation page by its ID (returned from search results).

**Parameters:**
- `id` (string, required) — The page ID from search results

## Example Usage

Once installed, just ask your AI assistant about FRC topics:

- "How do I configure a swerve drive with CTRE Phoenix 6?"
- "Show me the WPILib PID controller documentation"
- "How do I set up a Limelight for AprilTag detection?"
- "What motors does REV Robotics support?"
- "How do I use AdvantageKit for logging?"

The AI will automatically search and read the relevant documentation.

## Requirements

- Node.js 18+
- An MCP-compatible AI client

## License

MIT
