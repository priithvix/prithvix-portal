'use client';

import { useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Download, FileText, Package, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { downloadExcel, generateFilename } from '@/lib/export';
import { generateFormXII, printComplianceForm } from '@/lib/compliance-generator';

export default function PesticideRegisterPage() {
  const { items: inventoryItems } = useInventory();
  const { dealer } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter pesticide items
  const pesticideItems = inventoryItems.filter(
    (item) => item.category === 'pesticide' || item.category === 'insecticide'
  );

  const filteredItems = pesticideItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = () => {
    try {
      const exportData = pesticideItems.map((item) => ({
        'Product Name': item.productName,
        'Technical Name': item.technicalName || '-',
        'Formulation': item.formulation || '-',
        'CIB Reg Number': item.cibRegNumber || '-',
        'Company': item.companyName || '-',
        'Category': item.category,
        'Pack Size': item.displayLabel,
        'Current Stock': item.stock.toFixed(2),
        'Unit': item.baseUnit,
        'Batch Number': item.batchNumber || '-',
        'Manufacturing Date': item.manufacturingDate || '-',
        'Expiry Date': item.expiryDate || '-',
        'MRP': item.mrp ? `₹${item.mrp.toFixed(2)}` : '-',
        'HSN Code': item.hsnCode || '-',
        'Status': item.stock <= item.reorderLevel ? 'Low Stock' : item.stock <= item.safetyStockBase ? 'Reorder Soon' : 'In Stock',
      }));

      downloadExcel(exportData, generateFilename('pesticide_register', 'xlsx'), {
        sheetName: 'Pesticide Register',
      });
      toast.success('Pesticide register exported successfully');
    } catch (error) {
      toast.error('Failed to export register');
      console.error('[Export] Error:', error);
    }
  };

  const handleGeneratePDF = () => {
    if (!dealer) {
      toast.error('Dealer information not available');
      return;
    }

    try {
      const today = new Date();
      const html = generateFormXII({
        dealer,
        items: inventoryItems,
        reportDate: today,
        month: format(today, 'MMMM'),
        year: format(today, 'yyyy'),
      });

      printComplianceForm(html);
      toast.success('Form XII generated successfully');
    } catch (error) {
      toast.error('Failed to generate Form XII');
      console.error('[PDF] Error:', error);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Pesticide Register
          </h1>
          <p className="mt-1 text-muted-foreground">
            Mandatory stock register as per Insecticides Act, 1968
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGeneratePDF} variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Form XII PDF
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Warning Card */}
      <Card className="border-warning bg-warning/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <ShieldAlert className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Regulatory Compliance
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pesticide dealers must maintain detailed records of all transactions including batch numbers,
                manufacturing dates, and expiry dates. This register must be produced for inspection by authorities
                under the Insecticides Act.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Search pesticide products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Register Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pesticide Stock Register</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                No pesticide products found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                    <th className="pb-3">Product Name</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Pack Size</th>
                    <th className="pb-3">Current Stock</th>
                    <th className="pb-3">Unit</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b text-sm">
                      <td className="py-3 font-medium">{item.productName}</td>
                      <td className="py-3">
                        <Badge variant="outline" className="capitalize">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">{item.unit}</td>
                      <td className="py-3 font-semibold">{item.stock.toFixed(2)}</td>
                      <td className="py-3 text-muted-foreground">{item.baseUnit}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            item.stock <= item.reorderLevel
                              ? 'destructive'
                              : item.stock <= item.safetyStockBase
                              ? 'default'
                              : 'outline'
                          }
                        >
                          {item.stock <= item.reorderLevel
                            ? 'Low Stock'
                            : item.stock <= item.safetyStockBase
                            ? 'Reorder Soon'
                            : 'In Stock'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer Note */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">
            <strong>Legal Requirement:</strong> All pesticide dealers must maintain this register as per
            Insecticides Act, 1968 and Insecticides Rules, 1971. Register must be preserved for 2 years.
            Last updated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
