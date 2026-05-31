'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package,
  Camera,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  X,
  AlertTriangle,
  Search,
  Loader2,
  TrendingDown,
  TrendingUp,
  IndianRupee,
  BarChart3,
  Filter,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useInventory } from '@/contexts/InventoryContext';
import { createClient } from '@/lib/supabase/client';
import type { InventoryBaseUnit, InventoryItem, ItemCategory, ItemUnit } from '@/constants/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORY_ORDER: ItemCategory[] = [
  'fertilizer',
  'pesticide',
  'insecticide',
  'seeds',
  'others',
];

function labelCategory(c: ItemCategory): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

type StatusFilterValue = 'all' | NonNullable<InventoryItem['stockStatus']>;
type SortByValue = 'name' | 'stock_desc' | 'stock_asc' | 'value_desc' | 'margin_desc';

const STOCK_OUT_REASONS: { value: string; label: string }[] = [
  { value: 'damage', label: 'Damage / breakage' },
  { value: 'expiry', label: 'Expiry' },
  { value: 'theft', label: 'Theft / loss' },
  { value: 'correct_count', label: 'Stock count correction' },
  { value: 'return', label: 'Return to supplier' },
  { value: 'other', label: 'Other' },
];

function generateProductId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'PRD_';
  for (let i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

const GST_OPTIONS = [0, 5, 12, 18, 28] as const;

const defaultAddForm = () => ({
  productName: '',
  category: 'fertilizer' as ItemCategory,
  baseUnit: 'kg' as InventoryBaseUnit,
  gstPercent: 18,
  companyName: '',
  hsnCode: '',
  technicalName: '',
  displayLabel: '',
  unitType: 'bag' as ItemUnit,
  unitsPerBase: 1,
  sellingPrice: 0,
  mrp: 0,
  leadTimeDays: 7,
  openingStock: 0,
});

type AddFormState = ReturnType<typeof defaultAddForm>;

type EditFormState = {
  productName: string;
  companyName: string;
  hsnCode: string;
  technicalName: string;
  sellingPrice: number;
  mrp: number;
  leadTimeDays: number;
  gstPercent: number;
  safetyStockBase: number;
};

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

function formatInrDetail(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function unitsPerBaseOf(item: InventoryItem): number {
  return item.unitsPerBase ?? 1;
}

function displayUnitsFromStock(item: InventoryItem): number {
  return item.stock / unitsPerBaseOf(item);
}

export default function InventoryPage() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const {
    items,
    activeItems,
    lowStockItems,
    reorderRequiredItems,
    isLoading,
    isReceivingStock,
    isAdjustingStock,
    isCreatingSKU,
    receiveStock,
    adjustStock,
    createSKU,
    refetchInventory,
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [sortBy, setSortBy] = useState<SortByValue>('name');

  const [stockInItem, setStockInItem] = useState<InventoryItem | null>(null);
  const [stockOutItem, setStockOutItem] = useState<InventoryItem | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addForm, setAddForm] = useState<AddFormState>(() => defaultAddForm());

  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [stockInQty, setStockInQty] = useState('');
  const [stockInNotes, setStockInNotes] = useState('');

  const [stockOutQty, setStockOutQty] = useState('');
  const [stockOutReason, setStockOutReason] = useState('damage');

  const metrics = useMemo(() => {
    const categoryBreakdown: Record<ItemCategory, number> = {
      fertilizer: 0,
      pesticide: 0,
      insecticide: 0,
      seeds: 0,
      others: 0,
    };

    let totalCost = 0;
    let totalSelling = 0;

    for (const item of activeItems) {
      categoryBreakdown[item.category] += 1;
      const cost = item.stock * (item.costPrice ?? 0);
      totalCost += cost;
      const disp = unitsPerBaseOf(item);
      const sellUnits = disp > 0 ? item.stock / disp : 0;
      const lineSell = sellUnits * (item.sellingPrice ?? 0);
      totalSelling += lineSell;
    }

    const potentialProfit = totalSelling - totalCost;
    const marginPct = totalSelling > 0 ? (potentialProfit / totalSelling) * 100 : 0;

    return {
      categoryBreakdown,
      totalCost,
      totalSelling,
      potentialProfit,
      marginPct,
    };
  }, [activeItems]);

  const categoryPillSegments = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({ cat, count: metrics.categoryBreakdown[cat] })).filter(
      (x) => x.count > 0
    );
  }, [metrics.categoryBreakdown]);

  const filteredItems = useMemo(() => {
    let list = [...activeItems];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.productName.toLowerCase().includes(q) ||
          (item.displayLabel ?? '').toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.companyName ?? '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter((i) => i.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((i) => (i.stockStatus ?? 'healthy') === statusFilter);
    }

    const marginOf = (item: InventoryItem) => {
      const disp = unitsPerBaseOf(item);
      const sellUnits = disp > 0 ? item.stock / disp : 0;
      const revenue = sellUnits * (item.sellingPrice ?? 0);
      const cost = item.stock * (item.costPrice ?? 0);
      return revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
    };

    list.sort((a, b) => {
      switch (sortBy) {
        case 'stock_desc':
          return b.stock - a.stock;
        case 'stock_asc':
          return a.stock - b.stock;
        case 'value_desc': {
          const va = a.stock * (a.costPrice ?? 0);
          const vb = b.stock * (b.costPrice ?? 0);
          return vb - va;
        }
        case 'margin_desc':
          return marginOf(b) - marginOf(a);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return list;
  }, [activeItems, searchQuery, categoryFilter, statusFilter, sortBy]);

  const closeModals = useCallback(() => {
    setStockInItem(null);
    setStockOutItem(null);
    setDetailItem(null);
    setStockInQty('');
    setStockInNotes('');
    setStockOutQty('');
    setStockOutReason('damage');
    setAddModalOpen(false);
    setAddStep(1);
    setAddForm(defaultAddForm());
    setEditItem(null);
    setEditForm(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModals();
    };
    if (stockInItem || stockOutItem || detailItem || addModalOpen || editItem) {
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [stockInItem, stockOutItem, detailItem, addModalOpen, editItem, closeModals]);

  const handleImageUpload = useCallback(
    async (item: InventoryItem, file: File | null) => {
      if (!file || !item.productId) return;
      setUploadingImageId(item.id);
      try {
        const client = createClient();
        const rawExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const ext =
          rawExt === 'jpeg' || rawExt === 'jpg' || rawExt === 'png' || rawExt === 'webp' || rawExt === 'gif'
            ? rawExt
            : 'jpg';
        const path = `products/${item.productId}_${Date.now()}.${ext}`;
        const { error: uploadError } = await client.storage.from('product-images').upload(path, file, {
          upsert: true,
          contentType: file.type || `image/${ext}`,
        });
        if (uploadError) {
          console.error('[Inventory] image upload:', uploadError.message);
          return;
        }
        const { data: pub } = client.storage.from('product-images').getPublicUrl(path);
        const url = pub.publicUrl;
        const { error: dbErr } = await client
          .from('product_master')
          .update({ image_url: url, updated_at: new Date().toISOString() })
          .eq('id', item.productId);
        if (dbErr) {
          console.error('[Inventory] product_master update:', dbErr.message);
          return;
        }
        await refetchInventory();
      } finally {
        setUploadingImageId(null);
      }
    },
    [refetchInventory]
  );

  const stockInBasePreview = stockInItem
    ? (() => {
        const n = parseFloat(stockInQty);
        if (Number.isNaN(n) || n <= 0) return null;
        return n * unitsPerBaseOf(stockInItem);
      })()
    : null;

  const stockOutMaxDisplay = stockOutItem ? displayUnitsFromStock(stockOutItem) : 0;

  const stockOutBasePreview = stockOutItem
    ? (() => {
        const n = parseFloat(stockOutQty);
        if (Number.isNaN(n) || n <= 0) return null;
        return n * unitsPerBaseOf(stockOutItem);
      })()
    : null;

  const stockOutQtyError =
    stockOutItem && stockOutQty
      ? (() => {
          const n = parseFloat(stockOutQty);
          if (Number.isNaN(n) || n <= 0) return 'Enter a positive quantity';
          if (n > stockOutMaxDisplay + 1e-9) return 'Quantity exceeds on-hand stock';
          return '';
        })()
      : '';

  async function submitStockIn() {
    if (!stockInItem || stockInBasePreview == null) return;
    const base = stockInBasePreview;
    await receiveStock({
      skuId: stockInItem.id,
      quantity: base,
      notes: stockInNotes.trim() || undefined,
    });
    closeModals();
  }

  async function submitStockOut() {
    if (!stockOutItem || stockOutQtyError || !stockOutBasePreview) return;
    await adjustStock({
      skuId: stockOutItem.id,
      quantity: -stockOutBasePreview,
      reason:
        STOCK_OUT_REASONS.find((r) => r.value === stockOutReason)?.label ?? stockOutReason,
    });
    closeModals();
  }

  function openEditModal(item: InventoryItem) {
    setEditForm({
      productName: item.productName,
      companyName: item.companyName ?? '',
      hsnCode: item.hsnCode ?? '',
      technicalName: item.technicalName ?? '',
      sellingPrice: item.sellingPrice ?? 0,
      mrp: item.mrp ?? 0,
      leadTimeDays: item.leadTimeDays ?? 7,
      gstPercent: item.gstPercent ?? 18,
      safetyStockBase: item.manualSafetyStockBase ?? item.safetyStockBase,
    });
    setEditItem(item);
  }

  async function submitEditProduct() {
    if (!session || !editItem || !editForm) return;
    setIsSavingEdit(true);
    try {
      const supabase = createClient();
      const { error: pmErr } = await supabase
        .from('product_master')
        .update({
          product_name: editForm.productName.trim(),
          company_name: editForm.companyName.trim() || null,
          hsn_code: editForm.hsnCode.trim() || null,
          technical_name: editForm.technicalName.trim() || null,
          gst_percent: editForm.gstPercent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editItem.productId);

      if (pmErr) throw pmErr;

      const { data: skuMeta } = await supabase
        .from('product_skus')
        .select('metadata')
        .eq('id', editItem.id)
        .maybeSingle();

      const prevMeta =
        skuMeta?.metadata && typeof skuMeta.metadata === 'object'
          ? (skuMeta.metadata as Record<string, unknown>)
          : {};

      const mergedMeta: Record<string, unknown> = {
        ...prevMeta,
        manual_safety_stock_base: editForm.safetyStockBase,
      };

      const { error: skuErr } = await supabase
        .from('product_skus')
        .update({
          selling_price_ex_gst: editForm.sellingPrice,
          mrp: editForm.mrp > 0 ? editForm.mrp : null,
          lead_time_days: editForm.leadTimeDays > 0 ? editForm.leadTimeDays : 7,
          metadata: mergedMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editItem.id);

      if (skuErr) throw skuErr;

      toast.success('Product updated');
      await refetchInventory();
      closeModals();
    } catch (e) {
      console.error(e);
      toast.error('Could not save changes');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function deactivateSku() {
    if (!editItem) return;
    if (
      !confirm(
        'This will hide the product from inventory. Stock data is preserved. Continue?'
      )
    ) {
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('product_skus')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', editItem.id);
      if (error) throw error;
      toast.success('Product deactivated');
      await refetchInventory();
      closeModals();
    } catch (e) {
      console.error(e);
      toast.error('Failed to deactivate');
    }
  }

  async function submitAddProduct() {
    if (!session) {
      toast.error('Sign in required');
      return;
    }
    const f = addForm;
    if (!f.productName.trim() || !f.displayLabel.trim() || f.unitsPerBase <= 0) {
      toast.error('Fill required fields');
      return;
    }
    try {
      const supabase = createClient();
      const productId = generateProductId();
      const now = new Date().toISOString();

      const { error: insErr } = await supabase.from('product_master').insert({
        id: productId,
        dealer_id: session.dealerId,
        product_name: f.productName.trim(),
        category: f.category,
        gst_percent: f.gstPercent,
        base_unit: f.baseUnit,
        company_name: f.companyName.trim() || null,
        hsn_code: f.hsnCode.trim() || null,
        technical_name: f.technicalName.trim() || null,
        is_active: true,
        created_at: now,
        updated_at: now,
      });

      if (insErr) throw insErr;

      const sku = await createSKU({
        productId,
        displayLabel: f.displayLabel.trim(),
        unitType: f.unitType,
        unitsPerBase: f.unitsPerBase,
        sellingPriceExGst: f.sellingPrice > 0 ? f.sellingPrice : undefined,
        leadTimeDays: f.leadTimeDays > 0 ? f.leadTimeDays : 7,
        mrp: f.mrp > 0 ? f.mrp : undefined,
      });

      if (f.openingStock > 0) {
        await receiveStock({
          skuId: sku.id,
          quantity: f.openingStock,
          notes: 'Opening stock',
        });
      }

      toast.success('Product added');
      await refetchInventory();
      closeModals();
    } catch (e) {
      console.error(e);
      toast.error('Could not create product');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <Skeleton className="h-28 rounded-lg w-full md:max-w-md" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[5.25rem] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const hasNoSkusEver = activeItems.length === 0 && items.length === 0;
  const hasOnlyInactiveSkus = activeItems.length === 0 && items.length > 0;
  const hasSkusFilteredEmpty = filteredItems.length === 0 && activeItems.length > 0;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('inventory.title')}</h1>
          <p className="mt-1 max-w-xl text-muted-foreground">{t('inventory.pageDescription')}</p>
        </div>
        <Button
          type="button"
          className="shrink-0 self-start gap-2"
          onClick={() => {
            setAddStep(1);
            setAddForm(defaultAddForm());
            setAddModalOpen(true);
          }}
        >
          <Package className="h-4 w-4" aria-hidden />
          {t('inventory.addProduct')}
        </Button>
      </div>

      {reorderRequiredItems.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-foreground"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm">
            <span className="font-semibold">Reorder alert:</span> {reorderRequiredItems.length}{' '}
            {reorderRequiredItems.length === 1 ? 'SKU is' : 'SKUs are'} at or below half of safety —
            replenish soon.
          </p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Total SKUs</p>
          <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{activeItems.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-warning">Low stock</p>
          <p className="mt-1 text-xl font-bold text-warning tabular-nums">{lowStockItems.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-destructive">Reorder</p>
          <p className="mt-1 text-xl font-bold text-destructive tabular-nums">
            {reorderRequiredItems.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden /> Stock value (cost)
          </p>
          <p className="mt-1 flex items-center gap-1 text-xl font-bold text-foreground tabular-nums">
            <IndianRupee className="h-4 w-4 text-muted-foreground" aria-hidden />
            {metrics.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs sm:col-span-2 lg:col-span-1">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden /> Potential revenue
          </p>
          <p className="mt-1 flex items-center gap-1 text-xl font-bold text-primary tabular-nums">
            <IndianRupee className="h-4 w-4 text-muted-foreground" aria-hidden />
            {metrics.totalSelling.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search name, label, company, category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search inventory"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" aria-hidden /> Sort
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByValue)}
              className="h-9 min-w-[10rem] rounded-md border border-input bg-background px-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sort inventory"
            >
              <option value="name">Name (A–Z)</option>
              <option value="stock_desc">Stock (high → low)</option>
              <option value="stock_asc">Stock (low → high)</option>
              <option value="value_desc">Stock value (cost)</option>
              <option value="margin_desc">Est. margin %</option>
            </select>
          </div>
        </div>

        {categoryPillSegments.length > 0 && (
          <p className="text-right text-2xs text-muted-foreground">
            {categoryPillSegments.map(({ cat, count }, idx) => (
              <span key={cat}>
                {idx > 0 ? ' · ' : ''}
                <span className="font-medium text-foreground/80">{labelCategory(cat)}</span>: {count}
              </span>
            ))}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Category</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              All
            </button>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {labelCategory(cat)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-2">
            {(['all', 'healthy', 'low', 'reorder'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {hasNoSkusEver ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-foreground">No inventory yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Add your first product with the button above — pack size, GST, and opening stock in one flow.
          </p>
          <Button
            type="button"
            className="mt-6"
            onClick={() => {
              setAddStep(1);
              setAddForm(defaultAddForm());
              setAddModalOpen(true);
            }}
          >
            Add Product
          </Button>
        </div>
      ) : hasOnlyInactiveSkus ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-foreground">No active SKUs</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Every SKU for this shop is marked inactive. Activate one in the database or add a new product.
          </p>
          <Button
            type="button"
            className="mt-6"
            onClick={() => {
              setAddStep(1);
              setAddForm(defaultAddForm());
              setAddModalOpen(true);
            }}
          >
            Add Product
          </Button>
        </div>
      ) : hasSkusFilteredEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Search className="h-11 w-11 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-foreground">No matches</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Adjust search or filters — or reset filters to see all active SKUs.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-6"
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('all');
              setStatusFilter('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="space-y-3" aria-busy={isReceivingStock || isAdjustingStock}>
          {filteredItems.map((item) => {
            const status = item.stockStatus ?? 'healthy';
            const borderAccent =
              status === 'reorder'
                ? 'border-l-destructive'
                : status === 'low'
                  ? 'border-l-warning'
                  : 'border-l-primary';

            const busy = uploadingImageId === item.id;

            return (
              <li
                key={item.id}
                className={`overflow-hidden rounded-lg border border-border border-l-4 bg-card shadow-sm ${borderAccent}`}
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                    <label
                      className="absolute inset-0 flex cursor-pointer items-center justify-center bg-foreground/50 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100"
                      aria-label={`Upload photo for ${item.productName}`}
                    >
                      {busy ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
                      ) : (
                        <Camera className="h-5 w-5 text-primary-foreground" aria-hidden />
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          void handleImageUpload(item, f ?? null);
                          e.target.value = '';
                        }}
                        disabled={busy}
                      />
                    </label>
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-foreground">
                          {item.productName}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {item.displayLabel} · {labelCategory(item.category)} · {item.unit}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${
                            status === 'reorder'
                              ? 'bg-destructive/10 text-destructive ring-destructive/30'
                              : status === 'low'
                                ? 'bg-warning/10 text-warning ring-warning/30'
                                : 'bg-primary-muted text-primary-strong ring-primary/25'
                          }`}
                        >
                          {status === 'healthy' ? 'Healthy' : status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground">On hand</p>
                        <p className="font-medium tabular-nums text-foreground">
                          {displayUnitsFromStock(item).toLocaleString('en-IN', { maximumFractionDigits: 2 })}{' '}
                          <span className="text-muted-foreground">{item.unit}</span>
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {item.stock.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {item.baseUnit}{' '}
                          base
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Safety</p>
                        <p className="font-medium tabular-nums text-foreground">
                          {item.safetyStockBase.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{' '}
                          <span className="text-muted-foreground">{item.baseUnit}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cost / base</p>
                        <p className="font-medium tabular-nums text-foreground">
                          {formatInrDetail(item.costPrice ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sell / unit</p>
                        <p className="font-medium tabular-nums text-foreground">
                          {item.sellingPrice != null ? formatInrDetail(item.sellingPrice) : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        title="Edit product"
                        onClick={() => openEditModal(item)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={isReceivingStock || isAdjustingStock}
                        onClick={() => {
                          setStockInQty('');
                          setStockInNotes('');
                          setStockInItem(item);
                        }}
                      >
                        <ArrowDownToLine className="h-4 w-4" aria-hidden />
                        Stock in
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={isReceivingStock || isAdjustingStock || item.stock <= 0}
                        onClick={() => {
                          setStockOutQty('');
                          setStockOutReason('damage');
                          setStockOutItem(item);
                        }}
                      >
                        <ArrowUpFromLine className="h-4 w-4 text-destructive" aria-hidden />
                        Stock out
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto gap-1 text-muted-foreground"
                        onClick={() => setDetailItem(item)}
                      >
                        Details
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer summary */}
      {!hasNoSkusEver && activeItems.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-start gap-2">
            <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">Valuation outlook</p>
              <p className="text-xs text-muted-foreground">
                Potential profit compares selling-through at list price (ex-GST) minus stock at recorded
                cost.
              </p>
            </div>
          </div>
          <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-2 text-sm sm:mt-0">
            <div>
              <dt className="text-xs text-muted-foreground">Potential profit</dt>
              <dd
                className={`text-lg font-bold tabular-nums ${
                  metrics.potentialProfit >= 0 ? 'text-primary' : 'text-destructive'
                }`}
              >
                {formatInr(metrics.potentialProfit)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Margin on potential revenue</dt>
              <dd className="text-lg font-bold tabular-nums text-foreground">
                {metrics.totalSelling <= 0
                  ? '—'
                  : `${metrics.marginPct.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {(stockInItem || stockOutItem || detailItem) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
          <button
            type="button"
            className="absolute inset-0 cursor-default appearance-none bg-transparent"
            aria-label="Close dialog"
            onClick={closeModals}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-popover shadow-lg animate-fade-in"
          >
            {stockInItem && (
              <div className="max-h-[min(90vh,36rem)] overflow-y-auto p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Stock in</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{stockInItem.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModals}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="stock-in-qty">Quantity ({stockInItem.unit})</Label>
                    <Input
                      id="stock-in-qty"
                      inputMode="decimal"
                      placeholder="e.g. 10"
                      value={stockInQty}
                      onChange={(e) => setStockInQty(e.target.value)}
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-2xs text-muted-foreground">
                      1 {stockInItem.unit} = {unitsPerBaseOf(stockInItem)} {stockInItem.baseUnit} base ·
                      preview:{' '}
                      {stockInBasePreview != null ? (
                        <span className="font-medium text-foreground tabular-nums">
                          +{stockInBasePreview.toLocaleString('en-IN', { maximumFractionDigits: 4 })}{' '}
                          {stockInItem.baseUnit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="stock-in-notes">Notes (optional)</Label>
                    <Input
                      id="stock-in-notes"
                      placeholder="GRN reference, remarks…"
                      value={stockInNotes}
                      onChange={(e) => setStockInNotes(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full gap-2"
                    disabled={
                      stockInBasePreview == null ||
                      stockInBasePreview <= 0 ||
                      isReceivingStock ||
                      Number.isNaN(parseFloat(stockInQty))
                    }
                    onClick={() => void submitStockIn()}
                  >
                    {isReceivingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Confirm receive
                  </Button>
                </div>
              </div>
            )}

            {stockOutItem && (
              <div className="max-h-[min(90vh,36rem)] overflow-y-auto p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Stock out</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{stockOutItem.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModals}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Max {stockOutMaxDisplay.toLocaleString('en-IN', { maximumFractionDigits: 4 })}{' '}
                  {stockOutItem.unit}
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="stock-out-qty">Quantity ({stockOutItem.unit})</Label>
                    <Input
                      id="stock-out-qty"
                      inputMode="decimal"
                      placeholder="e.g. 2"
                      value={stockOutQty}
                      onChange={(e) => setStockOutQty(e.target.value)}
                      className="mt-1.5"
                      aria-invalid={!!stockOutQtyError}
                      aria-describedby={stockOutQtyError ? 'stock-out-qty-err' : undefined}
                    />
                    {stockOutQtyError ? (
                      <p id="stock-out-qty-err" role="alert" className="mt-1 text-2xs text-destructive">
                        {stockOutQtyError}
                      </p>
                    ) : (
                      <p className="mt-1 text-2xs text-muted-foreground">
                        Base deduction preview:{' '}
                        {stockOutBasePreview != null ? (
                          <span className="font-medium text-destructive tabular-nums">
                            −{stockOutBasePreview.toLocaleString('en-IN', {
                              maximumFractionDigits: 4,
                            })}{' '}
                            {stockOutItem.baseUnit}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="stock-out-reason">Reason</Label>
                    <select
                      id="stock-out-reason"
                      value={stockOutReason}
                      onChange={(e) => setStockOutReason(e.target.value)}
                      className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {STOCK_OUT_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full gap-2"
                    disabled={!!stockOutQtyError || !stockOutQty.trim() || isAdjustingStock}
                    onClick={() => void submitStockOut()}
                  >
                    {isAdjustingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Confirm stock out
                  </Button>
                </div>
              </div>
            )}

            {detailItem && !stockInItem && !stockOutItem && (
              <div className="max-h-[min(90vh,42rem)] overflow-y-auto p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">SKU details</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{detailItem.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModals}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <DetailField label="Product" value={detailItem.productName} />
                  <DetailField label="SKU label" value={detailItem.displayLabel} />
                  <DetailField label="Category" value={labelCategory(detailItem.category)} />
                  <DetailField label="SKU unit" value={detailItem.unit} />
                  <DetailField
                    label="Units / base"
                    value={String(unitsPerBaseOf(detailItem)) + ' · ' + detailItem.baseUnit}
                  />
                  <DetailField
                    label="On hand"
                    value={
                      `${displayUnitsFromStock(detailItem).toLocaleString('en-IN')} ${detailItem.unit} · ${detailItem.stock.toLocaleString('en-IN')} ${detailItem.baseUnit} base`
                    }
                  />
                  <DetailField label="GST %" value={(detailItem.gstPercent ?? 0).toString()} />
                  <DetailField label="Safety (base)" value={String(detailItem.safetyStockBase)} />
                  <DetailField label="Lead time (days)" value={String(detailItem.leadTimeDays ?? '—')} />
                  <DetailField
                    label="Cost / base"
                    value={formatInrDetail(detailItem.costPrice ?? 0)}
                  />
                  <DetailField
                    label="Sell / unit"
                    value={
                      detailItem.sellingPrice != null ? formatInrDetail(detailItem.sellingPrice) : '—'
                    }
                  />
                  <DetailField label="MRP" value={detailItem.mrp != null ? formatInrDetail(detailItem.mrp) : '—'} />
                  <DetailField label="Company" value={detailItem.companyName} />
                  <DetailField label="HSN" value={detailItem.hsnCode} />
                  <DetailField label="Technical" value={detailItem.technicalName} />
                  <DetailField label="Formulation" value={detailItem.formulation} />
                  <DetailField label="CIB reg. no." value={detailItem.cibRegNumber} />
                  <DetailField label="Crop" value={detailItem.cropName} />
                  <DetailField label="Variety" value={detailItem.variety} />
                  <DetailField label="Seed class" value={detailItem.seedClass} />
                  <DetailField label="Batch" value={detailItem.batchNumber} />
                  <DetailField label="Lot" value={detailItem.lotNumber} />
                  <DetailField label="Manufacturing" value={detailItem.manufacturingDate} />
                  <DetailField label="Expiry" value={detailItem.expiryDate} />
                  <DetailField label="SKU id" value={detailItem.id} mono />
                  <DetailField label="Product id" value={detailItem.productId} mono />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {addModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={closeModals}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Add product</h2>
                <p className="text-xs text-muted-foreground">
                  Step {addStep} of 2 — {addStep === 1 ? 'Product details' : 'Pack / stock'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModals}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              {addStep === 1 ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground">Product name *</label>
                    <input
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.productName}
                      onChange={(e) => setAddForm((p) => ({ ...p, productName: e.target.value }))}
                      placeholder="e.g. DAP Fertilizer"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Category *</label>
                    <select
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.category}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, category: e.target.value as ItemCategory }))
                      }
                    >
                      <option value="fertilizer">Fertilizer</option>
                      <option value="pesticide">Pesticide</option>
                      <option value="insecticide">Insecticide</option>
                      <option value="seeds">Seeds</option>
                      <option value="others">Others</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Base unit *</label>
                    <select
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.baseUnit}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          baseUnit: e.target.value as InventoryBaseUnit,
                        }))
                      }
                    >
                      <option value="kg">kg</option>
                      <option value="litre">litre</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">GST %</label>
                    <select
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.gstPercent}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, gstPercent: Number(e.target.value) }))
                      }
                    >
                      {GST_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {g}%
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Company / manufacturer
                    </label>
                    <input
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.companyName}
                      onChange={(e) => setAddForm((p) => ({ ...p, companyName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">HSN code</label>
                    <input
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.hsnCode}
                      onChange={(e) => setAddForm((p) => ({ ...p, hsnCode: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Technical name</label>
                    <input
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.technicalName}
                      onChange={(e) => setAddForm((p) => ({ ...p, technicalName: e.target.value }))}
                      placeholder="For pesticides"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground">Pack size label *</label>
                    <input
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.displayLabel}
                      onChange={(e) => setAddForm((p) => ({ ...p, displayLabel: e.target.value }))}
                      placeholder="e.g. 50kg bag"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Unit type *</label>
                    <select
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.unitType}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, unitType: e.target.value as ItemUnit }))
                      }
                    >
                      <option value="kg">kg</option>
                      <option value="litre">litre</option>
                      <option value="packet">packet</option>
                      <option value="bag">bag</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Units per base *</label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.unitsPerBase || ''}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          unitsPerBase: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    <p className="mt-1 text-2xs text-muted-foreground">Base units in one pack</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Selling price (ex-GST) / pack (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.sellingPrice || ''}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          sellingPrice: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">MRP (₹)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.mrp || ''}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, mrp: parseFloat(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Lead time (days)</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.leadTimeDays || ''}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          leadTimeDays: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Opening stock (base units)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={addForm.openingStock || ''}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          openingStock: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </>
              )}
            </div>

            <div className="sticky bottom-0 flex gap-3 border-t border-border bg-card p-4">
              <button
                type="button"
                onClick={closeModals}
                className="flex-1 rounded-md border border-border py-2 text-sm font-medium text-foreground"
              >
                Cancel
              </button>
              {addStep === 1 ? (
                <button
                  type="button"
                  disabled={!addForm.productName.trim()}
                  onClick={() => setAddStep(2)}
                  className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAddStep(1)}
                    className="flex-1 rounded-md border border-border py-2 text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={
                      isCreatingSKU ||
                      isReceivingStock ||
                      !addForm.displayLabel.trim() ||
                      addForm.unitsPerBase <= 0
                    }
                    onClick={() => void submitAddProduct()}
                    className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {isCreatingSKU || isReceivingStock ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                      </span>
                    ) : (
                      'Create product'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editItem && editForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={closeModals}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-foreground">Edit product</h2>
              <button
                type="button"
                onClick={closeModals}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              <p className="text-xs text-muted-foreground">
                {editItem.displayLabel} · {labelCategory(editItem.category)}
              </p>
              <div>
                <label className="text-sm font-medium text-foreground">Product name</label>
                <input
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editForm.productName}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, productName: e.target.value } : f))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Company</label>
                <input
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editForm.companyName}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, companyName: e.target.value } : f))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">HSN code</label>
                <input
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editForm.hsnCode}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, hsnCode: e.target.value } : f))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Technical name</label>
                <input
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editForm.technicalName}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, technicalName: e.target.value } : f))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">GST %</label>
                <select
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editForm.gstPercent}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, gstPercent: Number(e.target.value) } : f
                    )
                  }
                >
                  {GST_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}%
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Selling price (ex-GST) / pack (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editForm.sellingPrice || ''}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, sellingPrice: parseFloat(e.target.value) || 0 } : f
                    )
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">MRP (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editForm.mrp || ''}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, mrp: parseFloat(e.target.value) || 0 } : f
                    )
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Lead time (days)</label>
                <input
                  type="number"
                  min={1}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editForm.leadTimeDays || ''}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f
                        ? { ...f, leadTimeDays: parseInt(e.target.value, 10) || 7 }
                        : f
                    )
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Safety stock (base units)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editForm.safetyStockBase || ''}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f
                        ? { ...f, safetyStockBase: parseFloat(e.target.value) || 0 }
                        : f
                    )
                  }
                />
                <p className="mt-1 text-2xs text-muted-foreground">
                  Overrides default (lead time). Used for low / reorder alerts.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => void deactivateSku()}
              >
                Deactivate product
              </Button>
            </div>

            <div className="sticky bottom-0 flex gap-3 border-t border-border bg-card p-4">
              <button
                type="button"
                onClick={closeModals}
                className="flex-1 rounded-md border border-border py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => void submitEditProduct()}
                className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField(props: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (props.value == null || props.value === '') return null;
  return (
    <div>
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{props.label}</p>
      <p
        className={`mt-1 text-sm text-foreground ${props.mono ? 'font-mono text-xs break-all' : ''}`}
      >
        {props.value}
      </p>
    </div>
  );
}
