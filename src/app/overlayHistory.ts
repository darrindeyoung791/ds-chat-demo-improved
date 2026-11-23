import { useEffect, useRef } from 'react'

/**
 * 移动端返回键 / 浏览器返回键关闭最上层浮层。
 *
 * 所有浮层共用一条同 URL 的历史记录：打开第一个浮层时压入，全部关闭后回退掉。
 * 用户按返回时浏览器会先弹出这条记录，我们关闭最上层浮层；如果还有剩余浮层，
 * 立刻补回一条记录，让下一次返回继续关闭下一层。这样最多只多出一条历史记录，
 * 避免 iOS Safari 对 pushState 的频率限制，也避免历史记录随开关次数累积。
 */

type Layer = {
  /** 返回 false 表示浮层拒绝关闭（例如正在删除），此时保留该层并补回记录 */
  close: () => unknown
}

const layers: Layer[] = []
/** 当前是否压入了我们的历史记录 */
let entryActive = false
/** 我们主动 history.back() 后等待 popstate 的次数 */
let pendingBacks = 0

const isOurState = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'chatDemoOverlay' in state

const pushEntry = () => {
  if (entryActive || pendingBacks > 0) {
    return
  }
  try {
    const current = history.state as unknown
    const state = typeof current === 'object' && current !== null ? current : {}
    history.pushState({ ...state, chatDemoOverlay: true }, '')
    entryActive = true
  } catch {
    // Safari 会限制 pushState 的调用频率。失败时只是不能再用返回键关闭浮层，
    // 点遮罩、关闭按钮等原有入口仍然可用。
  }
}

const removeEntry = () => {
  if (!entryActive) {
    return
  }
  entryActive = false
  // 刷新后 history.state 可能仍带标记但页面已经重置，只有标记还在时才回退。
  if (!isOurState(history.state)) {
    return
  }
  pendingBacks += 1
  history.back()
}

const onPopState = () => {
  if (pendingBacks > 0) {
    // 这是我们在浮层关闭后主动回退产生的 popstate，不能再关一层。
    pendingBacks -= 1
    entryActive = false
    if (layers.length > 0) {
      pushEntry()
    }
    return
  }
  // 用户按了返回：记录已经被浏览器弹出，关闭最上层浮层。
  entryActive = false
  const layer = layers.at(-1)
  if (!layer) {
    return
  }
  if (layer.close() === false) {
    // 浮层拒绝关闭（例如正在删除），补回记录，避免下一次返回直接离开页面。
    pushEntry()
    return
  }
  const index = layers.indexOf(layer)
  if (index !== -1) {
    layers.splice(index, 1)
  }
  if (layers.length > 0) {
    pushEntry()
  }
}

window.addEventListener('popstate', onPopState)

/**
 * 注册一个可以用返回键关闭的浮层。浮层打开时调用，返回注销函数。
 * 注册顺序即层叠顺序：后打开的在上面，返回时先关闭。
 */
export const registerOverlay = (close: () => unknown): (() => void) => {
  const layer: Layer = { close }
  layers.push(layer)
  pushEntry()
  return () => {
    const index = layers.indexOf(layer)
    if (index === -1) {
      return
    }
    layers.splice(index, 1)
    if (layers.length === 0) {
      removeEntry()
    }
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
