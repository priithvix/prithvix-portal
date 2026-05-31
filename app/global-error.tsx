'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-6 pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                
                <h1 className="mb-2 text-2xl font-bold text-foreground">
                  Application Error
                </h1>
                
                <p className="mb-4 text-sm text-muted-foreground">
                  A critical error occurred. Please refresh the page or contact support if the problem persists.
                </p>

                {error.digest && (
                  <p className="mb-4 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    Error ID: {error.digest}
                  </p>
                )}

                <div className="flex w-full flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={reset}
                    variant="default"
                    className="flex-1"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  
                  <Button
                    onClick={() => (window.location.href = '/home')}
                    variant="outline"
                    className="flex-1"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
