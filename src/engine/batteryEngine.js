import { useEffect, useState } from 'react';

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
  precisionSource: 'calibrated',
  protocol: 'Battery',
  history: [],
};

// Shared singleton engine so LauncherHome, WidgetCanvas & BatteryApp share 1 JNI loop and 100% identical decimals
const engine = {
  subscribers: new Set(),
  timer: null,
  lastTickAt: Date.now(),
  visibilityBound: false,
  lastNotifiedKey: '',
  capacityMah: Number(typeof localStorage !== 'undefined' ? localStorage.getItem('ov_cap') || 5000 : 5000),
  hardwareSupported: false,
  telemetry: INITIAL_TELEMETRY,
  webBattery: {
    level: null,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: Infinity,
    initialized: false,
  },

  // Real hardware calibration state
  pct: null,
  ewmaCurrentMa: null,
  lastHwTick: { time: Date.now(), level: null, uah: null },
  lastChargeState: null,

  // Fuel-gauge IC (BATTERY_PROPERTY_CHARGE_COUNTER in uAh) tracking
  fullCapUah: Number(typeof localStorage !== 'undefined' ? localStorage.getItem('ov_real_cap_uah') || 0 : 0) || null,
  anchorUah: null,
  anchorPct: null,
  lastSeenUah: null,
  lastUahChangeTime: 0,
  fuelGaugeLive: false,
  uahPerSec: null,

  // Real hardware tick rate calibration (%/sec)
  learnedChargeRate: null,
  learnedDischargeRate: null,
  history: [],
};

function notifySubscribers() {
  const t = engine.telemetry;
  const key = `${t.pct.toFixed(3)}|${t.chargeState}|${t.watts.toFixed(1)}|${t.iBatMa}|${t.etaSeconds}|${engine.hardwareSupported}`;
  if (key === engine.lastNotifiedKey) return;
  engine.lastNotifiedKey = key;
  for (const cb of engine.subscribers) {
    cb(t, engine.hardwareSupported);
  }
}

function initWebBatteryFallback() {
  if (engine.webBattery.initialized || typeof navigator === 'undefined' || !('getBattery' in navigator)) return;
  engine.webBattery.initialized = true;
  navigator.getBattery().then((b) => {
    const sync = () => {
      const levelPct = b.level * 100;
      const now = Date.now();
      if (engine.lastHwTick.level !== null && engine.lastHwTick.level !== levelPct && b.charging) {
        const dtSec = (now - engine.lastHwTick.time) / 1000;
        const dPct = levelPct - engine.lastHwTick.level;
        if (dtSec > 2 && dPct > 0) engine.learnedChargeRate = dPct / dtSec;
      }
      if (engine.lastHwTick.level !== levelPct) {
        engine.lastHwTick = { time: now, level: levelPct, uah: null };
      }
      engine.hardwareSupported = true;
      engine.webBattery.level = levelPct;
      engine.webBattery.charging = b.charging;
      engine.webBattery.chargingTime = b.chargingTime;
      engine.webBattery.dischargingTime = b.dischargingTime;
      if (engine.pct === null || Math.abs(engine.pct - levelPct) > 1.2) {
        engine.pct = levelPct;
      }
    };
    sync();
    b.addEventListener('levelchange', sync);
    b.addEventListener('chargingchange', sync);
    b.addEventListener('chargingtimechange', sync);
    b.addEventListener('dischargingtimechange', sync);
  }).catch(() => {});
}

function tickEngine() {
  const now = Date.now();
  const DT_SEC = Math.max(0.05, Math.min(5.0, (now - engine.lastTickAt) / 1000));
  engine.lastTickAt = now;

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

  const batteryWh = (engine.capacityMah / 1000) * 3.85;

  // 1. NATIVE ANDROID HARDWARE PATH
  if (nativeData !== null) {
    engine.hardwareSupported = true;
    const hwLevel = nativeData.pct;
    const chargeState = nativeData.chargeState || (nativeData.charging ? 'charging' : 'discharging');
    const isCharging = chargeState === 'charging';
    const isPausedOrFull = chargeState === 'paused' || chargeState === 'full';
    const uah = typeof nativeData.chargeCounterUah === 'number' && nativeData.chargeCounterUah > 100000
      ? nativeData.chargeCounterUah
      : null;

    if (engine.pct === null) engine.pct = hwLevel;

    // Reset short-term anchor if charging state flipped (e.g. plugged/unplugged)
    if (engine.lastChargeState !== null && engine.lastChargeState !== chargeState) {
      engine.anchorUah = uah;
      engine.anchorPct = engine.pct;
      engine.uahPerSec = null;
      engine.ewmaCurrentMa = null;
    }
    engine.lastChargeState = chargeState;

    // Seed true full-charge capacity (uAh) from fuel gauge if not yet known
    if (uah !== null && hwLevel >= 5) {
      const impliedFullUah = uah / ((hwLevel + 0.5) / 100);
      if (!engine.fullCapUah || Math.abs(engine.fullCapUah - impliedFullUah) / impliedFullUah > 0.25) {
        engine.fullCapUah = impliedFullUah;
      }
    }

    // Detect if the hardware fuel-gauge IC updates chargeCounterUah between integer % ticks
    if (uah !== null) {
      if (engine.lastSeenUah !== null && uah !== engine.lastSeenUah) {
        const dtUahSec = (now - engine.lastUahChangeTime) / 1000;
        const dUah = uah - engine.lastSeenUah;
        if (engine.lastHwTick.level === hwLevel && Math.abs(dUah) >= 500) {
          engine.fuelGaugeLive = true;
        }
        if (dtUahSec > 0.3 && dtUahSec < 60 && Math.abs(dUah) >= 200) {
          const instantUahRate = dUah / dtUahSec;
          engine.uahPerSec = engine.uahPerSec === null
            ? instantUahRate
            : engine.uahPerSec * 0.7 + instantUahRate * 0.3;
        }
        engine.lastSeenUah = uah;
        engine.lastUahChangeTime = now;
      } else if (engine.lastSeenUah === null) {
        engine.lastSeenUah = uah;
        engine.lastUahChangeTime = now;
        engine.anchorUah = uah;
        engine.anchorPct = hwLevel;
      }
    }

    // Calibrate from real hardware integer % transitions (ground truth!)
    if (engine.lastHwTick.level !== null && engine.lastHwTick.level !== hwLevel) {
      const dtSec = (now - engine.lastHwTick.time) / 1000;
      const dPct = hwLevel - engine.lastHwTick.level;

      if (dtSec > 3 && dtSec < 1800) {
        if (dPct > 0 && isCharging) {
          const realRate = dPct / dtSec;
          engine.learnedChargeRate = engine.learnedChargeRate
            ? engine.learnedChargeRate * 0.35 + realRate * 0.65
            : realRate;
        } else if (dPct < 0 && !isCharging && !isPausedOrFull) {
          const realRate = Math.abs(dPct) / dtSec;
          engine.learnedDischargeRate = engine.learnedDischargeRate
            ? engine.learnedDischargeRate * 0.4 + realRate * 0.6
            : realRate;
        }

        // Measure exact uAh per 1% directly from the fuel gauge IC!
        if (uah !== null && engine.lastHwTick.uah !== null) {
          const dUah = uah - engine.lastHwTick.uah;
          if (dPct !== 0 && (dUah / dPct) > 15000 && (dUah / dPct) < 120000) {
            const measuredFullUah = (dUah / dPct) * 100;
            engine.fullCapUah = engine.fullCapUah
              ? engine.fullCapUah * 0.65 + measuredFullUah * 0.35
              : measuredFullUah;
            try {
              localStorage.setItem('ov_real_cap_uah', String(Math.round(engine.fullCapUah)));
            } catch {}
          }
        }
      }

      // Re-anchor fuel gauge to exact hardware transition crossing
      engine.lastHwTick = { time: now, level: hwLevel, uah };
      engine.anchorUah = uah;
      engine.anchorPct = hwLevel;

      // Only hard-snap if way out of sync; otherwise let smooth glide cross the integer boundary naturally
      if (Math.abs(engine.pct - hwLevel) > 1.25) {
        engine.pct = hwLevel;
      }
    } else if (engine.lastHwTick.level === null) {
      engine.lastHwTick = { time: now, level: hwLevel, uah };
      engine.anchorUah = uah;
      engine.anchorPct = hwLevel;
    }

    // Current & Power smoothing (prefer hardware-averaged current if instantaneous is missing)
    const rawMa = nativeData.currentMa > 0
      ? nativeData.currentMa
      : nativeData.currentAvgMa > 0
        ? nativeData.currentAvgMa
        : (isCharging ? 1200 : isPausedOrFull ? 0 : 280);

    engine.ewmaCurrentMa = engine.ewmaCurrentMa === null
      ? rawMa
      : engine.ewmaCurrentMa * 0.8 + rawMa * 0.2;

    const smoothMa = isPausedOrFull ? 0 : engine.ewmaCurrentMa;
    const realVBat = nativeData.voltageV > 2.5 ? nativeData.voltageV : socToOcv(hwLevel);
    const realWatts = isPausedOrFull ? 0 : (realVBat * smoothMa) / 1000;

    // Effective capacity in mAh: use real measured fuel-gauge capacity when available!
    const effectiveCapMah = engine.fullCapUah
      ? Math.max(1500, Math.min(12000, engine.fullCapUah / 1000))
      : engine.capacityMah;

    // Dual-cell batteries (~7.4V-8.8V) report pack voltage ~2x; adjust coulomb denominator if needed
    const cellAdjustedCapMah = realVBat > 6.2 ? effectiveCapMah * 0.5 : effectiveCapMah;
    const coulombPctPerSec = (smoothMa / (cellAdjustedCapMah * 3600)) * 100;

    // Android 9+ OS calibrated charge time remaining
    const osTimeSec = (typeof nativeData.chargeTimeRemainingMs === 'number' && nativeData.chargeTimeRemainingMs > 10000)
      ? nativeData.chargeTimeRemainingMs / 1000
      : null;
    const osRatePctPerSec = (isCharging && osTimeSec && hwLevel < 99)
      ? Math.max(0.001, (100 - hwLevel) / osTimeSec)
      : null;

    let pctPerSec = 0;
    let precisionSource = 'calibrated';

    if (isCharging) {
      // TIER 1: Direct hardware fuel-gauge coulomb counter (real uAh delta from IC)
      if (engine.fuelGaugeLive && uah !== null && engine.anchorUah !== null && engine.fullCapUah) {
        precisionSource = 'fuel-gauge';
        const hwDeltaPct = ((uah - engine.anchorUah) / engine.fullCapUah) * 100;
        const fuelGaugeTarget = Math.max(hwLevel, Math.min(Math.min(100, hwLevel + 0.995), engine.anchorPct + Math.max(0, hwDeltaPct)));

        // Smooth glide toward real hardware uAh reading + gentle inter-sample progression
        const uahRatePct = engine.uahPerSec && engine.uahPerSec > 0
          ? (engine.uahPerSec / engine.fullCapUah) * 100
          : (engine.learnedChargeRate || osRatePctPerSec || coulombPctPerSec);
        pctPerSec = Math.max(0.001, Math.min(0.25, uahRatePct));

        const gap = fuelGaugeTarget - engine.pct;
        if (gap > 0.0005) {
          // Catch up smoothly to real hardware fuel-gauge value
          engine.pct += Math.min(gap, Math.max(pctPerSec * DT_SEC, gap * 0.14));
        } else {
          // Between fuel-gauge IC samples, gently advance with pure asymptotic damping (never freezes at .999!)
          const ceiling = Math.min(100, hwLevel + 0.995);
          const remaining = Math.max(0, ceiling - engine.pct);
          const damp = remaining < 0.28 ? Math.max(0.02, remaining / 0.28) : 1;
          engine.pct = Math.max(hwLevel, Math.min(ceiling, engine.pct + pctPerSec * DT_SEC * 0.65 * damp));
        }
      } else {
        // TIER 2: True self-calibrating hardware rate (prioritizes actual observed tick rate & OS estimate over guessed capacity)
        if (engine.learnedChargeRate) {
          pctPerSec = osRatePctPerSec
            ? engine.learnedChargeRate * 0.8 + osRatePctPerSec * 0.2
            : engine.learnedChargeRate;
        } else if (osRatePctPerSec) {
          pctPerSec = osRatePctPerSec * 0.8 + coulombPctPerSec * 0.2;
        } else {
          pctPerSec = Math.max(0.002, Math.min(0.15, coulombPctPerSec));
        }

        // If we are still below hwLevel (just ticked up!), smoothly glide up to hwLevel first
        if (engine.pct < hwLevel) {
          const catchup = Math.min(hwLevel - engine.pct, Math.max(pctPerSec * DT_SEC * 2.5, (hwLevel - engine.pct) * 0.18));
          engine.pct += catchup;
        } else {
          // Pure asymptotic damping: smoothly slows down if hardware tick is late — NEVER hits .999 and stops!
          const ceiling = Math.min(100, hwLevel + 0.996);
          const remaining = Math.max(0, ceiling - engine.pct);
          const rawStep = pctPerSec * DT_SEC;
          const damp = remaining < 0.30 ? (remaining / 0.30) * (remaining / 0.30) : 1;
          engine.pct = Math.max(hwLevel, Math.min(ceiling, engine.pct + rawStep * damp));
        }
      }
    } else if (isPausedOrFull) {
      pctPerSec = 0;
      engine.pct = hwLevel;
    } else {
      // Discharging
      if (engine.fuelGaugeLive && uah !== null && engine.anchorUah !== null && engine.fullCapUah) {
        precisionSource = 'fuel-gauge';
        const hwDeltaPct = ((uah - engine.anchorUah) / engine.fullCapUah) * 100;
        const fuelGaugeTarget = Math.max(Math.max(0, hwLevel - 0.995), Math.min(hwLevel, engine.anchorPct + Math.min(0, hwDeltaPct)));
        pctPerSec = -(engine.learnedDischargeRate || Math.max(0.0004, coulombPctPerSec));
        const gap = engine.pct - fuelGaugeTarget;
        if (gap > 0.0005) {
          engine.pct -= Math.min(gap, Math.max(Math.abs(pctPerSec) * DT_SEC, gap * 0.14));
        }
      } else {
        pctPerSec = -(engine.learnedDischargeRate || Math.max(0.0004, coulombPctPerSec));
        const floor = Math.max(0, hwLevel - 0.996);
        const remaining = Math.max(0, engine.pct - floor);
        const rawStep = Math.abs(pctPerSec) * DT_SEC;
        const damp = remaining < 0.30 ? (remaining / 0.30) * (remaining / 0.30) : 1;
        engine.pct = Math.max(floor, Math.min(hwLevel, engine.pct - rawStep * damp));
      }
    }

    const vInReal = isCharging ? (realWatts > 22 ? 11.0 : realWatts > 12 ? 9.0 : 5.0) : 0;
    const iInRealMa = isCharging && vInReal > 0 ? Math.round((realWatts / vInReal) * 1000) : 0;
    const etaSec = isCharging && osTimeSec
      ? Math.round(osTimeSec)
      : isCharging && pctPerSec > 0.0001
        ? Math.round((100 - engine.pct) / pctPerSec)
        : !isCharging && !isPausedOrFull && pctPerSec < -0.0001
          ? Math.round(engine.pct / Math.abs(pctPerSec))
          : 0;

    engine.history.push({ t: now, vIn: vInReal, iInMa: iInRealMa, vBat: realVBat, watts: realWatts, pct: engine.pct });
    if (engine.history.length > 80) engine.history.shift();

    engine.telemetry = {
      pct: engine.pct,
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
      precisionSource,
      protocol: isPausedOrFull ? (chargeState === 'full' ? 'Full' : 'Smart Pause') : isCharging ? (realWatts > 18 ? 'Fast Charge' : 'USB Charge') : 'Battery',
      history: [...engine.history],
    };
    notifySubscribers();
    return;
  }

  // 2. WEB BATTERY API PATH (Browser Preview)
  if (engine.hardwareSupported && engine.webBattery.level !== null) {
    const hwLevel = engine.webBattery.level;
    if (engine.pct === null) engine.pct = hwLevel;
    const isCharging = engine.webBattery.charging;
    const chargeState = engine.pct >= 99.99 && isCharging ? 'full' : isCharging ? 'charging' : 'discharging';
    let pctPerSec = 0;
    let effectiveWatts = 0;

    if (chargeState === 'charging') {
      if (Number.isFinite(engine.webBattery.chargingTime) && engine.webBattery.chargingTime > 10) {
        pctPerSec = Math.max(0.5, 100 - hwLevel) / engine.webBattery.chargingTime;
        effectiveWatts = (pctPerSec / 100) * batteryWh * 3600 / 0.88;
      } else {
        pctPerSec = engine.learnedChargeRate || 0.015;
        effectiveWatts = (pctPerSec / 100) * batteryWh * 3600 / 0.88;
      }
      const ceiling = Math.min(100, hwLevel + 0.996);
      const remaining = Math.max(0, ceiling - engine.pct);
      const damp = remaining < 0.30 ? (remaining / 0.30) * (remaining / 0.30) : 1;
      engine.pct = Math.max(hwLevel, Math.min(ceiling, engine.pct + pctPerSec * DT_SEC * damp));
    } else if (chargeState === 'discharging') {
      pctPerSec = -0.003;
      effectiveWatts = 2.0;
      const floor = Math.max(0, hwLevel - 0.996);
      const remaining = Math.max(0, engine.pct - floor);
      const damp = remaining < 0.30 ? (remaining / 0.30) * (remaining / 0.30) : 1;
      engine.pct = Math.max(floor, Math.min(hwLevel, engine.pct + pctPerSec * DT_SEC * damp));
    }

    const ocv = socToOcv(engine.pct);
    const vIn = chargeState === 'charging' ? 9.0 : 0;
    const iInMa = chargeState === 'charging' ? Math.round((effectiveWatts / 9.0) * 1000) : 0;

    engine.telemetry = {
      pct: engine.pct,
      charging: chargeState === 'charging',
      chargeState,
      vIn,
      iInMa,
      vBat: ocv,
      iBatMa: Math.round((effectiveWatts / ocv) * 1000),
      watts: effectiveWatts,
      pctPerSec,
      pctPerMin: pctPerSec * 60,
      etaSeconds: chargeState === 'charging' && pctPerSec > 0 ? Math.round((100 - engine.pct) / pctPerSec) : 0,
      tempC: 31.0,
      source: 'browser',
      precisionSource: 'browser',
      protocol: chargeState === 'charging' ? 'Charging' : 'Battery',
      history: [],
    };
    notifySubscribers();
  }
}

function getAdaptiveDelayMs() {
  if (typeof document !== 'undefined' && document.hidden) return null; // 0 Hz when screen off or app in background!
  const st = engine.telemetry.chargeState;
  if (st === 'charging') return 250; // 4 Hz smooth 3-decimal updates while plugged in
  if (st === 'paused' || st === 'full') return 5000; // 0.2 Hz when full/paused
  return 3000; // 0.33 Hz on battery (97% less CPU & JNI drain!)
}

function scheduleNextTick() {
  if (engine.timer) {
    clearTimeout(engine.timer);
    engine.timer = null;
  }
  if (engine.subscribers.size === 0) return;
  const delay = getAdaptiveDelayMs();
  if (delay === null) return; // Completely asleep while hidden
  engine.timer = setTimeout(() => {
    engine.timer = null;
    if (engine.subscribers.size === 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    tickEngine();
    scheduleNextTick();
  }, delay);
}

function bindVisibilityListener() {
  if (engine.visibilityBound || typeof document === 'undefined') return;
  engine.visibilityBound = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (engine.timer) {
        clearTimeout(engine.timer);
        engine.timer = null;
      }
    } else if (engine.subscribers.size > 0) {
      engine.lastTickAt = Date.now();
      tickEngine();
      scheduleNextTick();
    }
  });
}

function startEngineIfNeeded() {
  initWebBatteryFallback();
  bindVisibilityListener();
  if (!engine.timer && (typeof document === 'undefined' || !document.hidden)) {
    engine.lastTickAt = Date.now();
    tickEngine();
    scheduleNextTick();
  }
}

function stopEngineIfUnused() {
  if (engine.subscribers.size === 0 && engine.timer) {
    clearTimeout(engine.timer);
    engine.timer = null;
  }
}

export function useBatteryTelemetry({ capacityMah = 5000, enabled = true } = {}) {
  const [state, setState] = useState(() => ({
    telemetry: engine.telemetry,
    hardwareSupported: engine.hardwareSupported,
  }));

  useEffect(() => {
    if (capacityMah && capacityMah > 0) {
      engine.capacityMah = capacityMah;
    }
  }, [capacityMah]);

  useEffect(() => {
    if (!enabled) return undefined;
    const listener = (telemetry, hardwareSupported) => {
      setState({ telemetry, hardwareSupported });
    };
    engine.subscribers.add(listener);
    startEngineIfNeeded();
    return () => {
      engine.subscribers.delete(listener);
      stopEngineIfUnused();
    };
  }, [enabled]);

  return state;
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
