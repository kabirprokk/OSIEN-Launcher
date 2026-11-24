import { useEffect, useRef, useState } from 'react';

export const CAPACITY_PRESETS = [3500, 4000, 4500, 5000, 5500, 6000];

const EMPTY_TELEMETRY = {
  pct: 0,
  charging: false,
  chargeState: 'unknown',
  vIn: null,
  iInMa: null,
  vBat: null,
  iBatMa: null,
  watts: null,
  pctPerSec: 0,
  pctPerMin: 0,
  etaSeconds: 0,
  tempC: null,
  source: 'unavailable',
  protocol: 'Unavailable',
  history: [],
};

function nativeChargeState(data) {
  if (data.chargeState) return data.chargeState;
  return data.charging ? 'charging' : 'discharging';
}

/**
 * Reads measurements from Android BatteryManager without smoothing, interpolation,
 * charger profiles, or synthetic values. Fractional SOC is the native charge
 * counter divided by the capacity selected by the user; Android itself generally
 * exposes only whole-number SOC on consumer devices.
 */
export function useBatteryTelemetry({ capacityMah = 5000, enabled = true } = {}) {
  const [telemetry, setTelemetry] = useState(EMPTY_TELEMETRY);
  const [hardwareSupported, setHardwareSupported] = useState(false);
  const historyRef = useRef([]);
  const capacityRef = useRef(capacityMah);
  capacityRef.current = capacityMah;

  useEffect(() => {
    if (!enabled) {
      setTelemetry(EMPTY_TELEMETRY);
      setHardwareSupported(false);
      return undefined;
    }
    let active = true;
    let battery = null;
    let timer = null;

    const publish = (data, source) => {
      if (!active || !data) return;
      const state = source === 'android' ? nativeChargeState(data) : (data.charging ? 'charging' : 'discharging');
      const voltage = Number.isFinite(data.voltageV) && data.voltageV > 0 ? data.voltageV : null;
      const current = Number.isFinite(data.currentMa) && data.currentMa >= 0 ? Math.abs(data.currentMa) : null;
      const watts = voltage !== null && current !== null ? voltage * current / 1000 : null;
      const counterPct = Number.isFinite(data.chargeCounterUah) && data.chargeCounterUah >= 0
        ? (data.chargeCounterUah / (capacityRef.current * 1000)) * 100
        : null;
      const pct = counterPct !== null
        ? Math.max(0, Math.min(100, counterPct))
        : Number.isFinite(data.pct) && data.pct >= 0 ? Math.max(0, Math.min(100, data.pct)) : null;
      if (pct === null) return;

      const point = { t: Date.now(), voltage, current, watts, pct };
      historyRef.current.push(point);
      if (historyRef.current.length > 80) historyRef.current.shift();
      setTelemetry({
        pct,
        charging: state === 'charging',
        chargeState: state,
        vIn: voltage,
        iInMa: current,
        vBat: voltage,
        iBatMa: current,
        watts,
        pctPerSec: 0,
        pctPerMin: 0,
        etaSeconds: 0,
        tempC: Number.isFinite(data.tempC) ? data.tempC : null,
        source,
        protocol: state === 'paused' ? 'Smart Pause' : state === 'full' ? 'Full' : state === 'charging' ? 'Charging' : 'Battery',
        history: [...historyRef.current],
      });
    };

    const readAndroid = () => {
      try {
        const bridge = window.AndroidBattery;
        if (!bridge || typeof bridge.getTelemetry !== 'function') return false;
        const data = JSON.parse(bridge.getTelemetry());
        const hasCounter = Number.isFinite(data?.chargeCounterUah) && data.chargeCounterUah >= 0;
        const hasOsLevel = Number.isFinite(data?.pct) && data.pct >= 0;
        if (!data || (!hasCounter && !hasOsLevel)) return false;
        setHardwareSupported(true);
        publish(data, 'android');
        return true;
      } catch {
        return false;
      }
    };

    const readBrowser = () => {
      if (!battery) return;
      publish({ pct: battery.level * 100, charging: battery.charging }, 'browser');
    };

    if (typeof window !== 'undefined' && readAndroid()) {
      // One sample per second is responsive enough for the display and avoids
      // rerendering the launcher four times a second while its battery panel is closed.
      timer = window.setInterval(readAndroid, 1000);
    } else if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
      navigator.getBattery().then((b) => {
        if (!active) return;
        battery = b;
        setHardwareSupported(true);
        readBrowser();
        b.addEventListener('levelchange', readBrowser);
        b.addEventListener('chargingchange', readBrowser);
        timer = window.setInterval(() => {
          if (active) readBrowser();
        }, 1000);
      }).catch(() => {});
    }

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      if (battery) {
        battery.removeEventListener('levelchange', readBrowser);
        battery.removeEventListener('chargingchange', readBrowser);
      }
    };
  }, [enabled]);

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
