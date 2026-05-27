import React from 'react'

export default function TitleBar({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        WebkitAppRegion: 'drag' as any,
        userSelect: 'none',
      }}
    >
      {/* macOS traffic lights */}
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fe5f57',
            display: 'inline-block',
            WebkitAppRegion: 'no-drag' as any,
          }}
        />
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#febc2e',
            display: 'inline-block',
            WebkitAppRegion: 'no-drag' as any,
          }}
        />
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#28c840',
            display: 'inline-block',
            WebkitAppRegion: 'no-drag' as any,
          }}
        />
      </div>

      {/* Label */}
      <div
        className="de-mono"
        style={{
          fontSize: 12,
          color: 'var(--ink-3)',
          fontWeight: 500,
          marginLeft: 8,
        }}
      >
        {label}
      </div>
    </div>
  )
}
