/**
 * Application Metadata & Constants
 * Centralized configuration for app-wide settings
 */

export const APP_CONFIG = {
  name: 'PrithviX Partner',
  shortName: 'PrithviX',
  description: 'Modern web portal for agricultural dealers - Farmer management, sales tracking, and business intelligence',
  version: '1.0.0',
  author: 'PrithviX Team',
  website: 'https://prithvix.com',
  supportEmail: 'support@prithvix.com',
  repository: 'https://github.com/prithvix/partner-web',
} as const;

export const ROUTES = {
  // Public routes
  home: '/',
  login: '/login',
  register: '/register-dealer',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',

  // App routes
  dashboard: '/home',
  farmers: '/farmers',
  farmerDetail: (id: string) => `/farmers/${id}`,
  farmerEdit: (id: string) => `/farmers/${id}/edit`,
  registerFarmer: '/register-farmer',
  scan: '/scan',
  udhaar: '/udhaar',
  inventory: '/inventory',
  invoice: '/invoice',
  dailyClose: '/daily-close',
  analytics: '/analytics',
  compliance: '/compliance',
  salesMap: '/sales-map',
  aiAgronomist: '/ai-agronomist',
  staffManagement: '/staff-management',
  profile: '/profile',
  settings: '/settings',
} as const;

export const API_ENDPOINTS = {
  supabase: {
    dealers: 'dealers',
    staff: 'staff',
    farmers: 'farmers',
    visits: 'visits',
    qrScanLogs: 'qr_scan_logs',
    sales: 'sales',
    creditPayments: 'credit_payments',
    productMaster: 'product_master',
    productSkus: 'product_skus',
    skuStockBalances: 'sku_stock_balances',
  },
  rpc: {
    staffLogin: 'staff_login',
  },
} as const;

export const STORAGE_KEYS = {
  staffSession: 'prithvix_staff_session',
  theme: 'prithvix_theme',
  lastSync: 'prithvix_last_sync',
} as const;

export const PAGINATION = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
  maxPageSize: 100,
} as const;

export const LIMITS = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxImageSize: 2 * 1024 * 1024, // 2MB
  allowedImageFormats: ['image/jpeg', 'image/png', 'image/webp'],
  allowedDocFormats: ['application/pdf'],
  farmerNameMaxLength: 100,
  mobileLength: 10,
  pincodeLength: 6,
  gstinLength: 15,
} as const;

export const BUSINESS_RULES = {
  lowStockThreshold: 0.25, // 25% of safety stock
  reorderThreshold: 0.1, // 10% of safety stock
  loyaltyTiers: {
    bronze: { min: 0, max: 50000 },
    silver: { min: 50000, max: 200000 },
    gold: { min: 200000, max: Infinity },
  },
  creditLimits: {
    bronze: 10000,
    silver: 25000,
    gold: 50000,
  },
  gstRates: [0, 5, 12, 18, 28],
  paymentModes: ['cash', 'upi', 'credit'] as const,
  cropCycles: ['kharif', 'rabi', 'summer', 'perennial'] as const,
  cropStages: [
    'land_prep',
    'sowing',
    'germination',
    'vegetative',
    'flowering',
    'fruiting',
    'harvest',
    'post_harvest',
  ] as const,
  visitPurposes: [
    'sales',
    'service',
    'collection',
    'survey',
    'complaint',
    'follow_up',
    'training',
  ] as const,
} as const;

export const VALIDATION = {
  mobile: {
    pattern: /^[6-9]\d{9}$/,
    message: 'Mobile number must be 10 digits starting with 6-9',
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Invalid email address',
  },
  pincode: {
    pattern: /^\d{6}$/,
    message: 'PIN code must be 6 digits',
  },
  gstin: {
    pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    message: 'Invalid GSTIN format',
  },
  pan: {
    pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    message: 'Invalid PAN format',
  },
  aadhaar: {
    pattern: /^\d{12}$/,
    message: 'Aadhaar must be 12 digits',
  },
} as const;

export const DATE_FORMATS = {
  display: 'dd MMM yyyy',
  displayWithTime: 'dd MMM yyyy, hh:mm a',
  input: 'yyyy-MM-dd',
  iso: 'yyyy-MM-dd\'T\'HH:mm:ss.SSSxxx',
  invoice: 'dd/MM/yyyy',
  shortDate: 'dd/MM/yy',
} as const;

export const CURRENCY = {
  code: 'INR',
  symbol: '₹',
  locale: 'en-IN',
  decimals: 2,
} as const;

export const MAP_CONFIG = {
  defaultCenter: { lat: 20.5937, lng: 78.9629 }, // India center
  defaultZoom: 10,
  markerColors: {
    active: '#0F7A3E',
    inactive: '#94a3b8',
    warning: '#f59e0b',
  },
} as const;

export const TOAST_CONFIG = {
  duration: 3000,
  position: 'bottom-right' as const,
  successDuration: 2000,
  errorDuration: 5000,
} as const;

export const QUERY_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: 1,
} as const;

export const FEATURE_FLAGS = {
  enableAIAgronomist: true,
  enableSalesMap: true,
  enableAdvancedAnalytics: true,
  enableExportData: true,
  enableDarkMode: true,
  enablePushNotifications: false, // Future feature
  enableOfflineMode: false, // Future feature
} as const;

export const EXTERNAL_LINKS = {
  documentation: 'https://docs.prithvix.com',
  support: 'https://support.prithvix.com',
  privacy: 'https://prithvix.com/privacy',
  terms: 'https://prithvix.com/terms',
  github: 'https://github.com/prithvix',
} as const;

export const ERROR_MESSAGES = {
  generic: 'Something went wrong. Please try again.',
  network: 'Network error. Please check your internet connection.',
  unauthorized: 'You are not authorized to perform this action.',
  notFound: 'The requested resource was not found.',
  validation: 'Please check your input and try again.',
  server: 'Server error. Please contact support if the problem persists.',
  session: 'Your session has expired. Please log in again.',
} as const;

export const SUCCESS_MESSAGES = {
  farmerRegistered: 'Farmer registered successfully',
  farmerUpdated: 'Farmer details updated successfully',
  saleRecorded: 'Sale recorded successfully',
  paymentRecorded: 'Payment recorded successfully',
  staffAdded: 'Staff member added successfully',
  staffUpdated: 'Staff member updated successfully',
  profileUpdated: 'Profile updated successfully',
  dataCopied: 'Data copied to clipboard',
  dataExported: 'Data exported successfully',
} as const;
