'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Sprout, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast.success('Password reset link sent! Check your email.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email. Please try again.');
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
        imageSrc="/auth/forgot.png"
        imageAlt="Sunset over Indian agricultural fields"
        headline="Take a breath. We'll get you back in."
        subline="Enter your email and we'll send a reset link. It happens to all of us."
      />

      {/* Right Side - Form */}
      <div className="flex w-full items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-center lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Sprout className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">PrithviX</span>
            </div>
          </div>

          {!emailSent ? (
            <>
              <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold tracking-tight">Forgot Password?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  No worries, we'll send you reset instructions
                </p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      className="pl-10"
                      {...form.register('email')}
                    />
                  </div>
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full gap-2" size="lg" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <div className="text-center">
                <Link href="/login" className="text-sm text-primary hover:underline">
                  ← Back to login
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold tracking-tight">Check Your Email</h2>
                <p className="mt-4 text-sm text-muted-foreground">
                  We've sent a password reset link to{' '}
                  <span className="font-semibold text-foreground">{form.getValues('email')}</span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Didn't receive the email? Check your spam folder or try again with a different email.
                </p>
              </div>

              <div className="space-y-3">
                <Button variant="outline" onClick={() => setEmailSent(false)} className="w-full">
                  Try Another Email
                </Button>
                <Link href="/login" className="block">
                  <Button variant="ghost" className="w-full">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </>
          )}

          <div className="text-center text-xs text-muted-foreground">
            © 2026 PrithviX. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
