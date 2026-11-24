import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Palette, Download, Move, RotateCcw, Image as ImageIcon } from 'lucide-react';
import {
  CHARGER_PRESETS,
  CAPACITY_PRESETS,
  useBatteryTelemetry,
} from './engine/batteryEngine';
import { TEMPLATES, ACCENT_COLORS, FONT_PRESETS } from './templates';
import { CLOCK_STYLES, BG_PRESETS, ClockWidget } from './components/ClockWidgets';

const APP_VERSION = '0.0.3';
const RELEASES_API = 'https://api.github.com/repos/kabirprokk/osien-volt/releases/latest';

function isNewerVersion(latestTag, current) {
  const a = latestTag.replace(/^v/i, '').split('.').map(Number);
  const b = current.replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

function loadPos(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch {
    // Ignore
  }
  return fallback;
}

export default function App() {
  // True Lockscreen AOD mode (zero controls shown when launched from lockscreen)
  const [isAodLocked, setIsAodLocked] = useState(() => {
    if (typeof window !== 'undefined' && window.AndroidBattery && window.AndroidBattery.isAodLaunch) {
      try {
        return Boolean(window.AndroidBattery.isAodLaunch());
      } catch {
        return false;
      }
    }
    return false;
  });

  const [tplIndex, setTplIndex] = useState(() => {
    const saved = Number(localStorage.getItem('ov_tpl') || 0);
    return Number.isFinite(saved) && saved >= 0 && saved < TEMPLATES.length ? saved : 0;
  });
  const [sheetTab, setSheetTab] = useState(null); // null | 'style' | 'aod'
  const [editLayout, setEditLayout] = useState(false);

  // Customizer theme state
  const [accent, setAccent] = useState(() => localStorage.getItem('ov_accent') || '#10b981');
  const [fontId, setFontId] = useState(() => localStorage.getItem('ov_font') || 'display');
  const [glow, setGlow] = useState(() => Number(localStorage.getItem('ov_glow') ?? 45));
  const [showTelemetry, setShowTelemetry] = useState(() => localStorage.getItem('ov_tele') !== 'false');
  const [clockStyle, setClockStyle] = useState(() => localStorage.getItem('ov_clock_style') || 'minimal');
  const [bgId, setBgId] = useState(() => localStorage.getItem('ov_bg') || 'oled');
  const [customBgUrl, setCustomBgUrl] = useState(() => localStorage.getItem('ov_custom_bg') || '');
  const [bgDim, setBgDim] = useState(() => Number(localStorage.getItem('ov_bg_dim') ?? 45));

  // Drag-and-drop widget offsets (in px relative to default position)
  const [clockPos, setClockPos] = useState(() => loadPos('ov_pos_clock', { x: 0, y: 0 }));
  const [batPos, setBatPos] = useState(() => loadPos('ov_pos_bat', { x: 0, y: 0 }));
  const dragRef = useRef(null);

  // AOD & Calibration state
  const [mode, setMode] = useState('auto');
  const [chargerId, setChargerId] = useState(() => localStorage.getItem('ov_charger') || 'turbo-67w');
  const [capacityMah, setCapacityMah] = useState(() => Number(localStorage.getItem('ov_cap') || 5000));
  const [simCharging, setSimCharging] = useState(true);
  const [smartLimitPct, setSmartLimitPct] = useState(0);
  const [aodEnabled, setAodEnabled] = useState(() => localStorage.getItem('ov_aod_on') !== 'false');
  const [aodChargingOnly, setAodChargingOnly] = useState(() => localStorage.getItem('ov_aod_chg') === 'true');
  const [aodBrightness, setAodBrightness] = useState(() => Number(localStorage.getItem('ov_bright') || 35));
  const [now, setNow] = useState(() => new Date());
  const [burnInOffset, setBurnInOffset] = useState({ x: 0, y: 0 });
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updating, setUpdating] = useState(false);

  const lastTapRef = useRef(0);
  const touchStartX = useRef(null);
  const fileInputRef = useRef(null);

  const fontPreset = FONT_PRESETS.find((f) => f.id === fontId) || FONT_PRESETS[0];
  const theme = {
    accent,
    font: fontPreset.family,
    weight: fontPreset.weight,
    glow,
    showTelemetry,
  };

  // Listen for native Android onNewIntent AOD mode changes
  useEffect(() => {
    const onAodEvent = (e) => {
      setIsAodLocked(Boolean(e.detail));
      if (e.detail) {
        setSheetTab(null);
        setEditLayout(false);
      }
    };
    window.addEventListener('osien-aod-mode', onAodEvent);
    return () => window.removeEventListener('osien-aod-mode', onAodEvent);
  }, []);

  // Check GitHub Releases for OTA update
  useEffect(() => {
    let active = true;
    fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data || !data.tag_name) return;
        if (isNewerVersion(data.tag_name, APP_VERSION)) {
          const apkAsset = (data.assets || []).find((a) => a.name && a.name.endsWith('.apk'));
          setUpdateInfo({
            version: data.tag_name,
            apkUrl: apkAsset ? apkAsset.browser_download_url : data.html_url,
          });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const triggerUpdate = () => {
    if (!updateInfo || updating) return;
    setUpdating(true);
    if (typeof window !== 'undefined' && window.AndroidBattery && window.AndroidBattery.downloadAndInstallUpdate) {
      window.AndroidBattery.downloadAndInstallUpdate(updateInfo.apkUrl);
    } else {
      window.open(updateInfo.apkUrl, '_blank');
      setUpdating(false);
    }
  };

  // Persist all customizations
  useEffect(() => {
    localStorage.setItem('ov_tpl', String(tplIndex));
    localStorage.setItem('ov_accent', accent);
    localStorage.setItem('ov_font', fontId);
    localStorage.setItem('ov_glow', String(glow));
    localStorage.setItem('ov_tele', String(showTelemetry));
    localStorage.setItem('ov_clock_style', clockStyle);
    localStorage.setItem('ov_bg', bgId);
    localStorage.setItem('ov_bg_dim', String(bgDim));
    localStorage.setItem('ov_pos_clock', JSON.stringify(clockPos));
    localStorage.setItem('ov_pos_bat', JSON.stringify(batPos));
    localStorage.setItem('ov_charger', chargerId);
    localStorage.setItem('ov_cap', String(capacityMah));
    localStorage.setItem('ov_aod_on', String(aodEnabled));
    localStorage.setItem('ov_aod_chg', String(aodChargingOnly));
    localStorage.setItem('ov_bright', String(aodBrightness));

    if (typeof window !== 'undefined' && window.AndroidBattery) {
      try {
        window.AndroidBattery.setAodConfig(aodEnabled, aodChargingOnly);
        window.AndroidBattery.setAodBrightness(Math.max(0.03, aodBrightness / 100));
      } catch {
        // Ignore
      }
    }
  }, [tplIndex, accent, fontId, glow, showTelemetry, clockStyle, bgId, bgDim, clockPos, batPos, chargerId, capacityMah, aodEnabled, aodChargingOnly, aodBrightness]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setBurnInOffset({
        x: Math.round((Math.random() - 0.5) * 8),
        y: Math.round((Math.random() - 0.5) * 8),
      });
    }, 45000);
    return () => clearInterval(id);
  }, []);

  const { telemetry, setManualPct } = useBatteryTelemetry({
    mode,
    chargerId,
    capacityMah,
    simCharging,
    simStartPct: 54.347,
    smartLimitPct,
  });

  const activeTemplate = TEMPLATES[tplIndex];
  const TemplateComponent = activeTemplate.component;
  const bgPreset = BG_PRESETS.find((b) => b.id === bgId) || BG_PRESETS[0];
  const isLight = bgId === 'custom' ? false : (bgPreset.light || activeTemplate.light);

  // Handle custom wallpaper upload from phone files (compressed to fit localStorage)
  const handleBgUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1080;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        try {
          localStorage.setItem('ov_custom_bg', dataUrl);
          setCustomBgUrl(dataUrl);
          setBgId('custom');
        } catch {
          // Ignore quota error
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // Drag-and-drop handlers for Edit Layout mode
  const startDrag = (target, e) => {
    if (!editLayout) return;
    e.stopPropagation();
    const startPos = target === 'clock' ? clockPos : batPos;
    dragRef.current = {
      target,
      startX: e.clientX,
      startY: e.clientY,
      origX: startPos.x,
      origY: startPos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e) => {
    if (!dragRef.current) return;
    const { target, startX, startY, origX, origY } = dragRef.current;
    const next = {
      x: Math.round(origX + (e.clientX - startX)),
      y: Math.round(origY + (e.clientY - startY)),
    };
    if (target === 'clock') setClockPos(next);
    else setBatPos(next);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const onTouchStart = (e) => {
    if (isAodLocked || editLayout) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (isAodLocked || editLayout || touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 55) {
      setTplIndex((i) => (dx < 0 ? (i + 1) % TEMPLATES.length : (i - 1 + TEMPLATES.length) % TEMPLATES.length));
    }
  };

  // Controls are ONLY shown when inside the app (never on Lockscreen AOD!)
  const showControls = !isAodLocked;

  return (
    <div
      className="app-shell"
      style={
        bgId === 'custom' && customBgUrl
          ? { backgroundImage: `url(${customBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : bgPreset.style
      }
    >
      {/* Background dimmer for custom wallpaper */}
      {bgId === 'custom' && customBgUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: `rgba(0,0,0,${bgDim / 100})`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Top minimal HUD (hidden completely in Lockscreen AOD mode) */}
      {showControls && (
        <div className="hud-top">
          <button className={`hud-pill ${isLight ? 'light-surface' : ''}`} onClick={() => setSheetTab('aod')}>
            <span className={`hud-dot ${telemetry.source === 'simulated' ? 'sim' : ''}`} />
            <span style={{ fontWeight: 600 }}>OSIEN Volt</span>
            <span style={{ opacity: 0.45 }}>·</span>
            <span>{editLayout ? 'Drag Widgets' : activeTemplate.name}</span>
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`hud-pill ${isLight ? 'light-surface' : ''}`}
              style={editLayout ? { background: '#10b981', color: '#022c22', borderColor: '#10b981' } : undefined}
              onClick={() => setEditLayout((v) => !v)}
              title="Drag & Drop Layout"
            >
              <Move size={14} />
            </button>
            <button className={`hud-pill ${isLight ? 'light-surface' : ''}`} onClick={() => setSheetTab('style')} title="Customize">
              <Palette size={14} />
            </button>
            <button className={`hud-pill ${isLight ? 'light-surface' : ''}`} onClick={() => setSheetTab('aod')} title="AOD & Battery">
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Automatic OTA Update Banner (only in app mode) */}
      {showControls && updateInfo && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(var(--safe-top) + 52px)',
            left: 16,
            right: 16,
            zIndex: 45,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            className="hud-pill"
            style={{
              pointerEvents: 'auto',
              background: 'rgba(16, 185, 129, 0.2)',
              borderColor: 'rgba(16, 185, 129, 0.5)',
              color: '#ecfdf5',
              padding: '7px 14px',
              gap: 10,
            }}
          >
            <Download size={13} color="#34d399" />
            <span>Update {updateInfo.version} available</span>
            <button
              onClick={triggerUpdate}
              style={{
                background: '#10b981',
                color: '#022c22',
                border: 'none',
                borderRadius: 99,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {updating ? 'Downloading...' : 'Update'}
            </button>
          </div>
        </div>
      )}

      {/* Main full-bleed stage */}
      <div
        className="template-stage"
        style={{
          zIndex: 1,
          transform: `translate(${burnInOffset.x}px, ${burnInOffset.y}px)`,
          transition: 'transform 1.2s ease',
        }}
        onClick={() => {
          if (sheetTab || editLayout) return;
          if (isAodLocked) {
            const nowMs = Date.now();
            if (nowMs - lastTapRef.current < 320) {
              if (typeof window !== 'undefined' && window.AndroidBattery) {
                window.AndroidBattery.unlockDevice();
              } else {
                setIsAodLocked(false);
              }
              lastTapRef.current = 0;
              return;
            }
            lastTapRef.current = nowMs;
          }
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Draggable Clock Widget */}
        {clockStyle !== 'off' && (
          <div
            onPointerDown={(e) => startDrag('clock', e)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            style={{
              position: 'absolute',
              top: 'calc(var(--safe-top) + 74px)',
              left: 0,
              right: 0,
              zIndex: 20,
              display: 'flex',
              justifyContent: 'center',
              transform: `translate(${clockPos.x}px, ${clockPos.y}px)`,
              touchAction: editLayout ? 'none' : 'auto',
              cursor: editLayout ? 'grab' : 'default',
            }}
          >
            <div
              style={
                editLayout
                  ? { padding: '10px 18px', borderRadius: 16, border: '1.5px dashed rgba(16,185,129,0.75)', background: 'rgba(16,185,129,0.08)' }
                  : undefined
              }
            >
              <ClockWidget styleId={clockStyle} now={now} accent={accent} light={isLight} />
            </div>
          </div>
        )}

        {/* Draggable Battery % Template */}
        <div
          onPointerDown={(e) => startDrag('bat', e)}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${batPos.x}px, ${batPos.y}px)`,
            touchAction: editLayout ? 'none' : 'auto',
            cursor: editLayout ? 'grab' : 'default',
            outline: editLayout ? '1.5px dashed rgba(255,255,255,0.35)' : 'none',
            outlineOffset: -18,
          }}
        >
          <TemplateComponent t={telemetry} theme={theme} />
        </div>
      </div>

      {/* Bottom bar (template strip or Edit Layout reset bar — hidden in Lockscreen AOD) */}
      {showControls && (
        <div className="hud-bottom">
          {editLayout ? (
            <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
              <button
                className="hud-pill"
                onClick={() => {
                  setClockPos({ x: 0, y: 0 });
                  setBatPos({ x: 0, y: 0 });
                }}
              >
                <RotateCcw size={13} />
                <span>Reset Positions</span>
              </button>
              <button
                className="hud-pill"
                style={{ background: '#10b981', color: '#022c22', borderColor: '#10b981', fontWeight: 600 }}
                onClick={() => setEditLayout(false)}
              >
                Done
              </button>
            </div>
          ) : (
            <div className={`template-strip ${isLight ? 'light-surface' : ''}`}>
              {TEMPLATES.map((tpl, idx) => (
                <button key={tpl.id} className={`tpl-chip ${idx === tplIndex ? 'active' : ''}`} onClick={() => setTplIndex(idx)}>
                  {tpl.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hidden file input for custom background photo */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload} />

      {/* Customizer & AOD Bottom Sheet */}
      {showControls && sheetTab && (
        <div className="sheet-backdrop" onClick={() => setSheetTab(null)}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
              <button className={`opt-btn ${sheetTab === 'style' ? 'active' : ''}`} onClick={() => setSheetTab('style')}>
                Customize Style
              </button>
              <button className={`opt-btn ${sheetTab === 'aod' ? 'active' : ''}`} onClick={() => setSheetTab('aod')}>
                AOD & Battery
              </button>
            </div>

            {sheetTab === 'style' ? (
              <>
                <div className="sheet-section">
                  <div className="sheet-label">Clock Style</div>
                  <div className="chip-grid">
                    {CLOCK_STYLES.map((c) => (
                      <button key={c.id} className={`opt-btn ${clockStyle === c.id ? 'active' : ''}`} onClick={() => setClockStyle(c.id)}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sheet-section">
                  <div className="sheet-label">Background & Custom Photo</div>
                  <div className="chip-grid" style={{ marginBottom: 8 }}>
                    {BG_PRESETS.map((b) => (
                      <button key={b.id} className={`opt-btn ${bgId === b.id ? 'active' : ''}`} onClick={() => setBgId(b.id)}>
                        {b.label}
                      </button>
                    ))}
                    <button
                      className={`opt-btn ${bgId === 'custom' ? 'active' : ''}`}
                      style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    >
                      <ImageIcon size={13} />
                      <span>{customBgUrl ? 'Change Photo' : 'Pick From Files'}</span>
                    </button>
                  </div>
                  {bgId === 'custom' && (
                    <div className="toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>Photo Dimmer</span>
                        <span className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>{bgDim}%</span>
                      </div>
                      <input type="range" min="0" max="85" step="5" value={bgDim} onChange={(e) => setBgDim(Number(e.target.value))} className="range-input" />
                    </div>
                  )}
                </div>

                <div className="sheet-section">
                  <div className="sheet-label">Accent Color</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setAccent(c.value)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: c.value,
                          border: accent === c.value ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                          boxShadow: accent === c.value ? `0 0 12px ${c.value}` : 'none',
                          cursor: 'pointer',
                        }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="sheet-section">
                  <div className="sheet-label">Typography</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {FONT_PRESETS.map((f) => (
                      <button key={f.id} className={`opt-btn ${fontId === f.id ? 'active' : ''}`} onClick={() => setFontId(f.id)}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sheet-section">
                  <div className="toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>Glow Intensity</span>
                      <span className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>{glow}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={glow} onChange={(e) => setGlow(Number(e.target.value))} className="range-input" />
                  </div>
                  <div className="toggle-row">
                    <span style={{ fontSize: 13 }}>Minimal V · mA Hairline</span>
                    <button className={`opt-btn ${showTelemetry ? 'active' : ''}`} style={{ padding: '6px 14px' }} onClick={() => setShowTelemetry((v) => !v)}>
                      {showTelemetry ? 'Shown' : 'Pure %'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="sheet-section">
                  <div className="sheet-label">Always-On Display (v{APP_VERSION})</div>
                  <div className="toggle-row">
                    <span style={{ fontSize: 13 }}>AOD Active on Lockscreen</span>
                    <button className={`opt-btn ${aodEnabled ? 'active' : ''}`} style={{ padding: '6px 14px' }} onClick={() => setAodEnabled((v) => !v)}>
                      {aodEnabled ? 'Started' : 'Stopped'}
                    </button>
                  </div>
                  <div className="toggle-row">
                    <span style={{ fontSize: 13 }}>Activation Trigger</span>
                    <button className="opt-btn active" style={{ padding: '6px 12px' }} onClick={() => setAodChargingOnly((v) => !v)}>
                      {aodChargingOnly ? 'Charging Only' : 'Always on Lock'}
                    </button>
                  </div>
                  <div className="toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>AMOLED Dimmer (Pocket Mode Auto-Off)</span>
                      <span className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>{aodBrightness}%</span>
                    </div>
                    <input type="range" min="5" max="100" step="5" value={aodBrightness} onChange={(e) => setAodBrightness(Number(e.target.value))} className="range-input" />
                  </div>
                  {typeof window !== 'undefined' && window.AndroidBattery && (
                    <div className="toggle-row">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Grant Lockscreen Permissions</div>
                        <div style={{ fontSize: 11, color: '#71717a' }}>Overlay + Unrestricted Battery</div>
                      </div>
                      <button className="opt-btn active" style={{ padding: '7px 14px' }} onClick={() => window.AndroidBattery.requestAodPermissions()}>
                        Enable
                      </button>
                    </div>
                  )}
                </div>

                <div className="sheet-section">
                  <div className="sheet-label">Battery Capacity (exact coulomb math)</div>
                  <div className="chip-grid">
                    {CAPACITY_PRESETS.map((cap) => (
                      <button key={cap} className={`opt-btn ${capacityMah === cap ? 'active' : ''}`} onClick={() => setCapacityMah(cap)}>
                        {cap} mAh
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sheet-section">
                  <div className="sheet-label">Sensor / Test Mode</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <button className={`opt-btn ${mode === 'auto' ? 'active' : ''}`} onClick={() => setMode('auto')}>
                      Auto Hardware
                    </button>
                    <button className={`opt-btn ${mode === 'simulate' ? 'active' : ''}`} onClick={() => setMode('simulate')}>
                      Test Sim
                    </button>
                  </div>
                  {telemetry.source === 'simulated' && (
                    <>
                      <div className="chip-grid" style={{ marginBottom: 8 }}>
                        {CHARGER_PRESETS.map((c) => (
                          <button key={c.id} className={`opt-btn ${chargerId === c.id ? 'active' : ''}`} onClick={() => setChargerId(c.id)}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="toggle-row">
                        <span style={{ fontSize: 12 }}>Test Smart Charge Pause</span>
                        <button
                          className={`opt-btn ${smartLimitPct > 0 ? 'active' : ''}`}
                          style={{ padding: '5px 12px' }}
                          onClick={() => setSmartLimitPct((v) => (v === 0 ? 85 : 0))}
                        >
                          {smartLimitPct > 0 ? `Stop @ ${smartLimitPct}%` : 'Off'}
                        </button>
                      </div>
                      <div className="toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span>Test Level</span>
                          <span className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>{telemetry.pct.toFixed(3)}%</span>
                        </div>
                        <input type="range" min="1" max="99" value={Math.round(telemetry.pct)} onChange={(e) => setManualPct(Number(e.target.value) + 0.347)} className="range-input" />
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
