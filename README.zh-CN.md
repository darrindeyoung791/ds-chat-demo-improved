# DS Chat Demo Improved

[English](README.md) | 简体中文

本项目修改自 DeepSeek [原版 chat demo](https://github.com/deepseek-ai/chat-demo)，在功能上进行一定补全。支持原官方网页端的快捷键和历史对话搜索功能。

本项目是基于 DeepSeek API 的静态聊天示例，无需应用后端，浏览器直接请求配置的 API 服务。使用前，请在设置中填写 API Key。

> [!CAUTION]
>
> 本项目并非 DeepSeek 官方产品或服务，也不代表 DeepSeek。
>
> 请不要依赖本项目的 GitHub Pages，页面仅供展示，可能不经通知随时关闭或更改地址。

## 特点功能

> [!CAUTION]
>
> 下列功能如有 Bug，请在本项目提 issue 或者 PR，不要去官方 chat demo 存储库请求修改

- 支持 [官方网页端](https://chat.deepseek.com/) 中的快捷键:
  - `Ctrl`+`J` 开启新对话
  - `Ctrl`+`K` 搜索历史对话（并非官方原版实现，行为上存在差异）
- 支持一部分官方没有的快捷键：
  - `Ctrl`+`,` 开启设置
  - `Ctrl` + `↑` / `↓` 上下切换对话（如果在设置中，则上下切换设置标签页）
- 支持多选对话处理（并非官方原版实现，行为上存在差异）
- 移动端竖屏支持手势：向右滑动展开侧边栏，向左滑动（侧栏内或侧栏外区域）收起
- 支持在设置 → 通用设置中选择模型：`deepseek-flash`、`deepseek-v4-pro`，或填写自定义模型名（如果本项目停更而新模型推出的话会有用）
- 支持安装为 PWA：部署到 http(s) 后可用浏览器「安装」到桌面或添加到主屏，以独立窗口运行；离开网络时仍能打开页面并查看本机保存的历史对话（发起对话仍需联网）
- 输入框下方显示当前会话的累计 Token 用量（悬停查看输入、缓存与输出明细）
- 设置 → 账户余额查看当前 API Key 的余额；余额只保存在内存中，不写入本地存储或历史归档
- 移动端返回键会关闭最上层浮层（设置、侧边栏、历史搜索、来源面板），而不是直接离开页面

## 运行

准备 Node.js 22.12+ 和 pnpm：

```sh
git clone https://github.com/darrindeyoung791/ds-chat-demo-improved.git
cd ds-chat-demo-improved
pnpm install
pnpm dev
```

打开 http://localhost:8090 。

生成静态产物：

```sh
pnpm build
```

产物位于 `dist/`，部署到任意静态服务器即可，请通过 http(s) 访问。站点同时是一个 PWA：首次访问后会注册 Service Worker，可以「安装」到桌面或主屏，之后断网也能打开页面并查看本机保存的历史对话。注意：直接双击打开 `dist/index.html`（`file://`）已不支持——Service Worker 与 API 请求都需要 http(s) 环境。

## 自行部署 GitHub Pages

本项目自带 [.github/workflows/pages.yml](.github/workflows/pages.yml)，用 GitHub Actions 构建并发布到 GitHub Pages，无需自备服务器，也不需要配置任何密钥：API Key 只保存在访问者浏览器里，不进构建产物。

1. Fork 本仓库，或在 GitHub 上新建仓库后推送本项目的代码（默认分支需为 `main`）。
2. 打开仓库的 **Settings → Pages**，把 **Source** 设为 **GitHub Actions**（不要选「Deploy from a branch」）。
3. 如果仓库的 Actions 被停用，先在 **Settings → Actions → General** 中允许 Actions 运行。
4. 推送到 `main` 即自动触发部署，也可以在 **Actions → Deploy GitHub Pages → Run workflow** 手动触发。

工作流依次执行 `pnpm install --frozen-lockfile` → `pnpm type` → `pnpm lint` → `pnpm build`，然后上传 `dist/` 并通过 `actions/deploy-pages` 发布，因此类型检查或 lint 不通过就不会部署。部署成功后访问 `https://<用户名>.github.io/<仓库名>/`；发布环境名为 `github-pages`，页面地址也会显示在 **Settings → Pages** 和对应的工作流运行记录里。

构建产物的资源使用相对路径（`publicPath: 'auto'`），可以部署在仓库子路径下，也可以部署到自定义域名，无需修改构建配置。注意：更换域名或仓库名会改变站点源（origin），浏览器中已有的 localStorage 设置和 IndexedDB 会话不会随之迁移，需要在新的站点上重新填写 API Key。

若不想用 Actions，也可以本地执行 `pnpm build`，把 `dist/` 的内容上传到任意静态托管服务（Pages、对象存储、Nginx 等），效果相同。子路径部署时不要手工把资源改成绝对路径。

产物根目录的 `manifest.json`、`sw.js` 与 `icons/` 构成 PWA。GitHub Pages 不能自定义响应头，也无法设置 `Service-Worker-Allowed`：因此 `sw.js` 必须留在站点根目录（否则作用域会缩小），Service Worker 的更新也可能延迟到约 10 分钟。页面本身走 network-first，正常刷新总会拿到最新版本，缓存只用于离线兜底。

API 地址在构建期注入（默认 `https://api.deepseek.com`）。需要换用其他 API 服务时，修改 [rspack.config.ts](rspack.config.ts) 中 `createConfig()` 的 `apiOrigin` 后再构建，接入的服务需支持 Messages / Files 与语音接口（见下文开发说明）。

## 数据

> [!CAUTION]
>
> 虽然本项目没有恶意，但您也不应当轻信任何自称安全的陌生项目，尤其是需要您提供 API Key 的项目。请始终审计源码（包括本项目）确保您的安全。
>
> 如果您信任本项目的源码，您还可以[自行部署 GitHub Pages](#自行部署-github-pages)，确保产物直接来自源码。

API Key 和设置保存在浏览器 localStorage，会话及附件原件保存在 IndexedDB，本地数据按浏览器用户配置和站点源（origin）隔离。发送对话、上传附件和使用语音功能时，相应内容会提交给配置的 API 服务。

Token 用量随助手消息保存在 IndexedDB，导出归档时不包含；设置 → 账户余额的数据只保存在内存中，刷新页面即清空。

设置中的历史导入导出使用 ZIP 格式。导入会在确认并校验成功后替换全部本地会话和附件；导出包含会话与本地可用的图片原件，不包含 API Key、设置或非图片附件原件。格式与保留范围见[历史导入导出](src/services/chat/history/README.md)。

设置 → 数据管理 → 删除所有对话，会在确认后清空全部本地会话、附件原件和未发送的草稿，停止正在生成的回复并回到新对话。API Key 和其他设置保留，已上传到 API 服务的文件不受影响。

## 开发

| 命令          | 用途                |
| ------------- | ------------------- |
| `pnpm dev`    | 启动开发服务器      |
| `pnpm build`  | 构建到 `dist/`      |
| `pnpm type`   | TypeScript 类型检查 |
| `pnpm lint`   | oxlint 检查         |
| `pnpm format` | oxfmt 格式化        |

[rspack.config.ts](rspack.config.ts) 默认连接 `https://api.deepseek.com`。`createConfig({ apiOrigin, devServer })` 支持自定义 API 地址和开发服务器代理。

聊天默认使用 `deepseek-flash`（可在设置中切换模型或填写自定义模型名），通过 Anthropic 兼容的 Messages / Files API 通信；语音使用 ASR / TTS 接口。请求使用搜索、链接阅读、标题和 `latest_reminder` 等扩展，接入服务需支持相应能力。附件实际支持的格式以服务端校验为准。

```text
src/
  app/                 应用布局、主题与全局样式
  components/          聊天、设置、Markdown 等界面组件
  i18n/                中英文文案
  pwa/                 Service Worker 与 PWA 图标（构建时复制到站点根目录）
  services/
    api/               API 请求、SSE 与协议类型
    chat/              会话、消息分支、本地存储与历史导入导出
    markdown/          Markdown 解析、代码高亮与图表
    speech/            录音与朗读
  utils/               通用工具
```

## 图片来源

PWA 图标使用的是**鲸鱼娘（whale girl）**插画，来自 [AATINF/deepseek-whale-girl-assets](https://github.com/AATINF/deepseek-whale-girl-assets)，版权归原作者所有。替换图标时请保留这处署名，以及设置 → 关于中的对应链接。

## 许可证

[MIT](LICENSE)。构建会将许可证复制到 `dist/LICENSE`，分发时请一并保留；第三方依赖遵循各自的许可证。
