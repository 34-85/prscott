"""Notion REST API client used by the standalone sync script.

The Claude Code skill (Part 2) talks to Notion through the Notion MCP instead;
this module is only for the unattended launchd job, which needs a plain HTTP
client and an integration token.
"""

from __future__ import annotations

import logging

import requests

from .models import SavedPost

log = logging.getLogger(__name__)

API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"

# Property names — the single source of truth shared with the Content Ideas
# skill. If you rename a column in Notion, change it here too.
PROP_NAME = "Name"
PROP_AUTHOR = "Author"
PROP_CAPTION = "Caption"
PROP_URL = "URL"
PROP_CONTENT_TYPE = "Content Type"
PROP_COLLECTION = "Collection"
PROP_STATUS = "Status"
PROP_INSTAGRAM_ID = "Instagram ID"
PROP_SYNCED = "Synced"

STATUS_NEW = "New"

# Notion rich_text / text content is capped at 2000 characters per element.
_TEXT_LIMIT = 2000


class NotionError(RuntimeError):
    pass


def _truncate(text: str, limit: int = _TEXT_LIMIT) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


class NotionClient:
    def __init__(self, token: str):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Notion-Version": NOTION_VERSION,
                "Content-Type": "application/json",
            }
        )

    def _post(self, path: str, payload: dict) -> dict:
        resp = self.session.post(f"{API_BASE}{path}", json=payload, timeout=30)
        if resp.status_code >= 300:
            raise NotionError(
                f"Notion {resp.status_code} on {path}: {resp.text[:300]}"
            )
        return resp.json()

    # -- database provisioning --------------------------------------------

    def create_saves_database(self, parent_page_id: str) -> str:
        """Create the "Instagram Saves" database and return its ID.

        The schema is the contract consumed by the content-ideas skill:
        ``Status`` gates which rows are unprocessed, and ``Instagram ID`` is the
        dedup key.
        """
        payload = {
            "parent": {"type": "page_id", "page_id": parent_page_id},
            "title": [{"type": "text", "text": {"content": "Instagram Saves"}}],
            "properties": {
                PROP_NAME: {"title": {}},
                PROP_AUTHOR: {"rich_text": {}},
                PROP_CAPTION: {"rich_text": {}},
                PROP_URL: {"url": {}},
                PROP_CONTENT_TYPE: {
                    "select": {
                        "options": [
                            {"name": "Post", "color": "blue"},
                            {"name": "Reel", "color": "purple"},
                            {"name": "Carousel", "color": "green"},
                        ]
                    }
                },
                PROP_COLLECTION: {"multi_select": {"options": []}},
                PROP_STATUS: {
                    "select": {
                        "options": [
                            {"name": "New", "color": "yellow"},
                            {"name": "Processed", "color": "green"},
                        ]
                    }
                },
                PROP_INSTAGRAM_ID: {"rich_text": {}},
                PROP_SYNCED: {"date": {}},
            },
        }
        db = self._post("/databases", payload)
        db_id = db["id"]
        log.info("Created Instagram Saves database: %s", db_id)
        return db_id

    # -- page creation -----------------------------------------------------

    def create_save_page(self, database_id: str, post: SavedPost, synced_iso: str) -> None:
        """Insert one saved post as a new row, tagged ``Status = New``."""
        properties: dict = {
            PROP_NAME: {
                "title": [{"type": "text", "text": {"content": _truncate(post.title)}}]
            },
            PROP_AUTHOR: {
                "rich_text": [{"type": "text", "text": {"content": post.author}}]
            },
            PROP_INSTAGRAM_ID: {
                "rich_text": [{"type": "text", "text": {"content": post.instagram_id}}]
            },
            PROP_CONTENT_TYPE: {"select": {"name": post.content_type}},
            PROP_STATUS: {"select": {"name": STATUS_NEW}},
            PROP_SYNCED: {"date": {"start": synced_iso}},
        }
        if post.caption:
            properties[PROP_CAPTION] = {
                "rich_text": [{"type": "text", "text": {"content": _truncate(post.caption)}}]
            }
        if post.url:
            properties[PROP_URL] = {"url": post.url}
        if post.collections:
            properties[PROP_COLLECTION] = {
                "multi_select": [{"name": c} for c in post.collections]
            }

        self._post(
            "/pages",
            {"parent": {"database_id": database_id}, "properties": properties},
        )
