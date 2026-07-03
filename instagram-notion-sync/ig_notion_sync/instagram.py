"""Client for Instagram's private web API (the one the website itself calls).

Authentication is done exactly the way a logged-in browser does it: the
``sessionid`` / ``ds_user_id`` / ``csrftoken`` cookies plus the ``X-IG-App-ID``
header. No password ever touches this code — you paste cookies from a browser
you're already logged into.

Only read endpoints are used (listing collections and saved media).
"""

from __future__ import annotations

import logging
import time
from typing import Iterator

import requests

from .config import Config
from .models import SavedPost

log = logging.getLogger(__name__)

API_BASE = "https://www.instagram.com/api/v1"

# The synthetic collection that contains every save. Real, user-named
# collections are subsets of this one.
ALL_MEDIA_COLLECTION_ID = "ALL_MEDIA_AUTO_COLLECTION"
UNCATEGORIZED_LABEL = "Saved"  # collection label for saves not in a named collection


class InstagramError(RuntimeError):
    """Raised on authentication failure or an unexpected API response."""


class InstagramClient:
    def __init__(self, config: Config):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": config.ig_user_agent,
                "X-IG-App-ID": config.ig_app_id,
                "X-CSRFToken": config.ig_csrftoken,
                "Cookie": config.cookie_header,
                "Referer": "https://www.instagram.com/",
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
            }
        )

    # -- low level ---------------------------------------------------------

    def _get(self, path: str, params: dict | None = None) -> dict:
        url = f"{API_BASE}{path}"
        try:
            resp = self.session.get(url, params=params, timeout=30)
        except requests.RequestException as exc:
            raise InstagramError(f"Request to {url} failed: {exc}") from exc

        if resp.status_code in (401, 403):
            raise InstagramError(
                f"Instagram returned {resp.status_code} — your session cookies are "
                "likely expired. Refresh IG_SESSIONID / IG_CSRFTOKEN and retry."
            )
        if resp.status_code == 429:
            raise InstagramError(
                "Instagram is rate-limiting this session (429). Try again later "
                "or increase SYNC_REQUEST_DELAY."
            )
        if resp.status_code != 200:
            raise InstagramError(
                f"Unexpected {resp.status_code} from {url}: {resp.text[:200]}"
            )
        try:
            return resp.json()
        except ValueError as exc:
            raise InstagramError(f"Non-JSON response from {url}: {resp.text[:200]}") from exc

    def _paginate(self, path: str, base_params: dict | None = None) -> Iterator[dict]:
        """Yield raw media objects across all pages of a feed endpoint.

        Instagram cursors with ``next_max_id`` and signals continuation with
        ``more_available``. Media may arrive either bare or wrapped in an
        ``{"media": {...}}`` envelope depending on the endpoint.
        """
        params = dict(base_params or {})
        while True:
            data = self._get(path, params)
            for item in data.get("items", []):
                media = item.get("media", item) if isinstance(item, dict) else None
                if media:
                    yield media
            if not data.get("more_available"):
                return
            next_max_id = data.get("next_max_id")
            if not next_max_id:
                return
            params["max_id"] = next_max_id
            time.sleep(self.config.request_delay_seconds)

    # -- high level --------------------------------------------------------

    def get_collections(self) -> dict[str, str]:
        """Return a mapping of ``collection_id -> collection_name``.

        Excludes the synthetic all-media collection since it carries no
        meaningful label.
        """
        collection_types = '["MEDIA","PRODUCT_AUTO_COLLECTION","ALL_MEDIA_AUTO_COLLECTION"]'
        data = self._get("/collections/list/", {"collection_types": collection_types})
        result: dict[str, str] = {}
        for item in data.get("items", []):
            cid = str(item.get("collection_id", ""))
            name = item.get("collection_name", "")
            if cid and cid != ALL_MEDIA_COLLECTION_ID and name:
                result[cid] = name
        log.info("Found %d named Instagram collection(s).", len(result))
        return result

    def _collection_media(self, collection_id: str) -> Iterator[dict]:
        return self._paginate(f"/feed/collection/{collection_id}/posts/")

    def fetch_saved_posts(self) -> list[SavedPost]:
        """Fetch every saved post, attributing named collections to each.

        Strategy: walk each named collection first to build a
        ``media_id -> {collection names}`` map, then walk the all-media
        collection to enumerate every save. Saves not in any named collection
        get the generic "Saved" label.
        """
        named = self.get_collections()

        collection_map: dict[str, set[str]] = {}
        for cid, name in named.items():
            log.info("Reading collection %r…", name)
            count = 0
            for media in self._collection_media(cid):
                mid = str(media.get("pk") or media.get("id") or media.get("code"))
                collection_map.setdefault(mid, set()).add(name)
                count += 1
            log.info("  %d post(s) in %r.", count, name)
            time.sleep(self.config.request_delay_seconds)

        posts: list[SavedPost] = []
        seen: set[str] = set()
        log.info("Reading all saved posts…")
        for media in self._collection_media(ALL_MEDIA_COLLECTION_ID):
            mid = str(media.get("pk") or media.get("id") or media.get("code"))
            if mid in seen:
                continue
            seen.add(mid)
            labels = collection_map.get(mid) or {UNCATEGORIZED_LABEL}
            posts.append(SavedPost.from_media(media, sorted(labels)))

        log.info("Fetched %d saved post(s) total.", len(posts))
        return posts
