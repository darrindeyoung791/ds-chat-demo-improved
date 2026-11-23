import { useEffect, useRef } from 'react'

/**
 * 移动端返回键 / 浏览器返回键关闭最上层浮层。
 *
 * 每个浮层各压入一条同 URL 历史记录，返回键弹出最上层记录并关闭对应浮层；
 * 用户通过按钮、遮罩或手势关闭时，再回收该浮层的记录。
 *
 * 这里刻意不使用「所有浮层共用一条记录、返回时在 popstate 里重新 pushState」的做法：
 * 那种做法依赖在 popstate 中补回记录，而部分 Android Chrome 会把没有用户手势的
 * pushState 当作历史干预并跳过，导致关掉上层浮层后再返回直接离开页面。
 */

type Layer = {
  token: number
  /** 返回 false 表示浮层拒绝关闭（例如正在删除），此时需要把记录补回来 */
  close: () => unknown
}

const layers: Layer[] = []
/** 我们压入且尚未弹出的历史记录 token，按压入顺序；最后一个是当前记录 */
const entries: number[] = []
let nextToken = 1
/** 由我们主动 history.go() 触发、需要忽略的 popstate 数 */
let skipPops = 0
let syncScheduled = false

const pushEntry = (token: number) => {
  try {
    const current = history.state as unknown
    const state = typeof current === 'object' && current !== null ? current : {}
    history.pushState({ ...state, chatDemoOverlay: token }, '')
    entries.push(token)
  } catch {
    // Safari 会限制 pushState 的频率；失败时只是该浮层不能再用返回键关闭，
    // 按钮、遮罩等原有入口仍然可用。
  }
}

const sync = () => {
  // 一次只处理一个回退操作，等它的 popstate 到达后再处理剩余记录，
  // 避免连续 history.go() 相互竞争。
  if (skipPops > 0) {
    return
  }
  const extra = entries.length - layers.length
  if (extra <= 0) {
    return
  }
  // 记录是栈：只有栈顶那些已经关闭的浮层记录能直接弹出。
  // 如果上面还压着未关闭的浮层，先保留，等它们关闭后再统一清理。
  const openTokens = new Set(layers.map((layer) => layer.token))
  let removable = 0
  while (removable < extra) {
    const token = entries[entries.length - 1 - removable]
    if (token === undefined || openTokens.has(token)) {
      break
    }
    removable += 1
  }
  if (removable === 0) {
    return
  }
  entries.splice(entries.length - removable, removable)
  skipPops += 1
  try {
    history.go(-removable)
  } catch {
    // 无法回退时保留现状，不影响原有关闭方式。
  }
}

const scheduleSync = () => {
  if (syncScheduled) {
    return
  }
  syncScheduled = true
  // 等同一轮渲染里的多个浮层一起注销后再统一回退。
  queueMicrotask(() => {
    syncScheduled = false
    sync()
  })
}

const onPopState = () => {
  if (skipPops > 0) {
    // 我们在浮层关闭后主动回退产生的 popstate，不能再关一层。
    skipPops -= 1
    scheduleSync()
    return
  }
  const popped = entries.pop()
  if (popped === undefined) {
    // 没有我们的记录：用户本来就要离开页面。
    return
  }
  const layer = layers.at(-1)
  if (!layer || layer.token !== popped) {
    // 弹出的是之前关闭浮层留下的记录，不关闭当前浮层；顺便清理剩余残留。
    scheduleSync()
    return
  }
  if (layer.close() === false) {
    // 浮层拒绝关闭（例如正在删除）：把记录补回来，让下一次返回仍能关闭它。
    pushEntry(layer.token)
    return
  }
  const index = layers.indexOf(layer)
  if (index !== -1) {
    layers.splice(index, 1)
  }
  scheduleSync()
}

window.addEventListener('popstate', onPopState)

/**
 * 注册一个可以用返回键关闭的浮层。浮层打开时调用，返回注销函数。
 * 注册顺序即层叠顺序：后打开的在上面，返回时先关闭。
 */
export const registerOverlay = (close: () => unknown): (() => void) => {
  const layer: Layer = { token: nextToken++, close }
  layers.push(layer)
  pushEntry(layer.token)
  return () => {
    const index = layers.indexOf(layer)
    if (index === -1) {
      return
    }
    layers.splice(index, 1)
    scheduleSync()
  }
}

/** 组件里按 open 状态自动注册 / 注销；关闭回调始终使用最新一次渲染的函数。 */
export const useOverlayBack = (open: boolean, close: () => unknown) => {
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open) {
      return
    }
    return registerOverlay(() => closeRef.current())
  }, [open])
}
