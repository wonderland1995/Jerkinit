import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import LoginForm from '@/components/LoginForm';
import { authOptions } from '@/lib/auth/options';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-gray-100">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Jerkin It Production</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in with your plant credentials.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
