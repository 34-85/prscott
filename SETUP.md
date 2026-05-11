# Setup: Higgsfield MCP in Claude Code

The project-scoped `.mcp.json` in this repo registers Higgsfield, but the
**approval and OAuth must happen in the local Claude Code CLI** — the web
session at claude.ai/code can't open a browser for the OAuth handshake, and
its sandbox doesn't read project-scoped `.mcp.json`.

## One-time local setup

```bash
git fetch origin
git checkout claude/integrate-higgsfield-mcp-OQAx0
claude   # launches Claude Code CLI in this repo
```

Inside the CLI:

1. Approve the project-scoped MCP server when prompted (or run `/mcp` and
   approve `higgsfield` there).
2. Run `/mcp`, select `higgsfield`, click **Authenticate**, complete OAuth
   in the browser tab that opens. Sign in or create a free Higgsfield
   account (150 credits/month on the free tier).
3. Verify with `/mcp` — `higgsfield` should show as connected. The
   `mcp__higgsfield__*` tools are now available to Claude in this session.

## User-scope alternative

If you want Higgsfield available across every project, skip the project
config and install at user scope:

```bash
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
```

Then `/mcp` → authenticate as above. The OAuth token persists in
`~/.claude/`.

## Web / sandboxed sessions

Claude Code on the web and other managed harnesses don't currently support
OAuth-based MCP servers. Workarounds:

- Use the local CLI for any task that needs Higgsfield tools.
- Or generate directly in the [Higgsfield web app](https://higgsfield.ai)
  — same models, no MCP required.

## Smoke test

Once authenticated locally, ask Claude:

> Generate a 4-second 720p test clip with Seedance 2.0: a single espresso
> shot pulling into a white cup, soft window light. Cheap model, low
> resolution — just verifying the integration works.

### Model notes

- **Seedance 2.0** — used as the smoke-test default. Reliable and cheap.
- **MiniMax Hailuo** — had issues during initial integration testing
  (May 2026); prefer Seedance for cheap iteration until that's confirmed
  fixed.
- **Kling 3.0 / Veo 3.1** — reserve for hero renders once you're happy
  with the shot composition on a cheaper model. Veo for lip-sync, Kling
  for multi-shot sequences.
