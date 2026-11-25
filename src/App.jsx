import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Palette, Download, Move, RotateCcw, Image as ImageIcon } from 'lucide-react';
import {
  CAPACITY_PRESETS,
  useBatteryTelemetry,
} from './engine/batteryEngine';
import { TEMPLATES, ACCENT_COLORS, FONT_PRESETS } from './templates';
import { CLOCK_STYLES, BG_PRESETS, ClockWidget } from './components/ClockWidgets';
import LauncherHome from './launcher/LauncherHome';

const APP_VERSION = '0.1.4';
const POPUP_STYLES = [
  { id: 'island', label: 'Dynamic Island' },
  { id: 'edge', label: 'Edge Glow' },
  { id: 'glass', label: 'Glass Card' },
  { id: 'nothing', label: 'Nothing Dot' },
  { id: 'dock', label: 'Bottom Dock' },
  { id: 'float', label: 'Pure Float' },
];
const RELEASES_API = 'https://api.github.com/repos/kabirprokk/OSIEN-Launcher/releases/latest';

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

function BatteryApp({ onExitHome }) {
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

  // Drag-and-drop + scale widget state (Clock, Battery, Custom Signature)
  const [clockPos, setClockPos] = useState(() => loadPos('ov_pos_clock', { x: 0, y: 0 }));
  const [batPos, setBatPos] = useState(() => loadPos('ov_pos_bat', { x: 0, y: 0 }));
  const [sigPos, setSigPos] = useState(() => loadPos('ov_pos_sig', { x: 0, y: 0 }));
  const [clockScale, setClockScale] = useState(() => Number(localStorage.getItem('ov_sc_clock') || 100));
  const [batScale, setBatScale] = useState(() => Number(localStorage.getItem('ov_sc_bat') || 100));
  const [sigScale, setSigScale] = useState(() => Number(localStorage.getItem('ov_sc_sig') || 100));
  const [sigText, setSigText] = useState(() => localStorage.getItem('ov_sig_text') || 'OSIEN');
  const [showSig, setShowSig] = useState(() => localStorage.getItem('ov_sig_show') === 'true');
  const [selectedWidget, setSelectedWidget] = useState('bat'); // 'clock' | 'bat' | 'sig'
  const dragRef = useRef(null);

  // AOD & Calibration state (real hardware only)
  const [capacityMah, setCapacityMah] = useState(() => Number(localStorage.getItem('ov_cap') || 5000));
  const [aodEnabled, setAodEnabled] = useState(() => localStorage.getItem('ov_aod_on') !== 'false');
  const [aodChargingOnly, setAodChargingOnly] = useState(() => localStorage.getItem('ov_aod_chg') === 'true');
  const [aodBrightness, setAodBrightness] = useState(() => Number(localStorage.getItem('ov_bright') || 35));
  const [popupEnabled, setPopupEnabled] = useState(() => localStorage.getItem('ov_pop_on') !== 'false');
  const [popupStyle, setPopupStyle] = useState(() => localStorage.getItem('ov_pop_style') || 'island');
  const [popupDelayMs, setPopupDelayMs] = useState(() => Number(localStorage.getItem('ov_pop_delay') ?? 2800));
  const [now, setNow] = useState(() => new Date());
  const [burnInOffset, setBurnInOffset] = useState({ x: 0, y: 0 });
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [permStatus, setPermStatus] = useState({ overlay: true, battery: true, install: true });
  const [setupDismissed, setSetupDismissed] = useState(false);

  // Check native Android permissions on launch & whenever returning from Android Settings
  useEffect(() => {
    const checkPerms = () => {
      if (typeof window !== 'undefined' && window.AndroidBattery && window.AndroidBattery.getPermissionStatus) {
        try {
          const parsed = JSON.parse(window.AndroidBattery.getPermissionStatus());
          setPermStatus(parsed);
        } catch {
          // Ignore
        }
      }
    };
    checkPerms();
    window.addEventListener('focus', checkPerms);
    document.addEventListener('visibilitychange', checkPerms);
    return () => {
      window.removeEventListener('focus', checkPerms);
      document.removeEventListener('visibilitychange', checkPerms);
    };
  }, []);

  const needsSetup = !isAodLocked && !setupDismissed && (!permStatus.overlay || !permStatus.battery);

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
    localStorage.setItem('ov_pos_sig', JSON.stringify(sigPos));
    localStorage.setItem('ov_sc_clock', String(clockScale));
    localStorage.setItem('ov_sc_bat', String(batScale));
    localStorage.setItem('ov_sc_sig', String(sigScale));
    localStorage.setItem('ov_sig_text', sigText);
    localStorage.setItem('ov_sig_show', String(showSig));
    localStorage.setItem('ov_cap', String(capacityMah));
    localStorage.setItem('ov_aod_on', String(aodEnabled));
    localStorage.setItem('ov_aod_chg', String(aodChargingOnly));
    localStorage.setItem('ov_bright', String(aodBrightness));
    localStorage.setItem('ov_pop_on', String(popupEnabled));
    localStorage.setItem('ov_pop_style', popupStyle);
    localStorage.setItem('ov_pop_delay', String(popupDelayMs));

    if (typeof window !== 'undefined' && window.AndroidBattery) {
      try {
        window.AndroidBattery.setAodConfig(aodEnabled, aodChargingOnly);
        window.AndroidBattery.setAodBrightness(Math.max(0.03, aodBrightness / 100));
        if (window.AndroidBattery.setPopupConfig) {
          window.AndroidBattery.setPopupConfig(popupEnabled, popupStyle, popupDelayMs, accent);
        }
      } catch {
        // Ignore
      }
    }
  }, [tplIndex, accent, fontId, glow, showTelemetry, clockStyle, bgId, bgDim, clockPos, batPos, sigPos, clockScale, batScale, sigScale, sigText, showSig, capacityMah, aodEnabled, aodChargingOnly, aodBrightness, popupEnabled, popupStyle, popupDelayMs]);

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

  const { telemetry } = useBatteryTelemetry({ capacityMah });

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

  // Drag-and-drop handlers for Studio Edit Mode
  const startDrag = (target, e) => {
    if (!editLayout) return;
    e.stopPropagation();
    setSelectedWidget(target);
    const startPos = target === 'clock' ? clockPos : target === 'sig' ? sigPos : batPos;
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
    else if (target === 'sig') setSigPos(next);
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
          {onExitHome && <button className="hud-pill" onClick={onExitHome}>OSIEN Home</button>}
          <button className={`hud-pill ${isLight ? 'light-surface' : ''}`} onClick={() => setSheetTab('aod')}>
            <img src="/logo.png" alt="OSIEN" style={{ width: 18, height: 18, borderRadius: 5, objectFit: 'cover' }} />
            <span style={{ fontWeight: 600 }}>OSIEN Launcher</span>
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
        {/* Draggable & Scalable Clock Widget */}
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
              zIndex: 22,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: editLayout ? 'auto' : 'none',
              transform: `translate(${clockPos.x}px, ${clockPos.y}px) scale(${clockScale / 100})`,
              touchAction: editLayout ? 'none' : 'auto',
              cursor: editLayout ? 'grab' : 'default',
            }}
          >
            <div
              style={
                editLayout
                  ? {
                      padding: '10px 18px',
                      borderRadius: 16,
                      border: selectedWidget === 'clock' ? '2px dashed #10b981' : '1.5px dashed rgba(255,255,255,0.35)',
                      background: selectedWidget === 'clock' ? 'rgba(16,185,129,0.12)' : 'transparent',
                    }
                  : undefined
              }
            >
              <ClockWidget styleId={clockStyle} now={now} accent={accent} light={isLight} />
            </div>
          </div>
        )}

        {/* Draggable & Scalable Battery % Template */}
        <div
          onPointerDown={(e) => startDrag('bat', e)}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${batPos.x}px, ${batPos.y}px) scale(${batScale / 100})`,
            touchAction: editLayout ? 'none' : 'auto',
            cursor: editLayout ? 'grab' : 'default',
            outline: editLayout ? (selectedWidget === 'bat' ? '2px dashed #10b981' : '1.5px dashed rgba(255,255,255,0.3)') : 'none',
            outlineOffset: -24,
          }}
        >
          <TemplateComponent t={telemetry} theme={theme} />
        </div>

        {/* Draggable & Scalable Custom Signature / Text Widget */}
        {showSig && (
          <div
            onPointerDown={(e) => startDrag('sig', e)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            style={{
              position: 'absolute',
              bottom: 'calc(var(--safe-bottom) + 92px)',
              left: 0,
              right: 0,
              zIndex: 21,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: editLayout ? 'auto' : 'none',
              transform: `translate(${sigPos.x}px, ${sigPos.y}px) scale(${sigScale / 100})`,
              touchAction: editLayout ? 'none' : 'auto',
              cursor: editLayout ? 'grab' : 'default',
            }}
          >
            <div
              style={{
                fontFamily: theme.font,
                fontSize: 13,
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color: isLight ? 'rgba(24,24,27,0.65)' : 'rgba(255,255,255,0.65)',
                padding: editLayout ? '8px 14px' : 0,
                borderRadius: 12,
                border: editLayout ? (selectedWidget === 'sig' ? '2px dashed #10b981' : '1.5px dashed rgba(255,255,255,0.3)') : 'none',
              }}
            >
              {sigText}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar (template strip or Edit Layout reset bar — hidden in Lockscreen AOD) */}
      {showControls && (
        <div className="hud-bottom">
          {editLayout ? (
            <div
              style={{
                pointerEvents: 'auto',
                width: '100%',
                maxWidth: 360,
                padding: '12px 14px',
                borderRadius: 20,
                background: 'rgba(16,16,20,0.88)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.14)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: '#a1a1aa' }}>
                  Resize <strong style={{ color: '#fff' }}>{selectedWidget === 'clock' ? 'Clock' : selectedWidget === 'sig' ? 'Text' : 'Battery %'}</strong>
                </span>
                <span className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>
                  {selectedWidget === 'clock' ? clockScale : selectedWidget === 'sig' ? sigScale : batScale}%
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="160"
                step="5"
                value={selectedWidget === 'clock' ? clockScale : selectedWidget === 'sig' ? sigScale : batScale}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (selectedWidget === 'clock') setClockScale(v);
                  else if (selectedWidget === 'sig') setSigScale(v);
                  else setBatScale(v);
                }}
                className="range-input"
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <button
                  className="hud-pill"
                  onClick={() => {
                    setClockPos({ x: 0, y: 0 });
                    setBatPos({ x: 0, y: 0 });
                    setSigPos({ x: 0, y: 0 });
                    setClockScale(100);
                    setBatScale(100);
                    setSigScale(100);
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Reset All</span>
                </button>
                <button
                  className="hud-pill"
                  style={{ background: '#10b981', color: '#022c22', borderColor: '#10b981', fontWeight: 600 }}
                  onClick={() => setEditLayout(false)}
                >
                  Done
                </button>
              </div>
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

      {/* Guided First-Run Setup Wizard (auto-appears until Always-on-Top & Battery permissions are granted) */}
      {needsSetup && (
        <div className="sheet-backdrop" style={{ alignItems: 'center', padding: 20 }}>
          <div className="sheet-panel" style={{ borderRadius: 24, padding: 24, maxWidth: 380 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <img src="/logo.png" alt="OSIEN" style={{ width: 32, height: 32, borderRadius: 9, objectFit: 'cover' }} />
              <div style={{ fontSize: 18, fontWeight: 600 }}>Quick Setup · OSIEN Launcher</div>
            </div>
            <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 18, lineHeight: 1.5 }}>
              Enable these 2 Android permissions so OSIEN Launcher can show automatically over your lockscreen when your screen turns off.
            </div>

            <div className="toggle-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>1. Display Over Other Apps</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>Required for Lockscreen AOD</div>
              </div>
              <button
                className={`opt-btn ${permStatus.overlay ? '' : 'active'}`}
                style={{ padding: '6px 14px' }}
                onClick={() => window.AndroidBattery && window.AndroidBattery.requestOverlayPermission()}
              >
                {permStatus.overlay ? '✓ Done' : 'Allow'}
              </button>
            </div>

            <div className="toggle-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>2. Unrestricted Battery</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>Keeps AOD active in background</div>
              </div>
              <button
                className={`opt-btn ${permStatus.battery ? '' : 'active'}`}
                style={{ padding: '6px 14px' }}
                onClick={() => window.AndroidBattery && window.AndroidBattery.requestBatteryPermission()}
              >
                {permStatus.battery ? '✓ Done' : 'Allow'}
              </button>
            </div>

            <div className="toggle-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>3. Auto-Updates (Optional)</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>Allow installing future OTA releases</div>
              </div>
              <button
                className={`opt-btn ${permStatus.install ? '' : 'active'}`}
                style={{ padding: '6px 14px' }}
                onClick={() => window.AndroidBattery && window.AndroidBattery.requestInstallPermission()}
              >
                {permStatus.install ? '✓ Done' : 'Allow'}
              </button>
            </div>

            <button
              className="opt-btn"
              style={{ width: '100%', marginTop: 12, textAlign: 'center' }}
              onClick={() => setSetupDismissed(true)}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

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
                  <div className="sheet-label">Accent Color (or pick any custom color)</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      title="Custom Hex Color"
                    />
                  </div>
                </div>

                <div className="sheet-section">
                  <div className="sheet-label">Custom Lockscreen Signature</div>
                  <div className="toggle-row">
                    <span style={{ fontSize: 13 }}>Show Custom Text</span>
                    <button className={`opt-btn ${showSig ? 'active' : ''}`} style={{ padding: '6px 14px' }} onClick={() => setShowSig((v) => !v)}>
                      {showSig ? 'On' : 'Off'}
                    </button>
                  </div>
                  {showSig && (
                    <input
                      type="text"
                      value={sigText}
                      maxLength={28}
                      onChange={(e) => setSigText(e.target.value)}
                      placeholder="Your name or quote..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.14)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  )}
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
                  <div className="sheet-label">Charger Connected Pop-Up (All Phones)</div>
                  <div className="toggle-row">
                    <span style={{ fontSize: 13 }}>Minimal On-Screen Pop-Up</span>
                    <button className={`opt-btn ${popupEnabled ? 'active' : ''}`} style={{ padding: '6px 14px' }} onClick={() => setPopupEnabled((v) => !v)}>
                      {popupEnabled ? 'On' : 'Off'}
                    </button>
                  </div>
                  <div className="chip-grid" style={{ marginBottom: 8 }}>
                    {POPUP_STYLES.map((p) => (
                      <button key={p.id} className={`opt-btn ${popupStyle === p.id ? 'active' : ''}`} onClick={() => setPopupStyle(p.id)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>Delay after OEM Ring (Samsung/MIUI)</span>
                      <span className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>{(popupDelayMs / 1000).toFixed(1)}s</span>
                    </div>
                    <input type="range" min="0" max="5000" step="200" value={popupDelayMs} onChange={(e) => setPopupDelayMs(Number(e.target.value))} className="range-input" />
                  </div>
                  {typeof window !== 'undefined' && window.AndroidBattery && window.AndroidBattery.testChargingPopup && (
                    <button
                      className="opt-btn active"
                      style={{ width: '100%', padding: '10px', marginTop: 4 }}
                      onClick={() => window.AndroidBattery.testChargingPopup()}
                    >
                      Test Charging Pop-Up Now
                    </button>
                  )}
                </div>

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
                  <div className="sheet-label">Battery Capacity (for precise percentage)</div>
                  <div style={{ fontSize: 11, color: '#71717a', marginBottom: 10 }}>
                    The Android charge counter is divided by this capacity. Use your battery's full-charge capacity for the closest percentage.
                  </div>
                  <input
                    type="number"
                    min="1000"
                    max="20000"
                    step="50"
                    value={capacityMah}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isFinite(value) && value >= 1000 && value <= 20000) setCapacityMah(value);
                    }}
                    className="text-input"
                    aria-label="Battery capacity in milliamp-hours"
                  />
                  <div className="chip-grid">
                    {CAPACITY_PRESETS.map((cap) => (
                      <button key={cap} className={`opt-btn ${capacityMah === cap ? 'active' : ''}`} onClick={() => setCapacityMah(cap)}>
                        {cap} mAh
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState(() => {
    const aod = Boolean(window.AndroidBattery?.isAodLaunch?.());
    const battery = new URLSearchParams(window.location.search).get('view') === 'battery';
    return aod || battery ? 'battery' : 'home';
  });
  const [homeUpdate, setHomeUpdate] = useState(null);
  const [homeUpdating, setHomeUpdating] = useState(false);

  useEffect(() => {
    const onLaunchMode = (event) => setView(event.detail?.aod ? 'battery' : 'home');
    const onBattery = () => setView('battery');
    window.addEventListener('osien-launch-mode', onLaunchMode);
    window.addEventListener('osien-open-battery', onBattery);
    return () => {
      window.removeEventListener('osien-launch-mode', onLaunchMode);
      window.removeEventListener('osien-open-battery', onBattery);
    };
  }, []);

  // Global OTA update check so the banner appears right on the Home Screen too
  useEffect(() => {
    let active = true;
    fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data || !data.tag_name) return;
        if (isNewerVersion(data.tag_name, APP_VERSION)) {
          const apkAsset = (data.assets || []).find((a) => a.name && a.name.endsWith('.apk'));
          setHomeUpdate({
            version: data.tag_name,
            apkUrl: apkAsset ? apkAsset.browser_download_url : data.html_url,
          });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const triggerHomeUpdate = () => {
    if (!homeUpdate || homeUpdating) return;
    setHomeUpdating(true);
    if (typeof window !== 'undefined' && window.AndroidBattery?.downloadAndInstallUpdate) {
      window.AndroidBattery.downloadAndInstallUpdate(homeUpdate.apkUrl);
    } else {
      window.open(homeUpdate.apkUrl, '_blank');
      setHomeUpdating(false);
    }
  };

  return (
    <>
      {view === 'battery' ? <BatteryApp onExitHome={() => setView('home')} /> : <LauncherHome />}
      {view === 'home' && homeUpdate && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(var(--safe-top) + 56px)',
            left: 16,
            right: 16,
            zIndex: 80,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            className="hud-pill"
            style={{
              pointerEvents: 'auto',
              background: 'rgba(16, 185, 129, 0.22)',
              borderColor: 'rgba(16, 185, 129, 0.55)',
              color: '#ecfdf5',
              padding: '7px 14px',
              gap: 10,
            }}
          >
            <Download size={13} color="#34d399" />
            <span>Update {homeUpdate.version} available</span>
            <button
              onClick={triggerHomeUpdate}
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
              {homeUpdating ? 'Downloading...' : 'Update'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
