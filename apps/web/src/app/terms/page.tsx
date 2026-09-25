import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc, LegalSection } from '@/components/legal/legal-document';

export const metadata: Metadata = {
  title: {
    absolute: 'Terms of Service | Social Media Analytics',
  },
  description:
    'Terms of Service for Social Media Analytics by Aviations Minute. Rules for connecting accounts, using analytics, and accepting platform limitations.',
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      description="These Terms of Service govern your use of Social Media Analytics (Aviations Minute). By using the application, you agree to these terms."
    >
      <LegalSection id="acceptance" title="1. Acceptance of terms">
        <p>
          By accessing or using           Social Media Analytics, you agree to these Terms of Service and the
          related{' '}
          <Link href="/privacy" className="font-medium text-signal-600 hover:underline">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the service.
        </p>
      </LegalSection>

      <LegalSection id="service" title="2. Description of the service">
        <p>
          Social Media Analytics is a software platform that lets you connect supported social media
          accounts and view analytics based on data retrieved from those platforms’ official APIs.
          YouTube is currently available for connection. Other platforms may appear in the product
          as reserved or coming soon and may not provide live metrics until their connectors are
          enabled.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Connecting social media accounts">
        <p>
          You may connect an account only if you have the right to authorize access to that account.
          Connection uses the platform’s OAuth process. You are responsible for the permissions you
          grant and for keeping provider credentials and account access under your control.
        </p>
      </LegalSection>

      <LegalSection id="oauth-responsibility" title="4. OAuth authorization">
        <p>
          After you authorize a provider, the application stores encrypted tokens on the server so
          it can sync data and refresh access when needed. You can revoke access through the
          provider’s own security settings. If a refresh token becomes invalid, the application may
          require you to reconnect before syncing continues.
        </p>
      </LegalSection>

      <LegalSection id="analytics" title="5. Analytics and data usage">
        <p>
          Analytics shown in the dashboard come from authorized API responses and stored sync
          results. Values that platforms do not return may appear as unavailable. The product is
          designed to reflect platform-provided metrics; it does not guarantee completeness,
          accuracy, or uninterrupted freshness of third-party data.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="6. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 ps-5">
          <li>Connect accounts you are not authorized to manage.</li>
          <li>Attempt to bypass security controls, abuse APIs, or disrupt the service.</li>
          <li>Use the service to violate platform rules or applicable law.</li>
          <li>Misrepresent analytics or scrape the application in a way that harms the service.</li>
        </ul>
      </LegalSection>

      <LegalSection id="third-parties" title="7. Third-party platforms and APIs">
        <p>
          The service depends on third-party platforms (including Google and YouTube). Their
          availability, quotas, scopes, and policies are outside our control. Changes by those
          providers may affect features, sync frequency, or whether a connection remains valid.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="8. Service availability">
        <p>
          We aim to keep the application available, but we do not guarantee uninterrupted uptime.
          Maintenance, infrastructure issues, provider outages, or configuration problems may
          temporarily limit access to dashboards, sync jobs, or OAuth flows.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="9. Intellectual property">
        <p>
          The Social Media Analytics application, including its interface, branding within the
          product, and original software, is owned by the operators of Aviations Minute or their
          licensors. Platform logos, channel content, and third-party trademarks remain the property
          of their respective owners.
        </p>
      </LegalSection>

      <LegalSection id="disconnection" title="10. Disconnection and termination">
        <p>
          You may stop using the service at any time and may disconnect or revoke platform access
          through the application and/or the provider. Operators may suspend or limit access if
          these terms are violated, if required for security, or if the deployment is decommissioned.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="11. Limitation of liability">
        <p>
          The service is provided on an “as available” basis for analytics and account management
          features described in the product. To the fullest extent permitted by applicable law, the
          operators are not liable for indirect, incidental, or consequential damages arising from
          use of the service, reliance on third-party metrics, or temporary inability to sync or
          display data.
        </p>
        <p>
          Nothing in these terms is intended to exclude liability that cannot be excluded under
          applicable law.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="12. Changes to these terms">
        <p>
          We may update these Terms of Service from time to time. The “Last updated” date on this
          page will be revised when changes are published. Continued use after an update constitutes
          acceptance of the revised terms.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact">
        <p>
          Questions about these Terms of Service may be directed to the operator of Social Media
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
          <Link href="/privacy" className="font-medium text-signal-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
