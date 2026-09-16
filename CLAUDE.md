# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

LeetHub v2 is a cross-browser extension (Chrome + Firefox, Manifest v3) that automatically pushes LeetCode and GeeksforGeeks solutions to GitHub on successful submission. It's an ES module project built with webpack 5.

## Commands

```bash
npm run setup        # Install dependencies
npm run build        # Production build → ./dist/
npm run dev          # Watch mode (webpack --watch)
npm run test         # Run Jasmine tests
npm run lint         # ESLint with auto-fix
npm run lint-test    # Check linting (no fix)
npm run format       # Prettier formatting
npm run format-test  # Check formatting (no fix)
```

## High-level architecture

### Build pipeline

webpack bundles three entry points into `./dist/`:
- `scripts/leetcode/leetcode.js` → `dist/scripts/leetcode.js` (content script injected on leetcode.com)
- `scripts/welcome.js` → `dist/scripts/welcome.js` (onboarding page)
- `scripts/popup.js` → `dist/scripts/popup.js` (extension popup)

After bundling, `CopyPlugin` copies non-compiled assets (CSS, HTML, vendor libs, manifest), and `FileManagerPlugin` moves the bundles into `dist/scripts/` and duplicates everything into both `dist/chrome/` and `dist/firefox/`. Manifest JSON is transformed: comments are stripped and `__LH_VERSION__` is replaced with the version from `package.json`.

### Extension entry points

Three runtime surfaces:
1. **Content script** (`leetcode.js`) — injected at `document_idle` on `leetcode.com/*`. Uses `MutationObserver` to detect the submit button (v1: `[data-cy="submit-code-btn"]`, v2: `[data-e2e-locator="console-submit-button"]`), intercepts the submission, polls for success, then uploads to GitHub via the GitHub Contents API.
2. **Content script** (`authorize.js`) — injected on `github.com/*`. Captures the OAuth code from the redirect URL, exchanges it for a GitHub token via `XMLHttpRequest`, and sends the token back to the background worker via `runtime.sendMessage`.
3. **Content script** (`gfg.js`) — injected on `geeksforgeeks.org/*`. Polls for "Problem Solved Successfully" text after submit button click, then uploads.
4. **Background service worker** (`background.js`) — handles `runtime.onMessage` for OAuth token storage (closes the auth tab, opens onboarding) and submission ID retrieval (listens for `webNavigation.onHistoryStateUpdated` to extract the LeetCode submission ID from URL changes).
5. **Popup** (`popup.html` + `popup.js`) — the extension toolbar popup: authentication, repo linking, stats display.
6. **Welcome/onboarding** (`welcome.html` + `welcome.js`) — shown after auth; create or link a GitHub repo.

### LeetCode submission flow (the core loop)

1. `MutationObserver` in `leetcode.js` detects the submit button appearing in the DOM
2. For v2: event listener on the button AND keyboard shortcut (Cmd/Ctrl+Enter) on the code textarea → sends `LEETCODE_SUBMISSION` message to background → background listens for `/submissions/(\d+)/` URL via `webNavigation.onHistoryStateUpdated` → returns submission ID
3. `LeetCodeV2.init()` queries LeetCode's GraphQL API (`submissionDetails` + `questionDetail`) using the page's cookie for auth — gets code, language, runtime/memory stats, difficulty, topic tags, question content, title slug
4. `loader()` polls `getSuccessStateAndUpdate()` every 1s (max 10 attempts), then uploads in parallel:
   - Problem README (if new) — markdown with question description
   - Solution code file — e.g. `0001-two-sum.js`
   - NOTES.md (if any notes exist)
   - Repo-level README updated with topic-tag grouping via `readmeTopics.js`
   - Stats incremented and persisted to `stats.json` on GitHub
5. The repo README uses comment markers (`<!--LeetCode Topics Start-->` / `End-->`) for stable topic-tag updates

### Version abstraction for LeetCode UI

LeetCode has two UIs, so the codebase uses a strategy pattern:
- `LeetCodeV1` — scrapes the old DOM (`class="success__3Ai7"`, `class="css-v3d350"`, etc.). Fetches code by parsing inline `<script>` tags for `pageData`.
- `LeetCodeV2` — uses the new dynamic UI. Queries LeetCode's GraphQL API directly. Falls back to DOM scraping for some fields.
- Both classes implement the same interface: `init()`, `findCode()`, `getLanguageExtension()`, `getProblemNameSlug()`, `getSuccessStateAndUpdate()`, `parseStats()`, `parseQuestion()`, `startSpinner()`, `markUploaded()`, `markUploadFailed()`

### Stats system

Stats are stored in **two places** and must stay in sync:
- `chrome.storage.local` — fast local access for the popup
- `stats.json` on GitHub — persistent, survives extension reinstall

On each submission, `incrementStats()` updates local stats, then `setPersistentStats()` pushes to GitHub. If GitHub returns 409 (conflict — stats were updated from another device), the code fetches the remote version, deep-merges via `mergeStats()`, and retries after a 500ms delay.

### Cross-browser compatibility

The `getBrowser()` utility (in `util.js`) detects `chrome` vs `browser` APIs at runtime. All browser API calls go through the `api` variable. The two manifests differ in one key way: Firefox uses `background.scripts` (array) while Chrome uses `background.service_worker` (string). Firefox also has `browser_specific_settings.gecko` for the extension ID.

### OAuth2 flow

Two files implement nearly identical OAuth2 logic (this is intentional — they run in different contexts):
- `scripts/oauth2.js` — runs in the popup; initiates the flow by opening a GitHub auth tab
- `scripts/authorize.js` — runs as a content script on `github.com/*`; captures the redirect, parses the code, exchanges for a token, sends it to the background worker

## Code conventions

- **Prettier**: 2-space tabs, 100-char width, semicolons, single quotes, ES5 trailing commas, `arrowParens: "avoid"`
- **ES modules** (`"type": "module"` in package.json) — all source uses `import`/`export`
- **Naming**: camelCase for files (e.g., `submitBtn.js`, `readmeTopics.js`)
- **Browser API**: Use the `getBrowser()` utility from `util.js` to detect `chrome` vs `browser` APIs at runtime. All browser API calls go through the returned `api` variable.
- **Message passing**: Content scripts communicate with the background worker via `api.runtime.sendMessage()`. The background worker's `handleMessage()` must return `true` for async responses.

### Testing

- **Framework**: Jasmine 5.1.0
- **Location**: `spec/` folder, files end with `.spec.js`
- **Imports**: ES module syntax (`import { func } from '../scripts/module.js'`)
- Tests run with `npm test` (just `jasmine`), config in `spec/support/jasmine.json`
- Only two test files exist: `spec/util.spec.js` and `spec/readmeTopics.spec.js`

### Content script lifecycle

Each content script in the manifest specifies `"run_at": "document_idle"` (LeetCode) or no explicit timing (GitHub, GFG default to `document_idle`). Content scripts must handle cross-origin restrictions and communicate via message passing.

### README topic-tag markers

The repo README uses comment markers for stable topic-tag management:
```
<!--LeetCode Topics Start-->
<!--LeetCode Topics End-->
```
`readmeTopics.js` appends problems under topic headings within these markers and sorts them by problem number.

## Dependencies

- **Build**: webpack 5.92.0, webpack-cli 5.1.4, copy-webpack-plugin 12.0.2, filemanager-webpack-plugin 8.0.0, ignore-loader 0.1.2
- **Testing**: jasmine 5.1.0, puppeteer 22.11.2
- **Formatting**: prettier 2.2.1
- **Types**: chrome-types 0.1.282, @types/firefox-webext-browser 120.0.4 (for editor intellisense, not used at runtime)
- **Runtime vendor libs**: jQuery 3.3.1, Semantic UI 2.4.1 (bundled as minified scripts for popup/welcome pages)
