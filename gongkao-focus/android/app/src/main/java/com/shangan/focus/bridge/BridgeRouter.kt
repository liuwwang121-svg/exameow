package com.shangan.focus.bridge

import android.app.Activity
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.shangan.focus.nativev2.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

class BridgeRouter(private val activity: Activity) {
    private val focus=NativeFocusStore(activity)
    private val ocr=NativeOcrRecognizer()
    private val reminders=ReminderScheduler(activity)

    fun handle(raw:String):String=try{val r=JSONObject(raw);when(r.optString("action")){
        "ping"->ok().put("version","2.0.0").put("offline",true).put("capabilities",JSONObject().put("focus",true).put("blocking",true).put("ocr",true).put("paper",true)).toString()
        "focus_start"->startFocus(r)
        "focus_pause"->{focus.pause();refresh();ok().put("focus",focusJson()).toString()}
        "focus_resume"->{focus.resume();refresh();ok().put("focus",focusJson()).toString()}
        "focus_finish"->finishFocus()
        "focus_status"->ok().put("focus",focusJson()).toString()
        "strong_get"->ok().put("enabled",focus.strongPreference()).toString()
        "strong_set"->{focus.setStrong(r.optBoolean("enabled",false));ok().put("enabled",focus.strongPreference()).toString()}
        "blocked_get"->ok().put("packages",JSONArray(focus.blocked().toList().sorted())).toString()
        "blocked_set"->setBlocked(r.optJSONArray("packages")?:JSONArray())
        "apps_list"->apps()
        "ocr"->ok().put("text",ocr.recognize(r.getString("imageBase64"))).toString()
        "permissions"->permissionJson().toString()
        "schedule_day_reminders"->schedule(r)
        "open_accessibility_settings"->{activity.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));ok().toString()}
        "open_usage_settings"->{activity.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));ok().toString()}
        "open_notification_settings"->{if(Build.VERSION.SDK_INT>=26)activity.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,activity.packageName));ok().toString()}
        else->JSONObject().put("ok",false).put("error","unknown_action").toString()
    }}catch(e:Exception){JSONObject().put("ok",false).put("error",e.javaClass.simpleName).put("message",e.message?:"").toString()}

    private fun startFocus(r:JSONObject):String{focus.start(r.optString("id").ifBlank{"web-${System.currentTimeMillis()}"},r.optString("name").ifBlank{"专注"},r.optString("mode","free"),r.optLong("plannedSeconds",-1).takeIf{it>0},focus.strongPreference());val i=Intent(activity,FocusForegroundService::class.java).setAction(FocusForegroundService.START);if(Build.VERSION.SDK_INT>=26)activity.startForegroundService(i)else activity.startService(i);return ok().put("focus",focusJson()).toString()}
    private fun finishFocus():String{val before=focusJson();focus.finish();activity.startService(Intent(activity,FocusForegroundService::class.java).setAction(FocusForegroundService.STOP));return ok().put("focus",before).toString()}
    private fun refresh(){val i=Intent(activity,FocusForegroundService::class.java).setAction(FocusForegroundService.REFRESH);if(Build.VERSION.SDK_INT>=26)activity.startForegroundService(i)else activity.startService(i)}
    private fun focusJson():JSONObject{val s=focus.snapshot();return JSONObject().put("active",s.active).put("paused",s.paused).put("id",s.id).put("name",s.name).put("mode",s.mode).put("plannedSeconds",s.plannedSeconds).put("startedAt",s.startedAt).put("strong",s.strong).put("interruptions",s.interruptions).put("blockedAttempts",s.blockedAttempts)}
    private fun setBlocked(a:JSONArray):String{val v=buildSet{for(i in 0 until a.length())a.optString(i).takeIf{it.isNotBlank()}?.let(::add)};focus.setBlocked(v);return ok().put("packages",JSONArray(v.toList().sorted())).toString()}
    private fun apps():String{val pm=activity.packageManager;val intent=Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);@Suppress("DEPRECATION") val infos=pm.queryIntentActivities(intent,0);val list=infos.mapNotNull{val pkg=it.activityInfo?.packageName?:return@mapNotNull null;if(pkg==activity.packageName)return@mapNotNull null;JSONObject().put("package",pkg).put("label",it.loadLabel(pm)?.toString()?:pkg)}.distinctBy{it.getString("package")}.sortedBy{it.getString("label")};return ok().put("apps",JSONArray(list)).toString()}
    private fun permissionJson():JSONObject{val ops=activity.getSystemService(Context.APP_OPS_SERVICE)as AppOpsManager;@Suppress("DEPRECATION") val mode=ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,android.os.Process.myUid(),activity.packageName);val enabled=Settings.Secure.getString(activity.contentResolver,Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)?:"";val acc=enabled.split(':').any{it.contains("${activity.packageName}/com.shangan.focus.nativev2.FocusAccessibilityService",true)};return ok().put("accessibility",acc).put("usageAccess",mode==AppOpsManager.MODE_ALLOWED).put("notifications",Build.VERSION.SDK_INT<33||activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)}
    private fun schedule(r:JSONObject):String{val day=LocalDate.parse(r.getString("learningDay"));val zone=ZoneId.systemDefault();val tasks=r.optJSONArray("tasks")?:JSONArray();val list=mutableListOf<ReminderScheduler.Item>();var remaining=0;for(i in 0 until tasks.length()){val t=tasks.optJSONObject(i)?:continue;if(t.optBoolean("completed",false))continue;remaining+=t.optInt("minutes",0).coerceAtLeast(0);val time=t.optString("recommendedStart");if(time.matches(Regex("\\d{2}:\\d{2}"))){val at=LocalDateTime.of(day,LocalTime.parse(time)).atZone(zone).toInstant().toEpochMilli();list+=ReminderScheduler.Item(t.optString("title","学习任务"),at)}};reminders.replace(list);if(remaining>0){val at=LocalDateTime.of(day,LocalTime.of(20,0)).atZone(zone).toInstant().toEpochMilli();reminders.insufficient(at,remaining)};return ok().put("scheduled",list.size).put("remainingMinutes",remaining).toString()}
    private fun ok()=JSONObject().put("ok",true)
}
