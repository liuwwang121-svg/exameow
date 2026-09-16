<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDownTrayIcon, ArrowUpTrayIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useWrongBookStore } from '@/stores/wrongBook'
import { isTauri } from '@/utils/platform'

const emit = defineEmits<{ close: [] }>()
const store = useWrongBookStore()
const restoreInput = ref<HTMLInputElement | null>(null)
const status = ref('')
const busy = ref(false)

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)))
  }
  return btoa(binary)
}

async function backup() {
  busy.value = true
  status.value = ''
  try {
    const json = await store.exportBackup()
    const filename = `行测错题本备份_${new Date().toISOString().slice(0, 10)}.json`
    if (isTauri()) {
      const { tauriApi } = await import('@/api/bridge')
      const savedPath = await tauriApi.saveToDownloads(filename, utf8ToBase64(json))
      status.value = `已备份 ${store.entries.length} 条错题：${savedPath}`
    } else {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      status.value = `已生成备份：${store.entries.length} 条错题。请妥善保存下载的 JSON 文件。`
    }
  } finally {
    busy.value = false
  }
}

async function restore(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  status.value = ''
  try {
    const result = await store.restoreBackup(await file.text())
    status.value = `恢复完成：${result.entries} 条错题，${result.assets} 张图片。`
  } catch (cause) {
    status.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between"><h2 class="text-title-md font-bold">备份与恢复</h2><button class="btn-icon" @click="emit('close')"><XMarkIcon class="w-5 h-5" /></button></div>
    <p class="text-body-sm" style="color: rgb(var(--md-on-surface-variant))">备份包含错题、复习时间和原始图片。恢复会用备份内容替换当前错题本，请先导出当前备份。</p>
    <input ref="restoreInput" type="file" accept="application/json,.json" class="hidden" @change="restore" />
    <button class="btn-filled w-full !h-12" :disabled="busy" @click="backup"><ArrowDownTrayIcon class="w-5 h-5" />导出完整备份</button>
    <button class="btn-outlined w-full !h-12" :disabled="busy" @click="restoreInput?.click()"><ArrowUpTrayIcon class="w-5 h-5" />从 JSON 恢复</button>
    <p v-if="status" class="rounded-xl p-3 text-sm" style="background: rgb(var(--md-surface-container-high))">{{ status }}</p>
  </div>
</template>
