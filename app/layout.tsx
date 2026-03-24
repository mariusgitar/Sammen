import type { Metadata } from 'next';

import { Nav } from './components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sammen',
  description: 'Workshop facilitation tool bootstrap',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
