'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  computeGstr3b,
  generateGstr1,
  getGstr1Records,
  getGstr2bRecords,
  getGstr3bSummary,
  getGstPeriod,
  getHsnSummary,
  reconcileGstr2b,
  regenerateHsnSummary,
  uploadGstr2bRecords,
} from '@/lib/supabase/gst';
import type { Gstr2bParsedRecord } from '@/lib/gst/gstr2b-parser';

export function useGstPeriod(dealerId: string | undefined, period: string) {
  return useQuery({
    queryKey: ['gst-period', dealerId, period],
    queryFn: () => (dealerId ? getGstPeriod(dealerId, period) : null),
    enabled: !!dealerId && !!period,
  });
}

export function useGstr1(dealerId: string | undefined, period: string) {
  return useQuery({
    queryKey: ['gstr1', dealerId, period],
    queryFn: () => (dealerId ? getGstr1Records(dealerId, period) : []),
    enabled: !!dealerId && !!period,
  });
}

export function useGenerateGstr1(dealerId: string | undefined, period: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!dealerId) throw new Error('Not signed in');
      return generateGstr1(dealerId, period);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gstr1', dealerId, period] });
      qc.invalidateQueries({ queryKey: ['hsn', dealerId, period, 'OUTWARD'] });
      qc.invalidateQueries({ queryKey: ['gst-period', dealerId, period] });
    },
  });
}

export function useGstr3b(dealerId: string | undefined, period: string) {
  return useQuery({
    queryKey: ['gstr3b', dealerId, period],
    queryFn: () => (dealerId ? getGstr3bSummary(dealerId, period) : null),
    enabled: !!dealerId && !!period,
  });
}

export function useComputeGstr3b(dealerId: string | undefined, period: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!dealerId) throw new Error('Not signed in');
      return computeGstr3b(dealerId, period);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gstr3b', dealerId, period] }),
  });
}

export function useGstr2b(dealerId: string | undefined, period: string, filter?: string) {
  return useQuery({
    queryKey: ['gstr2b', dealerId, period, filter ?? 'all'],
    queryFn: () => (dealerId ? getGstr2bRecords(dealerId, period, filter) : []),
    enabled: !!dealerId && !!period,
  });
}

export function useUploadGstr2b(dealerId: string | undefined, period: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: Gstr2bParsedRecord[]) => {
      if (!dealerId) throw new Error('Not signed in');
      return uploadGstr2bRecords(dealerId, period, records);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gstr2b', dealerId, period] });
    },
  });
}

export function useReconcileGstr2b(dealerId: string | undefined, period: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!dealerId) throw new Error('Not signed in');
      return reconcileGstr2b(dealerId, period);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gstr2b', dealerId, period] });
      qc.invalidateQueries({ queryKey: ['gstr3b', dealerId, period] });
    },
  });
}

export function useHsnSummary(
  dealerId: string | undefined,
  period: string,
  direction: 'OUTWARD' | 'INWARD'
) {
  return useQuery({
    queryKey: ['hsn', dealerId, period, direction],
    queryFn: () => (dealerId ? getHsnSummary(dealerId, period, direction) : []),
    enabled: !!dealerId && !!period,
  });
}

export function useRegenerateHsn(dealerId: string | undefined, period: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (direction: 'OUTWARD' | 'INWARD') => {
      if (!dealerId) throw new Error('Not signed in');
      return regenerateHsnSummary(dealerId, period, direction);
    },
    onSuccess: (_d, direction) => {
      qc.invalidateQueries({ queryKey: ['hsn', dealerId, period, direction] });
    },
  });
}
