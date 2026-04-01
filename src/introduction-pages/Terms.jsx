export default function TermsPage() {
    return (
        <div className="page" style={{ maxWidth: 760 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
            <p style={{ color: '#000', marginBottom: 40 }}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

            <Section title="1. Acceptance of Terms">
                By accessing or using SkillJoy, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.
            </Section>

            <Section title="2. Eligibility">
                You must be at least 18 years old and a current student or faculty member of an accredited university to use SkillJoy. By registering, you confirm that the information you provide is accurate and complete.
            </Section>

            <Section title="3. User Accounts">
                You are responsible for maintaining the confidentiality of your account credentials. You are liable for all activity that occurs under your account. SkillJoy reserves the right to terminate accounts that violate these terms.
            </Section>

            <Section title="4. Gigs & Skill Swaps">
                SkillJoy provides a marketplace for users to offer and purchase services ("Gigs") and exchange skills ("Swaps"). SkillJoy is not a party to any agreement between users and is not responsible for the quality, safety, or legality of services offered.
            </Section>

            <Section title="5. Payments & Escrow">
                Payments for Gigs are held in escrow via Stripe until the buyer releases funds or the auto-release period expires (3 days after delivery). SkillJoy charges a platform service fee of $6 per transaction. All payments are processed by Stripe and subject to Stripe's terms of service.
            </Section>

            <Section title="6. Disputes">
                Users may file a dispute within the confirmation window after a gig is marked as delivered. SkillJoy reserves the right to make final decisions on disputes at its sole discretion.
            </Section>

            <Section title="7. Prohibited Conduct">
                You may not use SkillJoy to: (a) violate any law or regulation; (b) post false or misleading information; (c) harass, threaten, or defraud other users; (d) offer illegal services; or (e) attempt to circumvent platform fees by transacting off-platform.
            </Section>

            <Section title="8. Intellectual Property">
                Content you post on SkillJoy remains your property. By posting content, you grant SkillJoy a non-exclusive license to display and distribute that content on the platform.
            </Section>

            <Section title="9. Limitation of Liability">
                SkillJoy is provided "as is" without warranties of any kind. To the fullest extent permitted by law, SkillJoy shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.
            </Section>

            <Section title="10. Changes to Terms">
                SkillJoy may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.
            </Section>

            <Section title="11. Contact">
                For questions about these terms, contact us at <a href="mailto:legal@skilljoy.app" style={{ color: 'var(--accent)' }}>legal@skilljoy.app</a>.
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
