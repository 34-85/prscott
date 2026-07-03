# "Content Ideas" database schema

Create this with `notion-create-database` if it doesn't already exist. Put it
under the same parent page as the "Instagram Saves" database.

| Property        | Type          | Options / notes                                  |
|-----------------|---------------|--------------------------------------------------|
| `Name`          | title         | Short idea title                                 |
| `Source URL`    | url           | Instagram permalink of the originating save      |
| `Source Author` | rich_text     | Original creator handle                          |
| `Content Type`  | select        | `Post`, `Reel`, `Carousel`                       |
| `Platforms`     | multi_select  | `Instagram`, `TikTok`, `YouTube`                 |
| `Status`        | select        | `Idea`, `In Production`, `Published`             |
| `Created`       | created_time  | Auto                                             |

The rich content (reframed angle, 3 hooks, outline, platform breakdowns) lives
in the **page body**, not in properties — see `idea-template.md`.

After creating it, offer to record its id in `config.json` so the skill can skip
discovery next time.
