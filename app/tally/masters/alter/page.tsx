'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useLedgerPickListQuery } from '@/hooks/useReportsQueries';
import { supabase } from '@/lib/supabase/client';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

type LedgerGroup = { id: string; group_name: string; group_code: string };

type FormState = {
  name: string;
  groupId: string;
  openingBalance: string;
  balanceType: 'Dr' | 'Cr';
  gstin: string;
  phone: string;
  email: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  groupId: '',
  openingBalance: '',
  balanceType: 'Dr',
  gstin: '',
  phone: '',
  email: '',
  notes: '',
};

function TallyMastersAlterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id') ?? '';
  const { session } = useAuth();
  const setButtons = useTallySetButtons();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState('');
  const [error, setError] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [loadingLedger, setLoadingLedger] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const { data: ledgers = [] } = useLedgerPickListQuery();

  /* Load ledger groups */
  useEffect(() => {
    const id = session?.dealerRowId;
    if (!id) return;
    supabase
      .from('ledger_groups')
      .select('id, group_name, group_code')
      .eq('dealer_id', id)
      .order('group_name')
      .then(({ data, error: e }) => {
        if (e) return;
        setGroups(
          (data ?? []).map((r: Record<string, unknown>) => ({
            id: String(r.id ?? ''),
            group_name: String(r.group_name ?? ''),
            group_code: String(r.group_code ?? ''),
          }))
        );
      });
  }, [session?.dealerRowId]);

  /* Load selected ledger */
  useEffect(() => {
    if (!selectedId) { setForm(EMPTY_FORM); return; }
    setLoadingLedger(true);
    setError('');
    supabase
      .from('ledgers')
      .select('*')
      .eq('id', selectedId)
      .single()
      .then(({ data, error: e }) => {
        setLoadingLedger(false);
        if (e || !data) { setError('Failed to load ledger.'); return; }
        const r = data as Record<string, unknown>;
        const bal = Number(r.opening_balance ?? 0);
        setForm({
          name: String(r.name ?? ''),
          groupId: String(r.ledger_group_id ?? ''),
          openingBalance: Math.abs(bal).toFixed(2),
          balanceType: bal >= 0 ? 'Dr' : 'Cr',
          gstin: String(r.gstin ?? ''),
          phone: String(r.phone ?? ''),
          email: String(r.email ?? ''),
          notes: String(r.notes ?? ''),
        });
      });
  }, [selectedId]);

  const set = (k: keyof FormState, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const gstinValid = useMemo(() => {
    const g = form.gstin.trim();
    return g === '' || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g);
  }, [form.gstin]);

  const filteredLedgers = useMemo(() => {
    const q = ledgerSearch.toLowerCase().trim();
    if (!q) return ledgers;
    return ledgers.filter((l) => l.name.toLowerCase().includes(q) || l.group_label.toLowerCase().includes(q));
  }, [ledgers, ledgerSearch]);

  const handleSave = useCallback(async () => {
    setError('');
    if (!selectedId) { setError('Select a ledger first.'); return; }
    if (!form.name.trim()) {
      setError('Ledger name is required.');
      playTallyError();
      nameRef.current?.focus();
      return;
    }
    if (!form.groupId) {
      setError('Under Group is required.');
      playTallyError();
      return;
    }
    if (!gstinValid) {
      setError('GSTIN format invalid.');
      playTallyError();
      return;
    }

    setSaving(true);
    const id = session?.dealerRowId;
    if (!id) { setSaving(false); return; }

    const bal = parseFloat(form.openingBalance || '0') || 0;
    const signedBal = form.balanceType === 'Dr' ? bal : -bal;

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      ledger_group_id: form.groupId,
      opening_balance: signedBal,
      gstin: form.gstin.trim().toUpperCase() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { error: e } = await supabase.from('ledgers').update(payload).eq('id', selectedId);
    setSaving(false);

    if (e) {
      setError(e.message);
      playTallyError();
      return;
    }

    playTallyAccept();
    await qc.invalidateQueries({ queryKey: ['ledger-pick', id] });
    setSavedFlash(`"${form.name.trim()}" updated.`);
    setTimeout(() => setSavedFlash(''), 4000);
  }, [form, gstinValid, selectedId, session?.dealerRowId, qc]);

  useHotkeys('ctrl+a', (e) => { e.preventDefault(); void handleSave(); }, { enableOnFormTags: true });
  useHotkeys('escape', () => router.push('/tally/masters'), { enableOnFormTags: true });

  useEffect(() => {
    setButtons([
      { label: 'Save (Ctrl+A)', shortcut: 'Ctrl+A', onClick: () => void handleSave() },
      { label: 'Create New', shortcut: 'Alt+C', onClick: () => router.push('/tally/masters/create') },
      { label: 'Back', shortcut: 'Esc', onClick: () => router.push('/tally/masters') },
    ]);
    return () => setButtons([]);
  }, [setButtons, handleSave, router]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      {/* Title */}
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Ledger Alteration
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 border-b border-[#DDDDDD] bg-white px-3 py-1 text-[11px] text-[#666]">
        <Link href="/tally" className="text-[#0D47A1] underline">Gateway</Link>
        <span>›</span>
        <Link href="/tally/masters" className="text-[#0D47A1] underline">Masters</Link>
        <span>›</span>
        <span className="font-semibold text-[#333]">Alter Ledger</span>
        <span className="ml-auto text-[#888]">Ctrl+A Save · Esc Back</span>
      </div>

      <div className="flex flex-1 min-h-0 gap-0">
        {/* LEFT: Ledger list */}
        <div className="flex flex-col border-r border-[#AAAAAA] bg-white" style={{ width: 230 }}>
          <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-2 py-1 text-[11px] font-bold uppercase text-[#1B5E20]">
            Ledgers ({ledgers.length})
          </div>
          <div className="px-1 py-1 border-b border-[#DDDDDD]">
            <input
              type="text"
              placeholder="Search…"
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              className="w-full border border-[#AAAAAA] bg-white px-2 py-[2px] text-[11px] focus:border-[#1B5E20] focus:outline-none"
              style={{ borderRadius: 0 }}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredLedgers.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => router.push(`/tally/masters/alter?id=${l.id}`)}
                className="w-full border-b border-[#EEEEEE] px-2 py-[4px] text-left text-[11px] hover:bg-[#EEF2FF]"
                style={{
                  background: l.id === selectedId ? '#E8F5E9' : undefined,
                  color: l.id === selectedId ? '#1B5E20' : '#333',
                  fontWeight: l.id === selectedId ? 700 : 400,
                  borderRadius: 0,
                }}
              >
                <div className="truncate">{l.name}</div>
                <div className="text-[10px] text-[#888] truncate">{l.group_label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Edit form */}
        <div className="flex-1 overflow-auto">
          {savedFlash ? (
            <div className="mx-3 mt-2 border border-[#2E7D32] bg-[#E8F5E9] px-3 py-2 text-[12px] text-[#1B5E20]">
              ✓ {savedFlash}
            </div>
          ) : null}
          {error ? (
            <div className="mx-3 mt-2 border border-[#C62828] bg-[#FFEBEE] px-3 py-2 text-[12px] text-[#B71C1C]">
              ⚠ {error}
            </div>
          ) : null}

          {!selectedId ? (
            <div className="p-6 text-[#888] text-[13px]">← Select a ledger from the list to alter.</div>
          ) : loadingLedger ? (
            <div className="p-6 text-[#888] text-[13px]">Loading…</div>
          ) : (
            <div className="m-3 border border-[#AAAAAA] bg-white">
              <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1B5E20]">
                Basic Information
              </div>

              <div className="grid grid-cols-[200px_1fr] gap-y-[6px] p-4 text-[12px]">
                <label className="flex items-center text-right justify-end pr-4 font-semibold text-[#333]">
                  Name <span className="text-red-600 ml-0.5">*</span>
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  maxLength={120}
                  className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                  style={{ borderRadius: 0, maxWidth: 400 }}
                />

                <label className="flex items-center text-right justify-end pr-4 font-semibold text-[#333]">
                  Under Group <span className="text-red-600 ml-0.5">*</span>
                </label>
                <select
                  value={form.groupId}
                  onChange={(e) => set('groupId', e.target.value)}
                  className="border border-[#AAAAAA] bg-white px-1 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                  style={{ borderRadius: 0, maxWidth: 300 }}
                >
                  <option value="">— Select Group —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.group_name || g.group_code}</option>
                  ))}
                </select>

                <label className="flex items-center text-right justify-end pr-4 font-semibold text-[#333]">
                  Opening Balance
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.openingBalance}
                    onChange={(e) => set('openingBalance', e.target.value)}
                    className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] tabular-nums focus:border-[#1B5E20] focus:outline-none"
                    style={{ borderRadius: 0, width: 140 }}
                  />
                  <label className="flex items-center gap-1">
                    <input type="radio" name="baltype" value="Dr"
                      checked={form.balanceType === 'Dr'}
                      onChange={() => set('balanceType', 'Dr')} />
                    Dr
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="baltype" value="Cr"
                      checked={form.balanceType === 'Cr'}
                      onChange={() => set('balanceType', 'Cr')} />
                    Cr
                  </label>
                </div>
              </div>

              <div className="border-b border-t border-[#DDDDDD] bg-[#F0F4FF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1B5E20]">
                Optional Details
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-y-[6px] p-4 text-[12px]">
                <label className="flex items-center text-right justify-end pr-4 font-semibold text-[#333]">GSTIN</label>
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={form.gstin}
                    onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className={`border bg-white px-2 py-[3px] text-[12px] uppercase focus:outline-none ${form.gstin && !gstinValid ? 'border-red-400' : 'border-[#AAAAAA]'} focus:border-[#1B5E20]`}
                    style={{ borderRadius: 0, maxWidth: 200 }}
                  />
                  {form.gstin && !gstinValid ? <span className="text-[11px] text-red-600">Invalid GSTIN format</span> : null}
                </div>

                <label className="flex items-center text-right justify-end pr-4 font-semibold text-[#333]">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                  style={{ borderRadius: 0, maxWidth: 200 }}
                />

                <label className="flex items-center text-right justify-end pr-4 font-semibold text-[#333]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="party@example.com"
                  className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                  style={{ borderRadius: 0, maxWidth: 260 }}
                />

                <label className="flex items-start text-right justify-end pt-1 pr-4 font-semibold text-[#333]">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none resize-none"
                  style={{ borderRadius: 0, maxWidth: 360 }}
                />
              </div>

              <div className="flex items-center gap-3 border-t border-[#DDDDDD] bg-[#F9F9F9] px-4 py-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="border border-[#1B5E20] bg-[#1B5E20] px-5 py-1 text-[12px] font-semibold text-white hover:bg-[#2E7D32] disabled:opacity-50"
                  style={{ borderRadius: 0 }}
                >
                  {saving ? 'Saving…' : 'Accept  (Ctrl+A)'}
                </button>
                <Link
                  href="/tally/masters/create"
                  className="border border-[#0D47A1] px-4 py-1 text-[12px] text-[#0D47A1] hover:bg-[#E3F2FD]"
                  style={{ borderRadius: 0 }}
                >
                  Create New
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-2 text-[11px] text-[#888]">
        Ctrl+A — Save · Esc — Back to Masters
      </div>
    </div>
  );
}

export default function TallyMastersAlterPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-[240px] items-center justify-center bg-[#FFF8E7] text-[13px] text-[#666]"
          style={{ fontFeatureSettings: "'tnum' 1" }}
        >
          Loading…
        </div>
      }
    >
      <TallyMastersAlterInner />
    </Suspense>
  );
}
