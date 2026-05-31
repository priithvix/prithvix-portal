'use client';

import Image from 'next/image';
import { Sprout } from 'lucide-react';

export interface AuthVisualPanelProps {
  imageSrc: string;
  imageAlt: string;
  headline: string;
  subline: string;
  testimonial?: {
    quote: string;
    author: string;
    role: string;
  };
  badge?: string;
}

export function AuthVisualPanel({
  imageSrc,
  imageAlt,
  headline,
  subline,
  testimonial,
  badge,
}: AuthVisualPanelProps) {
  return (
    <div className="relative hidden min-h-screen w-full flex-col overflow-hidden lg:flex">
      {/* Fallback gradient (visible until image paints; safety net on failure) */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950"
        aria-hidden
      />

      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover"
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-transparent to-emerald-950/30 mix-blend-multiply"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen w-full flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/15 backdrop-blur-md">
            <Sprout className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">PrithviX</p>
            <p className="text-2xs text-white/70">Partner Portal</p>
          </div>
        </div>

        {badge ? (
          <div className="absolute right-12 top-12 z-20">
            <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.15em] backdrop-blur-md">
              {badge}
            </span>
          </div>
        ) : null}

        <div className="max-w-md space-y-6">
          <div>
            <h2 className="mb-2 text-3xl font-semibold leading-tight tracking-tight">{headline}</h2>
            <p className="text-sm leading-relaxed text-white/80">{subline}</p>
          </div>

          {testimonial ? (
            <figure className="rounded-xl border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
              <blockquote>
                <p className="mb-3 text-sm leading-relaxed text-white/95">&ldquo;{testimonial.quote}&rdquo;</p>
              </blockquote>
              <figcaption className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold"
                  aria-hidden
                >
                  {testimonial.author.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold">{testimonial.author}</p>
                  <p className="text-2xs text-white/60">{testimonial.role}</p>
                </div>
              </figcaption>
            </figure>
          ) : null}
        </div>
      </div>
    </div>
  );
}
