'use client';

import { createContext, useContext, useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sale,
  CreditPayment,
  LoyaltyTier,
  FarmerMetrics,
  PaymentMode,
  DiscountType,
  SaleItem,
} from '@/constants/types';
import { useAuth } from './AuthContext';
import { getFarmerCreditRow, getFarmerOutstandingSales, postFarmerPaymentReceiptRpc } from '@/lib/supabase/banking';
import {
  deductStockForBusinessEngineSale,
  ensureFarmerPartyLedgerRpc,
  postBeSaleVoucherRpc,
  restoreStockForBusinessEngineSale,
  resolveDefaultCashLedgerId,
} from '@/lib/supabase/be-tally-sync';
import { formatTallyAmount } from '@/lib/tally-format';
import { playTallyError } from '@/lib/tally-sounds';
import { supabase, uploadCreditProofPhoto, isRemoteImageUri } from '@/lib/supabase/client';

// ID generator
function generateId(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = `${prefix}_`;
  for (let i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Loyalty tier logic
export function getLoyaltyTier(totalVisits: number): LoyaltyTier {
  if (totalVisits >= 16) return 'gold';
  if (totalVisits >= 6) return 'silver';
  return 'bronze';
}

export function getRecommendedMaxDiscount(tier: LoyaltyTier): number {
  if (tier === 'gold') return 10;
  if (tier === 'silver') return 5;
  return 2;
}

export const LOYALTY_TIER_CONFIG: Record<
  LoyaltyTier,
  { label: string; color: string; bg: string; emoji: string }
> = {
  bronze: { label: 'Bronze', color: '#8D6E63', bg: '#EFEBE9', emoji: '🥉' },
  silver: { label: 'Silver', color: '#546E7A', bg: '#ECEFF1', emoji: '🥈' },
  gold: { label: 'Gold', color: '#F57F17', bg: '#FFF8E1', emoji: '🥇' },
};

// Sale item normalizer
function normalizeSaleItem(row: Record<string, unknown>): SaleItem {
  const itemName = (row.skuName as string) || (row.sku_name as string) || (row.itemName as string) || (row.item_name as string) || '';
  const unit = (row.unit as SaleItem['unit']) || 'unit';
  const quantity = (row.quantity as number) ?? 0;
  const unitsPerBase = (row.unitsPerBase as number) ?? (row.units_per_base as number) ?? 1;
  const priceExGst = (row.priceExGst as number) ?? (row.price_ex_gst as number) ?? 0;
  const gstPercent = (row.gstPercent as number) ?? (row.gst_percent as number) ?? 0;
  const gstAmountPerUnit = (row.gstAmountPerUnit as number) ?? (row.gst_amount_per_unit as number) ?? (priceExGst * gstPercent / 100);
  const priceIncGstPerUnit = (row.priceIncGstPerUnit as number) ?? (row.price_inc_gst_per_unit as number) ?? (priceExGst + gstAmountPerUnit);
  const lineTotalExGst = (row.lineTotalExGst as number) ?? (row.line_total_ex_gst as number) ?? (priceExGst * quantity);
  const lineGstAmount = (row.lineGstAmount as number) ?? (row.line_gst_amount as number) ?? (gstAmountPerUnit * quantity);
  const lineTotalIncGst = (row.lineTotalIncGst as number) ?? (row.line_total_inc_gst as number) ?? (lineTotalExGst + lineGstAmount);
  const costPrice = (row.costPrice as number) ?? (row.cost_price as number) ?? 0;

  return {
    itemId: (row.itemId as string) || (row.item_id as string),
    productId: (row.productId as string) || (row.product_id as string),
    itemName,
    quantity,
    unit,
    unitsPerBase,
    priceExGst,
    gstPercent,
    gstAmountPerUnit,
    priceIncGstPerUnit,
    pricePerUnit: priceIncGstPerUnit,
    lineTotalExGst,
    lineGstAmount,
    lineTotalIncGst,
    totalAmount: lineTotalIncGst,
    costPrice,
  };
}

// Normalize payment mode strings from DB (enums / legacy casing)
function normalizeSalePaymentMode(value: unknown): PaymentMode {
  const v = String(value ?? '')
    .toLowerCase()
    .trim();
  if (v === 'upi' || v === 'credit' || v === 'cash') return v;
  return 'cash';
}

function normalizeCollectedPaymentMode(value: unknown): 'cash' | 'upi' {
  const v = String(value ?? '')
    .toLowerCase()
    .trim();
  if (v === 'upi') return 'upi';
  return 'cash';
}

// Mapper functions
function mapSupabaseSale(r: Record<string, unknown>): Sale {
  return {
    id: r.id as string,
    dealerId: r.dealer_id as string,
    farmerId: r.farmer_id as string,
    visitId: r.visit_id as string,
    items: Array.isArray(r.items)
      ? (r.items as unknown[]).map((row) => normalizeSaleItem(row as Record<string, unknown>))
      : [],
    subtotal: (r.subtotal as number) ?? 0,
    discountType: (r.discount_type as DiscountType) ?? 'percentage',
    discountValue: (r.discount_value as number) ?? 0,
    discountAmount: (r.discount_amount as number) ?? 0,
    finalAmount: (r.final_amount as number) ?? 0,
    paymentMode: normalizeSalePaymentMode(r.payment_mode),
    paidAmount: (r.paid_amount as number) ?? 0,
    balanceDue: (r.balance_due as number) ?? 0,
    initialBalanceDue:
      r.initial_balance_due !== undefined && r.initial_balance_due !== null
        ? Number(r.initial_balance_due)
        : Math.max(0, (r.final_amount as number) - (r.paid_amount as number)),
    dueDate: r.due_date as string | undefined,
    creditNote: r.credit_note as string | undefined,
    proofImageUri: r.proof_image_uri as string | undefined,
    status: (r.status as Sale['status']) ?? 'paid',
    costTotal: (r.cost_total as number) ?? 0,
    profitAfterDiscount: (r.profit_after_discount as number) ?? 0,
    createdAt: r.created_at as string,
  };
}

function mapSupabasePayment(r: Record<string, unknown>): CreditPayment {
  return {
    id: r.id as string,
    dealerId: r.dealer_id as string,
    farmerId: r.farmer_id as string,
    saleId: r.sale_id as string,
    amount: (r.amount as number) ?? 0,
    paymentMode: normalizeCollectedPaymentMode(r.payment_mode),
    notes: r.notes as string | undefined,
    createdAt: r.created_at as string,
  };
}

// Context interface
interface SalesContextValue {
  sales: Sale[];
  creditPayments: CreditPayment[];
  salesLoading: boolean;
  creditPaymentsLoading: boolean;
  addSale: (data: {
    farmerId: string;
    visitId: string;
    items: SaleItem[];
    discountType: DiscountType;
    discountValue: number;
    paymentMode: PaymentMode;
    paidAmount: number;
    dueDate?: string;
    creditNote?: string;
    proofImageUri?: string;
  }) => Promise<Sale>;
  isAddingSale: boolean;
  recordPayment: (data: {
    saleId: string;
    farmerId: string;
    amount: number;
    paymentMode: 'cash' | 'upi';
    notes?: string;
  }) => Promise<CreditPayment>;
  isRecordingPayment: boolean;
  getSalesForFarmer: (farmerId: string) => Sale[];
  getFarmerMetrics: (farmerId: string, totalVisits: number) => FarmerMetrics;
  getCreditFarmers: () => {
    farmerId: string;
    totalDue: number;
    lastSaleDate: string;
    daysOverdue: number;
  }[];
  getPaymentsForSale: (saleId: string) => CreditPayment[];
  totalCreditOutstanding: number;
  thisMonthSales: Sale[];
  todaySales: Sale[];
  thisWeekSales: Sale[];
  todaySalesTotal: number;
  monthSalesTotal: number;
  monthCollected: number;
  monthProfit: number;
  weekSalesTotal: number;
  todayDiscountTotal: number;
  weekDiscountTotal: number;
  monthDiscountTotal: number;
  monthGrossRevenue: number;
  todayGrossRevenue: number;
  discountRevenueRatio: number;
  /** Sum of finalAmount across all loaded sales */
  allTimeSalesTotal: number;
  refetchSales: () => Promise<void>;
  getDailyRevenue: (days: number) => number[];
}

const SalesContext = createContext<SalesContextValue | null>(null);

export function useSales() {
  const context = useContext(SalesContext);
  if (!context) {
    throw new Error('useSales must be used within SalesProvider');
  }
  return context;
}

export function SalesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Fetch sales
  const salesQuery = useQuery({
    queryKey: ['sales', session?.dealerId],
    queryFn: async () => {
      if (!session) return [];

      const { data: rows, error } = await supabase
        .from('sales')
        .select('*')
        .eq('dealer_id', session.dealerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Sales] Fetch error:', error.message);
        return [];
      }
      return (rows ?? []).map(mapSupabaseSale);
    },
    enabled: !!session,
  });

  // Fetch credit payments
  const creditPaymentsQuery = useQuery({
    queryKey: ['credit_payments', session?.dealerId],
    queryFn: async () => {
      if (!session) return [];

      const { data: rows, error } = await supabase
        .from('credit_payments')
        .select('*')
        .eq('dealer_id', session.dealerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Sales] Credit payments fetch error:', error.message);
        return [];
      }
      return (rows ?? []).map(mapSupabasePayment);
    },
    enabled: !!session,
  });

  // Add sale mutation
  const addSaleMutation = useMutation({
    mutationFn: async (data: {
      farmerId: string;
      visitId: string;
      items: SaleItem[];
      discountType: DiscountType;
      discountValue: number;
      paymentMode: PaymentMode;
      paidAmount: number;
      dueDate?: string;
      creditNote?: string;
      proofImageUri?: string;
    }) => {
      if (!session) throw new Error('Not authenticated');

      const saleId = generateId('SALE');
      const now = new Date().toISOString();

      // Upload proof image if provided
      let proofImageUri = data.proofImageUri;
      if (proofImageUri && !isRemoteImageUri(proofImageUri)) {
        const uploaded = await uploadCreditProofPhoto(
          proofImageUri,
          session.dealerId,
          saleId
        );
        if (!uploaded) {
          throw new Error('Could not upload payment proof photo. Check your connection and try again.');
        }
        proofImageUri = uploaded;
      }

      // Calculate totals
      const subtotal = data.items.reduce((s, i) => s + i.totalAmount, 0);
      const discountAmount =
        data.discountType === 'percentage'
          ? (subtotal * data.discountValue) / 100
          : Math.min(data.discountValue, subtotal);
      const finalAmount = Math.max(0, subtotal - discountAmount);
      const balanceDue = Math.max(0, finalAmount - data.paidAmount);
      const costTotal = data.items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
      const profitAfterDiscount = finalAmount - costTotal;

      let status: Sale['status'] = 'paid';
      if (balanceDue > 0 && data.paidAmount > 0) status = 'partial';
      else if (balanceDue > 0 && data.paidAmount === 0) status = 'pending';

      const initialBalanceDue = balanceDue;

      const farmerCredit = await getFarmerCreditRow(data.farmerId);
      if (farmerCredit?.credit_blocked) {
        playTallyError();
        throw new Error(
          farmerCredit.block_reason?.trim()
            ? `This farmer is credit-blocked (${farmerCredit.block_reason}). Clear outstanding dues first.`
            : 'This farmer is credit-blocked. Clear outstanding dues first.'
        );
      }

      if (balanceDue > 0 && farmerCredit && farmerCredit.credit_limit > 0) {
        const outstanding = await getFarmerOutstandingSales(session.dealerId, data.farmerId);
        if (outstanding + balanceDue > farmerCredit.credit_limit) {
          playTallyError();
          throw new Error(
            `Credit limit exceeded. Limit: ₹${formatTallyAmount(farmerCredit.credit_limit)} | Outstanding: ₹${formatTallyAmount(outstanding)} | This invoice unpaid: ₹${formatTallyAmount(balanceDue)}`
          );
        }
      }

      // Insert sale
      const { error } = await supabase.from('sales').insert({
        id: saleId,
        dealer_id: session.dealerId,
        farmer_id: data.farmerId,
        visit_id: data.visitId,
        items: data.items,
        subtotal,
        discount_type: data.discountType,
        discount_value: data.discountValue,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_mode: data.paymentMode,
        paid_amount: data.paidAmount,
        balance_due: balanceDue,
        initial_balance_due: initialBalanceDue,
        due_date: data.dueDate,
        credit_note: data.creditNote,
        proof_image_uri: proofImageUri,
        status,
        cost_total: costTotal,
        profit_after_discount: profitAfterDiscount,
        sale_date: now.slice(0, 10),
        created_at: now,
      });

      if (error) {
        console.error('[Sales] Insert error:', error);
        throw new Error('Failed to record sale: ' + error.message);
      }

      // Insert sale line items (best-effort analytics rows — sale is NOT rolled back if this fails)
      const linePayloads: Record<string, unknown>[] = [];
      for (const item of data.items) {
        let productId = item.productId?.trim();
        if (!productId) {
          const { data: skuRow } = await supabase
            .from('product_skus')
            .select('product_id')
            .eq('id', item.itemId)
            .maybeSingle();
          productId = (skuRow as { product_id?: string } | null)?.product_id?.trim() ?? '';
        }
        if (!productId) {
          console.warn('[Sales] skip sale_line_items row: no product_id', item.itemId);
          continue;
        }
        linePayloads.push({
          id: generateId('SLI'),
          sale_id: saleId,
          dealer_id: session.dealerId,
          product_id: productId,
          sku_id: item.itemId,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.priceExGst,
          line_total: item.lineTotalExGst,
        });
      }
      if (linePayloads.length > 0) {
        const { error: lineErr } = await supabase.from('sale_line_items').insert(linePayloads);
        if (lineErr) {
          // Non-fatal: full item data is already stored in sales.items (JSONB).
          // sale_line_items is used for analytics only — log and continue.
          console.warn('[Sales] sale_line_items insert skipped:', lineErr.code, lineErr.message);
        }
      }

      const saleDateIso = now.slice(0, 10);

      try {
        await deductStockForBusinessEngineSale({
          dealerTenant: session.dealerId,
          userId: session.userId,
          saleId,
          items: data.items,
        });
      } catch (stockErr) {
        await supabase.from('sale_line_items').delete().eq('sale_id', saleId);
        await supabase.from('sales').delete().eq('id', saleId).eq('dealer_id', session.dealerId);
        throw stockErr;
      }

      try {
        await postBeSaleVoucherRpc({
          dealerTenant: session.dealerId,
          saleId,
          farmerId: data.farmerId,
          saleDateIso,
          finalAmount,
          paidAmount: data.paidAmount,
          narration: `Retail sale ${saleId}`,
        });
      } catch (acctErr) {
        await restoreStockForBusinessEngineSale({
          dealerTenant: session.dealerId,
          userId: session.userId,
          saleId,
          items: data.items,
        });
        await supabase.from('sale_line_items').delete().eq('sale_id', saleId);
        await supabase.from('sales').delete().eq('id', saleId).eq('dealer_id', session.dealerId);
        throw acctErr;
      }

      void queryClient.invalidateQueries({ queryKey: ['day-book'] });
      void queryClient.invalidateQueries({ queryKey: ['ledger-pick', session.dealerRowId] });
      void queryClient.invalidateQueries({ queryKey: ['inventory_v2', session.dealerId] });

      queryClient.invalidateQueries({ queryKey: ['sales', session.dealerId] });

      return {
        id: saleId,
        dealerId: session.dealerId,
        farmerId: data.farmerId,
        visitId: data.visitId,
        items: data.items,
        subtotal,
        discountType: data.discountType,
        discountValue: data.discountValue,
        discountAmount,
        finalAmount,
        paymentMode: data.paymentMode,
        paidAmount: data.paidAmount,
        balanceDue,
        initialBalanceDue,
        dueDate: data.dueDate,
        creditNote: data.creditNote,
        proofImageUri,
        status,
        costTotal,
        profitAfterDiscount,
        createdAt: now,
      } as Sale;
    },
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: {
      saleId: string;
      farmerId: string;
      amount: number;
      paymentMode: 'cash' | 'upi';
      notes?: string;
    }) => {
      if (!session) throw new Error('Not authenticated');

      const paymentId = generateId('PAY');
      const now = new Date().toISOString();

      // Get current sale data
      const { data: saleRow } = await supabase
        .from('sales')
        .select('balance_due, paid_amount')
        .eq('id', data.saleId)
        .eq('dealer_id', session.dealerId)
        .maybeSingle();

      if (!saleRow) throw new Error('Sale not found');
      if (data.amount > (saleRow.balance_due as number)) {
        throw new Error(`Payment amount exceeds balance due (₹${(saleRow.balance_due as number).toFixed(2)})`);
      }

      const newPaid = (saleRow.paid_amount as number) + data.amount;
      const newBalance = Math.max(0, (saleRow.balance_due as number) - data.amount);
      const newStatus = newBalance === 0 ? 'paid' : 'partial';

      // Update sale balance FIRST
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          paid_amount: newPaid,
          balance_due: newBalance,
          status: newStatus,
        })
        .eq('id', data.saleId);

      if (updateError) throw new Error('Failed to update sale: ' + updateError.message);

      // Record the payment
      const { error: payError } = await supabase.from('credit_payments').insert({
        id: paymentId,
        dealer_id: session.dealerId,
        farmer_id: data.farmerId,
        sale_id: data.saleId,
        amount: data.amount,
        payment_mode: data.paymentMode,
        notes: data.notes,
        created_at: now,
      });

      if (payError) throw new Error('Failed to record payment: ' + payError.message);

      try {
        const cashLedgerId = session.dealerRowId ? await resolveDefaultCashLedgerId(session.dealerRowId) : null;
        if (cashLedgerId && session.dealerId) {
          let partyLedgerId = (await getFarmerCreditRow(data.farmerId))?.ledger_id ?? null;
          if (!partyLedgerId) {
            partyLedgerId = await ensureFarmerPartyLedgerRpc(session.dealerId, data.farmerId);
          }
          await postFarmerPaymentReceiptRpc({
            dealerId: session.dealerId,
            farmerId: data.farmerId,
            amount: data.amount,
            bankLedgerId: cashLedgerId,
            partyLedgerId,
            voucherDate: now.slice(0, 10),
            narration: `Udhaar receipt · sale ${data.saleId}`,
            settlements: [],
          });
          void queryClient.invalidateQueries({ queryKey: ['day-book'] });
          void queryClient.invalidateQueries({ queryKey: ['ledger-pick', session.dealerRowId] });
        }
      } catch (rpcErr) {
        console.warn('[Sales] RCT voucher sync skipped:', rpcErr);
      }

      queryClient.invalidateQueries({ queryKey: ['sales', session.dealerId] });
      queryClient.invalidateQueries({ queryKey: ['credit_payments', session.dealerId] });

      return {
        id: paymentId,
        dealerId: session.dealerId,
        farmerId: data.farmerId,
        saleId: data.saleId,
        amount: data.amount,
        paymentMode: data.paymentMode,
        notes: data.notes,
        createdAt: now,
      } as CreditPayment;
    },
  });

  const sales = salesQuery.data ?? [];
  const creditPayments = creditPaymentsQuery.data ?? [];

  const getSalesForFarmer = useCallback(
    (farmerId: string): Sale[] => {
      return sales
        .filter((s) => s.farmerId === farmerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [sales]
  );

  const getFarmerMetrics = useCallback(
    (farmerId: string, totalVisits: number): FarmerMetrics => {
      const farmerSales = getSalesForFarmer(farmerId);
      const lifetimePurchase = farmerSales.reduce((s, sale) => s + sale.finalAmount, 0);
      const outstandingCredit = farmerSales
        .filter((s) => s.status !== 'paid')
        .reduce((s, sale) => s + sale.balanceDue, 0);
      const loyaltyTier = getLoyaltyTier(totalVisits);
      return { farmerId, totalVisits, lifetimePurchase, loyaltyTier, outstandingCredit };
    },
    [getSalesForFarmer]
  );

  const getCreditFarmers = useCallback(() => {
    const creditMap: Record<
      string,
      { farmerId: string; totalDue: number; lastSaleDate: string; daysOverdue: number }
    > = {};
    sales
      .filter((s) => s.status !== 'paid' && s.balanceDue > 0)
      .forEach((s) => {
        if (!creditMap[s.farmerId]) {
          creditMap[s.farmerId] = {
            farmerId: s.farmerId,
            totalDue: 0,
            lastSaleDate: s.createdAt,
            daysOverdue: 0,
          };
        }
        creditMap[s.farmerId].totalDue += s.balanceDue;
        if (new Date(s.createdAt) > new Date(creditMap[s.farmerId].lastSaleDate)) {
          creditMap[s.farmerId].lastSaleDate = s.createdAt;
        }
        if (s.dueDate) {
          const due = new Date(s.dueDate);
          const now = new Date();
          const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          if (diff > creditMap[s.farmerId].daysOverdue) {
            creditMap[s.farmerId].daysOverdue = diff;
          }
        }
      });
    return Object.values(creditMap).sort((a, b) => b.totalDue - a.totalDue);
  }, [sales]);

  const getPaymentsForSale = useCallback(
    (saleId: string): CreditPayment[] => {
      return creditPayments.filter((p) => p.saleId === saleId);
    },
    [creditPayments]
  );

  const totalCreditOutstanding = sales
    .filter((s) => s.status !== 'paid')
    .reduce((s, sale) => s + sale.balanceDue, 0);

  const thisMonthSales = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return sales.filter((s) => new Date(s.createdAt) >= start);
  })();

  const todaySales = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sales.filter((s) => new Date(s.createdAt) >= today);
  })();

  const thisWeekSales = (() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return sales.filter((s) => new Date(s.createdAt) >= start);
  })();

  const todayDiscountTotal = todaySales.reduce((s, sale) => s + sale.discountAmount, 0);
  const weekDiscountTotal = thisWeekSales.reduce((s, sale) => s + sale.discountAmount, 0);
  const monthDiscountTotal = thisMonthSales.reduce((s, sale) => s + sale.discountAmount, 0);
  const monthGrossRevenue = thisMonthSales.reduce((s, sale) => s + sale.subtotal, 0);
  const todayGrossRevenue = todaySales.reduce((s, sale) => s + sale.subtotal, 0);
  const discountRevenueRatio = monthGrossRevenue > 0 ? (monthDiscountTotal / monthGrossRevenue) * 100 : 0;

  const allTimeSalesTotal = sales.reduce((sum, sale) => sum + sale.finalAmount, 0);

  const getDailyRevenue = useCallback((days: number): number[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const revenues: number[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayRevenue = sales
        .filter((s) => {
          const saleDate = new Date(s.createdAt);
          return saleDate >= dayStart && saleDate <= dayEnd;
        })
        .reduce((sum, sale) => sum + sale.finalAmount, 0);
      
      revenues.push(dayRevenue);
    }
    
    return revenues;
  }, [sales]);

  const value: SalesContextValue = {
    sales,
    creditPayments,
    salesLoading: salesQuery.isLoading,
    creditPaymentsLoading: creditPaymentsQuery.isLoading,
    addSale: addSaleMutation.mutateAsync,
    isAddingSale: addSaleMutation.isPending,
    recordPayment: recordPaymentMutation.mutateAsync,
    isRecordingPayment: recordPaymentMutation.isPending,
    getSalesForFarmer,
    getFarmerMetrics,
    getCreditFarmers,
    getPaymentsForSale,
    totalCreditOutstanding,
    thisMonthSales,
    todaySales,
    thisWeekSales,
    todaySalesTotal: todaySales.reduce((s, sale) => s + sale.finalAmount, 0),
    monthSalesTotal: thisMonthSales.reduce((s, sale) => s + sale.finalAmount, 0),
    monthCollected: thisMonthSales.reduce((s, sale) => s + sale.paidAmount, 0),
    monthProfit: thisMonthSales.reduce((s, sale) => s + sale.profitAfterDiscount, 0),
    weekSalesTotal: thisWeekSales.reduce((s, sale) => s + sale.finalAmount, 0),
    todayDiscountTotal,
    weekDiscountTotal,
    monthDiscountTotal,
    monthGrossRevenue,
    todayGrossRevenue,
    discountRevenueRatio,
    allTimeSalesTotal,
    refetchSales: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales', session?.dealerId] }),
        queryClient.invalidateQueries({ queryKey: ['credit_payments', session?.dealerId] }),
      ]).then(() => {}),
    getDailyRevenue,
  };

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}
