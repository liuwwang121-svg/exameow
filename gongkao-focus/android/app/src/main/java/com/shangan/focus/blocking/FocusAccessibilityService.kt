package com.shangan.focus.blocking

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class FocusAccessibilityService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit
}
