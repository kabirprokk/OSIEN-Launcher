import React from 'react';

export const CLOCK_STYLES = [
  { id: 'off', label: 'Off' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'stacked', label: 'Stacked' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'mono', label: 'Mono Sec' },
  { id: 'analog', label: 'Analog' },
];

export const BG_PRESETS = [
  { id: 'oled', label: 'Pure OLED', style: { background: '#000000' }, light: false },
  {
    id: 'mesh',
    label: 'Midnight',
    style: { background: 'radial-gradient(circle at 20% 20%, #0f172a 0%, #020617 55%, #000000 100%)' },
    light: false,
  },
  { id: 'carbon', label: 'Carbon', style: { background: '#111113' }, light: false },
  { id: 'paper', label: 'Paper', style: { background: '#f5f2eb' }, light: true },
];

export function ClockWidget({ styleId, now, accent, light = false }) {
  if (!styleId || styleId === 'off') return null;

  const fg = light ? '#18181b' : '#f4f4f5';
  const muted = light ? 'rgba(24,24,27,0.55)' : 'rgba(255,255,255,0.5)';
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  if (styleId === 'stacked') {
    return (
      <div style={{ textAlign: 'center', color: fg, lineHeight: 0.88 }}>
        <div className="tabular" style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 500, letterSpacing: '-0.04em' }}>
          <div>{hh}</div>
          <div style={{ color: accent }}>{mm}</div>
        </div>
        <div style={{ fontSize: 11, color: muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 8 }}>
          {dateStr}
        </div>
      </div>
    );
  }

  if (styleId === 'editorial') {
    return (
      <div style={{ textAlign: 'center', color: fg }}>
        <div className="tabular" style={{ fontFamily: 'var(--font-serif)', fontSize: 54, fontStyle: 'italic', lineHeight: 0.95 }}>
          {hh}:{mm}
        </div>
        <div style={{ fontSize: 11, color: muted, letterSpacing: '0.1em', marginTop: 4 }}>{dateStr}</div>
      </div>
    );
  }

  if (styleId === 'mono') {
    return (
      <div style={{ textAlign: 'center', color: fg, fontFamily: 'var(--font-mono)' }}>
        <div className="tabular" style={{ fontSize: 28, fontWeight: 400, letterSpacing: '0.06em' }}>
          {hh}:{mm}<span style={{ color: accent, fontSize: 18 }}>:{ss}</span>
        </div>
        <div style={{ fontSize: 10, color: muted, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
          {dateStr}
        </div>
      </div>
    );
  }

  if (styleId === 'analog') {
    const secDeg = now.getSeconds() * 6;
    const minDeg = now.getMinutes() * 6 + now.getSeconds() * 0.1;
    const hrDeg = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <svg width="96" height="96" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke={muted} strokeWidth="1.5" />
          <line x1="50" y1="50" x2="50" y2="24" stroke={fg} strokeWidth="3" strokeLinecap="round" transform={`rotate(${hrDeg} 50 50)`} />
          <line x1="50" y1="50" x2="50" y2="14" stroke={fg} strokeWidth="2" strokeLinecap="round" transform={`rotate(${minDeg} 50 50)`} />
          <line x1="50" y1="54" x2="50" y2="12" stroke={accent} strokeWidth="1.2" strokeLinecap="round" transform={`rotate(${secDeg} 50 50)`} />
          <circle cx="50" cy="50" r="2.8" fill={accent} />
        </svg>
        <div style={{ fontSize: 10, color: muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{dateStr}</div>
      </div>
    );
  }

  // Default: minimal
  return (
    <div style={{ textAlign: 'center', color: fg }}>
      <div className="tabular" style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, letterSpacing: '0.02em' }}>
        {hh}:{mm}
      </div>
      <div style={{ fontSize: 11, color: muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
        {dateStr}
      </div>
    </div>
  );
}
