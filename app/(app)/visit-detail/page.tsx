'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, User, MapPin, ClipboardList, AlertTriangle, 
  Package, CreditCard, ArrowLeft, FileText 
} from 'lucide-react';
import { format } from 'date-fns';
import { Visit, CropStage } from '@/constants/types';

const CROP_STAGE_LABELS: Record<CropStage, string> = {
  seedling: 'Seedling',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  fruiting: 'Fruiting',
  harvest: 'Harvest',
};

function VisitDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const visitJson = searchParams.get('visitJson');
  const farmerName = searchParams.get('farmerName');

  if (!visitJson) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No visit data available
            </p>
            <Button onClick={() => router.push('/home')} className="mt-4 w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  let visit: Visit;
  try {
    visit = JSON.parse(decodeURIComponent(visitJson));
  } catch (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-destructive">Invalid visit data</p>
            <Button onClick={() => router.push('/home')} className="mt-4 w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const decodedFarmerName = farmerName ? decodeURIComponent(farmerName) : 'Unknown Farmer';

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Visit Details
          </h1>
          <p className="mt-1 text-muted-foreground">
            {decodedFarmerName}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Visit Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Date</span>
              </div>
              <p className="text-sm font-medium">
                {format(new Date(visit.createdAt), 'dd MMM yyyy, hh:mm a')}
              </p>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Crop Stage</span>
              </div>
              <Badge variant="outline">
                {CROP_STAGE_LABELS[visit.cropStage]}
              </Badge>
            </div>

            {visit.notes && (
              <div className="border-t pt-3">
                <p className="mb-1 text-sm font-medium">Notes:</p>
                <p className="rounded-md bg-muted p-2 text-sm text-muted-foreground">
                  {visit.notes}
                </p>
              </div>
            )}

            {visit.issues && (
              <div className="border-t pt-3">
                <div className="mb-1 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <p className="text-sm font-medium">Issues/Complaints:</p>
                </div>
                <p className="rounded-md bg-warning/10 p-2 text-sm text-warning">
                  {visit.issues}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sale Items (if any) */}
        {visit.items && visit.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Sale Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {visit.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">{item.itemName || 'Unknown Item'}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {visit.saleId && (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => router.push(`/invoice?saleId=${visit.saleId}`)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Invoice
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Photo (if any) */}
        {visit.photoUri && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={visit.photoUri}
                alt="Visit photo"
                className="max-h-96 w-full rounded-md object-contain"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={() => router.push('/farmers')}>
          View All Farmers
        </Button>
        <Button onClick={() => router.push('/log-visit')}>
          Log Another Visit
        </Button>
      </div>
    </div>
  );
}

export default function VisitDetailPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading visit details...</div>}>
      <VisitDetailContent />
    </Suspense>
  );
}
