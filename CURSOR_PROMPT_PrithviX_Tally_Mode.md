# Cursor Prompt — PrithviX: Workspace Picker + Tally Mode (Tally Prime replica)

> **Pre-reqs:** Phase A (Accounting Foundation) is built and shipping. The voucher tables, posting engine, auto-ledger triggers, and Trial Balance are all working. This prompt adds a **second UI shell** — Tally Mode — that sits on the same backend.
>
> **Mode:** Cursor Agent, Sonnet 4.5. Open `prithvix-web/` and the PRD file as reference.

---

# 🎯 GOAL

Add a **Workspace Picker** screen that appears immediately after login, asking the user to choose:

- **Business Engine** — the existing PrithviX dealer UI (Geist + Linear-style, the app you've been building)
- **Tally Mode** — a faithful **Tally Prime** replica for the dealer's CA / accountant / power user

Once the user picks a mode, that mode is **locked for the entire session**. The only way to switch is logout → login → pick again. Both modes read and write to the same Supabase database (same accounting tables from Phase A).

**Tally Mode is web-only.** Mobile clients always go straight to Business Engine and skip the picker.

---

# 🏛️ ARCHITECTURE

## URL structure

```
/login                 → unchanged
/workspace             → NEW: workspace picker (after login, before any app shell)
/(app)/...             → existing Business Engine routes (home, farmers, udhaar, etc.)
/tally/...             → NEW: Tally Mode routes (gateway, vouchers, reports)
```

## Session state

Add a `workspaceMode` field to the user's session:
- Stored in a cookie or in `auth.users.raw_user_meta_data.workspace_mode`
- Values: `'business_engine'` or `'tally'`
- Set when the user picks at `/workspace`
- Cleared on logout

`middleware.ts` enforcement:
1. If user is unauthenticated → redirect to `/login` (existing behavior)
2. If user is authenticated and `workspaceMode` is unset → redirect to `/workspace`
3. If `workspaceMode === 'business_engine'` and path starts with `/tally` → redirect to `/home`
4. If `workspaceMode === 'tally'` and path is `/(app)/*` (Business Engine) → redirect to `/tally`
5. Mobile user-agent always forces `business_engine` regardless of stored mode

## Both modes share

- Same Supabase tables (farmers, sales, vouchers, ledgers, etc.)
- Same auth (one user, one session)
- Same role permissions
- Same audit log (every action attributed to the user, regardless of mode)

## Both modes do NOT share

- UI shell (sidebar, topbar, layout)
- Color theme
- Typography
- Keyboard shortcut behavior
- Routing structure

Think of it as: **two completely different applications looking at the same data.**

---

# 🚪 STEP 1 — Workspace Picker

## Route: `/workspace/page.tsx`

Full-screen, centered card with two large mode tiles. No sidebar, no topbar.

```tsx
// app/workspace/page.tsx — server component shell
'use client';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { setWorkspaceMode } from '@/lib/workspace';
import { Sprout, Calculator } from 'lucide-react';

export default function WorkspacePicker() {
  const router = useRouter();

  async function pickMode(mode: 'business_engine' | 'tally') {
    await setWorkspaceMode(mode);
    if (mode === 'business_engine') router.replace('/home');
    else router.replace('/tally');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-3xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Choose your workspace</h1>
          <p className="text-xs text-muted-foreground mt-1.5">
            Pick how you'd like to work today. You can switch by signing out and signing back in.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Business Engine tile */}
          <button
            onClick={() => pickMode('business_engine')}
            className="group relative p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.2)] transition-all text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary-strong flex items-center justify-center mb-4 shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.4)]">
              <Sprout className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-base font-semibold tracking-tight mb-1.5">Business Engine</h2>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Run your dealership. Farmers, sales, udhaar, inventory, compliance, AI agronomist — everything for daily operations.
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Farmer CRM & visit tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Quick sales & udhaar
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Inventory & GST invoices
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Mobile + Web
              </li>
            </ul>
            <div className="mt-5 flex items-center text-xs font-medium text-primary group-hover:gap-2 gap-1.5 transition-all">
              Continue
              <span>→</span>
            </div>
          </button>

          {/* Tally Mode tile */}
          <button
            onClick={() => pickMode('tally')}
            className="group relative p-6 rounded-xl border border-border bg-card hover:border-[#FFD700] hover:shadow-[0_8px_24px_-8px_rgba(255,215,0,0.3)] transition-all text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#1B5E20] to-[#0D3D0F] flex items-center justify-center mb-4 shadow-[0_4px_12px_-2px_rgba(27,94,32,0.4)]">
              <Calculator className="h-5 w-5 text-[#FFD700]" />
            </div>
            <h2 className="text-base font-semibold tracking-tight mb-1.5">Tally Mode</h2>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Power-user accounting interface modeled on Tally Prime. Voucher entry, ledgers, day book, trial balance — keyboard-driven.
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-[#1B5E20]" />
                Gateway of Tally interface
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-[#1B5E20]" />
                F4–F9 voucher shortcuts
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-[#1B5E20]" />
                Trial balance, P&L, balance sheet
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-[#1B5E20]" />
                Web only · Desktop optimized
              </li>
            </ul>
            <div className="mt-5 flex items-center text-xs font-medium text-[#1B5E20] dark:text-[#4ADE80] group-hover:gap-2 gap-1.5 transition-all">
              Continue
              <span>→</span>
            </div>
          </button>
        </div>

        <p className="text-center text-2xs text-muted-foreground mt-6">
          Your data is the same in both modes. Tally Mode is recommended for accountants and CAs.
        </p>
      </motion.div>
    </div>
  );
}
```

## Helper: `lib/workspace.ts`

```ts
'use server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';

export async function setWorkspaceMode(mode: 'business_engine' | 'tally') {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Persist to user metadata
  await supabase.auth.updateUser({
    data: { workspace_mode: mode, workspace_picked_at: new Date().toISOString() }
  });

  // Also a session cookie for fast middleware reads
  cookies().set('workspace_mode', mode, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day
  });
}

export async function clearWorkspaceMode() {
  cookies().delete('workspace_mode');
}

export async function getWorkspaceMode(): Promise<'business_engine' | 'tally' | null> {
  return (cookies().get('workspace_mode')?.value as any) ?? null;
}
```

## Update `middleware.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_PATHS = ['/login', '/register-dealer', '/forgot-password', '/reset-password', '/'];
const MOBILE_USER_AGENT = /Mobile|Android|iPhone|iPad|iPod/i;

export async function middleware(request: NextRequest) {
  const { supabase, response } = updateSession(request);
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const ua = request.headers.get('user-agent') || '';
  const isMobile = MOBILE_USER_AGENT.test(ua);

  // Public paths — no auth needed
  if (PUBLIC_PATHS.includes(path)) {
    if (user) {
      // already logged in — bounce to workspace picker or last mode
      const mode = request.cookies.get('workspace_mode')?.value;
      if (isMobile) return NextResponse.redirect(new URL('/home', request.url));
      if (mode === 'tally') return NextResponse.redirect(new URL('/tally', request.url));
      if (mode === 'business_engine') return NextResponse.redirect(new URL('/home', request.url));
      return NextResponse.redirect(new URL('/workspace', request.url));
    }
    return response;
  }

  // Authenticated paths
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  // Workspace picker page itself
  if (path === '/workspace') {
    if (isMobile) return NextResponse.redirect(new URL('/home', request.url));
    return response;
  }

  const mode = request.cookies.get('workspace_mode')?.value;

  // Mobile always forces business_engine
  if (isMobile) {
    if (path.startsWith('/tally')) return NextResponse.redirect(new URL('/home', request.url));
    return response;
  }

  // Desktop: enforce mode
  if (!mode) return NextResponse.redirect(new URL('/workspace', request.url));

  if (mode === 'business_engine' && path.startsWith('/tally')) {
    return NextResponse.redirect(new URL('/home', request.url));
  }
  if (mode === 'tally' && !path.startsWith('/tally') && !path.startsWith('/api')) {
    return NextResponse.redirect(new URL('/tally', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

## Logout flow

In the existing logout handler, **also** clear the `workspace_mode` cookie. After logout, next login goes through `/workspace` again.

---

# 🏛️ STEP 2 — Tally Mode shell

This is the entire visual identity of Tally Prime, ported to web. **Read this carefully — fidelity matters.**

## Tally Prime visual reference

- **Background:** light cream/beige — `#FFF8E7` (the "tally cream")
- **Top menu bar:** light gray with classic Windows-style menu items (K: Company, Y: Data, Z: Exchange, etc.)
- **Right button bar:** vertical strip of buttons on the right edge — yellow background with green text — each button has its function name and a single-letter or F-key shortcut underlined
- **Gateway panel:** centered, with title "Gateway of Tally" in dark green, then a list of menu options (Masters, Transactions, Utilities, Reports) where the **first capital letter is bold and underlined** (the hotkey)
- **Footer status bar:** bottom strip showing current company, financial year, current date, and helpful keyboard hints
- **Typography:** Tally Prime uses a near-monospace approachable font. Closest web equivalent: **`Inter`** with `font-feature-settings: 'tnum'` enabled, or **`IBM Plex Sans`** with tabular numbers. **Use Inter, not Geist** — Geist is too modern.
- **Color palette:**
  - Cream background: `#FFF8E7`
  - Dark green (primary text/accent): `#1B5E20`
  - Yellow (right-bar bg): `#FFD700`
  - Hover blue: `#1976D2`
  - Selection blue (highlighted row): `#0D47A1` with white text
  - Border: `#666666` solid 1px (not hairline — Tally uses real borders)

## Tailwind config addition for Tally Mode

Tally Mode uses its OWN scoped CSS variables. Don't pollute Business Engine's tokens.

```css
/* Add to app/globals.css */
.tally-scope {
  --tally-bg: #FFF8E7;
  --tally-text: #000000;
  --tally-text-muted: #555555;
  --tally-border: #666666;
  --tally-green: #1B5E20;
  --tally-green-bg: #E8F5E9;
  --tally-yellow: #FFD700;
  --tally-yellow-text: #000000;
  --tally-blue: #1976D2;
  --tally-selected-bg: #0D47A1;
  --tally-selected-text: #FFFFFF;
  --tally-warning: #D32F2F;
  --tally-input-bg: #FFFFFF;
  --tally-input-focus: #FFEB3B;

  background: var(--tally-bg);
  color: var(--tally-text);
  font-family: 'Inter', system-ui, sans-serif;
  font-feature-settings: 'tnum' 1, 'lnum' 1;
  font-size: 13px;
  line-height: 1.4;
}

/* Dark mode for Tally — yes, even Tally has a "dark" version on some setups */
.dark .tally-scope {
  --tally-bg: #1A1F1B;
  --tally-text: #E8F5E9;
  --tally-text-muted: #9CA89D;
  --tally-border: #3D4D3F;
  --tally-green-bg: #1B5E20;
  --tally-yellow: #FFD54F;
  --tally-yellow-text: #1A1F1B;
}

.tally-input {
  background: var(--tally-input-bg);
  border: 1px solid var(--tally-border);
  color: var(--tally-text);
  padding: 2px 6px;
  font-family: inherit;
  font-size: 13px;
}
.tally-input:focus {
  background: var(--tally-input-focus);
  outline: 2px solid var(--tally-blue);
  outline-offset: -2px;
}

.tally-button-bar-btn {
  background: var(--tally-yellow);
  color: var(--tally-yellow-text);
  padding: 4px 8px;
  border: 1px solid var(--tally-border);
  font-size: 12px;
  text-align: left;
  width: 100%;
  cursor: pointer;
}
.tally-button-bar-btn:hover {
  background: #FFC107;
}
.tally-button-bar-btn .shortcut {
  color: var(--tally-green);
  font-weight: 700;
}
```

## Tally shell — `app/tally/layout.tsx`

```tsx
'use client';
import { TallyTopMenu } from '@/components/tally/TallyTopMenu';
import { TallyRightButtonBar } from '@/components/tally/TallyRightButtonBar';
import { TallyStatusBar } from '@/components/tally/TallyStatusBar';
import { TallyKeyboardProvider } from '@/components/tally/TallyKeyboardProvider';

export default function TallyLayout({ children }: { children: React.ReactNode }) {
  return (
    <TallyKeyboardProvider>
      <div className="tally-scope min-h-screen flex flex-col">
        <TallyTopMenu />
        <div className="flex-1 flex">
          <main className="flex-1 overflow-auto p-4">{children}</main>
          <TallyRightButtonBar />
        </div>
        <TallyStatusBar />
      </div>
    </TallyKeyboardProvider>
  );
}
```

## `TallyTopMenu`

Horizontal menu bar at the very top. Items: **K**: Company, **Y**: Data, **Z**: Exchange, **G**: Go To, **O**: Import, **E**: Export, **M**: E-mail, **P**: Print, **F1**: Help. Each label has the first letter underlined and triggers via Alt+letter.

Style: small height (~28px), light gray background `#E8E8E8`, classic dropdown-on-click menus. Use Radix `DropdownMenu` for behavior, restyled to look classic-Windows.

```tsx
const MENU_ITEMS = [
  { key: 'K', label: 'Company', children: ['Create', 'Alter', 'Select', 'Shut'] },
  { key: 'Y', label: 'Data', children: ['Backup', 'Restore', 'Export', 'Import'] },
  { key: 'Z', label: 'Exchange', children: ['Synchronization', 'Banking'] },
  { key: 'G', label: 'Go To', children: [] },
  { key: 'O', label: 'Import', children: ['Tally XML', 'Excel', 'GSTR-2B JSON'] },
  { key: 'E', label: 'Export', children: ['Tally XML', 'Excel', 'PDF', 'JSON'] },
  { key: 'M', label: 'E-mail', children: [] },
  { key: 'P', label: 'Print', children: [] },
  { key: 'F1', label: 'Help', children: [] },
];

// Render each as: <span className="px-2 py-1 hover:bg-[#D5D5D5] cursor-pointer text-[12px]">
//   <u>{first letter}</u>{rest of label}
// </span>
```

## `TallyRightButtonBar`

Right-side vertical button bar. Buttons change based on the current screen. Each button looks like this:

```tsx
<button className="tally-button-bar-btn">
  <span className="shortcut">F2</span>: Date
</button>
```

Default home buttons (Gateway): **F2: Date**, **F3: Company**, **F4: Configuration**, **F11: Features**, **F12: Configure**.

Voucher entry adds: **F4: Contra**, **F5: Payment**, **F6: Receipt**, **F7: Journal**, **F8: Sales**, **F9: Purchase** plus **Ctrl+F8: Credit Note**, **Ctrl+F9: Debit Note**.

Reports add: **Alt+F2: Period**, **Alt+F1: Detailed**, **Ctrl+B: Basis of Values**, **Ctrl+H: Change View**, **Alt+P: Print**, **Alt+E: Export**.

Build a context that screens can register their buttons into:

```tsx
// components/tally/TallyButtonBarContext.tsx
const TallyButtonBarContext = createContext<{
  buttons: TallyButton[];
  setButtons: (b: TallyButton[]) => void;
}>(/* ... */);

// Each screen calls useTallyButtonBar() and registers its buttons.
```

## `TallyStatusBar`

Bottom strip, ~24px tall, light gray. Shows: Company name | Current FY | Current Date (F2) | Logged-in user | "Q: Quit" hint.

## `TallyKeyboardProvider`

This is the heart of Tally fidelity. Implements the F-keys, Alt+keys, Ctrl+keys, and Gateway hotkeys.

```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';

export function TallyKeyboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Voucher F-keys (only when on voucher entry, but hooked globally for navigation)
  useHotkeys('f2', () => openDatePicker(), { enableOnFormTags: true });
  useHotkeys('f4', () => router.push('/tally/voucher/new?type=CNT'), { enableOnFormTags: true });
  useHotkeys('f5', () => router.push('/tally/voucher/new?type=PMT'), { enableOnFormTags: true });
  useHotkeys('f6', () => router.push('/tally/voucher/new?type=RCT'), { enableOnFormTags: true });
  useHotkeys('f7', () => router.push('/tally/voucher/new?type=JNL'), { enableOnFormTags: true });
  useHotkeys('f8', () => router.push('/tally/voucher/new?type=SAL'), { enableOnFormTags: true });
  useHotkeys('f9', () => router.push('/tally/voucher/new?type=PUR'), { enableOnFormTags: true });
  useHotkeys('ctrl+f8', () => router.push('/tally/voucher/new?type=CRN'), { enableOnFormTags: true });
  useHotkeys('ctrl+f9', () => router.push('/tally/voucher/new?type=DBN'), { enableOnFormTags: true });

  // Gateway hotkeys (only on /tally root)
  useHotkeys('k', () => router.push('/tally/day-book'), { enableOnFormTags: false });
  useHotkeys('b', () => router.push('/tally/balance-sheet'), { enableOnFormTags: false });
  useHotkeys('p', () => router.push('/tally/profit-loss'), { enableOnFormTags: false });
  useHotkeys('shift+t', () => router.push('/tally/trial-balance'), { enableOnFormTags: false });
  useHotkeys('s', () => router.push('/tally/stock-summary'), { enableOnFormTags: false });
  useHotkeys('o', () => router.push('/tally/outstanding'), { enableOnFormTags: false });

  // Save / Accept
  useHotkeys('ctrl+a', (e) => { e.preventDefault(); document.dispatchEvent(new CustomEvent('tally:save')); }, { enableOnFormTags: true });

  // Quit / Back
  useHotkeys('escape', () => router.back(), { enableOnFormTags: false });

  // Calculator
  useHotkeys('ctrl+n', () => openCalculator(), { enableOnFormTags: true });

  // Go To
  useHotkeys('alt+g', () => openGoTo(), { enableOnFormTags: true });

  // Master quick-create
  useHotkeys('alt+c', () => openQuickCreate(), { enableOnFormTags: true });

  return <>{children}</>;
}
```

Use **`react-hotkeys-hook`** package. Install:
```bash
pnpm add react-hotkeys-hook
```

---

# 🏛️ STEP 3 — Gateway of Tally (`/tally`)

The home screen of Tally Mode. Faithful replica.

```tsx
// app/tally/page.tsx
export default function GatewayOfTally() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="border border-[var(--tally-border)] bg-white dark:bg-[var(--tally-bg)]">
        {/* Title bar */}
        <div className="bg-[var(--tally-green)] text-white px-3 py-1.5 text-sm font-semibold tracking-wide text-center">
          Gateway of Tally
        </div>

        {/* Two columns: left = current company, right = menu */}
        <div className="grid grid-cols-[1fr_2fr] gap-0">
          {/* Left: company info */}
          <div className="border-r border-[var(--tally-border)] p-4 text-xs">
            <div className="text-[var(--tally-text-muted)] mb-1">Current Period</div>
            <div className="font-semibold mb-3">1-Apr-2025 to 31-Mar-2026</div>

            <div className="text-[var(--tally-text-muted)] mb-1">Current Date</div>
            <div className="font-semibold mb-3">{formatDate(today)}</div>

            <div className="text-[var(--tally-text-muted)] mb-1">List of Selected Companies</div>
            <div className="bg-[var(--tally-green-bg)] px-2 py-1 mt-1 text-[var(--tally-green)] font-semibold">
              {dealer.shopName}
            </div>
          </div>

          {/* Right: menu */}
          <div className="p-2">
            <GatewayMenuSection title="MASTERS">
              <GatewayMenuItem hotkey="C" label="Create"  href="/tally/masters/create" />
              <GatewayMenuItem hotkey="A" label="Alter"   href="/tally/masters/alter" />
              <GatewayMenuItem hotkey="H" label="Chart of Accounts" href="/tally/coa" />
            </GatewayMenuSection>

            <GatewayMenuSection title="TRANSACTIONS">
              <GatewayMenuItem hotkey="V" label="Vouchers" href="/tally/vouchers" />
              <GatewayMenuItem hotkey="D" label="Day Book" href="/tally/day-book" />
            </GatewayMenuSection>

            <GatewayMenuSection title="UTILITIES">
              <GatewayMenuItem hotkey="B" label="Banking"  href="/tally/banking" />
              <GatewayMenuItem hotkey="N" label="Bank Reconciliation" href="/tally/bank-rec" />
            </GatewayMenuSection>

            <GatewayMenuSection title="REPORTS">
              <GatewayMenuItem hotkey="K" label="Day Book"        href="/tally/day-book" />
              <GatewayMenuItem hotkey="B" label="Balance Sheet"   href="/tally/balance-sheet" />
              <GatewayMenuItem hotkey="P" label="Profit & Loss"   href="/tally/profit-loss" />
              <GatewayMenuItem hotkey="T" label="Trial Balance"   href="/tally/trial-balance" />
              <GatewayMenuItem hotkey="S" label="Stock Summary"   href="/tally/stock-summary" />
              <GatewayMenuItem hotkey="O" label="Outstanding"     href="/tally/outstanding" />
              <GatewayMenuItem hotkey="R" label="Ratio Analysis"  href="/tally/ratio-analysis" />
              <GatewayMenuItem hotkey="G" label="GST Reports"     href="/tally/gst" />
            </GatewayMenuSection>

            <div className="border-t border-[var(--tally-border)] mt-2 pt-2">
              <GatewayMenuItem hotkey="Q" label="Quit" onClick={handleLogout} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GatewayMenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--tally-text-muted)] font-semibold mb-1 px-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function GatewayMenuItem({ hotkey, label, href, onClick }: { hotkey: string; label: string; href?: string; onClick?: () => void }) {
  // The first letter that matches the hotkey is bold and underlined
  const firstIdx = label.toUpperCase().indexOf(hotkey.toUpperCase());
  return (
    <Link
      href={href ?? '#'}
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-0.5 hover:bg-[var(--tally-selected-bg)] hover:text-[var(--tally-selected-text)] cursor-pointer text-sm"
    >
      <span className="w-4 text-right text-[var(--tally-green)] font-bold">{hotkey}:</span>
      <span>
        {firstIdx >= 0 ? (
          <>
            {label.substring(0, firstIdx)}
            <u className="font-bold">{label[firstIdx]}</u>
            {label.substring(firstIdx + 1)}
          </>
        ) : label}
      </span>
    </Link>
  );
}
```

---

# 🏛️ STEP 4 — Voucher Entry Screen (the most important screen)

This is what CAs spend 80% of their day in. **Get this right.**

## Route: `/tally/voucher/new?type={SAL|PUR|RCT|PMT|CNT|JNL|CRN|DBN|STJ}`

## Layout

The screen has a strict structure:

```
┌─────────────────────────────────────────────────────────────────┐
│ Voucher Type: Sales        Voucher No.: SAL/2025-26/00124       │
│                                                                  │
│ Date: 08-Nov-2025 (F2)                                          │
│                                                                  │
│ Reference No.:           Reference Date:                         │
│                                                                  │
│ Party A/c name : Ramesh Patel                                    │
│ Current balance: 2,500.00 Dr                                     │
│                                                                  │
│ Sales ledger   : Sales — Fertilizer                              │
│                                                                  │
│ Name of Item   : DAP 50kg bag                                    │
│   Quantity     :                  10 bag                         │
│   Rate         :              1,180.00 / bag                     │
│   per          : bag                                             │
│   Amount       :             11,800.00                           │
│                                                                  │
│   [next item line...]                                            │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ CGST @ 9%                                       1,062.00│   │
│   │ SGST @ 9%                                       1,062.00│   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│ Narration: Sale of 10 bags DAP                                  │
│                                                                  │
│                                       Total: 13,924.00          │
└─────────────────────────────────────────────────────────────────┘
```

Every field is a separate **focusable cell**. Tab moves to next, Shift+Tab moves back, Enter accepts and moves to next, Escape cancels. **No mouse needed.**

```tsx
// components/tally/VoucherEntry.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { useTallyButtonBar } from './TallyButtonBarContext';

export function VoucherEntryScreen({ voucherType }: { voucherType: VoucherType }) {
  const [date, setDate] = useState(new Date());
  const [partyLedger, setPartyLedger] = useState<Ledger | null>(null);
  const [salesLedger, setSalesLedger] = useState<Ledger | null>(null);
  const [items, setItems] = useState<VoucherLineItem[]>([blankLine()]);
  const [narration, setNarration] = useState('');

  const { setButtons } = useTallyButtonBar();
  useEffect(() => {
    setButtons([
      { label: 'Date',     shortcut: 'F2', onClick: openDatePicker },
      { label: 'Stock Items', shortcut: 'Alt+F1' },
      { label: 'Party',    shortcut: 'F4' },
      { label: 'Add',      shortcut: 'Alt+I', onClick: addItem },
      { label: 'Ledgers',  shortcut: 'Alt+L' },
      { label: 'Tax Analysis', shortcut: 'Ctrl+O' },
      { label: 'GST',      shortcut: 'Alt+J' },
    ]);
  }, []);

  // Listen for Ctrl+A (save) custom event from KeyboardProvider
  useEffect(() => {
    function onSave() { handleSave(); }
    document.addEventListener('tally:save', onSave);
    return () => document.removeEventListener('tally:save', onSave);
  }, []);

  return (
    <div className="bg-white dark:bg-[var(--tally-bg)] border border-[var(--tally-border)]">
      {/* Title bar */}
      <div className="bg-[var(--tally-green)] text-white px-3 py-1 text-sm font-semibold flex justify-between">
        <span>Voucher Creation — {VOUCHER_TYPE_LABELS[voucherType]}</span>
        <span className="text-xs">No. SAL/2025-26/00124</span>
      </div>

      <div className="p-4 space-y-3 text-[13px]">
        {/* Date row */}
        <FieldRow label="Date" value={date} editor="date" />

        {/* Ref */}
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Reference No." />
          <FieldRow label="Reference Date" editor="date" />
        </div>

        {/* Party */}
        <FieldRow
          label="Party A/c name"
          value={partyLedger?.name}
          editor="ledger-picker"
          ledgerFilter="party"
        />
        {partyLedger && (
          <div className="text-[12px] text-[var(--tally-text-muted)] pl-32">
            Current balance: <span className="font-semibold">{formatINR(partyLedger.currentBalance)} {partyLedger.balanceType}</span>
          </div>
        )}

        {/* Sales ledger */}
        <FieldRow
          label="Sales ledger"
          value={salesLedger?.name}
          editor="ledger-picker"
          ledgerFilter="income"
        />

        {/* Item lines */}
        <div className="border-t border-[var(--tally-border)] pt-3">
          {items.map((item, i) => (
            <ItemLine
              key={i}
              item={item}
              onChange={(updated) => updateItem(i, updated)}
            />
          ))}
        </div>

        {/* Tax breakup */}
        <TaxBreakup items={items} placeOfSupply={dealer.stateCode} buyerStateCode={partyLedger?.stateCode} />

        {/* Narration */}
        <FieldRow
          label="Narration"
          value={narration}
          editor="textarea"
          onChange={setNarration}
        />

        {/* Total */}
        <div className="flex justify-end border-t border-[var(--tally-border)] pt-2">
          <div className="text-base font-semibold">
            Total: {formatINR(grandTotal)}
          </div>
        </div>

        {/* Hint footer */}
        <div className="text-[11px] text-[var(--tally-text-muted)] border-t border-[var(--tally-border)] pt-2 mt-3 flex gap-4">
          <span><kbd>Enter</kbd> Accept</span>
          <span><kbd>Ctrl+A</kbd> Save</span>
          <span><kbd>Esc</kbd> Cancel</span>
          <span><kbd>Alt+C</kbd> Create New</span>
          <span><kbd>Alt+I</kbd> Insert Line</span>
          <span><kbd>Alt+D</kbd> Delete Line</span>
        </div>
      </div>

      {/* Confirmation overlay on save: "Accept ? Yes or No" */}
    </div>
  );
}
```

## `FieldRow` — keyboard-first editable cell

```tsx
function FieldRow({ label, value, editor, onChange, ledgerFilter }: FieldRowProps) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <label className="text-right text-[var(--tally-text)]">{label}</label>
      <Editor type={editor} value={value} onChange={onChange} ledgerFilter={ledgerFilter} />
    </div>
  );
}
```

Editor types:
- `text` — plain `<input className="tally-input">`
- `date` — DD-MM-YYYY format, F2 opens calendar popover
- `ledger-picker` — autocomplete combobox over ledgers, **Alt+C creates new ledger inline** without leaving the screen
- `number` — right-aligned, tabular-nums
- `textarea` — narration, Enter inserts newline only with Shift, plain Enter accepts

## Ledger picker (Tally's "List of Ledgers" panel)

When focus enters a ledger field, a **dropdown panel** appears below showing matching ledgers in real-time. Style it Tally-style:

```
┌─────────────────────────────────────────┐
│ List of Ledgers                         │
├─────────────────────────────────────────┤
│ Ramesh Patel                            │ ← highlighted in blue
│ Rajesh Singh                            │
│ Ravi Kumar                              │
│ ─────────────                           │
│ Create New (Alt+C)                      │
└─────────────────────────────────────────┘
```

Arrow keys navigate, Enter accepts, Esc closes.

## Saving — "Accept ?" prompt

When Ctrl+A is pressed (or all fields filled and Enter on the last one):

```
┌─────────────────────────────┐
│  Accept ?                   │
│                             │
│  Yes or No                  │
└─────────────────────────────┘
```

Press `Y` or Enter to save, `N` or Esc to go back. This is **classic Tally**.

On save:
1. Build the voucher payload with all entries (Dr/Cr from items, taxes, party)
2. Call existing Phase A `post_voucher` RPC
3. On success: clear screen, show next blank voucher (Tally's auto-advance behavior)
4. On error: show in red at the bottom

---

# 🏛️ STEP 5 — Day Book

Route: `/tally/day-book`

```
Day Book                                          1-Nov-2025 to 8-Nov-2025

Date         Particulars          Vch Type   Vch No.    Debit      Credit
─────────────────────────────────────────────────────────────────────────
8-Nov-2025   Ramesh Patel         Sales      00124      13,924.00
             (As per Details)

7-Nov-2025   Cash                 Receipt    00056                 5,000.00
             Ramesh Patel         (Bill: SAL/...)

7-Nov-2025   Suresh Industries    Purchase   00012      45,200.00
             ...
```

Features:
- Date range filter (default: last 7 days)
- Click row to drill into voucher
- Ctrl+H to switch view (Detailed / Condensed)
- Alt+P to print
- Alt+E to export (PDF, Excel, Tally XML)

Right button bar: **F2: Date Range, Alt+F1: Detailed, Ctrl+H: Change View, Alt+P: Print, Alt+E: Export, Ctrl+B: Basis of Values**.

---

# 🏛️ STEP 6 — Trial Balance

Route: `/tally/trial-balance`

```
Trial Balance                                  1-Apr-2025 to 31-Mar-2026
                                               (Closing Balances)

Particulars                          Debit              Credit
──────────────────────────────────────────────────────────────
Capital Account                                       5,00,000.00
Sundry Debtors                  2,15,400.00
Sundry Creditors                                      1,82,000.00
Cash-in-Hand                       58,000.00
Bank Accounts                    1,24,500.00
Stock-in-Hand                    3,40,000.00
Sales Accounts                                       12,80,000.00
Purchase Accounts                9,42,300.00
Direct Expenses                    25,800.00
Indirect Expenses                  1,18,000.00
GST Payable                                              42,000.00
Input GST                          80,000.00
─────────────────────────────────────────────────────────────
                                17,04,000.00         17,04,000.00
                                ════════════         ════════════
```

- Tabular layout, classic Tally typography
- Hierarchical (groups expandable to ledgers via Shift+Enter)
- Shift+Enter expands a group to show child ledgers
- Click any line to drill into ledger statement
- Footer must show equal totals — if not, large RED warning

Right button bar: **F2: Period, Alt+F1: Detailed/Condensed, Ctrl+B: Values, Alt+P: Print, Alt+E: Export**.

---

# 🏛️ STEP 7 — Profit & Loss + Balance Sheet

## P&L (`/tally/profit-loss`)

Two-column layout (Tally-classic):

```
Profit & Loss A/c                              1-Apr-2025 to 31-Mar-2026

Particulars                Amount     Particulars                Amount
─────────────────────────────────────────────────────────────────────────
Opening Stock                          Sales Accounts        12,80,000.00
                                       Direct Income            45,000.00
Purchase Accounts        9,42,300.00
Direct Expenses            25,800.00   Closing Stock          3,40,000.00

Gross Profit c/o          5,96,900.00
─────────────────                      ─────────────────
                       16,65,000.00                          16,65,000.00


Indirect Expenses        1,18,000.00   Gross Profit b/o       5,96,900.00
                                       Indirect Income          12,500.00

Net Profit               4,91,400.00
─────────────────                      ─────────────────
                         6,09,400.00                          6,09,400.00
```

## Balance Sheet (`/tally/balance-sheet`)

Same two-column layout: Liabilities | Assets.

Both reports share design with Trial Balance — group hierarchy, Shift+Enter expansion, drill to ledger.

---

# 🏛️ STEP 8 — Stock Summary, Outstanding, Ratio Analysis

## Stock Summary (`/tally/stock-summary`)
Hierarchical tree of stock groups → items → batches with closing qty/value.

## Outstanding (`/tally/outstanding`)
Two tabs: **Receivables** (debtors) and **Payables** (creditors). Each row: party name, total outstanding, ageing in 4 buckets (0–30 / 31–60 / 61–90 / 90+).

## Ratio Analysis (`/tally/ratio-analysis`)
Classic Tally screen. Computed values:
- Working Capital
- Cash-in-hand
- Bank Accounts
- Sundry Debtors / Creditors
- Stock-in-Hand
- Net Profit
- Gross Profit %
- Net Profit %
- Current Ratio (Current Assets / Current Liabilities)
- Quick Ratio
- Debt/Equity Ratio
- Inventory Turnover

---

# 🏛️ STEP 9 — Chart of Accounts (`/tally/coa`)

Tree view of groups → ledgers, exactly like Tally's "List of Ledgers" screen. Press Enter on a group to expand. Press Enter on a ledger to view its statement. **Alt+C** to create new ledger.

---

# 🏛️ STEP 10 — Masters create/alter

## `/tally/masters/create`

A small menu screen:
```
Masters Create

A: Accounting Masters
   G: Group
   L: Ledger
   V: Voucher Type
   U: Unit
   C: Currency

I: Inventory Masters
   S: Stock Group
   I: Stock Item
   C: Stock Category
   G: Godown
```

## Group create / Ledger create / Item create
Mini full-screen forms exactly like Tally's "Ledger Creation" screen:

```
Ledger Creation

Name           : ABC Traders
(alias)        :

Under          : Sundry Creditors

Mailing Details
  Address      : ...
  State        : Gujarat
  Country      : India
  PIN Code     : 380001

Tax Information
  PAN/IT No.   :
  GSTIN/UIN    :

Opening Balance:                              Dr / Cr
```

Tab through fields. Ctrl+A to save. Auto-creates the row in `ledgers` table.

---

# 🏛️ STEP 11 — Tally XML Import / Export (already in Phase F)

Hook the Tally XML export tool into:
- Top menu **E**: Export → Tally XML
- Reports → Day Book → Alt+E → Tally XML

For now, stub the actual XML generation if Phase F is not yet built. The button shows "Generating…" then "Available in next phase."

---

# 🏛️ STEP 12 — Calculator (Ctrl+N)

Tally has a built-in calculator on the bottom-left of every screen. When Ctrl+N is pressed, focus moves to a calculator strip at the bottom. Expression evaluator: type `2500*4+125`, press Enter, result appears. Ctrl+N again to close.

This is a small but very Tally-authentic detail. Implement it.

```tsx
// components/tally/TallyCalculator.tsx
function TallyCalculator() {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<number | null>(null);

  function evaluate() {
    try {
      // Safe eval — use mathjs
      const r = math.evaluate(expr);
      setResult(r);
    } catch { setResult(null); }
  }

  if (!open) return null;
  return (
    <div className="fixed bottom-6 left-0 right-0 bg-[var(--tally-yellow)] border-t-2 border-[var(--tally-border)] px-3 py-1.5 flex items-center gap-3">
      <span className="font-bold">Calc:</span>
      <input
        autoFocus
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') evaluate(); }}
        className="flex-1 bg-white border border-[var(--tally-border)] px-2 py-0.5 text-sm font-mono"
      />
      <span className="font-mono font-bold">= {result?.toFixed(2) ?? '—'}</span>
      <span className="text-xs text-[var(--tally-text-muted)]">Ctrl+N to close</span>
    </div>
  );
}
```

Use `mathjs` for safe expression evaluation. Already in deps.

---

# 🏛️ STEP 13 — Go To search (Alt+G)

Tally Prime's "Go To" is a global search palette. Press Alt+G anywhere → modal opens → type any report or master name → fuzzy-matched results → Enter to navigate.

```tsx
// Reuse the cmdk approach but Tally-styled
<Command.Dialog open={open} onOpenChange={setOpen}>
  <Command.Input placeholder="Go To... (type any report or master)" />
  <Command.List>
    <Command.Group heading="Reports">
      <Command.Item onSelect={() => router.push('/tally/balance-sheet')}>Balance Sheet</Command.Item>
      <Command.Item onSelect={() => router.push('/tally/profit-loss')}>Profit & Loss A/c</Command.Item>
      {/* ...all reports */}
    </Command.Group>
    <Command.Group heading="Masters">
      <Command.Item>Create Ledger</Command.Item>
      <Command.Item>Alter Ledger</Command.Item>
    </Command.Group>
    <Command.Group heading="Vouchers">
      <Command.Item onSelect={() => router.push('/tally/voucher/new?type=SAL')}>New Sales Voucher (F8)</Command.Item>
    </Command.Group>
  </Command.List>
</Command.Dialog>
```

Style the modal Tally-yellow/cream. **NOT the Linear-style cmd palette from Business Engine.** Different aesthetic.

---

# 🏛️ STEP 14 — Period selector (F2 / Alt+F2)

F2 = change current date. Alt+F2 = change reporting period (date range).

Both open a small Tally-style overlay at the top of the screen:

```
Date: 8-11-2025   ←→
```

Arrow keys adjust day/month/year by segment. Enter to accept.

---

# 🎨 VISUAL FIDELITY CHECKLIST

These details separate "looks like Tally" from "actually feels like Tally":

- [ ] Cream `#FFF8E7` background everywhere, NOT white
- [ ] Hard 1px gray borders on every panel (Tally is line-heavy, unlike Linear's hairlines)
- [ ] Right button bar is **always visible** on the right edge
- [ ] Top menu bar is light gray with classic Windows dropdown menus
- [ ] Bottom status bar is always visible
- [ ] Active/focused field has **yellow background** (`#FFEB3B`), not blue ring
- [ ] Selected list item has **dark blue background, white text** (the classic Tally selection)
- [ ] All numbers are **right-aligned**, **tabular**, with **commas in Indian format**
- [ ] All amounts have decimals shown explicitly: `1,250.00` not `1,250`
- [ ] Dates always `DD-MMM-YYYY` format: `8-Nov-2025` not `08/11/2025`
- [ ] Hotkey letters are **bold + underlined** in menus (`<u>D</u>ay Book`)
- [ ] Voucher numbers always shown as `TYPE/FY/NUMBER` (`SAL/2025-26/00124`)
- [ ] Drill-down with Enter; back with Escape (NEVER with mouse only)
- [ ] "Accept ? Yes or No" prompt before saving any voucher
- [ ] No emoji anywhere. Tally has none. This is serious accounting software.
- [ ] No animations beyond instant transitions. Tally is snappy and immediate.
- [ ] No drop shadows. Tally is flat.
- [ ] No rounded corners except on the workspace picker tiles. Tally uses sharp rectangles.

---

# 🔌 SHARED BACKEND — verify

Both modes use the same:
- `vouchers`, `voucher_entries`, `ledgers`, `account_groups`, `financial_years`, `voucher_number_series` tables (Phase A)
- `farmers`, `sales`, `inventory_*`, `credit_payments` tables (existing)
- `post_voucher`, `next_voucher_number`, `ensure_party_ledger` RPCs (Phase A)

If a dealer enters a sale in **Business Engine**, the same SAL voucher is visible in **Tally Mode's Day Book**. If a CA enters a journal in **Tally Mode**, the dealer's ledger in **Business Engine** reflects it.

**DO NOT** create separate "tally voucher" tables. Same backend, different UI.

---

# ✅ ACCEPTANCE — verify before claiming done

## Workspace picker
- [ ] After login, desktop user is redirected to `/workspace`.
- [ ] Both tiles render with correct visual weight (Business Engine = green/Linear, Tally = green/yellow/cream).
- [ ] Picking Business Engine sets cookie + lands at `/home`.
- [ ] Picking Tally sets cookie + lands at `/tally`.
- [ ] Mobile user-agent skips picker entirely and goes to `/home`.
- [ ] After picking, refreshing the page keeps the user in the chosen mode.
- [ ] Logout clears the workspace cookie; next login forces picker again.

## Mode lock
- [ ] If user is in Business Engine and tries to navigate to `/tally/*`, middleware redirects to `/home`.
- [ ] If user is in Tally and tries to navigate to a Business Engine page, middleware redirects to `/tally`.
- [ ] No "switch mode" button anywhere in the UI. Logout is the only way.

## Tally Mode visual
- [ ] Cream background.
- [ ] Top menu, right button bar, bottom status bar all present.
- [ ] Inter font, 13px body, tabular numbers.
- [ ] Hard 1px borders everywhere.
- [ ] Yellow focus highlight on active field.
- [ ] Blue selection background on active row.
- [ ] All currency in Indian comma format with `.00` decimals.
- [ ] All dates in `DD-MMM-YYYY`.

## Tally Mode keyboard
- [ ] F2 opens date picker.
- [ ] F4 → Contra voucher new.
- [ ] F5 → Payment voucher new.
- [ ] F6 → Receipt voucher new.
- [ ] F7 → Journal voucher new.
- [ ] F8 → Sales voucher new.
- [ ] F9 → Purchase voucher new.
- [ ] Ctrl+F8 → Credit Note.
- [ ] Ctrl+F9 → Debit Note.
- [ ] Ctrl+A saves the current voucher.
- [ ] Esc goes back / quits prompt.
- [ ] Alt+G opens Go To search.
- [ ] Alt+C creates a new master inline.
- [ ] Ctrl+N opens the calculator strip at the bottom.
- [ ] Gateway hotkeys K, B, P, S, T, O all navigate correctly.

## Tally Mode screens
- [ ] Gateway of Tally renders with Masters / Transactions / Utilities / Reports sections.
- [ ] Voucher creation screen for Sales (F8) accepts party, sales ledger, items, narration.
- [ ] Voucher saves via Ctrl+A → "Accept ?" prompt → posts via `post_voucher` RPC.
- [ ] Day Book lists all vouchers for the period.
- [ ] Trial Balance balances (Dr total = Cr total).
- [ ] P&L computes correctly (revenue – expenses = net profit).
- [ ] Balance Sheet balances (Assets = Liabilities + Capital + Net Profit).
- [ ] Stock Summary lists all items with closing qty/value.
- [ ] Outstanding lists debtors and creditors with ageing.
- [ ] Chart of Accounts tree renders.
- [ ] Ledger creation form works and saves.

## Cross-mode integrity
- [ ] A sale created in Business Engine shows up in Tally Mode's Day Book.
- [ ] A journal entry created in Tally Mode reflects in the dealer's ledger view in Business Engine.
- [ ] Trial balance is identical regardless of which mode generated the underlying transactions.

## Build
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm build` succeeds.
- [ ] No `react-native` or `expo-*` imports.
- [ ] Lighthouse a11y score > 85 on Tally Mode (keyboard nav is great for a11y).

---

# 🚦 EXECUTION PLAN

Execute in this order. Pause after each step.

1. **Step 1:** Workspace picker page + cookie helpers + middleware update + logout cleanup.
2. **Step 2:** Tally Mode CSS scope (`tally-scope` class), font setup (Inter), color palette, base components.
3. **Step 3:** Tally shell — `app/tally/layout.tsx`, top menu, right button bar, status bar, keyboard provider, calculator, Go To.
4. **Step 4:** Gateway of Tally page + GatewayMenuItem hotkey rendering.
5. **Step 5:** Voucher entry screen (Sales first as the canonical implementation, then Purchase, Receipt, Payment, Journal, Contra, Credit Note, Debit Note, Stock Journal — share the same component with type-specific config).
6. **Step 6:** Day Book.
7. **Step 7:** Trial Balance + P&L + Balance Sheet (share a base "FinancialReport" component).
8. **Step 8:** Stock Summary, Outstanding, Ratio Analysis.
9. **Step 9:** Chart of Accounts tree.
10. **Step 10:** Master create/alter screens (Group, Ledger, Stock Item, Unit, Voucher Type).
11. **Step 11:** Tally XML stubs in Top menu.
12. **Step 12:** Period picker (F2/Alt+F2) overlay.
13. **Step 13:** Full visual + keyboard QA against the fidelity checklist.
14. **Step 14:** Cross-mode integrity tests (create in one mode, verify in the other).

---

# ⛔ THINGS NOT TO DO

- Do NOT add a mid-session mode toggle anywhere. The product decision is: lock until logout.
- Do NOT redesign Business Engine. Both modes coexist — they don't influence each other's styling.
- Do NOT create new database tables. All voucher data lives in the existing Phase A tables.
- Do NOT use the existing Linear/Geist design system inside `/tally/*`. The whole point is the cream/yellow Tally aesthetic.
- Do NOT use shadcn `<Card>`, `<Button>`, `<Input>` styled-by-theme inside Tally Mode. Build dedicated `tally-input`, `tally-button`, `tally-panel` primitives that follow Tally fidelity.
- Do NOT add modern UX patterns to Tally Mode (toast notifications, skeleton loaders, hover lift). Tally is instant, flat, and serious.
- Do NOT implement the Tally XML export logic itself in this prompt — that's Phase F. Just stub the menu entries.
- Do NOT touch the existing Phase A voucher engine, RPCs, or schemas. Read-only reuse.

Begin now. Output your numbered plan first, then proceed step by step with my approval after each step.
