import { useState } from 'react';
import { UploadCloud, Link2, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadBlockFile } from '@/lib/storage';
import { validateUpload, ZIP_REQUIRED_ABOVE, LIMITS, formatBytes } from '@/lib/uploadLimits';
import { BLOCK_META } from '@/lib/blockTypes';
import GoogleCalendarConnect from '@/components/GoogleCalendarConnect';

// ── Per-type content-block editor (v3 Skill builder) ────────────────────────
// Edits ONE content_block. The parent (SkillBuilder) owns the blocks array and
// persistence; this component calls onPatch(patch) with column changes and
// onRemove()/onMove(dir) for list ops. NOTE: named BlockEditor (not Block*) to
// stay clear of BlockButton.jsx / routes/blocks.js, which mean user-blocking.

const isHttpUrl = (s) => /^https?:\/\/.+/i.test((s || '').trim());

// Coaching scheduling options.
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480]; // up to 480 min
const BUFFERS = [0, 5, 10, 15, 30];
const NOTICE_OPTS = [[0, 'No minimum'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours'], [720, '12 hours'], [1440, '1 day'], [2880, '2 days']];
const fmtDuration = (m) => m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)} hr ${m % 60} min`;

export default function BlockEditor({ block, index, total, creatorId, skillId, onPatch, onRemove, onMove }) {
  const meta = BLOCK_META[block.type] ?? { icon: '•', label: block.type };
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadErr, setUploadErr] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Shared policy (src/lib/uploadLimits.js) — size ceiling AND the
    // zip-required-above rule. Checked before upload so the creator gets an
    // instant, specific message instead of waiting out a doomed transfer.
    const check = validateUpload('digital', file);
    if (!check.ok) { setUploadErr(check.error); e.target.value = ''; return; }
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
              <>
                <div className="be-schedule">
                  <label className="be-sched-field">
                    <span className="be-sched-label">Session length</span>
                    <select value={block.booking_minutes || 30} onChange={e => onPatch({ booking_minutes: Number(e.target.value) })}>
                      {DURATIONS.map(m => <option key={m} value={m}>{fmtDuration(m)}</option>)}
                    </select>
                  </label>
                  <label className="be-sched-field">
                    <span className="be-sched-label">Buffer after</span>
                    <select value={block.buffer_minutes || 0} onChange={e => onPatch({ buffer_minutes: Number(e.target.value) })}>
                      {BUFFERS.map(m => <option key={m} value={m}>{m ? `${m} min` : 'None'}</option>)}
                    </select>
                  </label>
                  <label className="be-sched-field">
                    <span className="be-sched-label">Minimum notice</span>
                    <select value={block.min_notice_minutes || 0} onChange={e => onPatch({ min_notice_minutes: Number(e.target.value) })}>
                      {NOTICE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                </div>
                <span className="be-hint">Buyers pick a time from your weekly availability (set your hours + timezone on the Dashboard). Buffer adds a gap after each call; minimum notice blocks last-minute bookings.</span>

                {/* Where the call actually happens. A standing room link (Zoom
                    personal room, a permanent Meet link) rather than a
                    per-booking generated one — generating unique links needs
                    calendar WRITE access, which the Google integration
                    deliberately doesn't request. It's copied onto each booking
                    at booking time and lands in the confirmation email and the
                    .ics invite. */}
                <label className="be-sched-field be-meetfield">
                  <span className="be-sched-label">Meeting link</span>
                  <input className="be-field" value={block.meeting_url ?? ''}
                    onChange={e => onPatch({ meeting_url: e.target.value })}
                    placeholder="https://zoom.us/j/your-room or meet.google.com/…" />
                  <span className="be-hint">
                    {block.meeting_url?.trim()
                      ? 'Included in the confirmation email and calendar invite.'
                      : 'Optional, but without it buyers have no idea where to show up.'}
                  </span>
                </label>

                <GoogleCalendarConnect />
              </>
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

      {/* ── File: upload to the private bucket OR link to an external file ── */}
      {block.type === 'file' && (() => {
        const linkMode = block.external_url != null; // null = upload mode (default)
        return (
          <div className="be-workflow">
            <div className="be-segmented">
              <button className={!linkMode ? 'on' : ''}
                onClick={() => onPatch({ external_url: null })}><UploadCloud size={14} /> Upload</button>
              <button className={linkMode ? 'on' : ''}
                onClick={() => onPatch({ file_key: null, external_url: block.external_url || '' })}><Link2 size={14} /> Link</button>
            </div>
            {linkMode ? (
              <>
                <div className={`be-linkfield${block.external_url && !isHttpUrl(block.external_url) ? ' bad' : ''}`}>
                  <Link2 size={16} className="be-linkfield-icon" />
                  <input className="be-linkinput" value={block.external_url ?? ''}
                    onChange={e => onPatch({ external_url: e.target.value })}
                    placeholder="https://drive.google.com/… or any download link" />
                </div>
                {block.external_url && !isHttpUrl(block.external_url) && (
                  <span className="be-file-err"><AlertCircle size={14} /> Enter a full link starting with http:// or https://</span>
                )}
              </>
            ) : (
              <FileField uploading={uploading} fileKey={block.file_key} name={uploadName || block.body_text}
                err={uploadErr} onFile={handleFile} />
            )}
          </div>
        );
      })()}

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
        .be-workflow { display:flex; flex-direction:column; gap:10px; }
        .be-segmented { display:flex; gap:0; border:1px solid var(--border-strong); border-radius:var(--r-full); overflow:hidden; width:fit-content; }
        .be-segmented button { display:inline-flex; align-items:center; gap:6px; border:none; background:var(--surface); padding:7px 15px; font-size:13px; font-weight:700; color:var(--text-muted); cursor:pointer; }
        .be-segmented button.on { background:var(--accent); color:#fff; }

        .be-file { display:flex; flex-direction:column; gap:8px; }

        /* Upload dropzone — stands out from the panel; accent on hover. */
        .be-dropzone { display:flex; align-items:center; gap:13px; width:100%; padding:16px; border:2px dashed var(--border-strong); border-radius:var(--r); background:var(--surface); cursor:pointer; transition:border-color .12s ease, background .12s ease; }
        .be-dropzone:hover { border-color:var(--accent); background:var(--accent-light); }
        .be-dropzone-icon { display:flex; align-items:center; justify-content:center; width:42px; height:42px; border-radius:var(--r-full); background:var(--accent-light); color:var(--accent-hover); flex-shrink:0; }
        .be-dropzone-text { display:flex; flex-direction:column; gap:2px; min-width:0; }
        .be-dropzone-text b { font-size:14px; color:var(--text); }
        .be-dropzone-hint { font-size:12px; color:var(--text-muted); }

        /* Attached — redundant cues: checkmark icon + shape + "File attached". */
        .be-file-done { display:flex; align-items:center; gap:12px; width:100%; padding:13px 15px; border:1.5px solid var(--green-mid); border-radius:var(--r); background:var(--green-light); }
        .be-file-done-icon { display:flex; color:var(--green); flex-shrink:0; }
        .be-file-done-text { display:flex; flex-direction:column; gap:1px; flex:1; min-width:0; }
        .be-file-done-text b { font-size:14px; color:var(--text); }
        .be-file-done-name { font-size:12.5px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .be-file-replace { flex-shrink:0; padding:6px 13px; border:1px solid var(--border-strong); border-radius:var(--r-sm); background:var(--surface); font-size:12px; font-weight:700; color:var(--text-secondary); cursor:pointer; }
        .be-file-replace:hover { border-color:var(--accent); color:var(--accent); }

        /* Link field — icon prefix so it reads as a URL input. */
        .be-linkfield { display:flex; align-items:center; gap:8px; border:1.5px solid var(--border-strong); border-radius:var(--r); padding:0 12px; background:var(--surface); }
        .be-linkfield:focus-within { border-color:var(--accent); }
        .be-linkfield.bad { border-color:#CE4A3E; }
        .be-linkfield-icon { color:var(--text-muted); flex-shrink:0; }
        .be-linkinput { flex:1; border:none; padding:10px 0; background:transparent; font-size:14px; }
        .be-linkinput:focus { outline:none; }

        .be-file-err { display:inline-flex; align-items:center; gap:5px; font-size:13px; color:var(--accent); font-weight:600; }
        .be-native { display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-size:14px; font-weight:600; }
        .be-native select { padding:5px 8px; }
        .be-schedule { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
        .be-sched-field { display:flex; flex-direction:column; gap:5px; }
        /* Full width — it sits outside the 3-up scheduling row, not inside it. */
        .be-meetfield { margin-top:12px; width:100%; }
        .be-sched-label { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--text-muted); }
        .be-sched-field select { padding:8px 10px; border:1.5px solid var(--border-strong); border-radius:var(--r-sm); background:var(--surface); font-size:14px; font-weight:600; color:var(--text); font-family:inherit; cursor:pointer; }
        .be-sched-field select:focus { outline:none; border-color:var(--accent); }
        .be-hint { flex-basis:100%; font-weight:400; font-size:12px; color:var(--text-muted); margin-top:4px; }
      `}</style>
    </div>
  );
}

function FileField({ uploading, fileKey, name, err, onFile }) {
  const attached = fileKey && !uploading;
  return (
    <div className="be-file">
      {attached ? (
        <div className="be-file-done">
          <span className="be-file-done-icon"><CheckCircle2 size={20} /></span>
          <span className="be-file-done-text">
            <b>File attached</b>
            <span className="be-file-done-name">{name || 'Ready to deliver'}</span>
          </span>
          <label className="be-file-replace">
            Replace<input type="file" hidden onChange={onFile} />
          </label>
        </div>
      ) : (
        <label className="be-dropzone">
          <span className="be-dropzone-icon"><UploadCloud size={22} /></span>
          <span className="be-dropzone-text">
            <b>{uploading ? 'Uploading…' : 'Choose a file to upload'}</b>
            {/* States the rule BEFORE the click. An upload limit discovered only
                by tripping it reads as a bug; stated up front it reads as a spec. */}
            <span className="be-dropzone-hint">
              PDF, ZIP, video, image — this is what buyers download.
              Up to {formatBytes(LIMITS.digital.max)}; over {formatBytes(ZIP_REQUIRED_ABOVE)} must be a .zip
            </span>
          </span>
          <input type="file" hidden onChange={onFile} disabled={uploading} />
        </label>
      )}
      {err && <span className="be-file-err"><AlertCircle size={14} /> {err}</span>}
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
