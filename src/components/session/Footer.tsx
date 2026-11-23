import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { REPO_URL } from '../../services/links.js'
import styles from './Footer.module.css'

/**
 * 页脚：声明本项目不是 DeepSeek 官方项目，并给出仓库地址。
 * compact 用于聊天页输入框下方，只保留一句短声明；leading 用于在声明前插入会话状态。
 */
export const Footer = ({
  compact = false,
  className,
  leading,
}: {
  compact?: boolean
  className?: string
  leading?: ReactNode
}) => {
  const t = useTranslate()
  return (
    <footer className={clsx(styles.footer, compact && styles.compact, className)}>
      {leading ? (
        <>
          {leading}
          <span aria-hidden="true" className={styles.separator}>
            ·
          </span>
        </>
      ) : null}
      <span>{t(compact ? 'footerCompactDisclaimer' : 'footerDisclaimer')}</span>
      <span aria-hidden="true" className={styles.separator}>
        ·
      </span>
      <a className={styles.link} href={REPO_URL} target="_blank" rel="noreferrer">
        {t('footerRepoLink')}
      </a>
    </footer>
  )
}
