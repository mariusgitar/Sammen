import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'admin_session';
const PROTECTED_PREFIXES = ['/admin', '/admin/oversikt', '/ny', '/api/admin'];

async function getSha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function isValidCookie(cookieValue: string): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD || '';

  if (!password || !cookieValue) {
    return false;
  }

  const expectedHash = await getSha256Hex(password);
  return cookieValue === expectedHash;
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionCookie || !(await isValidCookie(sessionCookie))) {
    const loginUrl = new URL('/logg-inn', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/ny/:path*', '/admin/:path*', '/vis/:path*', '/api/admin/:path*'],
};
