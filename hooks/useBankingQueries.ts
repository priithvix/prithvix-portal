'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { ParsedBankLine } from '@/lib/banking/csv-parser';
import {
  autoMatchBankStatement,
  computeOverdueInterest,
  countOverduePdc,
  getBankAccounts,
  getBankReconciliation,
  getCheques,
  getFarmerSaleOutstandings,
  getLastBankImportSummary,
  getPayablesAgeing,
  getReceivablesAgeing,
  getSupplierPiOutstandings,
  getUnclearedIssuedCheques,
  getUnmatchedLines,
  importBankStatementLines,
  linkBankLineToVoucher,
  listComputedInterest,
  markBankStatementLineManual,
  postFarmerPaymentReceiptRpc,
  postSupplierPaymentVoucherRpc,
  updateChequeStatus,
  type BankAccountRow,
} from '@/lib/supabase/banking';
import { supabase } from '@/lib/supabase/client';

export function useBankAccountsQuery() {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['bank-accounts', dealerId],
    queryFn: () => getBankAccounts(dealerId),
    enabled: !!dealerId,
  });
}

export function useReceivablesAgeingQuery(asOnIso: string) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['receivables-ageing', dealerId, asOnIso],
    queryFn: () => getReceivablesAgeing(dealerId, new Date(asOnIso)),
    enabled: !!dealerId && !!asOnIso,
  });
}

export function usePayablesAgeingQuery(asOnIso: string) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['payables-ageing', dealerId, asOnIso],
    queryFn: () => getPayablesAgeing(dealerId, new Date(asOnIso)),
    enabled: !!dealerId && !!asOnIso,
  });
}

export function useFarmerSalesOutstandingQuery(farmerId: string | null) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['farmer-sales-os', dealerId, farmerId],
    queryFn: () => (farmerId ? getFarmerSaleOutstandings(dealerId, farmerId) : []),
    enabled: !!dealerId && !!farmerId,
  });
}

export function useSupplierPiOutstandingQuery(supplierId: string | null) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['supplier-pi-os', dealerId, supplierId],
    queryFn: () => (supplierId ? getSupplierPiOutstandings(dealerId, supplierId) : []),
    enabled: !!dealerId && !!supplierId,
  });
}

export function useChequesQuery(filters: Parameters<typeof getCheques>[1]) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['cheques', dealerId, filters],
    queryFn: () => getCheques(dealerId, filters),
    enabled: !!dealerId,
  });
}

export function usePdcAlertsQuery() {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['pdc-overdue', dealerId],
    queryFn: () => countOverduePdc(dealerId, new Date()),
    enabled: !!dealerId,
  });
}

export function useBankBookQuery(acc: BankAccountRow | null, fromIso: string, toIso: string) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  const lid = acc?.ledger_id ?? null;
  return useQuery({
    queryKey: ['bank-book', dealerId, lid, fromIso, toIso],
    enabled: !!dealerId && !!lid && !!fromIso && !!toIso,
    queryFn: async () => {
      const { getBankBook, openingBalanceBankLedger } = await import('@/lib/supabase/banking');
      if (!lid) return { opening: 0, lines: [], closingNet: 0 };
      const open = await openingBalanceBankLedger(dealerId, lid, fromIso.slice(0, 10));
      const lines = await getBankBook(dealerId, lid, fromIso.slice(0, 10), toIso.slice(0, 10));
      const movement = lines.reduce((n, r) => n + r.dr - r.cr, 0);
      const closingNet = Math.round((open + movement) * 100) / 100;
      return { opening: open, lines, closingNet };
    },
  });
}

export function useBankRecQuery(acc: BankAccountRow | null, asOnIso: string) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  const id = acc?.id ?? '';
  const lid = acc?.ledger_id ?? null;
  return useQuery({
    queryKey: ['bank-rec', dealerId, id, lid, asOnIso],
    enabled: !!dealerId && !!id && !!asOnIso,
    queryFn: () => getBankReconciliation(dealerId, id, lid, asOnIso.slice(0, 10)),
  });
}

export function useUnclearedIssuedChequesQuery(bankAccountId: string | null) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['uncleared-cheques', dealerId, bankAccountId],
    enabled: !!dealerId && !!bankAccountId,
    queryFn: () =>
      bankAccountId ? getUnclearedIssuedCheques(dealerId, bankAccountId) : ([] as Awaited<ReturnType<typeof getUnclearedIssuedCheques>>),
  });
}

export function useInterestPreviewQuery(enabled: boolean) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['interest-preview', dealerId],
    enabled: !!dealerId && enabled,
    queryFn: () => listComputedInterest(dealerId),
  });
}

export function useComputeInterestMutation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useMutation({
    mutationFn: (asOn: Date) => computeOverdueInterest(dealerId, asOn),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interest-preview'] });
    },
  });
}

export function useImportStatementMutation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useMutation({
    mutationFn: async (args: { bankAccountId: string; batchId: string; lines: ParsedBankLine[] }) => {
      return importBankStatementLines(dealerId, args.bankAccountId, args.batchId, args.lines);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      void qc.invalidateQueries({ queryKey: ['last-import'] });
      void qc.invalidateQueries({ queryKey: ['unmatched-bsl'] });
      void qc.invalidateQueries({ queryKey: ['bank-rec'] });
      void qc.invalidateQueries({ queryKey: ['uncleared-cheques'] });
    },
  });
}

export function useAutoMatchMutation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useMutation({
    mutationFn: (args: { bankAccountId: string; batchId: string }) =>
      autoMatchBankStatement(dealerId, args.bankAccountId, args.batchId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unmatched-bsl'] });
      void qc.invalidateQueries({ queryKey: ['bank-rec'] });
    },
  });
}

export function useLinkBankLineMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, voucherId }: { lineId: string; voucherId: string }) =>
      linkBankLineToVoucher(lineId, voucherId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unmatched-bsl'] });
      void qc.invalidateQueries({ queryKey: ['bank-rec'] });
    },
  });
}

export function useMarkBankLineManualMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => markBankStatementLineManual(lineId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unmatched-bsl'] });
      void qc.invalidateQueries({ queryKey: ['bank-rec'] });
    },
  });
}

export function useUpdateChequeStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      status: string;
      meta?: { clearing_date?: string; bank_ref?: string; bounce_reason?: string };
    }) => updateChequeStatus(args.id, args.status, args.meta),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cheques'] });
      void qc.invalidateQueries({ queryKey: ['uncleared-cheques'] });
      void qc.invalidateQueries({ queryKey: ['bank-rec'] });
    },
  });
}

export function useUnmatchedLinesQuery(bankAccountId: string | null) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['unmatched-bsl', dealerId, bankAccountId],
    enabled: !!dealerId && !!bankAccountId,
    queryFn: () => (bankAccountId ? getUnmatchedLines(dealerId, bankAccountId) : []),
  });
}

export function useLastImportSummaryQuery(bankAccountId: string | null) {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  return useQuery({
    queryKey: ['last-import', dealerId, bankAccountId],
    enabled: !!dealerId && !!bankAccountId,
    queryFn: () =>
      bankAccountId ? getLastBankImportSummary(dealerId, bankAccountId).catch(() => null) : null,
  });
}

export function usePostFarmerReceiptMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postFarmerPaymentReceiptRpc,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['receivables-ageing'] });
    },
  });
}

export function usePostSupplierPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postSupplierPaymentVoucherRpc,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchase-invoices'] });
      void qc.invalidateQueries({ queryKey: ['payables-ageing'] });
    },
  });
}

export async function tryResolveDebtorLedger(dealerId: string, farmerName: string): Promise<string | null> {
  const codes = ['SUNDRY_DEBTORS', 'SUNDRY_DR', 'SD'];
  for (const code of codes) {
    const g = await supabase.from('ledger_groups').select('id').eq('dealer_id', dealerId).eq('group_code', code).maybeSingle();
    if (!g.error && g.data?.id) {
      const ins = await supabase
        .from('ledgers')
        .insert({
          dealer_id: dealerId,
          name: farmerName.slice(0, 120),
          ledger_code: `SD_${farmerName.slice(0, 8).replace(/\s+/g, '_')}_${Date.now().toString(36)}`,
          ledger_group_id: g.data.id,
        })
        .select('id')
        .single();
      if (!ins.error && ins.data?.id) return ins.data.id as string;
    }
  }

  const insBare = await supabase
    .from('ledgers')
    .insert({
      dealer_id: dealerId,
      name: farmerName.slice(0, 120),
      ledger_code: `SD_${Date.now().toString(36)}`,
    })
    .select('id')
    .single();
  if (!insBare.error && insBare.data?.id) return insBare.data.id as string;
  return null;
}
