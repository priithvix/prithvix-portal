import { Inter } from 'next/font/google';
import { TallyShell } from '@/components/tally/TallyShell';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export default function TallyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} tally-scope min-h-screen`}>
      <TallyShell>{children}</TallyShell>
    </div>
  );
}
