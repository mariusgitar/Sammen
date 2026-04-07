import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { sessions } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    code: string;
  };
};

export async function GET(_req: Request, { params }: RouteContext) {
  const code = params.code.toUpperCase();
  const db = getDb();

  const [session] = await db
    .select({
      timerEndsAt: sessions.timerEndsAt,
      timerLabel: sessions.timerLabel,
    })
    .from(sessions)
    .where(eq(sessions.code, code))
    .limit(1);

  return Response.json({
    timerEndsAt: session?.timerEndsAt?.toISOString() ?? null,
    timerLabel: session?.timerLabel ?? null,
  });
}
