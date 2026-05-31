'use client';

import { useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Download, FileText, Plus, Package, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { downloadExcel, generateFilename } from '@/lib/export';
import { generateFormN, printComplianceForm } from '@/lib/compliance-generator';

export default function FertilizerRegisterPage() {
  const { items: inventoryItems } = useInventory();
  const { dealer } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter fertilizer items
  const fertilizerItems = inventoryItems.filter(
    (item) => item.category === 'fertilizer'
  );

  const filteredItems = fertilizerItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = () => {
    try {
      const exportData = fertilizerItems.map((item) => ({
        'Product Name': item.productName,
        'Brand': item.displayLabel,
        'Company': item.companyName || '-',
        'Pack Size': item.unit,
        'Current Stock': item.stock.toFixed(2),
        'Unit': item.baseUnit,
        'Batch Number': item.batchNumber || '-',
        'Manufacturing Date': item.manufacturingDate || '-',
        'MRP': item.mrp ? `₹${item.mrp.toFixed(2)}` : '-',
        'HSN Code': item.hsnCode || '-',
        'Status': item.stock <= item.reorderLevel ? 'Low Stock' : item.stock <= item.safetyStockBase ? 'Reorder Soon' : 'In Stock',
      }));

      downloadExcel(exportData, generateFilename('fertilizer_register', 'xlsx'), {
        sheetName: 'Fertilizer Register',
      });
      toast.success('Fertilizer register exported successfully');
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
      const html = generateFormN({
        dealer,
        items: inventoryItems,
        reportDate: today,
        month: format(today, 'MMMM'),
        year: format(today, 'yyyy'),
      });

      printComplianceForm(html);
      toast.success('Form N generated successfully');
    } catch (error) {
      toast.error('Failed to generate Form N');
      console.error('[PDF] Error:', error);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Fertilizer Register
          </h1>
          <p className="mt-1 text-muted-foreground">
            Mandatory stock register as per Fertilizer Control Order
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGeneratePDF} variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Form N PDF
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-info bg-info/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <BookOpen className="h-5 w-5 text-info" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Compliance Requirement
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Dealers must maintain a register showing opening stock, purchases, sales, and closing stock
                for each fertilizer brand. This register must be available for inspection by authorities.
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
            placeholder="Search fertilizer products..."
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
          <CardTitle>Fertilizer Stock Register</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                No fertilizer products found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                    <th className="pb-3">Product Name</th>
                    <th className="pb-3">Brand</th>
                    <th className="pb-3">Pack Size</th>
                    <th className="pb-3">Opening Stock</th>
                    <th className="pb-3">Current Stock</th>
                    <th className="pb-3">Unit</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b text-sm">
                      <td className="py-3 font-medium">{item.productName}</td>
                      <td className="py-3 text-muted-foreground">{item.displayLabel}</td>
                      <td className="py-3 text-muted-foreground">{item.unit}</td>
                      <td className="py-3">-</td>
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
            <strong>Note:</strong> This register is automatically maintained based on your inventory transactions.
            Ensure all purchases and sales are recorded accurately. Last updated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
