import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryCharging, Bluetooth, Globe, Lock, MoreHorizontal,
  Plane, Search, Settings, Sun, Volume2, Bell, Wifi, X, Radio,
  Flashlight, Image as ImageIcon, Phone, MessageCircle, Camera, Music,
  Gamepad2, ShoppingBag, Mail, Calendar, Clock, Calculator, MapPin,
  Shield, Sparkles, Play, Folder, Compass, Terminal, AppWindow,
} from 'lucide-react';
import { useBatteryTelemetry, splitPct } from '../engine/batteryEngine';
import { MonochromeAppIcon } from './BrandIcons';
import { WidgetCanvas } from './WidgetCanvas';
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

function AppDiamondIcon({ app }) {
  return (
    <span className="osien-diamond-glyph" style={{ display: 'grid', placeItems: 'center' }}>
      <MonochromeAppIcon app={app} />
    </span>
  );
}

function getAppLucideIcon(app) {
  const s = `${app.packageName || ''} ${app.label || ''}`.toLowerCase();
  if (/phone|dialer|call/.test(s)) return Phone;
  if (/whatsapp|telegram|message|sms|discord|signal|chat/.test(s)) return MessageCircle;
  if (/camera|photo|gallery|edits/.test(s)) return Camera;
  if (/chrome|brave|browser|firefox|edge|opera/.test(s)) return Compass;
  if (/music|spotify|youtube|vlc|audio|podcast/.test(s)) return Play;
  if (/game|chess|pubg|bgmi|clash|minecraft|roblox|cod/.test(s)) return Gamepad2;
  if (/amazon|flipkart|blinkit|instamart|shop|myntra|swiggy|zomato/.test(s)) return ShoppingBag;
  if (/gmail|mail|outlook/.test(s)) return Mail;
  if (/calendar/.test(s)) return Calendar;
  if (/clock|alarm|timer/.test(s)) return Clock;
  if (/calc/.test(s)) return Calculator;
  if (/map|uber|ola|chalo|nav/.test(s)) return MapPin;
  if (/auth|shield|security|vpn|pay|fam/.test(s)) return Shield;
  if (/gpt|ai|gemini|claude|assistant|perplexity/.test(s)) return Sparkles;
  if (/drive|file|doc|note|pdf/.test(s)) return Folder;
  if (/setting|aod|osien/.test(s)) return Settings;
  if (/term|code|git|dev/.test(s)) return Terminal;
  return AppWindow;
}
function categorizeApp(app) {
  const s = `${app.packageName || ''} ${app.label || ''}`.toLowerCase();
  if (/whatsapp|insta|telegram|snap|discord|twitter|facebook|messenger|reddit|signal|chat|mail|phone|dialer|message/.test(s)) return 'SOCIAL';
  if (/game|pubg|bgmi|clash|minecraft|roblox|genshin|freefire|cod|chess|play\.games/.test(s)) return 'GAMES';
  return 'UTILITY';
}

const DiamondTile = React.memo(function DiamondTile({ app, showLabel, onLaunch, onLongStart, onLongCancel, onCtx }) {
  return (
    <button
      className="osien-diamond-btn"
      onClick={() => onLaunch(app)}
      onTouchStart={() => onLongStart(app)}
      onTouchEnd={onLongCancel}
      onTouchMove={onLongCancel}
      onContextMenu={(e) => { e.preventDefault(); onCtx(app); }}
    >
      <div className="osien-diamond">
        <span className="osien-diamond-glyph" style={{ display: 'grid', placeItems: 'center' }}>
          <MonochromeAppIcon app={app} />
        </span>
      </div>
      {showLabel && <span className="osien-app-label">{app.label}</span>}
    </button>
  );
});

/* Isolated 10Hz Battery & 1s Clock Hero — prevents LauncherHome & 100+ App Icons from re-rendering 10x/sec! */
const HeroAndWidgets = React.memo(function HeroAndWidgets({ onLock }) {
  const [now, setNow] = useState(() => new Date());
  const { telemetry } = useBatteryTelemetry({
    capacityMah: Number(localStorage.getItem('ov_cap') || 5000),
    enabled: true,
  });
  const { whole, dec } = splitPct(telemetry.pct);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();
  const dateStr = now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();

  return (
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

        <div className="osien-widget-card osien-glass" style={{ alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={onLock}>
          <Lock size={20} color="#38bdf8" />
          <span style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(248,250,252,0.65)' }}>GESTURE LOCK</span>
        </div>
      </div>
    </div>
  );
});

export default function LauncherHome() {
  const [apps, setApps] = useState(() => loadInstalledApps());

  // Screen 1: Real Invisible Gesture Lock (auto-arms on screen off + custom secret sequence)
  const [secretGesture, setSecretGesture] = useState(() => readJson('osien_secret_gesture', DEFAULT_GESTURE));
  const [autoLockOn, setAutoLockOn] = useState(() => localStorage.getItem('osien_autolock') === 'true');
  const [locked, setLocked] = useState(() => {
    try { return Boolean(window.AndroidBattery?.isGestureLockArmed?.()); } catch { return false; }
  });
  const [gestureBuffer, setGestureBuffer] = useState([]);
  const [recordingGesture, setRecordingGesture] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState([]);
  const lockTouchRef = useRef(null);

  // Re-check native armed lock state whenever phone wakes / returns to launcher
  useEffect(() => {
    const checkArmed = () => {
      try {
        if (window.AndroidBattery?.isGestureLockArmed?.()) {
          setLocked(true);
          setPanel(null);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('focus', checkArmed);
    document.addEventListener('visibilitychange', checkArmed);
    return () => {
      window.removeEventListener('focus', checkArmed);
      document.removeEventListener('visibilitychange', checkArmed);
    };
  }, []);

  const toggleAutoLock = () => {
    const next = !autoLockOn;
    setAutoLockOn(next);
    localStorage.setItem('osien_autolock', String(next));
    try { window.AndroidBattery?.setGestureLockEnabled?.(next); } catch { /* ignore */ }
  };

  const lockPhoneNow = () => {
    setGestureBuffer([]);
    setPanel(null);
    setLocked(true);
    try { window.AndroidBattery?.armGestureLockNow?.(); } catch { /* ignore */ }
  };

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
  const [torchOn, setTorchOn] = useState(false);

  const toggleTorch = () => {
    try {
      const next = Boolean(window.AndroidBattery?.toggleFlashlight?.());
      setTorchOn(next);
    } catch {
      setTorchOn((v) => !v);
    }
  };

  // Pins & Wallpaper
  const [dockPins, setDockPins] = useState(() => readJson('osien_dock_pins', null));
  const [wallId, setWallId] = useState(() => localStorage.getItem('osien_wall_id') || 'obsidian');
  const [customWall, setCustomWall] = useState(() => localStorage.getItem('osien_wall_custom') || '');

  const fileInputRef = useRef(null);
  const homeTouchRef = useRef(null);
  const longPressTimer = useRef(null);
  const drawerScrollRef = useRef(null);
  const drawerLayerRef = useRef(null);
  const drawerCardRef = useRef(null);
  const sheetSwipeRef = useRef(null);
  const [sheetDragY, setSheetDragY] = useState(0);

  // Direct-DOM 1:1 finger tracking for App Drawer dismiss (ZERO React re-renders during drag!)
  const onDrawerTouchStart = (e) => {
    e.stopPropagation();
    if (drawerScrollRef.current && drawerScrollRef.current.scrollTop > 4) {
      sheetSwipeRef.current = null;
      return;
    }
    sheetSwipeRef.current = { y: e.touches[0].clientY, time: Date.now() };
    if (drawerCardRef.current) drawerCardRef.current.style.transition = 'none';
  };

  const onDrawerTouchMove = (e) => {
    if (!sheetSwipeRef.current || !drawerCardRef.current) return;
    const dy = e.touches[0].clientY - sheetSwipeRef.current.y;
    if (dy > 0) {
      drawerCardRef.current.style.transform = `translate3d(0, ${dy}px, 0)`;
    }
  };

  const onDrawerTouchEnd = (e) => {
    e.stopPropagation();
    if (!sheetSwipeRef.current || !drawerCardRef.current) return;
    const dy = e.changedTouches[0].clientY - sheetSwipeRef.current.y;
    const dt = Math.max(1, Date.now() - sheetSwipeRef.current.time);
    const velocity = dy / dt;
    sheetSwipeRef.current = null;
    drawerCardRef.current.style.transition = '';
    drawerCardRef.current.style.transform = '';
    if (dy > 75 || velocity > 0.38) {
      setPanel(null);
      setQuery('');
    }
  };

  const onSheetTouchStart = (e) => {
    e.stopPropagation();
    // Ignore touch drags started on sliders, buttons, or inputs — only drag from empty panel space!
    if (e.target && e.target.closest && e.target.closest('.osien-hslider-wrap, .osien-vslider-wrap, button, input')) {
      sheetSwipeRef.current = null;
      return;
    }
    sheetSwipeRef.current = { y: e.touches[0].clientY, time: Date.now() };
  };

  const onSheetTouchMove = (e) => {
    if (!sheetSwipeRef.current) return;
    const dy = e.touches[0].clientY - sheetSwipeRef.current.y;
    if (dy > 0) setSheetDragY(dy);
  };

  const onSheetTouchEnd = (e) => {
    e.stopPropagation();
    if (!sheetSwipeRef.current) return;
    const dy = e.changedTouches[0].clientY - sheetSwipeRef.current.y;
    const dt = Math.max(1, Date.now() - sheetSwipeRef.current.time);
    const velocity = dy / dt;
    sheetSwipeRef.current = null;
    setSheetDragY(0);
    if (dy > 72 || velocity > 0.42) {
      setPanel(null);
      setQuery('');
    }
  };

  const sheetDragStyle = sheetDragY > 0
    ? { transform: `translate3d(0, ${sheetDragY}px, 0)`, transition: 'none' }
    : { transform: 'translate3d(0, 0, 0)', transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' };

  useEffect(() => {
    const onFocus = () => setApps(loadInstalledApps());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
      const next = [...prev, step].slice(-secretGesture.length);
      if (next.length === secretGesture.length && next.every((v, i) => v === secretGesture[i])) {
        setLocked(false);
        try { window.AndroidBattery?.clearGestureLock?.(); } catch { /* ignore */ }
        return [];
      }
      return next;
    });
  };

  // iOS / OxygenOS 1:1 Direct-DOM Interactive Swipe-Up (follows finger from pixel 1, ZERO React re-renders!)
  const onHomeTouchStart = (e) => {
    if (panel) return;
    const t = e.touches[0];
    homeTouchRef.current = { x: t.clientX, y: t.clientY, time: Date.now(), mode: null };
  };

  const onHomeTouchMove = (e) => {
    if (panel || !homeTouchRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - homeTouchRef.current.x;
    const dy = t.clientY - homeTouchRef.current.y;
    const startX = homeTouchRef.current.x;

    if (!homeTouchRef.current.mode) {
      if ((startX < 72 && dx > 22) || (startX > window.innerWidth - 72 && dx < -22)) {
        homeTouchRef.current.mode = 'control';
        setPanel('control');
        return;
      }
      if (dy < -10 && Math.abs(dy) > Math.abs(dx)) {
        homeTouchRef.current.mode = 'drawer';
        if (drawerCardRef.current) drawerCardRef.current.style.transition = 'none';
        if (drawerLayerRef.current) drawerLayerRef.current.style.transition = 'none';
      }
    }

    if (homeTouchRef.current.mode === 'drawer' && drawerCardRef.current && drawerLayerRef.current) {
      const drawerH = window.innerHeight * 0.78;
      const offsetY = Math.max(0, drawerH + dy);
      const progress = Math.max(0, Math.min(1, 1 - offsetY / drawerH));
      drawerCardRef.current.style.transform = `translate3d(0, ${offsetY}px, 0)`;
      drawerLayerRef.current.style.opacity = String(progress);
    }
  };

  const onHomeTouchEnd = (e) => {
    if (!homeTouchRef.current) return;
    const ref = homeTouchRef.current;
    homeTouchRef.current = null;
    if (ref.mode === 'drawer' && drawerCardRef.current && drawerLayerRef.current) {
      const dy = e.changedTouches[0].clientY - ref.y;
      const dt = Math.max(1, Date.now() - ref.time);
      const velocity = dy / dt;
      drawerCardRef.current.style.transition = '';
      drawerCardRef.current.style.transform = '';
      drawerLayerRef.current.style.transition = '';
      drawerLayerRef.current.style.opacity = '';
      if (dy < -70 || velocity < -0.32) {
        setPanel('drawer');
      }
    }
  };

  const startLongPress = (app) => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => setContextApp(app), 480);
  };
  const cancelLongPress = () => clearTimeout(longPressTimer.current);

  const activeWall = WALLPAPERS.find((w) => w.id === wallId) || WALLPAPERS[0];
  const bgStyle = wallId === 'custom' && customWall ? { backgroundImage: `url(${customWall})` } : { background: activeWall.css };

  const renderDiamond = (app, showLabel = false) => (
    <DiamondTile
      key={app.packageName}
      app={app}
      showLabel={showLabel}
      onLaunch={launchApp}
      onLongStart={startLongPress}
      onLongCancel={cancelLongPress}
      onCtx={setContextApp}
    />
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
    <div className="osien-home" onTouchStart={onHomeTouchStart} onTouchMove={onHomeTouchMove} onTouchEnd={onHomeTouchEnd}>
      <div className="osien-bg-layer" style={bgStyle} />
      <div className="osien-bg-scrim" />

      {/* Home Stage */}
      <div className={`osien-home-stage ${panel ? 'dimmed' : ''}`}>
        <WidgetCanvas
          onLock={lockPhoneNow}
          onLaunchPkg={(pkg) => launchApp({ packageName: pkg, className: '' })}
        />

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
          <div
            className="osien-bottom-card osien-glass"
            style={sheetDragStyle}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => onSheetTouchStart(e, false)}
            onTouchMove={onSheetTouchMove}
            onTouchEnd={onSheetTouchEnd}
          >
            {/* Top Horizontal Brightness Slider */}
            <div
              className="osien-hslider-wrap"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleHSliderPointer(e, updateBrightness); }}
              onPointerMove={(e) => { if (e.buttons > 0) handleHSliderPointer(e, updateBrightness); }}
            >
              <div className="osien-hslider-fill" style={{ width: `${brightness}%` }} />
              <Sun size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: brightness > 15 ? '#020617' : '#f8fafc', pointerEvents: 'none' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              {/* Col 1: Wi-Fi, Direct Bluetooth, Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 158 }}>
                <button className="osien-circle-btn active" onClick={() => openNativePanel('internet')} title="Wi-Fi"><Wifi size={17} /></button>
                <button className={`osien-circle-btn ${btOn ? 'active' : ''}`} onClick={toggleBtDirect} title="Bluetooth"><Bluetooth size={17} /></button>
                <button className="osien-circle-btn" onClick={() => openNativePanel('settings')} title="Settings"><Settings size={17} /></button>
              </div>

              {/* Col 2: Globe + Vertical Pill (Airplane, Hotspot, 3-Dots) */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', height: 158 }}>
                <button className="osien-circle-btn" onClick={() => openNativePanel('internet')} title="Mobile Data"><Globe size={17} /></button>
                <div className="osien-pill-stack">
                  <button className="osien-circle-btn" style={{ width: 30, height: 30, border: 'none', background: 'transparent' }} onClick={() => openNativePanel('airplane')} title="Airplane"><Plane size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 30, height: 30, border: 'none', background: 'transparent' }} onClick={() => openNativePanel('hotspot')} title="Hotspot"><Radio size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 28, height: 28 }} onClick={() => setPanel('more')} title="More Tools"><MoreHorizontal size={15} /></button>
                </div>
              </div>

              {/* Right: 2 Vertical Sliders (Media Sound & Ringtone Sound — 52x174px) */}
              <div style={{ display: 'flex', gap: 14, marginLeft: 'auto' }}>
                <div
                  className="osien-vslider-wrap"
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleVSliderPointer(e, updateVolume); }}
                  onPointerMove={(e) => { if (e.buttons > 0) handleVSliderPointer(e, updateVolume); }}
                >
                  <div className="osien-vslider-fill" style={{ height: `${volume}%` }} />
                  <Volume2 size={16} style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', color: volume > 18 ? '#020617' : '#f8fafc', pointerEvents: 'none' }} />
                </div>

                <div
                  className="osien-vslider-wrap"
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleVSliderPointer(e, updateRingtone); }}
                  onPointerMove={(e) => { if (e.buttons > 0) handleVSliderPointer(e, updateRingtone); }}
                >
                  <div className="osien-vslider-fill" style={{ height: `${ringtone}%` }} />
                  <Bell size={16} style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', color: ringtone > 18 ? '#020617' : '#f8fafc', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRE-MOUNTED 120FPS 1:1 DIRECT-DOM SWIPE-UP DIAMOND APP DRAWER */}
      <div
        ref={drawerLayerRef}
        className={`osien-drawer-layer ${panel === 'drawer' ? 'open' : ''}`}
        onClick={() => { setPanel(null); setQuery(''); }}
      >
        <div
          ref={drawerCardRef}
          className="osien-drawer-card"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={onDrawerTouchStart}
          onTouchMove={onDrawerTouchMove}
          onTouchEnd={onDrawerTouchEnd}
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

          <div className="osien-drawer-scroll" ref={drawerScrollRef}>
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

      {/* 3-DOT EXPANDED QUICK TOOLS MATRIX (Exact Match to Image 2) */}
      {panel === 'more' && (
        <div className="osien-bottom-card-backdrop" onClick={() => setPanel(null)}>
          <div
            className="osien-bottom-card osien-glass"
            style={{ ...sheetDragStyle, padding: 14 }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => onSheetTouchStart(e, false)}
            onTouchMove={onSheetTouchMove}
            onTouchEnd={onSheetTouchEnd}
          >
            <div className="osien-matrix-inner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <button className="osien-circle-btn" style={{ width: 34, height: 34 }} onClick={() => setPanel('control')} title="Back to Control Panel">
                  <MoreHorizontal size={16} />
                </button>
                <span style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(248,250,252,0.55)' }}>OSIEN MATRIX</span>
                <button className="osien-circle-btn" style={{ width: 34, height: 34 }} onClick={() => setPanel(null)}>
                  <X size={14} />
                </button>
              </div>

              <div className="osien-matrix-grid">
                {/* Left Column */}
                <div className="osien-matrix-col" style={{ opacity: 0.72 }}>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => openNativePanel('display')} title="Display"><Sun size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => openNativePanel('sound')} title="Sound"><Volume2 size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => openNativePanel('airplane')} title="Airplane"><Plane size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => openNativePanel('hotspot')} title="Hotspot"><Radio size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => openNativePanel('internet')} title="Data"><Globe size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => openNativePanel('sound')} title="Ringtone"><Bell size={15} /></button>
                </div>

                {/* Center Highlighted Primary Tools Column */}
                <div className="osien-matrix-center">
                  <button className={`osien-circle-btn ${torchOn ? 'active' : ''}`} style={{ width: 40, height: 40 }} onClick={toggleTorch} title="Flashlight"><Flashlight size={16} /></button>
                  <button className={`osien-circle-btn ${btOn ? 'active' : ''}`} style={{ width: 40, height: 40 }} onClick={toggleBtDirect} title="Bluetooth"><Bluetooth size={16} /></button>
                  <button className="osien-circle-btn" style={{ width: 40, height: 40 }} onClick={() => { setPanel(null); window.dispatchEvent(new CustomEvent('osien-open-battery')); }} title="AOD Studio"><BatteryCharging size={16} /></button>
                  <button className="osien-circle-btn" style={{ width: 40, height: 40 }} onClick={() => setPanel('wallpaper')} title="Wallpapers"><ImageIcon size={16} /></button>
                  <button className={`osien-circle-btn ${autoLockOn ? 'active' : ''}`} style={{ width: 40, height: 40 }} onClick={() => setPanel('locksetup')} title="Gesture Lock"><Lock size={16} /></button>
                  <button className="osien-circle-btn" style={{ width: 40, height: 40 }} onClick={() => openNativePanel('internet')} title="Wi-Fi"><Wifi size={16} /></button>
                </div>

                {/* Right Column */}
                <div className="osien-matrix-col" style={{ opacity: 0.72 }}>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => openNativePanel('settings')} title="Settings"><Settings size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => setPanel('drawer')} title="App Drawer"><Search size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={lockPhoneNow} title="Lock Now"><Lock size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => setPanel('wallpaper')} title="Theme"><Sparkles size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => openNativePanel('display')} title="Brightness"><Sun size={15} /></button>
                  <button className="osien-circle-btn" style={{ width: 38, height: 38 }} onClick={() => openNativePanel('settings')} title="System"><Terminal size={15} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GESTURE LOCK SETUP & CUSTOM RECORDER */}
      {panel === 'locksetup' && (
        <div className="osien-bottom-card-backdrop" onClick={() => { setPanel(null); setRecordingGesture(false); }}>
          <div className="osien-bottom-card osien-glass" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>OSIEN Gesture Lock</span>
              <button className="osien-circle-btn" style={{ width: 30, height: 30 }} onClick={() => { setPanel(null); setRecordingGesture(false); }}><X size={14} /></button>
            </div>

            <div className="toggle-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Auto-Lock on Screen Off</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>Shows blank lock screen when phone wakes</div>
              </div>
              <button className={`opt-btn ${autoLockOn ? 'active' : ''}`} style={{ padding: '6px 14px' }} onClick={toggleAutoLock}>
                {autoLockOn ? 'On' : 'Off'}
              </button>
            </div>

            <div style={{ padding: '12px', borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#94a3b8', marginBottom: 6 }}>
                {recordingGesture ? 'SWIPE OR TAP BELOW (3–6 STEPS)' : 'CURRENT SECRET GESTURE'}
              </div>
              <div style={{ fontSize: 22, letterSpacing: '0.22em', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                {(recordingGesture ? recordedSteps : secretGesture).map((s) =>
                  s === 'UP' ? '↑' : s === 'DOWN' ? '↓' : s === 'LEFT' ? '←' : s === 'RIGHT' ? '→' : '•'
                ).join(' ') || '—'}
              </div>
            </div>

            {recordingGesture ? (
              <>
                <div
                  style={{ height: 110, borderRadius: 18, border: '1.5px dashed #38bdf8', background: 'rgba(56,189,248,0.08)', display: 'grid', placeItems: 'center', fontSize: 12, color: '#94a3b8', touchAction: 'none', marginBottom: 10 }}
                  onTouchStart={(e) => { lockTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
                  onTouchEnd={(e) => {
                    if (!lockTouchRef.current) return;
                    const dx = e.changedTouches[0].clientX - lockTouchRef.current.x;
                    const dy = e.changedTouches[0].clientY - lockTouchRef.current.y;
                    lockTouchRef.current = null;
                    let step = 'TAP';
                    if (Math.abs(dx) > 32 || Math.abs(dy) > 32) {
                      step = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP');
                    }
                    setRecordedSteps((prev) => prev.length < 6 ? [...prev, step] : prev);
                  }}
                >
                  Swipe or Tap here to record
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button className="opt-btn" style={{ padding: 10 }} onClick={() => setRecordedSteps([])}>Clear</button>
                  <button
                    className="opt-btn active"
                    style={{ padding: 10 }}
                    onClick={() => {
                      if (recordedSteps.length >= 3) {
                        setSecretGesture(recordedSteps);
                        localStorage.setItem('osien_secret_gesture', JSON.stringify(recordedSteps));
                        setRecordingGesture(false);
                      }
                    }}
                  >
                    Save ({recordedSteps.length})
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="opt-btn" style={{ padding: 11 }} onClick={() => { setRecordedSteps([]); setRecordingGesture(true); }}>
                  Record Custom
                </button>
                <button className="opt-btn active" style={{ padding: 11 }} onClick={lockPhoneNow}>
                  Lock Now
                </button>
              </div>
            )}
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
