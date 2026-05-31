'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Farmer, CropCycle, Visit, CropStage, VisitItem } from '@/constants/types';
import { useAuth } from './AuthContext';
import { supabase, uploadFarmerPhoto, uploadVisitPhoto, isRemoteImageUri } from '@/lib/supabase/client';
import { ensureFarmerPartyLedgerRpc } from '@/lib/supabase/be-tally-sync';

// ID generators (ported from mobile utils/id.ts)
function generateFarmerId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'FMR_';
  for (let i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateVisitId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'VST_';
  for (let i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Mapper functions
function mapSupabaseFarmer(r: Record<string, unknown>): Farmer {
  return {
    id: r.id as string,
    dealerId: r.dealer_id as string,
    createdBy: r.created_by as string,
    createdByRole: r.created_by_role as Farmer['createdByRole'],
    fullName: r.full_name as string,
    mobile: r.mobile as string,
    village: (r.village as string) ?? '',
    taluka: (r.taluka as string) ?? '',
    district: (r.district as string) ?? '',
    latitude: typeof r.latitude === 'number' ? r.latitude : undefined,
    longitude: typeof r.longitude === 'number' ? r.longitude : undefined,
    aadhaar: r.aadhaar as string | undefined,
    cropCycle: (r.crop_cycle as CropCycle[]) ?? [],
    photoUri: r.photo_uri as string | undefined,
    consentGiven: (r.consent_given as boolean) ?? true,
    createdAt: r.created_at as string,
    creditLimit: r.credit_limit as number | undefined,
  };
}

function mapSupabaseVisit(r: Record<string, unknown>): Visit {
  return {
    id: r.id as string,
    farmerId: r.farmer_id as string,
    dealerId: r.dealer_id as string,
    cropStage: r.crop_stage as CropStage,
    issues: (r.issues as string[]) ?? [],
    customIssue: r.custom_issue as string | undefined,
    notes: (r.notes as string) ?? '',
    recommendedProduct: r.recommended_product as string | undefined,
    followUpDate: r.follow_up_date as string | undefined,
    photoUri: r.photo_uri as string | undefined,
    loggedBy: r.logged_by as string,
    loggedByRole: r.logged_by_role as Visit['loggedByRole'],
    createdAt: r.created_at as string,
    items: r.items as VisitItem[] | undefined,
    saleId: r.sale_id as string | undefined,
  };
}

// Context interface
interface DataContextValue {
  farmers: Farmer[];
  visits: Visit[];
  isLoading: boolean;
  registerFarmer: (data: {
    fullName: string;
    mobile: string;
    village: string;
    taluka: string;
    district: string;
    latitude?: number;
    longitude?: number;
    aadhaar?: string;
    cropCycle: CropCycle[];
    photoUri?: string;
  }) => Promise<Farmer>;
  updateFarmer: (farmerId: string, updates: Partial<Farmer>) => Promise<void>;
  logVisit: (data: {
    farmerId: string;
    cropStage: CropStage;
    issues: string[];
    customIssue?: string;
    notes: string;
    recommendedProduct?: string;
    followUpDate?: string;
    photoUri?: string;
    items?: VisitItem[];
  }) => Promise<Visit>;
  refetchFarmers: () => Promise<void>;
  refetchVisits: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [farmers, setFarmers] = useState<Farmer[]>([]);

  // Fetch farmers
  const farmersQuery = useQuery({
    queryKey: ['farmers', session?.dealerRowId],
    queryFn: async () => {
      if (!session) return [];

      const { data: rows, error } = await supabase
        .from('farmers')
        .select('*')
        .eq('dealer_id', session.dealerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Data] Farmers fetch error:', error.message);
        return [];
      }
      return (rows ?? []).map(mapSupabaseFarmer);
    },
    enabled: !!session,
  });

  useEffect(() => {
    if (farmersQuery.data) {
      setFarmers(farmersQuery.data);
    }
  }, [farmersQuery.data]);

  // Fetch visits
  const visitsQuery = useQuery({
    queryKey: ['visits', session?.dealerRowId],
    queryFn: async () => {
      if (!session) return [];

      const { data: rows, error } = await supabase
        .from('visits')
        .select('*')
        .eq('dealer_id', session.dealerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Data] Visits fetch error:', error.message);
        return [];
      }
      return (rows ?? []).map(mapSupabaseVisit);
    },
    enabled: !!session,
  });

  // Register farmer mutation
  const registerFarmerMutation = useMutation({
    mutationFn: async (data: {
      fullName: string;
      mobile: string;
      village: string;
      taluka: string;
      district: string;
      latitude?: number;
      longitude?: number;
      aadhaar?: string;
      cropCycle: CropCycle[];
      photoUri?: string;
    }) => {
      if (!session) throw new Error('Not authenticated');

      const normalizedMobile = data.mobile.trim().replace(/\s+/g, '');
      const normalizedAadhaar = data.aadhaar?.trim().replace(/\s+/g, '');
      const normalizedName = data.fullName.trim();

      const farmerId = generateFarmerId();
      const now = new Date().toISOString();

      // Check for duplicate mobile
      const { data: dupPhone } = await supabase
        .from('farmers')
        .select('id')
        .eq('dealer_id', session.dealerId)
        .ilike('mobile', normalizedMobile)
        .maybeSingle();

      if (dupPhone) throw new Error(`A farmer with mobile ${normalizedMobile} is already registered`);

      // Check for duplicate Aadhaar if provided
      if (normalizedAadhaar) {
        const { data: dupAadhaar } = await supabase
          .from('farmers')
          .select('id')
          .eq('dealer_id', session.dealerId)
          .ilike('aadhaar', normalizedAadhaar)
          .maybeSingle();

        if (dupAadhaar) throw new Error('A farmer with this Aadhaar is already registered');
      }

      // Upload photo if provided
      let finalPhotoUri = data.photoUri;
      if (data.photoUri) {
        const uploadedUrl = await uploadFarmerPhoto(data.photoUri, farmerId, session.dealerRowId);
        if (uploadedUrl) {
          finalPhotoUri = uploadedUrl;
        }
      }

      // Insert farmer
      const { error } = await supabase.from('farmers').insert({
        id: farmerId,
        dealer_id: session.dealerId,
        created_by: session.userId,
        created_by_role: session.role,
        full_name: normalizedName,
        mobile: normalizedMobile,
        village: data.village.trim(),
        taluka: data.taluka.trim(),
        district: data.district.trim(),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        aadhaar: normalizedAadhaar,
        crop_cycle: data.cropCycle,
        photo_uri: finalPhotoUri,
        consent_given: true,
        created_at: now,
      });

      if (error) throw new Error('Failed to register farmer: ' + error.message);

      try {
        await ensureFarmerPartyLedgerRpc(session.dealerId, farmerId);
      } catch (ledgerErr) {
        console.warn('[Data] Farmer ledger sync skipped:', ledgerErr);
      }

      queryClient.invalidateQueries({ queryKey: ['farmers', session.dealerRowId] });

      return {
        id: farmerId,
        dealerId: session.dealerId,
        createdBy: session.userId,
        createdByRole: session.role,
        fullName: normalizedName,
        mobile: normalizedMobile,
        village: data.village.trim(),
        taluka: data.taluka.trim(),
        district: data.district.trim(),
        latitude: data.latitude,
        longitude: data.longitude,
        aadhaar: normalizedAadhaar,
        cropCycle: data.cropCycle,
        photoUri: finalPhotoUri,
        consentGiven: true,
        createdAt: now,
      } as Farmer;
    },
  });

  // Update farmer mutation
  const updateFarmerMutation = useMutation({
    mutationFn: async ({ farmerId, updates }: { farmerId: string; updates: Partial<Farmer> }) => {
      if (!session) throw new Error('Not authenticated');

      const updatePayload: Record<string, unknown> = {};
      if (updates.fullName) updatePayload.full_name = updates.fullName.trim();
      if (updates.mobile) updatePayload.mobile = updates.mobile.trim().replace(/\s+/g, '');
      if (updates.village !== undefined) updatePayload.village = updates.village.trim();
      if (updates.taluka !== undefined) updatePayload.taluka = updates.taluka.trim();
      if (updates.district !== undefined) updatePayload.district = updates.district.trim();
      if (updates.latitude !== undefined) updatePayload.latitude = updates.latitude;
      if (updates.longitude !== undefined) updatePayload.longitude = updates.longitude;
      if (updates.aadhaar !== undefined) updatePayload.aadhaar = updates.aadhaar?.trim().replace(/\s+/g, '');
      if (updates.cropCycle) updatePayload.crop_cycle = updates.cropCycle;
      if (updates.photoUri !== undefined) {
        // Upload new photo if provided and not remote
        if (updates.photoUri && !isRemoteImageUri(updates.photoUri)) {
          const uploadedUrl = await uploadFarmerPhoto(updates.photoUri, farmerId, session.dealerRowId);
          updatePayload.photo_uri = uploadedUrl || updates.photoUri;
        } else {
          updatePayload.photo_uri = updates.photoUri;
        }
      }

      const { error } = await supabase
        .from('farmers')
        .update(updatePayload)
        .eq('id', farmerId)
        .eq('dealer_id', session.dealerId);

      if (error) throw new Error('Failed to update farmer: ' + error.message);

      queryClient.invalidateQueries({ queryKey: ['farmers', session.dealerRowId] });
    },
  });

  // Log visit mutation
  const logVisitMutation = useMutation({
    mutationFn: async (data: {
      farmerId: string;
      cropStage: CropStage;
      issues: string[];
      customIssue?: string;
      notes: string;
      recommendedProduct?: string;
      followUpDate?: string;
      photoUri?: string;
      items?: VisitItem[];
    }) => {
      if (!session) throw new Error('Not authenticated');

      const visitId = generateVisitId();
      const now = new Date().toISOString();

      // Upload photo if provided
      let visitPhotoUri = data.photoUri;
      if (visitPhotoUri && !isRemoteImageUri(visitPhotoUri)) {
        const uploaded = await uploadVisitPhoto(visitPhotoUri, visitId, session.dealerRowId);
        if (uploaded) visitPhotoUri = uploaded;
      }

      // Insert visit
      const { error } = await supabase.from('visits').insert({
        id: visitId,
        farmer_id: data.farmerId,
        dealer_id: session.dealerId,
        crop_stage: data.cropStage,
        issues: data.issues,
        custom_issue: data.customIssue,
        notes: data.notes,
        recommended_product: data.recommendedProduct,
        follow_up_date: data.followUpDate,
        photo_uri: visitPhotoUri,
        logged_by: session.userId,
        logged_by_role: session.role,
        created_at: now,
        items: data.items,
      });

      if (error) throw new Error('Failed to log visit: ' + error.message);

      queryClient.invalidateQueries({ queryKey: ['visits', session.dealerRowId] });

      return {
        id: visitId,
        farmerId: data.farmerId,
        dealerId: session.dealerId,
        cropStage: data.cropStage,
        issues: data.issues,
        customIssue: data.customIssue,
        notes: data.notes,
        recommendedProduct: data.recommendedProduct,
        followUpDate: data.followUpDate,
        photoUri: visitPhotoUri,
        loggedBy: session.userId,
        loggedByRole: session.role,
        createdAt: now,
        items: data.items,
      } as Visit;
    },
  });

  const value: DataContextValue = {
    farmers,
    visits: visitsQuery.data ?? [],
    isLoading: farmersQuery.isLoading || visitsQuery.isLoading,
    registerFarmer: registerFarmerMutation.mutateAsync,
    updateFarmer: (farmerId, updates) => updateFarmerMutation.mutateAsync({ farmerId, updates }),
    logVisit: logVisitMutation.mutateAsync,
    refetchFarmers: () => queryClient.invalidateQueries({ queryKey: ['farmers', session?.dealerRowId] }),
    refetchVisits: () => queryClient.invalidateQueries({ queryKey: ['visits', session?.dealerRowId] }),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
