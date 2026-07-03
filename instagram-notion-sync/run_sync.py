#!/usr/bin/env python3
"""Convenience launcher so launchd can call one file directly.

Equivalent to ``python -m ig_notion_sync.sync``.
"""

from ig_notion_sync.sync import main

if __name__ == "__main__":
    main()
