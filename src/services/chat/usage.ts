import type { MessageUsage } from '../api/types.js'
import { getVisibleMessages } from './branches.js'
import type { Session } from './types.js'

/** 当前分支的累计用量；thinking 是 output 的子集，不重复计入 total */
export type SessionUsageTotals = {
  /** 未命中缓存的输入 */
  input: number
  /** 命中缓存的输入 */
  cacheRead: number
  /** 缓存创建，DeepSeek 固定为 0 */
  cacheCreation: number
  /** 全部输入 = input + cacheRead + cacheCreation */
  inputTotal: number
  /** 输出，含思考与安全审核 token */
  output: number
  /** 思考 token，已包含在 output 中 */
  thinking: number
  /** 总用量 = inputTotal + output */
  total: number
}

const emptyUsage = (): SessionUsageTotals => ({
  input: 0,
  cacheRead: 0,
  cacheCreation: 0,
  inputTotal: 0,
  output: 0,
  thinking: 0,
  total: 0,
})

const addUsage = (usage: SessionUsageTotals, item: MessageUsage): SessionUsageTotals => {
  const input = usage.input + item.input_tokens
  const cacheRead = usage.cacheRead + item.cache_read_input_tokens
  const cacheCreation = usage.cacheCreation + item.cache_creation_input_tokens
  const output = usage.output + item.output_tokens
  const thinking = usage.thinking + (item.output_tokens_details?.thinking_tokens ?? 0)
  const inputTotal = input + cacheRead + cacheCreation
  return {
    input,
    cacheRead,
    cacheCreation,
    inputTotal,
    output,
    thinking,
    total: inputTotal + output,
  }
}

/**
 * 当前可见分支的累计用量：只统计路径上的助手消息。
 * 续写会用新一轮请求的 usage 覆盖原消息，重新生成的其他分支不计入，
 * 因此这是近似消耗而不是严格账单。导入的历史消息没有 usage，返回 null。
 */
export const getSessionUsage = (session: Session): SessionUsageTotals | null => {
  let usage = emptyUsage()
  let found = false
  for (const message of getVisibleMessages(session)) {
    if (message.role !== 'assistant' || !message.usage) {
      continue
    }
    usage = addUsage(usage, message.usage)
    found = true
  }
  return found ? usage : null
}
