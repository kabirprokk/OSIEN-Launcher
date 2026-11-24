# OSIEN Volt

A minimal, precision Always-On Display (AOD) and live decimal charging app for Android (AMOLED/OLED).

## Features
- **Exact Coulomb & EWMA Telemetry** — Smooth real-time decimal percentage (`58.23%` → `58.24%`...) driven by real Android `BatteryManager` hardware current (`µA`), cell voltage (`mV`), and auto-learned hardware tick calibration.
- **Smart Charging / Battery Protection Aware** — Automatically detects when OEM Smart Charging pauses at 80%/85% while plugged in and cleanly displays `SMART LIMIT · PAUSED` instead of falsely charging.
- **True Lockscreen AOD** — Wakes automatically on lock (`ACTION_SCREEN_OFF`) or charger plug-in (`ACTION_POWER_CONNECTED`), with proximity Pocket Mode, AMOLED brightness dimmer, 45s OLED burn-in pixel shift, and double-tap to unlock.
- **12 Hand-Crafted Minimal Templates + Style Customizer** — Customize accent color, typography, glow intensity, clock/date, and pure `%` vs minimal `V · mA` hairline.
