'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUpsertSupplierMutation } from '@/hooks/usePurchaseQueries';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { filterStates, INDIAN_STATE_OPTIONS } from '@/lib/indian-states';
import {
  validateGstin,
  validateSupplierForm,
  type SupplierFormValues,
} from '@/lib/validations/purchase';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';
import type { SupplierRow } from '@/lib/supabase/purchase';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-2 border-b border-[#EEEEEE] py-[4px]">
      <span className="text-[13px] text-[#1B5E20]">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SupplierMasterForm({
  mode,
  existing,
}: {
  mode: 'create' | 'alter';
  existing?: SupplierRow | null;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const mut = useUpsertSupplierMutation();
  const setButtons = useTallySetButtons();
  const [acceptOpen, setAcceptOpen] = useState(false);

  const [values, setValues] = useState<SupplierFormValues>({
    name: '',
    gstin: '',
    state_code: '',
    mobile: '',
    credit_days: 30,
    credit_limit: 0,
    opening_balance: 0,
    balance_type: 'CR',
    bank_name: '',
    bank_account: '',
    bank_ifsc: '',
    address_line1: '',
    city: '',
    pincode: '',
    pan: '',
    email: '',
  });

  const [stateQ, setStateQ] = useState('');
  const [stateOpen, setStateOpen] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setValues({
      name: existing.name,
      gstin: existing.gstin ?? '',
      state_code: existing.state_code ?? '',
      mobile: existing.mobile ?? '',
      credit_days: existing.credit_days ?? 30,
      credit_limit: Number(existing.credit_limit) || 0,
      opening_balance: Number(existing.opening_balance) || 0,
      balance_type: (existing.balance_type as 'DR' | 'CR') ?? 'CR',
      bank_name: existing.bank_name ?? '',
      bank_account: existing.bank_account ?? '',
      bank_ifsc: existing.bank_ifsc ?? '',
      address_line1: existing.address_line1 ?? '',
      city: existing.city ?? '',
      pincode: existing.pincode ?? '',
      pan: existing.pan ?? '',
      email: existing.email ?? '',
    });
  }, [existing]);

  useEffect(() => {
    setButtons([
      { label: 'Save', shortcut: 'Ctrl+A' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  const save = useCallback(async () => {
    const parsed = validateSupplierForm(values);
    if (!parsed.ok) {
      playTallyError();
      return;
    }
    try {
      await mut.mutateAsync({
        id: existing?.id,
        dealer_id: session?.dealerId ?? '',
        ledger_id: existing?.ledger_id ?? undefined,
        name: parsed.data.name,
        gstin: parsed.data.gstin?.trim().toUpperCase() || null,
        state_code: parsed.data.state_code?.trim() || null,
        mobile: parsed.data.mobile?.trim() || null,
        credit_days: parsed.data.credit_days,
        credit_limit: parsed.data.credit_limit,
        opening_balance: parsed.data.opening_balance,
        balance_type: parsed.data.balance_type,
        bank_name: parsed.data.bank_name || null,
        bank_account: parsed.data.bank_account || null,
        bank_ifsc: parsed.data.bank_ifsc || null,
        address_line1: parsed.data.address_line1 || null,
        city: parsed.data.city || null,
        pincode: parsed.data.pincode || null,
        pan: parsed.data.pan || null,
        email: parsed.data.email || null,
      });
      playTallyAccept();
      router.push('/tally/purchase/suppliers');
    } catch {
      playTallyError();
    }
  }, [mut, router, session?.dealerId, values, existing?.id, existing?.ledger_id]);

  useEffect(() => {
    const fn = () => setAcceptOpen(true);
    document.addEventListener('tally:save', fn);
    return () => document.removeEventListener('tally:save', fn);
  }, []);

  const stateFiltered = filterStates(stateOpen ? stateQ : '');

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div
        className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20' }}
      >
        Supplier Master — {mode === 'create' ? 'Create' : 'Alter'}
      </div>

      <div className="flex-1 overflow-auto border border-[#AAAAAA] bg-white p-2">
        <Field label="Name">
          <input
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </Field>
        <Field label="GSTIN">
          <input
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.gstin ?? ''}
            onBlur={() => {
              const g = (values.gstin ?? '').trim().toUpperCase();
              if (g && !validateGstin(g)) playTallyError();
            }}
            onChange={(e) =>
              setValues((v) => ({ ...v, gstin: e.target.value.toUpperCase() }))
            }
          />
        </Field>
        <Field label="State">
          <div className="relative">
            <input
              className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
              placeholder="Type code or name…"
              value={
                stateOpen
                  ? stateQ
                  : INDIAN_STATE_OPTIONS.find((o) => o.code === values.state_code)?.name ?? ''
              }
              onFocus={() => {
                setStateOpen(true);
                setStateQ('');
              }}
              onChange={(e) => {
                setStateQ(e.target.value);
                setStateOpen(true);
              }}
            />
            {stateOpen ? (
              <ul
                className="absolute left-0 right-0 top-full z-10 max-h-40 overflow-auto border border-[#AAAAAA] bg-[#FFF8E7]"
                style={{ borderRadius: 0 }}
              >
                {stateFiltered.slice(0, 40).map((o) => (
                  <li
                    key={o.code}
                    className="cursor-pointer px-2 py-[2px] hover:bg-[#0D47A1] hover:text-white"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setValues((v) => ({ ...v, state_code: o.code }));
                      setStateOpen(false);
                      setStateQ('');
                    }}
                  >
                    {o.name} ({o.code})
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Field>
        <Field label="Mobile">
          <input
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.mobile ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, mobile: e.target.value }))}
          />
        </Field>
        <Field label="Address">
          <input
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.address_line1 ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, address_line1: e.target.value }))}
          />
        </Field>
        <Field label="City">
          <input
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.city ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
          />
        </Field>
        <Field label="Pincode">
          <input
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.pincode ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, pincode: e.target.value }))}
          />
        </Field>
        <Field label="Credit Days">
          <input
            type="number"
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.credit_days}
            onChange={(e) =>
              setValues((v) => ({ ...v, credit_days: Number(e.target.value) || 0 }))
            }
          />
        </Field>
        <Field label="Credit Limit">
          <input
            type="number"
            step="0.01"
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.credit_limit}
            onChange={(e) =>
              setValues((v) => ({ ...v, credit_limit: Number(e.target.value) || 0 }))
            }
          />
        </Field>
        <Field label="Opening Bal">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              className="min-w-0 flex-1 border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
              value={values.opening_balance}
              onChange={(e) =>
                setValues((v) => ({ ...v, opening_balance: Number(e.target.value) || 0 }))
              }
            />
            <select
              className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
              value={values.balance_type}
              onChange={(e) =>
                setValues((v) => ({ ...v, balance_type: e.target.value as 'DR' | 'CR' }))
              }
            >
              <option value="DR">DR</option>
              <option value="CR">CR</option>
            </select>
          </div>
        </Field>
        <Field label="Bank Name">
          <input
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.bank_name ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, bank_name: e.target.value }))}
          />
        </Field>
        <Field label="Bank A/c">
          <input
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.bank_account ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, bank_account: e.target.value }))}
          />
        </Field>
        <Field label="IFSC">
          <input
            className="w-full border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={values.bank_ifsc ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, bank_ifsc: e.target.value }))}
          />
        </Field>
      </div>

      {acceptOpen ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Accept"
        >
          <div
            className="w-[360px] border border-[#AAAAAA] bg-[#FFF8E7] p-3 text-[13px]"
            style={{ borderRadius: 0 }}
          >
            <p className="mb-2 font-semibold text-[#1B5E20]">Accept ? Yes or No</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="border border-[#AAAAAA] bg-white px-3 py-1 font-medium hover:bg-[#FFEB3B]"
                onClick={() => {
                  setAcceptOpen(false);
                  void save();
                }}
              >
                Yes (Y)
              </button>
              <button
                type="button"
                className="border border-[#AAAAAA] bg-white px-3 py-1 hover:bg-[#EEEEEE]"
                onClick={() => setAcceptOpen(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
