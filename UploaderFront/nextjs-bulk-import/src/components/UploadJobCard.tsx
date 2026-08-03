'use client';

import { useBulkImport } from '@/hooks/useBulkImport';
import { fmtBytes, fmtNum } from '@/lib/format';
import UploadControls from './UploadControls';
import ProgressRail from './ProgressRail';
import StatsStrip from './StatsStrip';
import StatusLine from './StatusLine';
import ActivityLog from './ActivityLog';

interface Props {
  file: File;
  apiBase: string;
  onRemove: () => void;
}

export default function UploadJobCard({ file, apiBase, onRemove }: Props) {
  const bi = useBulkImport(file, apiBase);

  return (
    <div className="job-card">
      <div className="job-header">
        <div className="file-row">
          <div className="file-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          </div>
          <div className="file-meta">
            <div className="file-name">{file.name}</div>
            <div className="file-size">{fmtBytes(file.size)}</div>
          </div>
        </div>
        <button
          type="button"
          className="job-remove"
          disabled={bi.isLive}
          title={bi.isLive ? 'Cancela la subida antes de quitarla' : 'Quitar de la cola'}
          onClick={onRemove}
        >
          Quitar
        </button>
      </div>

      <UploadControls
        canStart={bi.canStart}
        canPauseOrCancel={bi.canPauseOrCancel}
        paused={bi.paused}
        onStart={bi.start}
        onTogglePause={bi.togglePause}
        onCancel={bi.cancel}
      />

      <div className="rails">
        <ProgressRail
          variant="upload"
          label="Subida"
          percent={bi.uploadPct}
          moving={bi.uploadMoving}
          pulseSignal={bi.uploadPulse}
          figure={
            <>
              <b>{fmtBytes(bi.uploadReceived)}</b> / {fmtBytes(bi.uploadTotal)} · {fmtBytes(bi.uploadSpeed)}/s
            </>
          }
        />
        <ProgressRail
          variant="import"
          label="Import a MySQL"
          percent={bi.importPct}
          moving={bi.importMoving}
          pulseSignal={bi.importPulse}
          figure={
            <>
              <b>{fmtNum(bi.importRows)}</b> filas · {fmtBytes(bi.importProcessed)} procesados
            </>
          }
        />

        <StatsStrip
          received={bi.uploadReceived}
          processed={bi.importProcessed}
          rows={bi.importRows}
          elapsedSec={bi.elapsedSec}
        />

        <StatusLine
          statusInfo={bi.statusInfo}
          tableName={bi.tableName}
          idleNote={bi.idleNote}
          idleVisible={bi.idleVisible}
        />
      </div>

      <ActivityLog logs={bi.logs} requestCount={bi.requestCount} recActive={bi.recActive} />
    </div>
  );
}
