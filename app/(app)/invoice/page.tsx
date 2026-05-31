'use client';

import { useState, useMemo } from 'react';
import { useSales } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { downloadCSV, generateFilename } from '@/lib/export';
import { printInvoice, downloadInvoicePDF } from '@/lib/invoice-generator';
import { getFinancialYear } from '@/lib/pdf-utils';

export default function InvoicePage() {
  const { sales, salesLoading } = useSales();
  const { farmers } = useData();
  const { dealer } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  // Filter sales by search query
  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const q = searchQuery.toLowerCase();
    return sales.filter((sale) => {
      const farmer = farmers.find((f) => f.id === sale.farmerId);
      return (
        sale.id.toLowerCase().includes(q) ||
        farmer?.fullName.toLowerCase().includes(q) ||
        farmer?.mobile.includes(q)
      );
    });
  }, [sales, farmers, searchQuery]);

  const handleDownloadPDF = async (saleId: string) => {
    if (!dealer) {
      toast.error('Dealer information not available');
      return;
    }

    const sale = sales.find((s) => s.id === saleId);
    if (!sale) {
      toast.error('Sale not found');
      return;
    }

    const farmer = farmers.find((f) => f.id === sale.farmerId);
    if (!farmer) {
      toast.error('Farmer information not found');
      return;
    }

    setDownloading(saleId);
    try {
      // Generate invoice number based on sale date
      const saleDate = new Date(sale.createdAt);
      const financialYear = getFinancialYear(saleDate);
      const sequenceNumber = sales.filter(
        (s) => new Date(s.createdAt) <= saleDate
      ).length;
      const invoiceNumber = `INV/${financialYear}/${String(sequenceNumber).padStart(4, '0')}`;

      downloadInvoicePDF({
        sale,
        dealer,
        farmer,
        invoiceNumber,
      });

      toast.success('Invoice generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate invoice');
    } finally {
      setDownloading(null);
    }
  };

  const handlePrintInvoice = (saleId: string) => {
    if (!dealer) {
      toast.error('Dealer information not available');
      return;
    }

    const sale = sales.find((s) => s.id === saleId);
    if (!sale) {
      toast.error('Sale not found');
      return;
    }

    const farmer = farmers.find((f) => f.id === sale.farmerId);
    if (!farmer) {
      toast.error('Farmer information not found');
      return;
    }

    try {
      // Generate invoice number based on sale date
      const saleDate = new Date(sale.createdAt);
      const financialYear = getFinancialYear(saleDate);
      const sequenceNumber = sales.filter(
        (s) => new Date(s.createdAt) <= saleDate
      ).length;
      const invoiceNumber = `INV/${financialYear}/${String(sequenceNumber).padStart(4, '0')}`;

      printInvoice({
        sale,
        dealer,
        farmer,
        invoiceNumber,
      });
    } catch (error) {
      console.error('Error printing invoice:', error);
      toast.error('Failed to print invoice');
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredSales.map((sale) => {
      const farmer = farmers.find((f) => f.id === sale.farmerId);
      return {
        'Invoice ID': sale.id.slice(0, 8),
        'Date': format(new Date(sale.createdAt), 'dd/MM/yyyy'),
        'Farmer Name': farmer?.fullName || 'N/A',
        'Mobile': farmer?.mobile || 'N/A',
        'Items': sale.items.length,
        'Subtotal': sale.subtotal.toFixed(2),
        'GST': sale.items.reduce((sum, item) => sum + item.lineGstAmount, 0).toFixed(2),
        'Discount': sale.discountAmount.toFixed(2),
        'Final Amount': sale.finalAmount.toFixed(2),
        'Payment Mode': sale.paymentMode.toUpperCase(),
        'Balance Due': sale.balanceDue.toFixed(2),
      };
    });

    downloadCSV(exportData, generateFilename('invoices'), Object.keys(exportData[0]));
    toast.success('Invoices exported successfully');
  };

  if (salesLoading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-12" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Invoices
          </h1>
          <p className="mt-1 text-muted-foreground">
            Generate and download tax invoices for sales
          </p>
        </div>
        {filteredSales.length > 0 && (
          <Button onClick={handleExportCSV} variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by invoice ID, farmer name, or mobile..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Sales List */}
      {filteredSales.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {sales.length === 0 ? 'No sales yet' : 'No sales found'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {sales.length === 0
                ? 'Sales invoices will appear here'
                : 'Try adjusting your search query'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSales.map((sale) => {
            const farmer = farmers.find((f) => f.id === sale.farmerId);
            const isDownloading = downloading === sale.id;

            return (
              <Card key={sale.id}>
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            Invoice #{sale.id.slice(0, 12)}
                          </h3>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {farmer?.fullName || 'Unknown Customer'} •{' '}
                            {format(new Date(sale.createdAt), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="mt-0.5 text-sm font-medium text-foreground">
                            ₹{sale.finalAmount.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Payment</p>
                          <p className="mt-0.5 text-sm font-medium text-foreground capitalize">
                            {sale.paymentMode}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Items</p>
                          <p className="mt-0.5 text-sm font-medium text-foreground">
                            {sale.items.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Due</p>
                          <p className="mt-0.5 text-sm font-medium text-foreground">
                            ₹{sale.balanceDue.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintInvoice(sale.id)}
                        disabled={isDownloading}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPDF(sale.id)}
                        disabled={isDownloading}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {isDownloading ? 'Generating...' : 'Download'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
