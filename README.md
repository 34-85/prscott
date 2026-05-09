# prscott

General GitHub repo.

## Higgsfield MCP integration

This repo ships a project-scoped [`.mcp.json`](./.mcp.json) that registers the
[Higgsfield](https://higgsfield.ai/mcp) MCP server with Claude Code. Higgsfield
exposes 30+ image and video generation models (Soul, Cinema Studio, Flux,
Seedream, Kling, Minimax Hailuo, Veo, etc.) over a single hosted endpoint.

### Use it with Claude Code

See [`SETUP.md`](./SETUP.md) for the full local-CLI walkthrough. Short
version: open this repo in the local `claude` CLI (web sessions can't OAuth),
approve the project's MCP server, run `/mcp` → authenticate `higgsfield`,
then ask Claude to generate an image or video.

### Install at user scope instead

If you'd rather have Higgsfield available across all your projects:

```bash
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
```

### Other clients

Any MCP-compatible client (Claude Desktop, Cursor, etc.) can point at the
same endpoint: `https://mcp.higgsfield.ai/mcp` over HTTP transport.
