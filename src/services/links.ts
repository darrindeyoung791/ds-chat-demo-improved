import type { Locale } from './settings.js'

/** 项目仓库地址：页脚与设置「关于」共用，改这里即可同步所有入口 */
export const REPO_URL = 'https://github.com/darrindeyoung791/ds-chat-demo-improved'

/** DeepSeek 官方用户协议；按界面语言指向对应版本 */
export const termsUrl = (locale: Locale) =>
  `https://cdn.deepseek.com/policies/${locale}/deepseek-terms-of-use.html`

/** PWA 图标所用鲸鱼娘插画的来源：文档与设置「关于」都必须保留这处署名 */
export const WHALE_GIRL_ART_URL = 'https://github.com/AATINF/deepseek-whale-girl-assets'
