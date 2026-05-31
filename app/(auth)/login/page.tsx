'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Lock, User, Sprout, ArrowRight } from 'lucide-react';
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Link from 'next/link';

const dealerSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const staffSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type DealerFormData = z.infer<typeof dealerSchema>;
type StaffFormData = z.infer<typeof staffSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, staffLogin, isReady } = useAuth();
  const [mode, setMode] = useState<'dealer' | 'staff'>('dealer');
  const [isLoading, setIsLoading] = useState(false);

  const dealerForm = useForm<DealerFormData>({
    resolver: zodResolver(dealerSchema),
    defaultValues: { email: '', password: '' },
  });

  const staffForm = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: { username: '', password: '' },
  });

  const onDealerSubmit = async (data: DealerFormData) => {
    if (!isReady) return;
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      router.push('/workspace');
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const onStaffSubmit = async (data: StaffFormData) => {
    if (!isReady) return;
    setIsLoading(true);
    try {
      await staffLogin(data.username, data.password);
      toast.success('Welcome back!');
      router.push('/home');
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
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
        imageSrc="/auth/login.png"
        imageAlt="Indian farmer in wheat field at sunrise"
        headline="Welcome back to your fields."
        subline="Run your agri retail like a pro. Farmers, inventory, udhaar, GST invoices — all in one place."
        testimonial={{
          quote:
            'PrithviX cut our daily closing time from 2 hours to 10 minutes. The compliance pack alone is worth it.',
          author: 'Ramesh Patel',
          role: 'Patel Krishi Kendra, Anand',
        }}
      />

      {/* Right Side - Form */}
      <div className="flex w-full items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="flex justify-center lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Sprout className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">PrithviX</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex rounded-lg border border-border bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setMode('dealer')}
              className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                mode === 'dealer'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dealer
            </button>
            <button
              type="button"
              onClick={() => setMode('staff')}
              className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                mode === 'staff'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Staff
            </button>
          </div>

          {/* Forms */}
          {mode === 'dealer' ? (
            <form onSubmit={dealerForm.handleSubmit(onDealerSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    {...dealerForm.register('email')}
                  />
                </div>
                {dealerForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {dealerForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    {...dealerForm.register('password')}
                  />
                </div>
                {dealerForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {dealerForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={isLoading || !isReady}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          ) : (
            <form onSubmit={staffForm.handleSubmit(onStaffSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Your username"
                    className="pl-10"
                    {...staffForm.register('username')}
                  />
                </div>
                {staffForm.formState.errors.username && (
                  <p className="text-sm text-destructive">
                    {staffForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="staff-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    {...staffForm.register('password')}
                  />
                </div>
                {staffForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {staffForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={isLoading || !isReady}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          )}

          {/* Register Link */}
          {mode === 'dealer' && (
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/register-dealer" className="font-medium text-primary hover:underline">
                Register as Dealer
              </Link>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground">
            © 2026 PrithviX. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
