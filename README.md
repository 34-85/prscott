# prscott

General GitHub repo.

## ZIP → MSA → Persona pipeline

Match ZIP codes to metro areas, attach persona data, and estimate personas for
empty ZIPs — every estimate labeled `observed` / `imputed_similar` /
`extrapolated_baseline` with a confidence score. See
[`zip_msa_personas/README.md`](./zip_msa_personas/README.md).

```bash
pip install -r requirements.txt
python -m zip_msa_personas demo        # end-to-end on synthetic data, no network
```

## Higgsfield MCP integration

This repo ships a project-scoped [`.mcp.json`](./.mcp.json) that registers the
[Higgsfield](https://higgsfield.ai/mcp) MCP server with Claude Code. Higgsfield
exposes 30+ image and video generation models (Soul, Cinema Studio, Flux,
Seedream, Kling, Minimax Hailuo, Veo, etc.) over a single hosted endpoint.

### Use it with Claude Code

1. Open this repo in Claude Code. On first use you'll be prompted to approve
   the project-scoped MCP server.
2. Run `/mcp` and authenticate the `higgsfield` server through your
   Higgsfield account (OAuth — no API keys to manage).
3. Ask Claude to generate an image or video, e.g. *"Generate a 4K product
   shot of a matte-black espresso machine on a marble counter."*

### Install at user scope instead

If you'd rather have Higgsfield available across all your projects:

```bash
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
```

### Other clients

Any MCP-compatible client (Claude Desktop, Cursor, etc.) can point at the
same endpoint: `https://mcp.higgsfield.ai/mcp` over HTTP transport.
