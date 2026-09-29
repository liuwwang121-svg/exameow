package com.shangan.focus.bridge

import org.json.JSONObject

class BridgeRouter {
    fun handle(requestJson: String): String {
        return try {
            val request = JSONObject(requestJson)
            when (request.optString("action")) {
                "ping" -> JSONObject()
                    .put("ok", true)
                    .put("version", "2.0.0")
                    .put("offline", true)
                    .put("capabilities", JSONObject()
                        .put("focus", false)
                        .put("ocr", false)
                        .put("blocking", false))
                    .toString()
                else -> JSONObject().put("ok", false).put("error", "unknown_action").toString()
            }
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", "invalid_json").toString()
        }
    }
}
