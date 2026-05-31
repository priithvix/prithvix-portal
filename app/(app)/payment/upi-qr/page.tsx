'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Download, Share2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';

export default function UPIQRPage() {
  const { dealer } = useAuth();

  const [upiId, setUpiId] = useState(dealer?.upi_id || '');
  const [amount, setAmount] = useState('');
  const [payeeName, setPayeeName] = useState(dealer?.company_name || '');

  // Generate UPI payment URL
  const generateUPIURL = () => {
    if (!upiId) return '';

    let upiURL = `upi://pay?pa=${encodeURIComponent(upiId)}`;

    if (payeeName) {
      upiURL += `&pn=${encodeURIComponent(payeeName)}`;
    }

    if (amount && parseFloat(amount) > 0) {
      upiURL += `&am=${encodeURIComponent(amount)}`;
      upiURL += `&cu=INR`;
    }

    upiURL += `&tn=${encodeURIComponent('Payment to ' + payeeName)}`;

    return upiURL;
  };

  const upiURL = generateUPIURL();

  const handleDownloadQR = () => {
    const canvas = document.getElementById('upi-qr-code') as HTMLCanvasElement;
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `upi-qr-${dealer?.company_name || 'payment'}.png`;
    link.click();
    toast.success('QR code downloaded');
  };

  const handleShareQR = async () => {
    if (!upiURL) {
      toast.error('Please enter UPI ID');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'UPI Payment QR',
          text: `Scan to pay ${payeeName}`,
          url: upiURL,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(upiURL);
      toast.success('UPI link copied to clipboard');
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          UPI Payment QR Code
        </h1>
        <p className="mt-1 text-muted-foreground">
          Generate QR code for receiving UPI payments
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="upiId">UPI ID *</Label>
              <Input
                id="upiId"
                placeholder="yourname@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Your UPI ID (e.g., 9876543210@paytm)
              </p>
            </div>

            <div>
              <Label htmlFor="payeeName">Payee Name</Label>
              <Input
                id="payeeName"
                placeholder="Shop name"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="amount">Amount (Optional)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave blank for any amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Pre-fill amount or leave empty
              </p>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Generated QR Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upiURL ? (
              <div className="space-y-4">
                <div className="flex justify-center rounded-md bg-white p-6">
                  <QRCodeCanvas
                    id="upi-qr-code"
                    value={upiURL}
                    size={256}
                    level="H"
                    includeMargin
                  />
                </div>

                <div className="space-y-2 text-center">
                  <p className="text-sm font-medium">{payeeName}</p>
                  <p className="text-sm text-muted-foreground">{upiId}</p>
                  {amount && (
                    <p className="text-lg font-bold">₹{parseFloat(amount).toLocaleString('en-IN')}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleDownloadQR} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button onClick={handleShareQR} variant="outline" className="flex-1">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <QrCode className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Enter your UPI ID to generate QR code
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            <li>Enter your UPI ID (registered mobile number or VPA)</li>
            <li>Optionally enter a pre-filled amount</li>
            <li>Download or share the QR code</li>
            <li>Display the QR code at your shop counter</li>
            <li>Customers can scan and pay directly using any UPI app</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supported UPI Apps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1">Google Pay</span>
            <span className="rounded-full bg-muted px-3 py-1">PhonePe</span>
            <span className="rounded-full bg-muted px-3 py-1">Paytm</span>
            <span className="rounded-full bg-muted px-3 py-1">BHIM</span>
            <span className="rounded-full bg-muted px-3 py-1">Amazon Pay</span>
            <span className="rounded-full bg-muted px-3 py-1">And 150+ others</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
