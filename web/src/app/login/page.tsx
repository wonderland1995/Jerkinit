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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200 mb-4">
            <span className="text-2xl font-bold text-white">J</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Jerkin It Production</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to access the production system.</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60 border border-gray-100">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
