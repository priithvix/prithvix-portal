export type BankFormat = 'SBI' | 'HDFC' | 'ICICI' | 'AXIS' | 'PNB' | 'BOB' | 'GENERIC';

type ColumnMap = {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  ref?: string;
};

const BANK_COLUMN_MAPS: Partial<Record<BankFormat, ColumnMap>> & { GENERIC: ColumnMap } = {
  SBI: {
    date: 'Txn Date',
    description: 'Description',
    debit: 'Debit',
    credit: 'Credit',
    balance: 'Balance',
    ref: 'Ref No./Cheque No.',
  },
  HDFC: {
    date: 'Date',
    description: 'Narration',
    debit: 'Withdrawal Amt.',
    credit: 'Deposit Amt.',
    balance: 'Closing Balance',
    ref: 'Chq./Ref.No.',
  },
  ICICI: {
    date: 'Transaction Date',
    description: 'Transaction Remarks',
    debit: 'Withdrawal Amount (INR )',
    credit: 'Deposit Amount (INR )',
    balance: 'Balance (INR )',
    ref: 'S No.',
  },
  AXIS: {
    date: 'Tran Date',
    description: 'PARTICULARS',
    debit: 'DR',
    credit: 'CR',
    balance: 'BAL',
    ref: 'Chq No',
  },
  GENERIC: {
    date: 'date',
    description: 'description',
    debit: 'debit',
    credit: 'credit',
    balance: 'balance',
    ref: 'ref',
  },
};

/** Strip UTF-8 BOM */
function stripBom(s: string): string {
  return s.startsWith('\uFEFF') ? s.slice(1) : s;
}

function normalizeHeader(h: string): string {
  return h.replace(/^\ufeff/, '').trim();
}

/** Parse DD-MM-YYYY, DD/MM/YYYY, DD MMM YYYY variants → ISO yyyy-mm-dd */
export function parseBankCsvDate(raw: string): string {
  const s = raw.trim();
  const isoTry = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoTry) return `${isoTry[1]}-${isoTry[2]}-${isoTry[3]}`;

  const dmySlash = /^(\d{2})[\-/](\d{2})[\-/](\d{4})$/.exec(s);
  if (dmySlash) {
    const [, d, mo, y] = dmySlash;
    return `${y}-${mo}-${d}`;
  }

  const parts = /\b(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{4})\b/.exec(s);
  if (parts) {
    const d = Number(parts[1]);
    const mon = parts[2].slice(0, 1).toUpperCase() + parts[2].slice(1).toLowerCase();
    const ms = Date.parse(`${d} ${mon} ${parts[3]}`);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function parseIndianAmount(raw: unknown): number {
  const s = String(raw ?? '')
    .replace(/[₹]/g, '')
    .replace(/\(([^)]+)\)/, '-$1')
    .replace(/,/g, '')
    .trim();
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export type ParsedBankLine = {
  txn_date: string;
  value_date: string | null;
  description: string;
  ref_number: string | null;
  debit: number;
  credit: number;
  balance?: number | null;
};

export function detectBankFormat(headersIn: string[]): BankFormat {
  const blob = '|' + headersIn.map(normalizeHeader).join('|').toUpperCase().replace(/\s+/g, ' ') + '|';
  const entries = Object.entries(BANK_COLUMN_MAPS).filter(([k]) => k !== 'GENERIC') as [BankFormat, ColumnMap][];
  for (const [fmt] of entries) {
    const map = BANK_COLUMN_MAPS[fmt]!;
    const need = [map.date];
    const hasDate = blob.includes('|' + map.date.toUpperCase() + '|') || blob.includes(map.date.toUpperCase());
    if (need.every(() => hasDate) && /\bDEBIT\b|\bWITHDRAWAL\b|\bDR\b/.test(blob) && /\bCREDIT\b|\bDEPOSIT\b|\bCR\b/.test(blob))
      return fmt;
  }
  if (blob.includes('TRANSACTION DATE')) return 'ICICI';
  return 'GENERIC';
}

export function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i <= line.length; i++) {
    const c = line[i];
    if (i === line.length || ((c === ',' && !inQuotes) || c === undefined)) {
      cells.push(normalizeCell(cur));
      cur = '';
      if (i === line.length) break;
      continue;
    }
    if (c === '"') {
      if (line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else cur += c;
  }
  return cells;
}

function normalizeCell(cell: string): string {
  return cell.replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim();
}

function findHeaderLines(lines: string[]): { hdrIdx: number; headers: string[] } {
  for (let i = 0; i < Math.min(12, lines.length); i++) {
    const ln = lines[i];
    if (/date|txn|tran|posted/i.test(ln) && /\b(debit|credit|dr\b|cr\b|withdraw|deposit)/i.test(ln)) {
      const hs = splitCsvRow(lines[i]).map(normalizeHeader);
      if (hs.filter(Boolean).length >= 4) return { hdrIdx: i, headers: hs };
    }
  }
  const i = Math.min(lines.length - 1, Math.max(0, lines.findIndex(Boolean)));
  const hs = splitCsvRow(lines[i] ?? '').map(normalizeHeader);
  return { hdrIdx: Math.max(i, 0), headers: hs };
}

export function parseCSV(content: string, format?: BankFormat): ParsedBankLine[] {
  const text = stripBom(content.trim());
  const lines = text.split(/\r?\n/).filter((ln) => ln.trim().length > 0);

  const { hdrIdx, headers } = findHeaderLines(lines);
  const fmt = format ?? detectBankFormat(headers);
  const map = BANK_COLUMN_MAPS[fmt] ?? BANK_COLUMN_MAPS.GENERIC!;

  const idx = (hdr: string) => headers.findIndex((h) => h.toLowerCase() === hdr.toLowerCase());

  let di = idx(map.date);
  let dsc = idx(map.description);
  let ddr = idx(map.debit);
  let dcr = idx(map.credit);
  let dbal = idx(map.balance);

  if (fmt === 'GENERIC') {
    if (di < 0) di = 0;
    dsc = dsc >= 0 ? dsc : 1;
    ddr = ddr >= 0 ? ddr : Math.max(headers.length - 2, 0);
    dcr = dcr >= 0 ? dcr : Math.max(headers.length - 1, 1);
    dbal = dbal >= 0 ? dbal : -1;
  }

  const dRef = map.ref ? idx(map.ref!) : -1;

  const out: ParsedBankLine[] = [];

  const safeIdx = () => ddr >= 0 && dcr >= 0 && di >= 0;

  if (!safeIdx()) {
    for (let raw = hdrIdx + 1; raw < lines.length; raw++) {
      const cells = splitCsvRow(lines[raw]);
      if (cells.filter(Boolean).length < 3) continue;
      const amt = parseIndianAmount(cells[cells.length - 1]);
      out.push({
        txn_date: parseBankCsvDate(cells[0] ?? ''),
        value_date: null,
        description: (cells.slice(1, -1).join(' ') || cells[1] || '').slice(0, 500),
        ref_number: null,
        debit: amt < 0 ? -amt : 0,
        credit: amt >= 0 ? amt : 0,
        balance: null,
      });
    }
    return out.filter((l) => l.description.length || l.debit || l.credit);
  }

  for (let r = hdrIdx + 1; r < lines.length; r++) {
    const cells = splitCsvRow(lines[r]);
    if (!cells.some(Boolean)) continue;
    let debit = ddr >= 0 ? parseIndianAmount(cells[ddr]) : 0;
    let credit = dcr >= 0 ? parseIndianAmount(cells[dcr]) : 0;
    const tx = di >= 0 ? cells[di] ?? '' : '';
    const descCell = dsc >= 0 ? (cells[dsc] ?? '').slice(0, 500) : cells.slice(1, ddr).join(' ').slice(0, 500);
    const balRaw = dbal >= 0 ? cells[dbal] : '';
    const bal = balRaw ? parseIndianAmount(balRaw) : null;
    const lineRef = dRef >= 0 ? cells[dRef] ?? '' : '';

    if (!/\d/.test(tx) && debit === 0 && credit === 0) continue;

    if (ddr === dcr && debit > 0 && credit === 0) {
      credit = 0;
    }

    const dr = debit;
    const cr = credit;
    out.push({
      txn_date: parseBankCsvDate(tx || new Date().toISOString()),
      value_date: null,
      description: descCell?.trim() ? descCell : 'Bank line',
      ref_number: lineRef ? lineRef.trim().slice(0, 128) : null,
      debit: dr >= 0 ? dr : 0,
      credit: cr >= 0 ? cr : 0,
      balance: bal,
    });
  }

  return out.filter((l) => l.debit > 0 || l.credit > 0 || l.description.length > 4);
}
