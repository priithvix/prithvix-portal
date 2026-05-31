'use client';

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { pdf } from '@react-pdf/renderer';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { marginBottom: 16 },
  shopName: { fontSize: 14, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  salutation: { marginTop: 12, marginBottom: 8 },
  body: { marginVertical: 6, lineHeight: 1.4 },
  row: { flexDirection: 'row', marginVertical: 2 },
  cell1: { width: '22%' },
  cell2: { width: '22%' },
  cell3: { width: '22%' },
  cell4: { width: '34%' },
  thead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 4,
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 4,
    fontFamily: 'Helvetica-Bold',
  },
});

export type DunningInvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  balance_due: number;
};

export type DunningLetterProps = {
  farmerName: string;
  invoices: DunningInvoiceRow[];
  shopInfo: {
    name: string;
    address: string;
    gstin?: string | null;
    mobile?: string | null;
  };
  interestAmount: number;
  interestRatePct: number;
};

export function DunningLetterPdfDoc({ farmerName, invoices, shopInfo, interestAmount, interestRatePct }: DunningLetterProps) {
  const totalDue = invoices.reduce((s, i) => s + i.balance_due, 0);
  const today = formatTallyDate(new Date());

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.shopName}>{shopInfo.name}</Text>
          <Text>{shopInfo.address}</Text>
          {shopInfo.gstin ? <Text>GSTIN: {shopInfo.gstin}</Text> : null}
        </View>
        <Text>Date: {today}</Text>
        <Text style={styles.salutation}>Dear {farmerName},</Text>
        <Text style={styles.body}>This is a reminder that the following amounts are outstanding on your account:</Text>

        <View style={styles.thead}>
          <Text style={[styles.cell1, { fontFamily: 'Helvetica-Bold' }]}>Invoice</Text>
          <Text style={[styles.cell2, { fontFamily: 'Helvetica-Bold' }]}>Date</Text>
          <Text style={[styles.cell3, { fontFamily: 'Helvetica-Bold' }]}>Due</Text>
          <Text style={[styles.cell4, { fontFamily: 'Helvetica-Bold', textAlign: 'right' }]}>Due ₹</Text>
        </View>
        {invoices.map((inv) => (
          <View key={inv.id} style={styles.row} wrap={false}>
            <Text style={styles.cell1}>{inv.invoice_number}</Text>
            <Text style={styles.cell2}>{formatTallyDate(inv.invoice_date)}</Text>
            <Text style={styles.cell3}>{formatTallyDate(inv.due_date)}</Text>
            <Text style={[styles.cell4, { textAlign: 'right' }]}>{formatTallyAmount(inv.balance_due)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.cell1}>Total</Text>
          <Text style={styles.cell4}>₹{formatTallyAmount(totalDue)}</Text>
        </View>
        {interestAmount > 0 && (
          <View style={styles.totalRow}>
            <Text style={{ width: '70%' }}>
              Interest @ {interestRatePct}% p.a. (indicative)
            </Text>
            <Text style={{ width: '30%', textAlign: 'right' }}>₹{formatTallyAmount(interestAmount)}</Text>
          </View>
        )}

        <Text style={{ ...styles.body, marginTop: 16 }}>
          Please arrange payment at the earliest.
          {shopInfo.mobile ? ` For queries: ${shopInfo.mobile}.` : ''}
        </Text>
      </Page>
    </Document>
  );
}

export async function downloadDunningLetterPdf(props: DunningLetterProps) {
  const doc = <DunningLetterPdfDoc {...props} />;
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dunning_${props.farmerName.slice(0, 24)}.pdf`;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
