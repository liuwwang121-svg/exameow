import {
  WRONG_BOOK_SCHEMA_VERSION,
  type DocxImportPreview,
  type PendingWrongBookAsset,
  type WrongBookBlock,
  type WrongBookEntry,
  type WrongCause,
} from './model'
import { createInitialReviewState } from './scheduler'

export interface ParsedWrongBookTitle {
  sequence: string
  examDate: string
  moduleText: string
  subject: string
  section: string
  originalQuestionNo?: string
  errorTitle: string
  needsConfirmation: boolean
}

const TITLE_RE = /^\s*(\d+)\s*[｜|]\s*(\d{4}-\d{2}-\d{2})\s*[｜|]\s*([^｜|]+?)\s*[｜|]\s*(.+?)\s*$/
const QUESTION_NO_RE = /(?:\bQ\s*\d+\b|第?\s*\d+\s*题?\b)/i

function classifyModule(moduleText: string): { subject: string; section: string; known: boolean } {
  const normalized = moduleText.replace(QUESTION_NO_RE, '').trim()
  const rules: Array<[RegExp, string, string]> = [
    [/片段|中心理解|主旨/, '言语理解', '片段阅读'],
    [/逻填|选词|成语/, '言语理解', '逻辑填空'],
    [/图推|图形/, '判断推理', '图形推理'],
    [/类比/, '判断推理', '类比推理'],
    [/定义/, '判断推理', '定义判断'],
    [/逻辑|翻译|真假|加强|削弱/, '判断推理', '逻辑判断'],
    [/科学/, '判断推理', '科学推理'],
    [/资料/, '资料分析', normalized || '资料分析'],
    [/数量|数学|工程|行程/, '数量关系', normalized || '数量关系'],
    [/政治|马原|中特/, '政治理论', normalized || '政治理论'],
    [/常识/, '常识判断', normalized || '常识判断'],
  ]
  const matched = rules.find(([pattern]) => pattern.test(normalized))
  return matched
    ? { subject: matched[1], section: matched[2], known: true }
    : { subject: normalized || moduleText.trim(), section: normalized, known: false }
}

function inferCause(title: string): WrongCause {
  if (/漏抓|漏读|关键词|审题/.test(title)) return '审题关键词漏读'
  if (/主体|指标|口径/.test(title)) return '主体/指标/口径错误'
  if (/计算|算错|估算/.test(title)) return '计算错误'
  if (/方法|公式|思路/.test(title)) return '方法错误'
  if (/选项|理解/.test(title)) return '选项理解错误'
  if (/时间|跳题|超时/.test(title)) return '时间/跳题策略'
  if (/粗心|抄错|看错/.test(title)) return '执行粗心'
  if (/不会|遗忘|忘记|知识/.test(title)) return '知识不会/遗忘'
  return '自定义'
}

export function parseWrongBookTitle(text: string): ParsedWrongBookTitle | null {
  const match = TITLE_RE.exec(text)
  if (!match) return null
  const [, sequence, examDate, moduleText, errorTitle] = match
  if (!sequence || !examDate || !moduleText || !errorTitle) return null
  const questionMatch = moduleText.match(QUESTION_NO_RE)?.[0]
  const classified = classifyModule(moduleText)
  return {
    sequence,
    examDate,
    moduleText: moduleText.trim(),
    subject: classified.subject,
    section: classified.section,
    originalQuestionNo: questionMatch?.replace(/\s+/g, '').replace(/^第/, '').replace(/题$/, ''),
    errorTitle: errorTitle.trim(),
    needsConfirmation: !classified.known,
  }
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

function blocksFromElement(element: Element, imageMap: Map<string, PendingWrongBookAsset>): { blocks: WrongBookBlock[]; assets: PendingWrongBookAsset[]; warnings: string[] } {
  const blocks: WrongBookBlock[] = []
  const assets: PendingWrongBookAsset[] = []
  const warnings: string[] = []
  let textBuffer = ''

  const flushText = () => {
    const text = normalizeText(textBuffer)
    if (text) blocks.push({ kind: 'text', text })
    textBuffer = ''
  }
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      textBuffer += node.textContent ?? ''
      return
    }
    if (!(node instanceof Element)) return
    if (node.tagName === 'IMG') {
      flushText()
      const src = node.getAttribute('src') ?? ''
      const asset = imageMap.get(src)
      if (asset) {
        blocks.push({ kind: 'image', assetId: asset.id, alt: node.getAttribute('alt') ?? '' })
        assets.push(asset)
      } else {
        warnings.push('发现一张无法读取的图片，条目已标记为待确认。')
      }
      return
    }
    for (const child of node.childNodes) walk(child)
  }

  walk(element)
  flushText()
  return { blocks, assets, warnings }
}

export function parseWrongBookHtml(
  html: string,
  imageMap: Map<string, PendingWrongBookAsset>,
  now = Date.now(),
  makeId: () => string = () => crypto.randomUUID(),
): DocxImportPreview {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const entries: WrongBookEntry[] = []
  const usedAssets = new Map<string, PendingWrongBookAsset>()
  const warnings: string[] = []
  let ignoredCount = 0
  let current: WrongBookEntry | null = null

  for (const element of Array.from(document.body.children)) {
    const text = normalizeText(element.textContent ?? '')
    const parsedTitle = parseWrongBookTitle(text)
    if (parsedTitle) {
      const recordedAt = Number.isFinite(Date.parse(`${parsedTitle.examDate}T00:00:00`))
        ? Date.parse(`${parsedTitle.examDate}T00:00:00`)
        : now
      current = {
        id: makeId(),
        schemaVersion: WRONG_BOOK_SCHEMA_VERSION,
        source: 'docx',
        title: `${parsedTitle.sequence}｜${parsedTitle.examDate}｜${parsedTitle.moduleText}｜${parsedTitle.errorTitle}`,
        recordedAt,
        examDate: parsedTitle.examDate,
        subject: parsedTitle.subject,
        section: parsedTitle.section,
        originalQuestionNo: parsedTitle.originalQuestionNo,
        stem: '',
        options: [],
        answer: '',
        analysis: '',
        userAnswer: '',
        notes: parsedTitle.errorTitle,
        aiAnalysis: '',
        cause: inferCause(parsedTitle.errorTitle),
        blocks: [],
        assetIds: [],
        wrongCount: 1,
        needsConfirmation: parsedTitle.needsConfirmation,
        review: createInitialReviewState(now),
        createdAt: now,
        updatedAt: now,
      }
      entries.push(current)
      continue
    }

    if (!current) {
      if (text || element.querySelector('img')) ignoredCount++
      continue
    }
    if (/^↩?\s*返回目录\s*$/.test(text)) {
      ignoredCount++
      continue
    }

    const extracted = blocksFromElement(element, imageMap)
    if (extracted.warnings.length) {
      current.needsConfirmation = true
      warnings.push(...extracted.warnings)
    }
    current.blocks.push(...extracted.blocks)
    for (const asset of extracted.assets) {
      if (!current.assetIds.includes(asset.id)) current.assetIds.push(asset.id)
      usedAssets.set(asset.id, asset)
    }
    if (!current.stem) {
      current.stem = extracted.blocks.find((block): block is Extract<WrongBookBlock, { kind: 'text' }> => block.kind === 'text')?.text ?? ''
    }
  }

  if (entries.length === 0) {
    warnings.push('未识别到符合“编号｜日期｜模块/题号｜错因标题”格式的错题标题。')
  }
  return { entries, assets: [...usedAssets.values()], ignoredCount, warnings }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

export async function importWrongBookDocx(arrayBuffer: ArrayBuffer, now = Date.now()): Promise<DocxImportPreview> {
  const mammoth = await import('mammoth')
  const images = new Map<string, PendingWrongBookAsset>()
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const id = crypto.randomUUID()
        const marker = `wrongbook-asset:${id}`
        const mimeType = image.contentType || 'application/octet-stream'
        const base64 = await image.read('base64')
        images.set(marker, { id, mimeType, blob: base64ToBlob(base64, mimeType) })
        return { src: marker }
      }),
    },
  )
  return parseWrongBookHtml(result.value, images, now)
}
