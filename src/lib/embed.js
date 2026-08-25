// Turn a video URL into something embeddable.
//
// `describeEmbed` is the full answer — the player URL AND its shape, because a
// TikTok is 9:16 and a YouTube is 16:9, and a caller that only gets a src has
// to guess. Guessing wrong letterboxes a vertical video into a wide black box,
// which is the single most common way an embedded TikTok looks broken.
//
// `toEmbed` stays as it was (src or null) so existing callers are untouched.

/** { src, kind, vertical } or null if it is not a recognised video link. */
export function describeEmbed(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    // YouTube — watch, short link, and Shorts. Shorts are VERTICAL, and they
    // are what most creators actually paste, so treating them as 16:9 would
    // get the common case wrong.
    if (host.endsWith('youtube.com')) {
      const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
      if (shorts) return { src: `https://www.youtube.com/embed/${shorts[1]}`, kind: 'youtube', vertical: true };
      const embed = u.pathname.match(/^\/embed\/([\w-]+)/);
      if (embed) return { src: `https://www.youtube.com/embed/${embed[1]}`, kind: 'youtube', vertical: false };
      const id = u.searchParams.get('v');
      if (id) return { src: `https://www.youtube.com/embed/${id}`, kind: 'youtube', vertical: false };
    }
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '');
      if (id) return { src: `https://www.youtube.com/embed/${id}`, kind: 'youtube', vertical: false };
    }

    if (host.endsWith('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (/^\d+$/.test(id || '')) return { src: `https://player.vimeo.com/video/${id}`, kind: 'vimeo', vertical: false };
    }

    // TikTok — https://www.tiktok.com/@someone/video/123456789
    // The numeric id is the last path segment; the handle in front of it is
    // decorative and changes when someone renames, so it is not used.
    if (host.endsWith('tiktok.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (/^\d{6,}$/.test(id || '')) {
        return { src: `https://www.tiktok.com/embed/v2/${id}`, kind: 'tiktok', vertical: true };
      }
    }
  } catch { /* not a URL — fall through */ }
  return null;
}

/** Player URL only, or null. Kept for callers that predate describeEmbed. */
export function toEmbed(url) {
  return describeEmbed(url)?.src ?? null;
}
