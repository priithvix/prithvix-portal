'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LedgerPickRow } from '@/lib/supabase/reports';

export type TallyLedgerPickerProps = {
  ledgers: LedgerPickRow[];
  valueId: string | null;
  onChange: (row: LedgerPickRow | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function TallyLedgerPicker({
  ledgers,
  valueId,
  onChange,
  disabled,
  placeholder = 'Search ledger…',
}: TallyLedgerPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => ledgers.find((r) => r.id === valueId) ?? null, [ledgers, valueId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return ledgers.slice(0, 80);
    return ledgers.filter(
      (r) =>
        r.name.toLowerCase().includes(t) || r.group_label.toLowerCase().includes(t) || r.id.toLowerCase().includes(t)
    );
  }, [ledgers, q]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [open]);

  const labelDisplay = selected ? `${selected.name} (${selected.group_label})` : '';

  return (
    <div ref={rootRef} className="relative min-w-[16rem] flex-1">
      <input
        disabled={disabled}
        aria-label="Ledger search"
        placeholder={placeholder}
        className="w-full border border-[#AAAAAA] px-1 py-[2px] text-[13px] outline-none focus:bg-[#FFEB3B]"
        style={{ fontFeatureSettings: "'tnum' 1" }}
        value={open ? q : labelDisplay}
        onChange={(e) => {
          setQ(e.target.value);
          if (!open) setOpen(true);
          if (e.target.value === '') onChange(null);
        }}
        onFocus={() => {
          setOpen(true);
          setQ(labelDisplay);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && !disabled ? (
        <ul
          className="absolute left-0 right-0 top-full z-[100] max-h-56 overflow-auto border border-[#AAAAAA] bg-[#FFF8E7] text-[12px]"
          style={{ borderRadius: 0 }}
        >
          {filtered.map((r) => (
            <li
              key={r.id}
              className="cursor-pointer px-2 py-[2px] hover:bg-[#0D47A1] hover:text-white"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(r);
                setOpen(false);
                setQ('');
              }}
            >
              <span className="font-medium">{r.name}</span>
              <span className="ml-2 text-[10px] opacity-80">{r.group_label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
