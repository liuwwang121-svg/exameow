<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { XMarkIcon, CameraIcon, PhotoIcon, SparklesIcon } from '@heroicons/vue/24/outline'
import { useWrongBookStore } from '@/stores/wrongBook'
import { WRONG_CAUSES, type WrongCause } from '@/features/wrong-book/model'
import { useImageSearch } from '@/composables/useImageSearch'

const emit = defineEmits<{ close: []; saved: [] }>()
const store = useWrongBookStore()
const { recognize, busy: recognizing, error: ocrError, cancel } = useImageSearch()
const cameraInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const images = ref<File[]>([])
const previewUrls = ref<string[]>([])
const saving = ref(false)
const error = ref('')
const form = ref({
  title: '', subject: '资料分析', section: '', stem: '', answer: '', analysis: '', userAnswer: '', notes: '',
  cause: '自定义' as WrongCause, customCause: '',
})
const canSave = computed(() => Boolean(form.value.title.trim() || form.value.stem.trim() || images.value.length))

function addFiles(files: FileList | null) {
  if (!files) return
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue
    images.value.push(file)
    previewUrls.value.push(URL.createObjectURL(file))
  }
}

function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(input.files)
  input.value = ''
}

function removeImage(index: number) {
  const url = previewUrls.value[index]
  if (url) URL.revokeObjectURL(url)
  previewUrls.value.splice(index, 1)
  images.value.splice(index, 1)
}

async function runOcr() {
  const first = images.value[0]
  if (!first) return
  const text = await recognize(first)
  if (text) form.value.stem = text
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    await store.addManual({ ...form.value, images: images.value })
    emit('saved')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  cancel()
  previewUrls.value.forEach(url => URL.revokeObjectURL(url))
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-title-md font-bold">拍照录入行测错题</h2>
        <p class="text-body-sm mt-1" style="color: rgb(var(--md-on-surface-variant))">原图会保存在手机本地；OCR 只是辅助填写。</p>
      </div>
      <button class="btn-icon" @click="emit('close')"><XMarkIcon class="w-5 h-5" /></button>
    </div>

    <input ref="cameraInput" class="hidden" type="file" accept="image/*" capture="environment" multiple @change="onFiles" />
    <input ref="galleryInput" class="hidden" type="file" accept="image/*" multiple @change="onFiles" />
    <div class="grid grid-cols-2 gap-3">
      <button class="btn-tonal" @click="cameraInput?.click()"><CameraIcon class="w-5 h-5" />拍照</button>
      <button class="btn-tonal" @click="galleryInput?.click()"><PhotoIcon class="w-5 h-5" />选图片</button>
    </div>
    <div v-if="previewUrls.length" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <button v-for="(url, index) in previewUrls" :key="url" class="relative rounded-xl overflow-hidden bg-white aspect-[4/3]" title="点击删除" @click="removeImage(index)">
        <img :src="url" class="w-full h-full object-contain" />
        <span class="absolute right-1 top-1 rounded-full px-2 py-0.5 text-xs bg-black/70 text-white">删除</span>
      </button>
    </div>
    <button v-if="images.length" class="btn-outlined w-full" :disabled="recognizing" @click="runOcr">
      <SparklesIcon class="w-4 h-4" />{{ recognizing ? '正在识别…' : '用第一张图片识别题干' }}
    </button>
    <p v-if="ocrError" class="text-sm" style="color: rgb(var(--md-error))">OCR 未完成：{{ ocrError }}</p>

    <label class="block text-sm font-semibold">标题<input v-model="form.title" class="input-outlined w-full mt-1" placeholder="例如：资料分析 Q11｜主体看错" /></label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block text-sm font-semibold">模块
        <select v-model="form.subject" class="input-outlined w-full mt-1">
          <option>言语理解</option><option>判断推理</option><option>资料分析</option><option>数量关系</option><option>政治理论</option><option>常识判断</option>
        </select>
      </label>
      <label class="block text-sm font-semibold">题型<input v-model="form.section" class="input-outlined w-full mt-1" placeholder="如：片段阅读" /></label>
    </div>
    <label class="block text-sm font-semibold">题干<textarea v-model="form.stem" rows="4" class="input-outlined w-full mt-1 resize-y" /></label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block text-sm font-semibold">我的答案<input v-model="form.userAnswer" class="input-outlined w-full mt-1" /></label>
      <label class="block text-sm font-semibold">正确答案<input v-model="form.answer" class="input-outlined w-full mt-1" /></label>
    </div>
    <label class="block text-sm font-semibold">参考解析<textarea v-model="form.analysis" rows="3" class="input-outlined w-full mt-1 resize-y" /></label>
    <label class="block text-sm font-semibold">错因
      <select v-model="form.cause" class="input-outlined w-full mt-1"><option v-for="cause in WRONG_CAUSES" :key="cause">{{ cause }}</option></select>
    </label>
    <label v-if="form.cause === '自定义'" class="block text-sm font-semibold">自定义错因<input v-model="form.customCause" class="input-outlined w-full mt-1" /></label>
    <label class="block text-sm font-semibold">我的复盘<textarea v-model="form.notes" rows="3" class="input-outlined w-full mt-1 resize-y" /></label>
    <p v-if="error" class="text-sm" style="color: rgb(var(--md-error))">{{ error }}</p>
    <button class="btn-filled w-full !h-12" :disabled="!canSave || saving" @click="save">{{ saving ? '保存中…' : '保存到错题本' }}</button>
  </div>
</template>
