<script setup lang="ts">
import { computed, ref } from 'vue'
import { CheckCircleIcon } from '@heroicons/vue/24/outline'
import { useWrongBookStore } from '@/stores/wrongBook'
import AssetImage from './AssetImage.vue'
import type { ReviewRating } from '@/features/wrong-book/model'

const store = useWrongBookStore()
const revealed = ref(false)
const rating = ref<ReviewRating | null>(null)
const current = computed(() => store.dueEntries[0] ?? null)

async function rate(value: ReviewRating) {
  if (!current.value) return
  rating.value = value
  try {
    await store.rateEntry(current.value.id, value)
    revealed.value = false
  } finally {
    rating.value = null
  }
}
</script>

<template>
  <div v-if="current" class="card-filled p-4 sm:p-6 space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <span class="text-xs font-semibold" style="color: rgb(var(--md-primary))">今日还剩 {{ store.dueCount }} 题</span>
        <h2 class="text-title-md font-bold mt-1 break-words">{{ current.title }}</h2>
      </div>
      <span class="px-2 py-1 rounded-full text-xs shrink-0" style="background: rgb(var(--md-secondary-container))">{{ current.subject }}</span>
    </div>
    <template v-for="(block, index) in current.blocks" :key="index">
      <p v-if="block.kind === 'text'" class="whitespace-pre-wrap">{{ block.text }}</p>
      <AssetImage v-else :asset-id="block.assetId" :alt="block.alt" />
    </template>
    <p v-if="!current.blocks.length && current.stem" class="whitespace-pre-wrap">{{ current.stem }}</p>

    <button v-if="!revealed" class="btn-filled w-full !h-12" @click="revealed = true">显示答案与复盘</button>
    <template v-else>
      <div class="space-y-3 pt-3" style="border-top: 1px solid rgb(var(--md-outline-variant))">
        <div v-if="current.userAnswer" class="rounded-xl p-3" style="background: rgb(var(--md-error-container)); color: rgb(var(--md-on-error-container))"><b>我的答案：</b>{{ current.userAnswer }}</div>
        <div v-if="current.answer" class="rounded-xl p-3" style="background: rgb(var(--md-primary-container)); color: rgb(var(--md-on-primary-container))"><b>正确答案：</b>{{ current.answer }}</div>
        <p v-if="current.analysis" class="whitespace-pre-wrap"><b>解析：</b>{{ current.analysis }}</p>
        <p v-if="current.notes" class="whitespace-pre-wrap"><b>原复盘：</b>{{ current.notes }}</p>
        <p v-if="current.aiAnalysis" class="whitespace-pre-wrap"><b>AI 解析：</b>{{ current.aiAnalysis }}</p>
      </div>
      <p class="text-center text-sm font-semibold">这次掌握得怎么样？</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button class="btn-outlined !px-2" :disabled="rating !== null" @click="rate('again')">重来<br><span class="text-xs opacity-70">10分钟</span></button>
        <button class="btn-outlined !px-2" :disabled="rating !== null" @click="rate('hard')">困难<br><span class="text-xs opacity-70">较短</span></button>
        <button class="btn-tonal !px-2" :disabled="rating !== null" @click="rate('good')">一般<br><span class="text-xs opacity-70">正常</span></button>
        <button class="btn-filled !px-2" :disabled="rating !== null" @click="rate('easy')">简单<br><span class="text-xs opacity-70">较长</span></button>
      </div>
    </template>
  </div>
  <div v-else class="card-filled p-8 text-center">
    <CheckCircleIcon class="w-14 h-14 mx-auto mb-3" style="color: rgb(var(--md-primary))" />
    <h2 class="text-title-md font-bold">今天的到期错题已经复习完了</h2>
    <p class="text-body-sm mt-2" style="color: rgb(var(--md-on-surface-variant))">新的错题或下一批到期题会自动出现在这里。</p>
  </div>
</template>
