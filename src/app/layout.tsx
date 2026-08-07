import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuizFlow — Live Classroom Quiz Competition',
  description: 'Real-time quiz competition platform for teachers and students. Create quizzes, host live games, and compete with power-ups.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
