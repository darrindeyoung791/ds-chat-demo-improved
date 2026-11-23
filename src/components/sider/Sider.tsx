import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { useOverlayBack } from '../../app/overlayHistory.js'
import { useTranslate } from '../../i18n/index.js'
import {
  IconPanelLeftOutline16,
  IconSearchOutline16,
  IconSettingsOutline16,
  NewChatIcon,
} from '../base/icons.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import { newChat, removeSession, useChatStore } from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openHistorySearch } from '../historySearch/historySearchState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from './mobileSiderState.js'
import { useSessionNavigation } from './sessionNavigationState.js'
import { SessionItem } from './SessionItem.js'
import styles from './Sider.module.css'

/** 展开的侧边栏：名称、搜索与收起按钮、开启新对话、按时间分组的会话列表、底部设置；移动端放在抽屉里，收起按钮关闭抽屉 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const pendingId = useSessionNavigation((state) => state.pendingId)
  // 快捷键按住时只高亮待定会话，消息仍停留在原会话，松手后才切换
  const highlightId = pendingId ?? activeId
  const [now, setNow] = useState(Date.now)
  const groups = useMemo(() => groupSessions(sessions, now, t), [sessions, now, t])
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  /** 多选删除：选中任意会话后进入选择状态，工具栏替换「开启新对话」 */
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const selectionMode = selected.size > 0

  // 会话被删除或历史被替换后，去掉已不存在的选中项
  useEffect(() => {
    setSelected((previous) => {
      if (previous.size === 0) {
        return previous
      }
      const next = new Set(
        [...previous].filter((id) => sessions.some((session) => session.id === id))
      )
      return next.size === previous.size ? previous : next
    })
  }, [sessions])

  const toggleSelected = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  /** 逐个删除选中的会话；失败的保留提示，成功的随会话列表一起消失 */
  const confirmBulkDelete = async () => {
    setBulkPending(true)
    let failed = false
    for (const id of selected) {
      try {
        failed = !(await removeSession(id)) || failed
      } catch {
        failed = true
      }
    }
    setBulkPending(false)
    setBulkDeleting(false)
    setSelected(new Set())
    if (failed) {
      showToast({ key: 'sessionDeleteFailed', type: 'error' })
    }
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return (
    <div className={clsx(styles.sider, mobile && styles.mobile)}>
      <div className={styles.top}>
        <div className={styles.appName}>{t('appName')}</div>
        <div className={styles.topActions}>
          <IconButton
            size="m"
            icon={<IconSearchOutline16 />}
            tooltip={t('historySearchTitle')}
            tooltipPlacement="bottom"
            onClick={openHistorySearch}
          />
          <IconButton
            size="m"
            icon={<IconPanelLeftOutline16 />}
            tooltip={t('collapseSiderbarButton')}
            tooltipPlacement="bottom"
            onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
          />
        </div>
      </div>
      {selectionMode ? (
        <div className={styles.selectionBar}>
          <span className={styles.selectionCount}>
            {t('selectedSessions', { count: selected.size })}
          </span>
          <div className={styles.selectionActions}>
            <button
              type="button"
              className={styles.selectionCancel}
              onClick={() => setSelected(new Set())}
            >
              {t('cancel')}
            </button>
            <Button variant="danger" size="s" onClick={() => setBulkDeleting(true)}>
              {t('delete')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.newChat}
          onClick={() => {
            newChat()
            closeMobileSider()
          }}
        >
          <span className={styles.newChatIcon}>
            <NewChatIcon />
          </span>
          {t('newChat')}
        </button>
      )}
      <div className={styles.listWrap}>
        <div className={styles.list}>
          {groups.map((group) => (
            <div key={group.key} className={styles.section}>
              <div className={styles.sectionHeader}>{group.label}</div>
              {group.sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={session.id === highlightId}
                  selectionMode={selectionMode}
                  selected={selected.has(session.id)}
                  onToggleSelect={() => toggleSelected(session.id)}
                  onDelete={() => setDeleting(session)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.bottom}>
        <button type="button" className={styles.settings} onClick={() => openSettings('general')}>
          <span className={styles.settingsIcon}>
            <IconSettingsOutline16 />
          </span>
          <span className={styles.settingsLabel}>{t('settings')}</span>
        </button>
      </div>
      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (deletePending) {
              return false
            }
            setDeleting(null)
            return true
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
      {bulkDeleting ? (
        <Modal
          title={t('deleteSelectedSessionsModalTitle')}
          onClose={() => {
            if (bulkPending) {
              return false
            }
            setBulkDeleting(false)
            return true
          }}
          footer={
            <>
              <Button
                variant="outlined"
                disabled={bulkPending}
                onClick={() => setBulkDeleting(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={bulkPending}
                onClick={() => void confirmBulkDelete()}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSelectedSessionsDescription', { count: selected.size })}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：浮在页面上方，点空白区域关闭。 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  useOverlayBack(open, closeMobileSider)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
      <div className={styles.drawer}>
        <Sider mobile />
      </div>
    </>
  )
}
