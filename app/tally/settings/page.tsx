'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { playTallyError } from '@/lib/tally-sounds';
import {
  COMPANY_CONFIG_KEY,
  type PrithviXCompanyStoredConfig,
  defaultCompanyStoredConfig,
} from '@/lib/reports/tally-pdf-table';

const GST_RATES = [5, 12, 18, 28] as const;

function loadConfig(): PrithviXCompanyStoredConfig {
  if (typeof window === 'undefined') return defaultCompanyStoredConfig();
  try {
    const raw = localStorage.getItem(COMPANY_CONFIG_KEY);
    if (!raw) return defaultCompanyStoredConfig();
    const p = JSON.parse(raw) as Partial<PrithviXCompanyStoredConfig>;
    return { ...defaultCompanyStoredConfig(), ...p };
  } catch {
    return defaultCompanyStoredConfig();
  }
}

function validateGstin(v: string): boolean {
  if (!v) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v.trim().toUpperCase());
}

function validatePan(v: string): boolean {
  if (!v) return true;
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v.trim().toUpperCase());
}

type ModalShellProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function ModalShell({ title, onClose, children }: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-[400] flex items-start justify-center overflow-y-auto bg-black/45 px-2 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-lg border border-[#AAAAAA] bg-[#FFF8E7] shadow-lg" style={{ borderRadius: 0 }}>
        <div className="flex items-center justify-between border-b border-[#0D3D0F] px-3 py-2 text-white" style={{ background: '#1B5E20' }}>
          <h2 id="settings-modal-title" className="text-[13px] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="px-2 py-0.5 text-[12px] text-white underline"
            onClick={onClose}
          >
            Esc
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-3 text-[13px]">{children}</div>
      </div>
    </div>
  );
}

export default function SettingsTabPage() {
  const { logout } = useAuth();
  const setButtons = useTallySetButtons();
  const [companyOpen, setCompanyOpen] = useState(false);
  const [gstOpen, setGstOpen] = useState(false);
  const [cfg, setCfg] = useState<PrithviXCompanyStoredConfig>(defaultCompanyStoredConfig);
  const [savedFlash, setSavedFlash] = useState(false);
  const [errors, setErrors] = useState<{ gstin?: string; pan?: string }>({});

  /* Read localStorage after mount so SSR markup matches initial client state (defaults). */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration sync from localStorage
    setCfg(loadConfig());
  }, []);

  const stateFromGstin = useMemo(() => {
    const g = cfg.gstin.trim();
    if (g.length < 2) return '—';
    return g.slice(0, 2);
  }, [cfg.gstin]);

  const persist = useCallback((next: PrithviXCompanyStoredConfig) => {
    localStorage.setItem(COMPANY_CONFIG_KEY, JSON.stringify(next));
    setCfg(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }, []);

  const saveCompany = useCallback(() => {
    const e: { gstin?: string; pan?: string } = {};
    if (!validateGstin(cfg.gstin)) e.gstin = 'Enter valid 15-character GSTIN';
    if (!validatePan(cfg.pan)) e.pan = 'Enter valid PAN (AAAAA9999A)';
    setErrors(e);
    if (Object.keys(e).length) return;
    persist(cfg);
    setCompanyOpen(false);
  }, [cfg, persist]);

  const saveGst = useCallback(() => {
    persist(cfg);
    setGstOpen(false);
  }, [cfg, persist]);

  useEffect(() => {
    if (!companyOpen && !gstOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setCompanyOpen(false);
        setGstOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [companyOpen, gstOpen]);

  useHotkeys(
    'c',
    () => setCompanyOpen(true),
    { enabled: !companyOpen && !gstOpen, enableOnFormTags: false }
  );
  useHotkeys(
    'g',
    () => setGstOpen(true),
    { enabled: !companyOpen && !gstOpen, enableOnFormTags: false }
  );

  useEffect(() => {
    setButtons([
      { label: 'Configure', shortcut: 'F12' },
      { label: 'Save', shortcut: 'Ctrl+A' },
      { label: 'Cancel', shortcut: 'Esc' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  const field = 'border border-[#AAAAAA] bg-white px-1 py-[3px] w-full';
  const labelCls = 'mt-2 block text-[11px] font-medium text-[#444]';

  return (
    <div className="p-0">
      <div
        className="py-[5px] text-center text-[13px] font-semibold tracking-wide text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}
      >
        Settings
      </div>
      <div
        className="px-4 py-[3px] text-[11px] italic"
        style={{ background: '#F0ECD8', borderBottom: '1px solid #CCCCCC', color: '#666666' }}
      >
        Company Configuration, Features, Security · Press <strong>C</strong> or <strong>G</strong> for quick open
      </div>
      {savedFlash ? (
        <div className="bg-[#E8F5E9] px-4 py-1 text-center text-[12px] text-[#1B5E20]">Saved to this device</div>
      ) : null}

      <div className="p-0" style={{ border: '1px solid #AAAAAA', margin: '12px', background: '#FFFFFF' }}>
        <div
          className="grid px-3 py-[4px] text-[11px] font-semibold uppercase"
          style={{
            gridTemplateColumns: '40px 1fr 80px',
            background: '#F0F0F0',
            borderBottom: '1px solid #AAAAAA',
            color: '#555555',
            letterSpacing: '0.08em',
          }}
        >
          <span>Key</span>
          <span>Feature</span>
          <span className="text-right">Status</span>
        </div>

        <button
          type="button"
          className="group grid w-full border-b border-[#EEEEEE] px-3 py-[4px] text-left text-[13px] hover:bg-[#0D47A1] hover:text-white"
          style={{ gridTemplateColumns: '40px 1fr 80px' }}
          onClick={() => setCompanyOpen(true)}
        >
          <span className="font-bold text-[#1B5E20] group-hover:text-white">C:</span>
          <span>Company Details</span>
          <span className="text-right text-[11px] font-semibold text-[#1B5E20] group-hover:text-white">● Live</span>
        </button>

        <button
          type="button"
          className="group grid w-full border-b border-[#EEEEEE] px-3 py-[4px] text-left text-[13px] hover:bg-[#0D47A1] hover:text-white"
          style={{ gridTemplateColumns: '40px 1fr 80px' }}
          onClick={() => setGstOpen(true)}
        >
          <span className="font-bold text-[#1B5E20] group-hover:text-white">G:</span>
          <span>GST Configuration</span>
          <span className="text-right text-[11px] font-semibold text-[#1B5E20] group-hover:text-white">● Live</span>
        </button>

        {(
          [
            { hotkey: 'F', label: 'Features & Configuration' },
            { hotkey: 'U', label: 'User Management' },
            { hotkey: 'A', label: 'Audit Log' },
            { hotkey: 'B', label: 'Backup & Restore' },
          ] as const
        ).map((f) => (
          <button
            key={f.hotkey}
            type="button"
            className="grid w-full cursor-default border-b border-[#EEEEEE] px-3 py-[4px] text-left text-[13px] text-[#999999]"
            style={{ gridTemplateColumns: '40px 1fr 80px' }}
            onClick={() => playTallyError()}
          >
            <span className="font-bold">{f.hotkey}:</span>
            <span>{f.label}</span>
            <span className="text-right text-[11px] text-[#AAAAAA]">○ Soon</span>
          </button>
        ))}

        <button
          type="button"
          className="group grid w-full px-3 py-[4px] text-left text-[13px]"
          style={{ gridTemplateColumns: '40px 1fr 80px', cursor: 'pointer', color: '#000000', background: 'transparent' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#0D47A1';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#000000';
          }}
          onClick={() => void logout()}
        >
          <span className="font-bold text-[#1B5E20]" style={{ fontWeight: 700 }}>
            Q:
          </span>
          <span>Logout / Switch Mode</span>
          <span className="text-right text-[11px] font-semibold text-[#1B5E20]">● Live</span>
        </button>
      </div>

      <div className="px-4 py-[3px] text-[11px]" style={{ color: '#888888', borderTop: '1px solid #DDDDDD' }}>
        Company & GST data stays in this browser (localStorage) · PDF exports pick it up automatically
      </div>

      {companyOpen ? (
        <ModalShell title="Company details (F:C)" onClose={() => setCompanyOpen(false)}>
          <label className={labelCls}>Company name</label>
          <input className={field} value={cfg.companyName} onChange={(e) => setCfg({ ...cfg, companyName: e.target.value })} />

          <label className={labelCls}>Address line 1</label>
          <input className={field} value={cfg.addressLine1} onChange={(e) => setCfg({ ...cfg, addressLine1: e.target.value })} />
          <label className={labelCls}>Address line 2</label>
          <input className={field} value={cfg.addressLine2} onChange={(e) => setCfg({ ...cfg, addressLine2: e.target.value })} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>City</label>
              <input className={field} value={cfg.city} onChange={(e) => setCfg({ ...cfg, city: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <input className={field} value={cfg.state} onChange={(e) => setCfg({ ...cfg, state: e.target.value })} />
            </div>
          </div>
          <label className={labelCls}>PIN</label>
          <input className={field} value={cfg.pin} onChange={(e) => setCfg({ ...cfg, pin: e.target.value })} />

          <label className={labelCls}>GSTIN (15 chars)</label>
          <input
            className={field}
            value={cfg.gstin}
            onChange={(e) => setCfg({ ...cfg, gstin: e.target.value.toUpperCase() })}
          />
          {errors.gstin ? <p className="mt-1 text-[11px] text-red-700">{errors.gstin}</p> : null}

          <label className={labelCls}>PAN</label>
          <input
            className={field}
            value={cfg.pan}
            onChange={(e) => setCfg({ ...cfg, pan: e.target.value.toUpperCase() })}
          />
          {errors.pan ? <p className="mt-1 text-[11px] text-red-700">{errors.pan}</p> : null}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>FY starts — month</label>
              <input
                type="number"
                min={1}
                max={12}
                className={field}
                value={cfg.fyStartMonth}
                onChange={(e) => setCfg({ ...cfg, fyStartMonth: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelCls}>FY starts — day</label>
              <input
                type="number"
                min={1}
                max={31}
                className={field}
                value={cfg.fyStartDay}
                onChange={(e) => setCfg({ ...cfg, fyStartDay: Number(e.target.value) })}
              />
            </div>
          </div>

          <label className={labelCls}>Phone</label>
          <input className={field} value={cfg.phone} onChange={(e) => setCfg({ ...cfg, phone: e.target.value })} />
          <label className={labelCls}>Email</label>
          <input className={field} type="email" value={cfg.email} onChange={(e) => setCfg({ ...cfg, email: e.target.value })} />

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="border border-[#1B5E20] bg-[#1B5E20] px-4 py-1.5 text-white"
              style={{ borderRadius: 0 }}
              onClick={() => saveCompany()}
            >
              Save
            </button>
            <button type="button" className="border border-[#AAAAAA] bg-white px-4 py-1.5" style={{ borderRadius: 0 }} onClick={() => setCompanyOpen(false)}>
              Cancel
            </button>
          </div>
        </ModalShell>
      ) : null}

      {gstOpen ? (
        <ModalShell title="GST configuration (F:G)" onClose={() => setGstOpen(false)}>
          <label className={labelCls}>Default GST rate (%)</label>
          <select
            className={field}
            value={cfg.defaultGstRate}
            onChange={(e) => setCfg({ ...cfg, defaultGstRate: Number(e.target.value) })}
          >
            {GST_RATES.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>

          <label className={labelCls}>State code (from GSTIN)</label>
          <input className={field} readOnly value={stateFromGstin} />

          <label className={`${labelCls} flex items-center gap-2`}>
            <input
              type="checkbox"
              checked={cfg.compositionScheme}
              onChange={(e) => setCfg({ ...cfg, compositionScheme: e.target.checked })}
            />
            Composition scheme
          </label>

          <label className={labelCls}>E-invoice threshold (₹ Crore, default 5)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            className={field}
            value={cfg.eInvoiceThresholdCr}
            onChange={(e) => setCfg({ ...cfg, eInvoiceThresholdCr: Number(e.target.value) })}
          />

          <p className="mt-3 text-[11px] leading-snug text-[#666]">
            Set GSTIN under Company details for automatic state code. Rates apply as defaults in purchase / sales workflows where supported.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="border border-[#1B5E20] bg-[#1B5E20] px-4 py-1.5 text-white"
              style={{ borderRadius: 0 }}
              onClick={() => saveGst()}
            >
              Save
            </button>
            <button type="button" className="border border-[#AAAAAA] bg-white px-4 py-1.5" style={{ borderRadius: 0 }} onClick={() => setGstOpen(false)}>
              Cancel
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
