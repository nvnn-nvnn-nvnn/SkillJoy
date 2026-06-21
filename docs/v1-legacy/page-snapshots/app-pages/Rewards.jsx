import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth } from '@/lib/stores';

const REWARDS = [
  { id: 1, title: "Free Coffee at Student Union", cost: 100, icon: "☕", color: "orange", description: "Redeem for a free coffee or tea at the campus student union cafe." },
  { id: 2, title: "University T-Shirt", cost: 500, icon: "👕", color: "blue", description: "Get an official university t-shirt in your size." },
  { id: 3, title: "$10 Campus Bookstore Voucher", cost: 1000, icon: "📚", color: "green", description: "Receive a $10 voucher to use at the campus bookstore." },
  { id: 4, title: "Priority Tutoring Session", cost: 750, icon: "🎓", color: "purple", description: "Skip the waitlist for academic tutoring center sessions." },
  { id: 5, title: "Gym Day Pass", cost: 200, icon: "💪", color: "red", description: "One-day guest pass to the campus recreation center." },
  { id: 6, title: "Pizza Party for Study Group", cost: 1500, icon: "🍕", color: "yellow", description: "Free pizza delivery for you and your study group (up to 8 people)." },
];

export default function Rewards() {
  const user = useUser();
  const profile = useProfile();
  const { setProfile } = useAuth();
  const navigate = useNavigate();

  const [userPoints, setUserPoints] = useState(0);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (profile?.points !== undefined) {
      setUserPoints(profile.points);
    } else {
      setUserPoints(350);
    }
    setBusy(false);
  }, [user, profile]);

  async function handleRedeemReward(reward) {
    if (userPoints < reward.cost) {
      alert(`You need ${reward.cost - userPoints} more points for this reward.`);
      return;
    }

    const confirmed = confirm(`Redeem ${reward.cost} points for: ${reward.title}?`);
    if (!confirmed) return;

    const newPoints = userPoints - reward.cost;
    const { error } = await supabase
      .from('profiles')
      .update({ points: newPoints })
      .eq('id', user.id);

    if (error) {
      alert('Error redeeming reward. Please try again.');
      return;
    }

    setUserPoints(newPoints);
    setProfile(prev => ({ ...prev, points: newPoints }));
    alert(`Success! You redeemed: ${reward.title}. Pick it up at the student center!`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rewards Store</h1>
          <p className="page-subtitle">Redeem your points for campus perks and goodies!</p>
        </div>
        <div className="points-display-large">
          <div className="points-icon">🏆</div>
          <div>
            <div className="points-value">{userPoints}</div>
            <div className="points-label-text">Available Points</div>
          </div>
        </div>
      </div>

      {busy ? (
        <div className="spinner-container">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="info-card">
            <h3>💡 How to Earn Points</h3>
            <div className="earn-methods">
              <div className="earn-item">
                <span className="earn-icon">🎓</span>
                <div>
                  <strong>Teach a skill</strong>
                  <p>Earn 50 points for each completed teaching session</p>
                </div>
              </div>
              <div className="earn-item">
                <span className="earn-icon">📖</span>
                <div>
                  <strong>Learn a skill</strong>
                  <p>Earn 20 points for each completed learning session</p>
                </div>
              </div>
              <div className="earn-item">
                <span className="earn-icon">⭐</span>
                <div>
                  <strong>Complete your profile</strong>
                  <p>Bonus points for adding skills and availability</p>
                </div>
              </div>
            </div>
          </div>

          <h2 className="section-title">Available Rewards</h2>
          <div className="rewards-grid">
            {REWARDS.map(reward => {
              const canAfford = userPoints >= reward.cost;
              return (
                <div key={reward.id} className={`reward-card ${canAfford ? '' : 'disabled'}`}>
                  <div className="reward-header">
                    <div className={`reward-icon ${reward.color}`}>{reward.icon}</div>
                    {!canAfford && <span className="locked-badge">🔒 Locked</span>}
                  </div>

                  <h3 className="reward-title">{reward.title}</h3>
                  <p className="reward-description">{reward.description}</p>

                  <div className="reward-footer">
                    <div className="reward-cost">
                      <span className="cost-value">{reward.cost}</span>
                      <span className="cost-label">points</span>
                    </div>
                    <button
                      className={`btn ${canAfford ? 'btn-primary' : 'btn-secondary'}`}
                      disabled={!canAfford}
                      onClick={() => handleRedeemReward(reward)}
                    >
                      {canAfford ? 'Redeem' : `Need ${reward.cost - userPoints} more`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rewards-cta">
            <h3>Want to earn more points?</h3>
            <p>Complete skill swaps to rack up points and unlock amazing rewards!</p>
            <Link to="/matches" className="btn btn-primary" style={{ marginTop: 16 }}>Find Matches</Link>
          </div>
        </>
      )}

      <style>{`
        .page-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 40px; flex-wrap: wrap; gap: 24px;
        }
        .points-display-large {
          display: flex; align-items: center; gap: 16px;
          background: linear-gradient(135deg, #FEF9EC 0%, #FEF3E2 100%);
          padding: 20px 28px; border-radius: var(--r-lg);
          border: 2px solid #F0D890; box-shadow: var(--shadow);
        }
        .points-icon { font-size: 48px; }
        .points-value { font-size: 36px; font-weight: 700; color: #A07020; line-height: 1; }
        .points-label-text {
          font-size: 12px; color: #9E7D55; text-transform: uppercase;
          letter-spacing: 0.05em; margin-top: 4px;
        }
        .spinner-container { display: flex; justify-content: center; padding: 80px; }
        .info-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 24px; margin-bottom: 40px; box-shadow: var(--shadow-sm);
        }
        .info-card h3 { font-size: 20px; margin-bottom: 20px; }
        .earn-methods { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .earn-item { display: flex; gap: 12px; align-items: flex-start; }
        .earn-icon { font-size: 32px; flex-shrink: 0; }
        .earn-item strong { display: block; font-size: 15px; margin-bottom: 4px; }
        .earn-item p { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .section-title { font-size: 24px; margin-bottom: 24px; }
        .rewards-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px; margin-bottom: 60px;
        }
        .reward-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 24px; box-shadow: var(--shadow-sm);
          transition: all 0.2s; display: flex; flex-direction: column;
        }
        .reward-card:not(.disabled):hover {
          box-shadow: var(--shadow); transform: translateY(-2px); border-color: var(--border-strong);
        }
        .reward-card.disabled { opacity: 0.6; }
        .reward-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .reward-icon { font-size: 56px; padding: 12px; border-radius: var(--r); display: inline-block; }
        .reward-icon.orange { background: #FFF4E6; }
        .reward-icon.blue { background: #E6F2FF; }
        .reward-icon.green { background: #E6F7EE; }
        .reward-icon.purple { background: #F3E6FF; }
        .reward-icon.red { background: #FFE6E6; }
        .reward-icon.yellow { background: #FFFBE6; }
        .locked-badge {
          background: var(--surface-alt); color: var(--text-muted);
          padding: 4px 10px; border-radius: var(--r-full); font-size: 11px;
          font-weight: 600; border: 1px solid var(--border);
        }
        .reward-title { font-size: 18px; margin-bottom: 8px; }
        .reward-description {
          font-size: 14px; color: var(--text-secondary); line-height: 1.6;
          margin-bottom: 20px; flex: 1;
        }
        .reward-footer {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; padding-top: 16px; border-top: 1px solid var(--border);
        }
        .reward-cost { display: flex; flex-direction: column; }
        .cost-value { font-size: 24px; font-weight: 700; color: var(--primary); line-height: 1; }
        .cost-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .rewards-cta {
          text-align: center; padding: 60px 32px; background: var(--surface-alt);
          border-radius: var(--r-lg); border: 1px solid var(--border);
        }
        .rewards-cta h3 { font-size: 28px; margin-bottom: 12px; }
        .rewards-cta p { font-size: 16px; color: var(--text-secondary); }
      `}</style>
    </div>
  );
}
