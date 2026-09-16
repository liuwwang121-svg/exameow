import { describe, expect, it, vi } from 'vitest'
import { parseAiWrongAnalysis, analyzeWrongEntry } from './aiAnalysis'
import { createInitialReviewState } from './scheduler'
import type { AIConfig } from '@exameow/shared'
import type { WrongBookEntry } from './model'

const entry: WrongBookEntry = {
  id: '1', schemaVersion: 1, source: 'practice', title: '主体看错', recordedAt: 1,
  subject: '资料分析', section: '比重', stem: '求中西部总额', options: ['A', 'B'], answer: 'B', analysis: '',
  userAnswer: 'A', notes: '把民营额当成总额', aiAnalysis: '', cause: '自定义', blocks: [], assetIds: [],
  wrongCount: 1, needsConfirmation: false, review: createInitialReviewState(1), createdAt: 1, updatedAt: 1,
}
const config: AIConfig = { endpoint: 'https://example.com/v1', api_key: 'k', model: 'm' }

describe('AI wrong analysis', () => {
  it('accepts only a known cause label', () => {
    expect(parseAiWrongAnalysis('主体/指标/口径错误', '应先核对题目主体。')).toEqual({
      cause: '主体/指标/口径错误', explanation: '应先核对题目主体。',
    })
    expect(parseAiWrongAnalysis('模型随便发明的类别', '说明')).toEqual({ cause: '自定义', explanation: '说明' })
  })

  it('calls AI only for the selected entry and returns a user-editable suggestion', async () => {
    const requester = vi.fn().mockResolvedValue({
      answer: '建议错因：主体/指标/口径错误',
      analysis: '你把材料中的民营额误当成了总额。',
    })

    const result = await analyzeWrongEntry(entry, config, undefined, requester)

    expect(requester).toHaveBeenCalledOnce()
    expect(requester.mock.calls[0]![0]).toContain('学生答案：A')
    expect(result).toEqual({ cause: '主体/指标/口径错误', explanation: '你把材料中的民营额误当成了总额。' })
  })
})
