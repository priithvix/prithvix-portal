'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function PrintPackPage() {
  const { dealer } = useAuth();

  const complianceDocuments = [
    {
      id: 'fertilizer-reg',
      name: 'Fertilizer Stock Register',
      description: 'Complete register as per Fertilizer Control Order',
      route: '/compliance/fertilizer-register',
    },
    {
      id: 'pesticide-reg',
      name: 'Pesticide Stock Register',
      description: 'Complete register as per Insecticides Act, 1968',
      route: '/compliance/pesticide-register',
    },
    {
      id: 'seed-reg',
      name: 'Seed Stock Register',
      description: 'Complete register as per Seeds Act, 1966',
      route: '/compliance/seed-register',
    },
    {
      id: 'licenses',
      name: 'License Information',
      description: 'All valid licenses and certificates',
      route: '/compliance/licenses',
    },
  ];

  const handlePrintAll = () => {
    toast.info('Preparing compliance pack for printing...');
    // Would trigger print of all documents
  };

  const handleDownloadPack = () => {
    toast.info('Generating compliance pack PDF...');
    // Would generate combined PDF
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Compliance Pack
          </h1>
          <p className="mt-1 text-muted-foreground">
            Print or download all compliance documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintAll}>
            <Printer className="mr-2 h-4 w-4" />
            Print All
          </Button>
          <Button onClick={handleDownloadPack}>
            <Download className="mr-2 h-4 w-4" />
            Download Pack
          </Button>
        </div>
      </div>

      {/* Dealer Info */}
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Company Name</p>
            <p className="font-medium">{dealer?.company_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Owner Name</p>
            <p className="font-medium">{dealer?.owner_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Address</p>
            <p className="font-medium">
              {dealer?.address || 'N/A'}, {dealer?.village || ''}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">GSTIN</p>
            <p className="font-medium">{dealer?.gstin || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Mobile</p>
            <p className="font-medium">{dealer?.mobile || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Generated On</p>
            <p className="font-medium">{format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {complianceDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-md border p-4"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-sm text-muted-foreground">{doc.description}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(doc.route, '_blank')}
              >
                View
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            <li>Review each document to ensure all information is accurate and up-to-date</li>
            <li>Click "Print All" to print the entire compliance pack</li>
            <li>Use "Download Pack" to save all documents as a single PDF file</li>
            <li>Keep printed copies readily available for inspection by authorities</li>
            <li>Update registers regularly as transactions occur</li>
            <li>Maintain physical copies for the legally required retention period</li>
          </ol>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card className="border-warning bg-warning/5">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Important:</strong> This compliance pack is generated automatically from your
            business data. Ensure all transactions are recorded accurately in the system. For
            legal advice, consult with a qualified professional.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
