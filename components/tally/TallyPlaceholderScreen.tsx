'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { playTallyError } from '@/lib/tally-sounds';

export type TallyPlaceholderFeature = {
  hotkey: string;
  label: string;
  href: string;
  /** `live` = navigable; `coming` / `soon` = blocked with error beep (Soon label). */
  status: 'live' | 'coming' | 'soon';
  note?: string;
  action?: 'logout';
};

function isSoon(s: TallyPlaceholderFeature['status']) {
  return s === 'coming' || s === 'soon';
}

type TallyPlaceholderScreenProps = {
  title: string;
  subtitle: string;
  features: TallyPlaceholderFeature[];
};

export function TallyPlaceholderScreen({ title, subtitle, features }: TallyPlaceholderScreenProps) {
  const { logout } = useAuth();

  return (
    <div className="p-0">
      <div
        className="text-center py-[5px] text-[13px] font-semibold tracking-wide text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}
      >
        {title}
      </div>

      <div
        className="px-4 py-[3px] text-[11px] italic"
        style={{
          background: '#F0ECD8',
          borderBottom: '1px solid #CCCCCC',
          color: '#666666',
        }}
      >
        {subtitle}
      </div>

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

        {features.map((f) => {
          if (f.action === 'logout') {
            return (
              <button
                key={`${f.hotkey}-logout`}
                type="button"
                className="group grid w-full px-3 py-[4px] text-left text-[13px]"
                style={{
                  gridTemplateColumns: '40px 1fr 80px',
                  borderBottom: '1px solid #EEEEEE',
                  cursor: 'pointer',
                  color: '#000000',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#0D47A1';
                  (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#000000';
                }}
                onClick={() => logout()}
              >
                <span
                  className="font-bold text-[#1B5E20] group-hover:!text-white"
                  style={{ fontWeight: 700 }}
                >
                  {f.hotkey}:
                </span>
                <span>{f.label}</span>
                <span className="text-right text-[11px]" style={{ color: '#1B5E20', fontWeight: 600 }}>
                  ● Live
                </span>
              </button>
            );
          }

          return (
            <Link
              key={`${f.hotkey}-${f.label}`}
              href={isSoon(f.status) ? '#' : f.href}
              onClick={(e) => {
                if (isSoon(f.status)) {
                  playTallyError();
                  e.preventDefault();
                }
              }}
              className={`group grid w-full px-3 py-[4px] text-[13px] border-b border-[#EEEEEE] ${
                f.status === 'live'
                  ? 'cursor-pointer text-black hover:bg-[#0D47A1] hover:text-white'
                  : 'cursor-default text-[#999999]'
              }`}
              style={{
                gridTemplateColumns: '40px 1fr 80px',
                textDecoration: 'none',
              }}
            >
              <span className="font-bold text-[#1B5E20] group-hover:text-white" style={{ fontWeight: 700 }}>
                {f.hotkey}:
              </span>
              <span>
                {f.label}
                {f.note ? (
                  <span className="mt-0.5 block text-[10px] font-normal not-italic leading-tight text-[#888888] group-hover:text-white">
                    {f.note}
                  </span>
                ) : null}
              </span>
              <span className="text-right text-[11px]">
                {f.status === 'live' ? (
                  <span className="font-semibold text-[#1B5E20] group-hover:text-white">● Live</span>
                ) : (
                  <span className="text-[#AAAAAA]">○ Soon</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="px-4 py-[3px] text-[11px]" style={{ color: '#888888', borderTop: '1px solid #DDDDDD' }}>
        Press the highlighted key to navigate · Live features are ready to use · Soon = under development
      </div>
    </div>
  );
}
