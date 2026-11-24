package com.osien.launcher;

import android.app.DownloadManager;
import android.app.KeyguardManager;
import android.app.role.RoleManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.LauncherApps;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONObject;
import org.json.JSONArray;

public class MainActivity extends BridgeActivity implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor proximitySensor;
    private boolean isInPocket = false;
    private float userBrightness = -1f; // -1 = system default
    private boolean launchedFromAod = false;
    private boolean launchedAsHome = false;
    private volatile boolean backHandlingEnabled = false;
    private final java.util.Map<String, String> appIconCache = new ConcurrentHashMap<>();
    private BroadcastReceiver unlockReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        launchedFromAod = getIntent() != null && getIntent().getBooleanExtra("from_aod", false);
        launchedAsHome = isHomeIntent(getIntent());

        configureWindowForMode();

        // Proximity sensor for Pocket Mode (turns display black when in pocket/bag)
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (sensorManager != null) {
            proximitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY);
        }

        // Expose real Android BatteryManager + AOD controls to WebView
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new AndroidBatteryBridge(), "AndroidBattery");
        }

        // Start background foreground service so AOD & Charging Pop-Up stay alive when app is closed
        try {
            Intent svc = new Intent(this, ChargingMonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        } catch (Exception ignored) {}

        // Auto-dismiss AOD the instant the user unlocks their phone (no double-tap needed!)
        unlockReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (Intent.ACTION_USER_PRESENT.equals(intent.getAction()) && launchedFromAod) {
                    launchedFromAod = false;
                    moveTaskToBack(true);
                }
            }
        };
        IntentFilter unlockFilter = new IntentFilter(Intent.ACTION_USER_PRESENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(unlockReceiver, unlockFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(unlockReceiver, unlockFilter);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (unlockReceiver != null) {
            try {
                unregisterReceiver(unlockReceiver);
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        launchedFromAod = intent != null && intent.getBooleanExtra("from_aod", false);
        launchedAsHome = isHomeIntent(intent);
        configureWindowForMode();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            final boolean isAod = launchedFromAod;
            runOnUiThread(() -> this.bridge.getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('osien-aod-mode', { detail: " + isAod + " }));",
                null
            ));
            runOnUiThread(() -> this.bridge.getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('osien-launch-mode', { detail: { home: " + launchedAsHome + ", aod: " + isAod + " } }));",
                null
            ));
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (backHandlingEnabled && this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().evaluateJavascript(
                "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));", null);
            return;
        }
        super.onBackPressed();
    }

    private boolean isHomeIntent(Intent intent) {
        return intent != null && Intent.ACTION_MAIN.equals(intent.getAction())
            && intent.hasCategory(Intent.CATEGORY_HOME);
    }

    private void configureWindowForMode() {
        if (launchedFromAod) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            }
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
            enterImmersiveMode();
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(false);
                setTurnScreenOn(false);
            }
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
            showSystemBars();
        }
    }

    private void showSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) controller.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (launchedFromAod && sensorManager != null && proximitySensor != null) {
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
        if (launchedFromAod && event.sensor.getType() == Sensor.TYPE_PROXIMITY) {
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
        if (hasFocus && launchedFromAod) {
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
        public void setBackHandlingEnabled(boolean enabled) {
            backHandlingEnabled = enabled;
        }

        @JavascriptInterface
        public boolean isHomeRoleHeld() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                RoleManager rm = (RoleManager) getSystemService(ROLE_SERVICE);
                return rm != null && rm.isRoleHeld(RoleManager.ROLE_HOME);
            }
            Intent homeIntent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
            android.content.pm.ResolveInfo resolved = getPackageManager().resolveActivity(
                homeIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
            return resolved != null && resolved.activityInfo != null
                && getPackageName().equals(resolved.activityInfo.packageName);
        }

        @JavascriptInterface
        public void requestHomeRole() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    RoleManager rm = (RoleManager) getSystemService(ROLE_SERVICE);
                    if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_HOME))
                        startActivity(rm.createRequestRoleIntent(RoleManager.ROLE_HOME));
                } else {
                    try { startActivity(new Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)); }
                    catch (Exception ignored) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
                }
            });
        }

        @JavascriptInterface
        public String getLaunchableApps() {
            JSONArray result = new JSONArray();
            LauncherApps launcherApps = (LauncherApps) getSystemService(LAUNCHER_APPS_SERVICE);
            if (launcherApps == null) return result.toString();
            try {
                java.util.List<android.content.pm.LauncherActivityInfo> activities = launcherApps.getActivityList(null, Process.myUserHandle());
                java.util.Collections.sort(activities, (a, b) -> a.getLabel().toString().compareToIgnoreCase(b.getLabel().toString()));
                for (android.content.pm.LauncherActivityInfo info : activities) {
                    JSONObject app = new JSONObject();
                    app.put("packageName", info.getApplicationInfo().packageName);
                    app.put("className", info.getComponentName().getClassName());
                    app.put("label", info.getLabel().toString());
                    result.put(app);
                }
            } catch (Exception ignored) {}
            return result.toString();
        }

        @JavascriptInterface
        public String getAppIcon(String packageName, String className) {
            String key = packageName + "/" + className;
            String cached = appIconCache.get(key);
            if (cached != null) return cached;
            LauncherApps launcherApps = (LauncherApps) getSystemService(LAUNCHER_APPS_SERVICE);
            if (launcherApps == null) return "";
            try {
                for (android.content.pm.LauncherActivityInfo info : launcherApps.getActivityList(packageName, Process.myUserHandle())) {
                    if (!className.equals(info.getComponentName().getClassName())) continue;
                    Drawable icon = info.getBadgedIcon(0);
                    Bitmap bitmap = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888);
                    Canvas canvas = new Canvas(bitmap);
                    icon.setBounds(0, 0, 64, 64);
                    icon.draw(canvas);
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes);
                    bitmap.recycle();
                    String encoded = "data:image/png;base64," + android.util.Base64.encodeToString(bytes.toByteArray(), android.util.Base64.NO_WRAP);
                    appIconCache.put(key, encoded);
                    return encoded;
                }
            } catch (Exception ignored) {}
            return "";
        }

        @JavascriptInterface
        public void launchApp(String packageName, String className) {
            runOnUiThread(() -> {
                try {
                    LauncherApps launcherApps = (LauncherApps) getSystemService(LAUNCHER_APPS_SERVICE);
                    if (launcherApps != null) launcherApps.startMainActivity(
                        new android.content.ComponentName(packageName, className), Process.myUserHandle(), null, null);
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void openSystemPanel(String panel) {
            runOnUiThread(() -> {
                Intent intent = null;
                if ("internet".equals(panel)) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                        intent = new Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY);
                    else intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
                }
                else if ("wifi".equals(panel)) intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
                else if ("bluetooth".equals(panel)) intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
                else if ("display".equals(panel)) intent = new Intent(Settings.ACTION_DISPLAY_SETTINGS);
                else if ("sound".equals(panel) || "volume".equals(panel)) intent = new Intent(Settings.ACTION_SOUND_SETTINGS);
                if (intent != null) try { startActivity(intent); } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public boolean canWriteSystemSettings() {
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.System.canWrite(MainActivity.this);
        }

        @JavascriptInterface
        public int getSystemBrightness() {
            try {
                int raw = Settings.System.getInt(getContentResolver(), Settings.System.SCREEN_BRIGHTNESS);
                return Math.max(5, Math.min(100, Math.round(raw * 100f / 255f)));
            } catch (Exception ignored) { return -1; }
        }

        @JavascriptInterface
        public void clearHomeBrightness() {
            runOnUiThread(() -> {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                if (lp.screenBrightness != -1f) {
                    lp.screenBrightness = -1f;
                    getWindow().setAttributes(lp);
                }
            });
        }

        @JavascriptInterface
        public void requestSystemSettingsPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            });
        }

        @JavascriptInterface
        public void setSystemBrightness(int percent) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.System.canWrite(MainActivity.this)) return;
            try { Settings.System.putInt(getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, Math.max(5, Math.min(100, percent)) * 255 / 100); }
            catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void setHomeBrightness(float level) {
            if (launchedFromAod) return;
            runOnUiThread(() -> {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                lp.screenBrightness = Math.max(0.05f, Math.min(1f, level));
                getWindow().setAttributes(lp);
            });
        }

        @JavascriptInterface
        public boolean isAodLaunch() {
            return launchedFromAod;
        }

        @JavascriptInterface
        public boolean hasAodPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return Settings.canDrawOverlays(MainActivity.this);
            }
            return true;
        }

        @JavascriptInterface
        public String getPermissionStatus() {
            try {
                boolean overlay = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(MainActivity.this);
                boolean battery = true;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                    battery = pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
                }
                boolean install = Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getPackageManager().canRequestPackageInstalls();
                JSONObject obj = new JSONObject();
                obj.put("overlay", overlay);
                obj.put("battery", battery);
                obj.put("install", install);
                return obj.toString();
            } catch (Exception e) {
                return "{\"overlay\":true,\"battery\":true,\"install\":true}";
            }
        }

        @JavascriptInterface
        public void requestOverlayPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName())
                    );
                    startActivity(intent);
                }
            });
        }

        @JavascriptInterface
        public void requestBatteryPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent intent = new Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:" + getPackageName())
                    );
                    startActivity(intent);
                }
            });
        }

        @JavascriptInterface
        public void requestInstallPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Intent intent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())
                    );
                    startActivity(intent);
                }
            });
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
        public void setPopupConfig(boolean enabled, String style, int delayMs, String accentHex) {
            SharedPreferences prefs = getSharedPreferences(ChargingMonitorService.PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                .putBoolean("popup_enabled", enabled)
                .putString("popup_style", style)
                .putInt("popup_delay_ms", delayMs)
                .putString("popup_accent", accentHex)
                .apply();
        }

        @JavascriptInterface
        public void testChargingPopup() {
            runOnUiThread(() -> {
                try {
                    Intent svc = new Intent(MainActivity.this, ChargingMonitorService.class);
                    svc.setAction(ChargingMonitorService.ACTION_TEST_POPUP);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(svc);
                    } else {
                        startService(svc);
                    }
                } catch (Exception ignored) {}
            });
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
        public void downloadAndInstallUpdate(String apkUrl) {
            runOnUiThread(() -> {
                try {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File apkFile = new File(dir, "OSIEN-Launcher-update.apk");
                    if (apkFile.exists()) apkFile.delete();

                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(apkUrl));
                    req.setTitle("OSIEN Launcher Update");
                    req.setDescription("Downloading latest release...");
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
                    req.setDestinationUri(Uri.fromFile(apkFile));

                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm == null) return;
                    long downloadId = dm.enqueue(req);

                    BroadcastReceiver onComplete = new BroadcastReceiver() {
                        @Override
                        public void onReceive(Context ctx, Intent intent) {
                            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                            if (id == downloadId) {
                                try {
                                    unregisterReceiver(this);
                                } catch (Exception ignored) {}
                                installApkFile(apkFile);
                            }
                        }
                    };

                    IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        registerReceiver(onComplete, filter, Context.RECEIVER_EXPORTED);
                    } else {
                        registerReceiver(onComplete, filter);
                    }
                } catch (Exception e) {
                    // Fallback: open download URL in browser
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl)));
                    } catch (Exception ignored) {}
                }
            });
        }

        private void installApkFile(File apkFile) {
            try {
                Uri contentUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    apkFile
                );
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(contentUri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(install);
            } catch (Exception ignored) {}
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

                long currentRaw = bm != null ? bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW) : Long.MIN_VALUE;
                long chargeCounterUah = bm != null ? bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER) : Long.MIN_VALUE;
                double currentMa = currentRaw != Long.MIN_VALUE ? Math.abs(currentRaw) / 1000.0 : -1;

                double pct = (level >= 0 && scale > 0) ? (level * 100.0 / scale) : -1;

                // Smart Charging / Battery Protection detection (e.g. stops at 80% or 85% while plugged in)
                boolean isPlugged = plugged > 0;
                boolean isFull = status == BatteryManager.BATTERY_STATUS_FULL || pct >= 100.0;
                boolean isSmartPaused = isPlugged && !isFull && (
                    status == BatteryManager.BATTERY_STATUS_NOT_CHARGING ||
                    (pct >= 79.0 && currentRaw != Long.MIN_VALUE && currentRaw != 0 && currentMa <= 25.0)
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
                json.put("chargeCounterUah", chargeCounterUah);
                json.put("tempC", tempTenths / 10.0);
                json.put("inPocket", isInPocket);
                return json.toString();
            } catch (Exception e) {
                return "{}";
            }
        }
    }
}
