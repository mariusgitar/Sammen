'use client';

import { useEffect, useMemo, useState } from 'react';

type TimerBannerProps = {
  timerEndsAt: string | null;
  timerLabel: string | null;
};

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function TimerBanner({ timerEndsAt, timerLabel }: TimerBannerProps) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const label = useMemo(() => timerLabel?.trim() ?? '', [timerLabel]);

  useEffect(() => {
    if (!timerEndsAt) {
      setRemainingMs(0);
      setIsVisible(false);
      const timeout = setTimeout(() => {
        setIsRendered(false);
      }, 500);
      return () => clearTimeout(timeout);
    }

    const end = new Date(timerEndsAt).getTime();

    if (!Number.isFinite(end)) {
      setRemainingMs(0);
      setIsVisible(false);
      setIsRendered(false);
      return;
    }

    const tick = () => {
      const ms = end - Date.now();
      setRemainingMs(ms);

      if (ms > 0) {
        setIsRendered(true);
        setIsVisible(true);
        return;
      }

      setIsVisible(false);
    };

    tick();
    const interval = setInterval(tick, 1_000);
    const timeout = setTimeout(() => {
      setIsRendered(false);
    }, Math.max(end - Date.now(), 0) + 500);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [timerEndsAt]);

  if (!isRendered) {
    return null;
  }

  const isUnderOneMinute = remainingMs > 0 && remainingMs < 60_000;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundColor: '#0f172a', minHeight: '52px' }}
    >
      <div className="mx-auto flex h-[52px] max-w-4xl items-center justify-center gap-4 px-4">
        {label ? <p className="text-sm text-slate-300">{label}</p> : null}
        <p className={`text-sm font-mono font-medium ${isUnderOneMinute ? 'text-red-400' : 'text-white'}`}>
          {formatRemaining(remainingMs)}
        </p>
      </div>
    </div>
  );
}
