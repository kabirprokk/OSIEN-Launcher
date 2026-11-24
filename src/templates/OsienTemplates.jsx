import React from 'react';
import { splitPct } from '../engine/batteryEngine';

function statusText(t) {
  if (t.chargeState === 'paused') return 'SMART LIMIT · PAUSED';
  if (t.chargeState === 'full') return 'FULLY CHARGED';
  if (t.chargeState === 'charging') return `${t.watts.toFixed(1)}W · CHARGING`;
  return 'ON BATTERY';
}

function TelemetryHairline({ t, show, light = false }) {
  if (!show) return null;
  const color = light ? 'rgba(24,24,27,0.48)' : 'rgba(255,255,255,0.42)';
  return (
    <div
      className="tabular"
      style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.04em',
        color,
      }}
    >
      {t.chargeState === 'charging' && <span>{t.vIn.toFixed(1)}V</span>}
      {t.chargeState === 'charging' && <span>·</span>}
      <span>{t.chargeState === 'charging' ? `${t.iInMa}mA` : `${t.iBatMa}mA`}</span>
      <span>·</span>
      <span>{t.vBat.toFixed(3)}V</span>
    </div>
  );
}

/* 1. KINETIC PURE — Ultra-clean giant % + hairline progress */
export function KineticPure({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const accent = theme.accent;
  const glow = theme.glow > 0 ? `0 0 ${Math.round(theme.glow * 0.45)}px ${accent}66` : 'none';
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', color: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 28px', gap: 22 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.22em', color: t.chargeState === 'paused' ? '#f59e0b' : 'rgba(255,255,255,0.42)' }}>
        {statusText(t)}
      </div>
      <div className="tabular" style={{ fontFamily: theme.font, fontWeight: theme.weight, lineHeight: 0.9, letterSpacing: '-0.05em', display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontSize: 'clamp(82px, 26vw, 136px)' }}>{whole}</span>
        <span style={{ fontSize: 'clamp(38px, 12vw, 64px)', color: accent, textShadow: glow }}>.{dec}</span>
        <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.32)', marginLeft: 4 }}>%</span>
      </div>
      <div style={{ width: '78%', maxWidth: 280, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${t.pct}%`, background: accent, boxShadow: glow, transition: 'width 0.25s linear' }} />
      </div>
      <TelemetryHairline t={t} show={theme.showTelemetry} />
    </div>
  );
}

/* 2. RADIAL HALO — Minimal concentric ring */
export function RadialHalo({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const r = 114;
  const circ = 2 * Math.PI * r;
  const offset = circ - (t.pct / 100) * circ;
  const accent = theme.accent;

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
      <div style={{ position: 'relative', width: 268, height: 268, display: 'grid', placeItems: 'center' }}>
        <svg width="268" height="268" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="134" cy="134" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle
            cx="134" cy="134" r={r} fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.25s linear', filter: theme.glow > 0 ? `drop-shadow(0 0 ${Math.round(theme.glow * 0.2)}px ${accent})` : 'none' }}
          />
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div className="tabular" style={{ fontFamily: theme.font, fontWeight: theme.weight, fontSize: 56, letterSpacing: '-0.04em' }}>
            {whole}<span style={{ fontSize: 28, color: accent }}>.{dec}</span>
          </div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
            {statusText(t)}
          </div>
        </div>
      </div>
      <TelemetryHairline t={t} show={theme.showTelemetry} />
    </div>
  );
}

/* 3. LIQUID RISE — Rising fluid wave at exact % */
export function LiquidRise({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const accent = theme.accent;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#020405', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.max(4, t.pct)}%`, background: `linear-gradient(180deg, ${accent}44 0%, ${accent}18 100%)`, transition: 'height 0.35s ease' }}>
        <svg viewBox="0 0 1200 60" preserveAspectRatio="none" style={{ position: 'absolute', top: -24, left: 0, width: '200%', height: 28, animation: t.chargeState === 'charging' ? 'wave-drift 4.5s linear infinite' : 'none' }}>
          <path d="M0,30 C150,55 300,5 450,30 C600,55 750,5 900,30 C1050,55 1200,5 1200,30 L1200,60 L0,60 Z" fill={`${accent}55`} />
        </svg>
      </div>
      <div style={{ position: 'relative', zIndex: 2, fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.55)' }}>{statusText(t)}</div>
      <div className="tabular" style={{ position: 'relative', zIndex: 2, fontFamily: theme.font, fontWeight: theme.weight, fontSize: 'clamp(78px, 24vw, 124px)', letterSpacing: '-0.05em', lineHeight: 0.9 }}>
        {whole}<span style={{ fontSize: '0.48em', color: accent }}>.{dec}</span><span style={{ fontSize: '0.24em', opacity: 0.45 }}>%</span>
      </div>
      <div style={{ position: 'relative', zIndex: 2 }}><TelemetryHairline t={t} show={theme.showTelemetry} /></div>
    </div>
  );
}

/* 4. PULSE CORE — Expanding ripples (pauses cleanly on Smart Limit) */
export function PulseCore({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const accent = theme.accent;
  const active = t.chargeState === 'charging';
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: 240, height: 240, display: 'grid', placeItems: 'center' }}>
        {active && (
          <>
            <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: `1px solid ${accent}66`, animation: 'ripple-out 2.2s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: `1px solid ${accent}44`, animation: 'ripple-out 2.2s ease-out 1.1s infinite' }} />
          </>
        )}
        <div style={{ width: 204, height: 204, borderRadius: '50%', background: '#050507', border: `1px solid ${accent}55`, boxShadow: theme.glow > 0 ? `0 0 ${Math.round(theme.glow * 0.6)}px ${accent}2a` : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="tabular" style={{ fontFamily: theme.font, fontWeight: theme.weight, fontSize: 54, letterSpacing: '-0.04em' }}>
            {whole}<span style={{ fontSize: 26, color: accent }}>.{dec}</span>
          </div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>{statusText(t)}</div>
        </div>
      </div>
      <TelemetryHairline t={t} show={theme.showTelemetry} />
    </div>
  );
}

/* 5. NOTHING DOT — Minimal monochrome dot matrix */
export function NothingDot({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const segs = 24;
  const filled = Math.round((t.pct / 100) * segs);
  const accent = theme.accent;
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '14px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, fontFamily: 'var(--font-mono)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)' }}>{statusText(t)}</div>
      <div className="tabular" style={{ fontSize: 'clamp(62px, 20vw, 102px)', fontWeight: 400, letterSpacing: '-0.04em' }}>
        {whole}<span style={{ color: accent }}>.{dec}</span><span style={{ fontSize: 20, opacity: 0.35 }}>%</span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: segs }).map((_, i) => (
          <div key={i} style={{ width: 6, height: 22, borderRadius: 3, background: i < filled ? (i === filled - 1 && t.chargeState === 'charging' ? accent : '#fafafa') : '#1c1c1f', transition: 'background 0.2s ease' }} />
        ))}
      </div>
      <TelemetryHairline t={t} show={theme.showTelemetry} />
    </div>
  );
}

/* 6. MONOLITH — Architectural vertical pillar */
export function Monolith({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const accent = theme.accent;
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '0 28px' }}>
      <div style={{ width: 44, height: '52%', borderRadius: 14, background: '#111114', border: '1px solid #27272a', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${t.pct}%`, background: accent, transition: 'height 0.25s linear' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)' }}>{statusText(t)}</div>
        <div className="tabular" style={{ fontFamily: theme.font, fontWeight: theme.weight, fontSize: 'clamp(56px, 18vw, 92px)', lineHeight: 0.92, letterSpacing: '-0.05em' }}>
          {whole}<span style={{ fontSize: '0.5em', color: accent }}>.{dec}</span>
        </div>
        <TelemetryHairline t={t} show={theme.showTelemetry} />
      </div>
    </div>
  );
}

/* 7. OLED WHISPER — Pure #000 ultra-thin zero-drain AOD */
export function OledWhisper({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div className="tabular" style={{ fontFamily: theme.font, fontWeight: 200, fontSize: 'clamp(76px, 24vw, 126px)', letterSpacing: '-0.05em', color: '#e4e4e7' }}>
        {whole}<span style={{ fontSize: '0.46em', color: theme.accent, opacity: 0.85 }}>.{dec}</span>
      </div>
      <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.32)' }}>{statusText(t)}</div>
      <TelemetryHairline t={t} show={theme.showTelemetry} />
    </div>
  );
}

/* 8. HORIZON — Sweeping laser horizon */
export function Horizon({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const accent = theme.accent;
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      <div className="tabular" style={{ fontFamily: theme.font, fontWeight: theme.weight, fontSize: 'clamp(74px, 23vw, 122px)', letterSpacing: '-0.05em', lineHeight: 0.9 }}>
        {whole}<span style={{ fontSize: '0.48em', color: accent }}>.{dec}</span>
      </div>
      <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
        <div style={{ height: 2, width: `${t.pct}%`, background: accent, boxShadow: `0 0 18px ${accent}`, transition: 'width 0.25s linear' }} />
      </div>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.42)' }}>{statusText(t)}</div>
      <TelemetryHairline t={t} show={theme.showTelemetry} />
    </div>
  );
}

/* 9. EDITORIAL — Warm daylight paper + serif */
export function Editorial({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  return (
    <div style={{ width: '100%', height: '100%', background: '#f5f2eb', color: '#18181b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 28px' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#71717a' }}>{statusText(t)}</div>
      <div className="tabular" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(88px, 28vw, 144px)', lineHeight: 0.88, fontStyle: 'italic' }}>
        {whole}<span style={{ fontSize: '0.48em', color: '#52525b' }}>.{dec}</span>
      </div>
      <div style={{ width: '72%', maxWidth: 240, height: 3, background: '#e5e1d8', borderRadius: 99 }}>
        <div style={{ height: '100%', width: `${t.pct}%`, background: '#18181b', borderRadius: 99, transition: 'width 0.25s linear' }} />
      </div>
      <TelemetryHairline t={t} show={theme.showTelemetry} light />
    </div>
  );
}

/* 10. BRAUN DIAL — Matte industrial precision */
export function BraunDial({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const accent = theme.accent;
  return (
    <div style={{ width: '100%', height: '100%', background: '#141414', color: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '0 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.chargeState === 'charging' ? accent : '#525252', boxShadow: t.chargeState === 'charging' ? `0 0 10px ${accent}` : 'none' }} />
        <span style={{ fontSize: 10, letterSpacing: '0.18em', color: '#a3a3a3' }}>{statusText(t)}</span>
      </div>
      <div className="tabular" style={{ fontFamily: theme.font, fontWeight: 500, fontSize: 'clamp(72px, 22vw, 114px)', letterSpacing: '-0.04em', lineHeight: 0.92 }}>
        {whole}<span style={{ color: accent }}>.{dec}</span>
      </div>
      <div style={{ width: '80%', maxWidth: 260, height: 8, background: '#0a0a0a', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${t.pct}%`, background: accent, transition: 'width 0.25s linear' }} />
      </div>
      <TelemetryHairline t={t} show={theme.showTelemetry} />
    </div>
  );
}

/* 11. MATRIX 100 — 10x10 micro-LED grid */
export function Matrix100({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const wholeInt = Math.floor(t.pct);
  const accent = theme.accent;
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: '0 28px' }}>
      <div className="tabular" style={{ fontFamily: theme.font, fontWeight: theme.weight, fontSize: 48, letterSpacing: '-0.04em' }}>
        {whole}<span style={{ color: accent }}>.{dec}</span><span style={{ fontSize: 18, opacity: 0.35 }}>%</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8, width: '100%', maxWidth: 260 }}>
        {Array.from({ length: 100 }).map((_, i) => {
          const isFilled = i < wholeInt;
          const isActive = i === wholeInt && t.chargeState === 'charging';
          return (
            <div key={i} style={{ aspectRatio: '1', borderRadius: 4, background: isFilled ? accent : isActive ? '#ffffff' : '#161619', boxShadow: isActive ? `0 0 10px ${accent}` : 'none', transition: 'background 0.2s ease' }} />
          );
        })}
      </div>
      <TelemetryHairline t={t} show={theme.showTelemetry} />
    </div>
  );
}

/* 12. CAPSULE — Floating minimal battery pill */
export function Capsule({ t, theme }) {
  const { whole, dec } = splitPct(t.pct);
  const accent = theme.accent;
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 310, padding: '20px 24px', borderRadius: 34, background: '#0d0d10', border: '1px solid #222228', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: accent }}>{statusText(t)}</div>
          <div className="tabular" style={{ fontFamily: theme.font, fontWeight: theme.weight, fontSize: 46, letterSpacing: '-0.04em', marginTop: 2 }}>
            {whole}<span style={{ fontSize: 24, color: accent }}>.{dec}</span>
          </div>
        </div>
        <div style={{ width: 32, height: 64, borderRadius: 11, background: '#1c1c21', padding: 3, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', height: `${Math.max(8, t.pct)}%`, borderRadius: 8, background: accent, transition: 'height 0.25s linear' }} />
        </div>
      </div>
      <TelemetryHairline t={t} show={theme.showTelemetry} />
    </div>
  );
}
