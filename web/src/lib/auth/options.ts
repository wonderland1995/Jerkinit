import type { AuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { recordAuditEvent } from '@/lib/audit';

const credentialsSchema = z.object({
  email: z.string().min(3).email(),
  password: z.string().min(8),
});

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

if (!NEXTAUTH_SECRET) {
  throw new Error('Missing NEXTAUTH_SECRET environment variable.');
}

const ROLE_VALUES = ['user', 'manager', 'admin'] as const;
type Role = (typeof ROLE_VALUES)[number];

export const authOptions: AuthOptions = {
  secret: NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@factory.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const parsed = credentialsSchema.safeParse({
          email: credentials?.email ?? '',
          password: credentials?.password ?? '',
        });

        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();

        const { data: user, error } = await supabaseAdmin
          .from('app_users')
          .select('id, email, full_name, password_hash, role, is_active')
          .eq('email', email)
          .maybeSingle();

        if (error || !user || !user.is_active) {
          console.warn('Failed login attempt for', email, error?.message);
          return null;
        }

        const passwordMatches = await bcrypt.compare(parsed.data.password, user.password_hash);

        if (!passwordMatches) {
          console.warn('Invalid password for', email);
          return null;
        }

        const resolvedRole: Role = ROLE_VALUES.includes((user.role as Role)) ? (user.role as Role) : 'user';
        const forwardedFor = (req?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();

        await recordAuditEvent({
          userId: user.id,
          actorEmail: user.email,
          action: 'auth.login',
          resource: 'user',
          resourceId: user.id,
          metadata: { role: resolvedRole },
          ipAddress: forwardedFor ?? req?.ip ?? null,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
          role: resolvedRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role ?? 'user';
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? 'user';
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;
      }
      return session;
    },
  },
};
