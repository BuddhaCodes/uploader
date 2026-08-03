import { fmtBytes, fmtNum, fmtTime } from '@/lib/format';

interface Props {
  received: number;
  processed: number;
  rows: number;
  elapsedSec: number;
}

export default function StatsStrip({ received, processed, rows, elapsedSec }: Props) {
  return (
    <div className="stats-strip">
      <div className="stat">
        <div className="stat-label">Recibido</div>
        <div className="stat-value teal">{fmtBytes(received)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Procesado</div>
        <div className="stat-value amber">{fmtBytes(processed)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Filas insertadas</div>
        <div className="stat-value">{fmtNum(rows)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Tiempo</div>
        <div className="stat-value">{fmtTime(elapsedSec)}</div>
      </div>
    </div>
  );
}
