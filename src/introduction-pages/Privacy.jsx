import LegalPage from './LegalPage';

// Content only — layout, theming and navigation live in LegalPage.
const SECTIONS = [
    {
        title: '1. Information We Collect',
        body: (
            <>
                <p>We collect information you provide directly:</p>
                <ul>
                    <li>Name, email address, and phone number</li>
                    <li>Profile details, skills, and availability</li>
                    <li>Payment information (handled by Stripe — see below)</li>
                </ul>
                <p>We also collect usage data such as pages visited, actions taken, and device information.</p>
            </>
        ),
    },
    {
        title: '2. How We Use Your Information',
        body: (
            <>
                <p>We use your information to:</p>
                <ul>
                    <li>Operate and improve the SkillJoy platform</li>
                    <li>Match you with relevant gigs and skill swaps</li>
                    <li>Process payments via Stripe</li>
                    <li>Send notifications about your account and activity</li>
                    <li>Comply with legal obligations</li>
                </ul>
            </>
        ),
    },
    {
        title: '3. Sharing Your Information',
        body: (
            <>
                <p><strong>We do not sell your personal information.</strong> We share data with:</p>
                <ul>
                    <li>Other users, as necessary to facilitate transactions (e.g. your name and profile)</li>
                    <li>Stripe, for payment processing</li>
                    <li>Supabase, for data storage and authentication</li>
                    <li>Law enforcement, when required by law</li>
                </ul>
            </>
        ),
    },
    {
        title: '4. Profile Visibility',
        body: <p>Your profile (name, bio, skills, ratings) is visible to other logged-in users. Your email address and phone number are never shown publicly unless you explicitly enable it in Privacy Settings.</p>,
    },
    {
        title: '5. Data Retention',
        body: <p>We retain your account data for as long as your account is active. You may request deletion of your account and associated data from <strong>Settings → Danger Zone</strong>, or by contacting us.</p>,
    },
    {
        title: '6. Cookies',
        body: <p>SkillJoy uses browser storage (localStorage and session tokens) for authentication and preferences. We do not use third-party tracking cookies.</p>,
    },
    {
        title: '7. Security',
        body: <p>We implement industry-standard security measures including encrypted connections (HTTPS) and secure token-based authentication via Supabase. Payment data is handled exclusively by Stripe and is never stored on our servers.</p>,
    },
    {
        title: '8. Your Rights',
        body: <p>Depending on your location, you may have rights to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:techkage@proton.me">techkage@proton.me</a>.</p>,
    },
    {
        title: '9. Children',
        body: <p>SkillJoy is not directed at individuals under the age of 18. We do not knowingly collect personal data from minors.</p>,
    },
    {
        title: '10. Changes',
        body: <p>We may update this policy periodically. We will notify users of significant changes via email or an in-app notification.</p>,
    },
    {
        title: '11. Contact',
        body: <p>Questions about this policy? Email us at <a href="mailto:techkage@proton.me">techkage@proton.me</a>.</p>,
    },
];

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            updated={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            intro="What we collect, why we collect it, who it's shared with, and how to get it removed."
            sections={SECTIONS}
        />
    );
}
