This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Security

The entire application (UI + APIs) now uses NextAuth credential logins backed by the `app_users` table in Supabase. Access is limited to signed-in operators and every authentication- or data-changing event can be written to `audit_logs`.

1. Configure the required environment variables (for example inside `.env.local`):

   ```
   NEXTAUTH_SECRET=generate-a-long-random-string
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_URL=...
   SUPABASE_SERVICE_KEY=... # or SUPABASE_SERVICE_ROLE_KEY
   ```

2. Create operator accounts by running the helper script (uses the service-role key and stores a bcrypt hash):

   ```bash
   npm run user:create -- --email you@factory.com --name "QA Lead" --role admin
   ```

   Roles can be `user`, `manager`, or `admin`. Multiple accounts can be provisioned the same way or via SQL migrations.

3. Sign in at `/login`. Once authenticated, every protected page becomes available and the `Sign out` button in the navbar revokes the session.

### Audit trails

- All logins are automatically recorded in `audit_logs`.
- Server routes can call `recordAuditEvent` from `src/lib/audit.ts` to capture additional actions. Critical flows such as batch creation/measurements already do this; extend to other APIs as needed.
- Each record includes the user id, email, action label, and optional metadata so you can reconstruct who did what and when.
