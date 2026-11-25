import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryCharging, Bluetooth, Image as ImageIcon, Lock, MoreHorizontal,
  Plane, Search, Settings, Sun, Volume2, Wifi, X, Radio, MinusCircle,
} from 'lucide-react';
import { useBatteryTelemetry, splitPct } from '../engine/batteryEngine';
import './launcher.css';

const DEFAULT_GESTURE = ['UP', 'TAP', 'RIGHT', 'LEFT', 'DOWN'];

const WALLPAPERS = [
  { id: 'obsidian', name: 'Obsidian Aurora', css: 'radial-gradient(ellipse at 20% 12%, rgba(56,189,248,0.26), transparent 48%), radial-gradient(ellipse at 82% 80%, rgba(139,92,246,0.24), transparent 52%), linear-gradient(160deg, #05070c 0%, #090d18 100%)' },
  { id: 'emerald', name: 'Liquid Emerald', css: 'radial-gradient(ellipse at 25% 18%, rgba(16,185,129,0.3), transparent 50%), linear-gradient(165deg, #04080a 0%, #071316 100%)' },
  { id: 'indigo', name: 'Deep Horizon', css: 'radial-gradient(ellipse at 50% 0%, rgba(129,140,248,0.34), transparent 55%), linear-gradient(180deg, #070914 0%, #020308 100%)' },
  { id: 'oled', name: 'Pure OLED', css: '#000000' },
];

const FALLBACK_APPS = [
  { packageName: 'com.whatsapp', label: 'WhatsApp' },
  { packageName: 'com.instagram.android', label: 'Instagram' },
  { packageName: 'com.twitter.android', label: 'X' },
  { packageName: 'org.telegram.messenger', label: 'Telegram' },
  { packageName: 'com.discord', label: 'Discord' },
  { packageName: 'com.supercell.clashofclans', label: 'Clash' },
  { packageName: 'com.pubg.imobile', label: 'BGMI' },
  { packageName: 'com.mojang.minecraftpe', label: 'Minecraft' },
  { packageName: 'com.android.settings', label: 'Settings' },
  { packageName: 'com.android.camera', label: 'Camera' },
  { packageName: 'com.android.deskclock', label: 'Clock' },
  { packageName: 'com.android.calculator2', label: 'Calculator' },
  { packageName: 'com.google.android.apps.maps', label: 'Maps' },
];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadInstalledApps() {
  try {
    const bridge = window.AndroidBattery;
    if (bridge && typeof bridge.getLaunchableApps === 'function') {
      const parsed = JSON.parse(bridge.getLaunchableApps());
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return FALLBACK_APPS;
}

function categorizeApp(app) {
  const s = `${app.packageName || ''} ${app.label || ''}`.toLowerCase();
  if (/whatsapp|insta|telegram|snap|discord|twitter|facebook|messenger|reddit|signal|chat|mail|phone|dialer|message/.test(s)) return 'SOCIAL';
  if (/game|pubg|bgmi|clash|minecraft|roblox|genshin|freefire|cod|chess|play\.games/.test(s)) return 'GAMES';
  return 'UTILITY';
}

export default function LauncherHome() {
  const [apps, setApps] = useState(() => loadInstalledApps());
  const [now, setNow] = useState(() => new Date());

  // Screen 1: Invisible Gesture Lock (↑ • → ← ↓)
  const [locked, setLocked] = useState(false);
  const [gestureBuffer, setGestureBuffer] = useState([]);
  const lockTouchRef = useRef(null);

  // Panels: null | 'control' (Screen 4) | 'matrix' (Screen 5) | 'drawer' (Screen 7) | 'wallpaper'
  const [panel, setPanel] = useState(null);
  const [query, setQuery] = useState('');
  const [contextApp, setContextApp] = useState(null);

  // Controls state (Screen 4)
  const [brightness, setBrightness] = useState(() => Number(localStorage.getItem('osien_cc_bright') || 65));
  const [volume, setVolume] = useState(55);
  const [toggles, setToggles] = useState({ wifi: true, bt: true, plane: false, hotspot: false, dnd: false });

  // Pins & Wallpaper
  const [dockPins, setDockPins] = useState(() => readJson('osien_dock_pins', null));
  const [wallId, setWallId] = useState(() => localStorage.getItem('osien_wall_id') || 'obsidian');
  const [customWall, setCustomWall] = useState(() => localStorage.getItem('osien_wall_custom') || '');

  const fileInputRef = useRef(null);
  const homeTouchRef = useRef(null);
  const longPressTimer = useRef(null);

  const { telemetry } = useBatteryTelemetry({
    capacityMah: Number(localStorage.getItem('ov_cap') || 5000),
    enabled: true,
  });
  const { whole, dec } = splitPct(telemetry.pct);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const onFocus = () => setApps(loadInstalledApps());
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const effectiveDock = useMemo(() => {
    if (Array.isArray(dockPins) && dockPins.length > 0) {
      return dockPins.map((pkg) => apps.find((a) => a.packageName === pkg)).filter(Boolean).slice(0, 4);
    }
    return apps.slice(0, 4);
  }, [apps, dockPins]);

  const categorized = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? apps.filter((a) => (a.label || '').toLowerCase().includes(q)) : apps;
    const groups = { SOCIAL: [], GAMES: [], UTILITY: [] };
    list.forEach((a) => groups[categorizeApp(a)].push(a));
    return groups;
  }, [apps, query]);

  const launchApp = (app) => {
    if (!app) return;
    try {
      window.AndroidBattery?.launchApp?.(app.packageName, app.className || '');
    } catch { /* ignore */ }
    setPanel(null);
    setQuery('');
  };

  const pinToDock = (pkg) => {
    const current = Array.isArray(dockPins) ? dockPins : effectiveDock.map((a) => a.packageName);
    const next = [pkg, ...current.filter((p) => p !== pkg)].slice(0, 4);
    setDockPins(next);
    localStorage.setItem('osien_dock_pins', JSON.stringify(next));
    setContextApp(null);
  };

  const updateBrightness = (val) => {
    const clamped = Math.max(5, Math.min(100, val));
    setBrightness(clamped);
    localStorage.setItem('osien_cc_bright', String(clamped));
    try { window.AndroidBattery?.setAodBrightness?.(clamped / 100); } catch { /* ignore */ }
  };

  const handleWallpaperUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1080 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        try {
          localStorage.setItem('osien_wall_custom', dataUrl);
          localStorage.setItem('osien_wall_id', 'custom');
          setCustomWall(dataUrl);
          setWallId('custom');
        } catch { /* ignore */ }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Screen 1: Invisible Gesture Lock handler (↑ • → ← ↓)
  const onLockTouchStart = (e) => {
    const t = e.touches[0];
    lockTouchRef.current = { x: t.clientX, y: t.clientY };
  };

  const onLockTouchEnd = (e) => {
    if (!lockTouchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - lockTouchRef.current.x;
    const dy = t.clientY - lockTouchRef.current.y;
    lockTouchRef.current = null;

    let step = 'TAP';
    if (Math.abs(dx) > 36 || Math.abs(dy) > 36) {
      step = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP');
    }

    setGestureBuffer((prev) => {
      const next = [...prev, step].slice(-DEFAULT_GESTURE.length);
      if (next.length === DEFAULT_GESTURE.length && next.every((v, i) => v === DEFAULT_GESTURE[i])) {
        setLocked(false);
        return [];
      }
      return next;
    });
  };

  // Home Gestures: Swipe Up -> Categorized Drawer, Left Edge -> Control Panel, Right Edge -> Dot Matrix Panel
  const onHomeTouchStart = (e) => {
    if (panel) return;
    const t = e.touches[0];
    homeTouchRef.current = { x: t.clientX, y: t.clientY };
  };

  const onHomeTouchEnd = (e) => {
    if (panel || !homeTouchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - homeTouchRef.current.x;
    const dy = t.clientY - homeTouchRef.current.y;
    const startX = homeTouchRef.current.x;
    homeTouchRef.current = null;

    if (startX < 44 && dx > 42) {
      setPanel('control');
    } else if (startX > window.innerWidth - 44 && dx < -42) {
      setPanel('matrix');
    } else if (dy < -52 && Math.abs(dy) > Math.abs(dx)) {
      setPanel('drawer');
    }
  };

  const startLongPress = (app) => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => setContextApp(app), 480);
  };
  const cancelLongPress = () => clearTimeout(longPressTimer.current);

  const activeWall = WALLPAPERS.find((w) => w.id === wallId) || WALLPAPERS[0];
  const bgStyle = wallId === 'custom' && customWall ? { backgroundImage: `url(${customWall})` } : { background: activeWall.css };

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();
  const dateStr = now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();

  const renderDiamond = (app, showLabel = false) => (
    <button
      key={app.packageName}
      className="osien-diamond-btn"
      onClick={() => launchApp(app)}
      onTouchStart={() => startLongPress(app)}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onContextMenu={(e) => { e.preventDefault(); setContextApp(app); }}
    >
      <div className="osien-diamond">
        <span className="osien-diamond-glyph">{(app.label || '?').slice(0, 1).toUpperCase()}</span>
      </div>
      {showLabel && <span className="osien-app-label">{app.label}</span>}
    </button>
  );

  // Screen 1: Totally Blank Invisible Gesture Lock
  if (locked) {
    return (
      <div className="osien-gesture-lock" onTouchStart={onLockTouchStart} onTouchEnd={onLockTouchEnd}>
        {/* Completely blank pitch-black screen — unlock with ↑ • → ← ↓ */}
        {gestureBuffer.length > 0 && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.18)' }} />
        )}
      </div>
    );
  }

  return (
    <div className="osien-home" onTouchStart={onHomeTouchStart} onTouchEnd={onHomeTouchEnd}>
      <div className="osien-bg-layer" style={bgStyle} />
      <div className="osien-bg-scrim" />

      {/* Top Section: Hero Card + Middle Widgets Row (Screen 2) */}
      <div style={{ position: 'relative', zIndex: 5 }}>
        <div className="osien-hero osien-glass">
          <div>
            <div className="osien-clock-time tabular">{timeStr}</div>
            <div className="osien-clock-date">{dateStr}</div>
          </div>

          <div className="osien-bat-right" onClick={() => window.dispatchEvent(new CustomEvent('osien-open-battery'))}>
            <div className="tabular" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(248,250,252,0.72)' }}>
              {whole}.{dec}%
            </div>
            <div className="osien-bat-cell">
              <div className="osien-bat-cap" />
              <div className="osien-bat-fill" style={{ height: `${Math.max(8, telemetry.pct)}%` }} />
            </div>
          </div>
        </div>

        {/* Widget 1 + Compact Square Widget */}
        <div className="osien-widgets-row">
          <div className="osien-widget-card osien-glass" onClick={() => window.dispatchEvent(new CustomEvent('osien-open-battery'))}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(248,250,252,0.5)' }}>OSIEN POWER</span>
              <BatteryCharging size={14} color="#34d399" />
            </div>
            <div className="tabular" style={{ fontSize: 15, fontWeight: 500 }}>
              {telemetry.chargeState === 'charging' ? `${telemetry.watts.toFixed(1)}W Live` : telemetry.chargeState === 'paused' ? 'Smart Pause' : 'AOD Studio'}
            </div>
          </div>

          <div className="osien-widget-card osien-glass" style={{ alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => { setGestureBuffer([]); setLocked(true); }}>
            <Lock size={20} color="#38bdf8" />
            <span style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(248,250,252,0.65)' }}>GESTURE LOCK</span>
          </div>
        </div>
      </div>

      {/* Screen 3: Dual Side Edge Handles (Left -> Control Panel, Right -> Quick Matrix Panel) */}
      <div className="osien-edge-handle left" onClick={() => setPanel('control')} title="Control Panel" />
      <div className="osien-edge-handle right" onClick={() => setPanel('matrix')} title="Quick Matrix" />

      {/* Bottom Floating Diamond Dock */}
      <div className="osien-dock osien-glass">
        {effectiveDock.map((app) => renderDiamond(app, false))}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleWallpaperUpload} />

      {/* SCREEN 4: BOTTOM LIQUID GLASS CONTROL PANEL */}
      {panel === 'control' && (
        <div className="osien-bottom-card-backdrop" onClick={() => setPanel(null)}>
          <div className="osien-bottom-card osien-glass" onClick={(e) => e.stopPropagation()}>
            {/* Top Progress / Media Strip */}
            <div style={{ height: 14, borderRadius: 99, background: 'rgba(255,255,255,0.14)', overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ width: `${Math.max(12, telemetry.pct)}%`, height: '100%', background: '#f8fafc', borderRadius: 99 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
              {/* Left Circular Quick Toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <button className={`osien-circle-btn ${toggles.wifi ? 'active' : ''}`} onClick={() => setToggles((s) => ({ ...s, wifi: !s.wifi }))}><Wifi size={17} /></button>
                <button className={`osien-circle-btn ${toggles.plane ? 'active' : ''}`} onClick={() => setToggles((s) => ({ ...s, plane: !s.plane }))}><Plane size={17} /></button>
                <button className={`osien-circle-btn ${toggles.bt ? 'active' : ''}`} onClick={() => setToggles((s) => ({ ...s, bt: !s.bt }))}><Bluetooth size={17} /></button>
                <button className={`osien-circle-btn ${toggles.hotspot ? 'active' : ''}`} onClick={() => setToggles((s) => ({ ...s, hotspot: !s.hotspot }))}><Radio size={17} /></button>
                <button className="osien-circle-btn" onClick={() => setPanel('wallpaper')}><ImageIcon size={17} /></button>
                <button className={`osien-circle-btn ${toggles.dnd ? 'active' : ''}`} onClick={() => setToggles((s) => ({ ...s, dnd: !s.dnd }))}><MinusCircle size={17} /></button>
              </div>

              {/* Right 2 Vertical Sliders (Brightness & Volume) */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div
                  className="osien-vslider-wrap"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.round(((rect.bottom - e.clientY) / rect.height) * 100);
                    updateBrightness(pct);
                  }}
                >
                  <div className="osien-vslider-fill" style={{ height: `${brightness}%` }} />
                  <Sun size={15} style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', color: '#020617' }} />
                </div>

                <div
                  className="osien-vslider-wrap"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(100, Math.round(((rect.bottom - e.clientY) / rect.height) * 100)));
                    setVolume(pct);
                  }}
                >
                  <div className="osien-vslider-fill" style={{ height: `${volume}%` }} />
                  <Volume2 size={15} style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', color: '#020617' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 5: BOTTOM LIQUID GLASS QUICK MATRIX PANEL */}
      {panel === 'matrix' && (
        <div className="osien-bottom-card-backdrop" onClick={() => setPanel(null)}>
          <div className="osien-bottom-card osien-glass" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <button className="osien-circle-btn" style={{ width: 30, height: 30 }} onClick={() => setPanel('wallpaper')}>
                <MoreHorizontal size={15} />
              </button>
              <span style={{ fontSize: 11, letterSpacing: '0.16em', color: 'rgba(248,250,252,0.5)' }}>QUICK LAUNCH</span>
              <button className="osien-circle-btn" style={{ width: 30, height: 30 }} onClick={() => setPanel(null)}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '8px 6px', borderRadius: 20, background: 'rgba(255,255,255,0.05)' }}>
              {apps.slice(0, 12).map((app) => renderDiamond(app, true))}
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 7: SWIPE-UP CATEGORIZED DIAMOND APP DRAWER */}
      {panel === 'drawer' && (
        <div className="osien-bottom-card-backdrop" onClick={() => { setPanel(null); setQuery(''); }}>
          <div className="osien-drawer-card osien-glass" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" style={{ marginBottom: 12 }} />
            <div className="osien-search-bar" style={{ marginBottom: 8 }}>
              <Search size={16} color="#a78bfa" />
              <input
                className="osien-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search apps..."
              />
              {query && <X size={15} color="#94a3b8" onClick={() => setQuery('')} />}
            </div>

            <div className="osien-drawer-scroll">
              {(['SOCIAL', 'GAMES', 'UTILITY']).map((cat) =>
                categorized[cat].length > 0 ? (
                  <div key={cat}>
                    <div className="osien-cat-header">
                      <span className="osien-cat-line" />
                      <span>{cat}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px 4px' }}>
                      {categorized[cat].map((app) => renderDiamond(app, true))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>
        </div>
      )}

      {/* WALLPAPER PICKER */}
      {panel === 'wallpaper' && (
        <div className="osien-bottom-card-backdrop" onClick={() => setPanel(null)}>
          <div className="osien-bottom-card osien-glass" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>OSIEN Wallpapers</span>
              <button className="osien-circle-btn" style={{ width: 30, height: 30 }} onClick={() => setPanel(null)}><X size={14} /></button>
            </div>
            <button
              className="opt-btn active"
              style={{ width: '100%', padding: 12, marginBottom: 12 }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              Pick Custom Photo From Files
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => { setWallId(w.id); localStorage.setItem('osien_wall_id', w.id); }}
                  style={{ height: 68, borderRadius: 16, background: w.css, border: wallId === w.id ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 12, padding: 10, display: 'flex', alignItems: 'flex-end', cursor: 'pointer' }}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LONG-PRESS PIN TO DOCK */}
      {contextApp && (
        <div className="sheet-backdrop" onClick={() => setContextApp(null)}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{contextApp.label}</div>
            <button className="opt-btn active" style={{ width: '100%', padding: 12 }} onClick={() => pinToDock(contextApp.packageName)}>
              Pin to Bottom Diamond Dock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
