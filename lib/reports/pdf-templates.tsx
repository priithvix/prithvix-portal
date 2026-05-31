'use client';

import { StyleSheet, Text, View } from '@react-pdf/renderer';
import { fmt, fmtDate } from '@/lib/reports/formatters';

export const reportStyles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 30,
  },
  header: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#000',
    paddingBottom: 6,
  },
  shopName: { fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  shopAddress: { fontSize: 8, textAlign: 'center', color: '#444' },
  reportTitle: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginTop: 6 },
  periodLabel: { fontSize: 8, textAlign: 'center', color: '#555' },
  table: { marginTop: 10 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1B5E20',
    color: '#FFF',
    padding: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#CCC',
    padding: 2,
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 0.5,
    borderColor: '#CCC',
    padding: 2,
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#000',
    padding: 3,
    fontWeight: 'bold',
  },
  colLeft: { flex: 1, textAlign: 'left' },
  colRight: { width: 80, textAlign: 'right' },
  footer: { marginTop: 20, fontSize: 7, color: '#888', textAlign: 'center' },
});

export type ReportHeaderShop = {
  name: string;
  address?: string;
  gstin?: string;
};

export function ReportHeaderPdf({
  shop,
  title,
  period,
}: {
  shop: ReportHeaderShop;
  title: string;
  period: string;
}) {
  return (
    <View style={reportStyles.header} fixed>
      <Text style={reportStyles.shopName}>{shop.name}</Text>
      {shop.address ? <Text style={reportStyles.shopAddress}>{shop.address}</Text> : null}
      {shop.gstin ? <Text style={reportStyles.shopAddress}>GSTIN: {shop.gstin}</Text> : null}
      <Text style={reportStyles.reportTitle}>{title}</Text>
      <Text style={reportStyles.periodLabel}>{period}</Text>
    </View>
  );
}

export function FooterGeneratedPdf({ label }: { label: string }) {
  return (
    <Text style={reportStyles.footer} fixed>
      {label} · Generated {fmtDate(new Date())}
    </Text>
  );
}
