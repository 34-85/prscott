"""Domain models shared across the sync pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field


# Instagram content types we care about, mapped to a friendly label used in Notion.
CONTENT_TYPE_POST = "Post"
CONTENT_TYPE_REEL = "Reel"
CONTENT_TYPE_CAROUSEL = "Carousel"


@dataclass
class SavedPost:
    """A single saved Instagram post, normalized for Notion.

    ``instagram_id`` is Instagram's stable media primary key (``pk``) and is the
    identity we deduplicate on. ``code`` is the shortcode used to build the
    public permalink.
    """

    instagram_id: str
    code: str
    author: str
    caption: str
    url: str
    content_type: str
    collections: list[str] = field(default_factory=list)

    @property
    def title(self) -> str:
        """A concise, human-readable title for the Notion page.

        Uses the author plus the first line of the caption so rows are scannable
        without opening each one.
        """
        snippet = " ".join(self.caption.split())
        if len(snippet) > 80:
            snippet = snippet[:77].rstrip() + "…"
        if snippet:
            return f"@{self.author} — {snippet}"
        return f"@{self.author} — {self.content_type}"

    @staticmethod
    def content_type_for(media: dict) -> str:
        """Classify a raw media object as Post / Reel / Carousel.

        Instagram encodes this across two fields:
          * ``media_type``: 1 = image, 2 = video, 8 = carousel/album
          * ``product_type``: ``"clips"`` marks a Reel
        """
        media_type = media.get("media_type")
        product_type = media.get("product_type")
        if media_type == 8:
            return CONTENT_TYPE_CAROUSEL
        if product_type == "clips" or media_type == 2:
            return CONTENT_TYPE_REEL
        return CONTENT_TYPE_POST

    @classmethod
    def from_media(cls, media: dict, collections: list[str] | None = None) -> "SavedPost":
        """Build a :class:`SavedPost` from a raw Instagram media object."""
        content_type = cls.content_type_for(media)
        code = media.get("code", "")
        # Reels get the /reel/ permalink; everything else uses /p/.
        path = "reel" if content_type == CONTENT_TYPE_REEL else "p"
        url = f"https://www.instagram.com/{path}/{code}/" if code else ""

        caption_obj = media.get("caption") or {}
        caption = caption_obj.get("text", "") if isinstance(caption_obj, dict) else ""

        user = media.get("user") or {}
        author = user.get("username", "unknown")

        return cls(
            instagram_id=str(media.get("pk") or media.get("id") or code),
            code=code,
            author=author,
            caption=caption,
            url=url,
            content_type=content_type,
            collections=sorted(set(collections or [])),
        )
