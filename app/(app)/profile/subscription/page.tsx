'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Check, Calendar, AlertCircle } from 'lucide-react';
import { format, addMonths } from 'date-fns';

export default function SubscriptionPage() {
  const { dealer } = useAuth();

  // Mock subscription data (in a real app, this would come from dealer profile or separate subscription table)
  type SubscriptionPlan = 'free' | 'pro' | 'enterprise';
  const subscriptionPlan: SubscriptionPlan = 'pro' as SubscriptionPlan; // Mock data - would come from DB
  const subscriptionExpiry = addMonths(new Date(), 1);
  const isExpiringSoon =
    subscriptionExpiry && (subscriptionExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) < 7;

  const plans = [
    {
      name: 'Free',
      price: '₹0',
      period: '/month',
      features: [
        'Up to 50 farmers',
        'Basic analytics',
        'Invoice generation',
        'Limited support',
      ],
      current: subscriptionPlan === 'free',
    },
    {
      name: 'Pro',
      price: '₹499',
      period: '/month',
      features: [
        'Unlimited farmers',
        'Advanced analytics',
        'Compliance module',
        'AI Agronomist',
        'Priority support',
        'WhatsApp integration',
      ],
      current: subscriptionPlan === 'pro',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: '₹999',
      period: '/month',
      features: [
        'Everything in Pro',
        'Multi-branch support',
        'Custom reports',
        'API access',
        'Dedicated account manager',
        '24/7 premium support',
      ],
      current: subscriptionPlan === 'enterprise',
    },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Subscription
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your subscription plan
        </p>
      </div>

      {/* Current Plan Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold capitalize">{subscriptionPlan} Plan</p>
              <p className="text-sm text-muted-foreground">
                Expires: {format(subscriptionExpiry, 'dd MMM yyyy')}
              </p>
            </div>
            {isExpiringSoon && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Expiring Soon
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative ${
              plan.popular
                ? 'border-primary shadow-lg'
                : plan.current
                ? 'border-success'
                : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary">Most Popular</Badge>
              </div>
            )}
            {plan.current && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="outline" className="border-success bg-success/10 text-success">
                  Current Plan
                </Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="text-center">{plan.name}</CardTitle>
              <div className="text-center">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 flex-shrink-0 text-success" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.current ? 'outline' : 'default'}
                disabled={plan.current}
              >
                {plan.current ? 'Current Plan' : 'Upgrade'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contact support to update billing details or manage your subscription.
          </p>
          <Button variant="outline" className="mt-4">
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
