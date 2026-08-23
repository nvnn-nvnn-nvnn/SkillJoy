import { useUser } from '@/lib/stores';
import TrendChart from '@/components/TrendChart';
import AnalyticsCards from '@/components/AnalyticsCards';
import { useAuthGate } from '@/lib/useAuthGate';

// Dedicated analytics page (its own header-nav destination). The daily trend
// line is the headline; the funnel + engagement cards sit below it.
export default function Analytics() {
  const user = useUser();
  const gate = useAuthGate();
  if (gate) return gate;

  return (
    <div className="an-wrap">
      <title>Analytics — SkillJoy</title>
      <h1 className="an-h1">Analytics</h1>
      <p className="an-sub">How people find, browse, and buy from your page.</p>

      <TrendChart creatorId={user.id} />

      <h2 className="an-h2">Funnel &amp; engagement</h2>
      <AnalyticsCards creatorId={user.id} />

      <Styles />
    </div>
  );
}

function Styles() {
  return <style>{`
    .an-wrap { max-width:900px; margin:0 auto; padding:28px 16px 80px; }
    .an-h1 { font-size:26px; font-weight:800; font-family:var(--font-display); color:var(--text); }
    .an-sub { color:var(--text-secondary); font-size:14px; margin:4px 0 22px; }
    .an-h2 { font-size:16px; font-weight:800; color:var(--text); margin:30px 0 14px; }
    .an-muted { color:var(--text-muted); font-size:14px; }
  `}</style>;
}
