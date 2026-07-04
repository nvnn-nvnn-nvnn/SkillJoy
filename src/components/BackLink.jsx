import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// One back button for the whole app. Renders a Link when `to` is given, or a
// button when `onClick` is given (e.g. navigate(-1)). The arrow slides on hover.
//
//   <BackLink to="/build">All products</BackLink>
//   <BackLink onClick={() => navigate(-1)}>Go back</BackLink>
export default function BackLink({ to, onClick, children = 'Back', className = '' }) {
  const cls = `bl${className ? ` ${className}` : ''}`;
  const inner = (
    <>
      <ArrowLeft size={16} className="bl-icon" />
      {children && <span className="bl-label">{children}</span>}
    </>
  );
  return to
    ? <Link to={to} className={cls}>{inner}</Link>
    : <button type="button" className={cls} onClick={onClick}>{inner}</button>;
}
