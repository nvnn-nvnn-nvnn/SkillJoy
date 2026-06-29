// ── SEO / social meta (v3, Phase 12) ────────────────────────────────────────
// React 19 hoists <title>/<meta> rendered anywhere into <head>, so we just
// render them. NOTE: this helps crawlers that execute JS (e.g. Google). Most
// social-card scrapers (iMessage, some of Facebook/X) do NOT run JS — fully
// correct share cards need server-side/prerendered meta (a serverless meta
// injector on the /@username + sales routes). Tracked as a follow-up.
export default function Seo({ title, description, image, url, type = 'website' }) {
  return (
    <>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="SkillJoy" />
      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
    </>
  );
}
