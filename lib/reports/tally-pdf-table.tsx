import React from 'react';
import { Document, Page, pdf, StyleSheet, Text, View } from '@react-pdf/renderer';

export const COMPANY_CONFIG_KEY = 'prithvix_company_config';

export const DEFAULT_PDF_PREPARED_BY = 'PrithviX Accounting Software';

/** Stored by Tally Settings (Company + GST); single JSON in localStorage for MVP. */
export type PrithviXCompanyStoredConfig = {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pin: string;
  gstin: string;
  pan: string;
  fyStartMonth: number;
  fyStartDay: number;
  phone: string;
  email: string;
  defaultGstRate: number;
  compositionScheme: boolean;
  eInvoiceThresholdCr: number;
};

export const defaultCompanyStoredConfig = (): PrithviXCompanyStoredConfig => ({
  companyName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pin: '',
  gstin: '',
  pan: '',
  fyStartMonth: 4,
  fyStartDay: 1,
  phone: '',
  email: '',
  defaultGstRate: 18,
  compositionScheme: false,
  eInvoiceThresholdCr: 5,
});

const GREEN = '#1B5E20';
const GREY = '#666666';
const LIGHT_ROW = '#F9FFF9';
const RED_NEG = '#B71C1C';

const styles = StyleSheet.create({
  page: {
    paddingTop: 86,
    paddingBottom: 44,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: 'Helvetica',
  },
  pageCompact: {
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: 'Helvetica',
  },
  letterhead: {
    position: 'absolute',
    top: 18,
    left: 28,
    right: 28,
    textAlign: 'center',
  },
  coName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  coAddr: { fontSize: 8, color: GREY, marginBottom: 2 },
  coGst: { fontSize: 9, marginBottom: 4 },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: GREEN,
    marginTop: 2,
    marginBottom: 0,
  },
  title: { fontSize: 11, marginTop: 6, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  sub: { fontSize: 8, marginTop: 2, marginBottom: 8, textAlign: 'center', color: GREY },
  hdr: {
    flexDirection: 'row',
    backgroundColor: GREEN,
    color: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 2,
    fontFamily: 'Helvetica-Bold',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.35,
    borderColor: '#CCCCCC',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  rowAlt: { backgroundColor: LIGHT_ROW },
  cell: { flex: 1, paddingHorizontal: 4 },
  cellR: {
    flex: 1,
    paddingHorizontal: 4,
    textAlign: 'right',
    fontFamily: 'Courier',
    fontVariantNumeric: 'tabular-nums',
  },
  cellRNeg: {
    flex: 1,
    paddingHorizontal: 4,
    textAlign: 'right',
    fontFamily: 'Courier',
    fontVariantNumeric: 'tabular-nums',
    color: RED_NEG,
  },
  footBar: {
    position: 'absolute',
    bottom: 22,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: GREY,
  },
  footCenter: { flex: 1, textAlign: 'center', paddingHorizontal: 8 },
  pageNum: {
    position: 'absolute',
    bottom: 10,
    right: 28,
    fontSize: 8,
    color: '#333333',
    fontFamily: 'Helvetica',
  },
});

export type TallyPdfTableSpec = {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  footerNote?: string;
  companyName?: string;
  gstin?: string;
  address?: string;
  reportPeriod?: string;
  preparedBy?: string;
};

function isNegativeAmountDisplay(s: string): boolean {
  const t = s.replace(/[₹,\s\u2009]/g, '').trim();
  if (t.startsWith('-')) return true;
  if (t.startsWith('(') && t.endsWith(')')) return /\d/.test(t);
  return false;
}

/** Reads company block from localStorage for PDF header injection (client only). */
export function getCompanyConfig(): Partial<
  Pick<TallyPdfTableSpec, 'companyName' | 'gstin' | 'address' | 'preparedBy'>
> {
  if (typeof window === 'undefined') {
    return { preparedBy: DEFAULT_PDF_PREPARED_BY };
  }
  try {
    const raw = window.localStorage.getItem(COMPANY_CONFIG_KEY);
    if (!raw) return { preparedBy: DEFAULT_PDF_PREPARED_BY };
    const c = JSON.parse(raw) as Partial<PrithviXCompanyStoredConfig>;
    const line3 = [c.city, c.state, c.pin].filter(Boolean).join(', ');
    const address = [c.addressLine1, c.addressLine2, line3].filter(Boolean).join('\n');
    return {
      companyName: c.companyName || undefined,
      gstin: c.gstin || undefined,
      address: address || undefined,
      preparedBy: DEFAULT_PDF_PREPARED_BY,
    };
  } catch {
    return { preparedBy: DEFAULT_PDF_PREPARED_BY };
  }
}

function mergePdfSpec(spec: TallyPdfTableSpec): TallyPdfTableSpec {
  const fromStore = getCompanyConfig();
  return {
    ...fromStore,
    ...spec,
    preparedBy: spec.preparedBy ?? fromStore.preparedBy ?? DEFAULT_PDF_PREPARED_BY,
  };
}

type TableDocProps = TallyPdfTableSpec & { generatedOn: string };

function TableDoc(spec: TableDocProps) {
  const {
    title,
    subtitle,
    headers,
    rows,
    footerNote,
    companyName,
    gstin,
    address,
    reportPeriod,
    preparedBy,
    generatedOn,
  } = spec;

  const periodLine = reportPeriod ?? subtitle;
  const hasLetterhead = Boolean(companyName || address || gstin);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={hasLetterhead ? styles.page : styles.pageCompact} wrap>
        {hasLetterhead ? (
          <View style={styles.letterhead} fixed>
            {companyName ? <Text style={styles.coName}>{companyName}</Text> : null}
            {address ? <Text style={styles.coAddr}>{address}</Text> : null}
            {gstin ? <Text style={styles.coGst}>GSTIN: {gstin}</Text> : null}
            <View style={styles.rule} />
          </View>
        ) : null}

        <Text style={styles.title}>{title}</Text>
        {periodLine ? <Text style={styles.sub}>{periodLine}</Text> : null}

        <View style={styles.hdr}>
          {headers.map((h, i) => (
            <Text key={`h_${String(i)}`} style={i === headers.length - 1 ? styles.cellR : styles.cell}>
              {h}
            </Text>
          ))}
        </View>
        {rows.map((cells, ri) => (
          <View key={`r_${String(ri)}`} style={ri % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}>
            {cells.map((c, ci) => {
              const isLast = ci === cells.length - 1;
              const neg = isLast && isNegativeAmountDisplay(c);
              const st = isLast ? (neg ? styles.cellRNeg : styles.cellR) : styles.cell;
              return (
                <Text key={`c_${String(ri)}_${String(ci)}`} style={st}>
                  {c}
                </Text>
              );
            })}
          </View>
        ))}

        <View style={styles.footBar} fixed>
          <Text>
            Generated by {preparedBy ?? DEFAULT_PDF_PREPARED_BY} — {generatedOn}
          </Text>
          <Text style={styles.footCenter}>{footerNote ?? ''}</Text>
          <Text>Confidential</Text>
        </View>
        <Text
          style={styles.pageNum}
          fixed
          render={({ pageNumber, totalPages }) => `${String(pageNumber)} / ${String(totalPages)}`}
        />
      </Page>
    </Document>
  );
}

export async function tallyTablePdfBlob(spec: TallyPdfTableSpec): Promise<Blob> {
  const merged = mergePdfSpec(spec);
  const generatedOn = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const el = React.createElement(TableDoc, { ...merged, generatedOn });
  return pdf(el).toBlob();
}

export function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
