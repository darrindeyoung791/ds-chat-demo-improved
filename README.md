# DS API Demo with Hotkeys

English | [简体中文](README.zh-CN.md)

This project is modified from DeepSeek's [original chat demo](https://github.com/deepseek-ai/chat-demo) with some feature additions. It supports the keyboard shortcuts and chat history search like the official web client.

This project is a static chat demo powered by the DeepSeek API. No application backend is required: the browser connects directly to the configured API service. Enter your API key in Settings before your first chat.

> [!CAUTION]
>
> This project is **NOT** an official DeepSeek product or service, and does not represent DeepSeek.
>
> Please do **NOT** rely on this project's demo GitHub Pages; the page may be shut down or moved without notice.

## Features

> [!CAUTION]
>
> If any of the features below has a bug, please open an issue or PR in this project instead of asking the upstream chat demo repository for changes.

- Supports the shortcuts from the [official web client](https://chat.deepseek.com/):
  - `Ctrl`+`J` starts a new chat
  - `Ctrl`+`K` searches chat history (not the official implementation; behavior may differ)
- Supports some shortcuts the official client does not have:
  - `Ctrl`+`,` opens Settings
  - `Ctrl` + `↑` / `↓` switches chats (switches between settings tabs while Settings is open)
- Supports multi-selecting chats for bulk actions (not the official implementation; behavior may differ)
- Mobile portrait gestures: swipe right to open the sidebar, swipe left (inside the sidebar or on the area outside it) to close
- Choose the model in Settings → General: `deepseek-flash`, `deepseek-v4-pro`, or enter a custom DeepSeek model name (useful in case new models are released before this project catches up)
- Installable as a PWA: once deployed over http(s) you can install it to the desktop or add it to the home screen and run it in its own window; with no network you can still open the app and read your locally stored conversations (sending new messages requires network)
- Shows the accumulated token usage of the current chat below the input box (hover for the input, cache, and output breakdown)
- Shows the balance of the current API Key under Settings → Balance; the balance is kept in memory only and is never written to local storage or chat archives

## Getting started

Install Node.js 22.12+ and pnpm, then run:

```sh
git clone https://github.com/darrindeyoung791/ds-api-demo-hotkeys.git
cd ds-api-demo-hotkeys
pnpm install
pnpm dev
```

Open http://localhost:8090.

To build the static site:

```sh
pnpm build
```

The output is written to `dist/`. Deploy it to any static web server and serve it over http(s). The site is also a PWA: the first visit registers a service worker, so you can install it to the desktop or home screen and still open it (with your locally stored conversations) while offline. Note: opening `dist/index.html` directly from disk (`file://`) is no longer supported — service workers and API requests both require an http(s) origin.

## Deploying your own GitHub Pages

This project ships [.github/workflows/pages.yml](.github/workflows/pages.yml), which builds the site and publishes it to GitHub Pages with GitHub Actions. No server and no secrets are needed: the API key only lives in each visitor's browser and never enters the build output.

1. Fork this repository, or create a new repository on GitHub and push this project's code (the default branch must be `main`).
2. Open the repository's **Settings → Pages** and set **Source** to **GitHub Actions** (not "Deploy from a branch").
3. If Actions is disabled for the repository, allow it first in **Settings → Actions → General**.
4. Pushing to `main` triggers a deployment automatically, or run it manually from **Actions → Deploy GitHub Pages → Run workflow**.

The workflow runs `pnpm install --frozen-lockfile` → `pnpm type` → `pnpm lint` → `pnpm build`, then uploads `dist/` and publishes it through `actions/deploy-pages`, so a type-check or lint failure blocks the deploy. Once deployed, the site is available at `https://<user>.github.io/<repo>/`; the deployment environment is named `github-pages`, and the URL also shows up under **Settings → Pages** and in the workflow run.

The build uses relative asset paths (`publicPath: 'auto'`), so it works under a repository subpath or on a custom domain without touching the build config. Note: changing the domain or repository name changes the site origin, so existing localStorage settings and IndexedDB conversations do not carry over — enter the API key again on the new site.

If you prefer not to use Actions, run `pnpm build` locally and upload the contents of `dist/` to any static host (Pages, object storage, Nginx, and so on); the result is the same. When deploying under a subpath, do not hand-edit the assets into absolute paths.

`manifest.json`, `sw.js`, and `icons/` in the output root make up the PWA. GitHub Pages cannot set custom response headers, so `Service-Worker-Allowed` is unavailable: `sw.js` must stay at the site root (otherwise its scope shrinks), and service worker updates can be delayed by roughly 10 minutes. Page loads are network-first, so a normal refresh always gets the latest build; the cache is only an offline fallback.

The API origin is injected at build time (default `https://api.deepseek.com`). To use another API service, change `apiOrigin` in `createConfig()` in [rspack.config.ts](rspack.config.ts) before building; the service must support the Messages / Files APIs and the speech endpoints (see Development below).

## Data

> [!CAUTION]
>
> This project is not malicious. However you should never blindly trust any unfamiliar project that claims to be safe, especially one that asks you for an API key. Always review the source code to keep yourself safe.
>
> If you trust this project's source code, you can also [deploy your own GitHub Pages](#deploying-your-own-github-pages) to make sure the build comes straight from the source.

Your API key and settings are stored in the browser's localStorage. Conversations and original attachments are stored in IndexedDB. Local data is isolated by browser profile and site origin. Sending messages, uploading attachments, and using speech features sends the relevant content to the configured API service.

Token usage is stored with assistant messages in IndexedDB and is not included in exported archives. Balance data under Settings → Balance is kept in memory only and is cleared when the page is refreshed.

History import and export in Settings use ZIP archives. After confirmation and successful validation, importing replaces all local conversations and attachments. Exports include conversations and locally available original images, but exclude API keys, settings, and original non-image attachments. See the [history import/export documentation](src/services/chat/history/README.md) for the archive format and preservation details.

Settings → Data → Delete all chats clears all local conversations, original attachments, and unsent drafts after confirmation. It stops ongoing replies and returns to a new chat. Your API key and other settings are preserved; files already uploaded to the API service are not affected.

## Development

| Command       | Description                  |
| ------------- | ---------------------------- |
| `pnpm dev`    | Start the development server |
| `pnpm build`  | Build into `dist/`           |
| `pnpm type`   | Run TypeScript type checks   |
| `pnpm lint`   | Lint with oxlint             |
| `pnpm format` | Format with oxfmt            |

[rspack.config.ts](rspack.config.ts) uses `https://api.deepseek.com` by default. Use `createConfig({ apiOrigin, devServer })` to customize the API origin and development server proxy.

Chat uses `deepseek-flash` by default (switch models or enter a custom model name in Settings) and communicates through Anthropic-compatible Messages / Files APIs. Speech features use ASR / TTS endpoints. Requests include extensions such as search, link reading, titles, and `latest_reminder`, so the configured service must support the corresponding capabilities. Supported attachment formats are determined by server-side validation.

```text
src/
  app/                 Application layout, themes, and global styles
  components/          Chat, settings, Markdown, and other UI components
  i18n/                English and Chinese translations
  pwa/                 Service worker and PWA icons (copied to the site root at build time)
  services/
    api/               API requests, SSE, and protocol types
    chat/              Conversations, message branches, storage, and history import/export
    markdown/          Markdown parsing, syntax highlighting, and diagrams
    speech/            Audio recording and read-aloud playback
  utils/               Shared utilities
```

## Credits

The PWA icon artwork is the **whale girl** illustration from [AATINF/deepseek-whale-girl-assets](https://github.com/AATINF/deepseek-whale-girl-assets); all rights belong to its original authors. If you replace the icons, keep this attribution and the matching link in Settings → About.

## License

[MIT](LICENSE). The build copies the license to `dist/LICENSE`; include it when distributing the app. Third-party dependencies are subject to their own licenses.
