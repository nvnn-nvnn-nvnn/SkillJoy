export default function PrivacyPage() {
    return (
        <div className="page" style={{ maxWidth: 760 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
            <p style={{ color: '#000', marginBottom: 40 }}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

            <Section title="1. Information We Collect">
                We collect information you provide directly: name, email address, profile details, skills, availability, and payment information. We also collect usage data such as pages visited, actions taken, and device information.
            </Section>

            <Section title="2. How We Use Your Information">
                We use your information to: (a) operate and improve the SkillJoy platform; (b) match you with relevant gigs and skill swaps; (c) process payments via Stripe; (d) send notifications about your account and activity; and (e) comply with legal obligations.
            </Section>

            <Section title="3. Sharing Your Information">
                We do not sell your personal information. We share data with: (a) other users as necessary to facilitate transactions (e.g., your name and profile); (b) Stripe for payment processing; (c) Supabase for data storage and authentication; and (d) law enforcement when required by law.
            </Section>

            <Section title="4. Profile Visibility">
                Your profile (name, bio, skills, ratings) is visible to other logged-in users. Your email address is not shown publicly unless you enable it in Privacy Settings.
            </Section>

            <Section title="5. Data Retention">
                We retain your account data for as long as your account is active. You may request deletion of your account and associated data by going to Settings → Danger Zone, or by contacting us.
            </Section>

            <Section title="6. Cookies">
                SkillJoy uses browser storage (localStorage and session tokens) for authentication and preferences. We do not use third-party tracking cookies.
            </Section>

            <Section title="7. Security">
                We implement industry-standard security measures including encrypted connections (HTTPS) and secure token-based authentication via Supabase. Payment data is handled exclusively by Stripe and never stored on our servers.
            </Section>

            <Section title="8. Your Rights">
                Depending on your location, you may have rights to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:privacy" style={{ color: 'var(--accent)' }}>techkage@proton.me</a>
            </Section>

            <Section title="9. Children">
                SkillJoy is not directed at individuals under the age of 18. We do not knowingly collect personal data from minors.
            </Section>

            <Section title="10. Changes">
                We may update this policy periodically. We will notify users of significant changes via email or an in-app notification.
            </Section>

            <Section title="11. Contact">
                Questions about this policy? Email us at <a href="mailto:techkage@proton.me" style={{ color: 'var(--accent)' }}>techkage@proton.me</a>.
            </Section>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div style={{ background: '#f0ede8', padding: 24, borderRadius: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{children}</p>
        </div>
    );
}
