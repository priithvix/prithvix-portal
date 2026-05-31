export type UserRole = 'dealer' | 'staff';

export type CropCycle = 'kharif' | 'rabi' | 'summer';

export type CropStage = 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'harvest';

export type PaymentMode = 'cash' | 'upi' | 'credit';

export type DiscountType = 'percentage' | 'flat';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold';

export interface Dealer {
  id: string;
  phone: string;
  username: string;
  /** Never stored in app state; resolved server-side via staff_login RPC */
  password?: string;
  shopName: string;
  ownerName: string;
  district: string;
  taluka: string;
  village: string;
  createdAt: string;
  /** Payee VPA for UPI QR; persisted on Supabase dealers.upi_id in AuthContext dealer row */
  upiId?: string;
}

export interface Staff {
  id: string;
  dealerId: string;
  name: string;
  phone: string;
  username: string;
  /** Never stored in app state; resolved server-side via staff_login RPC */
  password?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Farmer {
  id: string;
  dealerId: string;
  createdBy: string;
  createdByRole: UserRole;
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
  consentGiven: boolean;
  createdAt: string;
  /** Optional dealer-set credit limit in ₹ */
  creditLimit?: number;
}

export interface AuthSession {
  userId: string;
  /** Public / business dealer id (e.g. DLR_… slug). Use for QR, display, legacy paths. */
  dealerId: string;
  /** `dealers.id` — UUID foreign key for `farmers.dealer_id`, `sales.dealer_id`, etc. */
  dealerRowId: string;
  role: UserRole;
  displayName: string;
  shopName: string;
}

export interface ActivityLog {
  id: string;
  dealerId: string;
  userId: string;
  action: string;
  details: string;
  timestamp: string;
}

export type ItemCategory = 'fertilizer' | 'pesticide' | 'insecticide' | 'seeds' | 'others';
export type ItemUnit = 'kg' | 'litre' | 'packet' | 'bag';

export type InventoryBaseUnit = 'kg' | 'litre';

export interface DealerCostComponentConfig {
  enabled: boolean;
  value_per_unit: number;
}

export interface DealerCustomCostComponent extends DealerCostComponentConfig {
  key: string;
  label: string;
}

export interface DealerCostFormulaConfig {
  version: number;
  mode: 'full_custom_builder' | 'component_toggle' | 'simple_addons';
  components: {
    labour: DealerCostComponentConfig;
    transport: DealerCostComponentConfig;
    other: DealerCostComponentConfig;
    custom: DealerCustomCostComponent[];
  };
}

export type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'damage'
  | 'return'
  | 'manual_adjustment';

export interface ProductMaster {
  id: string;
  dealerId: string;
  productName: string;
  category: ItemCategory;
  gstPercent: number;
  baseUnit: InventoryBaseUnit;
  imageUrl?: string;
  isActive: boolean;
  /** When true, sale line qty counts toward labour/wage (e.g. bags). */
  isLabourEligible?: boolean;
  /** Display hint only, e.g. bag | packet */
  labourUnit?: string;
  createdAt: string;
  updatedAt: string;
  // ── Invoice enrichment fields ──
  companyName?: string;
  hsnCode?: string;
  technicalName?: string;    // pesticide: e.g. "Acephate 75% SP"
  formulation?: string;      // pesticide: SP / WP / EC / SL / SC / WG / Other
  cibRegNumber?: string;     // pesticide: CIB registration number
  cropName?: string;         // seed: e.g. "Wheat"
  variety?: string;          // seed: e.g. "HD-2967"
  seedClass?: string;        // seed: Foundation / Certified / Truthfully Labelled
}

export interface ProductSku {
  id: string;
  dealerId: string;
  productId: string;
  displayLabel: string;
  unitType: ItemUnit;
  unitsPerBase: number;
  sellingPriceExGst?: number;
  extraCostPerUnit?: number;
  lastInvoicePricePerBase?: number;
  lastInvoicePricePerInvoiceUnit?: number;
  leadTimeDays: number;
  legacyProductId?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Shelf view: one row per SKU (id = sku id) */
export interface InventoryItem {
  id: string;
  dealerId: string;
  productId: string;
  productName: string;
  displayLabel: string;
  /** productName · displayLabel */
  name: string;
  category: ItemCategory;
  unit: ItemUnit;
  unitsPerBase: number;
  baseUnit: InventoryBaseUnit;
  /** Quantity in base units (kg or litre) */
  stock: number;
  /** Avg daily sales in base units (last window) */
  avgDailySalesBase?: number;
  safetyStockBase: number;
  /** Manual safety override in base units, if set */
  manualSafetyStockBase?: number;
  /** Mirrors safetyStockBase for legacy comparisons */
  reorderLevel: number;
  /** Selling price per SKU unit, excluding GST */
  sellingPrice?: number;
  /** Effective cost per base unit (invoice + extra spread over base) */
  costPrice?: number;
  /** Product image URL from Supabase Storage */
  imageUrl?: string;
  /** Effective cost per SKU/invoice unit (invoice price per unit + extra cost per unit) */
  effectiveCostPerUnit?: number;
  /** Avg realised selling price ex-GST per SKU unit (from recent sales window) */
  realizedPriceExGst?: number;
  lastInvoicePricePerBase?: number;
  lastInvoicePricePerInvoiceUnit?: number;
  /** Effective extra cost currently applied on this SKU (override or global default) */
  extraCostPerUnit?: number;
  /** Explicit per-SKU extra cost saved in DB (raw value) */
  skuExtraCostPerUnit?: number;
  /** True when SKU is using manual extra-cost override instead of global default */
  extraCostManualOverride?: boolean;
  metadata?: Record<string, unknown>;
  gstPercent?: number;
  leadTimeDays?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stockStatus?: 'healthy' | 'low' | 'reorder';
  // ── Invoice enrichment fields (from product_master + product_skus) ──
  companyName?: string;
  hsnCode?: string;
  technicalName?: string;        // pesticide
  formulation?: string;          // pesticide: SP/WP/EC/SL/SC/WG/Other
  cibRegNumber?: string;         // pesticide: CIB registration number
  mrp?: number;                  // maximum retail price (SKU level)
  batchNumber?: string;          // SKU batch number
  manufacturingDate?: string;    // MM/YYYY
  expiryDate?: string;           // MM/YYYY (red warning if expired)
  lotNumber?: string;            // seed: lot/source number
  germinationPercent?: number;   // seed: 0–100
  germinationValidUpto?: string; // seed: MM/YYYY germination validity
  cropName?: string;             // seed: e.g. "Wheat"
  variety?: string;              // seed: e.g. "HD-2967"
  seedClass?: string;            // seed: Foundation / Certified / Truthfully Labelled
}

export interface VisitItem {
  itemId: string;
  productId?: string;
  itemName: string;
  quantity: number;
  unit: ItemUnit;
  /** Base units per one sold unit; default 1 for legacy rows */
  unitsPerBase?: number;
}

export interface SaleItem {
  itemId: string;
  productId?: string;
  itemName: string;
  quantity: number;
  unit: ItemUnit;
  unitsPerBase: number;
  /** Selling price per unit excluding GST */
  priceExGst: number;
  gstPercent: number;
  gstAmountPerUnit: number;
  priceIncGstPerUnit: number;
  /** Same as priceIncGstPerUnit — preserved for bills/UI */
  pricePerUnit: number;
  lineTotalExGst: number;
  lineGstAmount: number;
  lineTotalIncGst: number;
  /** Same as lineTotalIncGst */
  totalAmount: number;
  /** Effective cost per sold unit (invoice + overhead), for margin */
  costPrice: number;
}

export interface Sale {
  id: string;
  dealerId: string;
  farmerId: string;
  visitId: string;
  items: SaleItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  finalAmount: number;
  paymentMode: PaymentMode;
  paidAmount: number;
  balanceDue: number;
  /** Udhaar put on book at bill time (immutable after insert). */
  initialBalanceDue: number;
  dueDate?: string;
  creditNote?: string;
  proofImageUri?: string;
  status: 'paid' | 'partial' | 'pending';
  costTotal: number;
  profitAfterDiscount: number;
  createdAt: string;
}

export interface CreditPayment {
  id: string;
  dealerId: string;
  farmerId: string;
  saleId: string;
  amount: number;
  paymentMode: 'cash' | 'upi';
  notes?: string;
  createdAt: string;
}

export interface FarmerMetrics {
  farmerId: string;
  totalVisits: number;
  lifetimePurchase: number;
  loyaltyTier: LoyaltyTier;
  outstandingCredit: number;
}

export interface Visit {
  id: string;
  farmerId: string;
  dealerId: string;
  cropStage: CropStage;
  issues: string[];
  customIssue?: string;
  notes: string;
  recommendedProduct?: string;
  followUpDate?: string;
  photoUri?: string;
  loggedBy: string;
  loggedByRole: UserRole;
  createdAt: string;
  items?: VisitItem[];
  saleId?: string;
}

export interface DailyStats {
  date: string;
  registrations: number;
  visits: number;
}
