import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'admin_session';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    maxAge: 0,
    path: '/',
  });

  return response;
}
