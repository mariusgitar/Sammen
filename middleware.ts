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

  console.log('Middleware path:', pathname);
  console.log('ADMIN_PASSWORD set:', !!process.env.ADMIN_PASSWORD);

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  console.log('Cookie value exists:', !!sessionCookie);

  const expectedHash = await getSha256Hex(process.env.ADMIN_PASSWORD || '');
  console.log('Cookie:', sessionCookie?.substring(0, 10));
  console.log('Expected:', expectedHash.substring(0, 10));
  console.log('Match:', sessionCookie === expectedHash);

  const isValid = !!sessionCookie && (await isValidCookie(sessionCookie));
  console.log('Cookie valid:', isValid);

  if (!isValid) {
    const loginUrl = new URL('/logg-inn', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/ny', '/ny/:path*', '/api/admin/:path*'],
};
