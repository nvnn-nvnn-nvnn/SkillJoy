import { useState } from 'react';
import { getBlockDownloadUrl } from '@/lib/purchases';
import { recordEvent } from '@/lib/analytics';
import { BLOCK_META } from '@/lib/blockTypes';
import BookingWidget from '@/components/BookingWidget';

// ── Buyer-side renderer for one content block (v3) ──────────────────────────
// Watch video / download file / copy prompt / read guide / book coaching.
// Fires a `block_open` analytics event on first interaction.

function toEmbed(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { /* fall through */ }
  return null;
}

export default function BlockRenderer({ block, skillId, creatorId, buyerId }) {
  const meta = BLOCK_META[block.type] ?? { icon: '•', label: block.type };
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [err, setErr] = useState('');
  const [opened, setOpened] = useState(false);

  function markOpen() {
    if (opened) return;
    setOpened(true);
    recordEvent('block_open', { skillId, creatorId, buyerId, blockId: block.id });
  }

  async function copy() {
    await navigator.clipboard.writeText(block.body_text || '');
    setCopied(true); markOpen();
    setTimeout(() => setCopied(false), 1500);
  }

  async function download() {
    setErr(''); setDownloading(true);
    try {
      const { url } = await getBlockDownloadUrl(block.id);
      markOpen();
      window.open(url, '_blank', 'noopener');
    } catch (e) { setErr(e.message); }
    finally { setDownloading(false); }
  }

  const embed = block.type === 'video' ? toEmbed(block.external_url) : null;

  return (
    <div className="br-card">
      <div className="br-head">
        <span className="br-icon">{meta.icon}</span>
        <span className="br-title">{block.title || meta.label}</span>
        <span className="br-type">{meta.label}</span>
      </div>

      {block.type === 'video' && (
        embed ? (
          <div className="br-video" onMouseDown={markOpen}>
            <iframe src={embed} title={block.title || 'Video'} allow="accelerated-download; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
        ) : block.external_url ? (
          <a className="btn btn-secondary" href={block.external_url} target="_blank" rel="noopener noreferrer" onClick={markOpen}>▶ Watch video</a>
        ) : <p className="br-muted">No video added.</p>
      )}

      {block.type === 'text' && (
        <div className="br-text" onMouseEnter={markOpen}>{block.body_text || <span className="br-muted">No content.</span>}</div>
      )}

      {block.type === 'prompt' && (
        <div className="br-prompt">
          <pre className="br-pre">{block.body_text}</pre>
          <button className="btn btn-secondary btn-sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
        </div>
      )}

      {block.type === 'workflow' && (
        block.file_key ? (
          <button className="btn btn-secondary" onClick={download} disabled={downloading}>{downloading ? 'Preparing…' : '⬇ Download workflow'}</button>
        ) : (
          <div className="br-prompt">
            <pre className="br-pre">{block.body_text}</pre>
            <button className="btn btn-secondary btn-sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
        )
      )}

      {block.type === 'file' && (
        <button className="btn btn-secondary" onClick={download} disabled={downloading}>{downloading ? 'Preparing…' : `⬇ Download${block.body_text ? ` ${block.body_text}` : ''}`}</button>
      )}

      {block.type === 'coaching' && (
        block.external_url
          ? <a className="btn btn-primary" href={block.external_url} target="_blank" rel="noopener noreferrer" onClick={markOpen}>📅 Book your call</a>
          : <BookingWidget block={block} skillId={skillId} creatorId={creatorId} buyerId={buyerId} />
      )}

      {err && <p className="br-err">{err}</p>}

      <style>{`
        .br-card { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:16px; margin-bottom:14px; box-shadow:var(--shadow-sm); }
        .br-head { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
        .br-icon { font-size:20px; }
        .br-title { font-weight:700; color:var(--text); flex:1; }
        .br-type { font-size:12px; color:var(--text-muted); }
        .br-muted { color:var(--text-muted); font-size:14px; }
        .br-video { aspect-ratio:16/9; border-radius:var(--r); overflow:hidden; background:#000; }
        .br-video iframe { width:100%; height:100%; border:0; display:block; }
        .br-text { white-space:pre-wrap; line-height:1.6; color:var(--text-secondary); }
        .br-prompt { display:flex; flex-direction:column; gap:10px; align-items:flex-start; }
        .br-pre { white-space:pre-wrap; word-break:break-word; background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--r); padding:12px; width:100%; font-family:ui-monospace,Menlo,monospace; font-size:13px; margin:0; }
        .br-err { color:var(--accent); font-size:13px; margin-top:8px; }
      `}</style>
    </div>
  );
}
