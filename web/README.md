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

The entire application (pages and API routes) is now behind HTTP Basic authentication that is enforced by `middleware.ts`.

Add the following variables to your `.env.local` (or your deployment environment):

```
BASIC_AUTH_USERNAME=jerkin-admin
BASIC_AUTH_PASSWORD=super-secure-password
# Optional, defaults to "JerkinIt Production"
BASIC_AUTH_REALM=JerkinIt Production
```

- If either `BASIC_AUTH_USERNAME` or `BASIC_AUTH_PASSWORD` is missing the middleware automatically bypasses auth. That can help locally but should never happen in production.
- Requests to `/health` remain public so uptime checks can keep running. Tweak the `PUBLIC_PATH_PREFIXES` constant in `middleware.ts` if you need to allow additional paths.
- Browsers cache Basic-auth credentials for the life of the tab/session, so the SPA can keep calling `/api/*` after a single login prompt.
