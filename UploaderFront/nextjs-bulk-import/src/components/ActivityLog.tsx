'use client';

import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/lib/types';

interface Props {
  logs: LogEntry[];
  requestCount: number;
  recActive: boolean;
}

export default function ActivityLog({ logs, requestCount, recActive }: Props) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="activity">
      <div className="activity-head">
        <span className="activity-title">
          <span className={`rec-dot${recActive ? ' live' : ''}`}></span> Actividad — requests en vivo
        </span>
        <span className="activity-count">{requestCount} requests</span>
      </div>
      <div className="activity-log" ref={logRef}>
        {logs.length === 0 && (
          <div className="activity-empty">Cada chunk enviado y cada consulta de estado van a aparecer aquí</div>
        )}
        {logs.map((line) => (
          <div className="log-line" key={line.id}>
            <span className="log-time">{line.time}</span>
            <span className={`log-method ${line.method.toLowerCase()}`}>{line.method}</span>
            <span className="log-path">{line.path}</span>
            <span className={`log-status ${line.level}`}>{line.status ?? ''}</span>
            <span className="log-meta">{line.meta || ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
