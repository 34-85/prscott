# APPA Geo-Persona Intelligence Engine

A commercial geo-intelligence product built on APPA's proprietary National Pet
Owners Survey (NPOS) segmentation. It turns the seven NPOS pet-owner personas
into a national, ZIP-level dataset — then ranks markets for vet groups, pet
brands, and retailers — with **every estimate honestly labeled** by how it was
produced and how far to trust it.

The persona signal is **first-party** (APPA owns NPOS) and every geography we
ship is first-party or public-domain (Census/HUD), so deliverables carry **no
redistribution constraints**.

```bash
pip install -r requirements.txt
python -m zip_msa_personas demo        # full pipeline on synthetic data, no network
```

### What it produces

- **A scored national dataset** — persona mix for every ZIP, aggregable to
  metro/MSA, Nielsen DMA, Census region, or nation, each row carrying
  `provenance` + a calibrated `confidence`.
- **Customer applications** — vet-siting (hospital / urgent-care / avoid),
  brand & retailer market-fit (which metros for a category; what to emphasize in
  a metro), opportunity & lookalike-expansion scoring.
- **Business-ready files** — an Excel workbook, US persona maps, and per-persona
  one-pager leave-behinds, built in one command.

### Documentation map

| Doc | What's in it |
|---|---|
| [`zip_msa_personas/README.md`](./zip_msa_personas/README.md) | Package deep-dive: each stage, provenance, shrinkage, calibration, rights |
| [`zip_msa_personas/COMMANDS.md`](./zip_msa_personas/COMMANDS.md) | Every CLI command, flags, and the two-session operating pattern |
| [`zip_msa_personas/METHODOLOGY.md`](./zip_msa_personas/METHODOLOGY.md) | Methodology + the honest confidence/validation story (diligence-grade) |
| [`zip_msa_personas/ROADMAP.md`](./zip_msa_personas/ROADMAP.md) | Commercial path and data reality |
| [`zip_msa_personas/RUN_NOTES.md`](./zip_msa_personas/RUN_NOTES.md) | Validation notes from the live Census/ACS runs |

### How it runs: two sessions

The networked stages need `census.gov` + a Census API key. The workflow splits
into a **build session** (offline: code, the `demo`, tests) and a
**Census-enabled session** (the real `official` run on the NPOS workbook).
Proprietary data and derived per-ZIP outputs are git-ignored — only code and
notes are committed; polished files are delivered out-of-band. See
[`COMMANDS.md`](./zip_msa_personas/COMMANDS.md#the-two-session-operating-pattern).

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
