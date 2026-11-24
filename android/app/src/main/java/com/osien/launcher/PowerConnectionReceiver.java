package com.osien.launcher;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class PowerConnectionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();

        if (Intent.ACTION_POWER_CONNECTED.equals(action) || Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            // Ensure background service is running
            try {
                Intent svc = new Intent(context, ChargingMonitorService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(svc);
                } else {
                    context.startService(svc);
                }
            } catch (Exception ignored) {}

            // Auto-launch AOD charging screen when charger is plugged in
            if (Intent.ACTION_POWER_CONNECTED.equals(action)) {
                try {
                    Intent launch = new Intent(context, MainActivity.class);
                    launch.addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK |
                        Intent.FLAG_ACTIVITY_SINGLE_TOP |
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                    );
                    context.startActivity(launch);
                } catch (Exception ignored) {}
            }
        }
    }
}
