// ── Placeholder / demo storefronts ─────────────────────────────────────────
// Hardcoded example stores so the landing-page testimonial links (/@handle)
// resolve to real, themed, browsable pages WITHOUT seeding the database.
// Storefront.jsx checks getDemoStore(username) before hitting Supabase.
//
// Each entry mirrors the real shapes:
//   profile  → { id, username, full_name, bio, avatar_url, storefront_theme }
//   skills   → [{ id, title, outcome, price_cents, pricing_type, cover_url, group_label }]
//   links    → [{ id, label, url, is_affiliate }]
// Themes lean into the customization angle so each demo looks distinct.

// Master switch: demo storefronts are NOT browsable yet. Flip to true to make
// /@mayamakes etc. resolve. While false, getDemoStore() always returns null,
// so those handles fall through to the normal Supabase lookup (→ not found).
const DEMO_STORES_ENABLED = false;

const store = (profile, skills = [], links = []) => ({ profile, skills, links });

export const DEMO_STORES = {
  mayamakes: store(
    {
      id: 'demo-maya', username: 'mayamakes', full_name: 'Maya Rivera', avatar_url: '',
      bio: 'Design templates & brand kits for people who hate designing. Notion, Canva, Figma.',
      storefront_theme: {
        accent: '#7A5CFF', mode: 'light', bg: 'gradient', bg_color: '#F6F2FF', bg_color2: '#EAF6FF',
        button_style: 'rounded', product_glow: 'soft', name_fx: 'gradient', profile_fx: 'glow',
        socials: [
          { type: 'instagram', url: 'https://instagram.com' },
          { type: 'tiktok', url: 'https://tiktok.com' },
          { type: 'website', url: 'https://example.com' },
        ],
      },
    },
    [
      { id: 'demo-maya-1', title: 'The Everything Brand Kit', outcome: 'Logos, color, type & social templates in one editable Figma file.', price_cents: 3400, pricing_type: 'one_time', group_label: 'Templates' },
      { id: 'demo-maya-2', title: 'Notion Client Portal', outcome: 'The dashboard I use to run every client project.', price_cents: 1900, pricing_type: 'one_time', group_label: 'Templates' },
      { id: 'demo-maya-3', title: '50 Canva Carousel Layouts', outcome: 'Drag your photos in, post, done.', price_cents: 1200, pricing_type: 'one_time', group_label: 'Templates' },
      { id: 'demo-maya-4', title: 'Portfolio Teardown (1:1)', outcome: '45 min, I rip your portfolio apart and rebuild it live.', price_cents: 8500, pricing_type: 'one_time', group_label: 'Work with me' },
    ],
    [{ id: 'demo-maya-l1', label: 'Free starter palette pack', url: 'https://example.com', is_affiliate: false }],
  ),

  drebeats: store(
    {
      id: 'demo-dre', username: 'drebeats', full_name: 'Dre Coleman', avatar_url: '',
      bio: 'Sample packs, drum kits & mixing. If it knocks, it probably started here.',
      storefront_theme: {
        accent: '#00B3FF', mode: 'dark', bg: 'gradient', bg_color: '#0B0F1A', bg_color2: '#14243B',
        button_style: 'sharp', product_glow: 'strong', name_fx: 'shimmer', overlay: 'vhs',
        product_blur: 8, product_opacity: 70, card_blur: 10, card_opacity: 70, mono_icons: true,
        socials: [
          { type: 'youtube', url: 'https://youtube.com' },
          { type: 'instagram', url: 'https://instagram.com' },
          { type: 'x', url: 'https://x.com' },
        ],
      },
    },
    [
      { id: 'demo-dre-1', title: 'ANALOG SOUL Vol.1', outcome: '120 analog-warm samples, royalty-free.', price_cents: 2400, pricing_type: 'one_time', group_label: 'Packs' },
      { id: 'demo-dre-2', title: '808 & Drum Kit', outcome: '60 drums, 24 808s, all tuned & labeled.', price_cents: 1800, pricing_type: 'one_time', group_label: 'Packs' },
      { id: 'demo-dre-3', title: 'Mixing Masterclass', outcome: '3 hours, from raw stems to a finished mix.', price_cents: 5900, pricing_type: 'one_time', group_label: 'Learn' },
      { id: 'demo-dre-4', title: '1:1 Mix Review', outcome: 'Send me your track, I break it down on camera.', price_cents: 9000, pricing_type: 'one_time', group_label: 'Learn' },
      { id: 'demo-dre-5', title: 'The Vault', outcome: 'Every new pack + unreleased loops, monthly.', price_cents: 1500, pricing_type: 'membership', group_label: 'Learn' },
    ],
  ),

  priyacoaches: store(
    {
      id: 'demo-priya', username: 'priyacoaches', full_name: 'Priya Nair', avatar_url: '',
      bio: 'Career & confidence coaching for people switching into tech. Ex-recruiter.',
      storefront_theme: {
        accent: '#FF6B9D', mode: 'light', bg: 'solid', bg_color: '#FFF7FA',
        button_style: 'pill', product_glow: 'soft', avatar_size: 108, bio_weight: 500,
        socials: [
          { type: 'instagram', url: 'https://instagram.com' },
          { type: 'website', url: 'https://example.com' },
        ],
      },
    },
    [
      { id: 'demo-priya-1', title: 'Free 15-min fit call', outcome: 'See if coaching is right for you. No pitch.', price_cents: 0, pricing_type: 'one_time', group_label: 'Start here' },
      { id: 'demo-priya-2', title: 'Single Coaching Session', outcome: '60 min, one problem, walk away with a plan.', price_cents: 12000, pricing_type: 'one_time', group_label: 'Coaching' },
      { id: 'demo-priya-3', title: '6-Week Career Switch', outcome: 'Weekly calls + Slack access until you land it.', price_cents: 65000, pricing_type: 'one_time', group_label: 'Coaching' },
      { id: 'demo-priya-4', title: 'Resume & LinkedIn Rewrite', outcome: 'I rewrite both. Recruiters will actually reply.', price_cents: 19000, pricing_type: 'one_time', group_label: 'Coaching' },
    ],
    [{ id: 'demo-priya-l1', label: 'My interview prep checklist (free)', url: 'https://example.com', is_affiliate: false }],
  ),

  leobuilds: store(
    {
      id: 'demo-leo', username: 'leobuilds', full_name: 'Leo Franklin', avatar_url: '',
      bio: 'Notion systems that run your business so you don’t have to.',
      storefront_theme: {
        accent: '#00CC99', mode: 'dark', bg: 'solid', bg_color: '#101418',
        button_style: 'sharp', product_glow: 'none', name_fx: 'none', layout: 'grid',
        socials: [
          { type: 'x', url: 'https://x.com' },
          { type: 'youtube', url: 'https://youtube.com' },
        ],
      },
    },
    [
      { id: 'demo-leo-1', title: 'Second Brain OS', outcome: 'Notes, tasks & projects, finally in one place.', price_cents: 4900, pricing_type: 'one_time', group_label: 'Systems' },
      { id: 'demo-leo-2', title: 'Freelance Command Center', outcome: 'Clients, invoices & pipeline in one dashboard.', price_cents: 3900, pricing_type: 'one_time', group_label: 'Systems' },
      { id: 'demo-leo-3', title: 'Content Engine', outcome: 'Ideas to published, on a repeatable pipeline.', price_cents: 2900, pricing_type: 'one_time', group_label: 'Systems' },
      { id: 'demo-leo-4', title: 'Template Club', outcome: 'A new system every month + all past drops.', price_cents: 900, pricing_type: 'membership', group_label: 'Systems' },
    ],
  ),

  sanawrites: store(
    {
      id: 'demo-sana', username: 'sanawrites', full_name: 'Sana Malik', avatar_url: '',
      bio: 'Guides & mini-courses on writing that people actually finish reading.',
      storefront_theme: {
        accent: '#FF8C00', mode: 'light', bg: 'gradient', bg_color: '#FFF9F0', bg_color2: '#FFF1E0',
        button_style: 'rounded', product_glow: 'soft', bio_size: 16, bio_weight: 500,
        socials: [
          { type: 'x', url: 'https://x.com' },
          { type: 'website', url: 'https://example.com' },
        ],
      },
    },
    [
      { id: 'demo-sana-1', title: 'Write Your First Newsletter', outcome: 'The free guide that grew my list to 12k.', price_cents: 0, pricing_type: 'one_time', group_label: 'Free' },
      { id: 'demo-sana-2', title: 'The Non-Boring Writing Course', outcome: '6 lessons, real edits, no fluff.', price_cents: 4900, pricing_type: 'one_time', group_label: 'Courses' },
      { id: 'demo-sana-3', title: '100 Hooks Swipe File', outcome: 'Opening lines that stop the scroll.', price_cents: 1500, pricing_type: 'one_time', group_label: 'Courses' },
      { id: 'demo-sana-4', title: 'Monthly Writing Club', outcome: 'Prompts, feedback & a group that ships.', price_cents: 1200, pricing_type: 'membership', group_label: 'Courses' },
    ],
    [{ id: 'demo-sana-l1', label: 'Read my newsletter', url: 'https://example.com', is_affiliate: false }],
  ),

  theographs: store(
    {
      id: 'demo-theo', username: 'theographs', full_name: 'Theo Grant', avatar_url: '',
      bio: 'Presets & LUTs for moody, cinematic photos. Lightroom + Premiere.',
      storefront_theme: {
        accent: '#FFD400', mode: 'dark', bg: 'gradient', bg_color: '#141210', bg_color2: '#2A2416',
        button_style: 'rounded', product_glow: 'strong', mono_icons: true, layout: 'grid',
        card_opacity: 80, card_blur: 6,
        socials: [
          { type: 'instagram', url: 'https://instagram.com' },
          { type: 'youtube', url: 'https://youtube.com' },
        ],
      },
    },
    [
      { id: 'demo-theo-1', title: 'GOLDEN HOUR Preset Pack', outcome: '12 Lightroom presets for warm, filmic light.', price_cents: 2900, pricing_type: 'one_time', group_label: 'Presets' },
      { id: 'demo-theo-2', title: 'MOODY Cinematic LUTs', outcome: '8 LUTs for Premiere & DaVinci.', price_cents: 3400, pricing_type: 'one_time', group_label: 'LUTs' },
      { id: 'demo-theo-3', title: 'Mobile Preset Pack', outcome: 'One-tap edits for the free Lightroom app.', price_cents: 1400, pricing_type: 'one_time', group_label: 'Presets' },
      { id: 'demo-theo-4', title: 'Editing Fundamentals', outcome: 'How I color-grade, start to finish.', price_cents: 4500, pricing_type: 'one_time', group_label: 'Learn' },
    ],
  ),

  novacreates: store(
    {
      id: 'demo-nova', username: 'novacreates', full_name: 'Nova Reyes', avatar_url: '',
      bio: 'Sound design, sample packs & 1:1 mixing sessions.',
      storefront_theme: {
        accent: '#7A5CFF', mode: 'dark', bg: 'gradient', bg_color: '#0D0B1A', bg_color2: '#1A1630',
        button_style: 'pill', product_glow: 'strong', name_fx: 'shimmer', profile_fx: 'float',
        glow_intensity: 12, cursor_fx: 'sparkle',
        socials: [
          { type: 'youtube', url: 'https://youtube.com' },
          { type: 'instagram', url: 'https://instagram.com' },
          { type: 'x', url: 'https://x.com' },
        ],
      },
    },
    [
      { id: 'demo-nova-1', title: 'Analog Sample Pack', outcome: 'Warm, tape-saturated one-shots & loops.', price_cents: 2400, pricing_type: 'one_time', group_label: 'Packs' },
      { id: 'demo-nova-2', title: 'Mixing Masterclass', outcome: 'My full mixing chain, explained.', price_cents: 5900, pricing_type: 'one_time', group_label: 'Learn' },
      { id: 'demo-nova-3', title: '1:1 Mix Review', outcome: '30 min live feedback on your track.', price_cents: 9000, pricing_type: 'one_time', group_label: 'Learn' },
    ],
  ),
};

/** Return a deep-ish copy of a demo store by username, or null. Case-insensitive. */
export function getDemoStore(username) {
  if (!DEMO_STORES_ENABLED) return null;
  const key = String(username || '').trim().toLowerCase();
  const s = DEMO_STORES[key];
  if (!s) return null;
  return {
    profile: { ...s.profile },
    skills: s.skills.map(x => ({ ...x })),
    links: (s.links || []).map(x => ({ ...x })),
  };
}
