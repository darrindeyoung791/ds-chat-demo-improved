import clsx from 'clsx'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useOverlayBack } from '../../app/overlayHistory.js'
import { useTranslate } from '../../i18n/index.js'
import {
  collectHistoryIndex,
  searchHistory,
  type HistoryIndex,
  type HistorySearchHit,
} from '../../services/chat/search.js'
import { selectSession } from '../../services/chat/store.js'
import { useSettings } from '../../services/settings.js'
import {
  IconChatOutline16,
  IconCloseOutline16,
  IconSearchOutline16,
  IconUserOutline16,
} from '../base/icons.js'
import { IconButton } from '../base/IconButton.js'
import { closeMobileSider } from '../sider/mobileSiderState.js'
import { closeHistorySearch, useHistorySearch } from './historySearchState.js'
import styles from './HistorySearch.module.css'

/** 历史对话搜索：Ctrl+K 打开，输入停顿后检索全部会话的提问与回答 */
export const HistorySearch = () => {
  const open = useHistorySearch((state) => state.open)
  useOverlayBack(open, closeHistorySearch)
  return open ? <HistorySearchPanel /> : null
}

/** 输入停顿后刷新结果，避免逐字输入时列表不停跳动（与官方默认的 200ms 同量级） */
const SEARCH_DEBOUNCE_MS = 250

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 高亮关键词：按捕获组拆分文本，奇数位即命中片段 */
const Highlight = ({ text, query }: { text: string; query: string }) => {
  const parts = useMemo(() => {
    if (!query) {
      return [text]
    }
    return text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
  }, [text, query])
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className={styles.match}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

const HistorySearchPanel = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const [index, setIndex] = useState<HistoryIndex | null>(null)
  /** 输入框里的实时内容 */
  const [value, setValue] = useState('')
  /** 停顿后真正用于搜索的关键词；每次刷新都整体替换结果，不在旧结果上追加 */
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const composingRef = useRef(false)

  // 打开时读取一次全部会话，构建本地索引
  useEffect(() => {
    let cancelled = false
    collectHistoryIndex()
      .then((next) => {
        if (!cancelled) {
          setIndex(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIndex({ messages: [] })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    return () => clearTimeout(timerRef.current)
  }, [])

  const results = useMemo(() => (index ? searchHistory(index, query) : []), [index, query])
  /** 输入已改变、还没到停顿：这时只显示搜索中，不混用上一轮结果 */
  const pending = value.trim() !== query

  // 结果刷新后回到第一条（列表以 query 为 key，滚动位置也会重置）
  useLayoutEffect(() => {
    setActive(0)
    if (listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [query])

  // 方向键移动选中项时保持在可视区域
  useEffect(() => {
    if (active === 0) {
      return
    }
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale]
  )
  const fullDateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [locale]
  )
  const thisYear = new Date().getFullYear()
  const formatDate = (time: number) => {
    const date = new Date(time)
    return (date.getFullYear() === thisYear ? dateFormat : fullDateFormat).format(date)
  }

  const openHit = (hit: HistorySearchHit) => {
    selectSession(hit.sessionId)
    closeMobileSider()
    closeHistorySearch()
  }

  /** 输入变化后安排一次搜索：清空立即生效，其余等停顿 */
  const scheduleSearch = (text: string) => {
    clearTimeout(timerRef.current)
    const keyword = text.trim()
    if (!keyword) {
      setQuery('')
      return
    }
    timerRef.current = setTimeout(() => {
      if (composingRef.current) {
        return
      }
      setQuery(keyword)
    }, SEARCH_DEBOUNCE_MS)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Ctrl / ⌘ 组合交给全局快捷键（切换会话、开关设置），浮层只处理单独按键
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey) {
      return
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      closeHistorySearch()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (results.length === 0) {
        return
      }
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + delta + results.length) % results.length)
      return
    }
    if (event.key === 'Enter') {
      // 停顿未到就回车：立即用当前输入搜索，直接打开第一条
      const keyword = value.trim()
      if (keyword !== query) {
        clearTimeout(timerRef.current)
        const immediate = index && keyword ? searchHistory(index, keyword) : []
        setQuery(keyword)
        const first = immediate[0]
        if (first) {
          event.preventDefault()
          openHit(first)
        }
        return
      }
      const hit = results[active] ?? results[0]
      if (hit) {
        event.preventDefault()
        openHit(hit)
      }
    }
  }

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => event.target === event.currentTarget && closeHistorySearch()}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('historySearchTitle')}
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          <span className={styles.searchIcon}>
            <IconSearchOutline16 />
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            value={value}
            placeholder={t('historySearchPlaceholder')}
            aria-label={t('historySearchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              const text = event.target.value
              setValue(text)
              // 优先用事件自带的 isComposing：即使浏览器漏发 compositionend，
              // 之后的普通输入也会恢复搜索，不会一直卡在「组词中」
              const native = event.nativeEvent as InputEvent
              const composing =
                typeof native.isComposing === 'boolean' ? native.isComposing : composingRef.current
              composingRef.current = composing
              if (!composing) {
                scheduleSearch(text)
              }
            }}
            onCompositionStart={() => {
              composingRef.current = true
              clearTimeout(timerRef.current)
            }}
            onCompositionEnd={(event) => {
              composingRef.current = false
              const text = event.currentTarget.value
              setValue(text)
              scheduleSearch(text)
            }}
            onBlur={() => {
              // 组词中失焦时可能收不到 compositionend，避免状态停在组词中
              composingRef.current = false
            }}
          />
          <IconButton
            icon={<IconCloseOutline16 />}
            aria-label={t('close')}
            onClick={closeHistorySearch}
          />
        </div>
        <div
          key={query}
          ref={listRef}
          className={styles.list}
          role="listbox"
          aria-label={t('historySearchTitle')}
        >
          {index === null ? (
            <div className={styles.empty}>{t('historySearchLoading')}</div>
          ) : pending ? (
            <div className={styles.empty}>{t('historySearchSearching')}</div>
          ) : query === '' ? (
            <div className={styles.empty}>
              {index.messages.length === 0
                ? t('historySearchNoSessions')
                : t('historySearchHint')}
            </div>
          ) : results.length === 0 ? (
            <div className={styles.empty}>{t('historySearchEmpty')}</div>
          ) : (
            results.map((hit, position) => (
              <button
                key={hit.key}
                type="button"
                role="option"
                aria-selected={position === active}
                data-active={position === active}
                className={clsx(styles.item, position === active && styles.itemActive)}
                onMouseMove={() => setActive(position)}
                onClick={() => openHit(hit)}
              >
                <span className={styles.itemIcon}>
                  {hit.role === 'assistant' ? <IconChatOutline16 /> : <IconUserOutline16 />}
                </span>
                <span className={styles.itemMain}>
                  <span className={styles.itemTop}>
                    <span className={styles.itemTitle}>
                      <Highlight text={hit.title || t('untitledChat')} query={query} />
                    </span>
                    <span className={styles.itemDate}>{formatDate(hit.createdAt)}</span>
                  </span>
                  <span className={styles.itemSnippet}>
                    <Highlight text={hit.snippet} query={query} />
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
