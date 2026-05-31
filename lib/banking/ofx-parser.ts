import type { ParsedBankLine } from '@/lib/banking/csv-parser';
import { parseBankCsvDate } from '@/lib/banking/csv-parser';

/** Minimal OFX 1.x string parser — no XML dependency */
export function parseOFX(content: string): ParsedBankLine[] {
  const text = content.replace(/\r\n/g, '\n');
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const rows: ParsedBankLine[] = [];
  for (const b of blocks) {
    const chunk = b.split(/<\/STMTTRN>/i)[0] ?? '';
    const pick = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\\n]+)`, 'i').exec(chunk);
      return m?.[1]?.trim() ?? '';
    };
    const dt = pick('DTPOSTED').slice(0, 8) || pick('DTUSER').slice(0, 8);
    let isoDate = '';
    if (dt.length === 8) {
      isoDate = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
    } else isoDate = parseBankCsvDate(pick('FITID') ? pick('FITID') : new Date().toISOString());
    const amt = Number(pick('TRNAMT').replace(/,/g, ''));
    const memo = pick('MEMO') || pick('NAME') || 'OFX txn';
    const fitid = pick('FITID') || '';
    const trntype = pick('TRNTYPE').toUpperCase();
    if (!Number.isFinite(amt) && amt !== 0) continue;
    const debit = amt < 0 ? -amt : trntype === 'DEBIT' ? Math.abs(amt) : 0;
    const credit = amt > 0 ? amt : trntype === 'CREDIT' ? Math.abs(amt) : amt === 0 ? 0 : 0;
    rows.push({
      txn_date: isoDate,
      value_date: null,
      description: memo.slice(0, 500),
      ref_number: fitid.slice(0, 128),
      debit: debit > 0 ? debit : amt < 0 ? -amt : 0,
      credit: credit > 0 ? credit : amt > 0 ? amt : 0,
      balance: null,
    });
  }
  return rows;
}
