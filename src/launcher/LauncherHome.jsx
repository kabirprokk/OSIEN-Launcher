import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BatteryCharging, Bluetooth, CalendarDays, Camera, Check, ChevronRight, Clock3,
  Folder, Globe2, Grid2X2, Heart, Images, LockKeyhole, MapPin, MessageCircle,
  Music2, NotebookPen, Palette, Phone, Plus, Search, Settings, Settings2,
  SlidersHorizontal, Sparkles, Sun, Volume2, Wifi, X,
} from 'lucide-react';
import { useBatteryTelemetry } from '../engine/batteryEngine';
import './launcher.css';

const PREVIEW_APPS = [
  ['Phone', 'phone', '#65d6a6'], ['Messages', 'messages', '#7eb4ff'], ['Camera', 'camera', '#c7a8ff'],
  ['Photos', 'photos', '#ff9c8f'], ['Calendar', 'calendar', '#f7bd72'], ['Maps', 'maps', '#93d7c0'],
  ['Music', 'music', '#f099c4'], ['Settings', 'settings', '#aeb8c6'], ['Clock', 'clock', '#9aa9f6'],
  ['Files', 'files', '#e9ce85'], ['Notes', 'notes', '#a8d4f2'], ['Browser', 'browser', '#93c9ff'],
];

const ACCENTS = [
  { name: 'Sage', value: '#b8e3b1' }, { name: 'Lemon', value: '#d9ef8c' },
  { name: 'Glacier', value: '#a9d4ea' }, { name: 'Blush', value: '#e9b8b0' },
  { name: 'Lilac', value: '#cbb8e8' }, { name: 'Chalk', value: '#efeee8' },
];

const PRESETS = [
  { id: 'still', name: 'Still', note: 'Quiet, open, essential', accent: '#b8e3b1', columns: 4, labels: false },
  { id: 'field', name: 'Field', note: 'A little more at hand', accent: '#d9ef8c', columns: 5, labels: true },
  { id: 'mono', name: 'Monochrome', note: 'Everything in its place', accent: '#efeee8', columns: 4, labels: false },
];

const TEXTURES = [
  { id: 'felt', label: 'Felt texture', base: '#171d1a', size: '3px 3px', opacity: '.2', image: 'radial-gradient(rgba(226,239,229,.15) .6px, transparent .8px)' },
  { id: 'fluted', label: 'Fluted glass', base: '#18201e', size: '14px 100%', opacity: '.2', image: 'repeating-linear-gradient(90deg, transparent 0 5px, rgba(211,239,235,.12) 6px, rgba(255,255,255,.22) 7px, rgba(0,0,0,.12) 9px, transparent 12px)' },
  { id: 'thermal', label: 'Thermal gradients', base: '#121819', size: '100% 100%', opacity: '.42', repeat: 'no-repeat', image: 'radial-gradient(ellipse at 15% 20%, rgba(86,183,165,.38), transparent 48%), radial-gradient(ellipse at 85% 78%, rgba(105,123,204,.32), transparent 46%), linear-gradient(145deg, rgba(24,52,50,.24), transparent 60%)' },
  { id: 'ripples', label: 'Water ripples', base: '#15201f', size: '54px 54px', opacity: '.28', image: 'repeating-radial-gradient(ellipse at 50% 50%, transparent 0 5px, rgba(192,228,225,.18) 6px 7px, transparent 8px 14px)' },
  { id: 'graphite', label: 'Speckled graphite', base: '#111413', size: 'auto', opacity: '.2', image: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%22.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%22.22%22/%3E%3C/svg%3E")' },
  { id: 'landscape', label: 'Single-hue landscapes', base: '#18201b', size: '100% 100%', opacity: '.38', repeat: 'no-repeat', image: 'linear-gradient(164deg, transparent 0 54%, rgba(164,198,161,.18) 55% 61%, transparent 62%), linear-gradient(16deg, transparent 0 62%, rgba(116,151,124,.2) 63% 72%, transparent 73%), linear-gradient(180deg, rgba(197,219,191,.1), transparent 62%)' },
  { id: 'blueprint', label: 'Blueprint grids', base: '#101a1e', size: '28px 28px', opacity: '.3', image: 'linear-gradient(rgba(172,211,220,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(172,211,220,.22) 1px, transparent 1px), linear-gradient(45deg, transparent 49%, rgba(172,211,220,.08) 50%, transparent 51%)' },
  { id: 'halftone', label: 'Halftone', base: '#171a18', size: '8px 8px', opacity: '.3', image: 'radial-gradient(rgba(230,235,226,.24) 1px, transparent 1.3px)' },
  { id: 'grain', label: 'Grainy gradients', base: '#171a18', size: '100% 100%', opacity: '.28', repeat: 'no-repeat', image: 'radial-gradient(ellipse at 20% 30%, rgba(192,214,170,.2), transparent 48%), linear-gradient(145deg, rgba(255,255,255,.06), transparent 55%, rgba(140,170,155,.12))' },
  { id: 'grass', label: 'Grass texture', base: '#152019', size: '12px 24px', opacity: '.25', image: 'repeating-linear-gradient(78deg, transparent 0 5px, rgba(171,204,152,.2) 6px, transparent 7px 11px)' },
  { id: 'dither', label: 'Dithered images', base: '#171a18', size: '4px 4px', opacity: '.2', image: 'repeating-conic-gradient(rgba(225,231,218,.2) 0 25%, transparent 0 50%)' },
  { id: 'paper', label: 'Paper texture', base: '#1b1c19', size: '100% 100%', opacity: '.17', repeat: 'no-repeat', image: 'repeating-linear-gradient(2deg, transparent 0 4px, rgba(231,224,204,.08) 5px, transparent 6px 11px)' },
  { id: 'contour', label: 'Contour lines', base: '#151a18', size: '100% 100%', opacity: '.3', repeat: 'repeat', image: 'repeating-radial-gradient(ellipse at 35% 42%, transparent 0 10px, rgba(210,226,206,.2) 11px 12px, transparent 13px 21px)' },
  { id: 'clouds', label: 'Cloud sky', base: '#18201f', size: '100% 100%', opacity: '.42', repeat: 'no-repeat', image: 'radial-gradient(ellipse at 22% 31%, rgba(211,225,220,.22), transparent 34%), radial-gradient(ellipse at 60% 24%, rgba(180,202,201,.2), transparent 38%), radial-gradient(ellipse at 78% 50%, rgba(206,218,210,.14), transparent 32%)' },
  { id: 'mosaic', label: 'Pixel mosaics', base: '#151916', size: '24px 24px', opacity: '.3', image: 'conic-gradient(from 90deg at 25% 25%, rgba(199,219,187,.18) 25%, transparent 0 50%, rgba(128,159,141,.14) 0 75%, transparent 0)' },
  { id: 'lens', label: 'Lens distortion', base: '#161a1a', size: '100% 100%', opacity: '.28', repeat: 'no-repeat', image: 'repeating-radial-gradient(ellipse at 50% 45%, transparent 0 16px, rgba(211,232,231,.16) 17px, transparent 18px 29px)' },
  { id: 'stipple', label: 'Stippled gradients', base: '#171b19', size: '6px 6px, 100% 100%', opacity: '.28', repeat: 'repeat, no-repeat', image: 'radial-gradient(rgba(222,231,216,.22) .7px, transparent 1px), radial-gradient(ellipse at 80% 20%, rgba(165,204,176,.2), transparent 55%)' },
  { id: 'square-dots', label: 'Square-dot grids', base: '#171a18', size: '9px 9px', opacity: '.3', image: 'conic-gradient(from 90deg at 1px 1px, transparent 25%, rgba(222,231,216,.25) 0 50%, transparent 0)' },
  { id: 'blurred-photo', label: 'Blurred photos', base: '#141917', size: '100% 100%', opacity: '.5', repeat: 'no-repeat', image: 'radial-gradient(ellipse at 15% 22%, rgba(183,212,192,.3), transparent 38%), radial-gradient(ellipse at 78% 70%, rgba(168,181,159,.24), transparent 42%), linear-gradient(140deg, rgba(220,229,215,.08), transparent 58%)' },
  { id: 'iridescent', label: 'Iridescent shapes', base: '#171819', size: '100% 100%', opacity: '.5', repeat: 'no-repeat', image: 'radial-gradient(ellipse at 18% 28%, rgba(132,196,181,.28), transparent 34%), radial-gradient(ellipse at 75% 25%, rgba(168,147,214,.24), transparent 37%), radial-gradient(ellipse at 66% 78%, rgba(210,177,162,.2), transparent 40%)' },
  { id: 'impressionist', label: 'Impressionist paintings', base: '#171b19', size: '36px 32px, 42px 40px, 48px 38px', opacity: '.27', image: 'radial-gradient(ellipse, rgba(196,215,182,.24) 0 18%, transparent 62%), radial-gradient(ellipse, rgba(158,186,174,.2) 0 16%, transparent 60%), radial-gradient(ellipse, rgba(203,190,167,.16) 0 15%, transparent 60%)' },
  { id: 'ascii', label: 'ASCII and pixels', base: '#141816', size: '36px 30px', opacity: '.2', image: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2236%22 height=%2230%22%3E%3Ctext x=%220%22 y=%2210%22 fill=%22%23c6d2c6%22 opacity=%22.55%22 font-family=%22monospace%22 font-size=%227%22%3E01%2010%201%3C/text%3E%3Ctext x=%220%22 y=%2222%22 fill=%22%23c6d2c6%22 opacity=%22.4%22 font-family=%22monospace%22 font-size=%227%22%3E%20%2001%201%3C/text%3E%3C/svg%3E")' },
];

const APP_GLYPHS = {
  phone: Phone, messages: MessageCircle, camera: Camera, photos: Images,
  calendar: CalendarDays, maps: MapPin, music: Music2, settings: Settings,
  clock: Clock3, files: Folder, notes: NotebookPen, browser: Globe2,
};

function readPreference(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readInitialBrightness() {
  try {
    const deviceValue = Number(window.AndroidBattery?.getSystemBrightness?.());
    if (Number.isFinite(deviceValue) && deviceValue >= 5 && deviceValue <= 100) return deviceValue;
  } catch { /* Use the saved Home value when native settings are unavailable. */ }
  return readPreference('osien_brightness', 58);
}

function getPreviewApps() {
  return PREVIEW_APPS.map(([label, kind, color], index) => ({
    packageName: `preview.${kind}`,
    className: `preview.${kind}.MainActivity`,
    label,
    icon: null,
    color,
    kind,
    index,
    preview: true,
  }));
}

function readDeviceApps() {
  try {
    const bridge = window.AndroidBattery;
    if (!bridge || typeof bridge.getLaunchableApps !== 'function') return getPreviewApps();
    const parsed = JSON.parse(bridge.getLaunchableApps());
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((app, index) => ({
        ...app,
        color: ACCENTS[index % ACCENTS.length].value,
        kind: 'native',
        index,
        preview: false,
      }));
    }
  } catch {
    // The preview remains usable if the native app catalog is unavailable.
  }
  return getPreviewApps();
}

function clockLabel(date) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function dateLabel(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

function BatteryGlyph({ level, charging }) {
  return (
    <div className={`battery-glyph ${charging ? 'is-charging' : ''}`} aria-label={`${Math.round(level)} percent battery`}>
      <div className="battery-glyph-fill" style={{ height: `${Math.max(4, Math.min(100, level))}%` }} />
      {charging && <BatteryCharging size={15} strokeWidth={1.8} />}
    </div>
  );
}

function AppIcon({ app, customIcon, size = 'normal', selected = false, onClick, onContextMenu, onLongPress, showLabel = size !== 'small' }) {
  const holdTimer = useRef(null);
  const held = useRef(false);
  const iconRef = useRef(null);
  const [deviceIcon, setDeviceIcon] = useState(() => app.icon || '');
  const Glyph = APP_GLYPHS[app.kind];
  const stopHold = () => { if (holdTimer.current) window.clearTimeout(holdTimer.current); holdTimer.current = null; };
  useEffect(() => {
    if (app.kind !== 'native' || app.icon || customIcon || !app.className) return undefined;
    let active = true;
    const load = () => {
      try {
        const icon = window.AndroidBattery?.getAppIcon?.(app.packageName, app.className);
        if (active && icon) setDeviceIcon(icon);
      } catch { /* Keep the fast text fallback when an app icon is unavailable. */ }
    };
    if (typeof IntersectionObserver === 'undefined') { load(); return () => { active = false; }; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: '80px' });
    if (iconRef.current) observer.observe(iconRef.current);
    return () => { active = false; observer.disconnect(); };
  }, [app.kind, app.icon, app.packageName, app.className, customIcon]);
  const visibleIcon = customIcon || app.icon || deviceIcon;
  return (
    <button
      className={`launcher-app ${size === 'small' ? 'launcher-app-small' : ''} ${selected ? 'launcher-app-selected' : ''}`}
      data-tooltip={app.label}
      onContextMenu={onContextMenu || onLongPress ? (event) => { event.preventDefault(); if (onContextMenu) onContextMenu(); else if (!held.current) { held.current = true; onLongPress?.(); } } : undefined}
      onTouchStart={onLongPress ? () => { held.current = false; holdTimer.current = window.setTimeout(() => { held.current = true; onLongPress(); }, 480); } : undefined}
      onTouchMove={stopHold}
      onTouchEnd={stopHold}
      onClick={(event) => { if (held.current) { held.current = false; event.preventDefault(); return; } onClick?.(event); }}
      aria-label={`Open ${app.label}. Long press to change icon.`}
    >
      <span ref={iconRef} className={`app-icon-surface app-icon-${app.kind} ${customIcon ? 'custom' : ''}`} style={{ '--app-accent': app.color }}>
        {visibleIcon
          ? <img src={visibleIcon} alt="" />
          : Glyph ? <Glyph className="app-symbol" size={22} strokeWidth={1.75} />
            : <span className="preview-glyph glyph-${app.kind}">{app.label.slice(0, 1).toUpperCase()}</span>}
        {selected && <span className="app-selected-mark"><Check size={10} /></span>}
      </span>
      {showLabel && <span className="app-label">{app.label}</span>}
    </button>
  );
}

export default function LauncherHome() {
  const [apps, setApps] = useState(() => readDeviceApps());
  const [now, setNow] = useState(() => new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState('home');
  const [sectionDirection, setSectionDirection] = useState('forward');
  const [focusMode, setFocusMode] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [roleHeld, setRoleHeld] = useState(() => {
    try { return Boolean(window.AndroidBattery?.isHomeRoleHeld?.()); } catch { return false; }
  });
  const [favoriteIds, setFavoriteIds] = useState(() => readPreference('osien_favorites', []));
  const [accent, setAccent] = useState(() => readPreference('osien_accent', '#b8e3b1'));
  const [columns, setColumns] = useState(() => readPreference('osien_columns', 4));
  const [iconScale, setIconScale] = useState(() => readPreference('osien_icon_scale', 100));
  const [showLabels, setShowLabels] = useState(() => readPreference('osien_labels', false));
  const [wallpaper, setWallpaper] = useState(() => readPreference('osien_wallpaper', 'basalt'));
  const [textureId, setTextureId] = useState(() => readPreference('osien_texture', 'graphite'));
  const [glass, setGlass] = useState(() => readPreference('osien_glass', 28));
  const [brightness, setBrightness] = useState(readInitialBrightness);
  const [systemBrightnessAccess, setSystemBrightnessAccess] = useState(() => {
    try { return Boolean(window.AndroidBattery?.canWriteSystemSettings?.()); } catch { return false; }
  });
  const wallpaperInput = useRef(null);
  const iconInput = useRef(null);
  const selectedAppRef = useRef(null);
  const returnToSettingsRef = useRef(false);
  const touchStartRef = useRef(null);
  const lastTapRef = useRef(0);
  const toastTimerRef = useRef(null);
  const searchRef = useRef(null);
  const settingsContentRef = useRef(null);
  const { telemetry } = useBatteryTelemetry({ capacityMah: readPreference('ov_cap', 5000), enabled: controlOpen });

  const favorites = useMemo(() => {
    const byId = new Map(apps.map((app) => [app.packageName, app]));
    return favoriteIds.map((id) => byId.get(id)).filter(Boolean).slice(0, 6);
  }, [apps, favoriteIds]);
  const texture = TEXTURES.find((item) => item.id === textureId) || TEXTURES[4];

  const changeSettingsSection = (nextSection) => {
    const sections = ['home', 'icons', 'display', 'gestures'];
    const currentIndex = sections.indexOf(settingsSection);
    const nextIndex = sections.indexOf(nextSection);
    setSectionDirection(nextIndex >= currentIndex ? 'forward' : 'back');
    setSettingsSection(nextSection);
    if (settingsContentRef.current) settingsContentRef.current.scrollTop = 0;
  };

  const setPressOrigin = (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target || !event.currentTarget.contains(target) || target.querySelector('input[type="range"]')) return;
    const bounds = target.getBoundingClientRect();
    target.style.setProperty('--press-x', `${Math.round(((event.clientX - bounds.left) / bounds.width) * 100)}%`);
    target.style.setProperty('--press-y', `${Math.round(((event.clientY - bounds.top) / bounds.height) * 100)}%`);
    const homeBounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--touch-x', `${Math.round(((event.clientX - homeBounds.left) / homeBounds.width) * 100)}%`);
    event.currentTarget.style.setProperty('--touch-y', `${Math.round(((event.clientY - homeBounds.top) / homeBounds.height) * 100)}%`);
  };
  const defaultDock = useMemo(() => {
    const preferred = ['phone', 'dialer', 'messages', 'camera', 'chrome', 'browser', 'settings'];
    const chosen = preferred.map((word) => apps.find((app) => app.label.toLowerCase().includes(word))).filter(Boolean);
    return [...new Map([...chosen, ...apps].map((app) => [app.packageName, app])).values()].slice(0, columns);
  }, [apps, columns]);

  const filteredApps = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return [...apps]
      .filter((app) => !normalized || app.label.toLocaleLowerCase().includes(normalized) || app.packageName.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [apps, query]);

  useEffect(() => {
    const timeId = window.setInterval(() => setNow(new Date()), 1000);
    const refresh = () => {
      setApps(readDeviceApps());
      try { setRoleHeld(Boolean(window.AndroidBattery?.isHomeRoleHeld?.())); } catch { /* no-op */ }
      try { setSystemBrightnessAccess(Boolean(window.AndroidBattery?.canWriteSystemSettings?.())); } catch { /* no-op */ }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timeId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('osien_favorites', JSON.stringify(favoriteIds));
    localStorage.setItem('osien_accent', JSON.stringify(accent));
    localStorage.setItem('osien_columns', JSON.stringify(columns));
    localStorage.setItem('osien_icon_scale', JSON.stringify(iconScale));
    localStorage.setItem('osien_labels', JSON.stringify(showLabels));
    localStorage.setItem('osien_wallpaper', JSON.stringify(wallpaper));
    localStorage.setItem('osien_texture', JSON.stringify(textureId));
    localStorage.setItem('osien_glass', JSON.stringify(glass));
  }, [favoriteIds, accent, columns, iconScale, showLabels, wallpaper, glass, textureId]);

  useEffect(() => {
    if (systemBrightnessAccess) {
      window.AndroidBattery?.clearHomeBrightness?.();
      setBrightness(readInitialBrightness());
    }
  }, [systemBrightnessAccess]);

  const showToast = useCallback((message, tone = 'info') => {
    setToast({ message, tone });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const launch = useCallback((app) => {
    if (app.preview) {
      showToast('App launching is available in the Android app preview.');
      return;
    }
    try {
      window.AndroidBattery?.launchApp?.(app.packageName, app.className);
    } catch {
      showToast(`Couldn't open ${app.label}.`, 'error');
    }
  }, [showToast]);

  const toggleFavorite = useCallback((app) => {
    setFavoriteIds((current) => current.includes(app.packageName)
      ? current.filter((id) => id !== app.packageName)
      : current.length < 6 ? [...current, app.packageName] : [...current.slice(1), app.packageName]);
    showToast(favoriteIds.includes(app.packageName) ? 'Removed from dock' : 'Added to dock');
  }, [favoriteIds, showToast]);

  const openDrawer = useCallback(() => {
    returnToSettingsRef.current = false;
    setDrawerOpen(true);
    setControlOpen(false);
    setSettingsOpen(false);
    window.setTimeout(() => searchRef.current?.focus(), 260);
  }, []);

  const openDrawerFromSettings = useCallback(() => {
    openDrawer();
    returnToSettingsRef.current = true;
  }, [openDrawer]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setQuery('');
    if (returnToSettingsRef.current) {
      returnToSettingsRef.current = false;
      setSettingsOpen(true);
    }
  }, []);

  const requestDefaultHome = () => {
    if (!window.AndroidBattery?.requestHomeRole) {
      showToast('Choose OSIEN in your device’s Home app settings.');
      return;
    }
    window.AndroidBattery.requestHomeRole();
    window.setTimeout(() => {
      try { setRoleHeld(Boolean(window.AndroidBattery?.isHomeRoleHeld?.())); } catch { /* no-op */ }
    }, 700);
  };

  const openSystemPanel = (panel) => {
    if (window.AndroidBattery?.openSystemPanel) {
      window.AndroidBattery.openSystemPanel(panel);
      return;
    }
    showToast('This system control is available on an Android phone.');
  };

  const handleBrightnessChange = (event) => {
    const value = Number(event.target.value);
    setBrightness(value);
    localStorage.setItem('osien_brightness', JSON.stringify(value));
    if (systemBrightnessAccess && window.AndroidBattery?.setSystemBrightness) {
      window.AndroidBattery.setSystemBrightness(value);
      window.AndroidBattery.clearHomeBrightness?.();
    } else if (window.AndroidBattery?.setHomeBrightness) {
      window.AndroidBattery.setHomeBrightness(value / 100);
    }
  };

  const applyPreset = (preset) => {
    setAccent(preset.accent);
    setColumns(preset.columns);
    setShowLabels(preset.labels);
    showToast(`${preset.name} applied`);
  };

  const openCustomIcon = (app) => {
    selectedAppRef.current = app;
    iconInput.current?.click();
  };

  const storeCustomIcon = (event) => {
    const file = event.target.files?.[0];
    const app = selectedAppRef.current;
    if (!file || !app) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 192;
        canvas.height = 192;
        const context = canvas.getContext('2d');
        const scale = Math.min(192 / image.width, 192 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (192 - width) / 2, (192 - height) / 2, width, height);
        const imageUrl = canvas.toDataURL('image/webp', 0.84);
        const customIcons = readPreference('osien_custom_icons', {});
        customIcons[app.packageName] = imageUrl;
        try {
          localStorage.setItem('osien_custom_icons', JSON.stringify(customIcons));
          setCustomIcons(customIcons);
          showToast(`${app.label} icon updated`);
        } catch {
          showToast('That image is too large to save. Try a smaller image.', 'error');
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const storeWallpaper = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1100 / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        try {
          localStorage.setItem('osien_wallpaper_image', canvas.toDataURL('image/webp', 0.78));
          setWallpaper('custom');
          showToast('Wallpaper saved');
        } catch {
          showToast('Image too large to save. Try a smaller image.', 'error');
        }
      };
      image.onerror = () => showToast('That image could not be opened.', 'error');
      image.src = reader.result;
    };
    reader.onerror = () => showToast('That image could not be read.', 'error');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const [customIcons, setCustomIcons] = useState(() => readPreference('osien_custom_icons', {}));

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    if (event.touches.length > 1) {
      const a = event.touches[0]; const b = event.touches[1];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, target: event.target, interactive: Boolean(event.target.closest('button, input')), distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), actionFired: false };
      return;
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, target: event.target, interactive: Boolean(event.target.closest('button, input')), actionFired: false };
  };

  const handleTouchMove = (event) => {
    const start = touchStartRef.current;
    if (!start?.distance || start.actionFired || event.touches.length < 2 || drawerOpen || controlOpen || settingsOpen) return;
    const a = event.touches[0]; const b = event.touches[1];
    const change = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) - start.distance;
    if (Math.abs(change) < 48) return;
    start.actionFired = true;
    if (change < 0) openDrawer();
    else { setSettingsOpen(true); setSettingsSection('home'); }
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches?.[0];
    touchStartRef.current = null;
    if (!start || !touch || start.actionFired) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (settingsOpen) return;
    if (drawerOpen || controlOpen) {
      const appList = start.target.closest('.drawer-app-list');
      const canDismissDown = !appList || appList.scrollTop <= 0;
      if ((dy > 85 && canDismissDown) || dx > 100) {
        if (drawerOpen) closeDrawer();
        if (controlOpen) setControlOpen(false);
      }
      return;
    }
    if (start.interactive) return;
    if (focusMode && (Math.abs(dx) > 50 || Math.abs(dy) > 50)) { setFocusMode(false); return; }
    if (start.y < 100 && dy > 58) { setControlOpen(true); setFocusMode(false); }
    else if (dy < -65 && Math.abs(dx) < 100) { openDrawer(); setFocusMode(false); }
    else if (dx < -90 && Math.abs(dy) < 80 && start.x < window.innerWidth - 28) { openDrawer(); setFocusMode(false); }
    else if (dx > 90 && Math.abs(dy) < 80 && start.x > 28) { setSettingsOpen(true); setSettingsSection('home'); setFocusMode(false); }
  };

  const handleBackgroundTap = (event) => {
    if (event.target.closest('button, input, .launcher-overlay, .launcher-settings')) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setFocusMode((current) => !current);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const editingText = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName));
      if (event.key === 'Escape' || (event.key === 'Backspace' && !editingText)) {
        if (drawerOpen || controlOpen || settingsOpen) {
          event.preventDefault();
          if (drawerOpen) closeDrawer();
          else { setControlOpen(false); setSettingsOpen(false); setQuery(''); }
        } else if (focusMode) setFocusMode(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); openDrawer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, controlOpen, settingsOpen, focusMode, openDrawer, closeDrawer]);

  useEffect(() => {
    const handlesBack = drawerOpen || controlOpen || settingsOpen || focusMode;
    window.AndroidBattery?.setBackHandlingEnabled?.(handlesBack);
    return () => window.AndroidBattery?.setBackHandlingEnabled?.(false);
  }, [drawerOpen, controlOpen, settingsOpen, focusMode]);

  const appCountText = apps.length === 1 ? '1 application' : `${apps.length} applications`;
  const percentage = Number.isFinite(telemetry?.pct) ? Math.round(telemetry.pct) : null;

  return (
    <div
      className={`osien-home wallpaper-${wallpaper} ${showLabels ? '' : 'labels-hidden'} ${focusMode ? 'focus-mode' : ''}`}
      data-texture={texture.id}
      style={{ '--osien-accent': accent, '--osien-columns': columns, '--osien-icon-scale': iconScale / 100, '--osien-glass': `${glass}px`, '--custom-wallpaper': `url(${readPreference('osien_wallpaper_image', '')})`, '--osien-texture': texture.image, '--osien-texture-size': texture.size, '--osien-texture-repeat': texture.repeat || 'repeat', '--osien-texture-opacity': texture.opacity, '--osien-texture-base': texture.base }}
      onPointerDown={setPressOrigin}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleBackgroundTap}
    >
      <div className="home-wallpaper-grain" aria-hidden="true" />
      <div className="home-layout">
        <header className="home-topbar">
          <div className="topbar-actions">
            {!roleHeld && <button className="home-role-chip" onClick={requestDefaultHome}><span className="role-chip-dot" /> Set as Home</button>}
            <button className="icon-button control-launch" aria-label="Open Control Center" onClick={() => { setControlOpen(true); setDrawerOpen(false); }}>
              <SlidersHorizontal size={19} strokeWidth={1.7} />
            </button>
            <button className="icon-button studio-launch" aria-label="Open OSIEN Settings" onClick={() => { setSettingsOpen(true); setSettingsSection('home'); setDrawerOpen(false); }}>
              <Settings2 size={19} strokeWidth={1.7} />
            </button>
          </div>
        </header>

        <main className="home-content">
          <section className="home-clock-row" aria-label="Time and battery">
            <div className="clock-block">
              <div className="clock-date">{dateLabel(now)}</div>
              <div className="clock-time tabular">{clockLabel(now)}</div>
            </div>
          </section>

          <button className="home-search" onClick={openDrawer} aria-label="Search apps">
            <span className="search-leading"><Search size={18} strokeWidth={1.8} /></span>
            <span className="search-copy">Find an app</span>
            <span className="search-key"><ArrowRight size={15} /></span>
          </button>
        </main>

        <footer className="home-footer">
          <div className="footer-hairline" />
          <div className="home-dock-wrap">
            <div className="home-dock">
              {(favorites.length ? favorites.slice(0, columns) : defaultDock).map((app) => (
                <AppIcon key={`${app.packageName}/${app.className}`} app={app} customIcon={customIcons[app.packageName]} size="small" showLabel={showLabels} onClick={() => launch(app)} onLongPress={() => openCustomIcon(app)} />
              ))}
              <button className="dock-drawer-button" aria-label="Open app drawer" onClick={openDrawer}><Grid2X2 size={19} strokeWidth={1.7} /></button>
            </div>
          </div>
          <div className="home-indicator" />
        </footer>
      </div>

      {drawerOpen && (
        <div className="launcher-overlay drawer-overlay" role="dialog" aria-modal="true" aria-label="App library">
          <div className="drawer-panel">
            <div className="overlay-grab" />
            <header className="drawer-header">
              <div><span className="section-kicker">OSIEN LIBRARY</span><h2>Every app<span className="drawer-count">{appCountText}</span></h2></div>
              <button className="icon-button overlay-close" aria-label="Close app library" onClick={closeDrawer}><X size={19} /></button>
            </header>
            <label className="drawer-search"><Search size={18} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your apps" aria-label="Search your apps" /><span className="search-esc">ESC</span></label>
            <div className="drawer-subhead"><span>{query ? `${filteredApps.length} MATCHING` : 'A TO Z'}</span><span>TAP THE PALETTE TO CHANGE AN ICON</span></div>
            <div className="drawer-app-list">
              {filteredApps.map((app) => (
                <div className="drawer-app-row" key={app.packageName}>
                  <AppIcon app={app} customIcon={customIcons[app.packageName]} size="small" onClick={() => launch(app)} onLongPress={() => openCustomIcon(app)} />
                  <button className="drawer-app-name" onClick={() => launch(app)}><span>{app.label}</span><small>{app.preview ? 'PREVIEW APP' : app.packageName}</small></button>
                  <button className="icon-restyle" onClick={() => openCustomIcon(app)} aria-label={`Change ${app.label} icon`}><Palette size={16} /></button>
                  <button className={`favorite-action ${favoriteIds.includes(app.packageName) ? 'favorited' : ''}`} onClick={() => toggleFavorite(app)} aria-label={`${favoriteIds.includes(app.packageName) ? 'Remove' : 'Add'} ${app.label} ${favoriteIds.includes(app.packageName) ? 'from' : 'to'} dock`}>
                    {favoriteIds.includes(app.packageName) ? <Heart size={17} fill="currentColor" /> : <Plus size={17} />}
                  </button>
                </div>
              ))}
              {filteredApps.length === 0 && <div className="drawer-empty"><Search size={20} /><span>No apps match “{query}”</span></div>}
            </div>
            <div className="drawer-footer"><span>Swipe down to close. Use the palette to change icons.</span><span className="drawer-footer-mark">O.</span></div>
          </div>
        </div>
      )}

      {controlOpen && (
        <div className="launcher-overlay control-overlay" role="dialog" aria-modal="true" aria-label="Control Center">
          <div className="control-panel">
            <div className="overlay-grab" />
            <header className="panel-header">
              <div><span className="section-kicker">QUICK CONTROLS</span><h2>Control Center</h2></div>
              <button className="icon-button overlay-close" aria-label="Close Control Center" onClick={() => setControlOpen(false)}><X size={19} /></button>
            </header>
            <div className="control-date-row"><span>{clockLabel(now)}</span><span>{dateLabel(now)}</span></div>
            <div className="control-connectivity">
              <button className="connectivity-tile primary" onClick={() => openSystemPanel('internet')}><span className="connectivity-icon"><Wifi size={19} /></span><span><b>Internet</b><small>Manage connection</small></span><ChevronRight size={15} /></button>
              <button className="connectivity-tile" onClick={() => openSystemPanel('bluetooth')}><span className="connectivity-icon"><Bluetooth size={19} /></span><span><b>Bluetooth</b><small>Open device settings</small></span><ChevronRight size={15} /></button>
            </div>
            <section className="control-range-card">
              <div className="range-heading"><div className="range-symbol"><Sun size={17} /></div><div><span>Brightness</span><small>{systemBrightnessAccess ? 'Phone display' : 'This Home screen'}</small></div><strong>{brightness}%</strong></div>
              <input type="range" min="5" max="100" step="1" value={brightness} onChange={handleBrightnessChange} aria-label="Screen brightness" />
              {!systemBrightnessAccess && window.AndroidBattery && <button className="permission-nudge" onClick={() => { window.AndroidBattery.requestSystemSettingsPermission?.(); showToast('Allow OSIEN to change system brightness in Settings.'); }}><span>Allow system-wide brightness</span><ArrowRight size={14} /></button>}
            </section>
            <section className="control-quick-actions">
              <button onClick={() => openSystemPanel('volume')}><Volume2 size={18} /><span>Volume</span></button>
              <button onClick={() => openSystemPanel('display')}><Sun size={18} /><span>Display</span></button>
              <button onClick={() => openSystemPanel('sound')}><Settings2 size={18} /><span>Sound</span></button>
            </section>
            <button className="control-battery-card" onClick={() => { setControlOpen(false); window.dispatchEvent(new Event('osien-open-battery')); }}>
              <span className="control-battery-icon"><BatteryCharging size={19} /></span>
              <span className="control-battery-copy"><b>Battery</b><small>{telemetry?.chargeState === 'charging' ? 'Charging' : 'Battery health & AOD'}</small></span>
              <strong className="tabular">{percentage === null ? '—' : `${percentage}%`}</strong><ChevronRight size={15} />
            </button>
            <div className="control-panel-note"><LockKeyhole size={13} /><span>Connection switches open Android’s trusted settings panel.</span></div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <section className="launcher-settings" role="dialog" aria-modal="true" aria-label="OSIEN Settings">
          <header className="settings-header">
            <button className="settings-back" onClick={() => setSettingsOpen(false)} aria-label="Back to Home"><ArrowLeft size={19} /><span>Home</span></button>
            <div className="settings-title"><img src="/logo.png" alt="" /><div><span>OSIEN</span><h1>Settings</h1></div></div>
            <span className="settings-header-mark">O.</span>
          </header>
          <nav className="settings-tabs" aria-label="Settings categories">
            {[['home', 'Home'], ['icons', 'Icons'], ['display', 'Display'], ['gestures', 'Gestures']].map(([id, label]) => (
              <button key={id} className={settingsSection === id ? 'active' : ''} aria-current={settingsSection === id ? 'page' : undefined} onClick={() => changeSettingsSection(id)}>{label}</button>
            ))}
          </nav>
          <div className="settings-content" ref={settingsContentRef}>
            <div key={settingsSection} className={`settings-section-view settings-section-view-${sectionDirection}`}>
            {settingsSection === 'home' && <>
              <div className="settings-heading"><span className="section-kicker">HOME SCREEN</span><h2>A layout that feels right</h2><p>Choose a starting point, then set the apps you want close by.</p></div>
              <div className="preset-grid settings-preset-grid">
                {PRESETS.map((preset) => (
                  <button key={preset.id} className={`preset-card ${accent === preset.accent && columns === preset.columns && showLabels === preset.labels ? 'selected' : ''}`} onClick={() => applyPreset(preset)}>
                    <span className={`preset-preview preset-${preset.id}`} style={{ '--preset-accent': preset.accent }}><i /><i /><i /><i /></span>
                    <span className="preset-name">{preset.name}{accent === preset.accent && columns === preset.columns && showLabels === preset.labels && <Check size={13} />}</span>
                    <span className="preset-note">{preset.note}</span>
                  </button>
                ))}
              </div>
              <div className="settings-group">
                <div className="settings-group-heading"><div><b>Dock apps</b><small>How many shortcuts to show</small></div><strong>{columns}</strong></div>
                <div className="settings-choice-row">{[4, 5, 6].map((value) => <button key={value} className={columns === value ? 'selected' : ''} aria-pressed={columns === value} onClick={() => setColumns(value)}>{value}</button>)}</div>
                <button className="settings-action-row" onClick={openDrawerFromSettings}><span><b>Choose dock apps</b><small>{favorites.length ? `${favorites.length} pinned` : 'Suggested apps'} ({columns} shown)</small></span><ChevronRight size={17} /></button>
              </div>
            </>}
            {settingsSection === 'icons' && <>
              <div className="settings-heading"><span className="section-kicker">APP ICONS</span><h2>Your icon system</h2><p>One OSIEN frame, with app symbols kept recognizable.</p></div>
              <div className="settings-group">
                <div className="settings-group-heading"><div><b>Accent color</b><small>{ACCENTS.find((item) => item.value === accent)?.name || 'Custom'}</small></div></div>
                <div className="accent-row" role="group" aria-label="Accent color">
                  {ACCENTS.map((item) => <button key={item.value} className={`accent-swatch ${accent === item.value ? 'selected' : ''}`} style={{ '--swatch': item.value }} onClick={() => setAccent(item.value)} aria-label={`${item.name} accent`} aria-pressed={accent === item.value} />)}
                </div>
              </div>
              <div className="settings-group">
                <div className="settings-group-heading"><div><b>Icon size</b><small>Adjust the dock and library rhythm</small></div><strong>{iconScale}%</strong></div>
                <input className="settings-range" type="range" min="80" max="120" step="5" value={iconScale} onChange={(event) => setIconScale(Number(event.target.value))} aria-label="Icon size" />
              </div>
              <button className={`settings-switch ${showLabels ? 'on' : ''}`} aria-pressed={showLabels} onClick={() => setShowLabels((value) => !value)}><span><b>App names</b><small>Show names below dock icons</small></span><span className="switch-track"><i /></span></button>
              <button className="settings-action-row" onClick={openDrawerFromSettings}><span><b>Change an app icon</b><small>Choose an image for any app</small></span><ChevronRight size={17} /></button>
            </>}
            {settingsSection === 'display' && <>
              <div className="settings-heading"><span className="section-kicker">DISPLAY</span><h2>Set the atmosphere</h2><p>Choose a backdrop and keep glass effects as subtle as you like.</p></div>
              <div className="settings-group">
                <div className="settings-group-heading"><div><b>Wallpaper</b><small>Applied to the OSIEN Home screen</small></div></div>
                <div className="wallpaper-options">
                  {['basalt', 'moss', 'dusk'].map((value) => <button key={value} className={`wallpaper-option wallpaper-swatch-${value} ${wallpaper === value ? 'selected' : ''}`} onClick={() => setWallpaper(value)} aria-label={`${value} wallpaper`} aria-pressed={wallpaper === value} />)}
                  {wallpaper === 'custom' && <button className="wallpaper-option wallpaper-custom-option selected" aria-label="Your wallpaper" aria-pressed="true" />}
                  <button className="wallpaper-add" onClick={() => wallpaperInput.current?.click()}><Plus size={14} /> Your photo</button>
                </div>
                <input ref={wallpaperInput} className="visually-hidden" type="file" accept="image/*" onChange={storeWallpaper} />
              </div>
              <button className={`settings-switch ${glass > 0 ? 'on' : ''}`} aria-pressed={glass > 0} onClick={() => setGlass((value) => value > 0 ? 0 : 28)}><span><b>Glass surfaces</b><small>Blur panels and dock softly</small></span><span className="switch-track"><i /></span></button>
              <div className={`settings-expand ${glass > 0 ? 'expanded' : ''}`} aria-hidden={glass === 0}>
                <div className="settings-expand-inner">
                  {glass > 0 && <div className="settings-group"><div className="settings-group-heading"><div><b>Glass strength</b><small>Lower values stay clearer</small></div><strong>{glass}</strong></div><input className="settings-range" type="range" min="8" max="52" step="4" value={glass} onChange={(event) => setGlass(Number(event.target.value))} aria-label="Glass strength" /></div>}
                </div>
              </div>
              <details className="settings-texture-picker">
                <summary><span><b>Surface texture</b><small>{texture.label} and {TEXTURES.length - 1} alternatives</small></span><ChevronRight size={16} /></summary>
                <div className="texture-options" role="group" aria-label="Surface texture">
                  {TEXTURES.map((item, index) => (
                    <button key={item.id} className={`texture-option ${texture.id === item.id ? 'selected' : ''}`} onClick={() => setTextureId(item.id)} aria-pressed={texture.id === item.id} style={{ '--texture-index': index }}>
                      <span className="texture-swatch" aria-hidden="true" style={{ '--sample-image': item.image, '--sample-size': item.size, '--sample-repeat': item.repeat || 'repeat', '--sample-base': item.base, '--sample-opacity': item.opacity }} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </details>
            </>}
            {settingsSection === 'gestures' && <>
              <div className="settings-heading"><span className="section-kicker">GESTURES</span><h2>Move through OSIEN</h2><p>Short actions for the things you use most.</p></div>
              <div className="gesture-list settings-gesture-list">
                <span><b>Swipe up or left</b><small>Open the app library</small></span>
                <span><b>Swipe down from the top</b><small>Open Control Center</small></span>
                <span><b>Swipe right</b><small>Open Settings</small></span>
                <span><b>Pinch in / out</b><small>Library / Settings</small></span>
                <span><b>Double tap empty space</b><small>Show the clock only; swipe to restore</small></span>
                <span><b>Hold an app icon</b><small>Choose custom icon artwork</small></span>
                <span><b>Swipe down on a quick panel</b><small>Close the app library or Control Center</small></span>
                <span><b>System Back</b><small>Return to the previous screen</small></span>
              </div>
            </>}
            </div>
          </div>
          <footer className="settings-footer"><span>OSIEN</span><span>Changes save automatically</span></footer>
        </section>
      )}

      <input ref={iconInput} className="visually-hidden" type="file" accept="image/*" onChange={storeCustomIcon} />
      {toast && <div className={`osien-toast ${toast.tone === 'error' ? 'osien-toast-error' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'}>{toast.message}</div>}
    </div>
  );
}
