import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { Sale } from '@/constants/types';
import { Dealer } from '@/contexts/AuthContext';
import { format } from 'date-fns';

// Register fonts (optional - defaults to Helvetica)
// Font.register({
//   family: 'Inter',
//   src: '/fonts/Inter-Regular.ttf',
// });

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    borderBottomColor: '#0F7A3E',
    paddingBottom: 10,
  },
  shopName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F7A3E',
    marginBottom: 4,
  },
  shopDetails: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  section: {
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
    color: '#333',
  },
  value: {
    width: '70%',
    color: '#666',
  },
  table: {
    marginTop: 15,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderBottom: 1,
    borderBottomColor: '#d1d5db',
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
  },
  col1: { width: '5%', fontSize: 9 },
  col2: { width: '30%', fontSize: 9 },
  col3: { width: '10%', fontSize: 9, textAlign: 'right' },
  col4: { width: '10%', fontSize: 9 },
  col5: { width: '15%', fontSize: 9, textAlign: 'right' },
  col6: { width: '10%', fontSize: 9, textAlign: 'right' },
  col7: { width: '20%', fontSize: 9, textAlign: 'right' },
  totalsSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: 2,
    borderTopColor: '#0F7A3E',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  totalLabel: {
    width: '70%',
    textAlign: 'right',
    paddingRight: 10,
    fontSize: 10,
  },
  totalValue: {
    width: '30%',
    textAlign: 'right',
    fontSize: 10,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTop: 1,
    borderTopColor: '#0F7A3E',
  },
  grandTotalLabel: {
    width: '70%',
    textAlign: 'right',
    paddingRight: 10,
    fontSize: 12,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    width: '30%',
    textAlign: 'right',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F7A3E',
  },
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTop: 1,
    borderTopColor: '#d1d5db',
  },
  footerText: {
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  signature: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '40%',
    borderTop: 1,
    borderTopColor: '#666',
    paddingTop: 8,
    textAlign: 'center',
    fontSize: 9,
  },
});

interface InvoicePDFProps {
  sale: Sale;
  dealer: Dealer;
  farmerName?: string;
  farmerMobile?: string;
  farmerVillage?: string;
}

export const InvoicePDF: React.FC<InvoicePDFProps> = ({
  sale,
  dealer,
  farmerName = 'Customer',
  farmerMobile = '',
  farmerVillage = '',
}) => {
  // Calculate GST amount from items
  const gstAmount = sale.items.reduce(
    (sum, item) => sum + item.lineGstAmount,
    0
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.shopName}>{dealer.company_name}</Text>
          <Text style={styles.shopDetails}>
            {dealer.address}, {dealer.village}, {dealer.taluka}
          </Text>
          <Text style={styles.shopDetails}>
            {dealer.district}, {dealer.state} - {dealer.pin_code}
          </Text>
          <Text style={styles.shopDetails}>
            Mobile: {dealer.mobile} | Email: {dealer.email}
          </Text>
          {dealer.gstin && (
            <Text style={styles.shopDetails}>GSTIN: {dealer.gstin}</Text>
          )}
        </View>

        {/* Invoice Title */}
        <Text style={styles.invoiceTitle}>TAX INVOICE</Text>

        {/* Invoice Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice No:</Text>
            <Text style={styles.value}>{sale.id.slice(0, 12)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>
              {format(new Date(sale.createdAt), 'dd MMM yyyy, hh:mm a')}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Mode:</Text>
            <Text style={styles.value}>
              {sale.paymentMode === 'cash'
                ? 'Cash'
                : sale.paymentMode === 'upi'
                ? 'UPI/Digital'
                : 'Credit'}
            </Text>
          </View>
        </View>

        {/* Customer Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Customer Name:</Text>
            <Text style={styles.value}>{farmerName}</Text>
          </View>
          {farmerMobile && (
            <View style={styles.row}>
              <Text style={styles.label}>Mobile:</Text>
              <Text style={styles.value}>{farmerMobile}</Text>
            </View>
          )}
          {farmerVillage && (
            <View style={styles.row}>
              <Text style={styles.label}>Village:</Text>
              <Text style={styles.value}>{farmerVillage}</Text>
            </View>
          )}
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>#</Text>
            <Text style={styles.col2}>Item</Text>
            <Text style={styles.col3}>Qty</Text>
            <Text style={styles.col4}>Unit</Text>
            <Text style={styles.col5}>Rate</Text>
            <Text style={styles.col6}>GST%</Text>
            <Text style={styles.col7}>Total</Text>
          </View>

          {sale.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.col1}>{index + 1}</Text>
              <Text style={styles.col2}>{item.itemName}</Text>
              <Text style={styles.col3}>{item.quantity}</Text>
              <Text style={styles.col4}>{item.unit}</Text>
              <Text style={styles.col5}>₹{item.priceExGst.toFixed(2)}</Text>
              <Text style={styles.col6}>{item.gstPercent}%</Text>
              <Text style={styles.col7}>
                ₹{item.lineTotalIncGst.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal (Ex GST):</Text>
            <Text style={styles.totalValue}>
              ₹{sale.subtotal.toFixed(2)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST:</Text>
            <Text style={styles.totalValue}>
              ₹{gstAmount.toFixed(2)}
            </Text>
          </View>
          {sale.discountAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount:</Text>
              <Text style={styles.totalValue}>
                -₹{sale.discountAmount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand Total:</Text>
            <Text style={styles.grandTotalValue}>
              ₹{sale.finalAmount.toFixed(2)}
            </Text>
          </View>
          {sale.paymentMode === 'credit' && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Paid:</Text>
                <Text style={styles.totalValue}>
                  ₹{sale.paidAmount.toFixed(2)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Balance Due:</Text>
                <Text style={styles.totalValue}>
                  ₹{sale.balanceDue.toFixed(2)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for your business!
          </Text>
          <Text style={styles.footerText}>
            For queries, contact: {dealer.mobile}
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signature}>
          <View style={styles.signatureBox}>
            <Text>Customer Signature</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Authorized Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
