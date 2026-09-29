package com.shangan.focus.focus

import android.app.Service
import android.content.Intent
import android.os.IBinder

class FocusForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
}
