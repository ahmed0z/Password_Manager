import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import '@vaultsync/ui/styles/global.css';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VaultSync — Secure Password Manager',
  description:
    'Zero-knowledge password and bookmark manager. Your data is encrypted on your device before it ever reaches the cloud.',
  keywords: ['password manager', 'zero knowledge', 'encrypted', 'bookmark sync', 'security'],
  openGraph: {
    title: 'VaultSync — Secure Password Manager',
    description: 'Zero-knowledge password and bookmark manager with cross-platform sync.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
