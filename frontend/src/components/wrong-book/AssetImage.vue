<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useWrongBookStore } from '@/stores/wrongBook'

const props = defineProps<{ assetId: string; alt?: string }>()
const store = useWrongBookStore()
const url = ref('')
const failed = ref(false)

async function load() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
  failed.value = false
  const asset = await store.getAsset(props.assetId)
  if (!asset) {
    failed.value = true
    return
  }
  url.value = URL.createObjectURL(asset.blob)
}

onMounted(load)
watch(() => props.assetId, load)
onBeforeUnmount(() => {
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>

<template>
  <img v-if="url" :src="url" :alt="alt || '错题原图'" class="w-full max-h-[32rem] object-contain rounded-xl bg-white" />
  <div v-else-if="failed" class="rounded-xl p-4 text-sm text-center" style="background: rgb(var(--md-error-container)); color: rgb(var(--md-on-error-container))">
    图片未找到，请从原 Word 或备份恢复。
  </div>
  <div v-else class="h-28 rounded-xl animate-pulse" style="background: rgb(var(--md-surface-container-high))" />
</template>
