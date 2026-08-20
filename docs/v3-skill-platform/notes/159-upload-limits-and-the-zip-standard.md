# 159 — Upload limits + the ZIP standard for large digital products

Date: 2026-08-20

Storage is billed by the gigabyte and every authenticated creator could upload
files of unbounded size and arbitrary type. This closes that, and establishes
"large digital products ship as a .zip" as a platform rule.

Written as a walkthrough, because the *shape* of this fix — where each layer of
enforcement lives and why — is reusable for any limit you add later.

---

## Step 0 — What the audit actually found

Six upload paths. **One** had a limit:

| Upload | Call site | Guard before |
|---|---|---|
| Digital product file | `BlockEditor.jsx` | `MAX_FILE_MB = 50`, local const |
| Skill cover image | `SkillBuilder.jsx` | ❌ none |
| Storefront banner | `StorefrontEditor.jsx` | ❌ none |
| Background image | `StorefrontEditor.jsx` | ❌ none |
| Background video | `StorefrontEditor.jsx` | ❌ none |
| Profile picture | `StorefrontEditor.jsx` | ❌ none |
| Custom cursor | `StorefrontEditor.jsx` | ❌ none |
| Site music track | `StorefrontEditor.jsx` | ❌ none |

And the deeper problem — `migrations/002_storage_buckets.sql` created both
buckets with **no `file_size_limit` and no `allowed_mime_types`**. So even the
one guard that existed was decoration: it lived in the browser, and the browser
is not where you enforce anything.

> **Lesson 1 — a client-side limit is a courtesy, not a control.**
> The SPA talks to Supabase storage directly with the user's anon key. Anyone can
> open devtools and call `supabase.storage.from('skill-files').upload(...)` with
> a 4 GB file. The `if (file.size > …)` in React never runs. If the bucket has no
> limit, there is no limit.

---

## Step 1 — Decide the numbers before writing code

Two thresholds, not one, for digital products:

- **Hard ceiling — 200 MB.** Above this, reject outright.
- **Archive threshold — 25 MB.** Above this, the file must be a `.zip`.

Plus per-asset limits: cover 5 MB, banner/bg image 8 MB, avatar 5 MB, cursor
1 MB, audio 15 MB, background video 50 MB.

**Why two thresholds and not just a cap?** A cap answers "how much," the archive
rule answers "what shape." They solve different problems:

1. **Cost/sprawl.** A "product" that is 40 loose files is 40 storage objects to
   track, sign, and clean up. An archive is one.
2. **Buyer experience.** One download beats hunting through N links.
3. **Integrity.** Folder structure and filenames survive the round trip.

**Why not require zip for *everything*?** Below the threshold, forcing a creator
to zip a single 2 MB PDF is friction with no payoff — the buyer then has to
unzip to get one file. The rule earns its cost only once the upload is big enough
to be worth packaging.

> **Lesson 2 — a good limit states its *reason*.** "Max 200 MB" invites
> argument. "Over 25 MB must be a zip, because a product is one download"
> teaches the creator the model.

---

## Step 2 — One source of truth: `src/lib/uploadLimits.js` (new)

Every number and the validator live in one module. The old code had `50` as a
local const in one component and nothing anywhere else — which is exactly how
six paths ended up inconsistent.

```js
export const ZIP_REQUIRED_ABOVE = 25 * MB;
export const LIMITS = {
  digital: { max: 200 * MB, label: 'Product file', accept: undefined },
  cover:   { max: 5   * MB, label: 'Cover image',  accept: 'image/' },
  …
};
export function validateUpload(kind, file) → { ok } | { ok: false, error }
```

Three deliberate choices inside:

**a) Returns an error string; does not throw.** Every caller wants to *render*
the message, not catch an exception. Throwing would force six try/catch blocks
that all do the same thing.

**b) Checks type before size.** If someone picks a `.mov` for their avatar,
"must be an image file" is more useful than "too big." Order your validations by
which mistake the message best explains.

**c) The archive check uses the file EXTENSION, not the MIME type.** This one is
a real trap:

> **Lesson 3 — you cannot trust a browser's MIME type for archives.** Depending
> on OS and how the zip was created, `file.type` comes back as `application/zip`,
> `application/x-zip-compressed`, or an empty-ish `application/octet-stream`. An
> `=== 'application/zip'` check rejects perfectly valid zips on some machines.
> The `.zip` extension is the reliable signal here.

---

## Step 3 — The enforcement layer: `migrations/027_upload_limits.sql` (new)

This is the part that actually stops bytes:

```sql
UPDATE storage.buckets SET file_size_limit = 209715200 WHERE id = 'skill-files';
UPDATE storage.buckets SET file_size_limit = 52428800,
       allowed_mime_types = ARRAY[…] WHERE id = 'skill-covers';
```

**⚠️ Must be run in Supabase before this matters.** Until then, only the browser
check exists.

Three things worth understanding:

**a) MIME allowlist on the public bucket only.** `skill-covers` is public and
its contents render in other people's browsers, so restricting types stops a
creator parking an executable on a public URL. `skill-files` is private and
served by signed URL, and a digital product is legitimately *any* type — zip,
psd, blend, epub. An allowlist there would break real sellers for little gain.

**b) The bucket cannot enforce the zip rule.** Postgres sees the object at
`INSERT` time but the archive requirement is about a filename extension paired
with a size — the size limit and the name check don't compose into one bucket
setting. So the zip rule is **client-side only**, and that is a known,
deliberate gap: a determined creator can bypass it. They would only be making
their own product worse, which is why it is acceptable here. *Say out loud which
of your rules are load-bearing and which are guidance.*

**c) One bucket, five purposes.** `skill-covers` holds covers, banners,
background images, audio, and background video — limits from 1 MB to 50 MB. A
bucket limit is per-bucket, so it can only enforce the **loosest** (50 MB). The
tighter per-kind limits necessarily live in `uploadLimits.js`.

> **Lesson 4 — a shared bucket can only enforce its loosest tenant.** If a limit
> genuinely must be unbypassable, that asset needs its own bucket. Noted in the
> migration as the real fix if it ever matters; not done here because it would
> mean migrating existing object paths.

---

## Step 4 — Wire all six call sites

`BlockEditor` lost its local const and calls `validateUpload('digital', file)`.
`SkillBuilder` gained a check it never had.

The storefront's four uploads already funnelled through one helper, so the gate
went in **once**:

```js
async function uploadTo(file, setBusy, apply, uploader = uploadBanner, kind = 'banner') {
  const check = validateUpload(kind, file);
  if (!check.ok) { setErr(check.error); return; }
  …
}
```

Each caller now names its rule: `'banner'`, `'bgImage'`, `'cursor'`, `'avatar'`,
`'bgVideo'`. Audio has its own path (it *appends* to a playlist rather than
replacing a value), so it needed the check applied separately — worth noticing,
because "they all go through one helper" was true for four of five.

Every rejection also does `e.target.value = ''`. Without it the `<input type=file>`
keeps the rejected file, and picking the *same* file again fires no `change`
event — so the user's second attempt appears to do nothing.

> **Lesson 5 — reset the file input after rejecting.** This is the single most
> common file-upload bug, and it looks like a frozen UI rather than a bug.

---

## Step 5 — Tell them the rule BEFORE they hit it

The dropzone hint now reads the constants rather than hardcoding prose:

```jsx
Up to {formatBytes(LIMITS.digital.max)}; over {formatBytes(ZIP_REQUIRED_ABOVE)} must be a .zip
```

Also added to the background-video and audio fields.

> **Lesson 6 — a limit discovered by tripping it reads as a bug; stated up
> front it reads as a spec.** And deriving the copy from the constant means the
> text can never drift from the enforcement.

---

## What is NOT done

- **No server-side zip verification.** We check the extension, not the bytes. A
  file named `.zip` that isn't one would pass. Real verification means reading
  the magic number (`PK\x03\x04`) — worth doing only if it becomes a problem.
- **No total-storage-per-creator quota.** This caps a *single file*. A creator
  can still upload 200 unlimited 199 MB products. A per-account quota is the
  actual defence against the bill you're worried about, and it needs a
  `SUM(size)` per creator plus a check at upload time. **This is the logical
  next step.**
- **No cleanup of orphaned objects.** Deleting a skill does not delete its files.

## Action required
Run `docs/v3-skill-platform/migrations/027_upload_limits.sql` in Supabase. Until
then only the browser check exists. Verify with the `SELECT` at the bottom of the
migration; check the project-wide global upload limit too, since a bucket limit
above it silently does nothing.

## Files
- `src/lib/uploadLimits.js` (new) · `docs/v3-skill-platform/migrations/027_upload_limits.sql` (new)
- `src/components/BlockEditor.jsx` · `src/app-pages/SkillBuilder.jsx` · `src/app-pages/StorefrontEditor.jsx`
