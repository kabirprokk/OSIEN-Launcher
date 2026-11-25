import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryCharging, Bluetooth, Globe, Lock, MoreHorizontal,
  Plane, Search, Settings, Sun, Volume2, Bell, Wifi, X, Radio,
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

  // Controls state (Screen 4 — synced to real Android hardware)
  const [brightness, setBrightness] = useState(() => {
    try {
      const b = Number(window.AndroidBattery?.getSystemBrightness?.());
      if (Number.isFinite(b) && b >= 5) return b;
    } catch { /* ignore */ }
    return Number(localStorage.getItem('osien_cc_bright') || 65);
  });
  const [volume, setVolume] = useState(() => {
    try {
      const v = Number(window.AndroidBattery?.getSystemVolume?.());
      if (Number.isFinite(v) && v >= 0) return v;
    } catch { /* ignore */ }
    return 55;
  });
  const [ringtone, setRingtone] = useState(() => {
    try {
      const r = Number(window.AndroidBattery?.getRingtoneVolume?.());
      if (Number.isFinite(r) && r >= 0) return r;
    } catch { /* ignore */ }
    return 60;
  });
  const [btOn, setBtOn] = useState(() => {
    try { return Boolean(window.AndroidBattery?.isBluetoothEnabled?.()); } catch { return false; }
  });

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
    try {
      window.AndroidBattery?.setHomeBrightness?.(clamped / 100);
      window.AndroidBattery?.setSystemBrightness?.(clamped);
    } catch { /* ignore */ }
  };

  const updateVolume = (val) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVolume(clamped);
    try { window.AndroidBattery?.setSystemVolume?.(clamped); } catch { /* ignore */ }
  };

  const updateRingtone = (val) => {
    const clamped = Math.max(0, Math.min(100, val));
    setRingtone(clamped);
    try { window.AndroidBattery?.setRingtoneVolume?.(clamped); } catch { /* ignore */ }
  };

  const toggleBtDirect = () => {
    try {
      const next = Boolean(window.AndroidBattery?.toggleBluetoothDirect?.());
      setBtOn(next);
    } catch {
      setBtOn((v) => !v);
    }
  };

  const handleHSliderPointer = (e, setter) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(5, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    setter(pct);
  };

  const openNativePanel = (name) => {
    try { window.AndroidBattery?.openSystemPanel?.(name); } catch { /* ignore */ }
  };

  const handleVSliderPointer = (e, setter) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, Math.round(((rect.bottom - e.clientY) / rect.height) * 100)));
    setter(pct);
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

    if ((startX < 72 && dx > 30) || (startX > window.innerWidth - 72 && dx < -30)) {
      setPanel('control');
    } else if (dy < -48 && Math.abs(dy) > Math.abs(dx)) {
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

      {/* Home Stage (scales down smoothly like OxygenOS/iOS when panel/drawer opens) */}
      <div className={`osien-home-stage ${panel ? 'dimmed' : ''}`}>
        <div>
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

        {/* Bottom Floating Diamond Dock */}
        <div className="osien-dock osien-glass">
          {effectiveDock.map((app) => renderDiamond(app, false))}
        </div>
      </div>

      {/* Both Left & Right Wide Edge Zones open the Control Panel cleanly */}
      {!panel && (
        <>
          <div className="osien-edge-zone left" onClick={() => setPanel('control')} title="Control Panel">
            <div className="osien-edge-bar" />
          </div>
          <div className="osien-edge-zone right" onClick={() => setPanel('control')} title="Control Panel">
            <div className="osien-edge-bar" />
          </div>
        </>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleWallpaperUpload} />

      {/* EXACT CONTROL PANEL (Image 3: Top Brightness + Wi-Fi/BT/Settings + Globe/Airplane/Hotspot/More + Media & Ringtone Sliders) */}
      {panel === 'control' && (
        <div className="osien-bottom-card-backdrop" onClick={() => setPanel(null)}>
          <div className="osien-bottom-card osien-glass" onClick={(e) => e.stopPropagation()}>
            {/* Top Horizontal Brightness Slider */}
            <div
              className="osien-hslider-wrap"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleHSliderPointer(e, updateBrightness); }}
              onPointerMove={(e) => { if (e.buttons > 0) handleHSliderPointer(e, updateBrightness); }}
            >
              <div className="osien-hslider-fill" style={{ width: `${brightness}%` }} />
              <Sun size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: brightness > 15 ? '#020617' : '#f8fafc', pointerEvents: 'none' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 12 }}>
              {/* Col 1: Wi-Fi, Direct Bluetooth, Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
                <button className="osien-circle-btn active" onClick={() => openNativePanel('internet')} title="Wi-Fi"><Wifi size={17} /></button>
                <button className={`osien-circle-btn ${btOn ? 'active' : ''}`} onClick={toggleBtDirect} title="Bluetooth"><Bluetooth size={17} /></button>
                <button className="osien-circle-btn" onClick={() => openNativePanel('settings')} title="Settings"><Settings size={17} /></button>
              </div>

              {/* Col 2: Globe (Mobile Data) + Vertical Pill (Airplane, Hotspot, More/Wallpapers) */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <button className="osien-circle-btn" onClick={() => openNativePanel('internet')} title="Mobile Data"><Globe size={17} /></button>
                <div className="osien-pill-stack">
                  <button className="osien-circle-btn" style={{ width: 32, height: 32, border: 'none', background: 'transparent' }} onClick={() => openNativePanel('airplane')} title="Airplane"><Plane size={16} /></button>
                  <button className="osien-circle-btn" style={{ width: 32, height: 32, border: 'none', background: 'transparent' }} onClick={() => openNativePanel('hotspot')} title="Hotspot"><Radio size={16} /></button>
                  <button className="osien-circle-btn" style={{ width: 32, height: 32, border: 'none', background: 'transparent' }} onClick={() => setPanel('wallpaper')} title="Wallpapers"><MoreHorizontal size={16} /></button>
                </div>
              </div>

              {/* Right: 2 Vertical Sliders (Media Sound & Ringtone Sound) */}
              <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
                <div
                  className="osien-vslider-wrap"
                  style={{ height: 152, touchAction: 'none' }}
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleVSliderPointer(e, updateVolume); }}
                  onPointerMove={(e) => { if (e.buttons > 0) handleVSliderPointer(e, updateVolume); }}
                >
                  <div className="osien-vslider-fill" style={{ height: `${volume}%` }} />
                  <Volume2 size={15} style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', color: volume > 18 ? '#020617' : '#f8fafc', pointerEvents: 'none' }} />
                </div>

                <div
                  className="osien-vslider-wrap"
                  style={{ height: 152, touchAction: 'none' }}
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleVSliderPointer(e, updateRingtone); }}
                  onPointerMove={(e) => { if (e.buttons > 0) handleVSliderPointer(e, updateRingtone); }}
                >
                  <div className="osien-vslider-fill" style={{ height: `${ringtone}%` }} />
                  <Bell size={15} style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', color: ringtone > 18 ? '#020617' : '#f8fafc', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FIXED SWIPE-UP CATEGORIZED DIAMOND APP DRAWER */}
      {panel === 'drawer' && (
        <div className="osien-bottom-card-backdrop" onClick={() => { setPanel(null); setQuery(''); }}>
          <div
            className="osien-drawer-card osien-glass"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" style={{ marginBottom: 12 }} />
            <div className="osien-search-bar" style={{ marginBottom: 8 }}>
              <Search size={16} color="#a78bfa" />
              <input
                type="search"
                className="osien-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search apps..."
                autoComplete="off"
                autoCorrect="off"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="osien-drawer-scroll">
              {query.trim() ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px 4px', paddingTop: 8 }}>
                  {apps
                    .filter((a) => `${a.label || ''} ${a.packageName || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
                    .map((app) => renderDiamond(app, true))}
                </div>
              ) : (
                (['SOCIAL', 'GAMES', 'UTILITY']).map((cat) =>
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
                )
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
