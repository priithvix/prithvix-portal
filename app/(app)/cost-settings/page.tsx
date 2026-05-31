'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, DollarSign, Package, Save } from 'lucide-react';
import { toast } from 'sonner';

const LABOUR_RATE_STORAGE_KEY = 'prithvix_labour_rate';

export default function CostSettingsPage() {
  const [labourRate, setLabourRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const savedRate = localStorage.getItem(LABOUR_RATE_STORAGE_KEY);
    if (savedRate) {
      setLabourRate(savedRate);
    }
  }, []);

  const handleSave = () => {
    if (!labourRate || parseFloat(labourRate) <= 0) {
      toast.error('Please enter a valid labour rate');
      return;
    }

    setIsSaving(true);
    try {
      localStorage.setItem(LABOUR_RATE_STORAGE_KEY, labourRate);
      toast.success('Labour rate saved successfully');
    } catch (error) {
      console.error('Error saving labour rate:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Cost Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Configure operational cost parameters
        </p>
      </div>

      <Card className="max-w-2xl border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-5 w-5 text-primary" />
            Product catalog
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To add or manage products, go to{' '}
            <strong className="text-foreground">Inventory</strong> and use the{' '}
            <strong className="text-foreground">Add Product</strong> button (or edit an existing SKU
            with the pencil icon).
          </p>
          <Button asChild className="gap-2">
            <Link href="/inventory">
              Manage products
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Labour Rate Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="labourRate">Daily Labour Rate (₹)</Label>
            <Input
              id="labourRate"
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter daily labour rate..."
              value={labourRate}
              onChange={(e) => setLabourRate(e.target.value)}
              className="mt-1.5"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              This rate is used in daily closing reports for labour cost calculations
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
