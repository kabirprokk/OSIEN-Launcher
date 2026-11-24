import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, EyeOff, Eye, Palette, Download } from 'lucide-react';
import {
  CHARGER_PRESETS,
  CAPACITY_PRESETS,
  useBatteryTelemetry,
} from './engine/batteryEngine';
import { TEMPLATES, ACCENT_COLORS, FONT_PRESETS } from './templates';

const APP_VERSION = '0.0.2';
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

export default function App() {
  const [tplIndex, setTplIndex] = useState(() => {
    const saved = Number(localStorage.getItem('ov_tpl') || 0);
    return Number.isFinite(saved) && saved >= 0 && saved < TEMPLATES.length ? saved : 0;
  });
  const [hudVisible, setHudVisible] = useState(true);
  const [sheetTab, setSheetTab] = useState(null); // null | 'style' | 'aod'

  // Customizer theme state
  const [accent, setAccent] = useState(() => localStorage.getItem('ov_accent') || '#10b981');
  const [fontId, setFontId] = useState(() => localStorage.getItem('ov_font') || 'display');
  const [glow, setGlow] = useState(() => Number(localStorage.getItem('ov_glow') ?? 45));
  const [showTelemetry, setShowTelemetry] = useState(() => localStorage.getItem('ov_tele') !== 'false');

  // AOD & Calibration state
  const [mode, setMode] = useState('auto');
  const [chargerId, setChargerId] = useState(() => localStorage.getItem('ov_charger') || 'turbo-67w');
  const [capacityMah, setCapacityMah] = useState(() => Number(localStorage.getItem('ov_cap') || 5000));
  const [simCharging, setSimCharging] = useState(true);
  const [smartLimitPct, setSmartLimitPct] = useState(0);
  const [aodEnabled, setAodEnabled] = useState(() => localStorage.getItem('ov_aod_on') !== 'false');
  const [aodChargingOnly, setAodChargingOnly] = useState(() => localStorage.getItem('ov_aod_chg') === 'true');
  const [aodBrightness, setAodBrightness] = useState(() => Number(localStorage.getItem('ov_bright') || 35));
  const [showClock, setShowClock] = useState(() => localStorage.getItem('ov_clock') !== 'false');
  const [now, setNow] = useState(() => new Date());
  const [burnInOffset, setBurnInOffset] = useState({ x: 0, y: 0 });
  const [updateInfo, setUpdateInfo] = useState(null); // { version, apkUrl }
  const [updating, setUpdating] = useState(false);

  // Check GitHub Releases for newer version on app start
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

  const lastTapRef = useRef(0);
  const touchStartX = useRef(null);

  const fontPreset = FONT_PRESETS.find((f) => f.id === fontId) || FONT_PRESETS[0];
  const theme = {
    accent,
    font: fontPreset.family,
    weight: fontPreset.weight,
    glow,
    showTelemetry,
  };

  useEffect(() => {
    localStorage.setItem('ov_tpl', String(tplIndex));
    localStorage.setItem('ov_accent', accent);
    localStorage.setItem('ov_font', fontId);
    localStorage.setItem('ov_glow', String(glow));
    localStorage.setItem('ov_tele', String(showTelemetry));
    localStorage.setItem('ov_charger', chargerId);
    localStorage.setItem('ov_cap', String(capacityMah));
    localStorage.setItem('ov_aod_on', String(aodEnabled));
    localStorage.setItem('ov_aod_chg', String(aodChargingOnly));
    localStorage.setItem('ov_bright', String(aodBrightness));
    localStorage.setItem('ov_clock', String(showClock));

    if (typeof window !== 'undefined' && window.AndroidBattery) {
      try {
        window.AndroidBattery.setAodConfig(aodEnabled, aodChargingOnly);
        window.AndroidBattery.setAodBrightness(Math.max(0.03, aodBrightness / 100));
      } catch {
        // Ignore
      }
    }
  }, [tplIndex, accent, fontId, glow, showTelemetry, chargerId, capacityMah, aodEnabled, aodChargingOnly, aodBrightness, showClock]);

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setTplIndex((i) => (i + 1) % TEMPLATES.length);
      if (e.key === 'ArrowLeft') setTplIndex((i) => (i - 1 + TEMPLATES.length) % TEMPLATES.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { telemetry, setManualPct } = useBatteryTelemetry({
    mode,
    chargerId,
    capacityMah,
    simCharging,
    simStartPct: 58.23,
    smartLimitPct,
  });

  const activeTemplate = TEMPLATES[tplIndex];
  const TemplateComponent = activeTemplate.component;
  const isLight = activeTemplate.light;

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 55) {
      setTplIndex((i) => (dx < 0 ? (i + 1) % TEMPLATES.length : (i - 1 + TEMPLATES.length) % TEMPLATES.length));
    }
  };

  return (
    <div className="app-shell">
      {/* Top minimal HUD */}
      <div className={`hud-top ${hudVisible ? '' : 'hidden'}`}>
        <button className={`hud-pill ${isLight ? 'light-surface' : ''}`} onClick={() => setSheetTab('aod')}>
          <span className={`hud-dot ${telemetry.source === 'simulated' ? 'sim' : ''}`} />
          <span style={{ fontWeight: 600 }}>OSIEN Volt</span>
          <span style={{ opacity: 0.45 }}>·</span>
          <span>{activeTemplate.name}</span>
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`hud-pill ${isLight ? 'light-surface' : ''}`} onClick={() => setSheetTab('style')} title="Customize Template">
            <Palette size={14} />
          </button>
          <button className={`hud-pill ${isLight ? 'light-surface' : ''}`} onClick={() => setHudVisible((v) => !v)} title="Pure AOD View">
            {hudVisible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button className={`hud-pill ${isLight ? 'light-surface' : ''}`} onClick={() => setSheetTab('aod')} title="AOD & Calibration">
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Automatic OTA Update Banner */}
      {updateInfo && hudVisible && (
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
              background: 'rgba(16, 185, 129, 0.18)',
              borderColor: 'rgba(16, 185, 129, 0.45)',
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
          transform: `translate(${burnInOffset.x}px, ${burnInOffset.y}px)`,
          transition: 'transform 1.2s ease',
        }}
        onClick={() => {
          if (sheetTab) return;
          const nowMs = Date.now();
          if (!hudVisible && nowMs - lastTapRef.current < 320) {
            if (typeof window !== 'undefined' && window.AndroidBattery) {
              window.AndroidBattery.unlockDevice();
            } else {
              setHudVisible(true);
            }
            lastTapRef.current = 0;
            return;
          }
          lastTapRef.current = nowMs;
          setHudVisible((v) => !v);
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {showClock && !hudVisible && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(var(--safe-top) + 18px)',
              left: 0,
              right: 0,
              zIndex: 20,
              textAlign: 'center',
              pointerEvents: 'none',
              color: isLight ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.72)',
            }}
          >
            <div className="tabular" style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, letterSpacing: '0.04em' }}>
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        )}
        <TemplateComponent t={telemetry} theme={theme} />
      </div>

      {/* Bottom template switcher */}
      <div className={`hud-bottom ${hudVisible ? '' : 'hidden'}`}>
        <div className={`template-strip ${isLight ? 'light-surface' : ''}`}>
          {TEMPLATES.map((tpl, idx) => (
            <button key={tpl.id} className={`tpl-chip ${idx === tplIndex ? 'active' : ''}`} onClick={() => setTplIndex(idx)}>
              {tpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Customizer & AOD Bottom Sheet */}
      {sheetTab && (
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
                  <div className="toggle-row">
                    <span style={{ fontSize: 13 }}>Lockscreen Clock & Date</span>
                    <button className={`opt-btn ${showClock ? 'active' : ''}`} style={{ padding: '6px 14px' }} onClick={() => setShowClock((v) => !v)}>
                      {showClock ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="sheet-section">
                  <div className="sheet-label">Always-On Display</div>
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
                  <div className="sheet-label">Battery Capacity (for exact coulomb math)</div>
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
                          <span className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>{telemetry.pct.toFixed(2)}%</span>
                        </div>
                        <input type="range" min="1" max="99" value={Math.round(telemetry.pct)} onChange={(e) => setManualPct(Number(e.target.value) + 0.23)} className="range-input" />
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
