import clsx from 'clsx'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOverlayBack } from '../../app/overlayHistory.js'
import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16 } from './icons.js'
import { IconButton } from './IconButton.js'
import styles from './Modal.module.css'

/** 当前打开的弹窗，后打开的在末尾；叠放时 Esc 只关闭最上层 */
const openModals: object[] = []

/** 是否有弹窗打开：全局快捷键据此让行，避免在弹窗之上再开新界面 */
export const isModalOpen = () => openModals.length > 0

/** 遮罩 + 居中卡片，Esc / 点遮罩关闭 */
export const Modal = ({
  title,
  children,
  footer,
  closable = false,
  className,
  mainClassName,
  onClose,
  onShortcut,
}: {
  title: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** 标题栏右侧显示关闭按钮 */
  closable?: boolean
  className?: string
  /** 内容区的 class */
  mainClassName?: string
  /** 返回 false 表示暂时拒绝关闭（例如正在删除），移动端返回键会保留该弹窗 */
  onClose: () => unknown
  /**
   * 仅在作为最上层弹窗时收到的按键（Esc 除外）：供弹窗内部实现快捷键，
   * 叠了确认弹窗时不会触发。
   */
  onShortcut?: (event: KeyboardEvent) => void
}) => {
  const t = useTranslate()
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onShortcutRef = useRef(onShortcut)
  onShortcutRef.current = onShortcut
  // 弹窗按挂载顺序入栈，返回键先关闭最后打开的确认框，再关闭设置等底层弹窗。
  useOverlayBack(true, onClose)
  useEffect(() => {
    const token = {}
    openModals.push(token)
    const onKeyDown = (event: KeyboardEvent) => {
      if (openModals.at(-1) !== token) {
        return
      }
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      onShortcutRef.current?.(event)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      openModals.splice(openModals.indexOf(token), 1)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className={clsx(styles.content, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.header}>
          <div id={titleId} className={styles.title}>
            {title}
          </div>
          {closable ? (
            <IconButton
              className={styles.close}
              tone="primary"
              icon={<IconCloseOutline16 />}
              aria-label={t('close')}
              onClick={onClose}
            />
          ) : null}
        </div>
        {children ? <div className={clsx(styles.main, mainClassName)}>{children}</div> : null}
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}
