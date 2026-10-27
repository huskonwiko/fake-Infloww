import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Velvet — Independent CRM Studio',
  description:
    'Your independent, locally editable creator CRM. Fictional data. No external account connection.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
