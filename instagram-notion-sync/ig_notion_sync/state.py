"""Local state: which saves we've already pushed to Notion.

The state file is a small JSON document. Keeping it separate from config means
the sync is idempotent — re-running never creates duplicate Notion rows even if
Instagram returns the same saves again.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

log = logging.getLogger(__name__)


class StateStore:
    """Tracks synced Instagram media IDs and the resolved Notion database ID."""

    def __init__(self, path: Path):
        self.path = path
        self._synced_ids: set[str] = set()
        self._saves_db_id: str = ""
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            log.info("No state file at %s; starting fresh.", self.path)
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("Could not read state file (%s); starting fresh.", exc)
            return
        self._synced_ids = set(data.get("synced_ids", []))
        self._saves_db_id = data.get("saves_db_id", "")
        log.info("Loaded state: %d saves already synced.", len(self._synced_ids))

    def save(self) -> None:
        """Persist state atomically (write-temp-then-rename)."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "synced_ids": sorted(self._synced_ids),
            "saves_db_id": self._saves_db_id,
        }
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        tmp.replace(self.path)

    def is_synced(self, instagram_id: str) -> bool:
        return instagram_id in self._synced_ids

    def mark_synced(self, instagram_id: str) -> None:
        self._synced_ids.add(instagram_id)

    @property
    def saves_db_id(self) -> str:
        return self._saves_db_id

    @saves_db_id.setter
    def saves_db_id(self, value: str) -> None:
        self._saves_db_id = value

    @property
    def synced_count(self) -> int:
        return len(self._synced_ids)
