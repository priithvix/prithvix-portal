'use client';

import { useCallback, useRef, useState } from 'react';
import { playTallyError } from '@/lib/tally-sounds';

type Props = {
  onJsonLoaded: (text: string) => void;
  disabled?: boolean;
};

export function TallyGstr2bUpload({ onJsonLoaded, disabled }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (f: File | null | undefined) => {
      if (!f) return;
      if (!f.name.toLowerCase().endsWith('.json')) {
        playTallyError();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const t = String(reader.result ?? '');
        onJsonLoaded(t);
      };
      reader.readAsText(f);
    },
    [onJsonLoaded]
  );

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        className="w-full cursor-pointer border border-[#AAAAAA] px-3 py-6 text-center text-[13px] text-black outline-none"
        style={{
          borderStyle: 'dashed',
          background: drag ? '#FFEB3B' : '#FFFFFF',
          opacity: disabled ? 0.55 : 1,
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDrag(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
      >
        Drop GSTR-2B JSON here or click to upload
        <span className="mt-1 block text-[11px] text-[#666666]">Accepted: .json from GST portal only</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
