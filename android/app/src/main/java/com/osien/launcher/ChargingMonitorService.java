package com.osien.launcher;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

public class ChargingMonitorService extends Service {
    private static final String CHANNEL_ID = "osien_launcher_aod_channel";
    private static final int NOTIF_ID = 1001;
    public static final String PREFS_NAME = "voltpulse_aod_prefs";
    public static final String ACTION_TEST_POPUP = "com.osien.launcher.TEST_POPUP";

    private BroadcastReceiver screenAndPowerReceiver;
    private long lastLaunchMs = 0;
    private View activePopupView = null;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification());

        screenAndPowerReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                String action = intent.getAction();
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                boolean aodEnabled = prefs.getBoolean("aod_enabled", true);
                boolean chargingOnly = prefs.getBoolean("aod_charging_only", false);
                boolean popupEnabled = prefs.getBoolean("popup_enabled", true);
                int popupDelayMs = prefs.getInt("popup_delay_ms", 2800);

                if (Intent.ACTION_POWER_CONNECTED.equals(action)) {
                    PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                    boolean screenOn = pm != null && pm.isInteractive();
                    if (screenOn && popupEnabled) {
                        // Show minimal charging pop-up right after OEM ring (Samsung/MIUI/OnePlus) finishes
                        mainHandler.postDelayed(() -> showChargingPopup(context), popupDelayMs);
                    } else if (!screenOn && aodEnabled) {
                        wakeAndLaunchAod(context);
                    }
                } else if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                    boolean gestureLock = prefs.getBoolean("gesture_lock_enabled", false);
                    if (gestureLock) {
                        prefs.edit().putBoolean("gesture_lock_armed", true).apply();
                    }
                    if (aodEnabled && (!chargingOnly || isDeviceCharging(context))) {
                        mainHandler.postDelayed(() -> wakeAndLaunchAod(context), 320);
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_POWER_CONNECTED);
        filter.addAction(Intent.ACTION_POWER_DISCONNECTED);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(screenAndPowerReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(screenAndPowerReceiver, filter);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_TEST_POPUP.equals(intent.getAction())) {
            mainHandler.post(() -> showChargingPopup(this));
        }
        return START_STICKY;
    }

    private void showChargingPopup(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            return;
        }
        removeActivePopup();

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String style = prefs.getString("popup_style", "island");
        String accentHex = prefs.getString("popup_accent", "#10b981");
        int accentColor;
        try {
            accentColor = Color.parseColor(accentHex);
        } catch (Exception e) {
            accentColor = Color.parseColor("#10b981");
        }

        // Read live battery % & power
        IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent bs = context.registerReceiver(null, ifilter);
        int level = bs != null ? bs.getIntExtra(BatteryManager.EXTRA_LEVEL, 0) : 0;
        int scale = bs != null ? bs.getIntExtra(BatteryManager.EXTRA_SCALE, 100) : 100;
        int voltageMv = bs != null ? bs.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) : 0;
        int pct = (scale > 0) ? Math.round(level * 100f / scale) : level;
        BatteryManager bm = (BatteryManager) context.getSystemService(BATTERY_SERVICE);
        long rawUa = bm != null ? bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW) : Long.MIN_VALUE;
        double ma = rawUa != Long.MIN_VALUE ? Math.abs(rawUa) / 1000.0 : -1;
        double watts = (voltageMv / 1000.0) * (ma / 1000.0);
        String pwrText = voltageMv > 0 && ma >= 0 ? String.format("%.3fW", watts) : "CHARGING";

        WindowManager wm = (WindowManager) context.getSystemService(WINDOW_SERVICE);
        if (wm == null) return;

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        boolean isBottom = "dock".equals(style);
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = (isBottom ? Gravity.BOTTOM : Gravity.TOP) | Gravity.CENTER_HORIZONTAL;
        params.y = dp(isBottom ? 72 : 44);

        LinearLayout container = new LinearLayout(context);
        container.setOrientation(LinearLayout.HORIZONTAL);
        container.setGravity(Gravity.CENTER_VERTICAL);

        GradientDrawable bg = new GradientDrawable();
        if ("float".equals(style)) {
            bg.setColor(Color.TRANSPARENT);
            container.setPadding(dp(18), dp(10), dp(18), dp(10));
        } else if ("glass".equals(style)) {
            bg.setColor(Color.parseColor("#E6141418"));
            bg.setCornerRadius(dp(22));
            bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"));
            container.setPadding(dp(22), dp(14), dp(22), dp(14));
        } else if ("edge".equals(style)) {
            bg.setColor(Color.parseColor("#F209090B"));
            bg.setCornerRadius(dp(99));
            bg.setStroke(dp(2), accentColor);
            container.setPadding(dp(20), dp(9), dp(20), dp(9));
        } else if ("nothing".equals(style)) {
            bg.setColor(Color.parseColor("#F5050505"));
            bg.setCornerRadius(dp(99));
            bg.setStroke(dp(1), Color.parseColor("#44FFFFFF"));
            container.setPadding(dp(18), dp(10), dp(18), dp(10));
        } else {
            // island & dock
            bg.setColor(Color.parseColor("#F509090B"));
            bg.setCornerRadius(dp(99));
            bg.setStroke(dp(1), Color.parseColor("#29FFFFFF"));
            container.setPadding(dp(18), dp(10), dp(18), dp(10));
        }
        container.setBackground(bg);

        // Glowing indicator dot
        View dot = new View(context);
        GradientDrawable dotBg = new GradientDrawable();
        dotBg.setShape(GradientDrawable.OVAL);
        dotBg.setColor("nothing".equals(style) ? Color.parseColor("#EF4444") : accentColor);
        dot.setBackground(dotBg);
        LinearLayout.LayoutParams dotLp = new LinearLayout.LayoutParams(dp(8), dp(8));
        dotLp.setMarginEnd(dp(10));
        container.addView(dot, dotLp);

        // Live Percentage text
        TextView pctTv = new TextView(context);
        pctTv.setText(pct + "%");
        pctTv.setTextColor(Color.WHITE);
        pctTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, "float".equals(style) ? 26 : 16);
        pctTv.setTypeface("nothing".equals(style) ? Typeface.MONOSPACE : Typeface.create("sans-serif-medium", Typeface.NORMAL));
        container.addView(pctTv);

        // Subtle power/status label
        TextView subTv = new TextView(context);
        subTv.setText("  ·  " + pwrText);
        subTv.setTextColor("nothing".equals(style) ? Color.parseColor("#A1A1AA") : accentColor);
        subTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        subTv.setTypeface(Typeface.MONOSPACE);
        container.addView(subTv);

        container.setAlpha(0f);
        container.setTranslationY(isBottom ? dp(24) : -dp(24));

        try {
            wm.addView(container, params);
            activePopupView = container;
            container.animate().alpha(1f).translationY(0f).setDuration(280).start();

            // Auto-dismiss cleanly after 4 seconds
            mainHandler.postDelayed(() -> {
                if (activePopupView == container) {
                    container.animate()
                        .alpha(0f)
                        .translationY(isBottom ? dp(24) : -dp(24))
                        .setDuration(260)
                        .withEndAction(this::removeActivePopup)
                        .start();
                }
            }, 4000);
        } catch (Exception ignored) {}
    }

    private void removeActivePopup() {
        if (activePopupView != null) {
            try {
                WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
                if (wm != null) wm.removeView(activePopupView);
            } catch (Exception ignored) {}
            activePopupView = null;
        }
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()
        ));
    }

    private boolean isDeviceCharging(Context context) {
        IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent batteryStatus = context.registerReceiver(null, ifilter);
        if (batteryStatus == null) return false;
        int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        int plugged = batteryStatus.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
        return status == BatteryManager.BATTERY_STATUS_CHARGING ||
               status == BatteryManager.BATTERY_STATUS_FULL ||
               plugged > 0;
    }

    @SuppressWarnings("deprecation")
    private void wakeAndLaunchAod(Context context) {
        long now = System.currentTimeMillis();
        if (now - lastLaunchMs < 1500) return;
        lastLaunchMs = now;

        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "OsienLauncher:AodWakeLock"
                );
                wl.acquire(4000);
            }
        } catch (Exception ignored) {}

        try {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_NO_ANIMATION
            );
            launch.putExtra("from_aod", true);
            context.startActivity(launch);
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        removeActivePopup();
        if (screenAndPowerReceiver != null) {
            try {
                unregisterReceiver(screenAndPowerReceiver);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "OSIEN Launcher AOD",
                NotificationManager.IMPORTANCE_MIN
            );
            channel.setDescription("Keeps OSIEN Launcher AOD & Charging Pop-Up ready");
            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null) mgr.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        return builder
            .setContentTitle("OSIEN Launcher Active")
            .setContentText("AOD & Charging Pop-Up ready")
            .setSmallIcon(android.R.drawable.ic_lock_idle_charging)
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
    }
}
