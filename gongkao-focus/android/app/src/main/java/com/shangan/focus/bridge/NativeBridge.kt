package com.shangan.focus.bridge

import android.webkit.JavascriptInterface

class NativeBridge(private val router: BridgeRouter) {
    @JavascriptInterface
    fun postMessage(jsonString: String): String = router.handle(jsonString)
}
