'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Store, Mail, Phone, MapPin, Lock, ChevronLeft, Leaf } from 'lucide-react';
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';

const PHONE_REGEX = /^[6-9]\d{9}$/;
const PIN_REGEX = /^\d{6}$/;

const schema = z.object({
  shopName: z.string().min(1, 'Shop name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  email: z.string().email('Enter a valid email address'),
  mobile: z.string().regex(PHONE_REGEX, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  village: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().regex(PIN_REGEX, 'Enter a valid 6-digit PIN code').optional().or(z.literal('')),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

function generateDealerId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'DLR_';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export default function RegisterDealerPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      shopName: '',
      ownerName: '',
      email: '',
      mobile: '',
      password: '',
      confirmPassword: '',
      village: '',
      district: '',
      state: '',
      pinCode: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            owner_name: data.ownerName,
            shop_name: data.shopName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      // Create dealer profile
      const dealerId = generateDealerId();
      const { error: dealerError } = await supabase.from('dealers').insert({
        user_id: authData.user.id,
        dealer_id: dealerId,
        company_name: data.shopName.trim(),
        owner_name: data.ownerName.trim(),
        mobile: data.mobile.replace(/\s+/g, ''),
        email: data.email.trim(),
        village: data.village?.trim() || null,
        district: data.district?.trim() || null,
        state: data.state?.trim() || null,
        pin_code: data.pinCode?.trim() || null,
        status: 'active',
        subscription_plan: 'basic',
        created_at: new Date().toISOString(),
      });

      if (dealerError) throw dealerError;

      toast.success('Registration successful! Please check your email to verify your account.');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="col-span-full h-1 shrink-0 bg-gradient-to-r from-primary via-primary-strong to-primary lg:hidden"
        aria-hidden
      />

      <AuthVisualPanel
        imageSrc="/auth/register.png"
        imageAlt="A new sprout in soil — beginning of a journey"
        headline="Plant the seed of a better business."
        subline="Join 1,000+ Indian agri dealers running their shops with PrithviX. Setup takes 5 minutes."
        testimonial={{
          quote: 'I switched from notebooks to PrithviX in one week. My CA finally has clean data.',
          author: 'Suresh Kumar',
          role: 'Krishi Bandhu, Hisar',
        }}
      />

      <div className="flex min-h-screen flex-col bg-background lg:overflow-y-auto">
        <div className="flex flex-1 flex-col px-4 py-8 lg:justify-center lg:px-12 lg:py-12">
          <Link
            href="/login"
            className="mb-6 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Login
          </Link>

          <div className="mx-auto w-full max-w-2xl space-y-6">
            <div className="lg:hidden">
              <div className="mb-3 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Leaf className="h-7 w-7 text-primary" />
                </div>
              </div>
              <h1 className="text-center text-2xl font-bold tracking-tight">Register as Dealer</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">Join the PrithviX Partner network</p>
            </div>

            <div className="hidden lg:block">
              <h1 className="text-3xl font-bold tracking-tight">Register as Dealer</h1>
              <p className="mt-1 text-sm text-muted-foreground">Join the PrithviX Partner network</p>
            </div>

            <Card className="p-6 shadow-lg">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Shop Details */}
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Store className="h-5 w-5 text-primary" />
                  Shop Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shopName">Shop Name *</Label>
                    <Input
                      id="shopName"
                      placeholder="Your shop name"
                      {...form.register('shopName')}
                    />
                    {form.formState.errors.shopName && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.shopName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerName">Owner Name *</Label>
                    <Input
                      id="ownerName"
                      placeholder="Your full name"
                      {...form.register('ownerName')}
                    />
                    {form.formState.errors.ownerName && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.ownerName.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <MapPin className="h-5 w-5 text-primary" />
                  Location
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="village">Village</Label>
                    <Input
                      id="village"
                      placeholder="Village name"
                      {...form.register('village')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pinCode">PIN Code</Label>
                    <Input
                      id="pinCode"
                      placeholder="6-digit PIN"
                      maxLength={6}
                      {...form.register('pinCode')}
                    />
                    {form.formState.errors.pinCode && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.pinCode.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">District</Label>
                    <Input
                      id="district"
                      placeholder="District"
                      {...form.register('district')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      placeholder="State"
                      {...form.register('state')}
                    />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Phone className="h-5 w-5 text-primary" />
                  Contact Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      {...form.register('email')}
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile Number *</Label>
                    <Input
                      id="mobile"
                      placeholder="10-digit mobile"
                      maxLength={10}
                      {...form.register('mobile')}
                    />
                    {form.formState.errors.mobile && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.mobile.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Lock className="h-5 w-5 text-primary" />
                  Set Password
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Min. 6 characters"
                      {...form.register('password')}
                    />
                    {form.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Re-enter password"
                      {...form.register('confirmPassword')}
                    />
                    {form.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Register'}
              </Button>
            </form>
          </Card>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
