import { useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Heading2, Link2 } from 'lucide-react';
import Markdown from '@/components/Markdown';

// Markdown editor for product/lesson descriptions: toolbar inserts markdown
// syntax at the cursor, Write|Preview toggle renders via the safe <Markdown>.
// Plain-textarea underneath — the VALUE is always a markdown string.
export default function MarkdownEditor({ value = '', onChange, placeholder, rows = 10 }) {
  const [tab, setTab] = useState('write'); // 'write' | 'preview'
  const taRef = useRef(null);

  // Wrap the current selection (or insert at cursor) and restore focus/selection.
  function apply(before, after = '', block = false) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const sel = value.slice(start, end);
    let next, selStart, selEnd;
    if (block) {
      // Prefix each selected line (bullets, numbers, headings).
      const lines = (sel || 'List item').split('\n');
      const prefixed = lines.map((l, i) => (before === '1. ' ? `${i + 1}. ${l}` : `${before}${l}`)).join('\n');
      next = value.slice(0, start) + prefixed + value.slice(end);
      selStart = start; selEnd = start + prefixed.length;
    } else {
      const inner = sel || 'text';
      next = value.slice(0, start) + before + inner + after + value.slice(end);
      selStart = start + before.length; selEnd = start + before.length + inner.length;
    }
    onChange(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(selStart, selEnd); });
  }

  const tools = [
    { icon: Bold, label: 'Bold', run: () => apply('**', '**') },
    { icon: Italic, label: 'Italic', run: () => apply('*', '*') },
    { icon: Heading2, label: 'Heading', run: () => apply('## ', '', true) },
    { icon: List, label: 'Bullet list', run: () => apply('- ', '', true) },
    { icon: ListOrdered, label: 'Numbered list', run: () => apply('1. ', '', true) },
    { icon: Link2, label: 'Link', run: () => apply('[', '](https://)') },
  ];

  return (
    <div className="mde">
      <div className="mde-bar">
        <div className="mde-tools">
          {tools.map(t => (
            <button key={t.label} type="button" className="mde-tool" title={t.label}
              onMouseDown={e => e.preventDefault() /* keep textarea selection */}
              onClick={t.run} disabled={tab === 'preview'}>
              <t.icon size={15} />
            </button>
          ))}
        </div>
        <div className="mde-tabs">
          <button type="button" className={`mde-tab${tab === 'write' ? ' on' : ''}`} onClick={() => setTab('write')}>Write</button>
          <button type="button" className={`mde-tab${tab === 'preview' ? ' on' : ''}`} onClick={() => setTab('preview')}>Preview</button>
        </div>
      </div>

      {tab === 'write' ? (
        <textarea
          ref={taRef}
          className="mde-ta"
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <div className="mde-preview">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="mde-empty">Nothing to preview yet.</p>}
        </div>
      )}

      <style>{`
        .mde { border:1.5px solid var(--border-strong, var(--border)); border-radius:var(--r, 10px); background:var(--surface); overflow:hidden; }
        .mde:focus-within { border-color:var(--accent, var(--primary)); }
        .mde-bar { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px; border-bottom:1px solid var(--border); background:var(--surface-alt, transparent); }
        .mde-tools { display:flex; gap:2px; }
        .mde-tool { width:30px; height:28px; min-width:0; padding:0; display:flex; align-items:center; justify-content:center; border:none; border-radius:7px; background:none; color:var(--text-secondary); cursor:pointer; }
        .mde-tool:hover:not(:disabled) { background:color-mix(in srgb, var(--text) 8%, transparent); color:var(--text); }
        .mde-tool:disabled { opacity:.35; cursor:default; }
        .mde-tabs { display:flex; gap:2px; }
        .mde-tab { min-width:0; padding:4px 12px; border:none; border-radius:7px; background:none; font-size:12.5px; font-weight:700; color:var(--text-muted); cursor:pointer; }
        .mde-tab.on { background:color-mix(in srgb, var(--accent, var(--primary)) 14%, transparent); color:var(--text); }
        .mde-ta { display:block; width:100%; border:none; outline:none; resize:vertical; padding:12px 14px; font:inherit; font-size:14px; line-height:1.6; background:transparent; color:var(--text); min-height:120px; box-shadow:none; }
        .mde-ta:focus { box-shadow:none; }
        .mde-preview { padding:12px 14px; font-size:14px; min-height:120px; text-align:left; }
        .mde-empty { color:var(--text-muted); font-size:13px; margin:0; }
      `}</style>
    </div>
  );
}
