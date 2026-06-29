// The six content-block types a Skill can hold (v3). Shared by the builder
// (BlockEditor / SkillBuilder) and, later, the buyer-side BlockRenderer.
export const BLOCK_TYPES = [
  { type: 'video',    icon: '🎬', label: 'Video',    hint: 'Embed a YouTube/Vimeo link' },
  { type: 'file',     icon: '📎', label: 'File',     hint: 'A downloadable asset' },
  { type: 'prompt',   icon: '✨', label: 'Prompt',   hint: 'A prompt / GPT config to copy' },
  { type: 'workflow', icon: '🔀', label: 'Workflow', hint: 'An n8n/Zapier/Make recipe' },
  { type: 'text',     icon: '📝', label: 'Guide',    hint: 'A written lesson or guide' },
  { type: 'coaching', icon: '📅', label: 'Coaching', hint: 'A booking link (Calendly…)' },
];

export const BLOCK_META = Object.fromEntries(BLOCK_TYPES.map(b => [b.type, b]));
