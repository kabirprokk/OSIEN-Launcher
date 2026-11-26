import React, { useEffect, useRef, useState } from 'react';
import { BatteryCharging, Lock, Plus, RotateCcw, X, MoveDiagonal2, FileText, Zap, Clock } from 'lucide-react';
import { useBatteryTelemetry, splitPct } from '../engine/batteryEngine';
import { MonochromeAppIcon } from './BrandIcons';

export const DEFAULT_WIDGETS = [
  { id: 'hero', type: 'hero', x: 0, y: 0, w: 100, h: 112 },
  { id: 'power', type: 'power', x: 0, y: 124, w: 61, h: 92 },
  { id: 'lock', type: 'lock', x: 64, y: 124, w: 36, h: 92 },
];

function loadWidgets() {
  try {
    const raw = localStorage.getItem('osien_widgets_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_WIDGETS;
}

export const WidgetCanvas = React.memo(function WidgetCanvas({ onLock, onLaunchPkg }) {
  const [widgets, setWidgets] = useState(loadWidgets);
  const [editMode, setEditMode] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteText, setNoteText] = useState(() => localStorage.getItem('osien_widget_note') || 'Tap to type a quick note...');
  const [androidWidgets, setAndroidWidgets] = useState([]);

  const [now, setNow] = useState(() => new Date());
  const { telemetry } = useBatteryTelemetry({
    capacityMah: Number(localStorage.getItem('ov_cap') || 5000),
    enabled: true,
  });
  const { whole, dec } = splitPct(telemetry.pct);

  const canvasRef = useRef(null);
  const holdTimer = useRef(null);
  const dragInfo = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('osien_widgets_v1', JSON.stringify(widgets)); } catch { /* ignore */ }
  }, [widgets]);

  useEffect(() => {
    try { localStorage.setItem('osien_widget_note', noteText); } catch { /* ignore */ }
  }, [noteText]);

  const openPicker = () => {
    try {
      const raw = window.AndroidBattery?.getAvailableAppWidgets?.();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setAndroidWidgets(parsed);
      }
    } catch { /* ignore */ }
    setPickerOpen(true);
  };

  const addWidget = (type, meta = {}) => {
    const id = `${type}_${Date.now()}`;
    const next = {
      id,
      type,
      x: 0,
      y: 230,
      w: type === 'analog' ? 44 : 100,
      h: type === 'note' ? 108 : type === 'analog' ? 116 : 74,
      ...meta,
    };
    setWidgets((prev) => [...prev, next]);
    setPickerOpen(false);
  };

  const removeWidget = (id) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  // Long-press any widget to enter 100% movable & resizable Edit Mode
  const onWidgetHoldStart = () => {
    if (editMode) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setEditMode(true), 450);
  };
  const cancelHold = () => clearTimeout(holdTimer.current);

  // Direct-DOM 0-lag Drag & Resize
  const startInteract = (e, widget, mode) => {
    if (!editMode) return;
    e.stopPropagation();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    dragInfo.current = {
      id: widget.id,
      mode, // 'move' | 'resize'
      el: e.currentTarget.closest('.osien-free-widget'),
      startX: e.clientX,
      startY: e.clientY,
      origX: widget.x,
      origY: widget.y,
      origW: widget.w,
      origH: widget.h,
      canvasW: canvasRect.width,
      canvasH: canvasRect.height,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onInteractMove = (e) => {
    const d = dragInfo.current;
    if (!d || !d.el) return;
    e.stopPropagation();
    const dxPct = ((e.clientX - d.startX) / d.canvasW) * 100;
    const dyPx = e.clientY - d.startY;

    if (d.mode === 'move') {
      const nx = Math.max(0, Math.min(100 - d.origW, d.origX + dxPct));
      const ny = Math.max(0, Math.min(d.canvasH - d.origH, d.origY + dyPx));
      d.el.style.left = `${nx}%`;
      d.el.style.top = `${ny}px`;
      d.lastX = nx;
      d.lastY = ny;
    } else {
      const nw = Math.max(28, Math.min(100 - d.origX, d.origW + dxPct));
      const nh = Math.max(58, Math.min(260, d.origH + dyPx));
      d.el.style.width = `${nw}%`;
      d.el.style.height = `${nh}px`;
      d.lastW = nw;
      d.lastH = nh;
    }
  };

  const endInteract = (e) => {
    const d = dragInfo.current;
    if (!d) return;
    e.stopPropagation();
    dragInfo.current = null;
    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id !== d.id) return w;
        return {
          ...w,
          x: d.lastX !== undefined ? Math.round(d.lastX) : w.x,
          y: d.lastY !== undefined ? Math.round(d.lastY) : w.y,
          w: d.lastW !== undefined ? Math.round(d.lastW) : w.w,
          h: d.lastH !== undefined ? Math.round(d.lastH) : w.h,
        };
      })
    );
  };

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();
  const dateStr = now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();

  const renderWidgetBody = (w) => {
    if (w.type === 'hero') {
      return (
        <div className="osien-hero osien-glass" style={{ height: '100%', padding: '14px 18px' }}>
          <div>
            <div className="osien-clock-time tabular" style={{ fontSize: Math.min(40, Math.max(24, w.h * 0.34)) }}>{timeStr}</div>
            <div className="osien-clock-date" style={{ marginTop: 6 }}>{dateStr}</div>
          </div>
          <div className="osien-bat-right" onClick={() => !editMode && window.dispatchEvent(new CustomEvent('osien-open-battery'))}>
            <div className="tabular" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(248,250,252,0.72)' }}>
              {whole}.{dec}%
            </div>
            <div className="osien-bat-cell" style={{ height: Math.min(54, Math.max(36, w.h * 0.48)) }}>
              <div className="osien-bat-cap" />
              <div className="osien-bat-fill" style={{ height: `${Math.max(8, telemetry.pct)}%` }} />
            </div>
          </div>
        </div>
      );
    }

    if (w.type === 'power') {
      return (
        <div className="osien-widget-card osien-glass" style={{ height: '100%', minHeight: 0 }} onClick={() => !editMode && window.dispatchEvent(new CustomEvent('osien-open-battery'))}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(248,250,252,0.5)' }}>OSIEN POWER</span>
            <BatteryCharging size={14} color="#34d399" />
          </div>
          <div className="tabular" style={{ fontSize: 15, fontWeight: 500 }}>
            {telemetry.chargeState === 'charging' ? `${telemetry.watts.toFixed(1)}W Live` : telemetry.chargeState === 'paused' ? 'Smart Pause' : 'AOD Studio'}
          </div>
        </div>
      );
    }

    if (w.type === 'lock') {
      return (
        <div className="osien-widget-card osien-glass" style={{ height: '100%', minHeight: 0, alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => !editMode && onLock()}>
          <Lock size={20} color="#38bdf8" />
          <span style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(248,250,252,0.65)' }}>LOCK</span>
        </div>
      );
    }

    if (w.type === 'note') {
      return (
        <div className="osien-widget-card osien-glass" style={{ height: '100%', minHeight: 0, padding: '12px 14px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: 'rgba(248,250,252,0.45)', marginBottom: 4 }}>QUICK NOTE</div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: 13, resize: 'none', fontFamily: 'var(--font-sans)' }}
          />
        </div>
      );
    }

    if (w.type === 'telemetry') {
      return (
        <div className="osien-widget-card osien-glass tabular" style={{ height: '100%', minHeight: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <div><div style={{ fontSize: 9, opacity: 0.5 }}>VOLT</div>{telemetry.vBat.toFixed(2)}V</div>
          <div><div style={{ fontSize: 9, opacity: 0.5 }}>CURR</div>{telemetry.iBatMa}mA</div>
          <div><div style={{ fontSize: 9, opacity: 0.5 }}>TEMP</div>{telemetry.tempC.toFixed(1)}°C</div>
        </div>
      );
    }

    if (w.type === 'analog') {
      const secDeg = now.getSeconds() * 6;
      const minDeg = now.getMinutes() * 6 + now.getSeconds() * 0.1;
      const hrDeg = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;
      return (
        <div className="osien-widget-card osien-glass" style={{ height: '100%', minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
          <svg width="68" height="68" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
            <line x1="50" y1="50" x2="50" y2="25" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" transform={`rotate(${hrDeg} 50 50)`} />
            <line x1="50" y1="50" x2="50" y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round" transform={`rotate(${minDeg} 50 50)`} />
            <line x1="50" y1="54" x2="50" y2="12" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${secDeg} 50 50)`} />
            <circle cx="50" cy="50" r="3" fill="#38bdf8" />
          </svg>
        </div>
      );
    }

    // Installed Android App Widget Card
    return (
      <div
        className="osien-widget-card osien-glass"
        style={{ height: '100%', minHeight: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        onClick={() => !editMode && w.packageName && onLaunchPkg(w.packageName)}
      >
        <div className="osien-diamond" style={{ width: 32, height: 32, flexShrink: 0 }}>
          <span className="osien-diamond-glyph"><MonochromeAppIcon app={{ packageName: w.packageName, label: w.label }} /></span>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.label || 'App Widget'}</div>
          <div style={{ fontSize: 10, color: 'rgba(248,250,252,0.5)' }}>Tap to open</div>
        </div>
      </div>
    );
  };

  return (
    <div ref={canvasRef} style={{ position: 'relative', flex: 1, width: '100%', minHeight: 360 }}>
      {/* Widget Edit Mode Top Bar */}
      {editMode && (
        <div
          style={{ position: 'fixed', top: 'calc(var(--safe-top) + 10px)', left: 14, right: 14, zIndex: 60, display: 'flex', justifyContent: 'center', gap: 8 }}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button className="hud-pill" style={{ background: '#38bdf8', color: '#020617', borderColor: '#38bdf8', fontWeight: 600 }} onClick={openPicker}>
            <Plus size={14} /> Add Widget
          </button>
          <button className="hud-pill" onClick={() => setWidgets(DEFAULT_WIDGETS)}>
            <RotateCcw size={13} /> Reset
          </button>
          <button className="hud-pill" style={{ background: '#10b981', color: '#022c22', borderColor: '#10b981', fontWeight: 600 }} onClick={() => setEditMode(false)}>
            Done
          </button>
        </div>
      )}

      {/* Movable & Resizable Widgets */}
      {widgets.map((w) => (
        <div
          key={w.id}
          className={`osien-free-widget ${editMode ? 'editing' : ''}`}
          style={{ left: `${w.x}%`, top: `${w.y}px`, width: `${w.w}%`, height: `${w.h}px` }}
          onTouchStart={onWidgetHoldStart}
          onTouchEnd={cancelHold}
          onTouchMove={cancelHold}
          onPointerDown={(e) => startInteract(e, w, 'move')}
          onPointerMove={onInteractMove}
          onPointerUp={endInteract}
        >
          {renderWidgetBody(w)}

          {editMode && (
            <>
              {w.id !== 'hero' && (
                <button
                  className="osien-w-del"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); removeWidget(w.id); }}
                >
                  <X size={12} />
                </button>
              )}
              <div
                className="osien-w-resize"
                onPointerDown={(e) => startInteract(e, w, 'resize')}
                onPointerMove={onInteractMove}
                onPointerUp={endInteract}
              >
                <MoveDiagonal2 size={11} />
              </div>
            </>
          )}
        </div>
      ))}

      {/* Add Widget Picker Sheet (OSIEN Built-in + Installed Android App Widgets) */}
      {pickerOpen && (
        <div className="osien-bottom-card-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="osien-drawer-card" style={{ height: '68dvh', transform: 'none' }} onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Add Widget</span>
              <button className="osien-circle-btn" style={{ width: 30, height: 30 }} onClick={() => setPickerOpen(false)}><X size={14} /></button>
            </div>

            <div className="osien-drawer-scroll">
              <div className="osien-cat-header"><span className="osien-cat-line" /><span>OSIEN WIDGETS</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <button className="opt-btn" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => addWidget('note')}>
                  <FileText size={15} color="#38bdf8" /> Quick Note
                </button>
                <button className="opt-btn" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => addWidget('telemetry')}>
                  <Zap size={15} color="#10b981" /> Live V · mA
                </button>
                <button className="opt-btn" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => addWidget('analog')}>
                  <Clock size={15} color="#a78bfa" /> Analog Clock
                </button>
              </div>

              {androidWidgets.length > 0 && (
                <>
                  <div className="osien-cat-header"><span className="osien-cat-line" /><span>INSTALLED APP WIDGETS ({androidWidgets.length})</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {androidWidgets.map((aw) => (
                      <button
                        key={aw.provider}
                        className="opt-btn"
                        style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
                        onClick={() => addWidget('appwidget', { label: aw.label, packageName: aw.packageName, provider: aw.provider })}
                      >
                        <span style={{ fontSize: 13 }}>{aw.label}</span>
                        <Plus size={14} color="#38bdf8" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
