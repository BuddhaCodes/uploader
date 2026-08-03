import type { StatusInfo } from '@/lib/types';

interface Props {
  statusInfo: StatusInfo;
  tableName: string | null;
  idleNote: string;
  idleVisible: boolean;
}

export default function StatusLine({ statusInfo, tableName, idleNote, idleVisible }: Props) {
  return (
    <>
      <div className="status-line">
        <span className={`status-pill${statusInfo.level ? ` ${statusInfo.level}` : ''}`}>{statusInfo.text}</span>
        <span className="table-name">
          {tableName ? (
            <>
              tabla: <b>{tableName}</b>
            </>
          ) : (
            '\u00A0'
          )}
        </span>
      </div>
      {idleVisible && <div className="idle-note">{idleNote}</div>}
    </>
  );
}
