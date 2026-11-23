import { useMemo } from 'react'
import { useTranslate } from '../../i18n/index.js'
import type { SessionUsageTotals } from '../../services/chat/usage.js'
import { useSettings } from '../../services/settings.js'
import { Tooltip } from '../base/Tooltip.js'
import styles from './SessionUsage.module.css'

/**
 * 输入框下方页脚里的当前分支累计用量。
 * 明细只在桌面端悬停显示；移动端没有悬停，只展示总数。
 */
export const SessionUsage = ({ usage }: { usage: SessionUsageTotals }) => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const format = useMemo(() => new Intl.NumberFormat(locale).format, [locale])
  return (
    <Tooltip
      content={
        <div className={styles.detail}>
          <div>
            {t('sessionUsageInput', { tokens: format(usage.inputTotal) })}
            {usage.cacheRead > 0
              ? ` ${t('sessionUsageCached', { tokens: format(usage.cacheRead) })}`
              : ''}
          </div>
          <div>
            {t('sessionUsageOutput', { tokens: format(usage.output) })}
            {usage.thinking > 0
              ? ` ${t('sessionUsageThinking', { tokens: format(usage.thinking) })}`
              : ''}
          </div>
          <div className={styles.hint}>{t('sessionUsageHint')}</div>
        </div>
      }
    >
      <span className={styles.total}>
        {t('sessionUsageTotal', { tokens: format(usage.total) })}
      </span>
    </Tooltip>
  )
}
