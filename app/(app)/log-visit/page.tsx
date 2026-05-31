'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { useSales } from '@/contexts/SalesContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatINR } from '@/lib/format';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CropStage, SaleItem } from '@/constants/types';
import {
  ArrowLeft, ArrowRight, Check, Search, MapPin, Phone,
  Plus, Minus, Trash2, Package, Banknote, Smartphone,
  CreditCard, CheckCircle2, ChevronRight, Clock, X,
  AlertCircle, Droplets, Wind, Leaf, Bug, FlaskConical,
  Sprout, CalendarDays, FileText, IndianRupee,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

const ISSUE_TAG_DEFS: { key: string; icon: typeof Bug }[] = [
  { key: 'sales.issue.pest', icon: Bug },
  { key: 'sales.issue.disease', icon: FlaskConical },
  { key: 'sales.issue.nutrient', icon: Leaf },
  { key: 'sales.issue.water', icon: Droplets },
  { key: 'sales.issue.weed', icon: Sprout },
  { key: 'sales.issue.weather', icon: Wind },
];

interface CartItem {
  inventoryId: string;
  productId: string;
  name: string;
  displayLabel: string;
  unit: string;
  unitsPerBase: number;
  priceExGst: number;
  gstPercent: number;
  costPrice: number;
  qty: number;
}

export default function LogVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { farmers, visits, logVisit } = useData();
  const { addSale, isAddingSale, sales } = useSales();
  const { activeItems } = useInventory();

  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1
  const [farmerId, setFarmerId] = useState('');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    const q = searchParams.get('farmerId');
    if (q && farmers.some((f) => f.id === q)) {
      setFarmerId(q);
    }
  }, [searchParams, farmers]);

  // Step 2
  const [cropStage, setCropStage]     = useState<CropStage | ''>('');
  const [issues, setIssues]           = useState<string[]>([]);
  const [customIssue, setCustomIssue] = useState('');
  const [notes, setNotes]             = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Step 3
  const [productSearch, setProductSearch]   = useState('');
  const [cart, setCart]                     = useState<CartItem[]>([]);
  const [discountType, setDiscountType]     = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue]   = useState(0);

  // Step 4
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'credit'>('cash');
  const [paidAmount, setPaidAmount]   = useState('');
  const [dueDate, setDueDate]         = useState('');
  const [creditNote, setCreditNote]   = useState('');

  const CROP_STAGES = useMemo(
    (): { value: CropStage; label: string; sub: string }[] => [
      { value: 'seedling', label: t('sales.stage.seedling'), sub: t('sales.stageSub.seedling') },
      { value: 'vegetative', label: t('sales.stage.vegetative'), sub: t('sales.stageSub.vegetative') },
      { value: 'flowering', label: t('sales.stage.flowering'), sub: t('sales.stageSub.flowering') },
      { value: 'fruiting', label: t('sales.stage.fruiting'), sub: t('sales.stageSub.fruiting') },
      { value: 'harvest', label: t('sales.stage.harvest'), sub: t('sales.stageSub.harvest') },
    ],
    [t]
  );

  const stepLabels = useMemo(
    () => [
      t('sales.selectFarmer'),
      t('sales.stepObservation'),
      t('sales.stepProducts'),
      t('sales.stepPayment'),
    ],
    [t]
  );

  // ── Derived ──────────────────────────────────────────────────────────────
  const farmer = farmers.find(f => f.id === farmerId);

  const recentFarmers = useMemo(() => {
    return [...farmers]
      .sort((a, b) => {
        const av = visits.filter(v => v.farmerId === a.id);
        const bv = visits.filter(v => v.farmerId === b.id);
        const al = av.length ? new Date(av[av.length - 1].createdAt).getTime() : 0;
        const bl = bv.length ? new Date(bv[bv.length - 1].createdAt).getTime() : 0;
        return bl - al;
      })
      .slice(0, 8);
  }, [farmers, visits]);

  const filteredFarmers = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return farmers.filter(f =>
      f.fullName.toLowerCase().includes(q) ||
      f.mobile.includes(q) ||
      f.village.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [farmers, search]);

  const filteredProducts = useMemo(() => {
    const inStock = activeItems.filter(i => i.stock > 0);
    if (!productSearch.trim()) return inStock.slice(0, 15);
    const q = productSearch.toLowerCase();
    return inStock.filter(i =>
      i.productName.toLowerCase().includes(q) ||
      i.displayLabel.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [activeItems, productSearch]);

  // Cart maths
  const subtotal = cart.reduce((s, i) => {
    return s + i.priceExGst * (1 + i.gstPercent / 100) * i.qty;
  }, 0);
  const discountAmt = discountType === 'percentage'
    ? (subtotal * discountValue) / 100
    : Math.min(discountValue, subtotal);
  const finalAmount = Math.max(0, subtotal - discountAmt);
  const paidNum     = parseFloat(paidAmount) || 0;
  const balanceDue  = Math.max(0, finalAmount - paidNum);

  const farmerLastVisit = farmer
    ? visits.filter(v => v.farmerId === farmer.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;
  const farmerCredit = farmer
    ? sales.filter(s => s.farmerId === farmer.id && s.balanceDue > 0)
        .reduce((s, x) => s + x.balanceDue, 0)
    : 0;

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addToCart = (item: typeof activeItems[0]) => {
    if (cart.find(c => c.inventoryId === item.id)) {
      setCart(prev => prev.map(c => c.inventoryId === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart(prev => [...prev, {
        inventoryId: item.id,
        productId:   item.productId,
        name:        item.productName,
        displayLabel: item.displayLabel,
        unit:         item.unit,
        unitsPerBase: item.unitsPerBase,
        priceExGst:   item.sellingPrice ?? 0,
        gstPercent:   item.gstPercent ?? 0,
        costPrice:    item.effectiveCostPerUnit ?? 0,
        qty:          1,
      }]);
    }
    setProductSearch('');
  };
  const updateQty   = (id: string, qty: number) => {
    if (qty < 0.1) { setCart(p => p.filter(c => c.inventoryId !== id)); return; }
    setCart(p => p.map(c => c.inventoryId === id ? { ...c, qty } : c));
  };
  const updatePrice = (id: string, price: number) =>
    setCart(p => p.map(c => c.inventoryId === id ? { ...c, priceExGst: price } : c));
  const removeItem  = (id: string) => setCart(p => p.filter(c => c.inventoryId !== id));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!farmerId || !cropStage) return;
    setIsSubmitting(true);
    try {
      const visit = await logVisit({
        farmerId,
        cropStage: cropStage as CropStage,
        issues,
        customIssue: customIssue || undefined,
        notes,
        followUpDate: followUpDate || undefined,
        items: cart.length > 0 ? cart.map(c => ({
          itemId:       c.inventoryId,
          productId:    c.productId,
          itemName:     `${c.name} · ${c.displayLabel}`,
          quantity:     c.qty,
          unit:         c.unit as any,
          unitsPerBase: c.unitsPerBase,
        })) : undefined,
      });

      if (cart.length > 0) {
        const saleItems: SaleItem[] = cart.map(c => {
          const exGst   = c.priceExGst * c.qty;
          const gst     = exGst * (c.gstPercent / 100);
          const incGst  = exGst + gst;
          const ppu     = c.priceExGst * (1 + c.gstPercent / 100);
          return {
            itemId:            c.inventoryId,
            productId:         c.productId,
            itemName:          `${c.name} · ${c.displayLabel}`,
            quantity:          c.qty,
            unit:              c.unit as any,
            unitsPerBase:      c.unitsPerBase,
            priceExGst:        c.priceExGst,
            gstPercent:        c.gstPercent,
            gstAmountPerUnit:  c.priceExGst * (c.gstPercent / 100),
            priceIncGstPerUnit: ppu,
            pricePerUnit:      ppu,
            lineTotalExGst:    exGst,
            lineGstAmount:     gst,
            lineTotalIncGst:   incGst,
            totalAmount:       incGst,
            costPrice:         c.costPrice,
          };
        });
        await addSale({
          farmerId,
          visitId:       visit.id,
          items:         saleItems,
          discountType,
          discountValue,
          paymentMode:   paymentMode as any,
          paidAmount:    paidNum,
          dueDate:       dueDate || undefined,
          creditNote:    creditNote || undefined,
        });
        toast.success(t('sales.visitLoggedBill'));
      } else {
        toast.success(t('sales.visitLogged'));
      }
      router.push(`/farmers/${farmerId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg || t('sales.errorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex h-12 max-w-2xl items-center gap-3 px-4">
          <button
            onClick={() => step > 1 ? setStep(s => (s - 1) as Step) : router.back()}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{step > 1 ? t('sales.back') : t('common.cancel')}</span>
          </button>

          {/* Step indicator */}
          <div className="flex flex-1 items-center justify-center">
            {stepLabels.map((label, i) => {
              const n    = (i + 1) as Step;
              const done = step > n;
              const curr = step === n;
              return (
                <div key={n} className="flex items-center">
                  <button
                    disabled={n > step}
                    onClick={() => done && setStep(n)}
                    className="flex items-center gap-1.5"
                  >
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-all',
                      done ? 'bg-primary text-white'
                        : curr ? 'border-2 border-primary bg-primary/10 text-primary'
                        : 'border border-border text-muted-foreground'
                    )}>
                      {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : n}
                    </span>
                    <span className={cn(
                      'hidden text-xs sm:block',
                      curr ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    )}>
                      {label}
                    </span>
                  </button>
                  {i < 3 && <ChevronRight className="mx-1.5 h-3 w-3 text-muted-foreground/40" />}
                </div>
              );
            })}
          </div>

          <span className="text-xs text-muted-foreground tabular-nums">{step}/4</span>
        </div>

        {/* Thin progress line */}
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </header>

      {/* ── Page body ── */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">

        {/* ════ STEP 1: FARMER ════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-base font-semibold">{t('sales.title')}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('sales.subtitle')}</p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-foreground">{t('sales.selectFarmer')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('sales.searchFarmerHint')}</p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('sales.searchFarmerPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 pl-9 text-sm"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Search results */}
            {search && (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                {filteredFarmers.length === 0 ? (
                  <p className="px-4 py-5 text-center text-sm text-muted-foreground">{t('sales.noFarmersFound')}</p>
                ) : filteredFarmers.map(f => (
                  <FarmerRow key={f.id} farmer={f} selected={farmerId === f.id}
                    onClick={() => { setFarmerId(f.id); setSearch(''); }} />
                ))}
              </div>
            )}

            {/* Selected farmer */}
            {farmer && !search && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {farmer.fullName[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{farmer.fullName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {farmer.mobile} · {farmer.village}{farmer.taluka ? `, ${farmer.taluka}` : ''}
                      </p>
                      {farmer.cropCycle?.length > 0 && (
                        <div className="mt-1.5 flex gap-1">
                          {farmer.cropCycle.map(c => (
                            <span key={c} className="rounded border border-border px-1.5 py-0.5 text-2xs font-medium capitalize text-muted-foreground">
                              {t(`farmers.${c}`)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setFarmerId('')} className="rounded p-1 text-muted-foreground hover:bg-muted">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {(farmerLastVisit || farmerCredit > 0) && (
                  <div className="mt-3 flex gap-4 border-t border-primary/15 pt-3">
                    <div>
                      <p className="text-2xs text-muted-foreground">{t('sales.lastVisit')}</p>
                      <p className="mt-0.5 text-xs font-medium">
                        {farmerLastVisit
                          ? new Date(farmerLastVisit.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : t('sales.firstVisit')}
                      </p>
                    </div>
                    {farmerCredit > 0 && (
                      <div>
                        <p className="text-2xs text-muted-foreground">{t('sales.udhaarPending')}</p>
                        <p className="mt-0.5 text-xs font-semibold text-warning">{formatINR(farmerCredit)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recent farmers */}
            {!search && !farmerId && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t('sales.recent')}</p>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {recentFarmers.map(f => (
                    <FarmerRow key={f.id} farmer={f} selected={false} onClick={() => setFarmerId(f.id)} />
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full" size="sm" disabled={!farmerId} onClick={() => setStep(2)}>
              {t('sales.continue')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* ════ STEP 2: OBSERVATION ═══════════════════════════════════════════ */}
        {step === 2 && farmer && (
          <div className="space-y-6">
            <div>
              <h1 className="text-base font-semibold">{t('sales.stepObservation')}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{farmer.fullName} · {farmer.village}</p>
            </div>

            {/* Crop stage — compact segmented rows */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('sales.cropStageLabel')} <span className="text-destructive">*</span>
              </Label>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                {CROP_STAGES.map((s, i) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setCropStage(s.value)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors last:border-0',
                      cropStage === s.value
                        ? 'bg-primary/8'
                        : 'hover:bg-muted/40'
                    )}
                  >
                    <div className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all',
                      cropStage === s.value
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    )}>
                      {cropStage === s.value && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1">
                      <span className={cn(
                        'text-sm font-medium',
                        cropStage === s.value ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {s.label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{s.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('sales.issuesObserved')}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {ISSUE_TAG_DEFS.map(({ key, icon: Icon }) => {
                  const active = issues.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIssues(prev =>
                        active ? prev.filter(i => i !== key) : [...prev, key]
                      )}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
                        active
                          ? 'border-foreground/30 bg-foreground/8 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {t(key)}
                    </button>
                  );
                })}
              </div>
              <Input
                placeholder={t('sales.otherIssuePlaceholder')}
                value={customIssue}
                onChange={e => setCustomIssue(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('sales.visitNotes')}
              </Label>
              <Textarea
                placeholder={t('sales.visitNotesPlaceholder')}
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="resize-none text-sm"
              />
            </div>

            {/* Follow-up */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('sales.followUpDate')}
                <span className="ml-1 font-normal normal-case text-muted-foreground/60">{t('sales.followUpOptional')}</span>
              </Label>
              <Input
                type="date"
                className="h-8 text-sm"
                min={format(new Date(), 'yyyy-MM-dd')}
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> {t('sales.back')}
              </Button>
              <Button size="sm" className="flex-1" disabled={!cropStage} onClick={() => setStep(3)}>
                {t('sales.continue')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ════ STEP 3: PRODUCTS ══════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-base font-semibold">{t('sales.addProduct')}</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('sales.productsOptionalHint')}
                </p>
              </div>
              {cart.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('sales.cartTotalLabel')}</p>
                  <p className="text-sm font-bold">{formatINR(finalAmount)}</p>
                </div>
              )}
            </div>

            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('sales.searchInventoryPlaceholder')}
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="h-9 pl-9 text-sm"
              />
              {productSearch && (
                <button onClick={() => setProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Product dropdown */}
            {(productSearch || cart.length === 0) && filteredProducts.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                {filteredProducts.map(item => {
                  const inCart  = cart.find(c => c.inventoryId === item.id);
                  const priceIncGst = (item.sellingPrice ?? 0) * (1 + (item.gstPercent ?? 0) / 100);
                  const stockQty = item.stock / item.unitsPerBase;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addToCart(item)}
                      className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.displayLabel}
                          <span className="mx-1.5 text-border">·</span>
                          {stockQty.toFixed(1)} {item.unit} {t('sales.inStockSuffix')}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{priceIncGst > 0 ? formatINR(priceIncGst) : '—'}</p>
                        <p className="text-2xs text-muted-foreground">{t('sales.inclGst')}</p>
                      </div>
                      <div className={cn(
                        'ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all',
                        inCart ? 'bg-primary' : 'border border-border'
                      )}>
                        {inCart
                          ? <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          : <Plus className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Cart */}
            {cart.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {cart.length === 1
                    ? t('sales.cartHeadingOne').replace('{count}', String(cart.length))
                    : t('sales.cartHeadingMany').replace('{count}', String(cart.length))}
                </p>

                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {cart.map((item, idx) => {
                    const lineTotal = item.priceExGst * (1 + item.gstPercent / 100) * item.qty;
                    return (
                      <div key={item.inventoryId} className={cn(
                        'px-4 py-3',
                        idx < cart.length - 1 && 'border-b border-border'
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.displayLabel} · {item.gstPercent}% GST</p>
                          </div>
                          <button
                            onClick={() => removeItem(item.inventoryId)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          {/* Qty */}
                          <div className="flex items-center rounded-md border border-border">
                            <button
                              onClick={() => updateQty(item.inventoryId, parseFloat((item.qty - 1).toFixed(2)))}
                              className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:bg-muted rounded-l-md"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              value={item.qty}
                              onChange={e => updateQty(item.inventoryId, parseFloat(e.target.value) || 1)}
                              className="w-12 bg-transparent py-1 text-center text-xs font-semibold focus:outline-none"
                              min={0.1} step={0.5}
                            />
                            <button
                              onClick={() => updateQty(item.inventoryId, item.qty + 1)}
                              className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:bg-muted rounded-r-md"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="text-xs text-muted-foreground">{item.unit}</span>

                          {/* Price */}
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                            <input
                              type="number"
                              value={item.priceExGst || ''}
                              onChange={e => updatePrice(item.inventoryId, parseFloat(e.target.value) || 0)}
                              className="h-7 w-full rounded-md border border-border bg-background pl-6 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder={t('sales.exGstShort')}
                              min={0}
                            />
                          </div>

                          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatINR(lineTotal)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Discount */}
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">{t('sales.discountLabel')}</span>
                  <div className="flex rounded-md border border-border text-xs">
                    <button
                      onClick={() => setDiscountType('flat')}
                      className={cn('rounded-l-md px-2.5 py-1 font-medium transition-colors',
                        discountType === 'flat' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
                      )}
                    >₹</button>
                    <button
                      onClick={() => setDiscountType('percentage')}
                      className={cn('rounded-r-md px-2.5 py-1 font-medium transition-colors',
                        discountType === 'percentage' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
                      )}
                    >%</button>
                  </div>
                  <input
                    type="number"
                    value={discountValue || ''}
                    onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 rounded-md border border-border bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    min={0}
                  />
                  <div className="ml-auto text-right">
                    {discountAmt > 0 && (
                      <p className="text-xs text-primary">-{formatINR(discountAmt)}</p>
                    )}
                    <p className="text-sm font-bold">{formatINR(finalAmount)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> {t('sales.back')}
              </Button>
              <Button size="sm" className="flex-1" onClick={() => {
                if (cart.length === 0) {
                  setPaymentMode('cash');
                  setPaidAmount('0');
                } else {
                  setPaidAmount(paymentMode === 'credit' ? '0' : finalAmount.toFixed(0));
                }
                setStep(4);
              }}>
                {cart.length === 0 ? t('sales.skipSaveVisit') : t('sales.continue')}
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ════ STEP 4: PAYMENT ═══════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-base font-semibold">{cart.length > 0 ? t('sales.paymentHeading') : t('sales.confirmVisitHeading')}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{farmer?.fullName} · {farmer?.village}</p>
            </div>

            {cart.length > 0 ? (
              <>
                {/* Bill total strip */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('sales.billTotal')}</p>
                    <p className="text-2xl font-bold tabular-nums">{formatINR(finalAmount)}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{cart.length} {cart.length === 1 ? t('sales.cartItemOne') : t('common.items')}</p>
                    {discountAmt > 0 && <p className="text-primary">-{formatINR(discountAmt)} {t('sales.offSuffix')}</p>}
                  </div>
                </div>

                {/* Payment mode */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('sales.paymentMode')}
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { v: 'cash' as const, labelKey: 'sales.cash', Icon: Banknote },
                      { v: 'upi' as const, labelKey: 'sales.upi', Icon: Smartphone },
                      { v: 'credit' as const, labelKey: 'sales.credit', Icon: CreditCard },
                    ]).map(({ v, labelKey, Icon }) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setPaymentMode(v);
                          setPaidAmount(v !== 'credit' ? finalAmount.toFixed(0) : '0');
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                          paymentMode === v
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount received */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {paymentMode === 'credit' ? t('sales.advancePaid') : t('sales.amountReceived')}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)}
                      className="pl-7 text-base font-bold"
                      min={0} max={finalAmount}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: t('sales.payFull'),     val: finalAmount },
                      { label: t('sales.payZero'),       val: 0 },
                      ...[500, 1000, 2000].map(v => ({ label: formatINR(v), val: v })),
                    ].filter(({ val }) => val <= finalAmount).map(({ label, val }) => (
                      <button
                        key={label}
                        onClick={() => setPaidAmount(Math.min(val, finalAmount).toFixed(0))}
                        className="rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Udhaar section */}
                {balanceDue > 0 && (
                  <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {paymentMode === 'credit' ? t('sales.udhaarCreditSale') : t('sales.balanceDuePartial')}
                      </p>
                      <p className="text-lg font-bold text-warning tabular-nums">{formatINR(balanceDue)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('udhaar.dueDate')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        className="h-8 text-sm"
                        min={format(new Date(), 'yyyy-MM-dd')}
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('sales.creditNoteLabel')}
                        <span className="ml-1 font-normal normal-case text-muted-foreground/60">{t('sales.followUpOptional')}</span>
                      </Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder={t('sales.creditNotePlaceholder')}
                        value={creditNote}
                        onChange={e => setCreditNote(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
                  <div className="flex justify-between px-4 py-2.5 text-xs text-muted-foreground">
                    <span>{t('sales.subtotal')}</span><span>{formatINR(subtotal)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between px-4 py-2.5 text-xs text-primary">
                      <span>{t('sales.discountLabel')}</span><span>−{formatINR(discountAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-2.5 text-xs text-muted-foreground">
                    <span>{t('sales.paidNow')}</span><span className="font-medium text-foreground">{formatINR(paidNum)}</span>
                  </div>
                  {balanceDue > 0 && (
                    <div className="flex justify-between px-4 py-2.5 text-xs font-semibold text-warning">
                      <span>{paymentMode === 'credit' ? t('sales.udhaarBalance') : t('sales.outstanding')}</span><span>{formatINR(balanceDue)}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Observation-only summary */
              <div className="overflow-hidden rounded-lg border border-border bg-card divide-y divide-border">
                <SummaryRow label={t('sales.summaryFarmer')} value={`${farmer?.fullName} · ${farmer?.village}`} />
                <SummaryRow label={t('sales.summaryCropStage')} value={CROP_STAGES.find(s => s.value === cropStage)?.label ?? ''} />
                {(issues.length > 0 || customIssue.trim()) && (
                  <SummaryRow
                    label={t('sales.summaryIssues')}
                    value={[...issues.map(i => t(i)), customIssue.trim()].filter(Boolean).join(', ')}
                  />
                )}
                {notes && <SummaryRow label={t('sales.notes')} value={notes} />}
                {followUpDate && (
                  <SummaryRow
                    label={t('sales.summaryFollowUp')}
                    value={new Date(followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  />
                )}
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">{t('sales.observationOnlyNote')}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> {t('sales.back')}
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={isSubmitting || isAddingSale || (balanceDue > 0 && !dueDate)}
                onClick={handleSubmit}
              >
                {isSubmitting || isAddingSale ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {t('sales.saving')}
                  </span>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    {cart.length > 0 ? t('sales.saveVisitAndBill') : t('sales.saveVisit')}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FarmerRow({
  farmer, selected, onClick,
}: {
  farmer: { id: string; fullName: string; mobile: string; village: string };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-0 transition-colors hover:bg-muted/30',
        selected && 'bg-primary/5'
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {farmer.fullName[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{farmer.fullName}</p>
        <p className="text-xs text-muted-foreground">
          {farmer.mobile}
          <span className="mx-1.5 text-border">·</span>
          {farmer.village}
        </p>
      </div>
      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={3} />}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-4 py-2.5">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
