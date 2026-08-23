import LegalPage from './LegalPage';

// Content only — layout, theming and navigation live in LegalPage.
const SECTIONS = [
    {
        title: '1. Acceptance of Terms',
        body: <p>By accessing or using SkillJoy, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.</p>,
    },
    {
        title: '2. Eligibility',
        body: <p>You must be at least 18 years old and a current student or faculty member of an accredited university to use SkillJoy. By registering, you confirm that the information you provide is accurate and complete.</p>,
    },
    {
        title: '3. User Accounts',
        body: <p>You are responsible for maintaining the confidentiality of your account credentials. You are liable for all activity that occurs under your account. SkillJoy reserves the right to terminate accounts that violate these terms.</p>,
    },
    {
        title: '4. Gigs & Skill Swaps',
        body: <p>SkillJoy provides a marketplace for users to offer and purchase services (&ldquo;Gigs&rdquo;) and exchange skills (&ldquo;Swaps&rdquo;). SkillJoy is not a party to any agreement between users and is not responsible for the quality, safety, or legality of services offered.</p>,
    },
    {
        title: '5. Payments & Escrow',
        body: (
            <>
                <p>Payments for Gigs are held in escrow via Stripe until the buyer releases funds or the auto-release period expires (3 days after delivery).</p>
                <p>SkillJoy charges a flat platform service fee of <strong>$3.50 per transaction</strong>. All payments are processed by Stripe and subject to Stripe&rsquo;s terms of service.</p>
            </>
        ),
    },
    {
        title: '6. Disputes',
        body: <p>Users may file a dispute within the confirmation window after a gig is marked as delivered. SkillJoy reserves the right to make final decisions on disputes at its sole discretion.</p>,
    },
    {
        title: '7. Prohibited Conduct',
        body: (
            <>
                <p>You may not use SkillJoy to:</p>
                <ul>
                    <li>Violate any law or regulation</li>
                    <li>Post false or misleading information</li>
                    <li>Harass, threaten, or defraud other users</li>
                    <li>Offer illegal services</li>
                    <li>Attempt to circumvent platform fees by transacting off-platform</li>
                </ul>
            </>
        ),
    },
    {
        title: '8. Intellectual Property',
        body: <p>Content you post on SkillJoy remains your property. By posting content, you grant SkillJoy a non-exclusive license to display and distribute that content on the platform.</p>,
    },
    {
        title: '9. Limitation of Liability',
        body: <p>SkillJoy is provided &ldquo;as is&rdquo; without warranties of any kind. To the fullest extent permitted by law, SkillJoy shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>,
    },
    {
        title: '10. Changes to Terms',
        body: <p>SkillJoy may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>,
    },
    {
        title: '11. Contact',
        body: <p>For questions about these terms, contact us at <a href="mailto:techkage@proton.me">techkage@proton.me</a>.</p>,
    },
];

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            updated={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            intro="These terms cover how SkillJoy works, what you're agreeing to when you use it, and where our responsibilities begin and end."
            sections={SECTIONS}
        />
    );
}
