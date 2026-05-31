'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FileText, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

const STORAGE_KEY = 'prithvix_invoice_settings';

interface InvoiceSettings {
  showGST: boolean;
  showLogo: boolean;
  invoicePrefix: string;
  footerText: string;
  logoUrl?: string;
}

const DEFAULT_SETTINGS: InvoiceSettings = {
  showGST: true,
  showLogo: true,
  invoicePrefix: 'INV',
  footerText: 'Thank you for your business',
};

export default function InvoiceSettingsPage() {
  const { dealer, refreshDealer } = useAuth();

  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } else if (dealer) {
        // Try to initialise prefix from dealer name
        const prefix = dealer.company_name
          ? dealer.company_name
              .split(' ')
              .map((w: string) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 4)
          : 'INV';
        setSettings((prev) => ({ ...prev, invoicePrefix: prefix }));
      }
    } catch {
      /* ignore parse errors */
    }
  }, [dealer]);

  const update = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!dealer) {
      toast.error('Dealer information not available');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Always save to localStorage (works without DB migration)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      // 2. Best-effort: try to save to Supabase dealers table
      //    (requires invoice_settings JSONB column — silently ignored if missing)
      try {
        await supabase
          .from('dealers')
          .update({ invoice_settings: settings })
          .eq('id', dealer.id);
      } catch {
        // Column may not exist yet — localStorage copy is sufficient
      }

      toast.success('Invoice settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dealer) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `dealer-${dealer.id}-logo-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from('dealer-assets')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('dealer-assets')
        .getPublicUrl(data.path);

      update('logoUrl', urlData.publicUrl);
      toast.success('Logo uploaded — click Save Settings to apply');
    } catch (error) {
      console.error('Logo upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Invoice Settings</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Customize your invoice appearance and details
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Customization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>Show GST Details</Label>
              <p className="text-sm text-muted-foreground">Display GST breakdown on invoices</p>
            </div>
            <Switch
              checked={settings.showGST}
              onCheckedChange={(v) => update('showGST', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Show Company Logo</Label>
              <p className="text-sm text-muted-foreground">Display your logo on invoices</p>
            </div>
            <Switch
              checked={settings.showLogo}
              onCheckedChange={(v) => update('showLogo', v)}
            />
          </div>

          <div>
            <Label htmlFor="invoicePrefix">Invoice Number Prefix</Label>
            <Input
              id="invoicePrefix"
              value={settings.invoicePrefix}
              onChange={(e) => update('invoicePrefix', e.target.value.toUpperCase())}
              className="mt-1.5"
              maxLength={10}
              placeholder="INV"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Example: {settings.invoicePrefix || 'INV'}-001, {settings.invoicePrefix || 'INV'}-002
            </p>
          </div>

          <div>
            <Label htmlFor="footerText">Invoice Footer Text</Label>
            <Input
              id="footerText"
              value={settings.footerText}
              onChange={(e) => update('footerText', e.target.value)}
              className="mt-1.5"
              placeholder="Thank you for your business"
            />
          </div>

          <div>
            <Label htmlFor="logo">Company Logo</Label>
            {settings.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoUrl}
                alt="Company logo"
                className="mb-2 mt-1.5 h-16 w-auto rounded border border-border object-contain"
              />
            )}
            <div className="mt-1.5">
              <input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('logo')?.click()}
                className="w-full"
                disabled={isUploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? 'Uploading...' : settings.logoUrl ? 'Change Logo' : 'Upload Logo'}
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Max size: 2MB. Recommended: 200x200px PNG or JPG
              </p>
            </div>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed p-6">
            <div className="flex items-start justify-between">
              <div>
                {settings.showLogo && settings.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.logoUrl}
                    alt="logo"
                    className="mb-2 h-12 w-auto object-contain"
                  />
                ) : (
                  <div className="mb-2 text-base font-bold">{dealer?.company_name || 'Your Business'}</div>
                )}
                <p className="text-xs text-muted-foreground">{dealer?.address || 'Address'}</p>
                {settings.showGST && dealer?.gstin && (
                  <p className="text-xs text-muted-foreground">GSTIN: {dealer.gstin}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">Invoice</p>
                <p className="text-xs text-muted-foreground">{settings.invoicePrefix}-001</p>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-3 text-center text-xs text-muted-foreground">
              {settings.footerText}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
