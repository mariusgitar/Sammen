import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { sessions } from '@/db/schema';

type RouteContext = {
  params: {
    code: string;
  };
};

export async function GET(req: Request, { params }: RouteContext) {
  const code = params.code.toUpperCase();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const db = getDb();
      const [session] = await db
        .select({
          timerEndsAt: sessions.timerEndsAt,
          timerLabel: sessions.timerLabel,
        })
        .from(sessions)
        .where(eq(sessions.code, code))
        .limit(1);

      sendEvent({
        timerEndsAt: session?.timerEndsAt?.toISOString() ?? null,
        timerLabel: session?.timerLabel ?? null,
      });

      let lastTimerEndsAt = session?.timerEndsAt?.toISOString() ?? null;

      const interval = setInterval(async () => {
        try {
          const [current] = await db
            .select({
              timerEndsAt: sessions.timerEndsAt,
              timerLabel: sessions.timerLabel,
            })
            .from(sessions)
            .where(eq(sessions.code, code))
            .limit(1);

          const currentEndsAt = current?.timerEndsAt?.toISOString() ?? null;

          if (currentEndsAt !== lastTimerEndsAt) {
            lastTimerEndsAt = currentEndsAt;
            sendEvent({
              timerEndsAt: currentEndsAt,
              timerLabel: current?.timerLabel ?? null,
            });
          }
        } catch {
          // Ignore transient DB errors inside polling loop.
        }
      }, 1_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
