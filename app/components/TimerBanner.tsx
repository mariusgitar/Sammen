'use client';
import { useEffect, useState } from 'react';

export function TimerBanner({ timerEndsAt, timerLabel }: { 
  timerEndsAt: string | null; 
  timerLabel: string | null; 
}) {
  return null;

  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!timerEndsAt) {
      setRemaining(0);
      return;
    }
    const end = new Date(timerEndsAt).getTime();
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timerEndsAt]);

  if (!timerEndsAt || remaining <= 0) return null;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const display = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: '52px', backgroundColor: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      {timerLabel && (
        <span style={{ fontSize: '14px', color: '#94a3b8', marginRight: '12px' }}>
          {timerLabel}
        </span>
      )}
      <span style={{
        fontFamily: 'monospace', fontSize: '14px', fontWeight: 600,
        color: remaining < 60000 ? '#f87171' : '#ffffff'
      }}>
        {display}
      </span>
    </div>
  );
}
