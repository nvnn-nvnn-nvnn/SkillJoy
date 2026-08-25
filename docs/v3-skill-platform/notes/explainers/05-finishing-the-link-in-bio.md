# 05 — Finishing the link-in-bio: five features, and how to build them

_A build guide, not a change note. Nothing here is implemented — this is the
thinking you'd otherwise do twice. Written for someone who can already write the
React and the SQL; what's expensive is knowing **which** React and SQL, and what
bites afterwards._

Ordered by leverage. #1 and #2 are the two where the product currently produces
**no signal** and **wrong signal**. The rest are polish.

| # | Feature | Difficulty | Migration? |
|---|---|---|---|
| 1 | Click tracking | medium | yes |
| 2 | Per-page OG tags | medium-hard | no |
| 3 | Email capture as a block | easy | yes (small) |
| 4 | Auto-fetch link thumbnails | hard (security) | no |
| 5 | Link scheduling / expiry | easy | yes (small) |

---

# 1 · Click tracking

**What's missing:** grep the repo for click counting and you get zero hits.
Creators have no idea which link works. This is the #1 reason people log back
into a link-in-bio product.

## The first decision: beacon or redirect?

Two ways to know a link was clicked.

**Redirect through your server** — the href becomes `/r/<linkId>`, you record
the click, then 302 to the real URL. This is what Bitly does. Do **not** do it
here:

- adds a full round-trip of latency to every click
- middle-click / "copy link address" gives people your redirector, not the link
- a URL that doesn't match the label is what phishing looks like — some clients
  warn on it
- if your server is down, every link on every page is dead

**Fire-and-forget beacon** — the href stays the real URL, and you send a small
request as the click happens. Slower to be *certain* about (you'll lose a few),
much better for everything else. Take this one.

> **The principle:** analytics must never sit between a user and the thing they
> asked for. Losing 2% of click data is cheap; adding 200ms to every click is
> not.

## Why `navigator.sendBeacon`, specifically

The page is navigating away. A normal `fetch()` gets **cancelled** when the
document unloads — you'll record clicks inconsistently and it'll look like a
backend bug for a week.

`navigator.sendBeacon(url, data)` exists precisely for this: the browser takes
ownership of the request and guarantees to send it even as the page dies. It's
POST-only, fire-and-forget, no response.

Two things to know:
- It can't set custom headers. So you can't send an `Authorization` header —
  which is fine, because visitors are anonymous anyway.
- `fetch(url, { keepalive: true })` is the fallback if you need headers. Same
  guarantee, 64KB limit.

Where to hook it: the `<a>` in `LinkBlock.jsx`, and the legacy flat list in
`Storefront.jsx`. Both are anchors — attach to `onClick` and **don't**
`preventDefault`. Let the navigation happen normally.

## Schema: rows, not a counter

The tempting design is `store_links.click_count integer` and an increment. It's
one column and no new table. Don't.

A counter answers exactly one question — "how many, ever". It cannot answer
"how many this week", "did the launch tweet do anything", "which day is my
audience active". And you can never recover that data later, because you threw
it away at write time.

Append a row per click instead:

```
link_clicks
  id           uuid pk
  link_id      uuid → store_links(id) on delete cascade
  creator_id   uuid → profiles(id)      ← denormalised on purpose
  created_at   timestamptz default now()
  referrer     text     nullable
  country      text     nullable
```

**Why `creator_id` is duplicated here** even though it's reachable via
`link_id → store_links.creator_id`: the query you'll run constantly is "all
clicks for my links, last 30 days". Without it, that's a join on every read of
your busiest analytics query, and RLS has to traverse the join too. Denormalise
the thing you filter by. Storage is free; joins in an RLS policy are not.

Index `(creator_id, created_at desc)`. That's the shape of every read.

## The part that will actually bite you: RLS on an anonymous insert

Visitors are not logged in. So the `anon` role needs `INSERT` permission on
`link_clicks`. Sit with that for a second — **you are opening a public write
endpoint**. Anyone can POST fake clicks.

Mitigations, roughly in order of value:

1. **Give the row nothing to inject.** The insert policy should allow only
   `link_id` from the client; `created_at` is a default, `creator_id` should be
   derived. A Postgres `BEFORE INSERT` trigger that looks up `creator_id` from
   `link_id` means the client can't lie about it — and an invalid `link_id`
   fails the foreign key.
2. **No `SELECT` for anon.** They can write, they cannot read. An attacker
   learns nothing.
3. **Rate limit.** Supabase doesn't do this per-table; if it matters, route the
   beacon through your Express backend where `strictLimiter` already exists.
4. **Accept some noise.** This is analytics, not billing. Perfect is the wrong
   bar.

> **The general lesson:** any time an anonymous user can write to your database,
> the security question is not "can they write" but "what can they *control* in
> what they write". Reduce the controllable surface to a single foreign key and
> most of the risk evaporates.

## Three things that will make your numbers wrong

- **Prefetch.** Browsers and link previewers (Slack, Discord, iMessage) fetch
  URLs before a human sees them. You're hooking `onClick`, so you're mostly
  safe — but be suspicious of a link with clicks and no traffic.
- **Double counting.** A frustrated user clicks twice. Decide whether you care;
  a 1-second dedupe in memory per link is usually enough.
- **Your own clicks.** The creator testing their page inflates their stats.
  Skip the beacon when the viewer is the owner — you already know `user?.id`
  and `profile.id` on that page.

## Displaying it

Start with one number per link in the editor. `count(*) group by link_id` for
the last 30 days. Resist building charts until someone asks — the number is 90%
of the value.

Two counts read very differently: **total** and **last 7 days**. A link with
4,000 lifetime clicks and 2 this week is a different situation from the reverse,
and one number can't say which.

## Checkpoints

- Click a link on a throttled "Slow 3G" connection. Does navigation still feel
  instant? (If not, you're awaiting something you shouldn't.)
- Kill the backend. Do links still work?
- Look at the row. Is `creator_id` correct even though the client never sent it?
- Try POSTing a click with someone else's `creator_id`. Does the trigger
  overwrite it?

---

# 2 · Per-page OG tags

**What's missing:** `index.html` has one static `og:title` for the entire app.
Every `@handle` link pasted into Instagram, Discord, iMessage or Slack previews
as *"SkillJoy — sell your skills from one link"*, with the SkillJoy logo. Never
the creator's name, never their avatar.

For a product whose whole purpose is being pasted into someone's bio, that is a
conversion leak on every share.

## Why this is harder than it looks

**Crawlers don't run JavaScript.** Facebook's, Twitter's, Discord's, and
iMessage's scrapers fetch your HTML, read the `<meta>` tags, and leave. They
never wait for React to hydrate.

So `document.title = …` in a `useEffect` — or any React-based head management —
is invisible to them. It runs long after the crawler has gone.

And your `vercel.json` says:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Every route serves the same static shell. That's correct for an SPA and fatal
for social previews.

## The fix: intercept the request before the shell is served

You need something that runs **on the server, per request**, that can look at
the URL, fetch the creator, and rewrite the HTML.

Three options:

- **Vercel serverless function or Edge Middleware.** Match `/@:handle`, fetch
  the profile, string-replace the meta tags in `index.html`, return it. Same
  HTML still boots the SPA for humans. ~60 lines. **Take this one.**
- **A prerender service.** Detects crawler user-agents and serves a rendered
  snapshot. Works, costs money, adds a dependency, and user-agent sniffing is
  fragile.
- **Move to Next.js / Remix.** Correct long-term, enormous today.

## How the injection actually works

Read `dist/index.html`, replace the meta block, return it with the right
headers. The mechanics are unremarkable. Four things are not:

**Escape everything.** You are putting a user-controlled string (`full_name`,
`bio`) into an HTML attribute. A bio containing `"` closes your attribute; one
containing `<script>` is worse. **This is an injection sink.** Escape `&`, `<`,
`>`, `"`, `'` — write the four-line escaper yourself, don't hand-roll a regex
that only handles quotes.

**`og:image` must be an absolute URL** with scheme and host. Relative paths are
silently ignored by every scraper. It also needs real dimensions —
**1200×630** is the near-universal expectation — and a creator's square avatar
will get cropped badly. Consider generating a proper card image later; ship the
avatar first.

**Cache it.** A profile fetch on every request to a public page is a lot of
load for something that changes weekly. `Cache-Control: public, s-maxage=300,
stale-while-revalidate=86400` means the CDN serves it fast, refreshes in the
background, and a stale preview for five minutes hurts nobody.

**Twitter needs its own tags.** `twitter:card`, `twitter:title`,
`twitter:image`. It reads OG tags as a fallback but `twitter:card` has no OG
equivalent, and without it you get a tiny thumbnail instead of a large card.

## Checkpoints

Do **not** trust "it looks right in view-source". Use the real validators —
Facebook's Sharing Debugger, Twitter's Card Validator — and paste the link into
an actual Discord DM. They cache aggressively, so use the debugger's re-scrape
button while iterating.

Also: `curl -A "facebookexternalhit/1.1" https://yoursite/@you` and read what
comes back. That's precisely what the crawler sees.

---

# 3 · Email capture as a *block*

**Correction to what I told you earlier:** email capture already exists.
`SubscribeForm` is rendered in `Storefront.jsx`, and there's a whole subscriber
and broadcast system — see [`02-email-capture-and-broadcast.md`](02-email-capture-and-broadcast.md).

The real gap is **placement**. It's hardcoded near the bottom, below the
products. Nobody scrolls that far. A creator can't move it, style it, retitle
it, or put it second — right under their bio, where it would actually convert.

## The concept: it wants to be a block

You already built the abstraction. `store_blocks` has `title`, `subtitle`,
`visible`, `position`, `collapsible`, and a JSONB `layout`. An email capture
form needs all of those and one more thing (a button label, a placeholder, a
success message) — which is exactly what JSONB `layout` is for.

So this is mostly *not* new code. It's a new `kind`.

## The migration is smaller than it looks — and has one trap

```sql
kind text not null default 'links' check (kind in ('links','products'))
```

You can't extend a CHECK constraint in place. You **drop it and add a new one**.
Both in one transaction, or you'll have a window where the table has no
constraint at all.

The trap is not the SQL. It's this:

> **Every renderer that switches on `kind` must already tolerate a kind it has
> never heard of.**

Think about the sequence. You deploy the migration. You create an `email` block.
A visitor still has yesterday's JavaScript cached. Their client fetches a block
with `kind: 'email'` and hits a `switch` with no matching case and no `default`.
If that renders `undefined`, you get a blank gap. If it throws, you've broken
their whole page with a data change.

Go and make the renderers skip unknown kinds *before* you add the kind. This is
forward-compatibility, and it's the difference between a schema you can evolve
and one you can't.

## Where it renders

Note 183's lesson applies directly: placement is a property of the **block**,
not the item. An email block sits in the profile or featured region like any
other, and inherits the same cascade for colours and shape. Don't invent a
second positioning system for it.

## Checkpoints

- Create an email block, drag it above your links. Does it land there on the
  public page?
- Load the public page with the *old* bundle (hard-refresh only the editor).
  Does the storefront still render?
- Does an existing subscriber submitting again produce a duplicate row, or an
  upsert? (`checkout.js` already upserts — match that behaviour.)

---

# 4 · Auto-fetch link thumbnails

**What's missing:** a creator adding eight links uploads eight images. Pasting a
URL could fetch that page's `og:image` and fill it in — most links would look
finished with zero work.

**This is the most dangerous feature on the list.** Not the hardest to make
work. The hardest to make *safe*.

## Why it must be server-side

Two independent reasons, either one sufficient:

- **CORS.** The browser cannot read the HTML of an arbitrary third-party site.
  It just can't. This isn't a workaround situation.
- **Privacy.** Even if it could, you'd be making your creator's browser connect
  to whatever domain they pasted, leaking their IP to it.

So: a backend endpoint that takes a URL, fetches it, and parses out the image.

## Now the part that matters: this is an SSRF primitive

You are building **an endpoint that makes your server fetch a URL a user
controls.** That is the textbook definition of Server-Side Request Forgery, and
your server sits inside a cloud network with things a stranger cannot reach.

What an attacker tries:

- `http://169.254.169.254/latest/meta-data/` — the **cloud metadata endpoint**.
  On many providers this hands out credentials. This is the one that ends
  companies.
- `http://localhost:3001/api/admin/...` — your own backend, from inside, where
  it may trust the caller
- `http://10.0.0.5/`, `http://192.168.1.1/` — anything else on your private
  network
- `file:///etc/passwd` — if your fetcher honours non-HTTP schemes
- A public URL that **redirects** to any of the above. This is why validating
  the input URL alone is not enough.

The defence, and you need all of it:

1. **Scheme allowlist:** `http:` and `https:` only.
2. **Resolve the hostname to an IP, then check the IP** — not the hostname.
   `evil.com` can have an A record pointing at `127.0.0.1`.
3. **Block private ranges:** `10/8`, `172.16/12`, `192.168/16`, `127/8`,
   `169.254/16`, `::1`, `fc00::/7`. Reject, don't sanitise.
4. **Re-check on every redirect,** and cap redirects at ~3. A validated URL that
   302s to metadata defeats every check you did up front.
5. **Timeout** (~5s) and **max response size** (~1MB) — otherwise a URL that
   streams forever is a free denial-of-service on your own server.
6. **Never return the fetch error to the client verbatim.** "Connection refused
   on 10.0.0.5" tells an attacker your network topology. That's blind SSRF
   becoming useful SSRF.

> Search "SSRF prevention cheat sheet" before you write this. Do not improvise
> it. This is the one feature on the list where getting it wrong is not a bug,
> it's an incident.

## Then: don't hotlink the result

You've found `https://theirsite.com/og.jpg`. Do not store that URL.

You already worked this out in note 188 — an asset that belongs to somebody
else, served on your pages, is their bandwidth and their power to break your
page by deleting it. Same rule: **download it, re-upload to your storage,
store your own URL.** `uploadLinkThumb` already exists.

Cap the image size on the way in. Someone's og:image being a 40MB PNG is not
theoretical.

## The UX detail that decides whether people like it

Fetch on paste, then **offer** the image — don't apply it silently, and
**never overwrite one they already chose**. An auto-action that destroys work is
worse than no auto-action. Show it with a "use this?" affordance.

Cache by domain. Ten Instagram links shouldn't be ten fetches of instagram.com.

## Checkpoints

- Paste `http://169.254.169.254/latest/meta-data/`. You must get a refusal, and
  the error must not describe what happened.
- Paste a URL that redirects to `http://localhost:3001/`. Refused?
- Paste a URL serving an infinite stream. Does your server recover?
- Paste a link that already has an image. Is the image untouched?

---

# 5 · Link scheduling / expiry

**What's missing:** "live until Friday". Cheap to build, and it's what makes a
launch page work without someone remembering to delete a link at midnight.

## Schema

Two nullable columns on `store_links`:

```
starts_at  timestamptz null    -- null = live now
ends_at    timestamptz null    -- null = never expires
```

Nullable, both defaulting to null, so every existing link keeps working
untouched. (Same discipline as `featured_link_*` in note 181 — a new key must
mean "unchanged" for existing rows.)

## The decision that matters: where do you filter?

This looks like a display question. It isn't.

**If a scheduled link is meant to be a secret** — an unannounced drop — then
filtering in the client is worthless. The rows are still served by PostgREST;
anyone can open devtools, or query your Supabase URL directly, and read the
link before it goes live. If it must be secret, the filter belongs in the **RLS
policy**, in SQL, where it cannot be bypassed.

**If it's just tidiness** — a link you want auto-hidden after an event — client
filtering is fine.

Decide which you're building. Ask yourself: *would a creator be upset if someone
found this link early?* If yes, RLS. If no, client.

Either way, there must be exactly **one function** that answers "is this link
live right now", and every caller uses it — the public page, the editor's
preview, the live preview. Three places implementing the same time comparison is
three places to get an off-by-one on `<=` vs `<`.

> Note 184's `cta_label` bug in one sentence: a field is only real if every end
> agrees about it. Same shape here.

## Timezones

Store UTC. `timestamptz` does this; don't fight it.

The trap is the **editor**. A creator picking "Friday 9pm" means 9pm *where they
are*. A `<input type="datetime-local">` gives you a string with no zone, and
`new Date(thatString)` interprets it in the browser's zone — which is usually
right and silently wrong for anyone travelling or on a misconfigured machine.

Show the resolved time back to them with the zone name. Ambiguity here produces
support tickets you cannot debug, because the creator's screenshot looks correct
to them.

## The stale-page problem

A visitor with your page open at 2:59pm still has it open at 3:01pm. The expired
link is still on screen, still clickable. Your options:

- accept it (fine for most cases — say so in the editor copy)
- re-check on `visibilitychange` and re-render
- a slow interval, if it genuinely matters

Pick deliberately. Don't discover it from a bug report.

## Editor affordance

Do not simply hide scheduled or expired links from the creator's own editor.
They'll think the link was deleted and make another.

Show them, with state: **"Scheduled — goes live Fri 9pm"**, **"Ended Tuesday"**.
This is the same rule as note 186's empty state: the state where nothing is
visible is the one that most needs a label.

---

# The through-line

Four of these five have the same shape underneath:

| Feature | The real question |
|---|---|
| Click tracking | what can an anonymous writer *control*? |
| OG tags | who is the consumer, and do they run JS? |
| Thumbnail fetch | who does the fetching, and what can they reach? |
| Scheduling | is this hidden, or is it *secret*? |

None of them is hard to make work. Each has one decision that's expensive to get
wrong and cheap to get right if you ask the question first.

And the fifth — email capture as a block — is the one where the answer is
"you already built this, you just built it in one fixed position." Which is its
own lesson: **before adding a feature, check whether you've already got it in a
shape that can't move.**

---

## Suggested order

1. **Click tracking** — biggest product gap, and it's self-contained.
2. **Email capture block** — smallest change, immediate conversion win, and it
   forces the unknown-kind tolerance you'll need for every future block type.
3. **Scheduling** — easy, and teaches the RLS-vs-client question in a low-stakes
   setting.
4. **OG tags** — highest ceiling, but it's infrastructure work and you'll want
   an uninterrupted afternoon.
5. **Thumbnail fetch** — last, deliberately. Do it when you can give the
   security a full sitting, not squeezed in.
