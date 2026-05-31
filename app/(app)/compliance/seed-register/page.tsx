'use client';

import { useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sprout, Download, FileText, Package, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { downloadExcel, generateFilename } from '@/lib/export';
import { generateSeedRegister, printComplianceForm } from '@/lib/compliance-generator';

export default function SeedRegisterPage() {
  const { items: inventoryItems } = useInventory();
  const { dealer } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter seed items
  const seedItems = inventoryItems.filter(
    (item) => item.category === 'seeds'
  );

  const filteredItems = seedItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = () => {
    try {
      const exportData = seedItems.map((item) => ({
        'Variety Name': item.displayLabel,
        'Crop': item.cropName || item.productName,
        'Variety': item.variety || '-',
        'Seed Class': item.seedClass || '-',
        'Company': item.companyName || '-',
        'Pack Size': item.unit,
        'Current Stock': item.stock.toFixed(2),
        'Unit': item.baseUnit,
        'Lot Number': item.lotNumber || '-',
        'Batch Number': item.batchNumber || '-',
        'Manufacturing Date': item.manufacturingDate || '-',
        'Germination %': item.germinationPercent ? `${item.germinationPercent}%` : '-',
        'Germination Valid Until': item.germinationValidUpto || '-',
        'MRP': item.mrp ? `₹${item.mrp.toFixed(2)}` : '-',
        'Status': item.stock <= item.reorderLevel ? 'Low Stock' : item.stock <= item.safetyStockBase ? 'Reorder Soon' : 'In Stock',
      }));

      downloadExcel(exportData, generateFilename('seed_register', 'xlsx'), {
        sheetName: 'Seed Register',
      });
      toast.success('Seed register exported successfully');
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
      const html = generateSeedRegister({
        dealer,
        items: inventoryItems,
        reportDate: today,
        month: format(today, 'MMMM'),
        year: format(today, 'yyyy'),
      });

      printComplianceForm(html);
      toast.success('Seed register generated successfully');
    } catch (error) {
      toast.error('Failed to generate seed register');
      console.error('[PDF] Error:', error);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Seed Register
          </h1>
          <p className="mt-1 text-muted-foreground">
            Stock register as per Seeds Act, 1966
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGeneratePDF} variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Seed PDF
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-success bg-success/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Sprout className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Quality Assurance
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Seed dealers must maintain records of certified seeds including variety name, lot number,
                and germination percentage. This ensures quality control and traceability.
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
            placeholder="Search seed varieties..."
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
          <CardTitle>Seed Stock Register</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                No seed products found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                    <th className="pb-3">Variety Name</th>
                    <th className="pb-3">Crop</th>
                    <th className="pb-3">Pack Size</th>
                    <th className="pb-3">Current Stock</th>
                    <th className="pb-3">Unit</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b text-sm">
                      <td className="py-3 font-medium">{item.displayLabel}</td>
                      <td className="py-3 text-muted-foreground">{item.productName}</td>
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
            <strong>Certification:</strong> Ensure all seeds are certified by authorized agencies.
            Maintain lot tags and certificates for inspection. Last updated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
