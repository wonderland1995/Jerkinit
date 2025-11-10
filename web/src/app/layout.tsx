import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import './globals.css';
import Navbar from '@/components/Navbar';
import { ToastProvider } from '@/components/ToastProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { authOptions } from '@/lib/auth/options';

export const metadata: Metadata = {
  title: 'Jerky Production Management',
  description: 'Production management system for Jerkin it',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body>
        <AuthProvider session={session}>
          <ToastProvider>
            {session ? <Navbar /> : null}
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
