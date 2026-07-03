"""Configuration loading for the Instagram → Notion sync.

All secrets come from the environment (optionally seeded from a local ``.env``
file). Nothing sensitive is ever written to disk by this module.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    """Minimal ``.env`` loader so the package has no hard dependency on it.

    Lines are ``KEY=VALUE``; ``#`` comments and blank lines are ignored. Values
    already present in the real environment win, so you can always override the
    file at the shell.
    """
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


class ConfigError(RuntimeError):
    """Raised when required configuration is missing or malformed."""


@dataclass
class Config:
    """Resolved runtime configuration."""

    # --- Instagram auth (from browser session cookies) ---
    ig_sessionid: str
    ig_ds_user_id: str
    ig_csrftoken: str
    ig_app_id: str
    ig_user_agent: str

    # --- Notion ---
    notion_token: str
    notion_parent_page_id: str  # used to auto-create the DB on first run
    notion_saves_db_id: str  # optional; discovered/created if empty

    # --- Runtime ---
    state_path: Path
    request_delay_seconds: float

    @property
    def cookie_header(self) -> str:
        """The ``Cookie:`` header value Instagram expects."""
        return (
            f"sessionid={self.ig_sessionid}; "
            f"ds_user_id={self.ig_ds_user_id}; "
            f"csrftoken={self.ig_csrftoken}"
        )


DEFAULT_APP_ID = "936619743392459"  # Instagram web client X-IG-App-ID
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)


def load_config(env_file: str | os.PathLike[str] | None = None) -> Config:
    """Load configuration from the environment (and optional ``.env`` file).

    A single raw cookie header can be supplied via ``IG_COOKIE`` (paste it
    straight from browser DevTools) as an alternative to the three individual
    cookie variables.
    """
    base_dir = Path(__file__).resolve().parent.parent
    _load_dotenv(Path(env_file) if env_file else base_dir / ".env")

    sessionid = os.environ.get("IG_SESSIONID", "")
    ds_user_id = os.environ.get("IG_DS_USER_ID", "")
    csrftoken = os.environ.get("IG_CSRFTOKEN", "")

    # Convenience: parse a full "Cookie:" header if the individual vars are blank.
    raw_cookie = os.environ.get("IG_COOKIE", "")
    if raw_cookie and not (sessionid and ds_user_id and csrftoken):
        jar = _parse_cookie_header(raw_cookie)
        sessionid = sessionid or jar.get("sessionid", "")
        ds_user_id = ds_user_id or jar.get("ds_user_id", "")
        csrftoken = csrftoken or jar.get("csrftoken", "")

    missing = [
        name
        for name, value in [
            ("IG_SESSIONID", sessionid),
            ("IG_DS_USER_ID", ds_user_id),
            ("IG_CSRFTOKEN", csrftoken),
            ("NOTION_TOKEN", os.environ.get("NOTION_TOKEN", "")),
        ]
        if not value
    ]
    if missing:
        raise ConfigError(
            "Missing required configuration: "
            + ", ".join(missing)
            + ". See .env.example for setup."
        )

    saves_db_id = os.environ.get("NOTION_SAVES_DB_ID", "")
    parent_page_id = os.environ.get("NOTION_PARENT_PAGE_ID", "")
    if not saves_db_id and not parent_page_id:
        raise ConfigError(
            "Set NOTION_SAVES_DB_ID (existing database) or "
            "NOTION_PARENT_PAGE_ID (to auto-create one on first run)."
        )

    state_path = Path(
        os.environ.get("SYNC_STATE_PATH", str(base_dir / "state.json"))
    ).expanduser()

    return Config(
        ig_sessionid=sessionid,
        ig_ds_user_id=ds_user_id,
        ig_csrftoken=csrftoken,
        ig_app_id=os.environ.get("IG_APP_ID", DEFAULT_APP_ID),
        ig_user_agent=os.environ.get("IG_USER_AGENT", DEFAULT_USER_AGENT),
        notion_token=os.environ["NOTION_TOKEN"],
        notion_parent_page_id=parent_page_id,
        notion_saves_db_id=saves_db_id,
        state_path=state_path,
        request_delay_seconds=float(os.environ.get("SYNC_REQUEST_DELAY", "1.5")),
    )


def _parse_cookie_header(raw: str) -> dict[str, str]:
    """Parse a ``k=v; k=v`` cookie header into a dict."""
    jar: dict[str, str] = {}
    for part in raw.split(";"):
        part = part.strip()
        if "=" in part:
            key, _, value = part.partition("=")
            jar[key.strip()] = value.strip()
    return jar
