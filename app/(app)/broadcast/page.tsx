'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Users, Filter, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CropCycle } from '@/constants/types';

export default function BroadcastPage() {
  const { farmers } = useData();

  const [message, setMessage] = useState('');
  const [selectedFarmers, setSelectedFarmers] = useState<Set<string>>(new Set());
  const [filterCycle, setFilterCycle] = useState<CropCycle | 'all'>('all');
  const [filterCredit, setFilterCredit] = useState(false);

  const filteredFarmers = useMemo(() => {
    let result = farmers;

    if (filterCycle !== 'all') {
      result = result.filter((f) => f.cropCycle.includes(filterCycle));
    }

    if (filterCredit) {
      result = result.filter((f) => (f.creditLimit || 0) > 0);
    }

    return result;
  }, [farmers, filterCycle, filterCredit]);

  const handleSelectAll = () => {
    if (selectedFarmers.size === filteredFarmers.length) {
      setSelectedFarmers(new Set());
    } else {
      setSelectedFarmers(new Set(filteredFarmers.map((f) => f.id)));
    }
  };

  const handleToggleFarmer = (farmerId: string) => {
    const newSet = new Set(selectedFarmers);
    if (newSet.has(farmerId)) {
      newSet.delete(farmerId);
    } else {
      newSet.add(farmerId);
    }
    setSelectedFarmers(newSet);
  };

  const handleSendBroadcast = () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (selectedFarmers.size === 0) {
      toast.error('Please select at least one farmer');
      return;
    }

    const encodedMessage = encodeURIComponent(message);
    const selectedFarmersList = farmers.filter((f) => selectedFarmers.has(f.id));

    // Open WhatsApp for each farmer (browser will handle opening multiple tabs)
    selectedFarmersList.forEach((farmer, index) => {
      setTimeout(() => {
        window.open(`https://wa.me/91${farmer.mobile}?text=${encodedMessage}`, '_blank');
      }, index * 500); // Stagger to avoid browser blocking
    });

    toast.success(`Opening WhatsApp for ${selectedFarmers.size} farmers`);
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Broadcast Messages
        </h1>
        <p className="mt-1 text-muted-foreground">
          Send WhatsApp messages to multiple farmers
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left - Compose */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Compose Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="message">Message *</Label>
                <textarea
                  id="message"
                  rows={6}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Enter your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {message.length} characters
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md bg-muted p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {selectedFarmers.size} farmer(s) selected
                  </span>
                </div>
                <Button onClick={handleSendBroadcast} disabled={selectedFarmers.size === 0 || !message.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  Send Broadcast
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Farmer Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Recipients</CardTitle>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  <Check className="mr-2 h-4 w-4" />
                  {selectedFarmers.size === filteredFarmers.length ? 'Deselect' : 'Select'} All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {filteredFarmers.map((farmer) => (
                  <div
                    key={farmer.id}
                    className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedFarmers.has(farmer.id)}
                      onCheckedChange={() => handleToggleFarmer(farmer.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{farmer.fullName}</p>
                      <p className="text-sm text-muted-foreground">{farmer.mobile}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right - Filters */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Crop Cycle</Label>
                <div className="mt-2 space-y-2">
                  {['all', 'kharif', 'rabi', 'summer'].map((cycle) => (
                    <div key={cycle} className="flex items-center gap-2">
                      <Checkbox
                        checked={filterCycle === cycle}
                        onCheckedChange={() => setFilterCycle(cycle as CropCycle | 'all')}
                      />
                      <Label className="capitalize">{cycle}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox checked={filterCredit} onCheckedChange={(c) => setFilterCredit(!!c)} />
                <Label>With Credit Only</Label>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium">Filtered Results</p>
                <p className="text-2xl font-bold text-primary">{filteredFarmers.length}</p>
                <p className="text-xs text-muted-foreground">farmers match filters</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-left"
                onClick={() =>
                  setMessage(
                    'Dear farmer, new season stock has arrived. Visit our shop for best quality seeds and fertilizers.'
                  )
                }
              >
                New Stock Arrival
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-left"
                onClick={() =>
                  setMessage(
                    'Reminder: Your credit balance is pending. Please visit our shop to clear dues. Thank you.'
                  )
                }
              >
                Payment Reminder
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-left"
                onClick={() =>
                  setMessage(
                    'Hello! Checking in on your crop progress. Let us know if you need any assistance.'
                  )
                }
              >
                Follow-up Check
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
