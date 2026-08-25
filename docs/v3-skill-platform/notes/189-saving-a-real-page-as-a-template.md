# 189 — Saving a real page as a template

Date: 2026-08-25
Migrations: **034_store_templates.sql** (run after 028, 030–033)

An admin builds a page in the normal editor — background, video, music,
effects — and saves that page's **look** as a template anyone can pick.

This is the note for the feature *and* for the three bugs found while proving it
worked. The bugs are the more useful half.

---

## 1 · Why this had to exist at all

There are 38 hand-authored presets in `src/lib/presets.js`. Adding a 39th is
typing an object literal. So why build a whole table, endpoint and UI?

**Because a preset with a video cannot be hand-written.** The asset has to be
uploaded before anything can reference it. The moment an upload is involved, the
template can only be created by a *running system* — there is no way to express
"this look, with this video" as source code.

That is the entire justification. Everything else follows from it.

> **Transferable:** when a config format can't express something, the answer
> isn't a more clever config format. It's noticing that the thing needs a
> runtime, and building the smallest one.

---

## 2 · The security shape: the client sends metadata, never the look

The obvious API is "client POSTs the theme it wants saved". That is wrong, and
the reason is worth internalising.

If the client sends the theme, it can send **any** theme — including asset URLs
pointing at paths the caller doesn't own. Your server would then dutifully copy
someone else's private files into a public bucket. You've written a file-theft
endpoint and called it a feature.

So the request carries **name, blurb, category, emoji, includeAudio** and
nothing else. The theme is read server-side:

```js
const { data: profile } = await supabase
    .from('profiles').select('storefront_theme').eq('id', req.user.id).single();
```

`req.user.id` comes from the verified JWT. The caller cannot name a path, cannot
name a user, cannot submit a look that was never on a real page.

> **Transferable:** for any "save my current X" endpoint, read X from the
> server's own copy. The moment the client supplies the payload, every field in
> it becomes an input you have to defend.

### Three layers, and only one of them is the boundary

| Layer | What it does | Is it security? |
|---|---|---|
| `isAdmin` in the editor UI | hides the panel | **no** — convenience |
| `ADMIN_EMAIL` check in the route | rejects non-admins | **yes** |
| No insert/update/delete RLS policy at all | anon & authenticated *cannot write* | **yes**, structurally |

The third is the strongest and the cheapest. `store_templates` has a `SELECT`
policy and nothing else, so the only client that can write is the service-role
one inside the backend. Not "shouldn't" — *can't*.

---

## 3 · Asset ownership, applied

Note 188 established the rule: **an asset needs an owner, or it needs none.**
Uploaded files belong to the uploader; pointing a shared template at them means
their bandwidth pays for everyone else's traffic, and their spring cleaning
breaks strangers' pages.

So saving copies each asset into a platform-owned prefix
(`skill-covers/_templates/<id>/`) and stores the rewritten URL. The template is
then independent of the author's own page forever.

**Copy, not `storage.copy()`.** The API's copy gives back no size — and the size
is the entire point, since it decides what every visitor downloads on every page
view of every storefront using the template. Downloading the blob is the only
way to know what you're about to make everyone pay for.

**The manifest earns its keep on delete.** `assets` is
`[{ key, path, bytes, mime }]`. Without it, finding a template's files means
parsing its theme for URLs — which breaks the first time the theme shape
changes. Store what you did, don't re-derive it.

---

## 4 · Three bugs, found by measuring instead of assuming

The feature "worked" after the first pass. Then I measured the admin's real
theme, and all three of these fell out at once.

### 4a · It copied assets the page doesn't render

```
bg: 'image'          ← the page shows an image
bg_video: 7.12 MB    ← …and still had a video from an earlier experiment
```

The first version copied `bg_video` unconditionally. So a page set to `image`
dragged **7 MB of video nobody would ever see** into the template, and blew the
budget on invisible bytes.

The fix is to ask what the theme actually paints:

```js
if (theme.bg === 'image' || theme.bg === 'video') wanted.push('bg_image'); // background, or the video's poster
if (theme.bg === 'video') wanted.push('bg_video');
```

…and to blank the unused keys, so a discarded asset can't survive into the
template still pointing at the author's storage.

> **Transferable:** a field being *set* is not the same as a field being *used*.
> When copying state, copy what the renderer reads — the renderer's own
> conditions are the specification.

### 4b · `banner_url` and `cursor_url` were never copied

`ASSET_KEYS` was `['bg_image', 'bg_video']`. Banner and cursor are uploads too.
A saved template kept pointing at the author's files for both — the exact
hotlinking this whole design exists to prevent, shipped inside the feature that
prevents it.

Found by listing every theme key that holds an uploaded URL and diffing that
against the list being copied. Two of six were missing.

> **Transferable:** when you handle "assets", enumerate them from the schema,
> not from memory. `grep` `DEFAULT_THEME` for every key whose value is a URL,
> then check each one is in your list.

### 4c · A failed save leaked orphans into storage

The original flow validated *while* copying: read a file, check its size, write
it, next. So a save with four assets where the third is too big would write two
files, then throw — and the catch block never removed them. **Every failed save
leaked storage that nothing referenced and nothing would ever clean up.**

Restructured into two phases:

```
measure everything  →  report ALL problems at once  →  only then write
```

Two wins from one change. The obvious one: nothing is written until the whole
set is known-good, so there is no partial state to clean up. The subtle one:
**the error names every problem instead of the first**. Against the real theme:

```
Too heavy to share — Playboi Carti - bando is 2.9MB (max 2.0MB);
GTA Vice City - North Point Mall Theme is 3.4MB (max 2.0MB);
everything together is 10.0MB (max 8.0MB).
```

The old version would have said "bando is 2.9MB", and you'd fix it, save again,
and learn about the next one. Four round trips to discover four problems.

The write phase still has its own `try/catch` that removes anything written, for
the failures size checks can't predict — a network error mid-upload.

> **Transferable:** validate-then-act beats validate-while-acting for two
> separate reasons, and people usually only notice the first. No partial writes
> *and* complete error messages.

---

## 5 · The bug that wasn't a bug

Reported: "couldn't save the templates — threw an error."

**The backend wasn't running.** `backend/.env` sets `PORT=3001` and
`.env.local` points the frontend there; nothing was listening. Every `/api/*`
call was failing, not just templates.

This is LANDMINES §15 firing exactly as written — *"is this build even
running?"* is the cheapest check and the one skipped. It cost one round this
time instead of three, because the checklist existed.

Worth noting how it was confirmed rather than guessed:

```
curl -o /dev/null -w "%{http_code}" http://localhost:3001/api/templates
→ 000        (connection refused, not 404 — nothing is there at all)
```

`000` and `404` mean completely different things. `404` would have meant the
server was up and the route was wrong.

---

## 6 · What actually happens when you save

Measured against the real admin theme, both ways:

| | assets | total | result |
|---|---|---|---|
| Include music **on** | 5 | 10.0 MB | **rejected**, 3 problems listed |
| Include music **off** | 1 | 0.1 MB | saves |

Two things this makes obvious that the code alone did not:

- the 7 MB video is gone from the count entirely — fix 4a working
- the music is what blows the budget, and the toggle is the actionable fix,
  which is why the error message names it

The budgets (3 MB video / 2 MB audio / 8 MB total) are deliberately tight.
Music **autoplays**, so it downloads on arrival for every visitor to every page
using the template. 10 MB of backing tracks per page view is not a template,
it's a tax.

---

## 7 · Mobile: background video is a desktop-only enhancement

Reported separately: heavier mp4s don't play on phones. Three causes, none
fixable by trying harder to autoplay:

1. **iOS Low Power Mode blocks autoplay outright** — `muted` + `playsInline`
   don't matter, and there is no API to detect it
2. a multi-megabyte file over cellular stalls, or eats someone's data
3. some Android browsers refuse a second video layer under memory pressure

So don't ship it there. `shouldPlayBgVideo()` refuses on coarse-pointer +
narrow viewport, on `saveData`, on 2g/3g, and on `prefers-reduced-motion`.

This costs nothing **because the poster already exists** (note 188 §3). The
work of making video degrade gracefully was done before there was a reason to;
mobile just became another case the existing fallback already covered.

> **Transferable:** a good fallback pays twice. The second time you don't even
> notice you're spending it.

The editor says so at the upload control, because you author on a desktop where
it always plays — otherwise the only way to learn phones get the still is a bug
report.

---

## Files
`docs/…/migrations/034_store_templates.sql` — new
`backend/routes/templates.js` — new: list / save / delete
`backend/index.js` — mounted at `/api/templates` (reads public, writes auth'd inside)
`src/lib/templates.js` — new client
`src/app-pages/StorefrontEditor.jsx` — admin save panel, merged picker, delete
`src/app-pages/auth/Onboarding.jsx` — saved templates in the step-5 picker
`src/app-pages/Storefront.jsx` — `shouldPlayBgVideo()`

## Still open
- `install_count` is never incremented — applying a template records nothing
- `position` is never set, so ordering within a category is by `created_at`
- Plan 05 phase 1 (creator-authored, shareable by link) still needs the
  **second** copy at apply time; this phase is admin-only, so one copy is enough

---

## Exercises

1. **Attack the endpoint.** POST to `/api/templates` with a body containing a
   full `theme` object with `bg_video` pointing at another user's storage path.
   What happens, and which line makes it a non-event? Now imagine the version
   that trusted the client — write the one-sentence incident report.

2. **Reproduce the orphan leak.** Revert to validate-while-copying (write each
   asset as you check it). Save a theme whose *second* asset is oversized. List
   `_templates/<id>/` in Supabase. What's there, and what would ever delete it?

3. **Count the round trips.** With the old error behaviour, how many saves would
   it take to discover all three problems in the real theme? Now explain why
   "report all problems" is a property of *when you validate*, not of how you
   format the message.

4. **Enumerate the assets yourself.** Grep `DEFAULT_THEME` for every key holding
   a URL. Compare against `wanted` in the save route. Is the list complete
   today? What would make it stay complete — a test, a comment, or a different
   data shape?

5. **Justify the budgets.** At 8 MB total and 10,000 page views/month, what does
   one template cost in egress? Now assume 50 storefronts use it. Is 8 MB the
   right number, and what would you need to know to raise it?

6. **Break the mobile gate.** Force `shouldPlayBgVideo()` to `true` and load a
   video template on a phone in Low Power Mode. What do you see, and what would
   a visitor conclude about the page? Then explain why the poster makes the
   *refusal* invisible.

7. **The 000 vs 404 distinction.** Stop the backend and curl the endpoint. Now
   start it and curl a route that doesn't exist. Write down what each status
   tells you about where the problem is — and add it to your own debugging
   checklist.
