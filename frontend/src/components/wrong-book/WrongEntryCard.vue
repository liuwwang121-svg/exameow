<script setup lang="ts">
import { ref } from 'vue'
import { SparklesIcon, TrashIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import type { WrongBookEntry } from '@/features/wrong-book/model'
import { WRONG_CAUSES, type WrongCause } from '@/features/wrong-book/model'
import AssetImage from './AssetImage.vue'

defineProps<{ entry: WrongBookEntry; aiConfigured: boolean; aiBusy?: boolean }>()
const emit = defineEmits<{ analyze: []; remove: []; updateCause: [cause: WrongCause]; updateCustomCause: [value: string] }>()
const expanded = ref(false)

function formatDue(value: number): string {
  if (value <= Date.now()) return '现在可复习'
  return `下次 ${new Date(value).toLocaleDateString('zh-CN')}`
}
</script>

<template>
  <article class="card-filled p-4 sm:p-5">
    <button class="w-full text-left" @click="expanded = !expanded">
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap gap-2 mb-2">
            <span class="px-2 py-1 rounded-full text-xs font-semibold" style="background: rgb(var(--md-secondary-container)); color: rgb(var(--md-on-secondary-container))">{{ entry.subject }}</span>
            <span v-if="entry.section" class="px-2 py-1 rounded-full text-xs" style="background: rgb(var(--md-surface-container-highest))">{{ entry.section }}</span>
            <span v-if="entry.needsConfirmation" class="px-2 py-1 rounded-full text-xs" style="background: rgb(var(--md-tertiary-container)); color: rgb(var(--md-on-tertiary-container))">待确认</span>
          </div>
          <h3 class="text-title-sm font-bold break-words">{{ entry.title }}</h3>
          <p v-if="entry.stem" class="text-body-sm mt-2 line-clamp-2" style="color: rgb(var(--md-on-surface-variant))">{{ entry.stem }}</p>
          <div class="text-xs mt-2" style="color: rgb(var(--md-on-surface-muted))">错 {{ entry.wrongCount }} 次 · {{ entry.cause === '自定义' ? (entry.customCause || '待补充错因') : entry.cause }} · {{ formatDue(entry.review.due) }}</div>
        </div>
        <ChevronDownIcon class="w-5 h-5 shrink-0 transition-transform" :class="expanded ? 'rotate-180' : ''" />
      </div>
    </button>

    <div v-if="expanded" class="mt-4 pt-4 space-y-4" style="border-top: 1px solid rgb(var(--md-outline-variant))">
      <template v-for="(block, index) in entry.blocks" :key="index">
        <p v-if="block.kind === 'text'" class="whitespace-pre-wrap text-body-md">{{ block.text }}</p>
        <AssetImage v-else :asset-id="block.assetId" :alt="block.alt" />
      </template>
      <div v-if="entry.userAnswer" class="rounded-xl p-3" style="background: rgb(var(--md-error-container)); color: rgb(var(--md-on-error-container))"><b>我的答案：</b>{{ entry.userAnswer }}</div>
      <div v-if="entry.answer" class="rounded-xl p-3" style="background: rgb(var(--md-primary-container)); color: rgb(var(--md-on-primary-container))"><b>正确答案：</b>{{ entry.answer }}</div>
      <div v-if="entry.analysis" class="whitespace-pre-wrap"><b>参考解析：</b>{{ entry.analysis }}</div>
      <div v-if="entry.notes" class="whitespace-pre-wrap"><b>我的复盘：</b>{{ entry.notes }}</div>
      <div v-if="entry.aiAnalysis" class="rounded-xl p-3 whitespace-pre-wrap" style="background: rgb(var(--md-tertiary-container)); color: rgb(var(--md-on-tertiary-container))"><b>AI 解析：</b>\n{{ entry.aiAnalysis }}</div>
      <div v-if="entry.aiSuggestedCause" class="rounded-xl p-3 flex items-center justify-between gap-3" style="background: rgb(var(--md-tertiary-container)); color: rgb(var(--md-on-tertiary-container))">
        <span class="text-sm"><b>AI 建议错因：</b>{{ entry.aiSuggestedCause }}</span>
        <button class="btn-text shrink-0" @click="emit('updateCause', entry.aiSuggestedCause)">采用建议</button>
      </div>
      <label class="block text-sm font-semibold">我的错因
        <select class="input-outlined w-full mt-1" :value="entry.cause" @change="emit('updateCause', ($event.target as HTMLSelectElement).value as WrongCause)">
          <option v-for="cause in WRONG_CAUSES" :key="cause" :value="cause">{{ cause }}</option>
        </select>
      </label>
      <label v-if="entry.cause === '自定义'" class="block text-sm font-semibold">自定义错因
        <input class="input-outlined w-full mt-1" :value="entry.customCause || ''" placeholder="写下你自己的具体错因" @change="emit('updateCustomCause', ($event.target as HTMLInputElement).value)" />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-tonal" :disabled="!aiConfigured || aiBusy" @click="emit('analyze')"><SparklesIcon class="w-4 h-4" />{{ aiBusy ? '分析中…' : (aiConfigured ? 'AI 解析' : '先配置 AI') }}</button>
        <button class="btn-outlined" style="color: rgb(var(--md-error))" @click="emit('remove')"><TrashIcon class="w-4 h-4" />删除</button>
      </div>
    </div>
  </article>
</template>
