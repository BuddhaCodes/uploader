'use client';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function EndpointConfig({ value, onChange }: Props) {
  return (
    <details className="config">
      <summary>Endpoint del backend</summary>
      <div className="config-body">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://tu-backend.com  (vacío = mismo origen)"
        />
      </div>
    </details>
  );
}
