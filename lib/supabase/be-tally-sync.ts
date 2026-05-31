import type { SaleItem } from '@/constants/types';
import { supabase } from '@/lib/supabase/client';

/** Idempotent: creates PX_SALES_GRP / PX_CASH_GRP + ledgers SALES + CASH_IN_HAND if missing. */
export async function ensureDefaultBeSaleLedgersRpc(dealerRowId: string): Promise<void> {
  const { error } = await supabase.rpc('ensure_default_be_sale_ledgers', {
    p_dealer_uuid: dealerRowId,
  });
  if (error) {
    console.warn('[be-tally-sync] ensure_default_be_sale_ledgers:', error.message);
  }
}

function generateStockTxnId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'STXN_';
  for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

/** Creates / links Sundry Debtor ledger for a farmer (matches DB RPC). */
export async function ensureFarmerPartyLedgerRpc(dealerTenant: string, farmerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_farmer_party_ledger', {
    p_dealer_tenant: dealerTenant,
    p_farmer_id: farmerId,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

/** Posts SAL voucher for a Business Engine retail sale (idempotent by sale id). */
export async function postBeSaleVoucherRpc(args: {
  dealerTenant: string;
  saleId: string;
  farmerId: string;
  saleDateIso: string;
  finalAmount: number;
  paidAmount: number;
  narration?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('post_be_sale_voucher', {
    p_dealer_tenant: args.dealerTenant,
    p_sale_id: args.saleId,
    p_farmer_id: args.farmerId,
    p_sale_date: args.saleDateIso.slice(0, 10),
    p_final_amount: args.finalAmount,
    p_paid_amount: args.paidAmount,
    p_narration: args.narration ?? '',
  });
  if (error) throw new Error(error.message);
  return String(data);
}

/** Default cash drawer ledger for RCT / cash sale lines — ledgers.dealer_id is UUID. */
export async function resolveDefaultCashLedgerId(dealerRowId: string): Promise<string | null> {
  const codes = ['CASH_IN_HAND', 'CASH', 'CASH_ON_HAND'] as const;
  for (const code of codes) {
    const { data } = await supabase.from('ledgers').select('id').eq('dealer_id', dealerRowId).eq('ledger_code', code).maybeSingle();
    const id = (data as { id?: string } | null)?.id;
    if (id) return id;
  }
  const { data: byName } = await supabase
    .from('ledgers')
    .select('id')
    .eq('dealer_id', dealerRowId)
    .ilike('name', '%cash%hand%')
    .limit(1)
    .maybeSingle();
  const id2 = (byName as { id?: string } | null)?.id;
  return id2 ?? null;
}

/**
 * Deduct SKU quantities for a BE sale (same tables as InventoryContext).
 * Uses negative delta against base units: qty_sold * unitsPerBase.
 */
export async function deductStockForBusinessEngineSale(args: {
  dealerTenant: string;
  userId: string;
  saleId: string;
  items: SaleItem[];
}): Promise<void> {
  const { dealerTenant, userId, saleId, items } = args;
  const now = new Date().toISOString();

  for (const item of items) {
    const skuId = item.itemId?.trim();
    if (!skuId) continue;
    const unitsPerBase = item.unitsPerBase && item.unitsPerBase > 0 ? item.unitsPerBase : 1;
    const qtyBase = item.quantity * unitsPerBase;
    if (qtyBase <= 0) continue;

    const { data: balanceRow } = await supabase
      .from('sku_stock_balances')
      .select('quantity_base')
      .eq('dealer_id', dealerTenant)
      .eq('sku_id', skuId)
      .maybeSingle();

    const currentStock = balanceRow ? Number((balanceRow as { quantity_base?: number }).quantity_base) : 0;
    const delta = -qtyBase;
    const newStock = currentStock + delta;
    if (newStock < 0) {
      throw new Error(`Insufficient stock for ${item.itemName || skuId}: need ${qtyBase}, have ${currentStock}`);
    }

    const { error: balanceError } = await supabase.from('sku_stock_balances').upsert({
      dealer_id: dealerTenant,
      sku_id: skuId,
      quantity_base: newStock,
    });
    if (balanceError) throw new Error(balanceError.message);

    const { error: txError } = await supabase.from('stock_transactions').insert({
      id: generateStockTxnId(),
      dealer_id: dealerTenant,
      sku_id: skuId,
      type: 'adjustment',
      quantity_base: delta,
      balance_after: newStock,
      notes: `Sale ${saleId}`,
      created_by: userId,
      created_at: now,
    });
    if (txError) console.warn('[be-tally-sync] stock_transactions:', txError.message);
  }
}

/** Reverse deductStockForBusinessEngineSale — used if voucher posting fails after stock moved. */
export async function restoreStockForBusinessEngineSale(args: {
  dealerTenant: string;
  userId: string;
  saleId: string;
  items: SaleItem[];
}): Promise<void> {
  const { dealerTenant, userId, saleId, items } = args;
  const now = new Date().toISOString();

  for (const item of items) {
    const skuId = item.itemId?.trim();
    if (!skuId) continue;
    const unitsPerBase = item.unitsPerBase && item.unitsPerBase > 0 ? item.unitsPerBase : 1;
    const qtyBase = item.quantity * unitsPerBase;
    if (qtyBase <= 0) continue;

    const { data: balanceRow } = await supabase
      .from('sku_stock_balances')
      .select('quantity_base')
      .eq('dealer_id', dealerTenant)
      .eq('sku_id', skuId)
      .maybeSingle();

    const currentStock = balanceRow ? Number((balanceRow as { quantity_base?: number }).quantity_base) : 0;
    const delta = qtyBase;
    const newStock = currentStock + delta;

    const { error: balanceError } = await supabase.from('sku_stock_balances').upsert({
      dealer_id: dealerTenant,
      sku_id: skuId,
      quantity_base: newStock,
    });
    if (balanceError) console.warn('[be-tally-sync] rollback balance:', balanceError.message);

    await supabase.from('stock_transactions').insert({
      id: generateStockTxnId(),
      dealer_id: dealerTenant,
      sku_id: skuId,
      type: 'adjustment',
      quantity_base: delta,
      balance_after: newStock,
      notes: `Rollback sale ${saleId}`,
      created_by: userId,
      created_at: now,
    });
  }
}
