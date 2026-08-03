'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtBytes } from '@/lib/format';
import type { LogEntry, Phase, StatusInfo } from '@/lib/types';

const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
const POLL_MS = 900;
const MAX_LOG_LINES = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Controla un único upload+import. Cada tarjeta de la cola (UploadJobCard)
 * crea su propia instancia de este hook, así que N archivos = N instancias
 * corriendo en paralelo, cada una con su propio uploadId, polling y log.
 */
export function useBulkImport(file: File, apiBase: string) {
  // ---- estado visible por la UI ----
  const [phase, setPhase] = useState<Phase>('ready');
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({ text: 'En espera', level: undefined });
  const [idleNote, setIdleNote] = useState('Listo para iniciar');
  const [idleVisible, setIdleVisible] = useState(true);
  const [tableName, setTableName] = useState<string | null>(null);

  const [uploadPct, setUploadPct] = useState(0);
  const [uploadReceived, setUploadReceived] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [uploadPulse, setUploadPulse] = useState(0);
  const [uploadMoving, setUploadMoving] = useState(false);

  const [importPct, setImportPct] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [importRows, setImportRows] = useState(0);
  const [importPulse, setImportPulse] = useState(0);
  const [importMoving, setImportMoving] = useState(false);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [recActive, setRecActive] = useState(false);

  // ---- estado mutable de control (no dispara re-render) ----
  const fileRef = useRef(file);
  fileRef.current = file;
  const apiBaseRef = useRef(apiBase);
  apiBaseRef.current = apiBase;

  const uploadIdRef = useRef<string | null>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastTickRef = useRef({ t: 0, bytes: 0 });
  const lastRowsSeenRef = useRef(0);
  const lastTableSeenRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveApiBase = useCallback(() => apiBaseRef.current.trim().replace(/\/$/, ''), []);

  const logActivity = useCallback((entry: Omit<LogEntry, 'id' | 'time'>) => {
    setRequestCount((c) => c + 1);
    setRecActive(true);
    if (recTimerRef.current) clearTimeout(recTimerRef.current);
    recTimerRef.current = setTimeout(() => setRecActive(false), 600);

    const line: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: new Date().toTimeString().slice(0, 8) + '.' + String(new Date().getMilliseconds()).padStart(3, '0'),
      ...entry,
    };
    setLogs((prev) => {
      const next = [...prev, line];
      return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
    });
  }, []);

  const updateUploadBar = useCallback((received: number, total: number) => {
    const pct = total ? Math.min(100, (received / total) * 100) : 0;
    setUploadPct(pct);
    setUploadMoving(pct < 100 && !pausedRef.current);

    const now = Date.now();
    const dt = (now - lastTickRef.current.t) / 1000;
    let speed = 0;
    if (dt > 0.5) {
      speed = (received - lastTickRef.current.bytes) / dt;
      lastTickRef.current = { t: now, bytes: received };
    }
    setUploadSpeed(speed);
    setUploadReceived(received);
    setUploadTotal(total);
  }, []);

  const pollStatus = useCallback(async () => {
    if (!uploadIdRef.current) return;
    const t0 = performance.now();
    try {
      const res = await fetch(`${resolveApiBase()}/api/upload/${uploadIdRef.current}/status`);
      const ms = Math.round(performance.now() - t0);
      if (!res.ok) {
        logActivity({ method: 'GET', path: '/status', status: res.status, level: 'err' });
        return;
      }
      const s = await res.json();

      const rowsDelta = s.rowsInserted - lastRowsSeenRef.current;
      lastRowsSeenRef.current = s.rowsInserted;
      logActivity({
        method: 'GET',
        path: '/status',
        status: res.status,
        level: 'ok',
        meta: `${ms}ms · ${rowsDelta > 0 ? '+' + rowsDelta.toLocaleString('es-ES') + ' filas' : 'sin cambios'}`,
      });

      const pct = s.receivedBytes ? Math.min(100, (s.processedBytes / s.receivedBytes) * 100) : 0;
      setImportPct(pct);
      setImportMoving(pct < 100 && s.status !== 'Finished');
      if (rowsDelta > 0) setImportPulse((p) => p + 1);

      setImportProcessed(s.processedBytes);
      setImportRows(s.rowsInserted);
      setElapsedSec((Date.now() - startedAtRef.current) / 1000);

      if (s.tableName && s.tableName !== lastTableSeenRef.current) {
        lastTableSeenRef.current = s.tableName;
        setTableName(s.tableName);
        logActivity({ method: 'INFO', path: 'Tabla creada en MySQL', level: 'info', meta: s.tableName });
      }

      if (s.status === 'Finished') {
        setStatusInfo({ text: 'Completado', level: 'on' });
        setPhase('done');
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setUploadMoving(false);
        setImportMoving(false);
        logActivity({ method: 'INFO', path: 'Import finalizado', level: 'ok', meta: `${s.rowsInserted.toLocaleString('es-ES')} filas totales` });
      } else if (s.status === 'Error') {
        setStatusInfo({ text: 'Error en import', level: 'err' });
        setIdleNote(s.errorMessage || 'Ocurrió un error durante el import');
        setIdleVisible(true);
        setPhase('error');
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        logActivity({ method: 'INFO', path: 'Import falló', level: 'err', meta: s.errorMessage || '' });
      } else if ((s.status === 'Importing' || s.status === 'Completed') && !pausedRef.current) {
        setStatusInfo({ text: 'Importando', level: 'warn' });
      }
    } catch (_) {
      logActivity({ method: 'GET', path: '/status', status: '—', level: 'err', meta: 'sin respuesta' });
    }
  }, [logActivity, resolveApiBase]);

  const uploadLoop = useCallback(async () => {
    const f = fileRef.current;
    const totalChunks = Math.max(1, Math.ceil(f.size / CHUNK_SIZE));
    let chunkIndex = Math.floor(offsetRef.current / CHUNK_SIZE);

    while (offsetRef.current < f.size && !cancelledRef.current) {
      if (pausedRef.current) {
        await sleep(400);
        continue;
      }

      const chunkStart = offsetRef.current;
      const chunk = f.slice(offsetRef.current, Math.min(offsetRef.current + CHUNK_SIZE, f.size));
      chunkIndex++;
      const t0 = performance.now();
      let res: Response;
      try {
        res = await fetch(`${resolveApiBase()}/api/upload/${uploadIdRef.current}/chunk?offset=${offsetRef.current}`, {
          method: 'PUT',
          body: chunk,
        });
      } catch (err) {
        logActivity({ method: 'PUT', path: `/chunk?offset=${chunkStart}`, status: '—', level: 'err', meta: 'sin conexión, reintentando…' });
        await sleep(1000);
        continue;
      }
      const ms = Math.round(performance.now() - t0);

      if (res.status === 409) {
        const { correctOffset } = await res.json();
        logActivity({ method: 'PUT', path: `/chunk?offset=${chunkStart}`, status: 409, level: 'warn', meta: `re-sincronizando → ${fmtBytes(correctOffset)}` });
        offsetRef.current = correctOffset;
        continue;
      }
      if (!res.ok) {
        logActivity({ method: 'PUT', path: `/chunk?offset=${chunkStart}`, status: res.status, level: 'err', meta: 'reintentando…' });
        await sleep(1000);
        continue;
      }

      const data = await res.json();
      offsetRef.current = data.receivedBytes;
      logActivity({
        method: 'PUT',
        path: `/chunk?offset=${chunkStart}`,
        status: res.status,
        level: 'ok',
        meta: `chunk ${chunkIndex}/${totalChunks} · ${fmtBytes(chunk.size)} · ${ms}ms`,
      });
      updateUploadBar(offsetRef.current, f.size);
      setUploadPulse((p) => p + 1);
    }

    if (!cancelledRef.current) {
      const t0 = performance.now();
      const res = await fetch(`${resolveApiBase()}/api/upload/${uploadIdRef.current}/complete`, { method: 'POST' });
      logActivity({
        method: 'POST',
        path: '/complete',
        status: res.status,
        level: res.ok ? 'ok' : 'err',
        meta: `${Math.round(performance.now() - t0)}ms · subida terminada`,
      });
    }
  }, [logActivity, resolveApiBase, updateUploadBar]);

  const start = useCallback(async () => {
    const f = fileRef.current;
    if (!f) return;
    cancelledRef.current = false;
    pausedRef.current = false;
    offsetRef.current = 0;
    setPhase('running');
    setIdleVisible(false);
    startedAtRef.current = Date.now();
    lastTickRef.current = { t: startedAtRef.current, bytes: 0 };
    setStatusInfo({ text: 'Iniciando…', level: 'warn' });

    try {
      const initRes = await fetch(`${resolveApiBase()}/api/upload/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: f.name, totalBytes: f.size }),
      });
      if (!initRes.ok) throw new Error('init falló');
      const init = await initRes.json();
      uploadIdRef.current = init.uploadId;
      offsetRef.current = init.offsetToResumeFrom || 0;

      setStatusInfo({ text: 'Subiendo', level: 'on' });
      pollStatus();
      pollTimerRef.current = setInterval(pollStatus, POLL_MS);
      await uploadLoop();
    } catch (err) {
      console.error(err);
      setStatusInfo({ text: 'Error', level: 'err' });
      setIdleNote('No se pudo conectar con el backend — revisa el endpoint configurado abajo');
      setIdleVisible(true);
      setPhase('error');
    }
  }, [pollStatus, resolveApiBase, uploadLoop]);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPhase(pausedRef.current ? 'paused' : 'running');
    setStatusInfo(pausedRef.current ? { text: 'Pausado', level: 'warn' } : { text: 'Subiendo', level: 'on' });
  }, []);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (uploadIdRef.current) {
      try {
        await fetch(`${resolveApiBase()}/api/upload/${uploadIdRef.current}/cancel`, { method: 'POST' });
      } catch (_) {
        /* noop */
      }
    }
    setStatusInfo({ text: 'Cancelado', level: 'err' });
    setPhase('cancelled');
    setIdleNote('Carga cancelada — la tabla parcial fue eliminada');
    setIdleVisible(true);
  }, [resolveApiBase]);

  // limpieza si la tarjeta se quita de la cola mientras el job sigue corriendo
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (recTimerRef.current) clearTimeout(recTimerRef.current);
    };
  }, []);

  const canStart = phase === 'ready' || phase === 'done' || phase === 'error' || phase === 'cancelled';
  const canPauseOrCancel = phase === 'running' || phase === 'paused';
  const isLive = phase === 'running' || phase === 'paused';

  return {
    // acciones
    start,
    togglePause,
    cancel,
    canStart,
    canPauseOrCancel,
    paused: phase === 'paused',
    isLive,
    // subida
    uploadPct,
    uploadReceived,
    uploadTotal,
    uploadSpeed,
    uploadPulse,
    uploadMoving,
    // import
    importPct,
    importProcessed,
    importRows,
    importPulse,
    importMoving,
    // stats
    elapsedSec,
    tableName,
    // status
    statusInfo,
    idleNote,
    idleVisible,
    // log
    logs,
    requestCount,
    recActive,
  };
}
