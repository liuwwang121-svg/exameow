package com.shangan.focus.nativev2

import android.accessibilityservice.AccessibilityService
import android.app.*
import android.content.*
import android.graphics.BitmapFactory
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.shangan.focus.MainActivity
import java.util.concurrent.TimeUnit

class NativeFocusStore(context: Context) {
    private val p=context.getSharedPreferences("native_focus",Context.MODE_PRIVATE)
    data class Snapshot(val active:Boolean,val paused:Boolean,val id:String?,val name:String?,val mode:String,val plannedSeconds:Long?,val startedAt:Long,val strong:Boolean,val interruptions:Int,val blockedAttempts:Int)
    data class Observation(val counted:Boolean,val shouldBlock:Boolean)
    fun start(id:String,name:String,mode:String,planned:Long?,strong:Boolean){p.edit().putBoolean("active",true).putBoolean("paused",false).putString("id",id).putString("name",name).putString("mode",mode).putLong("planned",planned?:-1).putLong("started",System.currentTimeMillis()).putBoolean("strong",strong).putInt("interruptions",0).putInt("blockedAttempts",0).putString("lastPackage","").apply()}
    fun pause(){p.edit().putBoolean("paused",true).apply()}; fun resume(){p.edit().putBoolean("paused",false).apply()}; fun finish(){p.edit().putBoolean("active",false).putBoolean("paused",false).apply()}
    fun setStrong(v:Boolean){p.edit().putBoolean("strongPreference",v).apply()}; fun strongPreference()=p.getBoolean("strongPreference",false)
    fun setBlocked(v:Set<String>){p.edit().putStringSet("blockedPackages",v).apply()}; fun blocked()=p.getStringSet("blockedPackages",emptySet())?.toSet()?:emptySet()
    fun snapshot()=Snapshot(p.getBoolean("active",false),p.getBoolean("paused",false),p.getString("id",null),p.getString("name",null),p.getString("mode","free")?:"free",p.getLong("planned",-1).takeIf{it>=0},p.getLong("started",0),p.getBoolean("strong",false),p.getInt("interruptions",0),p.getInt("blockedAttempts",0))
    fun observe(pkg:String,self:String,protected:Set<String>):Observation{val s=snapshot();if(!s.active||s.paused||pkg==self||pkg in protected||pkg=="android"||pkg.startsWith("com.android."))return Observation(false,false);val last=p.getString("lastPackage","");if(last==pkg)return Observation(false,false);val block=s.strong&&pkg in blocked();p.edit().putString("lastPackage",pkg).putInt("interruptions",s.interruptions+1).putInt("blockedAttempts",s.blockedAttempts+(if(block)1 else 0)).apply();return Observation(true,block)}
}

object FocusNotification {
    const val CHANNEL="focus_active"; const val ID=2107
    fun ensure(c:Context){if(Build.VERSION.SDK_INT>=26)c.getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL,"专注计时",NotificationManager.IMPORTANCE_LOW).apply{description="正在进行的专注";setShowBadge(false)})}
    fun build(c:Context,s:NativeFocusStore.Snapshot):Notification{ensure(c);val pi=PendingIntent.getActivity(c,0,Intent(c,MainActivity::class.java),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE);return NotificationCompat.Builder(c,CHANNEL).setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle(s.name?:"上岸专注").setContentText(if(s.paused)"已暂停" else if(s.strong)"强制专注中" else "专注中").setOngoing(s.active).setOnlyAlertOnce(true).setContentIntent(pi).build()}
}

class FocusForegroundService:Service(){companion object{const val START="com.shangan.focus.START";const val REFRESH="com.shangan.focus.REFRESH";const val STOP="com.shangan.focus.STOP"};private lateinit var store:NativeFocusStore;override fun onCreate(){super.onCreate();store=NativeFocusStore(this);FocusNotification.ensure(this)};override fun onStartCommand(i:Intent?,f:Int,id:Int):Int{if(i?.action==STOP){stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();return START_NOT_STICKY};val s=store.snapshot();if(!s.active){stopSelf();return START_NOT_STICKY};startForeground(FocusNotification.ID,FocusNotification.build(this,s));return START_STICKY};override fun onBind(i:Intent?):IBinder?=null}

class FocusAccessibilityService:AccessibilityService(){private lateinit var store:NativeFocusStore;private val safe by lazy{setOf(packageName,"com.android.systemui","com.android.settings","com.google.android.permissioncontroller","com.android.permissioncontroller","com.android.dialer","com.google.android.dialer","com.android.phone")};override fun onServiceConnected(){store=NativeFocusStore(this)};override fun onAccessibilityEvent(e:AccessibilityEvent?){if(!::store.isInitialized)return;if(e?.eventType!=AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED&&e?.eventType!=AccessibilityEvent.TYPE_WINDOWS_CHANGED)return;val pkg=e.packageName?.toString()?.takeIf{it.isNotBlank()}?:return;if(store.observe(pkg,packageName,safe).shouldBlock){Toast.makeText(this,"强制专注中：这个应用暂时被你自己屏蔽了",Toast.LENGTH_SHORT).show();startActivity(Intent(this,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))}};override fun onInterrupt()=Unit}

object ReminderNotification{const val CHANNEL="study_reminders";fun show(c:Context,id:Int,title:String,text:String){if(Build.VERSION.SDK_INT>=26)c.getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL,"学习提醒",NotificationManager.IMPORTANCE_DEFAULT));val pi=PendingIntent.getActivity(c,0,Intent(c,MainActivity::class.java),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE);c.getSystemService(NotificationManager::class.java).notify(id,NotificationCompat.Builder(c,CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle(title).setContentText(text).setAutoCancel(true).setContentIntent(pi).build())}}
class ReminderReceiver:BroadcastReceiver(){override fun onReceive(c:Context,i:Intent){ReminderNotification.show(c,i.getIntExtra("notificationId",3000),i.getStringExtra("title")?:"上岸专注",i.getStringExtra("text")?:"该开始今天的任务了")}}
class ReminderScheduler(private val c:Context){private val am=c.getSystemService(AlarmManager::class.java);data class Item(val title:String,val at:Long);fun replace(items:List<Item>){for(n in 0 until 60){val pi=pending(4200+n,"","",PendingIntent.FLAG_NO_CREATE);if(pi!=null){am.cancel(pi);pi.cancel()}};items.take(20).forEachIndexed{i,x->schedule(4200+i*3,x.at,"现在开始：${x.title}","按计划执行，比临时决定更省力");schedule(4201+i*3,x.at+15*60_000L,"任务已延迟：${x.title}","还没开始的话，现在进入专注即可")}};fun insufficient(at:Long,mins:Int)=schedule(4999,at,"今天的标准目标可能来不及","还需要约 $mins 分钟，建议现在开始下一项");private fun schedule(id:Int,at:Long,t:String,x:String){if(at<=System.currentTimeMillis())return;pending(id,t,x,PendingIntent.FLAG_UPDATE_CURRENT)?.let{am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,it)}};private fun pending(id:Int,t:String,x:String,flag:Int):PendingIntent?=PendingIntent.getBroadcast(c,id,Intent(c,ReminderReceiver::class.java).putExtra("notificationId",id).putExtra("title",t).putExtra("text",x),flag or PendingIntent.FLAG_IMMUTABLE)}

class NativeOcrRecognizer{fun recognize(dataUrl:String):String{val bytes=Base64.decode(dataUrl.substringAfter(',',dataUrl),Base64.DEFAULT);val bmp=BitmapFactory.decodeByteArray(bytes,0,bytes.size)?:error("无法读取图片");val r=TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build());return try{Tasks.await(r.process(InputImage.fromBitmap(bmp,0)),15,TimeUnit.SECONDS).text}finally{r.close();bmp.recycle()}}}
