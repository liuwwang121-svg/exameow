<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CameraIcon, DocumentArrowUpIcon, ArchiveBoxArrowDownIcon, MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline'
import { useWrongBookStore } from '@/stores/wrongBook'
import { useConfigStore } from '@/stores/config'
import ManualEntryDialog from '@/components/wrong-book/ManualEntryDialog.vue'
import DocxImportDialog from '@/components/wrong-book/DocxImportDialog.vue'
import BackupRestorePanel from '@/components/wrong-book/BackupRestorePanel.vue'
import ReviewPanel from '@/components/wrong-book/ReviewPanel.vue'
import WrongEntryCard from '@/components/wrong-book/WrongEntryCard.vue'
import type { WrongCause } from '@/features/wrong-book/model'

const router = useRouter()
const store = useWrongBookStore()
const configStore = useConfigStore()
const tab = ref<'due' | 'all'>('due')
const query = ref('')
const subject = ref('全部模块')
const dialog = ref<'manual' | 'docx' | 'backup' | null>(null)
const aiBusyId = ref('')
const toast = ref('')

const subjects = computed(() => ['全部模块', ...new Set(store.entries.map(entry => entry.subject).filter(Boolean))])
const filteredEntries = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return store.entries.filter(entry => {
    if (subject.value !== '全部模块' && entry.subject !== subject.value) return false
    if (!keyword) return true
    return [entry.title, entry.stem, entry.notes, entry.cause, entry.section].join('\n').toLowerCase().includes(keyword)
  })
})

function notify(message: string) {
  toast.value = message
  setTimeout(() => { if (toast.value === message) toast.value = '' }, 2600)
}

async function analyze(id: string) {
  if (!configStore.configured) {
    await router.push('/mine/config')
    return
  }
  aiBusyId.value = id
  try {
    await store.runAiAnalysis(id, configStore.getConfig())
    notify('AI 解析已保存，你仍可按自己的判断修改错因。')
  } catch (cause) {
    notify(`AI 解析失败：${cause instanceof Error ? cause.message : String(cause)}`)
  } finally {
    aiBusyId.value = ''
  }
}

async function remove(id: string) {
  if (!window.confirm('确定删除这条错题及其本地图片吗？')) return
  await store.removeEntry(id)
  notify('已删除')
}

async function updateCause(id: string, cause: WrongCause) {
  await store.updateEntry(id, { cause })
  notify('错因已更新')
}

async function updateCustomCause(id: string, customCause: string) {
  await store.updateEntry(id, { cause: '自定义', customCause })
  notify('自定义错因已更新')
}

onMounted(() => store.initialize())
</script>

<template>
  <div class="max-w-4xl mx-auto pb-6">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        <h1 class="text-display-sm font-bold">行测错题本</h1>
        <p class="text-body-md mt-1" style="color: rgb(var(--md-on-surface-variant))">本地保存 · 到期复习 · Word 批量导入</p>
      </div>
      <div class="text-sm font-semibold" style="color: rgb(var(--md-primary))">共 {{ store.entries.length }} 题 · 今日 {{ store.dueCount }} 题</div>
    </div>

    <div v-if="!configStore.configured" class="rounded-2xl p-3 mb-4 flex items-center justify-between gap-3" style="background: rgb(var(--md-tertiary-container)); color: rgb(var(--md-on-tertiary-container))">
      <span class="text-sm">AI 是可选项；不配置也能导入、保存和复习。需要单题解析时再配置。</span>
      <button class="btn-text shrink-0" @click="router.push('/mine/config')">去配置</button>
    </div>

    <div class="grid grid-cols-3 gap-2 mb-4">
      <button class="btn-tonal !px-2" @click="dialog = 'manual'"><CameraIcon class="w-4 h-4" />拍照录题</button>
      <button class="btn-tonal !px-2" @click="dialog = 'docx'"><DocumentArrowUpIcon class="w-4 h-4" />导入 Word</button>
      <button class="btn-tonal !px-2" @click="dialog = 'backup'"><ArchiveBoxArrowDownIcon class="w-4 h-4" />备份</button>
    </div>

    <div class="inline-flex p-1 rounded-full mb-4" style="background: rgb(var(--md-surface-container-high))">
      <button class="px-5 py-2 rounded-full text-sm font-semibold" :style="tab === 'due' ? { background: 'rgb(var(--md-secondary-container))' } : {}" @click="tab = 'due'">今日复习 {{ store.dueCount }}</button>
      <button class="px-5 py-2 rounded-full text-sm font-semibold" :style="tab === 'all' ? { background: 'rgb(var(--md-secondary-container))' } : {}" @click="tab = 'all'">全部错题</button>
    </div>

    <ReviewPanel v-if="tab === 'due'" />

    <template v-else>
      <div class="grid sm:grid-cols-[1fr_12rem] gap-3 mb-4">
        <label class="relative block">
          <MagnifyingGlassIcon class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style="color: rgb(var(--md-on-surface-muted))" />
          <input v-model="query" class="input-outlined w-full !pl-10" placeholder="搜索标题、题干、错因" />
        </label>
        <select v-model="subject" class="input-outlined w-full"><option v-for="item in subjects" :key="item">{{ item }}</option></select>
      </div>
      <div v-if="filteredEntries.length" class="space-y-3">
        <WrongEntryCard
          v-for="entry in filteredEntries" :key="entry.id" :entry="entry"
          :ai-configured="configStore.configured" :ai-busy="aiBusyId === entry.id"
          @analyze="analyze(entry.id)" @remove="remove(entry.id)" @update-cause="cause => updateCause(entry.id, cause)" @update-custom-cause="value => updateCustomCause(entry.id, value)"
        />
      </div>
      <div v-else class="card-filled p-8 text-center">
        <p class="text-title-sm font-bold">还没有符合条件的错题</p>
        <p class="text-body-sm mt-2" style="color: rgb(var(--md-on-surface-variant))">可以从现有题库做题、拍照录入，或导入历史 Word。</p>
      </div>
    </template>

    <Transition name="scale">
      <div v-if="dialog" class="scrim flex items-center justify-center p-3" @click.self="dialog = null">
        <div class="card-elevated w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <ManualEntryDialog v-if="dialog === 'manual'" @close="dialog = null" @saved="dialog = null; notify('错题已保存')" />
          <DocxImportDialog v-else-if="dialog === 'docx'" @close="dialog = null" @imported="count => { dialog = null; notify(`已导入 ${count} 条错题`) }" />
          <BackupRestorePanel v-else @close="dialog = null" />
        </div>
      </div>
    </Transition>

    <Transition name="scale"><div v-if="toast" class="fixed z-50 left-1/2 -translate-x-1/2 bottom-[calc(84px+env(safe-area-inset-bottom))] sm:bottom-6 rounded-full px-4 py-2 text-sm shadow-lg max-w-[90vw] text-center" style="background: rgb(var(--md-inverse-surface)); color: rgb(var(--md-inverse-on-surface))">{{ toast }}</div></Transition>
  </div>
</template>
