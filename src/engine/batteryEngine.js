import { useEffect, useRef, useState } from 'react';

export const CHARGER_PRESETS = [
  { id: 'usb-5w', label: '5W USB', watts: 5, nominalV: 5.0, protocol: 'USB 5V' },
  { id: 'pd-20w', label: '20W PD', watts: 20, nominalV: 9.0, protocol: 'USB-PD' },
  { id: 'pd-33w', label: '33W PPS', watts: 33, nominalV: 11.0, protocol: 'PD PPS' },
  { id: 'super-45w', label: '45W Super', watts: 45, nominalV: 9.0, protocol: 'SFC 2.0' },
  { id: 'turbo-67w', label: '67W Turbo', watts: 67, nominalV: 11.0, protocol: 'Turbo' },
  { id: 'hyper-120w', label: '120W Hyper', watts: 120, nominalV: 20.0, protocol: 'Hyper' },
];

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

function ccCvTaper(soc) {
  if (soc < 78) return 1.0;
  if (soc >= 100) return 0.04;
  return Math.max(0.12, 1.0 - 0.85 * Math.pow((soc - 78) / 22, 1.45));
}

export function useBatteryTelemetry({
  mode = 'auto',
  chargerId = 'turbo-67w',
  capacityMah = 5000,
  simCharging = true,
  simStartPct = 58.23,
  smartLimitPct = 0, // 0 = off, or 80 / 85 / 90 for testing Smart Charging pause
} = {}) {
  const charger = CHARGER_PRESETS.find((c) => c.id === chargerId) || CHARGER_PRESETS[4];
  const [hardwareSupported, setHardwareSupported] = useState(false);
  const [hwState, setHwState] = useState({
    level: null,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: Infinity,
  });

  const [telemetry, setTelemetry] = useState(() => ({
    pct: simStartPct,
    charging: true,
    chargeState: 'charging', // 'charging' | 'paused' | 'full' | 'discharging'
    vIn: charger.nominalV,
    iInMa: Math.round((charger.watts / charger.nominalV) * 1000),
    vBat: socToOcv(simStartPct) + 0.14,
    iBatMa: Math.round((charger.watts / 4.0) * 1000 * 0.9),
    watts: charger.watts,
    pctPerSec: 0.032,
    pctPerMin: 1.92,
    etaSeconds: 1200,
    tempC: 33.4,
    source: 'simulated',
    protocol: charger.protocol,
    history: [],
  }));

  const pctRef = useRef(simStartPct);
  const ewmaCurrentRef = useRef(null);
  const lastHwTickRef = useRef({ time: Date.now(), level: null });
  const learnedRateRef = useRef(null);
  const historyRef = useRef([]);

  // Web Battery Status API fallback (browsers)
  useEffect(() => {
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
      if (mode === 'auto' && Math.abs(pctRef.current - levelPct) > 1.2) {
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
  }, [mode]);

  // 100ms (10Hz) exact coulomb-counting & EWMA-smoothed telemetry loop for fast 3-decimal (54.347%) updates
  useEffect(() => {
    const TICK_MS = 100;
    const DT_SEC = TICK_MS / 1000;

    const timer = setInterval(() => {
      let nativeData = null;
      if (mode === 'auto' && typeof window !== 'undefined' && window.AndroidBattery) {
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

      // 1. NATIVE ANDROID HARDWARE PATH (exact BatteryManager coulomb counting + Smart Charging detection)
      if (nativeData !== null) {
        const now = Date.now();
        const hwLevel = nativeData.pct;

        // Learn real-world %/sec rate whenever hardware integer % ticks
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

        // EWMA smooth hardware current (mA)
        const rawMa = nativeData.currentMa > 0 ? nativeData.currentMa : (isCharging ? 1500 : isPausedOrFull ? 0 : 320);
        ewmaCurrentRef.current = ewmaCurrentRef.current === null
          ? rawMa
          : ewmaCurrentRef.current * 0.75 + rawMa * 0.25;

        const smoothMa = isPausedOrFull ? 0 : ewmaCurrentRef.current;
        const realVBat = nativeData.voltageV > 2.5 ? nativeData.voltageV : socToOcv(hwLevel);
        const realWatts = isPausedOrFull ? 0 : (realVBat * smoothMa) / 1000;

        // Exact Coulomb Rate: (I_mA / Capacity_mAh) / 3600 * 100
        const coulombPctPerSec = (smoothMa / (capacityMah * 3600)) * 100;
        let pctPerSec = 0;

        if (isCharging) {
          // Blend learned real tick rate with exact coulomb rate
          pctPerSec = learnedRateRef.current
            ? learnedRateRef.current * 0.55 + coulombPctPerSec * 0.45
            : coulombPctPerSec;
          const nextPct = pctRef.current + pctPerSec * DT_SEC;
          pctRef.current = Math.max(hwLevel, Math.min(Math.min(100, hwLevel + 0.99), nextPct));
        } else if (isPausedOrFull) {
          // Smart Charging paused (e.g. 85%) or Full (100%) -> freeze cleanly!
          pctPerSec = 0;
          pctRef.current = hwLevel;
        } else {
          pctPerSec = -coulombPctPerSec;
          const nextPct = pctRef.current + pctPerSec * DT_SEC;
          pctRef.current = Math.max(Math.max(0, hwLevel - 0.99), Math.min(hwLevel, nextPct));
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

      // 2. WEB BATTERY API / SIMULATION PATH
      const useHardware = mode === 'auto' && hardwareSupported && hwState.level !== null;
      let isCharging = useHardware ? hwState.charging : simCharging;
      let chargeState = isCharging ? 'charging' : 'discharging';

      // Simulate Smart Charging Limit pause (e.g. stops at 85%)
      if (!useHardware && isCharging && smartLimitPct > 0 && pctRef.current >= smartLimitPct) {
        isCharging = false;
        chargeState = 'paused';
      }
      if (pctRef.current >= 99.99 && isCharging) {
        isCharging = false;
        chargeState = 'full';
      }

      const currentPct = pctRef.current;
      const taper = ccCvTaper(currentPct);
      const tNow = Date.now() / 1000;
      const rippleV = Math.sin(tNow * 1.7) * 0.012;
      const rippleI = Math.cos(tNow * 1.3) * 0.006;

      let effectiveWatts = 0;
      let pctPerSec = 0;

      if (chargeState === 'charging') {
        if (useHardware && Number.isFinite(hwState.chargingTime) && hwState.chargingTime > 10) {
          pctPerSec = Math.max(0.5, 100 - hwState.level) / hwState.chargingTime;
          effectiveWatts = (pctPerSec / 100) * batteryWh * 3600 / 0.88;
        } else if (useHardware && learnedRateRef.current) {
          pctPerSec = learnedRateRef.current;
          effectiveWatts = (pctPerSec / 100) * batteryWh * 3600 / 0.88;
        } else {
          effectiveWatts = charger.watts * taper * (1 + rippleI);
          pctPerSec = ((effectiveWatts * 0.88) / (batteryWh * 3600)) * 100;
        }
        let nextPct = currentPct + pctPerSec * DT_SEC;
        if (useHardware) {
          nextPct = Math.max(hwState.level, Math.min(Math.min(100, hwState.level + 0.99), nextPct));
        } else if (smartLimitPct > 0 && nextPct >= smartLimitPct) {
          nextPct = smartLimitPct;
        } else if (nextPct >= 100) {
          nextPct = 100;
        }
        pctRef.current = nextPct;
      } else if (chargeState === 'paused' || chargeState === 'full') {
        effectiveWatts = 0;
        pctPerSec = 0;
      } else {
        effectiveWatts = -(2.1 + Math.sin(tNow * 0.9) * 0.2);
        pctPerSec = (effectiveWatts / (batteryWh * 3600)) * 100;
        let nextPct = currentPct + pctPerSec * DT_SEC;
        if (useHardware) {
          nextPct = Math.max(Math.max(0, hwState.level - 0.99), Math.min(hwState.level, nextPct));
        } else if (nextPct <= 1) {
          nextPct = 1;
        }
        pctRef.current = nextPct;
      }

      const finalPct = pctRef.current;
      const ocv = socToOcv(finalPct);
      const vIn = chargeState === 'charging' ? Math.max(4.75, charger.nominalV + rippleV) : 0;
      const iInMa = chargeState === 'charging' && vIn > 0 ? Math.round((effectiveWatts / vIn) * 1000) : 0;
      const iBatA = chargeState === 'charging' ? (effectiveWatts * 0.88) / ocv : effectiveWatts / ocv;
      const vBat = Math.max(3.15, Math.min(4.44, ocv + iBatA * 0.042));
      const etaSeconds = chargeState === 'charging' && pctPerSec > 0.0001
        ? Math.round((100 - finalPct) / pctPerSec)
        : chargeState === 'discharging' && pctPerSec < -0.0001
          ? Math.round(finalPct / Math.abs(pctPerSec))
          : 0;

      const hist = historyRef.current;
      hist.push({ t: Date.now(), vIn, iInMa, vBat, watts: Math.abs(effectiveWatts), pct: finalPct });
      if (hist.length > 80) hist.shift();

      setTelemetry({
        pct: finalPct,
        charging: chargeState === 'charging',
        chargeState,
        vIn,
        iInMa,
        vBat,
        iBatMa: Math.round(Math.abs(iBatA) * 1000),
        watts: Math.abs(effectiveWatts),
        pctPerSec,
        pctPerMin: pctPerSec * 60,
        etaSeconds,
        tempC: chargeState === 'charging' ? 29.8 + Math.min(12, effectiveWatts * 0.13) : 28.4,
        source: useHardware ? 'hardware' : 'simulated',
        protocol: chargeState === 'paused' ? 'Smart Limit' : chargeState === 'full' ? 'Full' : chargeState === 'charging' ? charger.protocol : 'Battery',
        history: [...hist],
      });
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [mode, hardwareSupported, hwState, charger, capacityMah, simCharging, smartLimitPct]);

  const setManualPct = (newPct) => {
    pctRef.current = Math.max(0, Math.min(100, newPct));
  };

  return { telemetry, hardwareSupported, setManualPct };
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
  const clamped = Math.max(0, Math.min(100, pct));
  const fixed = clamped.toFixed(3);
  const [whole, dec] = fixed.split('.');
  return { whole, dec, full: fixed };
}
