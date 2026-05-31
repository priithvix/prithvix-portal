'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupplierRow } from '@/lib/supabase/purchase';

export type TallySupplierPickerProps = {
  suppliers: SupplierRow[];
  valueId: string | null;
  onChange: (s: SupplierRow | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function TallySupplierPicker({
  suppliers,
  valueId,
  onChange,
  disabled,
  placeholder = 'Select supplier…',
}: TallySupplierPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => suppliers.find((s) => s.id === valueId) ?? null,
    [suppliers, valueId]
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return suppliers.slice(0, 40);
    return suppliers
      .filter(
        (s) =>
          s.name.toLowerCase().includes(t) ||
          (s.gstin ?? '').toLowerCase().includes(t) ||
          (s.city ?? '').toLowerCase().includes(t)
      )
      .slice(0, 40);
  }, [suppliers, q]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
      if (e.key === 'ArrowDown' && !open) setOpen(true);
    },
    [open]
  );

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        disabled={disabled}
        className="tally-field-input w-full border border-[#AAAAAA] px-1 py-[2px] text-[13px] outline-none focus:bg-[#FFEB3B]"
        placeholder={placeholder}
        value={open ? q : selected?.name ?? ''}
        onChange={(e) => {
          setQ(e.target.value);
          if (!open) setOpen(true);
          if (e.target.value === '') onChange(null);
        }}
        onFocus={() => {
          setOpen(true);
          setQ(selected?.name ?? '');
        }}
        onKeyDown={onKeyDown}
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && !disabled ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-[var(--z-dropdown,100)] max-h-48 overflow-auto border border-[#AAAAAA] bg-[#FFF8E7] text-[13px] shadow-none"
          style={{ borderRadius: 0 }}
        >
          {filtered.map((s) => (
            <li
              key={s.id}
              role="option"
              className="cursor-pointer px-2 py-[2px] hover:bg-[#0D47A1] hover:text-white"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s);
                setOpen(false);
                setQ('');
              }}
            >
              <span className="font-medium text-[#1B5E20]">{s.name}</span>
              <span className="ml-2 text-[11px] opacity-80">
                {s.gstin ?? '—'} · {s.city ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
