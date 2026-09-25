import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc, LegalSection } from '@/components/legal/legal-document';

export const metadata: Metadata = {
  title: {
    absolute: 'Privacy Policy | Social Media Analytics',
  },
  description:
    'Privacy Policy for Social Media Analytics by Aviations Minute. Learn how connected account data, OAuth tokens, and analytics are handled.',
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      description="This Privacy Policy explains how Social Media Analytics (Aviations Minute) handles information when you use the platform to connect social accounts and view analytics."
    >
      <LegalSection id="who-we-are" title="1. Who we are">
        <p>
          Social Media Analytics is operated under the Aviations Minute brand. The service helps
          you connect supported social media accounts and view analytics derived from data those
          platforms make available through their official APIs.
        </p>
      </LegalSection>

      <LegalSection id="scope" title="2. Scope">
        <p>
          This policy applies to the Social Media Analytics web application and related backend
          services that sync and store analytics for connected accounts. It does not describe the
          privacy practices of third-party platforms such as Google or YouTube; those services have
          their own policies.
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" title="3. Information we may collect">
        <p>Depending on how you use the platform, we may process:</p>
        <ul className="list-disc space-y-2 ps-5">
          <li>
            <span className="font-medium text-ink-900">Workspace identifiers</span> used to
            associate connected accounts with your workspace session (for example, a workspace
            user email configured for the deployment).
          </li>
          <li>
            <span className="font-medium text-ink-900">Account and profile information</span>{' '}
            returned by connected platforms after you authorize access (such as channel or account
            name, username or handle, profile image URL, profile URL, and related profile fields
            provided by the platform API).
          </li>
          <li>
            <span className="font-medium text-ink-900">Analytics and content metrics</span>{' '}
            retrieved from authorized platform APIs (for example views, engagement-related metrics,
            subscriber-related metrics, and post or video metadata where the integration supports
            them).
          </li>
          <li>
            <span className="font-medium text-ink-900">OAuth credentials</span> issued by the
            platform provider (access tokens and, when provided, refresh tokens), stored so the
            service can keep the connection active and sync data without asking you to reconnect
            on every request.
          </li>
          <li>
            <span className="font-medium text-ink-900">Operational records</span> related to sync
            jobs and connection status (for example last sync time and whether reauthorization is
            required).
          </li>
        </ul>
        <p>
          We do not intentionally collect payment card details through this application. Metrics
          that a platform does not provide remain unavailable and are not shown as fabricated zeros.
        </p>
      </LegalSection>

      <LegalSection id="oauth" title="4. OAuth authentication and tokens">
        <p>
          When you choose to connect a supported platform (currently YouTube via Google OAuth), you
          are redirected to that provider to grant permissions. We receive authorization codes and
          exchange them for tokens according to the provider’s OAuth flow.
        </p>
        <p>
          Access and refresh tokens are stored on the server in encrypted form and are not exposed
          to the browser interface. Session cookies used for workspace continuity and OAuth state
          validation are configured as HttpOnly cookies. Token values are not intended to appear in
          application logs.
        </p>
      </LegalSection>

      <LegalSection id="why-we-collect" title="5. Why we collect information">
        <p>We process this information to:</p>
        <ul className="list-disc space-y-2 ps-5">
          <li>Establish and maintain connections to accounts you authorize.</li>
          <li>Synchronize analytics and related metadata into your workspace.</li>
          <li>Display dashboards, connection status, and historical metrics.</li>
          <li>Refresh access credentials when needed so background sync can continue.</li>
          <li>Operate, secure, and troubleshoot the service.</li>
        </ul>
      </LegalSection>

      <LegalSection id="how-we-use" title="6. How information is used">
        <p>
          Connected account data and analytics are used to provide the product features you request
          within the application. We do not sell your social account credentials. Platform data is
          processed to power analytics views, sync status, and account management screens.
        </p>
      </LegalSection>

      <LegalSection id="storage-security" title="7. Data storage and security">
        <p>
          Application data is stored in the platform’s configured database. OAuth tokens are stored
          encrypted at rest using the deployment’s token encryption key. Job queues may use Redis
          for background synchronization. Access to production systems should be limited to
          operators of the deployment.
        </p>
        <p>
          No method of transmission or storage is completely secure. We apply practical safeguards
          appropriate to this application’s design, but we do not claim specific third-party
          certifications in this policy.
        </p>
      </LegalSection>

      <LegalSection id="third-parties" title="8. Third-party platforms and APIs">
        <p>
          The service relies on third-party APIs (including Google / YouTube) to obtain authorized
          data. Those providers process information under their own terms and privacy policies. If
          you revoke access in the provider’s account settings, the platform may lose the ability to
          refresh tokens or sync until you reconnect.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="9. Cookies and session data">
        <p>
          The application may set cookies required for session continuity and OAuth security (such
          as signed workspace and OAuth state cookies). These cookies support sign-in continuity and
          protect the authorization flow. They are not used to serve third-party advertising from
          within this application’s documented feature set.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="10. Data retention">
        <p>
          We retain connected account records, encrypted tokens, and synchronized analytics while
          they are needed to provide the service and maintain your workspace history. Exact
          retention schedules may depend on how the deployment is operated. If you disconnect an
          account or request removal, operators should process that request through the
          application’s connection controls and operational procedures.
        </p>
        <p>
          Historical analytics stored for a connected account are intended to remain available for
          your workspace unless removed through an explicit operational action. An expired access
          token alone does not mean historical data has been deleted.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="11. Your choices and rights">
        <p>Depending on how you use the product, you may be able to:</p>
        <ul className="list-disc space-y-2 ps-5">
          <li>Connect or reconnect a social account through the application’s OAuth flow.</li>
          <li>
            Review connection status and channel or account information shown in the dashboard.
          </li>
          <li>
            Reauthorize access when the platform indicates that reauthorization is required.
          </li>
          <li>
            Revoke access directly from the third-party provider (for example, Google Account
            permissions).
          </li>
        </ul>
        <p>
          For additional privacy requests related to this deployment, contact the operator using the
          contact method published for this website.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="12. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. The “Last updated” date at the top of
          this page will change when we do. Continued use of the service after an update means you
          should review the revised policy.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact">
        <p>
          Questions about this Privacy Policy may be directed to the operator of Social Media
          Analytics / Aviations Minute through the contact channel published on{' '}
          <a
            href="https://aviationsminuteanalysis.com"
            className="font-medium text-signal-600 hover:underline"
          >
            aviationsminuteanalysis.com
          </a>
          .
        </p>
        <p>
          Related document:{' '}
          <Link href="/terms" className="font-medium text-signal-600 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
