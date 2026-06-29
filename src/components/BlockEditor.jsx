import { useState } from 'react';
import { uploadBlockFile } from '@/lib/storage';
import { BLOCK_META } from '@/lib/blockTypes';

// ── Per-type content-block editor (v3 Skill builder) ────────────────────────
// Edits ONE content_block. The parent (SkillBuilder) owns the blocks array and
// persistence; this component calls onPatch(patch) with column changes and
// onRemove()/onMove(dir) for list ops. NOTE: named BlockEditor (not Block*) to
// stay clear of BlockButton.jsx / routes/blocks.js, which mean user-blocking.

export default function BlockEditor({ block, index, total, creatorId, skillId, onPatch, onRemove, onMove }) {
  const meta = BLOCK_META[block.type] ?? { icon: '•', label: block.type };
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadErr, setUploadErr] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(''); setUploading(true);
    try {
      const { key, name } = await uploadBlockFile(creatorId, skillId, file);
      setUploadName(name);
      // Stash the display name in body_text so the consume view can label it.
      onPatch({ file_key: key, body_text: name });
    } catch (err) {
      setUploadErr(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // workflow can be text- or file-based; infer current mode from what's set.
  const workflowMode = block.file_key ? 'file' : 'text';

  return (
    <div className="be-card">
      <div className="be-head">
        <span className="be-type"><span className="be-icon">{meta.icon}</span>{meta.label}</span>
        <div className="be-actions">
          <button className="be-iconbtn" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
          <button className="be-iconbtn" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">↓</button>
          <button className="be-iconbtn be-del" onClick={onRemove} aria-label="Delete block">✕</button>
        </div>
      </div>

      <input
        className="be-title"
        value={block.title ?? ''}
        onChange={e => onPatch({ title: e.target.value })}
        placeholder={`${meta.label} title (e.g. "${titlePlaceholder(block.type)}")`}
      />

      {/* ── Video: an embed URL ── */}
      {block.type === 'video' && (
        <input
          className="be-field"
          value={block.external_url ?? ''}
          onChange={e => onPatch({ external_url: e.target.value })}
          placeholder="https://youtube.com/watch?v=… or vimeo.com/…"
        />
      )}

      {/* ── Coaching: external link OR native booking ── */}
      {block.type === 'coaching' && (() => {
        const native = !block.external_url; // native unless a link is set
        return (
          <div className="be-workflow">
            <div className="be-segmented">
              <button className={!native ? 'on' : ''}
                onClick={() => onPatch({ booking_minutes: null, external_url: block.external_url || '' })}>Booking link</button>
              <button className={native ? 'on' : ''}
                onClick={() => onPatch({ external_url: '', booking_minutes: block.booking_minutes || 30 })}>Native booking</button>
            </div>
            {native ? (
              <label className="be-native">
                Session length:&nbsp;
                <select value={block.booking_minutes || 30} onChange={e => onPatch({ booking_minutes: Number(e.target.value) })}>
                  {[15, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
                <span className="be-hint">Buyers pick a time from your availability (set it on the Dashboard).</span>
              </label>
            ) : (
              <input className="be-field" value={block.external_url ?? ''}
                onChange={e => onPatch({ external_url: e.target.value })}
                placeholder="https://calendly.com/your-link" />
            )}
          </div>
        );
      })()}

      {/* ── Prompt / Guide: a text body ── */}
      {(block.type === 'prompt' || block.type === 'text') && (
        <textarea
          className="be-field be-textarea"
          value={block.body_text ?? ''}
          onChange={e => onPatch({ body_text: e.target.value })}
          rows={block.type === 'prompt' ? 5 : 7}
          placeholder={block.type === 'prompt'
            ? 'Paste the prompt / system config buyers can copy…'
            : 'Write your lesson or guide…'}
        />
      )}

      {/* ── File: upload to the private bucket ── */}
      {block.type === 'file' && (
        <FileField uploading={uploading} fileKey={block.file_key} name={uploadName || block.body_text}
          err={uploadErr} onFile={handleFile} />
      )}

      {/* ── Workflow: text OR file ── */}
      {block.type === 'workflow' && (
        <div className="be-workflow">
          <div className="be-segmented">
            <button className={workflowMode === 'text' ? 'on' : ''}
              onClick={() => onPatch({ file_key: null })}>Paste recipe</button>
            <button className={workflowMode === 'file' ? 'on' : ''}
              onClick={() => onPatch({ body_text: '' })}>Upload file</button>
          </div>
          {workflowMode === 'text' ? (
            <textarea className="be-field be-textarea" rows={5}
              value={block.body_text ?? ''}
              onChange={e => onPatch({ body_text: e.target.value })}
              placeholder="Paste the n8n/Zapier/Make JSON or step-by-step recipe…" />
          ) : (
            <FileField uploading={uploading} fileKey={block.file_key} name={uploadName || block.body_text}
              err={uploadErr} onFile={handleFile} />
          )}
        </div>
      )}

      <style>{`
        .be-card { border:1px solid var(--border); border-radius:var(--r); background:var(--surface); padding:14px; margin-bottom:12px; box-shadow:var(--shadow-sm); }
        .be-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .be-type { font-weight:700; font-size:14px; color:var(--text); display:flex; align-items:center; gap:7px; }
        .be-icon { font-size:18px; }
        .be-actions { display:flex; gap:4px; }
        .be-iconbtn { width:30px; height:30px; border-radius:8px; border:1px solid var(--border-strong); background:var(--surface); color:var(--text-secondary); font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .be-iconbtn:hover:not(:disabled) { background:var(--surface-alt); }
        .be-iconbtn:disabled { opacity:.35; cursor:default; }
        .be-del:hover { background:var(--accent-light); color:var(--accent); border-color:var(--accent-mid); }
        .be-title { width:100%; font-weight:600; margin-bottom:8px; }
        .be-field { width:100%; }
        .be-textarea { resize:vertical; font-family:inherit; }
        .be-workflow { display:flex; flex-direction:column; gap:8px; }
        .be-segmented { display:flex; gap:0; border:1px solid var(--border-strong); border-radius:var(--r-full); overflow:hidden; width:fit-content; }
        .be-segmented button { border:none; background:var(--surface); padding:6px 16px; font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; }
        .be-segmented button.on { background:var(--accent); color:#fff; }
        .be-file { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .be-file-label { padding:8px 14px; border:1px dashed var(--border-strong); border-radius:var(--r); background:var(--surface-alt); cursor:pointer; font-size:14px; font-weight:600; color:var(--text-secondary); }
        .be-file-label:hover { border-color:var(--accent-mid); }
        .be-file-name { font-size:13px; color:var(--green); font-weight:600; }
        .be-file-err { font-size:13px; color:var(--accent); }
        .be-native { display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-size:14px; font-weight:600; }
        .be-native select { padding:5px 8px; }
        .be-hint { flex-basis:100%; font-weight:400; font-size:12px; color:var(--text-muted); margin-top:4px; }
      `}</style>
    </div>
  );
}

function FileField({ uploading, fileKey, name, err, onFile }) {
  return (
    <div className="be-file">
      <label className="be-file-label">
        {uploading ? 'Uploading…' : fileKey ? 'Replace file' : 'Choose file'}
        <input type="file" hidden onChange={onFile} disabled={uploading} />
      </label>
      {fileKey && !uploading && <span className="be-file-name">✓ {name || 'File attached'}</span>}
      {err && <span className="be-file-err">{err}</span>}
    </div>
  );
}

function titlePlaceholder(type) {
  switch (type) {
    case 'video': return 'Lesson 1: Setup';
    case 'file': return 'Starter template';
    case 'prompt': return 'My system prompt';
    case 'workflow': return 'Lead-gen automation';
    case 'text': return 'Read me first';
    case 'coaching': return 'Book a 1:1 call';
    default: return 'Title';
  }
}
