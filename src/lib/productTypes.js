// ── Product types (the Stan-style catalog of what a creator can sell) ─────────
// Single source of truth shared by the Add-product page (/build/new), the
// Services dashboard (/services), and the builder. `id` matches the skills.kind
// enum (migration 011_service_kinds.sql). `built` = has a real builder +
// checkout path today; unbuilt kinds can be picked but route to a "coming soon".
//
// Icons are lucide-react components — import and render as <Icon size={n} />.
import {
  FileText, GraduationCap, CalendarClock, Repeat, Video, Magnet, Boxes,
} from 'lucide-react';

export const PRODUCT_TYPES = [
  { id: 'digital',    label: 'Digital product', icon: FileText,      blurb: 'Sell a downloadable file, PDF, template, or preset.',   built: true  },
  { id: 'course',     label: 'Online course',   icon: GraduationCap, blurb: 'Sections & lessons with progress tracking.',            built: true  },
  { id: 'coaching',   label: '1:1 coaching',    icon: CalendarClock, blurb: 'Bookable call slots synced to your availability.',     built: true  },
  { id: 'membership', label: 'Membership',      icon: Repeat,        blurb: 'Recurring subscription for ongoing access.',           built: true },
  { id: 'webinar',    label: 'Webinar',         icon: Video,         blurb: 'Live or evergreen ticketed online event.',             built: true  },
  { id: 'lead',       label: 'Lead magnet',     icon: Magnet,        blurb: 'Free freebie that captures emails to your list.',       built: true },
  { id: 'bundle',     label: 'Bundle',          icon: Boxes,         blurb: 'Package several products together at one price.',       built: false },
];

export const TYPE_BY_ID = Object.fromEntries(PRODUCT_TYPES.map(t => [t.id, t]));
