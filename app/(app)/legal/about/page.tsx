'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, Users, Target, Award } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          About PrithviX Partner
        </h1>
        <p className="mt-1 text-muted-foreground">
          Empowering agricultural dealers with modern technology
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Our Story
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <p>
            PrithviX Partner is a comprehensive web platform designed specifically for agricultural
            dealers and input retailers across India. We understand the unique challenges faced by
            agri-businesses and have built a solution that addresses real-world needs.
          </p>
          <p>
            Founded in 2024, our mission is to digitize and modernize the agricultural retail
            sector, making it easier for dealers to manage their operations, serve farmers better,
            and grow their businesses.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Our Mission
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To empower every agricultural dealer with digital tools that simplify operations,
            improve farmer relationships, and drive business growth through data-driven insights.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Key Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-semibold">Farmer Management</h4>
              <p className="text-sm text-muted-foreground">
                Complete farmer profiles with QR code IDs, crop tracking, and visit history
              </p>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Sales & Credit</h4>
              <p className="text-sm text-muted-foreground">
                Track sales, manage credit (udhaar), and generate professional invoices
              </p>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Inventory</h4>
              <p className="text-sm text-muted-foreground">
                Real-time stock management with low-stock alerts and reorder notifications
              </p>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Analytics</h4>
              <p className="text-sm text-muted-foreground">
                Business intelligence dashboards with sales trends and performance metrics
              </p>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Compliance</h4>
              <p className="text-sm text-muted-foreground">
                License tracking, GST reports, and regulatory compliance tools
              </p>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">AI Assistance</h4>
              <p className="text-sm text-muted-foreground">
                AI-powered agronomist for crop advisory and smart follow-ups
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Our Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We are a dedicated team of technologists, agronomists, and business experts passionate
            about transforming Indian agriculture through technology. Our diverse backgrounds bring
            together deep industry knowledge and cutting-edge technical expertise.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technology Stack</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frontend:</span>
              <span className="font-medium">Next.js 15 + React 19</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Backend:</span>
              <span className="font-medium">Supabase</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Styling:</span>
              <span className="font-medium">Tailwind CSS v4</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deployment:</span>
              <span className="font-medium">Vercel Edge Network</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Us</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Email:</span>{' '}
            <span className="text-muted-foreground">support@prithvix.com</span>
          </div>
          <div>
            <span className="font-medium">Phone:</span>{' '}
            <span className="text-muted-foreground">1800-XXX-XXXX</span>
          </div>
          <div>
            <span className="font-medium">Website:</span>{' '}
            <span className="text-muted-foreground">https://prithvix.com</span>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground">
        <p>© 2024-2026 PrithviX. All rights reserved.</p>
        <p className="mt-1">Version 1.0.0</p>
      </div>
    </div>
  );
}
