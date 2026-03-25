import type { Metadata } from 'next';
import { Barlow } from 'next/font/google';

import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-barlow',
});

export const metadata: Metadata = {
  title: 'Sammen',
  description: 'Workshop facilitation tool bootstrap',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb" className={barlow.variable}>
      <body className="bg-[#ffffff] text-[#0f172a] antialiased">{children}</body>
    </html>
  );
}
