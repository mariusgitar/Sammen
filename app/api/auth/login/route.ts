import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'admin_session';
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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
  console.log('Setting cookie with hash:', `${cookieHash.substring(0, 10)}...`);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  const response = NextResponse.json({ ok: true, redirect: '/admin/oversikt' });
  response.cookies.set(ADMIN_COOKIE_NAME, cookieHash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}
