# AGENTS.md

本文件面向在本仓库中工作的 AI 编码代理（也适用于人类贡献者）。它只记录**读代码不容易看出来的约定、约束和易错点**；功能说明见 [README.md](README.md)（[简体中文](README.zh-CN.md)）。

## 项目速览

- chat-demo 是基于 DeepSeek API 的**纯静态**聊天示例：React 18 + TypeScript + rspack，zustand 管理状态，**没有应用后端**，浏览器直接请求构建时注入的 API 地址。
- 产物按 **http(s) 静态站点**设计（GitHub Pages 子路径、自定义域名均可），构建配置坚持 `publicPath: 'auto'`、`scriptLoading: 'defer'`，资源全部相对定位；任何改动都不能引入绝对路径资源。**直接双击打开 `dist/index.html`（`file://`）已不是支持目标**：Service Worker 只在安全上下文注册，PWA 能力与 API 请求都需要 http(s) 或 localhost。
- 单包仓库（无 workspace、无私有 registry），无测试框架，无测试脚本。

## 常用命令

- `pnpm install`：安装依赖（CI 使用 `--frozen-lockfile`）。
- `pnpm dev`：启动开发服务器，默认 http://localhost:8090。
- `pnpm build`：生产构建到 `dist/`（`output.clean` 会先清空旧产物）。
- `pnpm type`：`tsc -p tsconfig.json`，只做类型检查、不产出文件。
- `pnpm lint`：`oxlint src rspack.config.ts`。
- `pnpm format`：`oxfmt --write .`，格式化全仓库。

环境与硬性要求：

- 运行环境：Node.js 22.12+ 与 pnpm（CI 使用 Node 24 + pnpm 12.6）。
- **提交前必须让 `pnpm type` 与 `pnpm lint` 通过**，这是 CI（[pages.yml](.github/workflows/pages.yml)）在构建前的两道门禁；没有单元测试可依赖。
- `pnpm build` 的脚本是 POSIX 写法（`rm -rf dist && NODE_ENV=production …`），在 Windows 的 pwsh/cmd 下会失败：请用 Git Bash / WSL，或改用 `$env:NODE_ENV = 'production'; pnpm exec rspack build -c rspack.config.ts`。
- 依赖被锁在 `pnpm-lock.yaml` 中：新增或升级依赖需同步提交 lockfile，否则 CI 安装会失败。

## 部署（GitHub Pages）

- 推送到 `main` 触发 [pages.yml](.github/workflows/pages.yml)：`pnpm install --frozen-lockfile` → `pnpm type` → `pnpm lint` → `pnpm build` → 上传 `dist/` → `actions/deploy-pages` 发布到 <https://darrindeyoung791.github.io/ds-chat-demo-improved/>。
- 仓库的 Pages 来源设为 **GitHub Actions**（不是分支发布），部署环境名为 `github-pages`；发布只发生在 `main` 分支。
- 产物资源是相对路径（`publicPath: 'auto'`），因此可以部署在仓库子路径下；不要改成绝对路径，否则 Pages 子路径部署会失效。PWA 清单里的 `start_url` / `scope` / 图标路径同样保持相对写法。
- 本仓库是 `deepseek-ai/chat-demo` 的 fork：若 Actions / Pages 处于停用状态，需要在仓库 Settings 里先启用，再推送触发部署。

## 目录与职责

```text
src/
  main.tsx             入口：ensureKatex()、setupTheme() 之后渲染 <App />，再 setupPwa()
  index.html           HTML 模板（HtmlRspackPlugin 注入脚本、标题、application-version 与 PWA 链接）
  env.d.ts             全局声明：CSS Modules、__API_ORIGIN__、__PRODUCTION__、Prism/KaTeX 副作用模块
  app/                 布局（App.tsx）、全局快捷键（shortcuts.ts）、主题（theme.ts / theme.css）、PWA 注册（pwa.ts）、全局样式、视口与移动端 hook
  components/
    base/              通用控件：Button、IconButton、Menu、Modal、Select、Tooltip、Toast、icons
    chatInput/         输入框、附件草稿、拖拽遮罩、语音输入与频谱
    historySearch/     Ctrl+K 的历史对话搜索浮层与开关状态
    messages/          消息列表、用户/助手消息、分支切换、复制、朗读
    markdown/          Markdown 渲染链路、代码块、公式、Mermaid
    search/            搜索结果面板、来源卡片、悬浮卡、引用角标
    session/           会话页、欢迎页、移动端顶栏
    settings/          设置弹窗、API Key 表单、弹窗状态
    sider/             侧边栏、会话项、移动端抽屉
  i18n/                zh.ts 为键的权威来源，en.ts 必须覆盖同一组键
  pwa/                 sw.js（原样复制到站点根目录）与 icons/（构建时复制到 dist/icons/）
  services/
    api/               fetch 封装、错误分类、SSE 解析、事件解析、协议类型、ASR/TTS
    chat/              会话 store、分支树、持久化（idb）、草稿、请求组装、导入导出
      history/         归档格式、校验、ZIP 读写、本地/归档转换（见其 README）
    markdown/          解析（mdast）、Prism 按需加载、KaTeX、Mermaid
    speech/            录音（MediaRecorder/AudioContext）与朗读播放
  utils/               id、日期格式化等通用工具
.github/workflows/     GitHub Pages 部署（type → lint → build → deploy）
```

## 架构要点

### 状态与数据流

- 全局状态用 **zustand**，store 按功能就近放置：`useSettings`（localStorage 设置）、`useChatStore`（会话）、`useDrafts`（草稿）、`useUploads`（上传任务）、以及 UI 级的 `useToast` / `useSettingsDialog` / `useSearchPanel` / `useHistorySearch` / `useSessionNavigation` / `useMobileSider`。
- 快捷键切换会话是「先高亮、后加载」：`sider/sessionNavigationState.ts` 记下待定会话，松手约 60ms 后才 `selectSession`；按住时由 `app/shortcuts.ts` 自己的重复计时器（约 320ms 后每 60ms 一格）持续移动高亮，忽略系统按键重复，滚动用 `useLayoutEffect` 在绘制前跟上，避免连按时反复读取消息或高亮跑出可视区。
- 约定：store 文件暴露 `useXxx` 及一组命令式函数（如 `sendMessage`、`openSettings`、`showToast`），组件只订阅需要的最小切片；**非组件代码用 `getState()` / `setState()`，不要为读状态引入 React**。
- 界面文案统一走 i18n：组件内 `useTranslate()`，普通函数内 `translate()`。

### 会话与消息分支树

- `Session.messages` 保存**所有分支**的消息，按创建顺序排列；`parentId` / `selectedChildId` 构成树，`rootMessageId` 为 `undefined` 表示旧的线性列表、`null` 表示空会话（[types.ts](src/services/chat/types.ts)）。
- 展示与请求上下文**都**由 `getVisibleMessages()` 沿 `selectedChildId` 走出当前路径；不要直接用 `session.messages` 渲染或组装请求。
- 新增提问、重新生成、编辑提问都通过 `appendBranch()` 追加版本，**不覆盖**旧消息；切换版本用 `selectVersion()`。
- 每个会话同一时间只允许一个生成中的回复，由 `streaming: Record<sessionId, AbortController>` 保证；所有会改动会话的入口都先检查 `importingHistory` / `deletingSessions` / `getStreamController()`。
- `sessionCache` 只保留最近打开的少量会话（`SESSION_CACHE_LIMIT`），当前会话、生成中、未保存成功、删除中的会话不淘汰；列表数据在 `sessions`（`SessionSummary`），不要把完整会话塞回列表。

### 请求与流式响应

- 端点前缀：`${API_ORIGIN}/anthropic/v1`（Messages / Files，附 `anthropic-beta: files-api-2025-04-14`）与 `${API_ORIGIN}/v1/tools`（ASR / TTS），`API_ORIGIN` 来自构建期 `__API_ORIGIN__`（[client.ts](src/services/api/client.ts)）。
- 请求体在 [store.ts](src/services/chat/store.ts) 的 `streamReply` 内组装：模型取自设置（默认 `deepseek-flash`，也可填写自定义名称）、固定 `system`、`thinking.enabled/disabled`、`deepseek_read_url` 常开 + `deepseek_web_search` 随设置、`safety_check.level = 'high'`；会话还没有标题时额外带 `title: { enabled: true }` 以获取自动标题。
- 每轮上下文由 [reply.ts](src/services/chat/reply.ts) 的 `toRequestMessages()` 拼装：只保留「提问 + 可用回答」成对的轮次，`latest_reminder` 快照**仅在内容变化时**插入（同一分支连续相同则不重复），续写时末尾补上 assistant 前缀。
- 流是 Anthropic 兼容的 SSE（以 `message_stop` 结束，没有 `[DONE]`）。解析分三层：`sse.ts`（字节流 → 事件）→ `parseEvent.ts`（JSON → `MessageStreamEvent`）→ [reply.ts](src/services/chat/reply.ts) 的 `applyEvent()`（合并进内容块）。**遇到未知事件或未知块必须跳过而不是抛错。**
- 流式增量按动画帧合并到内存（页面隐藏时直接 flush），落盘由 `persist()` 在关键节点触发（开始生成、结束、失败或停止），不随每个增量写磁盘。
- 附件用 Files API 的 `file_id` 引用，发送前补齐 `serverId`（`ensureServerId`），服务端判定失效时会清空并按退避上限重传重发（`FILE_RETRY_LIMIT`）。
- 错误必须保持可展示：抛 `ApiError`（含 `kind`、`status`、可选的 `localMessage` 翻译键），界面文案由 [describe.ts](src/services/chat/describe.ts) 与 [errors.ts](src/services/api/errors.ts) 决定，不要直接把服务端英文原文当提示。

### 本地存储

- **localStorage**：API Key 与设置，键统一带 `chat-demo:` 前缀（[settings.ts](src/services/settings.ts)）；读取失败必须静默降级（隐私模式可能抛异常）。
- **IndexedDB**（库名 `chat-demo`，[db.ts](src/services/chat/db.ts)）：`sessions`、`sessionSummaries`（含 `fileIds` 多值索引，用于判断原件是否仍被引用）、`files`、以及导入用的 `sessionsStaging` / `filesStaging`。
- 修改存储或索引时**递增 `DB_VERSION`**，并在 `upgrade` 里创建缺失的 store/索引；本应用**不迁移旧数据格式**，`upgrade` 不负责搬运旧消息。
- 每个操作拿到连接后立即创建事务；同步抛错不会自动回滚事务，需 `abortTransaction()` 显式中止（参考 `saveSession`、`commitStaging`）。
- 历史导入是「暂存 → 校验 → 单事务替换」：替换失败时原有数据必须保持不变；删除会话只清理不再被任何会话引用的本地原件，远端文件不删。
- 账户余额（[account.ts](src/services/account.ts)，`GET /user/balance`）只保存在内存中，不写入 localStorage / IndexedDB，也不进入归档；Token 用量复用助手消息上的 `usage`，由 [usage.ts](src/services/chat/usage.ts) 沿当前分支汇总，导入的历史会话没有该数据（不要为此提升归档版本）。

### PWA 与 Service Worker

- 注册入口是 [pwa.ts](src/app/pwa.ts)：只在生产构建（`__PRODUCTION__`）且页面为 `http:` / `https:` 时注册。开发服务器带 HMR，Service Worker 缓存会干扰热更新；`file://` 不支持 Service Worker，两种情况都直接跳过。
- [sw.js](src/pwa/sw.js) 不参与打包，由 `CopyRspackPlugin` 复制到 `dist/` 根目录。**必须留在站点根目录**：GitHub Pages 不能设置 `Service-Worker-Allowed`，放进子目录会缩成只覆盖该子目录的默认作用域。复制过去的 JS 会被构建期压缩，排查线上缓存问题时对照源码。
- 缓存策略是「运行时缓存」而不是构建期预缓存清单：导航走 network-first（部署后立即拿到新 HTML），同源静态资源缓存优先 + 后台重新验证，条目数有上限（`MAX_ENTRIES`）。新增同源资源不需要改 `sw.js`。
- **只接管同源 GET**：API 与 SSE 流必须由浏览器直连，跨域请求、`POST`、`Range` 请求一律不 `respondWith`；任何情况下都不得把 API 响应写入缓存（聊天内容是隐私数据，流式响应也无法缓存）。
- 清单由 [rspack.config.ts](rspack.config.ts) 的 `PwaManifestPlugin` 生成（`name` 取 `zh.appName`），`start_url` / `scope` / 图标路径都相对清单自身解析，保证子路径部署可用；图标源文件在 `src/pwa/icons/`（说明见 [pwa/README.md](src/pwa/README.md)），构建时复制到 `dist/icons/`。
- 图标是**鲸鱼娘插画**（<https://github.com/AATINF/deepseek-whale-girl-assets>），署名是使用条件：`README*.md` 的「图片来源 / Credits」与设置 → 关于（`aboutWhaleGirlLink`、`WHALE_GIRL_ART_URL`）必须保留，替换图标时一起更新。清单图标**必须用 PNG**（Chrome 的安装条件不接受 JPEG），512 那张同时声明 `any maskable`，细节见 [pwa/README.md](src/pwa/README.md)。
- 修改缓存逻辑时递增 `sw.js` 的 `CACHE_NAME`：`activate` 只清理同前缀（`chat-demo-`）的旧缓存，避免误删 github.io 同源下其他仓库的缓存。

### 历史归档

- 归档格式 `export_format_version = 3`，结构、字段与导入/导出语义见 [history/README.md](src/services/chat/history/README.md)、[format.ts](src/services/chat/history/format.ts)、[schema.ts](src/services/chat/history/schema.ts)。
- 改动归档字段或语义时：提升版本号 → 同步 `schema.ts` 校验、`toLocal.ts` / `toArchive.ts` 双向映射、该 README 的「归档结构 / 展示与上下文 / 导出范围」章节，并保证旧版本归档被明确拒绝而不是半解析。
- 归档**不得**包含 API Key 或应用设置；导入导出与「删除所有对话」通过 [backup.ts](src/services/chat/backup.ts) 的串行队列执行，不要绕过它并发操作。

### 界面层

- 样式一律 CSS Modules，文件名 `<Component>.module.css`，类名**小驼峰**（`styles.dangerOutlined`），组合用 `clsx()`。`import styles from './X.module.css'` 的类型来自 `src/env.d.ts` 的通配声明（`Record<string, string>`）；部分模块另有 `X.module.css.d.ts` 声明精确类名（优先于通配声明生效），**该文件存在时新增类名必须同步补进去**。
- 颜色、字号、控件高度、动画时长取 `theme.css` 中的 `--dsw-*` / `--ds-*` 变量，深浅色通过 `body.dark` 与 `data-ds-dark-theme` 切换；不要在组件里硬编码颜色。
- 浮层（Menu、Modal、Select、Tooltip、HoverCard、DragMask）统一用 `createPortal` 挂到 `document.body`，定位辅助见 [anchored.ts](src/components/base/anchored.ts)。
- 浮层的「返回键关闭」统一由 [overlayHistory.ts](src/app/overlayHistory.ts) 管理：`Modal`、移动端抽屉、Ctrl+K 搜索与来源面板都通过 `useOverlayBack` 注册，共用一条同 URL 历史记录；不要在组件里各自 `pushState`。
- 移动端断点是 768px（`useIsMobile`），输入框跟随视觉视口（`useMobileViewport`）；涉及移动端交互的改动要在窄屏下自测。
- Ctrl+K 搜索按官方行为实现：只匹配消息正文（不单独匹配标题）；结果不截断、按时间倒序，输入停顿约 250ms 后整体替换（清空立即生效），等待期间显示「搜索中...」；列表以关键词为 key 重建并回到顶部，新结果不会追加在旧结果后面；组词期间不搜索，组词结束再计时；判断是否在组词优先用事件自带的 `isComposing`，即使浏览器漏发 `compositionend`，后续普通输入也会恢复搜索；关键词为空时只显示输入提示。
- Markdown 渲染链路是「节流 → 解析 AST → 渲染」（[Markdown.tsx](src/components/markdown/Markdown.tsx)），流式文本不要绕过节流直接解析。`dangerouslySetInnerHTML` 仅出现在 Prism 高亮、KaTeX、Mermaid 三处，输入都经过本地生成或严格配置（Mermaid `securityLevel: 'strict'`）；新增用法需要单独论证。

## 代码约定（由工具强制）

以下规则由 `tsc` 或 `.oxlintrc.json` 强制，违反会直接让 CI 失败：

- **相对导入必须写 `.js` 后缀**（如 `./store.js`、`../i18n/index.js`），构建时通过 `resolve.extensionAlias` 解析到对应的 `.ts` / `.tsx`。`.css` 与第三方包按正常写法。
- **只用命名导出，禁止 `export default`**（`import/no-default-export`）。唯一例外是 [rspack.config.ts](rspack.config.ts) 的 `export default defineConfig(...)`，它带有 `eslint-disable-next-line` 注释。
- **禁止 `console.*`**（`no-console`）。日志需求用 toast，存储错误用 `reportStorageError()`（内部带 disable 注释）。
- **禁止 `alert` / `confirm`**，用 Modal 组件；**禁止非空断言 `!`**、**禁止 `any`**、**`@ts-ignore` 需改用 `@ts-expect-error` 且说明不少于 10 个字符**。
- **`if` / `for` 必须带花括号**（`curly: all`）；`react/exhaustive-deps` 为 error，依赖数组要写全。
- **禁止循环导入**（`import/no-cycle`）：`services` 不 import `components`，`utils` 保持为叶子模块，跨模块共享的类型抽到 `types.ts` / `format.ts`；新增 `import` 前先确认没有把依赖绕回上游。
- TypeScript 为 `strict`，并开启 `noUnusedLocals`、`noUnusedParameters`、`noImplicitReturns`、`noImplicitOverride`、`useUnknownInCatchVariables`；`catch` 变量是 `unknown`，先用 `instanceof` 或类型守卫收窄。
- 格式由 oxfmt 决定：**无分号、单引号、2 空格、行宽 100、`trailingComma: es5`**。改完代码跑 `pnpm format`，不要手工调整排版。
- 注释与文档使用**中文**，解释「为什么」而不是复述代码；公开导出的函数与类型用 `/** … */` 说明契约。
- 面向用户的文案一律进 [zh.ts](src/i18n/zh.ts) 并在 [en.ts](src/i18n/en.ts) 提供对应键（`TranslationKey = keyof typeof zh`，缺键会编译失败）；带参数用 `{count}` 占位。
- 应用名只有一处来源：`zh.ts` / `en.ts` 的 `appName`。[index.html](src/index.html) 的标题由 `rspack.config.ts` 通过 `templateParameters` 注入 `zh.appName`，运行时 [App.tsx](src/app/App.tsx) 再按当前语言同步 `document.title` 与 `<html lang>`；不要在 HTML 或组件里另写产品名。

## 常见改动指南

- **界面文案**：`i18n/zh.ts` 与 `i18n/en.ts` 加同名键；组件内用 `t('key')`，普通函数用 `translate('key')`。
- **响应内容块 / 事件**：`services/api/types.ts`（协议类型）→ `parseEvent.ts`（事件解析）→ `chat/types.ts`（`ReplyBlock`）→ `chat/reply.ts`（合并与上下文）→ `chat/view.ts` 与组件（展示）。
- **IndexedDB 结构**：`services/chat/db.ts` 递增 `DB_VERSION`，在 `upgrade` 里创建缺失的 store / 索引。
- **历史归档**：`history/format.ts`、`schema.ts`、`toLocal.ts`、`toArchive.ts` 与 `history/README.md` 一起改。
- **设置项**：`services/settings.ts` 增加 `KEYS` 键、`useSettings` 初值与 setter，补设置弹窗 UI；影响提示词时同步 `latestReminder.ts`。
- **新组件**：放到对应的 `components/<feature>/`，`<Name>.tsx` + 可选 `<Name>.module.css`，命名导出。
- **API 地址 / 开发代理**：用 `rspack.config.ts` 导出的 `createConfig({ apiOrigin, devServer })`，不要硬编码域名。
- **PWA / 缓存策略**：`src/pwa/sw.js`（缓存与离线回退）、`src/app/pwa.ts`（注册条件）、`rspack.config.ts` 的 `PwaManifestPlugin` 与 `CopyRspackPlugin`（清单、图标、sw.js 的落位）；改缓存逻辑递增 `CACHE_NAME`，换图标整套替换 `src/pwa/icons/`。
- **行为变化**：同步 `README.md` 与 `README.zh-CN.md`，两者内容需对应。

## 陷阱与注意事项

- **不要手改 `dist/`**（已被 `.gitignore` 忽略），它是构建产物；也不要提交 `node_modules/`。
- **API Key 只存在于浏览器 localStorage**，任何日志、归档、示例代码都不得包含 Key；请求鉴权用 `x-api-key`（兼容接口）或 `Authorization: Bearer`（`/models`、ASR/TTS）。
- 构建目标是 `chrome >= 105 / edge >= 105 / safari >= 16 / firefox >= 110`：新语法由 swc 降级，但**没有 polyfill**，不要依赖更新的浏览器 API（如 `Array.fromAsync`、`Promise.withResolvers` 等）而不做判断。
- 会话保存失败不能打断对话：持久化错误只记录/提示，内存中的会话继续可用（见 `sessionSaveErrors` 与 `retrySaveSessions`）。
- 删除会话 / 导入历史期间需要锁定交互（`importingHistory`、`deletingSessions`），新增入口时别忘了同样的守卫。
- 思考块、工具块与签名需要**原样回传**才能让服务端恢复上下文；历史请求只回传 `read_link` 的调用与结果，历史思考和其他工具块不回传（[reply.ts](src/services/chat/reply.ts)）。修改内容块结构时先读该文件的注释。
- 错误回复、拒绝回复、服务端模板回复都要保留在消息树中，但**不进入后续请求上下文**；`prefix` 决定能否续写。
- 页面只在 http(s) 下得到完整支持：`file://` 打开不再保证可用（Service Worker、部分存储与跨域行为都依赖安全上下文），不要在文档里再承诺双击 `dist/index.html`。
- 大规模依赖（`mermaid`、Prism 语言包、归档模块）通过动态 `import()` 按需加载，新增重型依赖时保持同样的懒加载方式。

## 工作清单

1. 改前先读相关文件的头部注释——本仓库大量设计决策写在注释里，比 README 更细。
2. 实现后跑 `pnpm type`、`pnpm lint`，必要时 `pnpm format`。
3. 用 `pnpm dev` 在 http://localhost:8090 手动验证：桌面与窄屏布局、流式回复、深色主题、中英文文案。
4. 涉及存储或归档的改动，验证「刷新后仍在」「导入导出可往返」「失败时原数据不丢」。
5. 涉及 PWA 时用生产构建验证（`pnpm dev` 不注册 Service Worker）：`pnpm build` 后用任意静态服务器托管 `dist/`，确认 DevTools → Application 里清单、图标、Service Worker 都正常，断网刷新仍能打开外壳。
6. 更新受影响的文档：本文件、`README*.md`、`src/services/chat/history/README.md`。
