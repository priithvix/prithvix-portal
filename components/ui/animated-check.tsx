'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCheckProps {
  checked?: boolean;
  className?: string;
  size?: number;
}

export function AnimatedCheck({ checked = false, className, size = 24 }: AnimatedCheckProps) {
  const pathLength = 20;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('text-success', className)}
    >
      {checked && (
        <motion.path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ strokeDasharray: pathLength }}
        />
      )}
    </svg>
  );
}
