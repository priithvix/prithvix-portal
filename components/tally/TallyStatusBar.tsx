'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase/client';

function computeFYDisplay(row: Record<string, unknown>): string | null {
  const start = row.start_date ?? row.fy_start_date ?? row.begin_date;
  const end = row.end_date ?? row.fy_end_date;
  if (typeof start === 'string' && typeof end === 'string') {
    const d0 = new Date(start);
    const d1 = new Date(end);
    const y0 = d0.getFullYear();
    const y1 = d1.getFullYear();
    if (!Number.isNaN(y0) && !Number.isNaN(y1)) {
      return `${y0}-${String(y1).slice(-2)}`;
    }
  }
  const y0 = row.start_year ?? row.fy_start_year ?? row.year_from;
  const y1 = row.end_year ?? row.fy_end_year ?? row.year_to;
  if (typeof y0 === 'number' && typeof y1 === 'number') {
    return `${y0}-${String(y1).slice(-2)}`;
  }
  return null;
}

async function fetchFinancialYearRow(): Promise<Record<string, unknown> | null> {
  const byCurrent = await supabase.from('financial_years').select('*').eq('is_current', true).limit(1).maybeSingle();

  if (!byCurrent.error && byCurrent.data && typeof byCurrent.data === 'object') {
    return byCurrent.data as Record<string, unknown>;
  }

  const byActive = await supabase.from('financial_years').select('*').eq('is_active', true).limit(1).maybeSingle();
  if (!byActive.error && byActive.data && typeof byActive.data === 'object') {
    return byActive.data as Record<string, unknown>;
  }

  const byStart = await supabase
    .from('financial_years')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!byStart.error && byStart.data && typeof byStart.data === 'object') {
    return byStart.data as Record<string, unknown>;
  }

  const byFyStart = await supabase
    .from('financial_years')
    .select('*')
    .order('fy_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!byFyStart.error && byFyStart.data && typeof byFyStart.data === 'object') {
    return byFyStart.data as Record<string, unknown>;
  }

  return null;
}

export function TallyStatusBar() {
  const { session, dealer } = useAuth();
  const today = format(new Date(), 'd-MMM-yyyy');
  const [fyLabel, setFyLabel] = useState<string>('—');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const row = await fetchFinancialYearRow();
      if (cancelled) return;
      if (!row) {
        setFyLabel('—');
        return;
      }
      const formatted = computeFYDisplay(row);
      setFyLabel(formatted ?? '—');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer
      className="flex h-[22px] shrink-0 items-center border-t border-[#AAAAAA] bg-[#E8E8E8] px-[10px] text-[11px]"
      style={{ color: '#333333', gap: '20px' }}
    >
      <span className="font-medium text-[#333333]">{dealer?.company_name ?? '—'}</span>
      <span className="text-[#333333]">|</span>
      <span className="text-[#333333]">
        FY (app): {fyLabel}
      </span>
      <span className="text-[#333333]">|</span>
      <span className="text-[#333333]">
        <span style={{ color: '#555555' }}>Date:</span> {today}
      </span>
      <span className="text-[#333333]">|</span>
      <span className="truncate text-[#333333]">{session?.displayName ?? '—'}</span>
      <span className="ml-auto text-[#333333]" style={{ color: '#555555' }}>
        Q: Quit — Sign out from Partner
      </span>
    </footer>
  );
}
