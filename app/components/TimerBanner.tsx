'use client';

import { useEffect, useState } from 'react';

export function TimerBanner({ code }: { code: string }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  // Poll timer-APIet
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/delta/${code}/timer`);
        const data = await res.json();
        if (data.timerEndsAt) {
          setEndsAt(new Date(data.timerEndsAt).getTime());
        } else {
          setEndsAt(null);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [code]);

  // Countdown-ticker
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, endsAt - Date.now()));
    }, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt || remaining <= 0) return null;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '52px',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '14px',
          fontWeight: 600,
          color: remaining < 60000 ? '#f87171' : '#ffffff',
        }}
      >
        {display}
      </span>
    </div>
  );
}
