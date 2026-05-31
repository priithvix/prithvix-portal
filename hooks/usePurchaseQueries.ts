'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  createGRN,
  createPurchaseInvoice,
  createPurchaseOrder,
  deleteSupplier,
  getGRN,
  getGRNs,
  getPayablesDashboard,
  getPurchaseInvoice,
  getPurchaseInvoices,
  getPurchaseOrder,
  getPurchaseOrders,
  getSupplier,
  getSupplierLedger,
  getSupplierUnpaidMap,
  getSuppliers,
  postGRN,
  postPurchaseInvoice,
  updatePOStatus,
  upsertSupplier,
  type SupplierInput,
  type POStatus,
} from '@/lib/supabase/purchase';

export function useSuppliersQuery() {
  const { session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['suppliers', dealerId],
    queryFn: () => getSuppliers(dealerId),
    enabled: !!dealerId,
  });
}

export function useSupplierUnpaidMapQuery() {
  const { session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['supplier-unpaid', dealerId],
    queryFn: () => getSupplierUnpaidMap(dealerId),
    enabled: !!dealerId,
  });
}

export function useSupplierQuery(id: string | null) {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: () => (id ? getSupplier(id) : null),
    enabled: !!id,
  });
}

export function useUpsertSupplierMutation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: SupplierInput & { id?: string }) => {
      if (!session?.dealerRowId) throw new Error('Not logged in');
      return upsertSupplier({ ...input, dealer_id: session.dealerRowId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      void qc.invalidateQueries({ queryKey: ['supplier-unpaid'] });
    },
  });
}

export function useDeleteSupplierMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function usePurchaseOrdersQuery(from?: string, to?: string) {
  const { session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['purchase-orders', dealerId, from, to],
    queryFn: () => getPurchaseOrders(dealerId, from, to),
    enabled: !!dealerId,
  });
}

export function usePurchaseOrderQuery(id: string | null) {
  return useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => (id ? getPurchaseOrder(id) : null),
    enabled: !!id,
  });
}

type CreatePurchaseOrderArgs = Omit<Parameters<typeof createPurchaseOrder>[0], 'dealerId'>;

export function useCreatePOMutation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (args: CreatePurchaseOrderArgs) => {
      if (!session?.dealerRowId) throw new Error('Not logged in');
      return createPurchaseOrder({ ...args, dealerId: session.dealerRowId });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}

export function useUpdatePOStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: POStatus }) => updatePOStatus(id, status),
    onSuccess: (_data, v) => {
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      void qc.invalidateQueries({ queryKey: ['purchase-order', v.id] });
    },
  });
}

export function useGRNsQuery() {
  const { session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['grns', dealerId],
    queryFn: () => getGRNs(dealerId),
    enabled: !!dealerId,
  });
}

export function useGRNQuery(id: string | null) {
  return useQuery({
    queryKey: ['grn', id],
    queryFn: () => (id ? getGRN(id) : null),
    enabled: !!id,
  });
}

export function useCreateGRNMutation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (args: Omit<Parameters<typeof createGRN>[0], 'dealerId'>) => {
      if (!session?.dealerRowId) throw new Error('Not logged in');
      return createGRN({ ...args, dealerId: session.dealerRowId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['grns'] });
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

export function usePostGRNMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postGRN,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['grns'] });
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      void qc.invalidateQueries({ queryKey: ['inventory_v2'] });
    },
  });
}

export function usePurchaseInvoicesQuery() {
  const { session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['purchase-invoices', dealerId],
    queryFn: () => getPurchaseInvoices(dealerId),
    enabled: !!dealerId,
  });
}

export function usePurchaseInvoiceQuery(id: string | null) {
  return useQuery({
    queryKey: ['purchase-invoice', id],
    queryFn: () => (id ? getPurchaseInvoice(id) : null),
    enabled: !!id,
  });
}

export function useCreatePIMutation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (args: Omit<Parameters<typeof createPurchaseInvoice>[0], 'dealerId'>) => {
      if (!session?.dealerRowId) throw new Error('Not logged in');
      return createPurchaseInvoice({ ...args, dealerId: session.dealerRowId });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['purchase-invoices'] }),
  });
}

export function usePostPIMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postPurchaseInvoice,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchase-invoices'] });
      void qc.invalidateQueries({ queryKey: ['supplier-unpaid'] });
    },
  });
}

export function useSupplierLedgerQuery(supplierId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['supplier-ledger', supplierId, from, to],
    queryFn: async () => {
      if (!supplierId) return null;
      const s = await getSupplier(supplierId);
      if (!s) return null;
      return getSupplierLedger(s, from, to);
    },
    enabled: !!supplierId,
  });
}

export function usePayablesQuery(asOn: Date) {
  const { session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['payables', dealerId, asOn.toISOString().slice(0, 10)],
    queryFn: () => getPayablesDashboard(dealerId, asOn),
    enabled: !!dealerId,
  });
}
