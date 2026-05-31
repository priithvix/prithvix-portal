'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { useSales } from '@/contexts/SalesContext';
import { useInventory } from '@/contexts/InventoryContext';
import {
  buildBackupJson,
  buildFarmersCsv,
  buildInventoryCsv,
  buildSalesCsv,
  triggerDownload,
} from '@/lib/data-export';

export function useDataExportDownloads() {
  const { farmers, visits } = useData();
  const { sales } = useSales();
  const { items } = useInventory();

  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const farmerNameById = useCallback(() => {
    const m = new Map<string, string>();
    farmers.forEach((f) => m.set(f.id, f.fullName));
    return m;
  }, [farmers]);

  const run = useCallback(
    async (key: string, fn: () => void | Promise<void>) => {
      setLoadingKey(key);
      try {
        await Promise.resolve(fn());
      } catch (e) {
        console.error(e);
        toast.error('Export failed');
      } finally {
        setLoadingKey(null);
      }
    },
    []
  );

  const downloadFarmers = useCallback(() => {
    run('farmers', () => {
      triggerDownload(
        `prithvix_farmers_${new Date().toISOString().slice(0, 10)}.csv`,
        buildFarmersCsv(farmers)
      );
      toast.success('Farmers CSV downloaded');
    });
  }, [run, farmers]);

  const downloadSales = useCallback(() => {
    run('sales', () => {
      triggerDownload(
        `prithvix_sales_${new Date().toISOString().slice(0, 10)}.csv`,
        buildSalesCsv(sales, farmerNameById())
      );
      toast.success('Sales CSV downloaded');
    });
  }, [run, sales, farmerNameById]);

  const downloadInventory = useCallback(() => {
    run('inventory', () => {
      triggerDownload(
        `prithvix_inventory_${new Date().toISOString().slice(0, 10)}.csv`,
        buildInventoryCsv(items)
      );
      toast.success('Inventory CSV downloaded');
    });
  }, [run, items]);

  const downloadBackup = useCallback(() => {
    run('backup', () => {
      const json = buildBackupJson({
        farmers,
        sales,
        items,
        visits,
        exportedAt: new Date().toISOString(),
      });
      triggerDownload(
        `prithvix_backup_${new Date().toISOString().slice(0, 10)}.json`,
        json,
        'application/json'
      );
      toast.success('Backup JSON downloaded');
    });
  }, [run, farmers, sales, items, visits]);

  return {
    downloadFarmers,
    downloadSales,
    downloadInventory,
    downloadBackup,
    isLoading: (k: string) => loadingKey === k,
    isAnyLoading: loadingKey !== null,
  };
}
