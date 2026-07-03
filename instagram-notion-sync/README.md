# Instagram Saves → Notion sync

A background job that logs into Instagram's web API with your **browser session
cookies**, reads every saved post (with the collection each one came from), and
files the new ones into a Notion database. It runs itself **twice a day** via
macOS `launchd`, and a local state file guarantees no duplicates.

This is **Part 1** of a two-part pipeline. Part 2 is a Claude Code skill,
[`instagram-content-ideas`](../.claude/skills/instagram-content-ideas/SKILL.md),
that turns those saves into production-ready content ideas.

```
Instagram  ──cookies──▶  run_sync.py  ──Notion API──▶  "Instagram Saves" DB
  (saves)                    ▲                              │ Status = New
                             │                              ▼
                        launchd (8am / 8pm)        /instagram-content-ideas skill
                                                            │
                                                            ▼
                                                   "Content Ideas" DB
```

## What each save becomes

Every saved post is stored as a Notion row with:

| Column        | Source                                             |
|---------------|----------------------------------------------------|
| Name          | `@author — <caption snippet>`                      |
| Author        | Instagram username                                 |
| Caption       | Full caption text                                  |
| URL           | Public permalink (`/p/…` or `/reel/…`)             |
| Content Type  | `Post` · `Reel` · `Carousel`                        |
| Collection    | The Instagram collection(s) it was saved into      |
| Status        | `New` → flipped to `Processed` by the skill        |
| Instagram ID  | Stable media id (dedup key)                        |
| Synced        | When the sync recorded it                          |

## Setup

Requires **Python 3.10+** and a Mac (for the scheduled job; the script itself
runs anywhere).

```bash
cd instagram-notion-sync
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # then fill it in — see below
```

### 1. Instagram cookies

Log into instagram.com in your browser. Open **DevTools → Application → Cookies
→ https://www.instagram.com** and copy `sessionid`, `ds_user_id`, and
`csrftoken` into `.env`. (These expire periodically — refresh them when the sync
starts reporting `401/403`.)

### 2. Notion

1. Create an internal integration at
   <https://www.notion.so/my-integrations> and copy the secret into
   `NOTION_TOKEN`.
2. Either:
   - **Auto-create the database** — put a page ID in `NOTION_PARENT_PAGE_ID`,
     share that page with your integration, and the first run creates the
     "Instagram Saves" database for you (its ID is saved to `state.json`), **or**
   - **Use an existing database** — set `NOTION_SAVES_DB_ID` and share that
     database with the integration.

> A Notion page/database ID is the 32-character hex string in its URL.

### 3. Try it

```bash
python run_sync.py --dry-run     # fetch + report, write nothing
python run_sync.py               # real sync
python run_sync.py -v            # verbose
```

## Schedule it (twice daily)

```bash
./launchd/install.sh             # installs a launchd agent (08:00 & 20:00)
launchctl start com.prscott.instagram-notion-sync   # run once now to test
tail -f logs/sync.err.log        # watch it work
```

The installer templates the plist with your project path and Python
interpreter, drops it in `~/Library/LaunchAgents`, and loads it. Re-run it
anytime after changing code. To stop:

```bash
launchctl unload ~/Library/LaunchAgents/com.prscott.instagram-notion-sync.plist
rm ~/Library/LaunchAgents/com.prscott.instagram-notion-sync.plist
```

## How it works

| File                          | Responsibility                                        |
|-------------------------------|-------------------------------------------------------|
| `ig_notion_sync/config.py`    | Load env / `.env`; build the Instagram cookie header  |
| `ig_notion_sync/instagram.py` | Private web API client — collections + saved feed      |
| `ig_notion_sync/models.py`    | Normalize raw media → `SavedPost` (type, permalink)   |
| `ig_notion_sync/notion.py`    | Create the database and insert rows via the REST API  |
| `ig_notion_sync/state.py`     | Dedup state + remembered database id (`state.json`)   |
| `ig_notion_sync/sync.py`      | Orchestration + CLI                                   |

**Deduplication.** Each save's Instagram media `pk` is recorded in `state.json`
after its Notion row is created (state is flushed after every row, so a crash
mid-run never double-writes). Subsequent runs only push IDs not already seen.

**Collections.** The client reads each named collection to learn which saves
belong to it, then walks the all-media collection to enumerate everything. A
save in no named collection is tagged `Saved`.

## Notes & limits

- This uses Instagram's **private web API** (the same endpoints the website
  calls). It is unofficial and can change; there is no public API for saved
  posts. Be gentle — `SYNC_REQUEST_DELAY` throttles requests.
- Cookies grant full account access. Keep `.env` and `state.json` private;
  both are gitignored.
- Run tests with `python -m unittest discover -s tests`.
