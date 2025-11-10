import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const REALM = process.env.BASIC_AUTH_REALM ?? 'JerkinIt Production';
const USERNAME = process.env.BASIC_AUTH_USERNAME;
const PASSWORD = process.env.BASIC_AUTH_PASSWORD;

const PUBLIC_PATH_PREFIXES = ['/health'];

const unauthorizedResponse = () =>
  new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });

const isPublicPath = (pathname: string) =>
  PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export function middleware(request: NextRequest) {
  // Disable auth automatically if credentials are not configured.
  if (!USERNAME || !PASSWORD) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Basic auth middleware is bypassed because BASIC_AUTH_USERNAME or BASIC_AUTH_PASSWORD is not set.'
      );
    }
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Basic ')) {
    return unauthorizedResponse();
  }

  const encodedCredentials = authorization.split(' ')[1] ?? '';

  let decodedCredentials = '';

  try {
    decodedCredentials = atob(encodedCredentials);
  } catch {
    return unauthorizedResponse();
  }

  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex === -1) {
    return unauthorizedResponse();
  }

  const suppliedUser = decodedCredentials.slice(0, separatorIndex);
  const suppliedPassword = decodedCredentials.slice(separatorIndex + 1);

  if (suppliedUser !== USERNAME || suppliedPassword !== PASSWORD) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|sitemap.xml).*)',
  ],
};
