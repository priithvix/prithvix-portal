'use client';

import { Loader2, Download, FileJson, Users, ShoppingCart, Package } from 'lucide-react';
import { PageTransition } from '@/components/common/PageTransition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDataExportDownloads } from '@/hooks/use-data-export';

export default function DataExportPage() {
  const exports = useDataExportDownloads();

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Export your data</h1>
          <p className="mt-1 text-muted-foreground">
            Download CSV backups of your workspace. Data reflects what is already synced in the app.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Farmers
            </CardTitle>
            <CardDescription>
              Name, mobile, location, crop cycles, Aadhaar flag, created date — one row per farmer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={exports.isAnyLoading}
              onClick={() => exports.downloadFarmers()}
              className="w-full sm:w-auto"
            >
              {exports.isLoading('farmers') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download farmers.csv
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Sales
            </CardTitle>
            <CardDescription>
              Date, sale id, farmer name, totals, payment mode, and GST amount derived from line items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={exports.isAnyLoading}
              onClick={() => exports.downloadSales()}
              className="w-full sm:w-auto"
            >
              {exports.isLoading('sales') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download sales.csv
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventory
            </CardTitle>
            <CardDescription>
              Product, company, category, stock, units, reorder level, cost and sale prices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={exports.isAnyLoading}
              onClick={() => exports.downloadInventory()}
              className="w-full sm:w-auto"
            >
              {exports.isLoading('inventory') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download inventory.csv
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Full backup
            </CardTitle>
            <CardDescription>
              JSON bundle: farmers, sales, SKU rows, and visits for archival or migration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={exports.isAnyLoading}
              variant="secondary"
              onClick={() => exports.downloadBackup()}
              className="w-full sm:w-auto"
            >
              {exports.isLoading('backup') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download prithvix_backup.json
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
