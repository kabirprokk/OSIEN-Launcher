# OSIEN Launcher

OSIEN Launcher is an Android always-on charging display for OLED and AMOLED screens. The interface is built with React and Vite and runs in a Capacitor Android app.

## Battery readings

On Android, the app reads `BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER`, `BATTERY_PROPERTY_CURRENT_NOW`, and the battery voltage reported by `ACTION_BATTERY_CHANGED`.

- The displayed fractional percentage is the measured charge counter divided by the battery capacity selected in settings. Android devices generally expose whole-number state of charge; the charge counter provides finer granularity, but percentage accuracy still depends on the capacity value matching the battery's actual full-charge capacity.
- Current and battery-side power (`voltage × current`) use the latest device measurements. Values are not smoothed or inferred from charger wattage profiles. Some devices do not expose current or charge-counter readings; unavailable measurements are omitted and the whole-number OS percentage is used when possible.
- Charger input power can differ from battery-side power because of conversion losses and device power use. This app reports battery-side power.

In browsers, the app uses the Battery Status API when available. That API typically provides only whole-number percentage and does not provide the current and voltage readings used for Android telemetry.

## Android features

- AOD display triggered by screen lock or charger connection, with an optional charging-only setting.
- Proximity-based pocket dimming and adjustable screen brightness.
- Twelve battery display templates, clock styles, color and typography settings, wallpapers, and movable widgets.
- Charging pop-up styles and GitHub release update checks.

## Development

```sh
npm install
npm run dev
npm run build
npx cap sync android
```
