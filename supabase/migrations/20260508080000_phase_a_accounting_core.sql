/**
 * PrithviX Phase A — Accounting core (must run before Phase B purchases).
 *
 * Remote DBs created from the mobile / dealer app typically have `dealers`, `farmers`,
 * `sales`, `product_*`, inventory tables — but not Tally-style ledgers/vouchers.
 * Phase B references `public.ledgers` and `public.vouchers`; create them here.
 */

-- ── ledger_groups ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ledger_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  group_code       TEXT NOT NULL,
  group_name       TEXT NOT NULL,
  parent_group_id  UUID REFERENCES public.ledger_groups(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (dealer_id, group_code)
);

CREATE INDEX IF NOT EXISTS idx_ledger_groups_dealer ON public.ledger_groups(dealer_id);

-- ── ledgers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ledgers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id         UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  ledger_group_id   UUID REFERENCES public.ledger_groups(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  ledger_code       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledgers_dealer_code
  ON public.ledgers(dealer_id, ledger_code)
  WHERE ledger_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledgers_dealer ON public.ledgers(dealer_id);

-- ── vouchers ─────────────────────────────────────────────────────────────────
-- dealer_id is TEXT: business slug (`dealers.dealer_id`) or UUID string — matches Phase D/E helpers.
CREATE TABLE IF NOT EXISTS public.vouchers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        TEXT NOT NULL,
  voucher_type     TEXT NOT NULL,
  voucher_number   TEXT NOT NULL,
  voucher_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  narration        TEXT,
  total_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'DRAFT',
  reference        TEXT,
  meta             JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_dealer_date ON public.vouchers(dealer_id, voucher_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);

-- ── voucher_entries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voucher_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id       UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  ledger_id        UUID NOT NULL REFERENCES public.ledgers(id) ON DELETE RESTRICT,
  dr_cr            TEXT NOT NULL CHECK (dr_cr IN ('DR', 'CR')),
  amount           NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voucher_entries_voucher ON public.voucher_entries(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_entries_ledger ON public.voucher_entries(ledger_id);

-- ── financial_years (Tally status bar + FY-aware numbering) ───────────────────
CREATE TABLE IF NOT EXISTS public.financial_years (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  label            TEXT,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  fy_start         DATE,
  is_current       BOOLEAN DEFAULT FALSE,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT financial_years_dates_chk CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_financial_years_dealer ON public.financial_years(dealer_id);

COMMENT ON COLUMN public.financial_years.fy_start IS 'Optional alias for UI sorting; falls back to start_date in app.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.ledger_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledger_groups_dealer_access" ON public.ledger_groups;
CREATE POLICY "ledger_groups_dealer_access" ON public.ledger_groups
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

ALTER TABLE public.ledgers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledgers_dealer_access" ON public.ledgers;
CREATE POLICY "ledgers_dealer_access" ON public.ledgers
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vouchers_dealer_access" ON public.vouchers;
CREATE POLICY "vouchers_dealer_access" ON public.vouchers
  FOR ALL USING (
    dealer_id IN (SELECT dealer_id::TEXT FROM public.dealers WHERE user_id = auth.uid())
    OR dealer_id IN (SELECT id::TEXT FROM public.dealers WHERE user_id = auth.uid())
  );

ALTER TABLE public.voucher_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "voucher_entries_dealer_access" ON public.voucher_entries;
CREATE POLICY "voucher_entries_dealer_access" ON public.voucher_entries
  FOR ALL USING (
    voucher_id IN (
      SELECT v.id FROM public.vouchers v
      WHERE v.dealer_id IN (SELECT dealer_id::TEXT FROM public.dealers WHERE user_id = auth.uid())
         OR v.dealer_id IN (SELECT id::TEXT FROM public.dealers WHERE user_id = auth.uid())
    )
  );

ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_years_dealer_access" ON public.financial_years;
CREATE POLICY "financial_years_dealer_access" ON public.financial_years
  FOR ALL USING (
    dealer_id IS NULL
    OR dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );
