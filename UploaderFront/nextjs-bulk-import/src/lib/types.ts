export type LogLevel = 'ok' | 'warn' | 'err' | 'info';

export interface LogEntry {
  id: string;
  time: string;
  method: string;
  path: string;
  status?: number | string;
  level: LogLevel;
  meta?: string;
}

export type Phase = 'idle' | 'ready' | 'running' | 'paused' | 'done' | 'error' | 'cancelled';

export type PillLevel = 'on' | 'warn' | 'err' | undefined;

export interface StatusInfo {
  text: string;
  level: PillLevel;
}
