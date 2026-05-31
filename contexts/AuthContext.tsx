'use client';

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DealerCostFormulaConfig, Staff } from '@/constants/types';
import { supabase } from '@/lib/supabase/client';
import { ensureDefaultBeSaleLedgersRpc } from '@/lib/supabase/be-tally-sync';
import { clearWorkspaceMode } from '@/lib/workspace';

// -----------------------------------------------------------------------------
// Dealer interface (matches mobile exactly)
// -----------------------------------------------------------------------------

export interface Dealer {
  id: string;
  user_id: string;
  dealer_id: string;
  company_name: string;
  owner_name: string;
  mobile: string;
  email: string;
  status: string;
  subscription_plan: string;
  district?: string;
  state?: string;
  state_code?: string;
  village?: string;
  taluka?: string;
  address?: string;
  pin_code?: string;
  preferred_language?: string;
  created_at?: string;
  allow_negative_stock?: boolean;
  cost_formula_config?: DealerCostFormulaConfig;
  /** Payee VPA for shop UPI QR (e.g. name@paytm) */
  upi_id?: string;
  /** GSTIN for GST invoices */
  gstin?: string;
  /** Shop logo URL (Supabase Storage dealer-logos bucket) */
  shop_logo_url?: string;
  /** Dealer profile avatar URL (dealer-logos bucket: id/profile.ext) */
  profile_photo_url?: string;
  /** License numbers for invoice compliance */
  fertilizer_license_number?: string;
  pesticide_license_number?: string;
  seed_license_number?: string;
  /** License validity (optional; used in BI PDF + reminders) */
  fertilizer_license_valid_until?: string;
  pesticide_license_valid_until?: string;
  seed_license_valid_until?: string;
  /** Invoice UI defaults (JSONB on dealers) */
  invoice_settings?: Record<string, unknown>;
  /** Business profile (optional columns) */
  shop_type?: string;
  whatsapp_number?: string;
  alternate_mobile?: string;
  bank_name?: string;
  bank_branch?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_account_type?: string;
  is_composition_dealer?: boolean;
  insecticide_license_number?: string;
  insecticide_license_valid_until?: string;
  fertilizer_reminder_enabled?: boolean;
  pesticide_reminder_enabled?: boolean;
  seed_reminder_enabled?: boolean;
  /** Optional; many DBs only store fert/pest/seed reminder flags */
  insecticide_reminder_enabled?: boolean;
  fertilizer_license_doc_url?: string;
  pesticide_license_doc_url?: string;
  seed_license_doc_url?: string;
  insecticide_license_doc_url?: string;
  open_time?: string;
  close_time?: string;
  weekly_off?: string[];
  service_area?: string;
  delivery_available?: boolean;
}

function normalizeDealerCostFormula(raw: unknown): DealerCostFormulaConfig {
  const config = (raw && typeof raw === 'object' ? raw : {}) as Partial<DealerCostFormulaConfig>;
  return {
    version: Number(config.version) || 1,
    mode: config.mode || 'component_toggle',
    components: {
      labour: { enabled: false, value_per_unit: 0, ...config.components?.labour },
      transport: { enabled: false, value_per_unit: 0, ...config.components?.transport },
      other: { enabled: false, value_per_unit: 0, ...config.components?.other },
      custom: Array.isArray(config.components?.custom) ? config.components.custom : [],
    },
  };
}

function mapRowToDealer(row: Record<string, unknown>): Dealer {
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    dealer_id: String(row.dealer_id ?? ''),
    company_name: String(row.company_name ?? ''),
    owner_name: String(row.owner_name ?? ''),
    mobile: String(row.mobile ?? ''),
    email: String(row.email ?? ''),
    status: String(row.status ?? 'pending'),
    subscription_plan: String(row.subscription_plan ?? 'basic'),
    district: row.district ? String(row.district) : undefined,
    state: row.state ? String(row.state) : undefined,
    village: row.village ? String(row.village) : undefined,
    taluka: row.taluka ? String(row.taluka) : undefined,
    preferred_language: row.preferred_language ? String(row.preferred_language) : 'en',
    created_at: row.created_at ? String(row.created_at) : undefined,
    allow_negative_stock: row.allow_negative_stock === true,
    cost_formula_config: normalizeDealerCostFormula(row.cost_formula_config),
    upi_id: row.upi_id != null && String(row.upi_id).trim() !== '' ? String(row.upi_id).trim() : undefined,
    gstin: row.gstin ? String(row.gstin) : undefined,
    shop_logo_url: row.shop_logo_url ? String(row.shop_logo_url) : undefined,
    profile_photo_url: row.profile_photo_url ? String(row.profile_photo_url) : undefined,
    address: row.address ? String(row.address) : undefined,
    pin_code: row.pin_code ? String(row.pin_code) : undefined,
    state_code: row.state_code ? String(row.state_code) : undefined,
    // DB columns use _no suffix; interface uses _number for readability
    fertilizer_license_number: row.fertilizer_license_no ? String(row.fertilizer_license_no) : undefined,
    pesticide_license_number: row.pesticide_license_no ? String(row.pesticide_license_no) : undefined,
    seed_license_number: row.seed_license_no ? String(row.seed_license_no) : undefined,
    fertilizer_license_valid_until: row.fertilizer_license_valid_until
      ? String(row.fertilizer_license_valid_until).slice(0, 10)
      : undefined,
    pesticide_license_valid_until: row.pesticide_license_valid_until
      ? String(row.pesticide_license_valid_until).slice(0, 10)
      : undefined,
    seed_license_valid_until: row.seed_license_valid_until
      ? String(row.seed_license_valid_until).slice(0, 10)
      : undefined,
    invoice_settings:
      row.invoice_settings && typeof row.invoice_settings === 'object'
        ? (row.invoice_settings as Record<string, unknown>)
        : undefined,
    shop_type: row.shop_type != null ? String(row.shop_type) : undefined,
    whatsapp_number:
      row.whatsapp_number != null
        ? String(row.whatsapp_number)
        : row.whatsapp != null
          ? String(row.whatsapp)
          : undefined,
    alternate_mobile:
      row.alternate_mobile != null ? String(row.alternate_mobile) : undefined,
    bank_name: row.bank_name != null ? String(row.bank_name) : undefined,
    bank_branch: row.bank_branch != null ? String(row.bank_branch) : undefined,
    bank_account_number:
      row.bank_account_number != null ? String(row.bank_account_number) : undefined,
    bank_ifsc: row.bank_ifsc != null ? String(row.bank_ifsc) : undefined,
    bank_account_type:
      row.bank_account_type != null ? String(row.bank_account_type) : undefined,
    is_composition_dealer: row.is_composition_dealer === true,
    insecticide_license_number:
      row.insecticide_license_no != null
        ? String(row.insecticide_license_no)
        : row.insecticide_license_number != null
          ? String(row.insecticide_license_number)
          : undefined,
    insecticide_license_valid_until: row.insecticide_license_valid_until
      ? String(row.insecticide_license_valid_until).slice(0, 10)
      : undefined,
    fertilizer_reminder_enabled: row.fertilizer_reminder_enabled === true,
    pesticide_reminder_enabled: row.pesticide_reminder_enabled === true,
    seed_reminder_enabled: row.seed_reminder_enabled === true,
    insecticide_reminder_enabled: row.insecticide_reminder_enabled === true,
    fertilizer_license_doc_url:
      row.fertilizer_license_doc_url != null
        ? String(row.fertilizer_license_doc_url)
        : undefined,
    pesticide_license_doc_url:
      row.pesticide_license_doc_url != null
        ? String(row.pesticide_license_doc_url)
        : undefined,
    seed_license_doc_url:
      row.seed_license_doc_url != null ? String(row.seed_license_doc_url) : undefined,
    insecticide_license_doc_url:
      row.insecticide_license_doc_url != null
        ? String(row.insecticide_license_doc_url)
        : undefined,
    open_time: row.open_time != null ? String(row.open_time) : undefined,
    close_time: row.close_time != null ? String(row.close_time) : undefined,
    weekly_off: Array.isArray(row.weekly_off)
      ? (row.weekly_off as unknown[]).map(String)
      : undefined,
    service_area: row.service_area != null ? String(row.service_area) : undefined,
    delivery_available: row.delivery_available === true,
  };
}

function mapRowToStaff(row: Record<string, unknown>): Staff {
  return {
    id: String(row.id ?? ''),
    dealerId: String(row.dealer_id ?? ''),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    username: String(row.username ?? ''),
    isActive: row.is_active !== false,
    createdAt: String(row.created_at ?? ''),
  };
}

const STAFF_SESSION_KEY = 'staff_session';

function getAccountStartDate(createdAtStr: string | null): Date | null {
  if (!createdAtStr) return null;
  try {
    return new Date(createdAtStr);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Auth context
// -----------------------------------------------------------------------------

interface AuthContextValue {
  dealer: Dealer | null;
  loading: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  staffLogin: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  session: {
    userId: string;
    dealerId: string;
    dealerRowId: string;
    role: 'dealer' | 'staff';
    displayName: string;
    shopName: string;
  } | null;
  isDealer: boolean;
  accountStartDate: Date | null;
  accountStartDateLabel: string | null;
  staff: Staff[];
  addStaff: (params: { name: string; phone: string; username: string; password: string }) => Promise<void>;
  toggleStaff: (staffId: string) => Promise<void>;
  deleteStaff: (staffId: string) => Promise<void>;
  isAddingStaff: boolean;
  refreshDealer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [staffMember, setStaffMember] = useState<Staff | null>(null);
  const fetchingRef = useRef(false);
  const staffMemberRef = useRef<Staff | null>(null);

  const fetchDealerProfile = useCallback(async (userId: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data: row, error } = await supabase
        .from('dealers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !row) {
        console.error('[Auth] Dealer profile not found for user_id:', userId, error?.message);
        setDealer(null);
      } else {
        setDealer(mapRowToDealer(row as Record<string, unknown>));
      }
    } catch (e) {
      console.error('[Auth] fetchDealerProfile error:', e);
      setDealer(null);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setIsReady(true);
    }
  }, []);

  const fetchDealerById = useCallback(async (dealerId: string): Promise<Dealer | null> => {
    const { data: row, error } = await supabase
      .from('dealers')
      .select('*')
      .eq('dealer_id', dealerId)
      .maybeSingle();
    if (error || !row) return null;
    return mapRowToDealer(row as Record<string, unknown>);
  }, []);

  useEffect(() => {
    const init = async () => {
      // Check for persisted staff session first (localStorage)
      try {
        const stored = localStorage.getItem(STAFF_SESSION_KEY);
        if (stored) {
          const parsed: Staff = JSON.parse(stored);
          const dealerRow = await fetchDealerById(parsed.dealerId);
          if (dealerRow) {
            staffMemberRef.current = parsed;
            setStaffMember(parsed);
            setDealer(dealerRow);
            setLoading(false);
            setIsReady(true);
            return;
          } else {
            localStorage.removeItem(STAFF_SESSION_KEY);
          }
        }
      } catch {
        // Ignore storage errors
      }

      // Fall back to Supabase dealer session
      supabase.auth
        .getSession()
        .then((result) => {
          const sessionErr = result.error;
          const session = result.data.session;
          if (sessionErr) {
            setDealer(null);
            setLoading(false);
            setIsReady(true);
            return;
          }
          if (session?.user) {
            fetchDealerProfile(session.user.id);
          } else {
            setDealer(null);
            setLoading(false);
            setIsReady(true);
          }
        })
        .catch((e) => {
          console.warn('[Auth] getSession failed (network or Supabase unreachable):', e);
          setDealer(null);
          setLoading(false);
          setIsReady(true);
        });
    };

    init();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (staffMemberRef.current) return;
      if (session?.user) {
        fetchDealerProfile(session.user.id);
      } else {
        setDealer(null);
        setLoading(false);
        setIsReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchDealerProfile, fetchDealerById]);

  useEffect(() => {
    if (dealer?.id) {
      void ensureDefaultBeSaleLedgersRpc(dealer.id);
    }
  }, [dealer?.id]);

  const loadStaff = useCallback(async (dealerId: string) => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        setStaff(data.map((row) => mapRowToStaff(row as Record<string, unknown>)));
      } else {
        setStaff([]);
      }
    } catch {
      setStaff([]);
    }
  }, []);

  useEffect(() => {
    if (dealer?.dealer_id && !staffMember) {
      loadStaff(dealer.dealer_id);
    } else {
      setStaff([]);
    }
  }, [dealer?.dealer_id, staffMember, loadStaff]);

  const addStaff = useCallback(
    async (params: { name: string; phone: string; username: string; password: string }) => {
      if (!dealer?.dealer_id) throw new Error('Not logged in');
      setIsAddingStaff(true);
      try {
        const { data: existing } = await supabase
          .from('staff')
          .select('id')
          .eq('username', params.username.trim())
          .maybeSingle();
        if (existing) throw new Error('Username already taken. Please choose a different one.');

        const { data, error } = await supabase
          .from('staff')
          .insert({
            dealer_id: dealer.dealer_id,
            name: params.name.trim(),
            phone: params.phone.trim(),
            username: params.username.trim(),
            password: params.password,
            is_active: true,
          })
          .select('*')
          .single();
        if (error) throw error;
        if (data) {
          const row = mapRowToStaff(data as Record<string, unknown>);
          setStaff((prev) => [row, ...prev]);
        }
      } finally {
        setIsAddingStaff(false);
      }
    },
    [dealer?.dealer_id]
  );

  const deleteStaff = useCallback(async (staffId: string) => {
    const { error } = await supabase.from('staff').delete().eq('id', staffId);
    if (error) throw error;
    setStaff((prev) => prev.filter((s) => s.id !== staffId));
  }, []);

  const toggleStaff = useCallback(async (staffId: string) => {
    const current = staff.find((s) => s.id === staffId);
    if (!current || !dealer?.dealer_id) return;
    const nextActive = !current.isActive;
    const { error } = await supabase
      .from('staff')
      .update({ is_active: nextActive })
      .eq('id', staffId);
    if (error) throw error;
    setStaff((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, isActive: nextActive } : s))
    );
  }, [staff, dealer?.dealer_id]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        throw error;
      }
      // onAuthStateChange will fire and call fetchDealerProfile
    },
    []
  );

  const staffLogin = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('staff_login', {
        p_username: username.trim(),
        p_password: password,
      });

      if (error) throw new Error(error.message);

      const result = data as { error?: string; staff?: Record<string, unknown>; dealer?: Record<string, unknown> };
      if (result.error) throw new Error(result.error);

      const staffRow = mapRowToStaff(result.staff!);
      const dealerRow = mapRowToDealer(result.dealer!);

      // Persist session to localStorage
      localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(staffRow));
      staffMemberRef.current = staffRow;
      setStaffMember(staffRow);
      setDealer(dealerRow);
    } finally {
      setLoading(false);
      setIsReady(true);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await clearWorkspaceMode();
    } catch {
      /* non-blocking */
    }
    if (staffMemberRef.current) {
      localStorage.removeItem(STAFF_SESSION_KEY);
      staffMemberRef.current = null;
      setStaffMember(null);
    } else {
      await supabase.auth.signOut();
    }
    setDealer(null);
    setStaff([]);
    setLoading(false);
    router.push('/login');
  }, [router]);

  const session = dealer
    ? staffMember
      ? {
          userId: staffMember.id,
          dealerId: dealer.dealer_id,
          dealerRowId: dealer.id,
          role: 'staff' as const,
          displayName: staffMember.name,
          shopName: dealer.company_name,
        }
      : {
          userId: dealer.id,
          dealerId: dealer.dealer_id,
          dealerRowId: dealer.id,
          role: 'dealer' as const,
          displayName: dealer.owner_name,
          shopName: dealer.company_name,
        }
    : null;

  const accountStartDate = getAccountStartDate(dealer?.created_at ?? null);

  const value: AuthContextValue = {
    dealer,
    loading,
    isReady,
    isAuthenticated: !!dealer,
    login,
    staffLogin,
    logout,
    session,
    isDealer: !!dealer && !staffMember,
    accountStartDate,
    accountStartDateLabel: accountStartDate ? accountStartDate.toLocaleDateString('en-IN') : null,
    staff,
    addStaff,
    toggleStaff,
    deleteStaff,
    isAddingStaff,
    refreshDealer: () => dealer?.user_id ? fetchDealerProfile(dealer.user_id) : Promise.resolve(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
