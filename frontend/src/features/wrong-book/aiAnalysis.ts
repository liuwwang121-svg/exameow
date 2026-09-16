import type { AIConfig, AnswerResult } from '@exameow/shared'
import { api } from '@/api'
import { WRONG_CAUSES, type WrongBookEntry, type WrongCause } from './model'

export interface AiWrongAnalysis {
  cause: WrongCause
  explanation: string
}

type AnswerRequester = (
  question: string,
  language: string,
  config: AIConfig,
  signal?: AbortSignal,
) => Promise<AnswerResult>

export function parseAiWrongAnalysis(answer: string, analysis: string): AiWrongAnalysis {
  const combined = `${answer}\n${analysis}`
  const cause = WRONG_CAUSES.find(label => label !== '自定义' && combined.includes(label)) ?? '自定义'
  return { cause, explanation: analysis.trim() || answer.trim() }
}

function buildPrompt(entry: WrongBookEntry): string {
  const choices = entry.options.length
    ? `\n选项：\n${entry.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n')}`
    : ''
  return `这不是让你重新出题，而是分析一名公务员考试考生为什么做错。请从以下类别中只选最贴切的一类，并把类别原文写在 answer 字段：
知识不会/遗忘、方法错误、审题关键词漏读、主体/指标/口径错误、计算错误、选项理解错误、时间/跳题策略、执行粗心、自定义。
analysis 字段请用简洁中文给出：正确思路、具体错因和下次自检动作。

模块：${entry.subject} / ${entry.section}
题目：${entry.stem || entry.title}${choices}
学生答案：${entry.userAnswer || '未记录'}
参考答案：${entry.answer || '未记录'}
原解析：${entry.analysis || '无'}
用户复盘：${entry.notes || '无'}`
}

export async function analyzeWrongEntry(
  entry: WrongBookEntry,
  config: AIConfig,
  signal?: AbortSignal,
  requester: AnswerRequester = api.answerQuestion,
): Promise<AiWrongAnalysis> {
  const result = await requester(buildPrompt(entry), '简体中文', config, signal)
  return parseAiWrongAnalysis(result.answer, result.analysis)
}
