import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers/Providers";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { SalesProvider } from "@/contexts/SalesContext";
import { InventoryProvider } from "@/contexts/InventoryContext";
import { AIProvider } from "@/contexts/AIContext";

export const metadata: Metadata = {
  title: "PrithviX Partner",
  description: "PrithviX Partner — Dealer portal for farmer management, sales, inventory & compliance",
  applicationName: "PrithviX Partner",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0F7A3E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased text-sm font-sans">
        <NextTopLoader color="hsl(142, 71%, 45%)" height={2} showSpinner={false} />
        <ThemeProvider>
          <LanguageProvider>
            <QueryProvider>
              <AuthProvider>
                <DataProvider>
                  <SalesProvider>
                    <InventoryProvider>
                      <AIProvider>
                        <Providers>{children}</Providers>
                      </AIProvider>
                    </InventoryProvider>
                  </SalesProvider>
                </DataProvider>
              </AuthProvider>
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          gap={12}
          offset={{ bottom: 24, right: 24 }}
          toastOptions={{
            duration: 4000,
            classNames: {
              toast: 'font-sans',
              title: 'text-sm font-semibold',
              description: 'text-xs',
              success: 'border-success/20 bg-success/10',
              error: 'border-destructive/20 bg-destructive/10',
              warning: 'border-warning/20 bg-warning/10',
            },
          }}
        />
      </body>
    </html>
  );
}
