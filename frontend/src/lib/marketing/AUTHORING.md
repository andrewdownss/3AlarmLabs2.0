# Marketing page authoring

Add one Markdown file per URL under `content/`. The filename (without `.md`) must match the slug and must appear in `frontend/src/lib/landing/landing-content.ts` inside `seoLinks`.

## Quick start

1. Copy `content/self-paced-command-training.md` to `content/<your-slug>.md`.
2. Edit frontmatter (`title`, `description`, hero fields, optional `keywords`).
3. Replace the Markdown body with unique, helpful copy for that search intent.

## Frontmatter

| Field             | Maps to                                                       |
| ----------------- | ------------------------------------------------------------- |
| `title`           | `<title>`                                                     |
| `description`     | `<meta name="description">`                                   |
| `heroEyebrow`     | Pill above H1                                                 |
| `heroTitle`       | H1                                                            |
| `heroDescription` | Lead paragraph (defaults to `description` if omitted)         |
| `keywords`        | Optional list; emitted as `<meta name="keywords">` if present |

## Files ignored by the loader

- `README.md` in `content/` (use this doc instead)
- Files whose slug starts with `_` (e.g. `_draft-topic.md`)

## Recommended body outline

See the example file for structure: intro, what you practice, how it works, why it matters, who it’s for, FAQ, related internal links.
