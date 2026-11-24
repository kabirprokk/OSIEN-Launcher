package com.voltpulse.app;

import android.app.KeyguardManager;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor proximitySensor;
    private boolean isInPocket = false;
    private float userBrightness = -1f; // -1 = system default

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // True Always-On Display (AOD) over Lockscreen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        enterImmersiveMode();

        // Proximity sensor for Pocket Mode (turns display black when in pocket/bag)
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (sensorManager != null) {
            proximitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY);
        }

        // Expose real Android BatteryManager + AOD controls to WebView
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new AndroidBatteryBridge(), "AndroidBattery");
        }

        // Start background foreground service so AOD stays alive when app is closed
        try {
            Intent svc = new Intent(this, ChargingMonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        if (sensorManager != null && proximitySensor != null) {
            sensorManager.registerListener(this, proximitySensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_PROXIMITY) {
            boolean near = event.values[0] < Math.min(event.sensor.getMaximumRange(), 3.0f);
            if (near != isInPocket) {
                isInPocket = near;
                applyWindowBrightness(isInPocket ? 0.0f : userBrightness);
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private void applyWindowBrightness(float b) {
        runOnUiThread(() -> {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.screenBrightness = b;
            getWindow().setAttributes(lp);
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enterImmersiveMode();
        }
    }

    private void enterImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }

    public class AndroidBatteryBridge {
        @JavascriptInterface
        public boolean hasAodPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return Settings.canDrawOverlays(MainActivity.this);
            }
            return true;
        }

        @JavascriptInterface
        public void requestAodPermissions() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(MainActivity.this)) {
                    Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName())
                    );
                    startActivity(intent);
                    return;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                        Intent intent = new Intent(
                            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            Uri.parse("package:" + getPackageName())
                        );
                        startActivity(intent);
                    }
                }
            });
        }

        @JavascriptInterface
        public void setAodConfig(boolean enabled, boolean chargingOnly) {
            SharedPreferences prefs = getSharedPreferences(ChargingMonitorService.PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                .putBoolean("aod_enabled", enabled)
                .putBoolean("aod_charging_only", chargingOnly)
                .apply();
        }

        @JavascriptInterface
        public void setAodBrightness(float level) {
            // level in 0.02..1.0 or -1 for auto
            userBrightness = level;
            if (!isInPocket) {
                applyWindowBrightness(level);
            }
        }

        @JavascriptInterface
        public void unlockDevice() {
            runOnUiThread(() -> {
                KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
                if (km != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && km.isKeyguardLocked()) {
                    km.requestDismissKeyguard(MainActivity.this, null);
                } else {
                    moveTaskToBack(true);
                }
            });
        }

        @JavascriptInterface
        public String getTelemetry() {
            try {
                IntentFilter filter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                Intent batteryStatus = registerReceiver(null, filter);
                BatteryManager bm = (BatteryManager) getSystemService(BATTERY_SERVICE);

                int level = batteryStatus != null ? batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) : -1;
                int scale = batteryStatus != null ? batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, 100) : 100;
                int voltageMv = batteryStatus != null ? batteryStatus.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) : 0;
                int tempTenths = batteryStatus != null ? batteryStatus.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 300) : 300;
                int status = batteryStatus != null ? batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1) : -1;
                int plugged = batteryStatus != null ? batteryStatus.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) : 0;

                long currentRaw = bm != null ? bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW) : 0;
                double currentMa = Math.abs(currentRaw) > 10000 ? (Math.abs(currentRaw) / 1000.0) : Math.abs(currentRaw);

                double pct = (level >= 0 && scale > 0) ? (level * 100.0 / scale) : -1;

                // Smart Charging / Battery Protection detection (e.g. stops at 80% or 85% while plugged in)
                boolean isPlugged = plugged > 0;
                boolean isFull = status == BatteryManager.BATTERY_STATUS_FULL || pct >= 100.0;
                boolean isSmartPaused = isPlugged && !isFull && (
                    status == BatteryManager.BATTERY_STATUS_NOT_CHARGING ||
                    (pct >= 79.0 && currentRaw != 0 && currentMa <= 25.0)
                );
                boolean charging = (status == BatteryManager.BATTERY_STATUS_CHARGING) && !isSmartPaused && !isFull;

                String chargeState = isFull ? "full"
                    : isSmartPaused ? "paused"
                    : charging ? "charging"
                    : "discharging";

                JSONObject json = new JSONObject();
                json.put("pct", pct);
                json.put("charging", charging);
                json.put("plugged", isPlugged);
                json.put("chargeState", chargeState);
                json.put("voltageV", voltageMv / 1000.0);
                json.put("currentMa", currentMa);
                json.put("tempC", tempTenths / 10.0);
                json.put("inPocket", isInPocket);
                return json.toString();
            } catch (Exception e) {
                return "{}";
            }
        }
    }
}
