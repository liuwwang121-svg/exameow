<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useWrongBookStore } from '@/stores/wrongBook'
import AppShell from '@/components/layout/AppShell.vue'

const configStore = useConfigStore()
const wrongBookStore = useWrongBookStore()
const reminderCount = ref(0)
let dueRefreshTimer: ReturnType<typeof setInterval> | null = null

const childWindow = ref<string | null>(null)

// 先用 hash 同步检测（避免闪烁），再用 Tauri API 确认
function syncDetect(): string | null {
  const hash = window.location.hash
  if (hash === '#/src-windows/record-overlay') return 'record-overlay'
  if (hash === '#/src-windows/answer-float') return 'answer-float'
  return null
}

childWindow.value = syncDetect()

function openWrongBook() {
  window.location.hash = '#/wrong-book'
  reminderCount.value = 0
}

async function refreshDueAndReminder() {
  wrongBookStore.refreshDueNow()
  reminderCount.value = await wrongBookStore.consumeDailyReminder()
  if (reminderCount.value) setTimeout(() => { reminderCount.value = 0 }, 8000)
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') void refreshDueAndReminder()
}

const childComponent = computed(() => {
  if (childWindow.value === 'record-overlay') {
    return defineAsyncComponent(() => import('@/components/search/RecordOverlay.vue'))
  }
  if (childWindow.value === 'answer-float') {
    return defineAsyncComponent(() => import('@/components/search/AnswerFloat.vue'))
  }
  return null
})

onMounted(async () => {
  // Tauri API 确认（覆盖 hash 检测结果）
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const label = getCurrentWindow().label
    if (label === 'record-overlay' || label === 'answer-float') {
      childWindow.value = label
    }
  } catch { /* not in Tauri */ }

  if (childWindow.value) {
    const { initChildTheme } = await import('@/utils/childTheme')
    await initChildTheme()
    return
  }
  await Promise.all([configStore.loadSaved(), wrongBookStore.initialize()])
  await refreshDueAndReminder()
  document.addEventListener('visibilitychange', handleVisibilityChange)
  dueRefreshTimer = setInterval(() => wrongBookStore.refreshDueNow(), 60_000)

  const { isTauri, isMobileDevice } = await import('@/utils/platform')
  if (isTauri() && isMobileDevice()) {
    try {
      const { tauriApi } = await import('@/api/bridge')
      await tauriApi.otaNotifyReady()
      tauriApi.otaDownload().catch(() => {})
    } catch { /* OTA unavailable */ }
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (dueRefreshTimer) clearInterval(dueRefreshTimer)
})
</script>

<template>
  <AppShell v-if="!childWindow" />
  <component v-else :is="childComponent" />
  <button
    v-if="!childWindow && reminderCount"
    class="fixed z-[70] left-3 right-3 sm:left-auto sm:right-6 bottom-[calc(84px+env(safe-area-inset-bottom))] sm:bottom-6 sm:w-96 rounded-2xl p-4 text-left shadow-xl"
    style="background: rgb(var(--md-inverse-surface)); color: rgb(var(--md-inverse-on-surface))"
    @click="openWrongBook"
  >
    <b>今日错题复习</b>
    <span class="block text-sm mt-1 opacity-90">有 {{ reminderCount }} 道错题已到期，点这里开始复习。</span>
  </button>
</template>
