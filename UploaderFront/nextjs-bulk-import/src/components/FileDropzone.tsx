'use client';

import { useRef, useState } from 'react';

interface Props {
  onFilesSelected: (files: File[]) => void;
}

export default function FileDropzone({ onFilesSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  return (
    <div
      className={`dropzone${dragging ? ' drag' : ''}`}
      onClick={openPicker}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) onFilesSelected(Array.from(e.dataTransfer.files));
      }}
    >
      <div>
        <div className="dz-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="dz-title">Arrastra uno o varios archivos aquí</div>
        <div className="dz-hint">
          o <kbd>clic</kbd> para elegir — cada archivo sube e importa por su cuenta
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) onFilesSelected(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}
