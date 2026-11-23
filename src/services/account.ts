import { create } from 'zustand'
import { fetchBalance } from './api/client.js'
import { classifyApiError, type ApiErrorCondition } from './api/errors.js'
import type { UserBalance } from './api/types.js'
import { useSettings } from './settings.js'

/** 余额失败原因：no-key 表示还没有填写 API Key，其余按接口错误分类 */
export type BalanceError = 'no-key' | ApiErrorCondition

type BalanceState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: UserBalance | null
  error: BalanceError | null
  updatedAt: number | null
  /** data 对应的 API Key：切换 Key 后旧余额不能继续展示 */
  apiKey: string | null
}

/** 余额只保存在内存中，不写入 localStorage / IndexedDB，也不进入历史归档 */
export const useBalance = create<BalanceState>(() => ({
  status: 'idle',
  data: null,
  error: null,
  updatedAt: null,
  apiKey: null,
}))

let controller: AbortController | null = null
let sequence = 0

/**
 * 查询当前 API Key 的账户余额。并发调用只保留最后一次结果；
 * 未填写 Key 时不发请求，直接进入 no-key 状态。
 */
export const refreshBalance = async (): Promise<void> => {
  const apiKey = useSettings.getState().apiKey
  sequence += 1
  const id = sequence
  controller?.abort()
  if (!apiKey) {
    controller = null
    useBalance.setState({
      status: 'error',
      data: null,
      error: 'no-key',
      updatedAt: null,
      apiKey: null,
    })
    return
  }
  const next = new AbortController()
  controller = next
  // 换 Key 时先清掉旧余额，避免刷新期间展示上一个账户的数据。
  const switched = useBalance.getState().apiKey !== apiKey
  useBalance.setState({
    status: 'loading',
    error: null,
    ...(switched ? { data: null, updatedAt: null } : {}),
    apiKey,
  })
  try {
    const data = await fetchBalance(apiKey, next.signal)
    if (id === sequence) {
      useBalance.setState({ status: 'ready', data, error: null, updatedAt: Date.now() })
    }
  } catch (error) {
    // 被新的刷新或 API Key 变更取消时，交给最后一次请求收尾。
    if (id !== sequence || next.signal.aborted) {
      return
    }
    useBalance.setState({ status: 'error', error: classifyApiError(error) })
  } finally {
    if (controller === next) {
      controller = null
    }
  }
}
