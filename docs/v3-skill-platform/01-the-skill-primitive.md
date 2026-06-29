# 01 — The Skill Primitive

The **Skill** is the atomic sellable unit. Everything else is a block inside it.

```
Skill
├── title              ("Ship your first AI app")
├── outcome/subtitle   (one-line promise)
├── cover image
├── price              (one-time OR membership for ongoing updates/community)
├── version            (integer, increments when creator updates)
├── status             (draft | published)
├── content_blocks[]   (ordered, mixed formats)
│     ├── type: video      (hosted/embedded video + title)
│     ├── type: file       (downloadable asset)
│     ├── type: prompt     (text block: prompt / GPT config / system prompt)
│     ├── type: workflow   (file or text: n8n/Zapier/Make template/recipe)
│     ├── type: text       (rich text lesson/guide)
│     └── type: coaching   (a bookable call slot — link-based at MVP)
└── community_space     (one lightweight thread/space per Skill)
```

## The one rule that matters

> The creator **never** picks "am I making a course or a download?" They make a
> **Skill** and drop in blocks.

A course = a Skill with several video blocks. A prompt pack = a Skill with prompt
blocks. This unification is the whole product. If a screen ever asks the creator
to choose a "type of product," that's a regression.

## Block types (MVP)

| Type | Stores | Buyer interaction |
|------|--------|-------------------|
| `video` | external embed URL (YouTube-unlisted / Vimeo / Mux — pick one) + title | watch inline |
| `file` | object-storage key | download via fresh signed URL |
| `prompt` | rich text | **copy-to-clipboard** |
| `workflow` | text **or** file (n8n/Zapier/Make recipe) | copy or download |
| `text` | rich text | read inline |
| `coaching` | external booking link (Calendly etc.) | click out to book |

Blocks are **ordered** (`position`) and **reorderable** in the builder. Blocks
are **mutable** — editing them is what drives versioning (see below).

## Pricing

- **One-time:** pay once, permanent access to current + future versions.
- **Membership:** recurring, for ongoing updates + community access.

Both are a single price field with a `pricing_type` toggle. Keep it to these two
at MVP — no tiers, no multi-price.

## Versioning

- `version` is an integer that **increments when the creator updates a published
  Skill's content.**
- Existing buyers **automatically** get the updated content — their locker
  always shows the current version.
- Buyers see an **"Updated to v2"** indicator so the update is visible, not
  silent.
- This is the answer to "how do I improve what I already sold?" — and a reason
  to choose membership pricing.

See [doc 05](05-content-delivery.md) for the mechanics (what increments the
version, what notifies buyers).

## Community space

- **One** lightweight discussion thread attached to each Skill.
- Visible only to **buyers + the creator.**
- Posts + replies. That's it.
- **Do NOT build a full forum / Skool clone** — no channels, categories,
  reactions, DMs, moderation tooling beyond delete-own/creator-delete.
