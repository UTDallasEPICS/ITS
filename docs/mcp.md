# Recommended MCP servers

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers give your AI coding
assistant live access to documentation and tools. These three are useful when working in this
template:

| Server          | URL                                                          | What it's for              |
| --------------- | ------------------------------------------------------------ | -------------------------- |
| **Nuxt**        | `https://nuxt.com/mcp`                                       | Nuxt framework docs & APIs |
| **Nuxt UI**     | `https://ui.nuxt.com/mcp`                                    | Nuxt UI component docs     |
| **Better Auth** | `https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp` | Better Auth docs & setup   |

All three are **remote (HTTP) servers** — nothing to install; each client just needs the URL.

## Why this is a doc and not a committed config file

There is **no single MCP config file that every tool reads.** Each assistant has its own
config path (and the schema is _almost_ — but not quite — identical across them). Rather than
commit one file per tool, we list the servers here so you can add them to whatever you use.
(A [universal-config standard](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2218)
has been proposed but is not adopted yet.)

## Add them to your tool

Most tools use a `mcpServers` object; **VS Code is the exception** (it uses `servers`). The
field for a remote server also varies slightly by tool — snippets below are ready to
copy-paste. Add only the servers you want.

### Claude Code — `.mcp.json` (project root) or `~/.claude.json` (user)

```json
{
  "mcpServers": {
    "nuxt": { "type": "http", "url": "https://nuxt.com/mcp" },
    "nuxt-ui": { "type": "http", "url": "https://ui.nuxt.com/mcp" },
    "better-auth": {
      "type": "http",
      "url": "https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp"
    }
  }
}
```

Or via the CLI:

```bash
claude mcp add --transport http nuxt https://nuxt.com/mcp
claude mcp add --transport http nuxt-ui https://ui.nuxt.com/mcp
claude mcp add --transport http better-auth https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp
```

### Cursor — `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global)

```json
{
  "mcpServers": {
    "nuxt": { "url": "https://nuxt.com/mcp" },
    "nuxt-ui": { "url": "https://ui.nuxt.com/mcp" },
    "better-auth": { "url": "https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp" }
  }
}
```

### VS Code (Copilot) — `.vscode/mcp.json` (note: root key is `servers`)

```json
{
  "servers": {
    "nuxt": { "type": "http", "url": "https://nuxt.com/mcp" },
    "nuxt-ui": { "type": "http", "url": "https://ui.nuxt.com/mcp" },
    "better-auth": {
      "type": "http",
      "url": "https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp"
    }
  }
}
```

### Gemini CLI — `.gemini/settings.json` (uses `httpUrl`)

```json
{
  "mcpServers": {
    "nuxt": { "httpUrl": "https://nuxt.com/mcp" },
    "nuxt-ui": { "httpUrl": "https://ui.nuxt.com/mcp" },
    "better-auth": { "httpUrl": "https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp" }
  }
}
```

> Using another assistant (Windsurf, Zed, Continue, Claude Desktop, …)? It almost certainly
> supports MCP too — check its docs for the config path; the server URLs above are the same.

## Notes

- These are **third-party services**. They receive the queries your assistant sends them, so
  don't rely on them for anything sensitive.
- Tool-specific MCP config files are intentionally **not committed** to this repo (see the
  per-tool paths above; add them locally, and git-ignore them if your tool writes them into
  the project).
