# 182 — Link images, and the glow that didn't travel

Date: 2026-08-24
Migrations: none. **Storage note:** thumbnails go to the existing public
`skill-covers` bucket under `{creatorId}/link-thumbs/…`, so the folder-owner RLS
policy from `002_storage_buckets.sql` already covers them. No new bucket.

---

## 1 · Why the glow vanished

Nothing deleted it. The glow **didn't travel** when links changed renderer.

The old flat list (`.sf-linkbtn`) carried `box-shadow: 0 0 var(--sf-glow)`.
`LinkBlock` — the component that replaced it in note 177 — never had that rule.
So the moment your links moved into blocks, the Glow slider silently stopped
applying to them, while still working on products and socials.

Icons were worse: `--sf-icon-glow` had exactly **one** consumer, `.sf-social`.
Link-button icons and block arrows never responded to that slider at all.

Both fixed by pointing the new renderers at the same variables:

```css
.lkb-item  { box-shadow: 0 0 var(--sf-glow, 0px) …; }
.lkb-arrow { filter: drop-shadow(… var(--sf-icon-glow, 0px) …); }
```

> **Transferable:** when you replace a renderer, the *data* migration is the
> part everyone checks. The **presentation contract** — which CSS variables the
> old markup consumed — is the part that silently doesn't come along. Before
> deleting old markup, grep its class for every `var(--…)` it read and confirm
> the replacement reads them too.

This is the third variant of the same bug this month (note 181 §3: page shape
never reached blocks; note 181 §4: the preview read the wrong opacity). Same
shape every time: **a control exists, and nothing downstream is listening.**

---

## 2 · Two separate reasons links showed no image

**a) Classic style hid every thumbnail.**

```css
.lkb-classic .lkb-thumb { display: none; }   /* ← Classic is the DEFAULT */
```

This was correct *when written*: a link with no image still rendered a grey
placeholder square, and hiding it kept Classic clean. Then (note 180 §7) the
placeholder was removed — the thumb now only exists when there IS an image. The
rule stopped hiding a placeholder and started throwing away real content.

Classic now gets a 30px circular thumb, so it stays visually distinct from Card
without discarding the image.

> **Transferable:** a `display:none` written to hide a *placeholder* becomes a
> bug the moment the placeholder goes away. When you delete a fallback, grep for
> the CSS that was compensating for it.

**b) The legacy flat list ignored `cover_url` entirely.**

Links with no `block_id` still render through `.sf-linkbtn`, which drew a
generic chain icon and never looked at `cover_url`. If migration 032's backfill
hasn't run on your account, *every* link takes that path — so "links don't show
images" was completely true, and completely invisible in the block code.

---

## 3 · Making images easy to add

The old control was a text input labelled "Image URL". That asks for the one
thing almost nobody has. People have a **file**.

`ImagePick` accepts all four routes:

| | how |
|---|---|
| Click | the tile opens a file picker |
| Drop | drag from the desktop onto the tile |
| Paste | Ctrl+V an image **or** a URL, both handled |
| Type | the URL box is still there, demoted |

The tile *is* the control — it's the preview, the drop zone, and the button.
Uploads go to the public covers bucket and hand back a URL, so **everything
downstream still only sees `cover_url`**. The storage shape didn't change; only
the ways a value can get into it.

Guardrails worth copying: reject non-images and >5MB *before* uploading, so the
failure is instant and self-explaining rather than a 413 after a slow wait.

```js
const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
if (item) { e.preventDefault(); take(item.getAsFile()); return; }
const text = e.clipboardData?.getData('text')?.trim();
if (text && /^https?:\/\//i.test(text)) { e.preventDefault(); onChange(text); }
```

Paste is two different events wearing one keystroke — a file on the clipboard
and a string on the clipboard. Handling only the second is why most "paste an
image" boxes feel broken.

---

## Files
`src/lib/storage.js` — `uploadLinkThumb`
`src/components/LinkBlockEditor.jsx` — `ImagePick`, used for link thumbs and
collapsed-block thumbs; dead `.lb-thumb*` CSS removed
`src/components/LinkBlock.jsx` — Classic thumb restored, `--sf-glow` +
`--sf-icon-glow` wired
`src/app-pages/Storefront.jsx` — legacy list shows `cover_url`, icon glow
`src/app-pages/StorefrontEditor.jsx` — preview mirrors both

---

## Exercises

1. **Audit the presentation contract.** Grep `.sf-linkbtn`'s CSS for every
   `var(--…)` it reads. Now do the same for `.lkb-item`. List the variables the
   old one consumed that the new one still doesn't — those are the next three
   bugs of this exact type.

2. **Reproduce the Classic bug.** Put `display:none` back on
   `.lkb-classic .lkb-thumb`. Add a link with an image. Note that *nothing
   errors and nothing logs* — then write down how you'd have found this without
   someone reporting it.

3. **Break paste on purpose.** Delete the `clipboardData.items` branch from
   `onPaste`, leaving only the URL branch. Copy an image from a screenshot tool
   and paste it into the tile. What happens, and why is "nothing" the worst
   possible outcome for a user?

4. **Move the size limit.** The 5MB check is client-side, so it is a *courtesy*,
   not a guarantee. Where is the real enforcement, and what does a user see
   today if they bypass the client check? Is that acceptable?

5. **Generalise `ImagePick`.** It currently hardcodes `uploadLinkThumb`. Change
   it to take an `upload` function as a prop and use it for the storefront
   banner too. What breaks first, and what does that tell you about where the
   component's boundary actually is?
