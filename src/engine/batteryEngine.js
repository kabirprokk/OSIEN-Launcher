import { useEffect, useRef, useState } from 'react';

export const CAPACITY_PRESETS = [3500, 4000, 4500, 5000, 5500, 6000];

function socToOcv(soc) {
  const s = Math.max(0, Math.min(100, soc));
  const points = [
    [0, 3.25], [5, 3.52], [10, 3.62], [20, 3.72],
    [40, 3.79], [60, 3.88], [80, 4.08], [90, 4.22], [100, 4.38],
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (s >= x0 && s <= x1) {
      return y0 + ((s - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 4.38;
}

const INITIAL_TELEMETRY = {
  pct: 0,
  charging: false,
  chargeState: 'discharging',
  vIn: 0,
  iInMa: 0,
  vBat: 3.85,
  iBatMa: 0,
  watts: 0,
  pctPerSec: 0,
  pctPerMin: 0,
  etaSeconds: 0,
  tempC: 30.0,
  source: 'hardware',
  protocol: 'Battery',
  history: [],
};

export function useBatteryTelemetry({ capacityMah = 5000, enabled = true } = {}) {
  const [hardwareSupported, setHardwareSupported] = useState(false);
  const [hwState, setHwState] = useState({
    level: null,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: Infinity,
  });
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY);

  const pctRef = useRef(null);
  const ewmaCurrentRef = useRef(null);
  const lastHwTickRef = useRef({ time: Date.now(), level: null });
  const learnedRateRef = useRef(null);
  const historyRef = useRef([]);

  // Web Battery Status API fallback (browsers)
  useEffect(() => {
    if (!enabled) return undefined;
    let batteryObj = null;
    let mounted = true;

    const syncBattery = (b) => {
      if (!mounted) return;
      const levelPct = b.level * 100;
      const now = Date.now();
      if (lastHwTickRef.current.level !== null && lastHwTickRef.current.level !== levelPct && b.charging) {
        const dtSec = (now - lastHwTickRef.current.time) / 1000;
        const dPct = levelPct - lastHwTickRef.current.level;
        if (dtSec > 2 && dPct > 0) learnedRateRef.current = dPct / dtSec;
      }
      if (lastHwTickRef.current.level !== levelPct) {
        lastHwTickRef.current = { time: now, level: levelPct };
      }
      setHwState({
        level: levelPct,
        charging: b.charging,
        chargingTime: b.chargingTime,
        dischargingTime: b.dischargingTime,
      });
      if (pctRef.current === null || Math.abs(pctRef.current - levelPct) > 1.2) {
        pctRef.current = levelPct;
      }
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      navigator.getBattery().then((b) => {
        if (!mounted) return;
        batteryObj = b;
        setHardwareSupported(true);
        syncBattery(b);
        const onChange = () => syncBattery(b);
        b.addEventListener('levelchange', onChange);
        b.addEventListener('chargingchange', onChange);
        b.addEventListener('chargingtimechange', onChange);
        b.addEventListener('dischargingtimechange', onChange);
        b._cleanup = () => {
          b.removeEventListener('levelchange', onChange);
          b.removeEventListener('chargingchange', onChange);
          b.removeEventListener('chargingtimechange', onChange);
          b.removeEventListener('dischargingtimechange', onChange);
        };
      }).catch(() => {
        if (mounted) setHardwareSupported(false);
      });
    }

    return () => {
      mounted = false;
      if (batteryObj && batteryObj._cleanup) batteryObj._cleanup();
    };
  }, [enabled]);

  // 100ms (10Hz) exact coulomb-counting & EWMA-smoothed telemetry loop for fast 3-decimal (54.347%) updates
  useEffect(() => {
    if (!enabled) return undefined;
    const TICK_MS = 100;
    const DT_SEC = TICK_MS / 1000;

    const timer = setInterval(() => {
      let nativeData = null;
      if (typeof window !== 'undefined' && window.AndroidBattery && typeof window.AndroidBattery.getTelemetry === 'function') {
        try {
          const parsed = JSON.parse(window.AndroidBattery.getTelemetry());
          if (parsed && typeof parsed.pct === 'number' && parsed.pct >= 0) {
            nativeData = parsed;
          }
        } catch {
          // Ignore malformed bridge data
        }
      }

      const batteryWh = (capacityMah / 1000) * 3.85;

      // 1. NATIVE ANDROID HARDWARE PATH
      if (nativeData !== null) {
        setHardwareSupported(true);
        const now = Date.now();
        const hwLevel = nativeData.pct;

        if (pctRef.current === null) pctRef.current = hwLevel;

        if (lastHwTickRef.current.level !== null && lastHwTickRef.current.level !== hwLevel && nativeData.chargeState === 'charging') {
          const dtSec = (now - lastHwTickRef.current.time) / 1000;
          const dPct = hwLevel - lastHwTickRef.current.level;
          if (dtSec > 2 && dPct > 0) {
            learnedRateRef.current = learnedRateRef.current
              ? learnedRateRef.current * 0.6 + (dPct / dtSec) * 0.4
              : dPct / dtSec;
          }
        }
        if (lastHwTickRef.current.level !== hwLevel) {
          lastHwTickRef.current = { time: now, level: hwLevel };
          if (Math.abs(pctRef.current - hwLevel) > 1.1) {
            pctRef.current = hwLevel;
          }
        }

        const chargeState = nativeData.chargeState || (nativeData.charging ? 'charging' : 'discharging');
        const isCharging = chargeState === 'charging';
        const isPausedOrFull = chargeState === 'paused' || chargeState === 'full';

        const rawMa = nativeData.currentMa > 0 ? nativeData.currentMa : (isCharging ? 1500 : isPausedOrFull ? 0 : 320);
        ewmaCurrentRef.current = ewmaCurrentRef.current === null
          ? rawMa
          : ewmaCurrentRef.current * 0.75 + rawMa * 0.25;

        const smoothMa = isPausedOrFull ? 0 : ewmaCurrentRef.current;
        const realVBat = nativeData.voltageV > 2.5 ? nativeData.voltageV : socToOcv(hwLevel);
        const realWatts = isPausedOrFull ? 0 : (realVBat * smoothMa) / 1000;

        const coulombPctPerSec = (smoothMa / (capacityMah * 3600)) * 100;
        let pctPerSec = 0;

        if (isCharging) {
          pctPerSec = learnedRateRef.current
            ? learnedRateRef.current * 0.65 + coulombPctPerSec * 0.35
            : Math.max(0.004, coulombPctPerSec);

          const ceiling = Math.min(100, hwLevel + 0.999);
          const remaining = Math.max(0, ceiling - pctRef.current);
          const rawStep = pctPerSec * DT_SEC;
          const dampedStep = remaining < 0.15 ? Math.min(rawStep, Math.max(0.0002, remaining * 0.035)) : rawStep;
          pctRef.current = Math.max(hwLevel, Math.min(ceiling, pctRef.current + dampedStep));
        } else if (isPausedOrFull) {
          pctPerSec = 0;
          pctRef.current = hwLevel;
        } else {
          pctPerSec = -Math.max(0.0005, coulombPctPerSec);
          const floor = Math.max(0, hwLevel - 0.999);
          const remaining = Math.max(0, pctRef.current - floor);
          const rawStep = Math.abs(pctPerSec) * DT_SEC;
          const dampedStep = remaining < 0.15 ? Math.min(rawStep, Math.max(0.0001, remaining * 0.035)) : rawStep;
          pctRef.current = Math.max(floor, Math.min(hwLevel, pctRef.current - dampedStep));
        }

        const vInReal = isCharging ? (realWatts > 22 ? 11.0 : realWatts > 12 ? 9.0 : 5.0) : 0;
        const iInRealMa = isCharging && vInReal > 0 ? Math.round((realWatts / vInReal) * 1000) : 0;
        const etaSec = isCharging && pctPerSec > 0.0001
          ? Math.round((100 - pctRef.current) / pctPerSec)
          : !isCharging && !isPausedOrFull && pctPerSec < -0.0001
            ? Math.round(pctRef.current / Math.abs(pctPerSec))
            : 0;

        const hist = historyRef.current;
        hist.push({ t: now, vIn: vInReal, iInMa: iInRealMa, vBat: realVBat, watts: realWatts, pct: pctRef.current });
        if (hist.length > 80) hist.shift();

        setTelemetry({
          pct: pctRef.current,
          charging: isCharging,
          chargeState,
          vIn: vInReal,
          iInMa: iInRealMa,
          vBat: realVBat,
          iBatMa: Math.round(smoothMa),
          watts: realWatts,
          pctPerSec,
          pctPerMin: pctPerSec * 60,
          etaSeconds: etaSec,
          tempC: nativeData.tempC || 31.0,
          source: 'hardware',
          protocol: isPausedOrFull ? (chargeState === 'full' ? 'Full' : 'Smart Pause') : isCharging ? (realWatts > 18 ? 'Fast Charge' : 'USB Charge') : 'Battery',
          history: [...hist],
        });
        return;
      }

      // 2. WEB BATTERY API PATH
      if (hardwareSupported && hwState.level !== null) {
        if (pctRef.current === null) pctRef.current = hwState.level;
        const isCharging = hwState.charging;
        const chargeState = pctRef.current >= 99.99 && isCharging ? 'full' : isCharging ? 'charging' : 'discharging';
        let pctPerSec = 0;
        let effectiveWatts = 0;

        if (chargeState === 'charging') {
          if (Number.isFinite(hwState.chargingTime) && hwState.chargingTime > 10) {
            pctPerSec = Math.max(0.5, 100 - hwState.level) / hwState.chargingTime;
            effectiveWatts = (pctPerSec / 100) * batteryWh * 3600 / 0.88;
          } else {
            pctPerSec = learnedRateRef.current || 0.015;
            effectiveWatts = (pctPerSec / 100) * batteryWh * 3600 / 0.88;
          }
          const ceiling = Math.min(100, hwState.level + 0.999);
          const remaining = Math.max(0, ceiling - pctRef.current);
          const step = remaining < 0.15 ? Math.min(pctPerSec * DT_SEC, Math.max(0.0002, remaining * 0.035)) : pctPerSec * DT_SEC;
          pctRef.current = Math.max(hwState.level, Math.min(ceiling, pctRef.current + step));
        } else if (chargeState === 'discharging') {
          pctPerSec = -0.003;
          effectiveWatts = 2.0;
          const floor = Math.max(0, hwState.level - 0.999);
          pctRef.current = Math.max(floor, Math.min(hwState.level, pctRef.current + pctPerSec * DT_SEC));
        }

        const ocv = socToOcv(pctRef.current);
        const vIn = chargeState === 'charging' ? 9.0 : 0;
        const iInMa = chargeState === 'charging' ? Math.round((effectiveWatts / 9.0) * 1000) : 0;

        setTelemetry({
          pct: pctRef.current,
          charging: chargeState === 'charging',
          chargeState,
          vIn,
          iInMa,
          vBat: ocv,
          iBatMa: Math.round((effectiveWatts / ocv) * 1000),
          watts: effectiveWatts,
          pctPerSec,
          pctPerMin: pctPerSec * 60,
          etaSeconds: chargeState === 'charging' && pctPerSec > 0 ? Math.round((100 - pctRef.current) / pctPerSec) : 0,
          tempC: 31.0,
          source: 'browser',
          protocol: chargeState === 'charging' ? 'Charging' : 'Battery',
          history: [],
        });
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [enabled, hardwareSupported, hwState, capacityMah]);

  return { telemetry, hardwareSupported };
}

export function formatEta(seconds, pct = 0, chargeState = 'charging') {
  if (chargeState === 'full' || (chargeState === 'charging' && pct >= 99.95)) return 'Full';
  if (chargeState === 'paused') return 'Paused';
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function splitPct(pct) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const fixed = clamped.toFixed(3);
  const [whole, dec] = fixed.split('.');
  return { whole, dec, full: fixed };
}
