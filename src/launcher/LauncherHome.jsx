import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryCharging, Image as ImageIcon, Search, Settings, SlidersHorizontal,
  Sparkles, Sun, Wifi, X, Pin, Trash2, Grid2X2,
} from 'lucide-react';
import { useBatteryTelemetry, splitPct } from '../engine/batteryEngine';
import './launcher.css';

const WALLPAPERS = [
  {
    id: 'obsidian',
    name: 'Obsidian Aurora',
    css: 'radial-gradient(ellipse at 18% 12%, rgba(56,189,248,0.28), transparent 48%), radial-gradient(ellipse at 84% 78%, rgba(99,102,241,0.24), transparent 52%), linear-gradient(160deg, #05070c 0%, #090d18 100%)',
  },
  {
    id: 'emerald',
    name: 'Liquid Emerald',
    css: 'radial-gradient(ellipse at 25% 18%, rgba(16,185,129,0.32), transparent 50%), radial-gradient(ellipse at 80% 82%, rgba(6,182,212,0.22), transparent 50%), linear-gradient(165deg, #04080a 0%, #071316 100%)',
  },
  {
    id: 'indigo',
    name: 'Deep Horizon',
    css: 'radial-gradient(ellipse at 50% 0%, rgba(129,140,248,0.34), transparent 55%), linear-gradient(180deg, #070914 0%, #020308 100%)',
  },
  {
    id: 'carbon',
    name: 'Carbon Silk',
    css: 'radial-gradient(circle at 75% 20%, rgba(255,255,255,0.08), transparent 45%), linear-gradient(160deg, #0b0c10 0%, #050507 100%)',
  },
  {
    id: 'oled',
    name: 'Pure OLED',
    css: '#000000',
  },
];

const FALLBACK_APPS = [
  { packageName: 'osien.phone', className: '', label: 'Phone', icon: null },
  { packageName: 'osien.messages', className: '', label: 'Messages', icon: null },
  { packageName: 'osien.camera', className: '', label: 'Camera', icon: null },
  { packageName: 'osien.browser', className: '', label: 'Browser', icon: null },
  { packageName: 'osien.photos', className: '', label: 'Photos', icon: null },
  { packageName: 'osien.music', className: '', label: 'Music', icon: null },
  { packageName: 'osien.maps', className: '', label: 'Maps', icon: null },
  { packageName: 'osien.settings', className: '', label: 'Settings', icon: null },
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
  } catch {
    // Fallback
  }
  return FALLBACK_APPS;
}

export default function LauncherHome() {
  const [apps, setApps] = useState(() => loadInstalledApps());
  const [now, setNow] = useState(() => new Date());
  const [panel, setPanel] = useState(null); // null | 'drawer' | 'spotlight' | 'cc' | 'wallpaper'
  const [query, setQuery] = useState('');
  const [contextApp, setContextApp] = useState(null); // app object for long-press pin/unpin

  // Persisted Home & Dock pins (array of packageNames)
  const [homePins, setHomePins] = useState(() => readJson('osien_home_pins', null));
  const [dockPins, setDockPins] = useState(() => readJson('osien_dock_pins', null));

  // Wallpaper state
  const [wallId, setWallId] = useState(() => localStorage.getItem('osien_wall_id') || 'obsidian');
  const [customWall, setCustomWall] = useState(() => localStorage.getItem('osien_wall_custom') || '');
  const [brightness, setBrightness] = useState(() => Number(localStorage.getItem('osien_cc_bright') || 65));

  const fileInputRef = useRef(null);
  const gestureRef = useRef(null);
  const lastTapRef = useRef(0);
  const longPressTimer = useRef(null);

  const { telemetry } = useBatteryTelemetry({
    capacityMah: Number(localStorage.getItem('ov_cap') || 5000),
    enabled: true,
  });
  const { whole, dec } = splitPct(telemetry.pct);

  // Refresh installed apps & clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const onFocus = () => setApps(loadInstalledApps());
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Initialize default pins cleanly from installed apps
  const effectiveDock = useMemo(() => {
    if (Array.isArray(dockPins) && dockPins.length > 0) {
      return dockPins.map((pkg) => apps.find((a) => a.packageName === pkg)).filter(Boolean).slice(0, 4);
    }
    return apps.slice(0, 4);
  }, [apps, dockPins]);

  const effectiveHome = useMemo(() => {
    if (Array.isArray(homePins)) {
      return homePins.map((pkg) => apps.find((a) => a.packageName === pkg)).filter(Boolean).slice(0, 12);
    }
    return apps.slice(4, 12);
  }, [apps, homePins]);

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => (a.label || '').toLowerCase().includes(q));
  }, [apps, query]);

  const launchApp = (app) => {
    if (!app) return;
    try {
      if (window.AndroidBattery && typeof window.AndroidBattery.launchApp === 'function') {
        window.AndroidBattery.launchApp(app.packageName, app.className || '');
      }
    } catch {
      // Ignore on web preview
    }
    setPanel(null);
    setQuery('');
  };

  const openBatteryStudio = () => {
    window.dispatchEvent(new CustomEvent('osien-open-battery'));
  };

  const pinToHome = (pkg) => {
    const current = Array.isArray(homePins) ? homePins : effectiveHome.map((a) => a.packageName);
    if (!current.includes(pkg)) {
      const next = [...current, pkg].slice(0, 12);
      setHomePins(next);
      localStorage.setItem('osien_home_pins', JSON.stringify(next));
    }
    setContextApp(null);
  };

  const removeFromHome = (pkg) => {
    const current = Array.isArray(homePins) ? homePins : effectiveHome.map((a) => a.packageName);
    const next = current.filter((p) => p !== pkg);
    setHomePins(next);
    localStorage.setItem('osien_home_pins', JSON.stringify(next));
    setContextApp(null);
  };

  const pinToDock = (pkg) => {
    const current = Array.isArray(dockPins) ? dockPins : effectiveDock.map((a) => a.packageName);
    const next = [pkg, ...current.filter((p) => p !== pkg)].slice(0, 4);
    setDockPins(next);
    localStorage.setItem('osien_dock_pins', JSON.stringify(next));
    setContextApp(null);
  };

  // Reliable compressed wallpaper upload (works in Android WebView!)
  const handleWallpaperUpload = (e) => {
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        try {
          localStorage.setItem('osien_wall_custom', dataUrl);
          localStorage.setItem('osien_wall_id', 'custom');
          setCustomWall(dataUrl);
          setWallId('custom');
        } catch {
          // Ignore quota error
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const selectPresetWall = (id) => {
    setWallId(id);
    localStorage.setItem('osien_wall_id', id);
  };

  const updateBrightness = (val) => {
    setBrightness(val);
    localStorage.setItem('osien_cc_bright', String(val));
    try {
      if (window.AndroidBattery && window.AndroidBattery.setAodBrightness) {
        window.AndroidBattery.setAodBrightness(Math.max(0.05, val / 100));
      }
    } catch {
      // Ignore
    }
  };

  // iOS-style Home Screen Gestures (Swipe Up = Drawer, Swipe Down = Spotlight / Control Center, Double-Tap = AOD)
  const onHomeTouchStart = (e) => {
    if (panel) return;
    const t = e.touches[0];
    gestureRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };

  const onHomeTouchEnd = (e) => {
    if (panel || !gestureRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - gestureRef.current.x;
    const dy = t.clientY - gestureRef.current.y;
    const startX = gestureRef.current.x;
    const startY = gestureRef.current.y;
    gestureRef.current = null;

    if (Math.abs(dy) > 52 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) {
        setPanel('drawer');
      } else {
        // Swipe down from top-right -> Control Center, else -> Spotlight Search
        if (startY < 160 && startX > window.innerWidth * 0.58) {
          setPanel('cc');
        } else {
          setPanel('spotlight');
        }
      }
    }
  };

  const onEmptyTap = () => {
    const t = Date.now();
    if (t - lastTapRef.current < 320) {
      openBatteryStudio();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = t;
    }
  };

  const startLongPress = (app) => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setContextApp(app);
    }, 480);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current);
  };

  const activeWall = WALLPAPERS.find((w) => w.id === wallId) || WALLPAPERS[0];
  const bgStyle =
    wallId === 'custom' && customWall
      ? { backgroundImage: `url(${customWall})` }
      : { background: activeWall.css };

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  const renderIcon = (app) => (
    <div className="osien-icon-box">
      {app.icon ? (
        <img src={app.icon} alt={app.label} loading="lazy" />
      ) : (
        <span style={{ fontSize: 18, fontWeight: 600, color: '#38bdf8' }}>
          {(app.label || '?').slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );

  return (
    <div
      className="osien-home"
      onTouchStart={onHomeTouchStart}
      onTouchEnd={onHomeTouchEnd}
      onClick={onEmptyTap}
    >
      <div className="osien-bg-layer" style={bgStyle} />
      <div className="osien-bg-scrim" />

      {/* Top Bar */}
      <div className="osien-top-bar" onClick={(e) => e.stopPropagation()}>
        <button className="osien-pill osien-glass" onClick={() => setPanel('wallpaper')}>
          <img src="/logo.png" alt="OSIEN" style={{ width: 18, height: 18, borderRadius: 5 }} />
          <span>OSIEN</span>
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="osien-pill osien-glass" onClick={() => setPanel('spotlight')} aria-label="Search">
            <Search size={14} />
          </button>
          <button className="osien-pill osien-glass" onClick={() => setPanel('cc')} aria-label="Control Center">
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Liquid Glass Hero Clock + Live 3-Decimal Battery Card */}
      <div className="osien-hero osien-glass" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="osien-clock-time tabular">{hh}:{mm}</div>
          <div className="osien-clock-date">{dateStr}</div>
        </div>
        <div className="osien-bat-badge" onClick={openBatteryStudio}>
          <div className="osien-bat-pct tabular">
            {whole}<span style={{ color: '#38bdf8', fontSize: 13 }}>.{dec}%</span>
          </div>
          <div className="osien-bat-sub">
            {telemetry.chargeState === 'charging'
              ? `${telemetry.watts.toFixed(1)}W · LIVE`
              : telemetry.chargeState === 'paused'
                ? 'SMART PAUSE'
                : 'AOD STUDIO'}
          </div>
        </div>
      </div>

      {/* Pinned Home Grid */}
      <div className="osien-grid-wrap">
        <div className="osien-app-grid" onClick={(e) => e.stopPropagation()}>
          {effectiveHome.map((app) => (
            <button
              key={app.packageName}
              className="osien-app-item"
              onClick={() => launchApp(app)}
              onTouchStart={() => startLongPress(app)}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextApp(app);
              }}
            >
              {renderIcon(app)}
              <span className="osien-app-label">{app.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Floating Liquid Glass Dock */}
      <div className="osien-dock osien-glass" onClick={(e) => e.stopPropagation()}>
        {effectiveDock.map((app) => (
          <button
            key={app.packageName}
            className="osien-app-item"
            onClick={() => launchApp(app)}
            onTouchStart={() => startLongPress(app)}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextApp(app);
            }}
          >
            {renderIcon(app)}
          </button>
        ))}
      </div>

      <div className="osien-gesture-hint" onClick={(e) => { e.stopPropagation(); setPanel('drawer'); }} />

      {/* Hidden wallpaper file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleWallpaperUpload} />

      {/* APP DRAWER & SPOTLIGHT SEARCH */}
      {(panel === 'drawer' || panel === 'spotlight') && (
        <div className="osien-overlay" onClick={() => { setPanel(null); setQuery(''); }}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="osien-search-bar">
              <Search size={16} color="#94a3b8" />
              <input
                className="osien-search-input"
                autoFocus={panel === 'spotlight'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={panel === 'spotlight' ? 'Spotlight search apps...' : 'Search all apps...'}
              />
              <button
                onClick={() => { setPanel(null); setQuery(''); }}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="osien-drawer-scroll">
              <div className="osien-app-grid">
                {filteredApps.map((app) => (
                  <button
                    key={app.packageName}
                    className="osien-app-item"
                    onClick={() => launchApp(app)}
                    onTouchStart={() => startLongPress(app)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextApp(app);
                    }}
                  >
                    {renderIcon(app)}
                    <span className="osien-app-label">{app.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIQUID GLASS CONTROL CENTER */}
      {panel === 'cc' && (
        <div className="osien-overlay" onClick={() => setPanel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>OSIEN Control Center</span>
              <button className="osien-pill osien-glass" onClick={() => setPanel(null)}><X size={14} /></button>
            </div>

            <div className="osien-glass" style={{ padding: 16, borderRadius: 22, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sun size={14} color="#38bdf8" /> Display Brightness</span>
                <span className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>{brightness}%</span>
              </div>
              <input
                type="range" min="10" max="100" step="5" value={brightness}
                onChange={(e) => updateBrightness(Number(e.target.value))}
                className="range-input"
              />
            </div>

            <div className="osien-cc-grid">
              <button className="osien-cc-tile osien-glass" onClick={() => { setPanel(null); openBatteryStudio(); }}>
                <BatteryCharging size={18} color="#10b981" />
                <span>AOD & Charging</span>
              </button>
              <button className="osien-cc-tile osien-glass" onClick={() => setPanel('wallpaper')}>
                <ImageIcon size={18} color="#38bdf8" />
                <span>Wallpapers</span>
              </button>
              <button className="osien-cc-tile osien-glass" onClick={() => setPanel('drawer')}>
                <Grid2X2 size={18} color="#a78bfa" />
                <span>All Apps</span>
              </button>
              <button
                className="osien-cc-tile osien-glass"
                onClick={() => {
                  try { window.AndroidBattery?.openDeviceSettings?.(); } catch { /* ignore */ }
                  setPanel(null);
                }}
              >
                <Settings size={18} color="#94a3b8" />
                <span>Android Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WALLPAPER STUDIO */}
      {panel === 'wallpaper' && (
        <div className="osien-overlay" onClick={() => setPanel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>OSIEN Wallpapers</span>
              <button className="osien-pill osien-glass" onClick={() => setPanel(null)}><X size={14} /></button>
            </div>

            <button
              className="osien-cc-tile osien-glass"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 14, borderColor: 'rgba(56,189,248,0.45)' }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              <ImageIcon size={16} color="#38bdf8" />
              <span>Pick Custom Wallpaper From Files</span>
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => selectPresetWall(w.id)}
                  style={{
                    height: 84,
                    borderRadius: 18,
                    background: w.css,
                    border: wallId === w.id ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.14)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 12,
                    cursor: 'pointer',
                  }}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LONG-PRESS APP PINNING CONTEXT SHEET */}
      {contextApp && (
        <div className="sheet-backdrop" onClick={() => setContextApp(null)}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {renderIcon(contextApp)}
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{contextApp.label}</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{contextApp.packageName}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="opt-btn active" style={{ padding: 12 }} onClick={() => pinToHome(contextApp.packageName)}>
                Pin to Home Screen
              </button>
              <button className="opt-btn" style={{ padding: 12 }} onClick={() => pinToDock(contextApp.packageName)}>
                Pin to Bottom Dock
              </button>
              <button className="opt-btn" style={{ padding: 12, color: '#f87171' }} onClick={() => removeFromHome(contextApp.packageName)}>
                Remove from Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
