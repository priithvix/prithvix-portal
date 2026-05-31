import confetti from 'canvas-confetti';

/**
 * Celebrate with subtle confetti burst
 */
export function celebrate() {
  confetti({
    particleCount: 30,
    spread: 50,
    origin: { y: 0.7 },
    colors: ['#22c55e', '#16a34a', '#15803d', '#ffffff'],
    disableForReducedMotion: true,
  });
}
