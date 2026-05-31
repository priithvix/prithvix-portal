'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useData } from '@/contexts/DataContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Save, MapPin, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { CropCycle } from '@/constants/types';

const cropCycles: { value: CropCycle; label: string }[] = [
  { value: 'kharif', label: 'Kharif (Jun-Nov)' },
  { value: 'rabi', label: 'Rabi (Nov-Mar)' },
  { value: 'summer', label: 'Summer (Mar-Jun)' },
];

// Form schema
const editFarmerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile must be exactly 10 digits'),
  village: z.string().min(1, 'Village is required'),
  taluka: z.string().min(1, 'Taluka is required'),
  district: z.string().min(1, 'District is required'),
  aadhaar: z.string().regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits').optional().or(z.literal('')),
  cropCycle: z.array(z.enum(['kharif', 'rabi', 'summer'])).min(1, 'Select at least one crop cycle'),
});

type EditFarmerFormData = z.infer<typeof editFarmerSchema>;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EditFarmerPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const farmerId = resolvedParams.id;
  const router = useRouter();
  const { farmers, updateFarmer, isLoading } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isFetchingGps, setIsFetchingGps] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success('Location captured — will be saved with form');
        setIsFetchingGps(false);
      },
      () => {
        toast.error('Unable to get location. Please allow location access.');
        setIsFetchingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const farmer = farmers.find((f) => f.id === farmerId);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<EditFarmerFormData>({
    resolver: zodResolver(editFarmerSchema),
    defaultValues: {
      cropCycle: [],
    },
  });

  const selectedCropCycles = watch('cropCycle');

  // Initialize form with farmer data
  useEffect(() => {
    if (farmer) {
      reset({
        fullName: farmer.fullName,
        mobile: farmer.mobile,
        village: farmer.village,
        taluka: farmer.taluka,
        district: farmer.district,
        aadhaar: farmer.aadhaar || '',
        cropCycle: farmer.cropCycle || [],
      });
      if (farmer.latitude && farmer.longitude) {
        setGpsCoords({ lat: farmer.latitude, lng: farmer.longitude });
      }
    }
  }, [farmer, reset]);

  const toggleCropCycle = (cycle: CropCycle) => {
    const current = selectedCropCycles || [];
    if (current.includes(cycle)) {
      setValue(
        'cropCycle',
        current.filter((c) => c !== cycle)
      );
    } else {
      setValue('cropCycle', [...current, cycle]);
    }
  };

  const onSubmit = async (data: EditFarmerFormData) => {
    setIsSubmitting(true);
    try {
      await updateFarmer(farmerId, {
        fullName: data.fullName,
        mobile: data.mobile,
        village: data.village,
        taluka: data.taluka,
        district: data.district,
        aadhaar: data.aadhaar || undefined,
        cropCycle: data.cropCycle,
        ...(gpsCoords ? { latitude: gpsCoords.lat, longitude: gpsCoords.lng } : {}),
      });

      toast.success('Farmer updated successfully!');
      router.push(`/farmers/${farmerId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update farmer');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold text-foreground">Farmer Not Found</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            The farmer you're trying to edit doesn't exist or has been removed.
          </p>
          <Link href="/farmers">
            <Button>Back to Farmers</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/farmers/${farmerId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Edit Farmer</h1>
            <p className="text-sm text-muted-foreground">Update farmer information</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  {...register('fullName')}
                  placeholder="Enter full name"
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="mobile">
                  Mobile Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mobile"
                  type="tel"
                  {...register('mobile')}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                />
                {errors.mobile && (
                  <p className="mt-1 text-xs text-red-600">{errors.mobile.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="aadhaar">Aadhaar Number (Optional)</Label>
                <Input
                  id="aadhaar"
                  type="text"
                  {...register('aadhaar')}
                  placeholder="12-digit Aadhaar number"
                  maxLength={12}
                />
                {errors.aadhaar && (
                  <p className="mt-1 text-xs text-red-600">{errors.aadhaar.message}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Location */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Location</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="village">
                  Village <span className="text-red-500">*</span>
                </Label>
                <Input id="village" type="text" {...register('village')} placeholder="Enter village" />
                {errors.village && (
                  <p className="mt-1 text-xs text-red-600">{errors.village.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="taluka">
                  Taluka <span className="text-red-500">*</span>
                </Label>
                <Input id="taluka" type="text" {...register('taluka')} placeholder="Enter taluka" />
                {errors.taluka && (
                  <p className="mt-1 text-xs text-red-600">{errors.taluka.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="district">
                  District <span className="text-red-500">*</span>
                </Label>
                <Input id="district" type="text" {...register('district')} placeholder="Enter district" />
                {errors.district && (
                  <p className="mt-1 text-xs text-red-600">{errors.district.message}</p>
                )}
              </div>

              {/* GPS Location */}
              <div>
                <Label>GPS Location (for Sales Map)</Label>
                <div className="mt-1.5 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGetLocation}
                    disabled={isFetchingGps}
                    className="w-full"
                  >
                    {isFetchingGps ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="mr-2 h-4 w-4" />
                    )}
                    {isFetchingGps
                      ? 'Getting location...'
                      : gpsCoords
                      ? '📍 Update GPS Location'
                      : '📍 Use My Current Location'}
                  </Button>
                  {gpsCoords && (
                    <p className="text-xs text-muted-foreground">
                      {farmer?.latitude && farmer?.longitude && !isFetchingGps
                        ? `Current: ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}`
                        : `New: ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Crop Cycles */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Crop Cycles <span className="text-red-500">*</span>
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Select the seasons when this farmer typically grows crops
            </p>
            <div className="space-y-2">
              {cropCycles.map((cycle) => (
                <label
                  key={cycle.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedCropCycles?.includes(cycle.value) || false}
                    onChange={() => toggleCropCycle(cycle.value)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
                  />
                  <span className="font-medium text-foreground">{cycle.label}</span>
                </label>
              ))}
            </div>
            {errors.cropCycle && (
              <p className="mt-2 text-xs text-red-600">{errors.cropCycle.message}</p>
            )}
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Link href={`/farmers/${farmerId}`} className="flex-1">
              <Button type="button" variant="outline" className="w-full" disabled={isSubmitting}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
              {isSubmitting ? (
                'Saving...'
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
