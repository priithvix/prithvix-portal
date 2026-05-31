'use client';

import { Button } from '@/components/ui/button';
import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  variant?: 'default' | 'success' | 'info';
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  variant = 'default' 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon with concentric rings */}
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl scale-150" />
        <div className="relative h-14 w-14 rounded-full bg-gradient-to-br from-muted to-muted/50 border border-border flex items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
        </div>
        {/* Rings */}
        <div className="absolute inset-0 rounded-full border border-border scale-125 opacity-60" />
        <div className="absolute inset-0 rounded-full border border-border scale-150 opacity-30" />
      </div>

      <h3 className="text-sm font-semibold tracking-tight mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs mb-4 leading-relaxed">{description}</p>

      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
