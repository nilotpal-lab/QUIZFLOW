import type { Metadata } from 'next';
import './globals.css';
import { constructMetadata } from '@/quizflow/metadata';

export const metadata: Metadata = constructMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

