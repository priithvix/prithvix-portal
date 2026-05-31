'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  User, Settings, Users, HelpCircle, FileText, Shield, 
  LogOut, Building, Lock, CreditCard, DollarSign, ChevronRight 
} from 'lucide-react';

export default function MorePage() {
  const router = useRouter();
  const { dealer, isDealer, logout } = useAuth();

  const menuItems = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Profile', path: '/profile' },
        { icon: Building, label: 'Shop Details', path: '/profile/shop-details' },
        { icon: Lock, label: 'Change Password', path: '/profile/change-password' },
        { icon: CreditCard, label: 'Subscription', path: '/profile/subscription', dealerOnly: true },
      ],
    },
    {
      title: 'Settings',
      items: [
        { icon: Users, label: 'Staff Management', path: '/staff-management', dealerOnly: true },
        { icon: DollarSign, label: 'Cost Settings', path: '/cost-settings' },
        { icon: Settings, label: 'Invoice Settings', path: '/invoice-settings', dealerOnly: true },
      ],
    },
    {
      title: 'Help & Legal',
      items: [
        { icon: HelpCircle, label: 'Help & Support', path: '/support/help' },
        { icon: FileText, label: 'Terms of Service', path: '/legal/terms' },
        { icon: Shield, label: 'Privacy Policy', path: '/legal/privacy' },
        { icon: FileText, label: 'About', path: '/legal/about' },
      ],
    },
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          More
        </h1>
        <p className="mt-1 text-muted-foreground">
          Account settings and information
        </p>
      </div>

      {/* User Info Card */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {dealer?.owner_name?.substring(0, 2).toUpperCase() || 'DL'}
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold">{dealer?.owner_name || 'Dealer'}</p>
            <p className="text-sm text-muted-foreground">{dealer?.company_name}</p>
            <p className="text-xs text-muted-foreground">{dealer?.mobile}</p>
          </div>
        </div>
      </Card>

      {/* Menu Sections */}
      <div className="space-y-6">
        {menuItems.map((section, index) => (
          <div key={index}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h2>
            <Card>
              <div className="divide-y">
                {section.items.map((item, itemIndex) => {
                  if (item.dealerOnly && !isDealer) return null;

                  const Icon = item.icon;
                  return (
                    <button
                      key={itemIndex}
                      onClick={() => router.push(item.path)}
                      className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* Logout Button */}
      <Button variant="destructive" className="w-full" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>

      {/* App Version */}
      <p className="text-center text-xs text-muted-foreground">
        PrithviX Partner Web v1.0.0
      </p>
    </div>
  );
}
