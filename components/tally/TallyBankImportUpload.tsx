'use client';

import { useCallback, useRef, useState } from 'react';
import { parseCSV, type BankFormat, type ParsedBankLine } from '@/lib/banking/csv-parser';
import { parseOFX } from '@/lib/banking/ofx-parser';

type Props = {
  onParsed: (lines: ParsedBankLine[], format: BankFormat) => void;
  onError?: (msg: string) => void;
};

export function TallyBankImportUpload({ onParsed, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [fmt, setFmt] = useState<BankFormat | 'AUTO'>('AUTO');

  const ingest = useCallback(
    (file: File | null) => {
      if (!file) return;
      const name = file.name.toLowerCase();
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? '');
          if (name.endsWith('.ofx') || name.endsWith('.qfx')) {
            const lines = parseOFX(text);
            onParsed(lines, 'GENERIC');
            return;
          }
          const forced = fmt === 'AUTO' ? undefined : fmt;
          const lines = parseCSV(text, forced);
          onParsed(lines, forced ?? 'GENERIC');
        } catch (e) {
          onError?.(e instanceof Error ? e.message : 'Parse failed');
        }
      };
      reader.onerror = () => onError?.('Read failed');
      reader.readAsText(file, 'UTF-8');
    },
    [fmt, onParsed, onError]
  );

  return (
    <div
      className={`border border-dashed border-[#AAAAAA] bg-white p-4 text-center text-[13px] ${drag ? 'bg-[#FFEB3B]' : ''}`}
      style={{ fontFeatureSettings: "'tnum' 1" }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void ingest(f);
      }}
    >
      <p className="mb-2 font-semibold text-[#1B5E20]">Drop CSV or OFX · or browse</p>
      <button type="button" className="tally-button-bar-btn px-4 py-2" onClick={() => inputRef.current?.click()}>
        Browse
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,.ofx,.qfx"
        className="hidden"
        onChange={(e) => void ingest(e.target.files?.[0] ?? null)}
      />
      <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11px]">
        <span className="self-center text-[#666]">Forced format:</span>
        <select
          className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
          value={fmt}
          aria-label="Bank CSV format override"
          onChange={(e) => setFmt(e.target.value as BankFormat | 'AUTO')}
        >
          <option value="AUTO">AUTO</option>
          <option value="SBI">SBI</option>
          <option value="HDFC">HDFC</option>
          <option value="ICICI">ICICI</option>
          <option value="AXIS">AXIS</option>
          <option value="GENERIC">GENERIC</option>
        </select>
      </div>
    </div>
  );
}
