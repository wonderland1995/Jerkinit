import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

const PUBLIC_PATHS = ['/login', '/api/health', '/api/auth'];
const PUBLIC_FILE = /\.(.*)$/;

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;

    if (pathname === '/login' && req.nextauth?.token) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/login',
    },
    callbacks: {
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl;
        if (
          PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath)) ||
          pathname.startsWith('/_next') ||
          PUBLIC_FILE.test(pathname)
        ) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|sitemap.xml).*)',
  ],
};
