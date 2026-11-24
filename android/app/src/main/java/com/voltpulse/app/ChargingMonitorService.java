package com.voltpulse.app;

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
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

public class ChargingMonitorService extends Service {
    private static final String CHANNEL_ID = "voltpulse_aod_channel";
    private static final int NOTIF_ID = 1001;
    public static final String PREFS_NAME = "voltpulse_aod_prefs";
    private BroadcastReceiver screenAndPowerReceiver;
    private long lastLaunchMs = 0;

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

                if (!aodEnabled) return;

                if (Intent.ACTION_POWER_CONNECTED.equals(action)) {
                    wakeAndLaunchAod(context);
                } else if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                    if (!chargingOnly || isDeviceCharging(context)) {
                        new Handler(Looper.getMainLooper()).postDelayed(() -> wakeAndLaunchAod(context), 320);
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
                    "VoltPulse:AodWakeLock"
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
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
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
                "VoltPulse Always-On Display",
                NotificationManager.IMPORTANCE_MIN
            );
            channel.setDescription("Keeps Always-On Display active when screen locks");
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
            .setContentTitle("VoltPulse AOD Active")
            .setContentText("Always-On Display is ready on lock screen")
            .setSmallIcon(android.R.drawable.ic_lock_idle_charging)
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
    }
}
