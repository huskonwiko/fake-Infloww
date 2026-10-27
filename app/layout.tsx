import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './globals.css';
import './reference.css';
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
