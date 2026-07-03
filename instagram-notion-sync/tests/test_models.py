"""Tests for the media-parsing logic — runnable without any credentials.

    python -m unittest discover -s tests
"""

import unittest

from ig_notion_sync.models import (
    CONTENT_TYPE_CAROUSEL,
    CONTENT_TYPE_POST,
    CONTENT_TYPE_REEL,
    SavedPost,
)


def media(**overrides):
    base = {
        "pk": "123",
        "code": "ABC123",
        "media_type": 1,
        "user": {"username": "creator"},
        "caption": {"text": "hello world"},
    }
    base.update(overrides)
    return base


class ContentTypeTests(unittest.TestCase):
    def test_image_is_post(self):
        self.assertEqual(SavedPost.content_type_for(media(media_type=1)), CONTENT_TYPE_POST)

    def test_carousel(self):
        self.assertEqual(SavedPost.content_type_for(media(media_type=8)), CONTENT_TYPE_CAROUSEL)

    def test_video_is_reel(self):
        self.assertEqual(SavedPost.content_type_for(media(media_type=2)), CONTENT_TYPE_REEL)

    def test_clips_product_is_reel(self):
        m = media(media_type=2, product_type="clips")
        self.assertEqual(SavedPost.content_type_for(m), CONTENT_TYPE_REEL)


class FromMediaTests(unittest.TestCase):
    def test_post_permalink(self):
        post = SavedPost.from_media(media(media_type=1))
        self.assertEqual(post.url, "https://www.instagram.com/p/ABC123/")
        self.assertEqual(post.author, "creator")
        self.assertEqual(post.instagram_id, "123")

    def test_reel_permalink(self):
        post = SavedPost.from_media(media(media_type=2, product_type="clips"))
        self.assertEqual(post.url, "https://www.instagram.com/reel/ABC123/")

    def test_collections_deduped_and_sorted(self):
        post = SavedPost.from_media(media(), ["B", "A", "A"])
        self.assertEqual(post.collections, ["A", "B"])

    def test_missing_caption_is_empty(self):
        post = SavedPost.from_media(media(caption=None))
        self.assertEqual(post.caption, "")

    def test_title_includes_author_and_snippet(self):
        post = SavedPost.from_media(media(caption={"text": "a great tip about AI"}))
        self.assertTrue(post.title.startswith("@creator — a great tip"))

    def test_title_truncates_long_caption(self):
        post = SavedPost.from_media(media(caption={"text": "x " * 100}))
        self.assertLessEqual(len(post.title), 92)  # "@creator — " + 80-ish chars
        self.assertTrue(post.title.endswith("…"))


if __name__ == "__main__":
    unittest.main()
