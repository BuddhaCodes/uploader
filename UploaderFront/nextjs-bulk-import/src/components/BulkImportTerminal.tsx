'use client';

import { useState } from 'react';
import FileDropzone from './FileDropzone';
import UploadJobCard from './UploadJobCard';
import EndpointConfig from './EndpointConfig';

interface QueuedFile {
  id: string;
  file: File;
}

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function BulkImportTerminal() {
  const [jobs, setJobs] = useState<QueuedFile[]>([]);
  const [apiBaseValue, setApiBaseValue] = useState(process.env.NEXT_PUBLIC_API_BASE_URL || '');

  const addFiles = (files: File[]) => {
    setJobs((prev) => [...prev, ...files.map((file) => ({ id: makeId(), file }))]);
  };

  const removeJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  return (
    <div className="wrap">
      <div className="eyebrow">
        <span className={`dot${jobs.length ? ' live' : ''}`}></span> Bulk import terminal
      </div>
      <h1>
        Sube varios archivos. <em>No esperes al final</em> para verlos en MySQL.
      </h1>
      <p className="sub">
        Cada archivo se sube por partes con reanudación automática, y su import a MySQL corre en paralelo e
        independiente de los demás — agrega los que quieras y síguelos uno por uno.
      </p>

      <FileDropzone onFilesSelected={addFiles} />

      <div className="queue-head">
        <span className="queue-count">{jobs.length === 0 ? 'Sin archivos en cola' : `${jobs.length} archivo${jobs.length === 1 ? '' : 's'} en cola`}</span>
      </div>

      {jobs.length === 0 ? (
        <div className="queue-empty">Agrega uno o varios archivos arriba para empezar</div>
      ) : (
        <div className="queue">
          {jobs.map((j) => (
            <UploadJobCard key={j.id} file={j.file} apiBase={apiBaseValue} onRemove={() => removeJob(j.id)} />
          ))}
        </div>
      )}

      <EndpointConfig value={apiBaseValue} onChange={setApiBaseValue} />
    </div>
  );
}
