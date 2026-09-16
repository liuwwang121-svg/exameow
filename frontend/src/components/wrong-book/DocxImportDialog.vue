<script setup lang="ts">
import { ref } from 'vue'
import { XMarkIcon, DocumentArrowUpIcon, CheckCircleIcon } from '@heroicons/vue/24/outline'
import { useWrongBookStore } from '@/stores/wrongBook'

const emit = defineEmits<{ close: []; imported: [count: number] }>()
const store = useWrongBookStore()
const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const error = ref('')
const confirming = ref(false)

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.docx')) {
    error.value = '请选择 .docx 格式的 Word 文档。'
    return
  }
  fileName.value = file.name
  error.value = ''
  try {
    await store.previewDocx(await file.arrayBuffer())
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

async function confirm() {
  confirming.value = true
  try {
    const count = await store.confirmDocxImport()
    emit('imported', count)
  } finally {
    confirming.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-title-md font-bold">导入历史 Word 错题</h2>
        <p class="text-body-sm mt-1" style="color: rgb(var(--md-on-surface-variant))">按“编号｜日期｜模块/题号｜错因标题”拆分，默认不调用 AI。</p>
      </div>
      <button class="btn-icon" @click="store.setDocxPreview(null); emit('close')"><XMarkIcon class="w-5 h-5" /></button>
    </div>
    <input ref="fileInput" type="file" accept=".docx" class="hidden" @change="selectFile" />
    <button class="card-outlined w-full p-6 flex flex-col items-center gap-2" :disabled="store.loading" @click="fileInput?.click()">
      <DocumentArrowUpIcon class="w-10 h-10" style="color: rgb(var(--md-primary))" />
      <span class="font-semibold">{{ store.loading ? '正在读取文字和图片…' : (fileName || '选择 DOCX 文件') }}</span>
    </button>
    <p v-if="error || store.error" class="text-sm" style="color: rgb(var(--md-error))">{{ error || store.error }}</p>

    <template v-if="store.docxPreview">
      <div class="card-filled p-4">
        <div class="flex items-center gap-2 font-bold"><CheckCircleIcon class="w-5 h-5" />识别到 {{ store.docxPreview.entries.length }} 条错题</div>
        <div class="text-sm mt-2" style="color: rgb(var(--md-on-surface-variant))">
          图片 {{ store.docxPreview.assets.length }} 张 · 忽略目录/导航 {{ store.docxPreview.ignoredCount }} 处 · 待确认 {{ store.docxPreview.entries.filter(e => e.needsConfirmation).length }} 条
        </div>
      </div>
      <div v-if="store.docxPreview.warnings.length" class="rounded-xl p-3 text-sm" style="background: rgb(var(--md-tertiary-container)); color: rgb(var(--md-on-tertiary-container))">
        <p v-for="warning in store.docxPreview.warnings" :key="warning">{{ warning }}</p>
      </div>
      <div class="space-y-2 max-h-60 overflow-y-auto">
        <div v-for="entry in store.docxPreview.entries.slice(0, 8)" :key="entry.id" class="card-outlined p-3">
          <div class="font-semibold text-sm break-words">{{ entry.title }}</div>
          <div class="text-xs mt-1" style="color: rgb(var(--md-on-surface-variant))">{{ entry.subject }} / {{ entry.section }} · 图片 {{ entry.assetIds.length }} 张 <span v-if="entry.needsConfirmation">· 待确认</span></div>
        </div>
        <p v-if="store.docxPreview.entries.length > 8" class="text-center text-sm">另有 {{ store.docxPreview.entries.length - 8 }} 条</p>
      </div>
      <button class="btn-filled w-full !h-12" :disabled="confirming || !store.docxPreview.entries.length" @click="confirm">{{ confirming ? '正在写入…' : '确认导入（不调用 AI）' }}</button>
    </template>
  </div>
</template>
