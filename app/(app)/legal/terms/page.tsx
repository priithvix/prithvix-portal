'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="mt-1 text-muted-foreground">
          Last updated: May 7, 2026
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Agreement to Terms
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <p>
            By accessing and using PrithviX Partner, you agree to be bound by these Terms of
            Service. If you do not agree to these terms, please do not use our services.
          </p>

          <h3>1. Service Description</h3>
          <p>
            PrithviX Partner is a web-based platform designed to help agricultural dealers manage
            farmers, sales, inventory, credit, and compliance activities.
          </p>

          <h3>2. User Accounts</h3>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials.
            You agree to notify us immediately of any unauthorized access to your account.
          </p>

          <h3>3. Acceptable Use</h3>
          <p>You agree not to:</p>
          <ul>
            <li>Use the service for any illegal purpose</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Upload malicious code or viruses</li>
            <li>Violate any applicable laws or regulations</li>
          </ul>

          <h3>4. Data and Privacy</h3>
          <p>
            Your use of the service is also governed by our Privacy Policy. We collect and use
            your data as described in that policy.
          </p>

          <h3>5. Subscription and Payments</h3>
          <p>
            Subscription fees are billed in advance on a monthly or annual basis. Refunds are not
            provided for partial months of service.
          </p>

          <h3>6. Intellectual Property</h3>
          <p>
            All content, features, and functionality of PrithviX Partner are owned by us and are
            protected by copyright and trademark laws.
          </p>

          <h3>7. Limitation of Liability</h3>
          <p>
            We shall not be liable for any indirect, incidental, special, consequential, or
            punitive damages resulting from your use of the service.
          </p>

          <h3>8. Changes to Terms</h3>
          <p>
            We reserve the right to modify these terms at any time. Continued use of the service
            after changes constitutes acceptance of the new terms.
          </p>

          <h3>9. Termination</h3>
          <p>
            We may suspend or terminate your access to the service if you violate these terms or
            for any other reason at our discretion.
          </p>

          <h3>10. Contact Information</h3>
          <p>
            For questions about these Terms of Service, please contact us at
            support@prithvix.com
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
