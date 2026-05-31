'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition } from '@/components/common/PageTransition';
import { ShieldCheck, Plus, Edit, AlertCircle, CheckCircle } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import Link from 'next/link';

interface License {
  id: string;
  type: string;
  number: string;
  issuedBy: string;
  expiryDate: Date | null;
  status: 'active' | 'expiring_soon' | 'expired' | 'not_added';
}

export default function LicensesPage() {
  const { dealer } = useAuth();

  // Get licenses from dealer database record
  const licenses = useMemo<License[]>(() => {
    if (!dealer) return [];

    const result: License[] = [];
    const today = new Date();

    // Helper to determine status
    const getStatus = (expiryDateStr: string | undefined): License['status'] => {
      if (!expiryDateStr) return 'not_added';
      const expiryDate = parseISO(expiryDateStr);
      const daysUntil = differenceInDays(expiryDate, today);
      
      if (daysUntil < 0) return 'expired';
      if (daysUntil <= 90) return 'expiring_soon';
      return 'active';
    };

    // Fertilizer License
    if (dealer.fertilizer_license_number) {
      result.push({
        id: 'fertilizer',
        type: 'Fertilizer License',
        number: dealer.fertilizer_license_number,
        issuedBy: 'Department of Agriculture',
        expiryDate: dealer.fertilizer_license_valid_until ? parseISO(dealer.fertilizer_license_valid_until) : null,
        status: getStatus(dealer.fertilizer_license_valid_until),
      });
    }

    // Pesticide License
    if (dealer.pesticide_license_number) {
      result.push({
        id: 'pesticide',
        type: 'Pesticide License',
        number: dealer.pesticide_license_number,
        issuedBy: 'Department of Agriculture',
        expiryDate: dealer.pesticide_license_valid_until ? parseISO(dealer.pesticide_license_valid_until) : null,
        status: getStatus(dealer.pesticide_license_valid_until),
      });
    }

    // Seed License
    if (dealer.seed_license_number) {
      result.push({
        id: 'seed',
        type: 'Seed License',
        number: dealer.seed_license_number,
        issuedBy: 'State Seed Certification Agency',
        expiryDate: dealer.seed_license_valid_until ? parseISO(dealer.seed_license_valid_until) : null,
        status: getStatus(dealer.seed_license_valid_until),
      });
    }

    // GST Registration
    if (dealer.gstin) {
      result.push({
        id: 'gst',
        type: 'GST Registration',
        number: dealer.gstin,
        issuedBy: 'GST Department',
        expiryDate: null, // GST doesn't expire
        status: 'active',
      });
    }

    return result;
  }, [dealer]);

  const getStatusColor = (status: License['status']) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'expiring_soon':
        return 'default';
      case 'expired':
        return 'destructive';
    }
  };

  const getStatusIcon = (status: License['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'expiring_soon':
        return <AlertCircle className="h-4 w-4" />;
      case 'expired':
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getDaysUntilExpiry = (expiryDate: Date | null) => {
    if (!expiryDate) return null;
    return differenceInDays(expiryDate, new Date());
  };

  return (
    <PageTransition>
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Licenses & Certifications
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage all business licenses and regulatory certifications
          </p>
        </div>
        <Link href="/profile/shop-details">
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Update Licenses
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Licenses</p>
                <p className="text-3xl font-bold">{licenses.length}</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-3xl font-bold text-success">
                  {licenses.filter((l) => l.status === 'active').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <p className="text-3xl font-bold text-warning">
                  {licenses.filter((l) => l.status === 'expiring_soon').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon Alert */}
      {licenses.some((l) => l.status === 'expiring_soon') && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Licenses Expiring Soon
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {licenses.filter((l) => l.status === 'expiring_soon').length} license(s)
                  will expire in the next 90 days. Please renew them to avoid penalties.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Licenses List */}
      <div className="space-y-3">
        {licenses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Licenses Added</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Add your business licenses to ensure compliance and track expiry dates
              </p>
              <Link href="/profile/shop-details">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add License Information
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          licenses.map((license) => (
            <Card key={license.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className={`rounded-full p-3 ${
                      license.status === 'active'
                        ? 'bg-success/10'
                        : license.status === 'expiring_soon'
                        ? 'bg-warning/10'
                        : license.status === 'not_added'
                        ? 'bg-muted'
                        : 'bg-destructive/10'
                    }`}>
                      {getStatusIcon(license.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{license.type}</h3>
                        <Badge variant={getStatusColor(license.status)}>
                          {license.status === 'expiring_soon' && license.expiryDate ? (
                            <>Expires in {getDaysUntilExpiry(license.expiryDate)} days</>
                          ) : license.status === 'active' ? (
                            'Active'
                          ) : license.status === 'expired' ? (
                            'Expired'
                          ) : (
                            'Not Added'
                          )}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        License No: {license.number}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Issued By</p>
                          <p className="text-sm font-medium">{license.issuedBy}</p>
                        </div>
                        {license.expiryDate && (
                          <div>
                            <p className="text-xs text-muted-foreground">Expiry Date</p>
                            <p className="text-sm font-medium">
                              {format(license.expiryDate, 'dd MMM yyyy')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link href="/profile/shop-details">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Footer */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">
            <strong>Important:</strong> Keep all licenses current to ensure legal compliance.
            Upload scanned copies for digital backup. Set reminders for renewal 30 days before expiry.
          </p>
        </CardContent>
      </Card>
    </div>
    </PageTransition>
  );
}
