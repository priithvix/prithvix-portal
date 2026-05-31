'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { InventoryItem, ProductMaster } from '@/constants/types';
import { formatTallyAmount } from '@/lib/tally-format';

export type ProductPickRow = {
  id: string;
  productId: string;
  label: string;
  hsn: string;
  gst: number;
  stock: number;
  unit: string;
};

export type TallyProductPickerProps = {
  items: InventoryItem[];
  masters: ProductMaster[];
  valueSkuId: string | null;
  onChange: (row: ProductPickRow | null) => void;
  disabled?: boolean;
};

function toRows(items: InventoryItem[]): ProductPickRow[] {
  return items.map((it) => ({
    id: it.id,
    productId: it.productId,
    label: it.name || it.displayLabel,
    hsn: it.hsnCode ?? '—',
    gst: it.gstPercent ?? 0,
    stock: it.stock,
    unit: it.unit,
  }));
}

export function TallyProductPicker({
  items,
  masters,
  valueSkuId,
  onChange,
  disabled,
}: TallyProductPickerProps) {
  const rows = useMemo(() => toRows(items), [items]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => rows.find((r) => r.id === valueSkuId) ?? null, [rows, valueSkuId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows.slice(0, 50);
    const hit = rows.filter(
      (r) => r.label.toLowerCase().includes(t) || r.hsn.toLowerCase().includes(t)
    );
    if (hit.length > 0) return hit.slice(0, 50);
    return masters
      .filter((m) => m.productName.toLowerCase().includes(t))
      .slice(0, 20)
      .map((m) => ({
        id: `m_${m.id}`,
        productId: m.id,
        label: m.productName,
        hsn: m.hsnCode ?? '—',
        gst: m.gstPercent ?? 0,
        stock: 0,
        unit: m.baseUnit,
      }));
  }, [rows, masters, q]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <input
        disabled={disabled}
        className="w-full border border-[#AAAAAA] px-1 py-[2px] text-[13px] outline-none focus:bg-[#FFEB3B]"
        value={open ? q : selected?.label ?? ''}
        onChange={(e) => {
          setQ(e.target.value);
          if (!open) setOpen(true);
          if (e.target.value === '') onChange(null);
        }}
        onFocus={() => {
          setOpen(true);
          setQ(selected?.label ?? '');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && !disabled ? (
        <ul
          className="absolute left-0 right-0 top-full z-[100] max-h-48 overflow-auto border border-[#AAAAAA] bg-[#FFF8E7] text-[12px]"
          style={{ borderRadius: 0 }}
        >
          {filtered.map((r) => (
            <li
              key={r.id}
              className="cursor-pointer px-2 py-[2px] hover:bg-[#0D47A1] hover:text-white"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({
                  id: r.id.startsWith('m_') ? '' : r.id,
                  productId: r.productId,
                  label: r.label,
                  hsn: r.hsn,
                  gst: r.gst,
                  stock: r.stock,
                  unit: r.unit,
                });
                setOpen(false);
                setQ('');
              }}
            >
              <span className="font-medium text-[#1B5E20]">{r.label}</span>
              <span className="ml-2 tabular-nums">
                HSN {r.hsn} · GST {r.gst}% · Stock {formatTallyAmount(r.stock)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
