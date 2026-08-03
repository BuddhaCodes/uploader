'use client';

import { useEffect, useRef } from 'react';

interface Props {
  variant: 'upload' | 'import';
  label: string;
  figure: React.ReactNode;
  percent: number;
  moving: boolean;
  pulseSignal: number;
}

export default function ProgressRail({ variant, label, figure, percent, moving, pulseSignal }: Props) {
  const headRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const head = headRef.current;
    if (!head) return;
    head.style.left = `${Math.min(100, Math.max(0, percent))}%`;
  }, [percent]);

  useEffect(() => {
    // se salta el pulso en el montaje inicial (pulseSignal arranca en 0)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const head = headRef.current;
    if (!head) return;
    head.classList.remove('pulse');
    void head.offsetWidth; // reinicia la animación aunque llegue otro pulso enseguida
    head.classList.add('pulse');
  }, [pulseSignal]);

  return (
    <div className="rail">
      <div className="rail-head">
        <span className={`rail-label ${variant}`}>{label}</span>
        <span className="rail-figure">{figure}</span>
      </div>
      <div className="track">
        <div
          className={`fill ${variant}${moving ? ' moving' : ''}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
        <div ref={headRef} className={`head-marker ${variant}`} />
      </div>
    </div>
  );
}
