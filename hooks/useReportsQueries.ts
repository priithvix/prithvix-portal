'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCashFlow,
  getComparativeMonthlyPurchases,
  getComparativeMonthlySales,
  getDayBook,
  getLedgerPickList,
  getLedgerStatement,
  getProductHsnCodes,
  getPurchaseRegister,
  getPurchaseRegisterGstByRate,
  getSalesRegister,
  getTrialBalance,
} from '@/lib/supabase/reports';

export function useSalesRegisterQuery(
  fromIso: string,
  toIso: string,
  partyId?: string | null,
  hsnCode?: string | null
) {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['sales-register', id, fromIso, toIso, partyId, hsnCode],
    queryFn: () => getSalesRegister(id, new Date(fromIso), new Date(toIso), partyId, hsnCode),
    enabled: !!id && !!fromIso && !!toIso,
    staleTime: 5 * 60_000,
  });
}

export function usePurchaseRegisterQuery(fromIso: string, toIso: string, supplierId?: string | null) {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['purchase-register', id, fromIso, toIso, supplierId],
    queryFn: () => getPurchaseRegister(id, new Date(fromIso), new Date(toIso), supplierId),
    enabled: !!id && !!fromIso && !!toIso,
    staleTime: 5 * 60_000,
  });
}

export function usePurchaseGstByRateQuery(fromIso: string, toIso: string, supplierId?: string | null) {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['purchase-gst-rate', id, fromIso, toIso, supplierId],
    queryFn: () => getPurchaseRegisterGstByRate(id, new Date(fromIso), new Date(toIso), supplierId),
    enabled: !!id && !!fromIso && !!toIso,
    staleTime: 5 * 60_000,
  });
}

export function useLedgerStatementQuery(ledgerId: string | null, fromIso: string, toIso: string) {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['ledger-statement', id, ledgerId, fromIso, toIso],
    queryFn: () => getLedgerStatement(id, ledgerId!, new Date(fromIso), new Date(toIso)),
    enabled: !!id && !!ledgerId && !!fromIso && !!toIso,
    staleTime: 5 * 60_000,
  });
}

export function useCashFlowQuery(fromIso: string, toIso: string) {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['cash-flow', id, fromIso, toIso],
    queryFn: () => getCashFlow(id, new Date(fromIso), new Date(toIso)),
    enabled: !!id && !!fromIso && !!toIso,
    staleTime: 5 * 60_000,
  });
}

export function useComparativeSalesQuery(fy: string, compareFy: string) {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['comparative-sales', id, fy, compareFy],
    queryFn: () => getComparativeMonthlySales(id, fy, compareFy),
    enabled: !!id && !!fy && !!compareFy,
    staleTime: 5 * 60_000,
  });
}

export function useComparativePurchasesQuery(fy: string, compareFy: string) {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['comparative-purchases', id, fy, compareFy],
    queryFn: () => getComparativeMonthlyPurchases(id, fy, compareFy),
    enabled: !!id && !!fy && !!compareFy,
    staleTime: 5 * 60_000,
  });
}

export function useTrialBalanceQuery(asOnIso: string) {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['trial-balance', id, asOnIso],
    queryFn: () => getTrialBalance(id, new Date(asOnIso)),
    enabled: !!id && !!asOnIso,
    staleTime: 5 * 60_000,
  });
}

export function useDayBookQuery(fromIso: string, toIso: string) {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['day-book', id, fromIso, toIso],
    queryFn: () => getDayBook(id, new Date(fromIso), new Date(toIso)),
    enabled: !!id && !!fromIso && !!toIso,
    staleTime: 5 * 60_000,
  });
}

export function useLedgerPickListQuery() {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['ledger-pick', id],
    queryFn: () => getLedgerPickList(id),
    enabled: !!id,
    staleTime: 30 * 60_000,
  });
}

export function useProductHsnCodesQuery() {
  const { session } = useAuth();
  const id = session?.dealerRowId ?? '';
  return useQuery({
    queryKey: ['product-hsn', id],
    queryFn: () => getProductHsnCodes(id),
    enabled: !!id,
    staleTime: 30 * 60_000,
  });
}
