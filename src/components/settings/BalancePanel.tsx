import { useEffect } from 'react'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import { refreshBalance, useBalance, type BalanceError } from '../../services/account.js'
import { useSettings } from '../../services/settings.js'
import { Button } from '../base/Button.js'
import { setSettingsSection } from './settingsDialogState.js'
import styles from './BalancePanel.module.css'

const ERROR_KEYS: Record<BalanceError, TranslationKey> = {
  'no-key': 'settingsBalanceNoApiKey',
  unauthorized: 'settingsBalanceInvalidKey',
  insufficientBalance: 'settingsBalanceInsufficient',
  tooLarge: 'settingsBalanceFailed',
  rateLimited: 'settingsBalanceRateLimited',
  serverBusy: 'settingsBalanceServerBusy',
  network: 'settingsBalanceNetwork',
  other: 'settingsBalanceFailed',
}

const formatMoney = (value: string, currency: string, locale: string): string => {
  const amount = Number(value)
  if (!value.trim() || !Number.isFinite(amount)) {
    return `${value} ${currency}`.trim()
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return `${value} ${currency}`
  }
}

const formatTime = (value: number, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value)

/**
 * 设置 → 账户余额：展示当前 API Key 的余额，数据只保存在内存中。
 * 每次打开面板或更换 API Key 时重新获取，也可以手动刷新。
 */
export const BalancePanel = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const apiKey = useSettings((state) => state.apiKey)
  const status = useBalance((state) => state.status)
  const data = useBalance((state) => state.data)
  const error = useBalance((state) => state.error)
  const updatedAt = useBalance((state) => state.updatedAt)

  useEffect(() => {
    void refreshBalance()
  }, [apiKey])

  const loading = status === 'loading'
  const needsKey = error === 'no-key' || error === 'unauthorized'
  // 未填写或无效 Key 时，旧 Key 的余额不能继续展示。
  const visibleData = needsKey ? null : data
  const infos = visibleData?.balance_infos ?? []

  return (
    <div className={styles.panel}>
      <div className={styles.title}>{t('settingDialogAsideBalanceOptionLabel')}</div>
      <div className={styles.notice}>{t('settingsBalanceDescription')}</div>
      {visibleData ? (
        <div className={styles.card} aria-busy={loading}>
          {infos.length > 0 ? (
            infos.map((info) => (
              <div key={info.currency} className={styles.balance}>
                <div className={styles.amountRow}>
                  <span className={styles.amount}>
                    {formatMoney(info.total_balance, info.currency, locale)}
                  </span>
                  <span className={styles.currency}>{info.currency}</span>
                </div>
                <div className={styles.breakdown}>
                  <span>
                    {t('settingsBalanceGranted')}{' '}
                    {formatMoney(info.granted_balance, info.currency, locale)}
                  </span>
                  <span>
                    {t('settingsBalanceToppedUp')}{' '}
                    {formatMoney(info.topped_up_balance, info.currency, locale)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.empty}>{t('settingsBalanceEmpty')}</div>
          )}
          {visibleData.is_available === false ? (
            <div className={styles.error} role="alert">
              {t('settingsBalanceUnavailable')}
            </div>
          ) : null}
        </div>
      ) : loading ? (
        <div className={styles.status} role="status">
          {t('settingsBalanceLoading')}
        </div>
      ) : null}
      {error ? (
        <div className={styles.error} role="alert">
          {t(ERROR_KEYS[error])}
        </div>
      ) : null}
      <div className={styles.footer}>
        <span className={styles.updated}>
          {updatedAt ? t('settingsBalanceUpdatedAt', { time: formatTime(updatedAt, locale) }) : ''}
        </span>
        <div className={styles.actions}>
          {needsKey ? (
            <Button variant="outlined" size="s" onClick={() => setSettingsSection('data')}>
              {t('settingsBalanceGoToData')}
            </Button>
          ) : null}
          <Button
            variant="outlined"
            size="s"
            disabled={loading || error === 'no-key'}
            onClick={() => void refreshBalance()}
          >
            {loading ? t('settingsBalanceRefreshing') : t('settingsBalanceRefresh')}
          </Button>
        </div>
      </div>
      <div className={styles.privacy}>{t('settingsBalancePrivacy')}</div>
    </div>
  )
}
