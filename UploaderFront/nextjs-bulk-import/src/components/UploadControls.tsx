'use client';

interface Props {
  canStart: boolean;
  canPauseOrCancel: boolean;
  paused: boolean;
  onStart: () => void;
  onTogglePause: () => void;
  onCancel: () => void;
}

export default function UploadControls({ canStart, canPauseOrCancel, paused, onStart, onTogglePause, onCancel }: Props) {
  return (
    <div className="controls">
      <button className="action btn-primary" disabled={!canStart} onClick={onStart}>
        Iniciar carga
      </button>
      <button className="action btn-ghost" disabled={!canPauseOrCancel} onClick={onTogglePause}>
        {paused ? 'Reanudar' : 'Pausar'}
      </button>
      <button className="action btn-danger" disabled={!canPauseOrCancel} onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}
