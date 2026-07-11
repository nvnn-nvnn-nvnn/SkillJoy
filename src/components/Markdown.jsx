import ReactMarkdown from 'react-markdown';

// Safe markdown renderer for user-authored descriptions.
// SECURITY: react-markdown WITHOUT rehype-raw — raw HTML in the text renders as
// literal characters, never as elements, so it's XSS-safe by construction. Do
// not add rehype-raw or dangerouslySetInnerHTML here.
export default function Markdown({ children, className }) {
  if (!children) return null;
  return (
    <div className={`md${className ? ` ${className}` : ''}`}>
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
        }}
      >
        {children}
      </ReactMarkdown>
      <style>{`
        .md { line-height:1.6; color:inherit; }
        .md p { margin:0 0 10px; }
        .md p:last-child { margin-bottom:0; }
        .md h1, .md h2, .md h3, .md h4 { color:var(--text); line-height:1.25; margin:16px 0 8px; }
        .md h1:first-child, .md h2:first-child, .md h3:first-child { margin-top:0; }
        .md h1 { font-size:1.35em; } .md h2 { font-size:1.2em; } .md h3 { font-size:1.08em; }
        .md ul, .md ol { margin:0 0 10px; padding-left:22px; }
        .md li { margin:3px 0; }
        .md a { color:var(--accent, var(--primary)); font-weight:600; }
        .md strong { color:var(--text); }
        .md blockquote { margin:0 0 10px; padding:4px 14px; border-left:3px solid var(--border-strong, var(--border)); color:var(--text-secondary); }
        .md code { background:color-mix(in srgb, var(--text) 8%, transparent); padding:1px 5px; border-radius:5px; font-size:.92em; }
        .md pre { background:color-mix(in srgb, var(--text) 8%, transparent); padding:10px 12px; border-radius:8px; overflow-x:auto; }
        .md pre code { background:none; padding:0; }
        .md hr { border:none; border-top:1px solid var(--border); margin:14px 0; }
        .md img { max-width:100%; border-radius:8px; }
      `}</style>
    </div>
  );
}
