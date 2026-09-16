// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseWrongBookHtml, parseWrongBookTitle } from './docxImporter'

const NOW = Date.UTC(2026, 8, 16, 12)

describe('parseWrongBookTitle', () => {
  it('accepts full-width separators and maps the user title format', () => {
    expect(parseWrongBookTitle('002｜2026-09-12｜片段 Q9｜高频主题词“精准”漏抓')).toEqual({
      sequence: '002',
      examDate: '2026-09-12',
      moduleText: '片段 Q9',
      subject: '言语理解',
      section: '片段阅读',
      originalQuestionNo: 'Q9',
      errorTitle: '高频主题词“精准”漏抓',
      needsConfirmation: false,
    })
  })

  it('accepts ASCII separators and flags unknown modules', () => {
    const title = parseWrongBookTitle('3 | 2026-09-10 | 未知模块 18 | 复盘标题')
    expect(title?.subject).toBe('未知模块')
    expect(title?.originalQuestionNo).toBe('18')
    expect(title?.needsConfirmation).toBe(true)
  })
})

describe('parseWrongBookHtml', () => {
  it('splits entries by title and preserves text-image order', () => {
    const image = { id: 'asset-1', mimeType: 'image/png', blob: new Blob(['png'], { type: 'image/png' }) }
    const html = `
      <p>目录</p>
      <h2>002｜2026-09-12｜片段 Q9｜高频主题词漏抓</h2>
      <p>题干文字</p>
      <p><img src="wrongbook-asset:asset-1" /></p>
      <p>我的答案 A，正确答案 B</p>
      <p>返回目录</p>
      <h2>003 | 2026-09-13 | 资料分析 Q11 | 减法计算错误</h2>
      <p>13.89 - 31.2 的计算过程。</p>
    `

    const preview = parseWrongBookHtml(html, new Map([['wrongbook-asset:asset-1', image]]), NOW, (() => {
      let n = 0
      return () => `entry-${++n}`
    })())

    expect(preview.entries).toHaveLength(2)
    expect(preview.entries[0]).toMatchObject({
      id: 'entry-1', subject: '言语理解', section: '片段阅读', cause: '审题关键词漏读', assetIds: ['asset-1'],
    })
    expect(preview.entries[0]!.blocks).toEqual([
      { kind: 'text', text: '题干文字' },
      { kind: 'image', assetId: 'asset-1', alt: '' },
      { kind: 'text', text: '我的答案 A，正确答案 B' },
    ])
    expect(preview.entries[1]).toMatchObject({ subject: '资料分析', cause: '计算错误' })
    expect(preview.assets).toHaveLength(1)
    expect(preview.ignoredCount).toBe(2)
  })

  it('returns a warning instead of silently dropping a document with no valid title', () => {
    const preview = parseWrongBookHtml('<p>只有普通文字</p><p><img src="missing" /></p>', new Map(), NOW)

    expect(preview.entries).toEqual([])
    expect(preview.ignoredCount).toBe(2)
    expect(preview.warnings.join('')).toContain('未识别到')
  })
})
