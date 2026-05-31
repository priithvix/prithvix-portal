/**
 * Tally Prime–style XML import envelope (Gateway → Import → Data).
 * Dates: YYYYMMDD. Amounts: Dr positive, Cr negative (ISDEEMEDPOSITIVE convention).
 */

export type TallyVoucherEntry = {
  ledgerName: string;
  drCr: 'Dr' | 'Cr';
  amount: number;
};

export type TallyVoucher = {
  date: string; // YYYYMMDD
  voucherType: string; // PrithviX code e.g. SAL, RCT
  voucherNumber: string;
  narration: string;
  entries: TallyVoucherEntry[];
};

export type TallyLedger = {
  name: string;
  parent: string;
  openingBalance: number;
  drCr: 'Dr' | 'Cr';
  gstin?: string | null;
  address?: string | null;
  state?: string | null;
};

const VOUCHER_TYPE_MAP: Record<string, string> = {
  SAL: 'Sales',
  PUR: 'Purchase',
  RCT: 'Receipt',
  PMT: 'Payment',
  JNL: 'Journal',
  CNT: 'Contra',
  CRN: 'Credit Note',
  DBN: 'Debit Note',
  STJ: 'Stock Journal',
};

export function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtAmount(n: number): string {
  return Math.abs(n).toFixed(2);
}

/** Map DB DR/CR to Tally Dr/Cr */
export function mapDbDrCr(db: string): 'Dr' | 'Cr' {
  const u = String(db || '').toUpperCase();
  return u === 'CR' ? 'Cr' : 'Dr';
}

export function buildTallyXml(companyName: string, vouchers: TallyVoucher[], ledgers: TallyLedger[]): string {
  const tallyType = (code: string) => VOUCHER_TYPE_MAP[code] ?? code;

  const ledgerMastersXml = ledgers
    .map((l) => {
      const obSign = l.drCr === 'Dr' ? '' : '-';
      const ob = `${obSign}${fmtAmount(l.openingBalance)}`;
      return `
    <LEDGER NAME="${escXml(l.name)}" RESERVEDNAME="">
      <PARENT>${escXml(l.parent || 'Primary')}</PARENT>
      <OPENINGBALANCE>${ob}</OPENINGBALANCE>
      ${l.gstin ? `<TAXREGISTRATIONNUMBER>${escXml(l.gstin)}</TAXREGISTRATIONNUMBER>` : ''}
      ${l.state ? `<STATENAME>${escXml(l.state)}</STATENAME>` : ''}
      ${l.address ? `<MAILINGNAME>${escXml(l.address)}</MAILINGNAME>` : ''}
    </LEDGER>`;
    })
    .join('\n');

  const vouchersXml = vouchers
    .map((v) => {
      const vType = tallyType(v.voucherType);
      const inner = v.entries
        .map(
          (e) => `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escXml(e.ledgerName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${e.drCr === 'Dr' ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <AMOUNT>${e.drCr === 'Cr' ? '-' : ''}${fmtAmount(e.amount)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`
        )
        .join('\n');

      return `
    <VOUCHER REMOTEID="" VCHTYPE="${escXml(vType)}" ACTION="Create">
      <DATE>${escXml(v.date)}</DATE>
      <NARRATION>${escXml(v.narration)}</NARRATION>
      <VOUCHERNUMBER>${escXml(v.voucherNumber)}</VOUCHERNUMBER>
      <VOUCHERTYPENAME>${escXml(vType)}</VOUCHERTYPENAME>
      <ALLLEDGERENTRIES.LIST>${inner}
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${ledgerMastersXml}
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${vouchersXml}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
`;
}

/** Legacy minimal preview (headers differ from full import). */
export type TallyXmlVoucherLite = {
  voucherNumber: string;
  voucherType: string;
  date: string;
  amount: number;
  narration?: string;
};

export function buildTallyXmlPreview(companyName: string, vouchers: TallyXmlVoucherLite[]): string {
  const body = vouchers
    .map(
      (v) => `
  <VOUCHER>
    <VOUCHERTYPE>${escXml(v.voucherType)}</VOUCHERTYPE>
    <VOUCHERNUMBER>${escXml(v.voucherNumber)}</VOUCHERNUMBER>
    <DATE>${escXml(v.date)}</DATE>
    <NARRATION>${escXml(v.narration ?? '')}</NARRATION>
    <AMOUNT>${v.amount.toFixed(2)}</AMOUNT>
  </VOUCHER>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>IMPORT</TALLYREQUEST>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES />
    </DESC>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <COMPANY>${escXml(companyName)}</COMPANY>${body}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
`;
}
