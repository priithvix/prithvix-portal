'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-1 text-muted-foreground">
          Last updated: May 7, 2026
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Privacy Matters
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <p>
            At PrithviX Partner, we are committed to protecting your privacy and ensuring the
            security of your personal information. This Privacy Policy explains how we collect,
            use, and safeguard your data.
          </p>

          <h3>1. Information We Collect</h3>
          <p>We collect the following types of information:</p>
          <ul>
            <li>
              <strong>Account Information:</strong> Name, email, mobile number, business details
            </li>
            <li>
              <strong>Farmer Data:</strong> Names, contact details, addresses, crop information
            </li>
            <li>
              <strong>Transaction Data:</strong> Sales records, credit information, payment details
            </li>
            <li>
              <strong>Usage Data:</strong> How you interact with our platform
            </li>
          </ul>

          <h3>2. How We Use Your Information</h3>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and maintain the service</li>
            <li>Process transactions and generate invoices</li>
            <li>Send important notifications and updates</li>
            <li>Improve our services and develop new features</li>
            <li>Ensure compliance with legal requirements</li>
          </ul>

          <h3>3. Data Storage and Security</h3>
          <p>
            Your data is stored securely using Supabase, a trusted cloud database provider. We
            implement industry-standard security measures including:
          </p>
          <ul>
            <li>Encrypted data transmission (HTTPS/SSL)</li>
            <li>Secure authentication and authorization</li>
            <li>Regular security audits and updates</li>
            <li>Access controls and permissions</li>
          </ul>

          <h3>4. Data Sharing</h3>
          <p>
            We do not sell your personal information. We may share data only:
          </p>
          <ul>
            <li>With your explicit consent</li>
            <li>To comply with legal obligations</li>
            <li>With service providers who assist in operating our platform</li>
          </ul>

          <h3>5. Your Rights</h3>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data</li>
            <li>Opt-out of marketing communications</li>
          </ul>

          <h3>6. Cookies and Tracking</h3>
          <p>
            We use cookies to maintain your session and improve user experience. You can control
            cookie settings through your browser.
          </p>

          <h3>7. Third-Party Services</h3>
          <p>
            Our platform integrates with third-party services like Google Maps. These services have
            their own privacy policies.
          </p>

          <h3>8. Children's Privacy</h3>
          <p>
            Our service is not intended for users under 18 years of age. We do not knowingly
            collect information from children.
          </p>

          <h3>9. Changes to Privacy Policy</h3>
          <p>
            We may update this policy periodically. We will notify you of significant changes via
            email or through the platform.
          </p>

          <h3>10. Contact Us</h3>
          <p>
            If you have questions about this Privacy Policy or wish to exercise your rights, please
            contact us at privacy@prithvix.com
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
