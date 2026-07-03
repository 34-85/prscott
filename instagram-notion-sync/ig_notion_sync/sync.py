"""Entry point: fetch Instagram saves and push new ones into Notion."""

from __future__ import annotations

import argparse
import datetime as dt
import logging
import sys

from .config import Config, ConfigError, load_config
from .instagram import InstagramClient, InstagramError
from .notion import NotionClient, NotionError
from .state import StateStore

log = logging.getLogger("ig_notion_sync")


def _configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def _resolve_database(config: Config, state: StateStore, notion: NotionClient) -> str:
    """Return the target database ID, creating the database if needed.

    Precedence: explicit config env var → previously created (state file) →
    freshly created under the configured parent page.
    """
    if config.notion_saves_db_id:
        return config.notion_saves_db_id
    if state.saves_db_id:
        return state.saves_db_id
    if not config.notion_parent_page_id:
        raise ConfigError(
            "No database to write to. Set NOTION_SAVES_DB_ID or NOTION_PARENT_PAGE_ID."
        )
    db_id = notion.create_saves_database(config.notion_parent_page_id)
    state.saves_db_id = db_id
    state.save()
    return db_id


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync Instagram saves into Notion.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and report new saves without writing to Notion or state.",
    )
    parser.add_argument(
        "--env-file",
        default=None,
        help="Path to a .env file (defaults to ./.env next to the package).",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging.")
    args = parser.parse_args(argv)

    _configure_logging(args.verbose)

    try:
        config = load_config(args.env_file)
    except ConfigError as exc:
        log.error("Configuration error: %s", exc)
        return 2

    state = StateStore(config.state_path)

    try:
        instagram = InstagramClient(config)
        posts = instagram.fetch_saved_posts()
    except InstagramError as exc:
        log.error("Instagram fetch failed: %s", exc)
        return 1

    new_posts = [p for p in posts if not state.is_synced(p.instagram_id)]
    log.info("%d new save(s) out of %d fetched.", len(new_posts), len(posts))

    if not new_posts:
        log.info("Nothing new to sync. Done.")
        return 0

    if args.dry_run:
        for p in new_posts:
            log.info(
                "[dry-run] %s | %s | collections=%s | %s",
                p.content_type,
                p.title,
                ", ".join(p.collections),
                p.url,
            )
        log.info("[dry-run] %d save(s) would be synced.", len(new_posts))
        return 0

    notion = NotionClient(config.notion_token)
    try:
        database_id = _resolve_database(config, state, notion)
    except (ConfigError, NotionError) as exc:
        log.error("Could not resolve Notion database: %s", exc)
        return 1

    synced_iso = dt.datetime.now(dt.timezone.utc).isoformat()
    created = 0
    for post in new_posts:
        try:
            notion.create_save_page(database_id, post, synced_iso)
        except NotionError as exc:
            # One bad row shouldn't abort the whole run — log and continue so the
            # rest still sync. Unsynced rows are retried next run.
            log.error("Failed to create Notion page for %s: %s", post.url, exc)
            continue
        state.mark_synced(post.instagram_id)
        created += 1
        # Persist incrementally so a mid-run crash never re-creates rows.
        state.save()

    log.info("Synced %d new save(s) into Notion. Total tracked: %d.",
             created, state.synced_count)
    return 0


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
