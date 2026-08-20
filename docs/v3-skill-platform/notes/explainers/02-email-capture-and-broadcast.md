# 02 — Email capture & broadcast (how the audience system works)

_How a stranger on a storefront becomes a subscriber, and how one creator email
reaches all of them. Every claim points at a real file — go read it._

> Change-log for the day this was built: [`../52-phase9-email-capture-marketing.md`](../52-phase9-email-capture-marketing.md).
> That note describes June 23 and is partly stale (it says "no unsubscribe link
> yet" — Phase 12 added one). **This doc describes today.**

---

## 0. The 60-second mental model

Two tables and one loop:

```
visitor types email  ──►  subscribers row  ──►  creator writes subject+body
                                                        │
        inbox  ◄──  Resend  ◄──  one send per recipient ┘
          │
          └─► "Unsubscribe" ──► signed link ──► row deleted
```

**Nothing is scheduled, queued, or automated.** A broadcast happens only when a
creator clicks Send, and it is delivered synchronously while that HTTP request is
still open. Knowing that explains most of the system's limits later on.

---

## 1. The concept that governs everything: two kinds of email

This distinction is the whole reason the code is shaped the way it is. It is
industry-wide, not a SkillJoy idea.

| | **Transactional** | **Marketing (bulk)** |
|---|---|---|
| Trigger | Something the user *did* | Creator decides to write |
| Examples | Purchase receipt, magic link | "New course is live!" |
| Consent needed? | No — they asked for it | **Yes** |
| Unsubscribe link? | Not required | **Legally required** |
| In this repo | `backend/lib/email.js` templates, sent from webhooks | `backend/routes/marketing.js` |

Both go through the same `sendEmail()` in `backend/lib/email.js`, but only the
marketing path builds an unsubscribe link. Mixing them up is the classic
beginner mistake: put marketing content in a receipt and you have broken
CAN-SPAM (US) / GDPR (EU); add an unsubscribe link to a password reset and users
opt out of mail they actually need.

> **Ask yourself, always:** did the user *ask* for this specific message? If no,
> it needs consent and an unsubscribe.

---

## 2. Capture — visitor → subscriber

**UI:** `src/components/SubscribeForm.jsx`, rendered on the storefront.
**Client:** `subscribe()` in `src/lib/subscribers.js`.
**Server:** `POST /api/public/subscribe` → `backend/routes/public.js`.

Read `routes/public.js` and notice four separate decisions:

1. **It runs on the backend, not the browser.** The client comment says it
   plainly: a direct anon-key insert is "RLS-fragile and unvalidated." The server
   uses the **service role** key, so the write cannot be broken by a future RLS
   policy edit.
   > ⚠️ Historical wrinkle worth seeing: the migration still has an
   > `"Anyone can subscribe"` INSERT policy from when the browser wrote directly.
   > It is now unused. **Dead policies are a real hazard** — they keep granting
   > access nobody audits. Good thing to notice and question.

2. **The email is normalised**: `.trim().toLowerCase()`. Do this at the boundary,
   once. `Bob@x.com` and `bob@x.com` are the same mailbox, and if you skip it your
   "unique" constraint won't be.

3. **The creator is confirmed to exist** before insert — avoids orphan rows and FK
   error noise.

4. **It is idempotent**: `upsert(..., { onConflict: 'creator_id,email',
   ignoreDuplicates: true })`. Subscribing twice returns *success*, not an error.
   > **Concept — idempotency.** An operation you can safely repeat with the same
   > result. Users double-click. Networks retry. Design writes so a repeat is
   > harmless. You have already seen this twice in this codebase: here, and the
   > `fulfilled_at` claim in `backend/lib/skillFulfillment.js`.

Rate limiting: `app.use('/api/public', strictLimiter, publicRoutes)` in
`backend/index.js` — 30 requests / 15 min per IP. Without it, a public unauth'd
endpoint that writes rows is an open invitation.

---

## 3. Where the list lives

`docs/v3-skill-platform/migrations/008_email_marketing.sql`:

- **`subscribers`** — `creator_id, email, name, source`, unique per
  `(creator_id, email)`.
  - Each creator has their **own** list. There is no global SkillJoy list. The
    unique constraint is *per creator*, so one person can subscribe to many
    creators — correct, and worth understanding before you write any query here.
  - `source` records *where* they signed up. Nothing filters on it yet (→ exercise 3).
- **`broadcasts`** — a log of what was sent: `creator_id, subject, body,
  recipient_count`.
  - Written on every send (`routes/marketing.js`), and it has a SELECT policy…
    but **nothing in the app ever reads it** (→ exercise 2).

RLS on `subscribers`: creators can `SELECT`/`DELETE` only `WHERE auth.uid() =
creator_id`. That is what makes `listSubscribers()` in `src/lib/subscribers.js`
safe to call straight from the browser — the database, not the client code,
enforces that you only see your own list.

---

## 4. Sending — the actual broadcast

**UI:** `src/components/AudiencePanel.jsx` (subject + body + confirm).
**Client:** `sendBroadcast()` in `src/lib/subscribers.js`.
**Server:** `POST /api/marketing/broadcast` → `backend/routes/marketing.js`.
Mounted `strictLimiter, authMiddleware` — logged-in creators only.

The core is about six lines. Read them closely:

```js
const results = await Promise.allSettled(
  subs.map(s => sendEmail({ to: s.email, subject, html: buildHtml(s.email) }))
);
const sent   = results.filter(r => r.status === 'fulfilled').length;
const failed = results.length - sent;
```

Three concepts are packed in there:

**a) `Promise.allSettled`, not `Promise.all`.**
`all` rejects the moment *any* promise rejects — one dead mailbox would abort the
whole broadcast and you would not know who got through. `allSettled` waits for
every promise and reports each outcome separately. **Rule: use `allSettled`
whenever partial success is a real, acceptable outcome.**

**b) One send per recipient — deliberately.**
The comment says "avoids leaking the list." Putting 500 addresses in one `To:`
shows every subscriber each other's email — a privacy breach. `BCC` hides them,
but then everyone gets a byte-identical message, so no per-person unsubscribe
link. Individual sends buy privacy **and** personalisation. Note that `buildHtml`
is a function *of the recipient's email* for exactly that reason.

**c) The failure surface.**
If `sent === 0` the route returns **502** with the first error — usually a missing
`RESEND_API_KEY`. Distinguishing "all failed" (your config is broken) from "some
failed" (a few bad addresses) is a small thing that saves hours of debugging.

---

## 5. Unsubscribe — stateless auth via HMAC

This is the most transferable idea in the system. `backend/lib/unsub.js`:

```js
crypto.createHmac('sha256', SECRET)
  .update(`${creatorId}:${email.toLowerCase()}`)
  .digest('hex').slice(0, 32);
```

**The problem:** someone must be able to unsubscribe from an email client, with no
account and no login. So the link itself has to prove it is genuine.

**The naive version** — `/unsubscribe?c=<creator>&e=<email>` — lets anyone edit the
URL and unsubscribe *any* address from *any* creator. It is also enumerable.

**The fix:** append `t=<HMAC(creatorId:email)>`. Only the server knows `SECRET`, so
only the server can produce a valid `t`. `routes/public.js` recomputes the token
and compares before deleting. Forge-proof with **zero stored state** — no tokens
table, no expiry job.

> **Concept — signed tokens.** When you need to hand an unauthenticated user a
> capability, don't store a random token: *sign the parameters*. The signature
> proves the values weren't tampered with. This is the same primitive behind JWTs
> and behind Stripe's webhook signature check in `backend/routes/webhooks.js`.

Note `SECRET` falls back to `SUPABASE_SERVICE_KEY`, then `'dev-secret'`. Fine
locally; in production set `UNSUBSCRIBE_SECRET`. **If that secret ever changes,
every previously-sent unsubscribe link breaks.**

Landing page: `src/app-pages/Unsubscribe.jsx` → `POST /api/public/unsubscribe`,
which deletes the row. (Hard delete — see exercise 5 for why that's arguable.)

---

## 6. Deliverability — why "it sent" ≠ "it arrived"

`FROM` in `backend/lib/email.js` defaults to `onboarding@resend.dev`, and the
comment warns this **only delivers to the Resend account owner** until you verify
a domain. So a broadcast can report `sent: 40` and reach nobody.

> **Concept.** Anyone can *claim* to send as `you@yourdomain.com`. Three DNS
> records are how a receiving server decides whether to believe it:
> - **SPF** — which servers are allowed to send for this domain.
> - **DKIM** — a cryptographic signature proving the body wasn't altered.
> - **DMARC** — what to do when SPF/DKIM fail (reject / quarantine / allow).
>
> Verifying a domain in Resend is just adding those records. Skip it and you land
> in spam no matter how good your code is. **Deliverability is mostly DNS and
> sender reputation, not code.**

---

## 7. Known weak spots (all real, all fixable)

Understand these before extending anything here:

1. **The fan-out is uncapped.** 500 subscribers = 500 simultaneous HTTP requests.
   Resend's default is roughly 2/sec, so most return **429** and land in `failed`.
2. **`failed` is a bare number.** No record of *who* failed or *why*, so you cannot
   retry just them. A transient 429 is indistinguishable from a dead address.
3. **The request blocks on the whole fan-out.** A large list can exceed the proxy
   timeout (~30–60s). The `broadcasts` row is inserted *after* the sends — die
   mid-send and mail went out with no record, so a retry double-sends.
4. **No open/click tracking**, and `broadcasts` is write-only.
5. **No test send.** The first time you see your formatting is when subscribers do.

Resend's **batch endpoint** (`resend.batch.send`, ≤100 messages per call) collapses
N requests into N/100 while keeping the messages separate — so it fixes #1 without
giving up the privacy or the per-recipient unsubscribe link from §4b.

---

## 8. Where to look first, by task

| Task | Start here |
|---|---|
| Change the capture form | `src/components/SubscribeForm.jsx` |
| Change what a broadcast looks like | `buildHtml` in `backend/routes/marketing.js` |
| Change a receipt / transactional email | `backend/lib/email.js` templates |
| Debug "it says sent but nothing arrived" | `RESEND_API_KEY` + `RESEND_FROM` domain verification (§6) |
| Debug a broken unsubscribe link | `backend/lib/unsub.js` — has `UNSUBSCRIBE_SECRET` changed? |
| Add a column to the subscriber list | migration `008`, then `listSubscribers()` **and** its `.select()` |

---

# 9. Exercises — do these yourself, no AI

Ordered easiest → hardest. Resist reaching for an assistant; the wrestling is the
point. Each one says how to **verify** your own work, so you don't need anything
to check you.

---

**1. Trace it cold** *(no code changes, ~20 min)*
On paper, list every file an email passes through, from a visitor typing their
address to a broadcast landing in their inbox. Then do the same for the
*unsubscribe* path.
*Verify:* you should land on roughly six files for the first and four for the
second, and be able to say for each whether it runs in the **browser** or on the
**server** — and why it has to be there. If you can't justify a file's side,
re-read §2.

---

**2. Broadcast history** *(small feature)*
`broadcasts` is written on every send, has a working RLS SELECT policy, and is
read by nothing. Surface the last few sends in `AudiencePanel.jsx` — subject,
date, recipient count.
*Hint:* copy the shape of `listSubscribers()` in `src/lib/subscribers.js`.
*Verify:* send a broadcast and the new row appears **without** a page refresh. If
it only shows up after a refresh, you've just learned something real about local
state — chase that.

---

**3. Filter subscribers by `source`** *(pattern reuse)*
Every subscriber records where they signed up. Add a filter to the subscriber list.
*Hint:* the status filter in `ServicesDashboard.jsx` is the exact same shape —
independent axis, scoped counts, honest empty state (note 158).
*Verify:* counts must reflect the *filtered* set, and the empty state must say
"nothing matches" rather than "no subscribers yet."

---

**4. Send yourself a test** *(real-world, high value)*
Add a "Send test to me" button that emails **only** the logged-in creator.
*Think about:* new endpoint, or a flag on the existing one? What should the
unsubscribe link do in a test send? Should a test write a `broadcasts` row?
There is no single right answer — but decide deliberately and write down why.
*Verify:* your inbox, then check `broadcasts` matches the decision you made.

---

**5. Soft-delete unsubscribes** *(data modelling, subtle)*
Unsubscribing **hard-deletes** the row. So an unsubscribed person can just
resubscribe through the form — and you have no record they ever opted out. Real
platforms keep a suppression record instead.
*Do:* add `unsubscribed_at TIMESTAMPTZ`, set it instead of deleting, and exclude
those rows from the broadcast query.
*Then think:* should resubscribing clear it? What does the count in
`AudiencePanel` mean now? Which existing queries did you have to change — and did
you find them **all**? (Grep `from('subscribers')`.)
*Verify:* unsubscribe, resubscribe with the same address, then broadcast. You
should not receive it.

---

**6. Fix the fan-out** *(the hard one)*
Make a 500-subscriber broadcast survive Resend's rate limit. Options: chunk into
batches with a delay, cap concurrency to ~2/sec, or move to `resend.batch.send`.
*Constraints you may not break:* recipients still cannot see each other, and each
still needs their own unsubscribe link (§4b).
*Then:* make `failed` useful — record *which* addresses failed, so a retry can
target just them.
*Verify:* you can't fake 500 real sends, so prove it differently — stub
`sendEmail` with a counter that logs timestamps, run 500 through it, and confirm
the rate never exceeds your cap. **Learning to test without the real dependency is
half of this exercise.**

---

**Stretch:** add a `List-Unsubscribe` header (RFC 8058) so Gmail shows its native
one-click unsubscribe. Small code change, real deliverability win, and it forces
you to understand §5 properly.
