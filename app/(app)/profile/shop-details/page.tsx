'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { differenceInDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building,
  Save,
  Phone,
  Mail,
  Upload,
  Image as ImageIcon,
  FileText,
  MessageCircle,
  Landmark,
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck,
  Download,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { PostgrestError } from '@supabase/supabase-js';

// GSTIN format: 2-digit state code + 10-digit PAN + 1Z + 1 checksum
function validateGSTIN(gstin: string): { valid: boolean; stateCode: string; pan: string; entityType: string } | null {
  if (gstin.length !== 15) return null;
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(gstin)) return null;
  const stateCode = gstin.slice(0, 2);
  const pan = gstin.slice(2, 12);
  const entityChar = gstin[12];
  const entityTypes: Record<string, string> = {
    '1': 'Individual',
    '2': 'Individual',
    '3': 'Individual',
    '4': 'Individual',
    '5': 'Individual',
    '6': 'Individual',
    '7': 'Individual',
    '8': 'Individual',
    '9': 'Individual',
    A: 'AOP/BOI',
    B: 'Body of Individuals',
    C: 'Company',
    F: 'Firm/LLP',
    G: 'Government',
    H: 'HUF',
    J: 'AJP',
    L: 'Local Authority',
    T: 'Trust',
  };
  return { valid: true, stateCode, pan, entityType: entityTypes[entityChar] || 'Registered Person' };
}

function IFSCValidator({ ifsc }: { ifsc: string }) {
  const [info, setInfo] = useState<{ BANK: string; BRANCH: string; CITY: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`https://ifsc.razorpay.com/${ifsc}`)
      .then((r) => r.json())
      .then((data) => {
        setInfo(data);
        setLoading(false);
      })
      .catch(() => {
        setInfo(null);
        setLoading(false);
      });
  }, [ifsc]);

  if (loading) return <p className="text-xs text-muted-foreground">Validating IFSC...</p>;
  if (!info) return <p className="text-xs text-red-500">Invalid IFSC code</p>;
  return (
    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-950/20 rounded p-2 border border-green-200 dark:border-green-800">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      {info.BANK} · {info.BRANCH} · {info.CITY}
    </div>
  );
}

function isMissingColumnError(error: PostgrestError | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === 'PGRST204' ||
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

export default function ShopDetailsPage() {
  const { dealer, refreshDealer } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fertDocRef = useRef<HTMLInputElement>(null);
  const pestDocRef = useRef<HTMLInputElement>(null);
  const seedDocRef = useRef<HTMLInputElement>(null);
  const insDocRef = useRef<HTMLInputElement>(null);

  const [ownerName, setOwnerName] = useState(dealer?.owner_name || '');
  const [shopType, setShopType] = useState(dealer?.shop_type || 'Retailer');
  const [companyName, setCompanyName] = useState(dealer?.company_name || '');
  const [address, setAddress] = useState(dealer?.address || '');
  const [village, setVillage] = useState(dealer?.village || '');
  const [taluka, setTaluka] = useState(dealer?.taluka || '');
  const [district, setDistrict] = useState(dealer?.district || '');
  const [state, setState] = useState(dealer?.state || '');
  const [stateCode, setStateCode] = useState(dealer?.state_code || '');
  const [pinCode, setPinCode] = useState(dealer?.pin_code || '');
  const [mobile, setMobile] = useState(dealer?.mobile || '');
  const [email, setEmail] = useState(dealer?.email || '');
  const [gstin, setGstin] = useState(dealer?.gstin || '');
  const [whatsapp, setWhatsapp] = useState(dealer?.whatsapp_number || '');
  const [altMobile, setAltMobile] = useState(dealer?.alternate_mobile || '');
  const [upiId, setUpiId] = useState(dealer?.upi_id || '');
  const [isComposition, setIsComposition] = useState(dealer?.is_composition_dealer ?? false);

  const [bankName, setBankName] = useState(dealer?.bank_name || '');
  const [bankBranch, setBankBranch] = useState(dealer?.bank_branch || '');
  const [bankAccount, setBankAccount] = useState(dealer?.bank_account_number || '');
  const [ifscCode, setIfscCode] = useState(dealer?.bank_ifsc || '');
  const [accountType, setAccountType] = useState(dealer?.bank_account_type || 'Current');

  const [fertilizerLicense, setFertilizerLicense] = useState(dealer?.fertilizer_license_number || '');
  const [fertilizerLicenseExpiry, setFertilizerLicenseExpiry] = useState(
    dealer?.fertilizer_license_valid_until || '',
  );
  const [pesticideLicense, setPesticideLicense] = useState(dealer?.pesticide_license_number || '');
  const [pesticideLicenseExpiry, setPesticideLicenseExpiry] = useState(
    dealer?.pesticide_license_valid_until || '',
  );
  const [seedLicense, setSeedLicense] = useState(dealer?.seed_license_number || '');
  const [seedLicenseExpiry, setSeedLicenseExpiry] = useState(dealer?.seed_license_valid_until || '');
  const [insecticideLicense, setInsecticideLicense] = useState(dealer?.insecticide_license_number || '');
  const [insecticideLicenseExpiry, setInsecticideLicenseExpiry] = useState(
    dealer?.insecticide_license_valid_until || '',
  );

  const [fertilizerDocUrl, setFertilizerDocUrl] = useState(dealer?.fertilizer_license_doc_url || '');
  const [pesticideDocUrl, setPesticideDocUrl] = useState(dealer?.pesticide_license_doc_url || '');
  const [seedDocUrl, setSeedDocUrl] = useState(dealer?.seed_license_doc_url || '');
  const [insecticideDocUrl, setInsecticideDocUrl] = useState(dealer?.insecticide_license_doc_url || '');

  const [fertilizerReminder, setFertilizerReminder] = useState(dealer?.fertilizer_reminder_enabled ?? false);
  const [pesticideReminder, setPesticideReminder] = useState(dealer?.pesticide_reminder_enabled ?? false);
  const [seedReminder, setSeedReminder] = useState(dealer?.seed_reminder_enabled ?? false);
  const [insecticideReminder, setInsecticideReminder] = useState(
    dealer?.insecticide_reminder_enabled ?? false,
  );

  const [openTime, setOpenTime] = useState(() => formatTimeForInput(dealer?.open_time, '09:00'));
  const [closeTime, setCloseTime] = useState(() => formatTimeForInput(dealer?.close_time, '19:00'));
  const [weeklyOff, setWeeklyOff] = useState<string[]>(dealer?.weekly_off ?? []);
  const [serviceArea, setServiceArea] = useState(dealer?.service_area || '');
  const [deliveryAvailable, setDeliveryAvailable] = useState(dealer?.delivery_available ?? false);

  const [logoUrl, setLogoUrl] = useState(dealer?.shop_logo_url || '');
  const [logoMeta, setLogoMeta] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const completionFields = [
    { label: 'Logo', done: !!logoUrl },
    { label: 'Company Name', done: !!companyName?.trim() },
    { label: 'Address', done: !!address?.trim() },
    { label: 'Mobile', done: !!mobile?.trim() },
    { label: 'Email', done: !!email?.trim() },
    { label: 'GSTIN', done: !!gstin?.trim() },
    { label: 'UPI ID', done: !!upiId?.trim() },
    { label: 'Fertilizer License', done: !!fertilizerLicense?.trim() },
    { label: 'Pesticide License', done: !!pesticideLicense?.trim() },
    { label: 'Seed License', done: !!seedLicense?.trim() },
    { label: 'Bank Account', done: !!bankAccount?.trim() },
    { label: 'Village/District', done: !!(village?.trim() && district?.trim()) },
  ];
  const completionPct = Math.round(
    (completionFields.filter((f) => f.done).length / completionFields.length) * 100,
  );

  const measureLogoFromUrl = useCallback((url: string) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const dim = `${w}×${h}px`;
      setLogoMeta((prev) => {
        if (prev?.includes('MB')) {
          const mbPart = prev.split('·')[0]?.trim() ?? '';
          return `${mbPart} · ${dim}`;
        }
        return dim;
      });
    };
    img.onerror = () => setLogoMeta(null);
    img.src = url;
  }, []);

  useEffect(() => {
    if (logoUrl) measureLogoFromUrl(logoUrl);
    else setLogoMeta(null);
  }, [logoUrl, measureLogoFromUrl]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dealer) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${dealer.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('dealer-logos').upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('dealer-logos').getPublicUrl(fileName);

      const { error: updateError } = await supabase.from('dealers').update({ shop_logo_url: publicUrl }).eq('id', dealer.id);

      if (updateError) throw updateError;

      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('load'));
        img.src = URL.createObjectURL(file);
      });
      setLogoMeta(`${sizeMb}MB · ${img.naturalWidth}×${img.naturalHeight}px`);
      URL.revokeObjectURL(img.src);

      setLogoUrl(publicUrl);
      await refreshDealer();
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!dealer) return;
    setIsUploadingLogo(true);
    try {
      const { error } = await supabase.from('dealers').update({ shop_logo_url: null }).eq('id', dealer.id);
      if (error) throw error;
      setLogoUrl('');
      setLogoMeta(null);
      await refreshDealer();
      toast.success('Logo removed');
    } catch (err) {
      console.error(err);
      toast.error('Could not remove logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  type LicenseDocKind = 'fertilizer' | 'pesticide' | 'seed' | 'insecticide';

  const handleLicenseDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: LicenseDocKind) => {
    const file = e.target.files?.[0];
    if (!file || !dealer) return;

    const ext = file.name.split('.').pop() || 'bin';
    const path = `${dealer.id}/${kind}.${ext}`;

    const { error: upErr } = await supabase.storage.from('license-docs').upload(path, file, { upsert: true });
    if (upErr) {
      console.error(upErr);
      toast.error('Upload failed — check Storage bucket `license-docs` exists');
      e.target.value = '';
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('license-docs').getPublicUrl(path);

    const colMap: Record<LicenseDocKind, string> = {
      fertilizer: 'fertilizer_license_doc_url',
      pesticide: 'pesticide_license_doc_url',
      seed: 'seed_license_doc_url',
      insecticide: 'insecticide_license_doc_url',
    };
    const col = colMap[kind];

    const { error: dbErr } = await supabase.from('dealers').update({ [col]: publicUrl }).eq('id', dealer.id);
    if (dbErr && isMissingColumnError(dbErr)) {
      toast.message('Some new fields will be available after a database update', {
        description: `Column ${col} is not on dealers yet.`,
      });
      e.target.value = '';
      return;
    }
    if (dbErr) {
      toast.error('Could not save document URL');
      e.target.value = '';
      return;
    }

    if (kind === 'fertilizer') setFertilizerDocUrl(publicUrl);
    if (kind === 'pesticide') setPesticideDocUrl(publicUrl);
    if (kind === 'seed') setSeedDocUrl(publicUrl);
    if (kind === 'insecticide') setInsecticideDocUrl(publicUrl);
    await refreshDealer();
    toast.success('License document uploaded');
    e.target.value = '';
  };

  const buildCorePayload = (): Record<string, unknown> => {
    const wa = whatsapp.replace(/\D/g, '').slice(0, 10);
    const alt = altMobile.replace(/\D/g, '').slice(0, 10);
    return {
      company_name: companyName,
      owner_name: ownerName,
      address,
      village,
      taluka,
      district,
      state,
      state_code: stateCode,
      pin_code: pinCode,
      mobile,
      email,
      gstin,
      upi_id: upiId,
      fertilizer_license_number: fertilizerLicense,
      fertilizer_license_valid_until: fertilizerLicenseExpiry || null,
      pesticide_license_number: pesticideLicense,
      pesticide_license_valid_until: pesticideLicenseExpiry || null,
      seed_license_number: seedLicense,
      seed_license_valid_until: seedLicenseExpiry || null,
      ...(wa ? { whatsapp_number: wa, whatsapp: wa } : { whatsapp_number: null, whatsapp: null }),
      ...(alt ? { alternate_mobile: alt } : { alternate_mobile: null }),
    };
  };

  const buildCorePayloadAltNames = (): Record<string, unknown> => {
    const c = buildCorePayload();
    const {
      fertilizer_license_number,
      pesticide_license_number,
      seed_license_number,
      ...rest
    } = c as Record<string, unknown> & {
      fertilizer_license_number?: string;
      pesticide_license_number?: string;
      seed_license_number?: string;
    };
    void fertilizer_license_number;
    void pesticide_license_number;
    void seed_license_number;
    return {
      ...rest,
      fertilizer_license_no: fertilizerLicense || null,
      pesticide_license_no: pesticideLicense || null,
      seed_license_no: seedLicense || null,
    };
  };

  const buildExtendedPayload = (): Record<string, unknown> => ({
    ...buildCorePayload(),
    shop_type: shopType,
    bank_name: bankName || null,
    bank_branch: bankBranch || null,
    bank_account_number: bankAccount || null,
    bank_ifsc: ifscCode || null,
    bank_account_type: accountType || null,
    is_composition_dealer: isComposition,
    insecticide_license_number: insecticideLicense || null,
    insecticide_license_valid_until: insecticideLicenseExpiry || null,
    insecticide_reminder_enabled: insecticideReminder,
    fertilizer_reminder_enabled: fertilizerReminder,
    pesticide_reminder_enabled: pesticideReminder,
    seed_reminder_enabled: seedReminder,
    open_time: openTime || null,
    close_time: closeTime || null,
    weekly_off: weeklyOff,
    service_area: serviceArea || null,
    delivery_available: deliveryAvailable,
  });

  /** Same as extended but license numbers use DB `_no` column names when present */
  const buildExtendedPayloadLicenseNo = (): Record<string, unknown> => {
    const core = buildCorePayload();
    const { fertilizer_license_number, pesticide_license_number, seed_license_number, ...restCore } = core;
    void fertilizer_license_number;
    void pesticide_license_number;
    void seed_license_number;
    return {
      ...restCore,
      fertilizer_license_no: fertilizerLicense || null,
      pesticide_license_no: pesticideLicense || null,
      seed_license_no: seedLicense || null,
      fertilizer_license_valid_until: fertilizerLicenseExpiry || null,
      pesticide_license_valid_until: pesticideLicenseExpiry || null,
      seed_license_valid_until: seedLicenseExpiry || null,
      shop_type: shopType,
      bank_name: bankName || null,
      bank_branch: bankBranch || null,
      bank_account_number: bankAccount || null,
      bank_ifsc: ifscCode || null,
      bank_account_type: accountType || null,
      is_composition_dealer: isComposition,
      insecticide_license_no: insecticideLicense || null,
      insecticide_license_valid_until: insecticideLicenseExpiry || null,
      insecticide_reminder_enabled: insecticideReminder,
      fertilizer_reminder_enabled: fertilizerReminder,
      pesticide_reminder_enabled: pesticideReminder,
      seed_reminder_enabled: seedReminder,
      open_time: openTime || null,
      close_time: closeTime || null,
      weekly_off: weeklyOff,
      service_area: serviceArea || null,
      delivery_available: deliveryAvailable,
    };
  };

  const handleSave = async () => {
    if (!dealer) {
      toast.error('Dealer information not available');
      return;
    }

    if (!companyName?.trim() || !address?.trim() || !village?.trim() || !ownerName?.trim()) {
      toast.error('Please fill in company name, owner name, address, and village');
      return;
    }

    setIsSaving(true);
    try {
      const attempts: Record<string, unknown>[] = [
        buildExtendedPayload(),
        buildExtendedPayloadLicenseNo(),
        buildCorePayloadAltNames(),
        buildCorePayload(),
      ];

      let lastError: PostgrestError | null = null;
      for (let i = 0; i < attempts.length; i++) {
        const { error } = await supabase.from('dealers').update(attempts[i]).eq('id', dealer.id);
        lastError = error;
        if (!error) {
          if (i > 0) {
            toast.message('Some new fields will be available after a database update', {
              description: 'Core shop details were saved. Add missing columns on `dealers` for full profile.',
            });
          }
          await refreshDealer();
          toast.success('Shop details updated successfully');
          return;
        }
        if (!isMissingColumnError(error)) {
          throw error;
        }
      }

      throw lastError;
    } catch (error) {
      console.error('Error updating shop details:', error);
      toast.error('Failed to update shop details');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadUpiQr = () => {
    const svg = document.querySelector('#upi-qr svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'upi-qr.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  function licenseExpiryBadge(expiry: string | undefined) {
    if (!expiry) return null;
    const d = new Date(expiry);
    if (Number.isNaN(d.getTime())) return null;
    const days = differenceInDays(d, new Date());
    return (
      <Badge
        variant={days < 0 ? 'destructive' : days < 30 ? 'destructive' : days < 90 ? 'secondary' : 'default'}
        className="text-xs"
      >
        {days < 0 ? 'EXPIRED' : days < 30 ? `⚠️ ${days}d left` : days < 90 ? `${days}d left` : `✓ Valid · ${days}d`}
      </Badge>
    );
  }

  return (
    <div className="space-y-6 p-4 pb-28 lg:p-6 lg:pb-32">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Shop Details</h1>
        <p className="mt-1 text-muted-foreground">Business identity & compliance hub</p>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="pt-4 pb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Profile Completeness</span>
            <span
              className={cn(
                'text-sm font-bold',
                completionPct === 100 ? 'text-green-500' : completionPct > 60 ? 'text-amber-500' : 'text-red-500',
              )}
            >
              {completionPct}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-500',
                completionPct === 100 ? 'bg-green-500' : completionPct > 60 ? 'bg-amber-400' : 'bg-red-500',
              )}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {completionFields
              .filter((f) => !f.done)
              .slice(0, 4)
              .map((f) => (
                <span key={f.label} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  + {f.label}
                </span>
              ))}
            {completionFields.filter((f) => !f.done).length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{completionFields.filter((f) => !f.done).length - 4} more
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Shop Logo
          </CardTitle>
          <p className="text-sm text-muted-foreground">Square logo (e.g. 512×512) looks best on invoices — max 2MB</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted">
              {logoUrl ? (
                <img src={logoUrl} alt="Shop Logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              {logoMeta && <p className="text-xs text-muted-foreground">{logoMeta}</p>}
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </Button>
                {logoUrl ? (
                  <Button variant="ghost" size="sm" type="button" onClick={handleRemoveLogo} disabled={isUploadingLogo}>
                    Remove Logo
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {logoUrl && (
            <div className="mt-3 rounded border border-dashed border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">Preview on Invoice:</p>
              <div className="flex items-center gap-2 rounded border border-border bg-white p-2 dark:bg-card">
                <img src={logoUrl} alt="logo" className="h-8 w-8 rounded object-contain" />
                <div>
                  <p className="text-xs font-bold text-foreground">{companyName || 'Your Shop Name'}</p>
                  <p className="text-xs text-muted-foreground">
                    {village || 'Village'}, {district || 'District'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Business Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ownerName">Owner / Proprietor Name *</Label>
            <Input
              id="ownerName"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="mt-1.5"
              placeholder="Full name as on license"
            />
            <p className="mt-1 text-xs text-muted-foreground">Name used on compliance registers and invoices</p>
          </div>

          <div>
            <Label htmlFor="companyName">Company Name *</Label>
            <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label>Shop Type</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {['Retailer', 'Wholesaler', 'Distributor'].map((type) => (
                <label
                  key={type}
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors',
                    shopType === type ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="shopType"
                    value={type}
                    checked={shopType === type}
                    onChange={() => setShopType(type)}
                    className="sr-only"
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address *</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1.5" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="village">Village *</Label>
              <Input id="village" value={village} onChange={(e) => setVillage(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="taluka">Taluka</Label>
              <Input id="taluka" value={taluka} onChange={(e) => setTaluka(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="district">District</Label>
              <Input id="district" value={district} onChange={(e) => setDistrict(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" value={state} onChange={(e) => setState(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="stateCode">State Code</Label>
              <Input
                id="stateCode"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="mt-1.5"
                maxLength={2}
                placeholder="27"
              />
              <p className="mt-1 text-sm text-muted-foreground">2-digit GST state code</p>
            </div>
            <div>
              <Label htmlFor="pinCode">PIN Code</Label>
              <Input id="pinCode" value={pinCode} onChange={(e) => setPinCode(e.target.value)} className="mt-1.5" maxLength={6} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="mobile">Mobile</Label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} className="pl-10" maxLength={10} />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="whatsapp">WhatsApp Number</Label>
            <div className="relative mt-1.5">
              <MessageCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="pl-10"
                placeholder="10-digit WhatsApp number"
                maxLength={10}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Used for Broadcast messages to farmers</p>
          </div>

          <div>
            <Label htmlFor="upiId">UPI ID</Label>
            <Input
              id="upiId"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="mt-1.5"
              placeholder="yourname@paytm"
            />
            <p className="mt-1 text-sm text-muted-foreground">Used for payment collection and invoices</p>
          </div>

          {upiId && (
            <div id="upi-qr" className="mt-2 flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-3">
              <QRCodeSVG
                value={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(companyName || 'Merchant')}&cu=INR`}
                size={72}
              />
              <div>
                <p className="text-xs font-semibold text-foreground">UPI QR Code</p>
                <p className="text-xs text-muted-foreground">Farmers can scan to pay directly</p>
                <Button size="sm" variant="outline" className="mt-1.5 h-7 text-xs" type="button" onClick={downloadUpiQr}>
                  <Download className="mr-1 h-3 w-3" /> Download QR
                </Button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="altMobile">Alternate Mobile</Label>
            <Input
              id="altMobile"
              value={altMobile}
              onChange={(e) => setAltMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="mt-1.5"
              maxLength={10}
              placeholder="Staff or manager number"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Tax Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="gstin">GSTIN</Label>
            <Input
              id="gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className="mt-1.5"
              maxLength={15}
              placeholder="22AAAAA0000A1Z5"
            />
            <p className="mt-1 text-sm text-muted-foreground">15-character GST Identification Number</p>
            {gstin.length === 15 &&
              (() => {
                const parsed = validateGSTIN(gstin.toUpperCase());
                return parsed ? (
                  <div className="mt-2 flex items-center gap-2 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-600 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Valid GSTIN · State {parsed.stateCode} · {parsed.entityType} · PAN: {parsed.pan}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-500 dark:border-red-800 dark:bg-red-950/20">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Invalid GSTIN format</span>
                  </div>
                );
              })()}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Composition Scheme Dealer</p>
              <p className="text-xs text-muted-foreground">Registered under GST Composition Scheme (1–6% flat tax, no ITC)</p>
            </div>
            <button
              type="button"
              onClick={() => setIsComposition((prev) => !prev)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                isComposition ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  isComposition ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Bank Account Details
          </CardTitle>
          <p className="text-sm text-muted-foreground">Used for NEFT/RTGS payments and compliance filings</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="mt-1.5"
                placeholder="e.g. State Bank of India"
              />
            </div>
            <div>
              <Label htmlFor="bankBranch">Branch Name</Label>
              <Input
                id="bankBranch"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                className="mt-1.5"
                placeholder="e.g. Pratapgarh Main Branch"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bankAccount">Account Number</Label>
              <Input
                id="bankAccount"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="mt-1.5"
                placeholder="Account number"
                type="text"
              />
            </div>
            <div>
              <Label htmlFor="ifscCode">IFSC Code</Label>
              <Input
                id="ifscCode"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                className="mt-1.5"
                placeholder="SBIN0001234"
                maxLength={11}
              />
            </div>
          </div>
          {ifscCode.length === 11 && <IFSCValidator ifsc={ifscCode} />}
          <div>
            <Label htmlFor="accountType">Account Type</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {['Current', 'Savings', 'OD/CC'].map((type) => (
                <label
                  key={type}
                  className={cn(
                    'flex cursor-pointer items-center justify-center rounded-lg border p-2 text-sm font-medium transition-colors',
                    accountType === type ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="accountType"
                    value={type}
                    checked={accountType === type}
                    onChange={() => setAccountType(type)}
                    className="sr-only"
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            License Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base font-semibold">Fertilizer License</Label>
              {licenseExpiryBadge(fertilizerLicenseExpiry)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                value={fertilizerLicense}
                onChange={(e) => setFertilizerLicense(e.target.value)}
                placeholder="FL/2024/12345"
              />
              <Input
                type="date"
                value={fertilizerLicenseExpiry}
                onChange={(e) => setFertilizerLicenseExpiry(e.target.value)}
              />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                ref={fertDocRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleLicenseDocUpload(e, 'fertilizer')}
              />
              {fertilizerDocUrl ? (
                <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-600 dark:border-green-800 dark:bg-green-950/20">
                  <FileCheck className="h-3.5 w-3.5" /> Document uploaded
                  <a href={fertilizerDocUrl} target="_blank" rel="noreferrer" className="ml-1 underline">
                    View
                  </a>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => fertDocRef.current?.click()}>
                  <Upload className="mr-1.5 h-3 w-3" /> Upload License Document
                </Button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="fertReminder"
                checked={fertilizerReminder}
                onChange={(e) => setFertilizerReminder(e.target.checked)}
                className="h-3.5 w-3.5 rounded"
              />
              <label htmlFor="fertReminder" className="cursor-pointer text-xs text-muted-foreground">
                Remind me 90 days before expiry
              </label>
            </div>
          </div>

          <div className="space-y-3 border-t pt-6">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base font-semibold">Pesticide License</Label>
              {licenseExpiryBadge(pesticideLicenseExpiry)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input value={pesticideLicense} onChange={(e) => setPesticideLicense(e.target.value)} placeholder="PL/2024/12345" />
              <Input
                type="date"
                value={pesticideLicenseExpiry}
                onChange={(e) => setPesticideLicenseExpiry(e.target.value)}
              />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                ref={pestDocRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleLicenseDocUpload(e, 'pesticide')}
              />
              {pesticideDocUrl ? (
                <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-600 dark:border-green-800 dark:bg-green-950/20">
                  <FileCheck className="h-3.5 w-3.5" /> Document uploaded
                  <a href={pesticideDocUrl} target="_blank" rel="noreferrer" className="ml-1 underline">
                    View
                  </a>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => pestDocRef.current?.click()}>
                  <Upload className="mr-1.5 h-3 w-3" /> Upload License Document
                </Button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="pestReminder"
                checked={pesticideReminder}
                onChange={(e) => setPesticideReminder(e.target.checked)}
                className="h-3.5 w-3.5 rounded"
              />
              <label htmlFor="pestReminder" className="cursor-pointer text-xs text-muted-foreground">
                Remind me 90 days before expiry
              </label>
            </div>
          </div>

          <div className="space-y-3 border-t pt-6">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base font-semibold">Seed License</Label>
              {licenseExpiryBadge(seedLicenseExpiry)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input value={seedLicense} onChange={(e) => setSeedLicense(e.target.value)} placeholder="SL/2024/12345" />
              <Input type="date" value={seedLicenseExpiry} onChange={(e) => setSeedLicenseExpiry(e.target.value)} />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                ref={seedDocRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleLicenseDocUpload(e, 'seed')}
              />
              {seedDocUrl ? (
                <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-600 dark:border-green-800 dark:bg-green-950/20">
                  <FileCheck className="h-3.5 w-3.5" /> Document uploaded
                  <a href={seedDocUrl} target="_blank" rel="noreferrer" className="ml-1 underline">
                    View
                  </a>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => seedDocRef.current?.click()}>
                  <Upload className="mr-1.5 h-3 w-3" /> Upload License Document
                </Button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="seedReminder"
                checked={seedReminder}
                onChange={(e) => setSeedReminder(e.target.checked)}
                className="h-3.5 w-3.5 rounded"
              />
              <label htmlFor="seedReminder" className="cursor-pointer text-xs text-muted-foreground">
                Remind me 90 days before expiry
              </label>
            </div>
          </div>

          <div className="space-y-3 border-t pt-6">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base font-semibold">Insecticide License (Form XII)</Label>
              {licenseExpiryBadge(insecticideLicenseExpiry)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                value={insecticideLicense}
                onChange={(e) => setInsecticideLicense(e.target.value)}
                placeholder="INS/2024/12345"
              />
              <Input
                type="date"
                value={insecticideLicenseExpiry}
                onChange={(e) => setInsecticideLicenseExpiry(e.target.value)}
              />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                ref={insDocRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleLicenseDocUpload(e, 'insecticide')}
              />
              {insecticideDocUrl ? (
                <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-600 dark:border-green-800 dark:bg-green-950/20">
                  <FileCheck className="h-3.5 w-3.5" /> Document uploaded
                  <a href={insecticideDocUrl} target="_blank" rel="noreferrer" className="ml-1 underline">
                    View
                  </a>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => insDocRef.current?.click()}>
                  <Upload className="mr-1.5 h-3 w-3" /> Upload License Document
                </Button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="insReminder"
                checked={insecticideReminder}
                onChange={(e) => setInsecticideReminder(e.target.checked)}
                className="h-3.5 w-3.5 rounded"
              />
              <label htmlFor="insReminder" className="cursor-pointer text-xs text-muted-foreground">
                Remind me 90 days before expiry
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Operating Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Shop Timing</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Opens At</Label>
                <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Closes At</Label>
                <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>

          <div>
            <Label>Weekly Off</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setWeeklyOff((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
                  }
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    weeklyOff.includes(day) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="serviceArea">Service Area / Villages Covered</Label>
            <textarea
              id="serviceArea"
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Pratapgarh, Arnod, Pipalda, Khanpur villages"
            />
            <p className="mt-1 text-xs text-muted-foreground">Shown on your dealer profile shared with farmers</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Home Delivery Available</p>
              <p className="text-xs text-muted-foreground">Deliver products to farmer&apos;s village</p>
            </div>
            <button
              type="button"
              onClick={() => setDeliveryAvailable((prev) => !prev)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                deliveryAvailable ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  deliveryAvailable ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-6 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-sm lg:-mx-6 lg:px-6">
        <div className="flex max-w-2xl items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isSaving ? 'Saving changes...' : 'All changes are saved to your account'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={() => window.location.reload()} disabled={isSaving}>
              Discard
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="min-w-[120px]">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeForInput(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const t = String(raw);
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  return fallback;
}
