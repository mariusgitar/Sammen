import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'admin_session';
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

async function getSha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!password || !adminPassword || password !== adminPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const cookieHash = await getSha256Hex(password);
  const response = NextResponse.json({ ok: true, redirect: '/admin/oversikt' });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: cookieHash,
    httpOnly: true,
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
