'use client';

import Link from 'next/link';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>
            
            <h1 className="mb-2 text-6xl font-bold text-foreground">
              404
            </h1>
            
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Page Not Found
            </h2>
            
            <p className="mb-6 text-sm text-muted-foreground">
              The page you're looking for doesn't exist or has been moved.
            </p>

            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                asChild
                variant="default"
                className="flex-1"
              >
                <Link href="/home">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Link>
              </Button>
              
              <Button
                onClick={() => window.history.back()}
                variant="outline"
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
