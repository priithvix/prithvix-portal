'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = 'hsl(var(--primary))',
  showDots = false,
  className,
}: SparklineProps) {
  const { path, points } = useMemo(() => {
    if (data.length === 0) return { path: '', points: [] };

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = 4;

    const xStep = (width - padding * 2) / (data.length - 1 || 1);
    const yScale = (height - padding * 2) / range;

    const pathData = data
      .map((value, i) => {
        const x = padding + i * xStep;
        const y = height - padding - (value - min) * yScale;
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');

    const pointsData = data.map((value, i) => ({
      x: padding + i * xStep,
      y: height - padding - (value - min) * yScale,
    }));

    return { path: pathData, points: pointsData };
  }, [data, width, height]);

  if (data.length === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      {/* Animated path */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Optional dots */}
      {showDots &&
        points.map((point, i) => (
          <motion.circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={2}
            fill={color}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          />
        ))}
    </svg>
  );
}
