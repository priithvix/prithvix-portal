'use client';

import { createContext, useContext, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  InventoryItem,
  ProductMaster,
  ItemCategory,
  InventoryBaseUnit,
  ItemUnit,
} from '@/constants/types';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase/client';

// ID generator
function generateId(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = `${prefix}_`;
  for (let i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Stock health calculation
function stockHealth(stock: number, safetyStock: number): 'healthy' | 'low' | 'reorder' {
  if (stock <= safetyStock * 0.5) return 'reorder';
  if (stock <= safetyStock) return 'low';
  return 'healthy';
}

// Mapper functions
function mapMasterRow(r: Record<string, unknown>): ProductMaster {
  return {
    id: r.id as string,
    dealerId: r.dealer_id as string,
    productName: r.product_name as string,
    category: (r.category as ItemCategory) ?? 'others',
    gstPercent: Number(r.gst_percent) ?? 0,
    baseUnit: (r.base_unit as InventoryBaseUnit) ?? 'kg',
    imageUrl: (r.image_url as string) ?? undefined,
    isActive: (r.is_active as boolean) ?? true,
    isLabourEligible: (r.is_labour_eligible as boolean) ?? false,
    labourUnit: (r.labour_unit as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    companyName: (r.company_name as string) ?? undefined,
    hsnCode: (r.hsn_code as string) ?? undefined,
    technicalName: (r.technical_name as string) ?? undefined,
    formulation: (r.formulation as string) ?? undefined,
    cibRegNumber: (r.cib_reg_number as string) ?? undefined,
    cropName: (r.crop_name as string) ?? undefined,
    variety: (r.variety as string) ?? undefined,
    seedClass: (r.seed_class as string) ?? undefined,
  };
}

function toInventoryItem(
  row: Record<string, unknown>,
  stockBase: number,
  safetyStockBase: number,
  manualSafetyOverride?: number
): InventoryItem {
  const productMaster = row.product_master as Record<string, unknown> | Record<string, unknown>[] | null;
  const m = productMaster
    ? Array.isArray(productMaster)
      ? productMaster[0]
      : productMaster
    : null;

  const productName = (m?.product_name as string) ?? '—';
  const displayLabel = row.display_label as string;
  const gst = m ? Number(m.gst_percent) : 0;
  const category = ((m?.category as ItemCategory) ?? 'others') as ItemCategory;
  const baseUnit = ((m?.base_unit as InventoryBaseUnit) ?? 'kg') as InventoryBaseUnit;
  const imageUrl = (m?.image_url as string) ?? undefined;
  const upb = Number(row.units_per_base) || 1;
  const lastBase = (row.last_invoice_price_per_base as number) ?? undefined;
  const sellingPrice = (row.selling_price_ex_gst as number) ?? undefined;
  const status = stockHealth(stockBase, safetyStockBase);

  return {
    id: row.id as string,
    dealerId: row.dealer_id as string,
    productId: row.product_id as string,
    productName,
    displayLabel,
    name: `${productName} · ${displayLabel}`,
    imageUrl,
    category,
    unit: (row.unit_type as ItemUnit) ?? 'unit',
    unitsPerBase: upb,
    baseUnit,
    stock: stockBase,
    avgDailySalesBase: 0, // Simplified
    safetyStockBase,
    manualSafetyStockBase: manualSafetyOverride,
    reorderLevel: safetyStockBase,
    sellingPrice,
    costPrice: lastBase ?? 0,
    effectiveCostPerUnit: lastBase ?? 0,
    realizedPriceExGst: sellingPrice,
    lastInvoicePricePerBase: lastBase,
    lastInvoicePricePerInvoiceUnit: undefined,
    extraCostPerUnit: 0,
    skuExtraCostPerUnit: undefined,
    extraCostManualOverride: false,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    gstPercent: gst,
    leadTimeDays: (row.lead_time_days as number) ?? 7,
    isActive: (row.is_active as boolean) ?? true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    stockStatus: status,
    companyName: (m?.company_name as string) ?? undefined,
    hsnCode: (m?.hsn_code as string) ?? undefined,
    technicalName: (m?.technical_name as string) ?? undefined,
    formulation: (m?.formulation as string) ?? undefined,
    cibRegNumber: (m?.cib_reg_number as string) ?? undefined,
    cropName: (m?.crop_name as string) ?? undefined,
    variety: (m?.variety as string) ?? undefined,
    seedClass: (m?.seed_class as string) ?? undefined,
    mrp: (row.mrp as number) ?? undefined,
    batchNumber: (row.batch_number as string) ?? undefined,
    manufacturingDate: (row.manufacturing_date as string) ?? undefined,
    expiryDate: (row.expiry_date as string) ?? undefined,
    lotNumber: (row.lot_number as string) ?? undefined,
    germinationPercent: (row.germination_percent as number) ?? undefined,
    germinationValidUpto: (row.germination_valid_upto as string) ?? undefined,
  };
}

// Context interface
interface InventoryContextValue {
  items: InventoryItem[];
  productMasters: ProductMaster[];
  activeItems: InventoryItem[];
  lowStockItems: InventoryItem[];
  reorderRequiredItems: InventoryItem[];
  isLoading: boolean;
  refetchInventory: () => Promise<void>;
  getItemById: (id: string) => InventoryItem | undefined;
  getSkusForProduct: (productId: string) => InventoryItem[];
  receiveStock: (data: { skuId: string; quantity: number; notes?: string }) => Promise<void>;
  adjustStock: (data: { skuId: string; quantity: number; reason: string }) => Promise<void>;
  createSKU: (data: {
    productId: string;
    displayLabel: string;
    unitType: ItemUnit;
    unitsPerBase: number;
    sellingPriceExGst?: number;
    leadTimeDays?: number;
    mrp?: number;
    batchNumber?: string;
    manufacturingDate?: string;
    expiryDate?: string;
  }) => Promise<InventoryItem>;
  isReceivingStock: boolean;
  isAdjustingStock: boolean;
  isCreatingSKU: boolean;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Fetch inventory
  const inventoryQuery = useQuery({
    queryKey: ['inventory_v2', session?.dealerId],
    queryFn: async () => {
      if (!session) return { items: [] as InventoryItem[], masters: [] as ProductMaster[] };

      const [skusRes, balRes, mastersRes] = await Promise.all([
        supabase
          .from('product_skus')
          .select('*, product_master(*)')
          .eq('dealer_id', session.dealerId)
          .order('created_at', { ascending: false }),
        supabase
          .from('sku_stock_balances')
          .select('sku_id, quantity_base')
          .eq('dealer_id', session.dealerId),
        supabase
          .from('product_master')
          .select('*')
          .eq('dealer_id', session.dealerId)
          .eq('is_active', true)
          .order('product_name', { ascending: true }),
      ]);

      if (skusRes.error) {
        console.error('[Inventory] SKUs error:', skusRes.error.message);
        return { items: [] as InventoryItem[], masters: [] as ProductMaster[] };
      }

      if (balRes.error) console.warn('[Inventory] balances:', balRes.error.message);
      if (mastersRes.error) console.warn('[Inventory] masters:', mastersRes.error.message);

      const balMap = Object.fromEntries(
        (balRes.data ?? []).map((b: { sku_id: string; quantity_base: number }) => [
          b.sku_id,
          Number(b.quantity_base) || 0,
        ])
      );

      const skuRows = (skusRes.data ?? []) as Record<string, unknown>[];
      const items: InventoryItem[] = skuRows.map((row) => {
        const stockBase = balMap[row.id as string] ?? 0;
        const leadTime = (row.lead_time_days as number) ?? 7;
        const meta = (row.metadata as Record<string, unknown> | null) ?? {};
        const manual =
          typeof meta.manual_safety_stock_base === 'number'
            ? meta.manual_safety_stock_base
            : typeof meta.manualSafetyStockBase === 'number'
              ? meta.manualSafetyStockBase
              : undefined;
        const safetyStockBase =
          manual != null && !Number.isNaN(manual) ? Number(manual) : leadTime;
        return toInventoryItem(row, stockBase, safetyStockBase, manual);
      });

      const masters: ProductMaster[] = (mastersRes.data ?? []).map((r: Record<string, unknown>) =>
        mapMasterRow(r)
      );

      return { items, masters };
    },
    enabled: !!session,
  });

  const items = inventoryQuery.data?.items ?? [];
  const productMasters = inventoryQuery.data?.masters ?? [];

  const activeItems = useMemo(() => items.filter((i) => i.isActive), [items]);

  const lowStockItems = useMemo(
    () => activeItems.filter((i) => i.stockStatus !== 'healthy'),
    [activeItems]
  );

  const reorderRequiredItems = useMemo(
    () => activeItems.filter((i) => i.stockStatus === 'reorder'),
    [activeItems]
  );

  const refetchInventory = useCallback(() =>
    queryClient.invalidateQueries({ queryKey: ['inventory_v2', session?.dealerId] }).then(() => {}),
    [queryClient, session?.dealerId]
  );

  const getItemById = useCallback((id: string) => items.find((i) => i.id === id), [items]);

  const getSkusForProduct = useCallback(
    (productId: string) => items.filter((i) => i.productId === productId),
    [items]
  );

  // Receive stock mutation
  const receiveStockMutation = useMutation({
    mutationFn: async (data: { skuId: string; quantity: number; notes?: string }) => {
      if (!session) throw new Error('Not authenticated');
      if (data.quantity <= 0) throw new Error('Quantity must be positive');

      // Get current balance
      const { data: balanceRow } = await supabase
        .from('sku_stock_balances')
        .select('quantity_base')
        .eq('dealer_id', session.dealerId)
        .eq('sku_id', data.skuId)
        .maybeSingle();

      const currentStock = balanceRow ? Number(balanceRow.quantity_base) : 0;
      const newStock = currentStock + data.quantity;

      // Upsert balance
      const { error: balanceError } = await supabase
        .from('sku_stock_balances')
        .upsert({
          dealer_id: session.dealerId,
          sku_id: data.skuId,
          quantity_base: newStock,
        });

      if (balanceError) throw new Error('Failed to update stock balance: ' + balanceError.message);

      // Log transaction
      const { error: txError } = await supabase.from('stock_transactions').insert({
        id: generateId('STXN'),
        dealer_id: session.dealerId,
        sku_id: data.skuId,
        type: 'receive',
        quantity_base: data.quantity,
        balance_after: newStock,
        notes: data.notes || 'Stock received',
        created_by: session.userId,
        created_at: new Date().toISOString(),
      });

      if (txError) console.warn('[Inventory] Stock transaction log failed:', txError.message);

      queryClient.invalidateQueries({ queryKey: ['inventory_v2', session.dealerId] });
    },
  });

  // Adjust stock mutation
  const adjustStockMutation = useMutation({
    mutationFn: async (data: { skuId: string; quantity: number; reason: string }) => {
      if (!session) throw new Error('Not authenticated');

      // Get current balance
      const { data: balanceRow } = await supabase
        .from('sku_stock_balances')
        .select('quantity_base')
        .eq('dealer_id', session.dealerId)
        .eq('sku_id', data.skuId)
        .maybeSingle();

      const currentStock = balanceRow ? Number(balanceRow.quantity_base) : 0;
      const newStock = currentStock + data.quantity;

      if (newStock < 0) throw new Error('Adjustment would result in negative stock');

      // Upsert balance
      const { error: balanceError } = await supabase
        .from('sku_stock_balances')
        .upsert({
          dealer_id: session.dealerId,
          sku_id: data.skuId,
          quantity_base: newStock,
        });

      if (balanceError) throw new Error('Failed to adjust stock balance: ' + balanceError.message);

      // Log transaction
      const { error: txError } = await supabase.from('stock_transactions').insert({
        id: generateId('STXN'),
        dealer_id: session.dealerId,
        sku_id: data.skuId,
        type: 'adjustment',
        quantity_base: data.quantity,
        balance_after: newStock,
        notes: data.reason,
        created_by: session.userId,
        created_at: new Date().toISOString(),
      });

      if (txError) console.warn('[Inventory] Stock transaction log failed:', txError.message);

      queryClient.invalidateQueries({ queryKey: ['inventory_v2', session.dealerId] });
    },
  });

  // Create SKU mutation
  const createSKUMutation = useMutation({
    mutationFn: async (data: {
      productId: string;
      displayLabel: string;
      unitType: ItemUnit;
      unitsPerBase: number;
      sellingPriceExGst?: number;
      leadTimeDays?: number;
      mrp?: number;
      batchNumber?: string;
      manufacturingDate?: string;
      expiryDate?: string;
    }) => {
      if (!session) throw new Error('Not authenticated');

      const skuId = generateId('SKU');
      const now = new Date().toISOString();

      // Insert SKU
      const { error } = await supabase.from('product_skus').insert({
        id: skuId,
        dealer_id: session.dealerId,
        product_id: data.productId,
        display_label: data.displayLabel,
        unit_type: data.unitType,
        units_per_base: data.unitsPerBase,
        selling_price_ex_gst: data.sellingPriceExGst,
        lead_time_days: data.leadTimeDays ?? 7,
        mrp: data.mrp,
        batch_number: data.batchNumber,
        manufacturing_date: data.manufacturingDate,
        expiry_date: data.expiryDate,
        is_active: true,
        created_at: now,
        updated_at: now,
      });

      if (error) throw new Error('Failed to create SKU: ' + error.message);

      // Initialize stock balance at 0
      const { error: balanceError } = await supabase.from('sku_stock_balances').insert({
        dealer_id: session.dealerId,
        sku_id: skuId,
        quantity_base: 0,
      });

      if (balanceError) console.warn('[Inventory] Stock balance init failed:', balanceError.message);

      queryClient.invalidateQueries({ queryKey: ['inventory_v2', session.dealerId] });

      // Return a minimal item (will be fully loaded on refetch)
      return {
        id: skuId,
        dealerId: session.dealerId,
        productId: data.productId,
        displayLabel: data.displayLabel,
        unit: data.unitType,
        unitsPerBase: data.unitsPerBase,
        stock: 0,
        safetyStockBase: data.leadTimeDays ?? 7,
        isActive: true,
        createdAt: now,
      } as InventoryItem;
    },
  });

  const value: InventoryContextValue = {
    items,
    productMasters,
    activeItems,
    lowStockItems,
    reorderRequiredItems,
    isLoading: inventoryQuery.isLoading,
    refetchInventory,
    getItemById,
    getSkusForProduct,
    receiveStock: receiveStockMutation.mutateAsync,
    adjustStock: adjustStockMutation.mutateAsync,
    createSKU: createSKUMutation.mutateAsync,
    isReceivingStock: receiveStockMutation.isPending,
    isAdjustingStock: adjustStockMutation.isPending,
    isCreatingSKU: createSKUMutation.isPending,
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
