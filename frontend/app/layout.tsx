import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskFlow | Modern Task Management with Gmail Notifications',
  description:
    'Collaborative task management web app with Google OAuth 2.0, Supabase PostgreSQL, Flask backend, and automated Gmail notifications.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
