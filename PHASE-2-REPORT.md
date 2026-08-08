# Phase 2 — GFG-Only Architecture Report

Date: 2026-08-07  
Branch: `gfg-phase-2`  
Baseline: Phase 1 audit at commit `d170701`

## Summary

The active extension runtime is now GFG-only. LeetCode content-script registration, webpack entry, background submission listener, source adapters, and LeetCode-only tests have been removed. Reusable browser, GitHub Contents API, storage, statistics, and language functionality now lives under `scripts/core/` and has no dependency on a LeetCode module.

The new bundled entry point is `scripts/gfg/index.js`. In Phase 2 it performs only three foundation tasks: initializes the browser/core dependencies, preserves the one-time legacy storage migration, and emits one initialization log. It does not inspect the GFG DOM, detect Submit, monitor a submission result, extract code, parse metadata, or trigger an upload.

GitHub OAuth, token storage, repository setup, popup state, onboarding, and legacy storage key names remain in place. No authentication rewrite or repository-layout redesign was performed.

## Architecture before

```text
Chrome/Firefox extension
  ├─ LeetCode content script (webpack entry)
  │   ├─ LeetCode V1/V2 DOM and GraphQL adapters
  │   ├─ submission detection
  │   ├─ GitHub upload implementation
  │   ├─ SHA and stats implementation
  │   └─ topic README implementation
  ├─ legacy GFG script (copied, not bundled)
  │   └─ depended on undefined global languages/uploadGit
  ├─ popup/welcome
  │   └─ imported browser utility from scripts/leetcode/util.js
  ├─ background
  │   ├─ OAuth completion
  │   └─ LEETCODE_SUBMISSION webNavigation listener
  └─ GitHub authorization content script
```

The old dependency direction was effectively:

```text
GFG (intended)
  → unavailable globals from LeetCode-owned code
  → GitHub
```

## Architecture after

```text
Browser extension
  ├─ scripts/gfg/index.js (bundled as scripts/gfg.js)
  │   └─ shared core
  │       ├─ browser.js
  │       ├─ github.js
  │       ├─ storage.js
  │       ├─ stats.js
  │       └─ languages.js
  ├─ popup.js
  │   └─ core/browser.js
  ├─ welcome.js
  │   └─ core/browser.js
  ├─ background.js
  │   └─ install and OAuth completion only
  ├─ authorize.js / oauth2.js
  │   └─ existing GitHub OAuth flow
  └─ GitHub API / extension storage
```

There is no GFG-to-LeetCode dependency. Webpack bundles the modules required by the GFG entry, while source-only `scripts/core/` and `scripts/gfg/` files are excluded from direct copying.

## New directory structure

```text
scripts/
├── core/
│   ├── browser.js
│   ├── github.js
│   ├── languages.js
│   ├── stats.js
│   └── storage.js
├── gfg/
│   └── index.js
├── authorize.js
├── background.js
├── oauth2.js
├── popup.js
├── welcome.js
└── vendor scripts
```

## Files added

- `scripts/core/browser.js`
- `scripts/core/github.js`
- `scripts/core/languages.js`
- `scripts/core/stats.js`
- `scripts/core/storage.js`
- `scripts/gfg/index.js`
- `PHASE-2-REPORT.md`

`PHASE-1-AUDIT.md` was preserved as the Phase 1 source of truth.

## Files modified

- `manifest-chrome.json`
- `manifest-firefox.json`
- `webpack.config.js`
- `package.json`
- `popup.html`
- `welcome.html`
- `scripts/background.js`
- `scripts/popup.js`
- `scripts/welcome.js`
- `spec/util.spec.js`

## Files deleted

- `scripts/gfg.js` — obsolete unbundled GFG implementation
- `scripts/leetcode/leetcode.js`
- `scripts/leetcode/readmeTopics.js`
- `scripts/leetcode/submitBtn.js`
- `scripts/leetcode/util.js`
- `scripts/leetcode/versions.js`
- `spec/readmeTopics.spec.js` — tests for deleted LeetCode topic-README behavior

The empty `scripts/leetcode/` directory no longer exists.

## Reusable code extracted

### Browser API

`scripts/core/browser.js` exports:

- `getBrowser()`
- `isChrome()`
- `isFirefox()`

Popup and onboarding now import `getBrowser` from core rather than from `scripts/leetcode/util.js`.

### GitHub Contents API

`scripts/core/github.js` exports:

- `uploadGit()` — future platform entry-facing create/update wrapper
- `uploadFile()` — lower-level Contents API PUT and SHA storage
- `getGitHubFile()` — Contents API GET
- `encodeContent()` / `decodeContent()` — UTF-8/base64 conversion
- `GitHubError`

`uploadGit()` retains the established storage contract:

```text
leethub_token
leethub_hook
mode_type === "commit"
stats.shas[directory][filename]
```

It resolves a cached SHA, creates/updates through GitHub's Contents API, stores the returned SHA, and retries a 409 conflict once after retrieving the remote SHA. Create requests now omit an empty SHA rather than transmitting `sha: ""`.

The module imports only generic core storage. It can be imported without a LeetCode adapter and is included in the GFG bundle through the Phase 2 runtime dependency object.

### Storage compatibility

`scripts/core/storage.js` centralizes the existing storage key names and exports:

- `STORAGE_KEYS`
- `getGitHubConnection()`
- `getStats()` / `setStats()`
- `migrateLegacySyncStorage()`

The old one-time `storage.sync` to `storage.local` migration formerly executed from the LeetCode content script. It now executes from the GFG entry and only fills local values that are absent, preventing an existing local authentication value from being overwritten.

No persistent key was renamed. `welcome.js` can read future `{gfg: ...}` persistent stats and still falls back to the legacy `{leetcode: ...}` field for compatibility.

### Statistics

`scripts/core/stats.js` contains:

- the difficulty enum and normalization
- empty stats initialization
- generic nested stats merging and count recalculation

The retained stats tests now import from core.

### Languages

`scripts/core/languages.js` exports an immutable mapping suitable for later GFG parsing. It includes at least C, C++, C#, Java, JavaScript/Javascript, Python/Python3, Go, and Kotlin, plus other extensions already supported by the baseline.

## LeetCode runtime removal

The following active behavior was removed:

- `https://leetcode.com/*` content-script matches from both manifests
- generated `scripts/leetcode.js`
- the webpack `leetcode` entry and output move
- `webNavigation` permission from both manifests
- `LEETCODE_SUBMISSION` message handling
- LeetCode `/submissions/` navigation listener
- V1/V2 LeetCode DOM adapters and GraphQL calls
- automatic and manual LeetCode submission handlers
- LeetCode code, metadata, accepted-state, notes, and discussion parsing
- LeetCode topic README generation and its tests

Repository history and Phase 1 documentation still describe the removed baseline. The root README is also still upstream-oriented; neither is an active runtime dependency.

## GFG foundation

### Active entry point

Source:

```text
scripts/gfg/index.js
```

Generated content script:

```text
dist/chrome/scripts/gfg.js
dist/firefox/scripts/gfg.js
```

Supported match patterns:

```text
https://www.geeksforgeeks.org/problems/*
https://geeksforgeeks.org/problems/*
```

The manifest does not request a broad `https://*/*` match. The old `practice.geeksforgeeks.org` route is no longer active.

The Phase 2 content script logs exactly:

```text
[GFGHub] GFG content script loaded
```

It intentionally contains no selectors, observers, submit listeners, editor access, or result parsing.

## Webpack changes

Entries are now:

```text
gfg     → scripts/gfg/index.js
welcome → scripts/welcome.js
popup   → scripts/popup.js
```

Webpack moves those bundles into `dist/scripts/`. Static background/auth/vendor scripts, UI files, styles, and assets continue to be copied. Core and GFG source directories are excluded because they are represented in the bundle. Phase reports are excluded from the extension package.

Both platform builds contain:

```text
scripts/background.js
scripts/gfg.js
scripts/popup.js
scripts/welcome.js
scripts/authorize.js
scripts/oauth2.js
```

No `scripts/leetcode.js` or `scripts/leetcode/` output exists.

## Build and test results

Environment: Node 24.12.0, npm 11.6.2.

| Check | Result | Details |
| --- | --- | --- |
| Safety branch | **PASS** | Created and switched to `gfg-phase-2`. |
| `npm run build` | **PASS** | webpack 5.92.0 compiled successfully. Existing warnings remain for the 269 KiB Semantic UI asset/performance recommendation. |
| `npm run lint-test` | **FAIL** | Exit 127: `eslint: command not found`. This pre-existing package-tooling defect remains; no lint dependency was added. |
| `npm test` | **PASS** | 6 specs, 0 failures, final seed `46026`. Two LeetCode topic-README specs were intentionally removed with that feature. |
| Chrome manifest parse/reference check | **PASS** | Version 2.0.9; all declared scripts, popup, and icons exist. |
| Firefox manifest parse/reference check | **PASS** | Version 2.0.9; all declared scripts, popup, and icons exist. |
| No active LeetCode references | **PASS** | No LeetCode entry, bundle, manifest match, background message, or `webNavigation` permission. |
| Shared GitHub module import | **PASS** | Independent module import exposes `uploadGit`, `uploadFile`, `getGitHubFile`, encoding helpers, and `GitHubError`. |

### Automated Chrome smoke checks

Using a clean headless Chrome profile with `dist/chrome` loaded:

- Manifest V3 service worker started successfully.
- Popup opened, displayed the GFG caption and unauthenticated mode, and reported no page errors.
- Onboarding opened in hook mode with the GFG caption and reported no page errors.
- A real public GFG problem page returned HTTP 200 and executed the GFG entry. Execution was confirmed by the entry's legacy migration writing `isSync: true` in extension storage; isolated content-script console output was not forwarded by headless Puppeteer.
- A clean profile visiting `https://leetcode.com/` retained only the install-time `sync_stats` value and did not run the GFG migration, confirming that the GFG entry was not injected there.

GitHub OAuth was not executed end-to-end because it requires external account consent and a real token. The popup auth control, `oauth2.js`, GitHub authorization content script, OAuth completion background handler, storage keys, and generated files remain present.

## Manual tests required

### A. Load the extension

1. Run `npm install` if dependencies are not already installed.
2. Run `npm run build`.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the absolute `dist/chrome` directory in this repository.
7. Confirm the extension loads without a manifest error.
8. Open the service-worker inspector and confirm there is no startup exception.

### B. Popup and onboarding

1. Click the extension icon.
2. Confirm the popup opens and says “Sync your code from GeeksforGeeks to GitHub.”
3. On a clean profile, confirm Authenticate mode is visible.
4. Open the onboarding page from the popup and confirm repository hook mode renders.

### C. LeetCode exclusion

1. Open `https://leetcode.com/`.
2. Inspect the page's Sources/Content scripts or console.
3. Confirm there is no `scripts/gfg.js`, `scripts/leetcode.js`, or `[GFGHub]` initialization log.
4. Submit activity on LeetCode should have no extension response.

### D. GFG foundation

1. Open a current problem such as `https://www.geeksforgeeks.org/problems/prerequisite-tasks/1`.
2. Open DevTools and select the extension content-script execution context if necessary.
3. Confirm one `[GFGHub] GFG content script loaded` message appears after a full page load.
4. Confirm no automatic GitHub upload occurs. That is the intended Phase 2 behavior.
5. Navigate to another problem through the site's UI and note the behavior for Phase 3 SPA lifecycle work; Phase 2 does not yet remount on route changes.

### E. Existing GitHub flow

Use a test GitHub account/repository because the inherited OAuth implementation requests `repo` scope and contains the Phase 1 security concerns.

1. Click Authenticate in the popup.
2. Complete GitHub consent and confirm onboarding reopens.
3. Confirm `leethub_token` and `leethub_username` are retained in local extension storage.
4. Link a disposable existing repository and confirm `leethub_hook` and `mode_type: "commit"` are retained.
5. Reopen the popup and confirm the repository and existing stats render.
6. Repository creation/linking is the only intended GitHub mutation in Phase 2; no GFG solution upload should occur.

### F. Firefox

1. Open `about:debugging` → **This Firefox**.
2. Choose **Load Temporary Add-on** and select `dist/firefox/manifest.json`.
3. Repeat popup and GFG initialization checks.
4. OAuth still inherits Chrome-global assumptions documented in Phase 1 and may require later compatibility work.

## Remaining issues

- `npm run lint-test` is still nonfunctional because ESLint/configuration is absent from the package.
- The inherited OAuth flow still exposes a client secret, lacks state/PKCE, constructs a malformed redirect parameter, and has incomplete Firefox compatibility. It was preserved rather than rewritten in this phase.
- GitHub upload concurrency, persistent stats ownership/namespace, broader error handling, and repository-root layout still need platform-level design before the upload trigger is enabled.
- Legacy storage names retain the `leethub_` prefix by design for compatibility.
- The LeetHub name and upstream-oriented root README remain. Runtime captions and manifest descriptions now identify GeeksforGeeks, but a complete branding pass was outside Phase 2.
- Live GitHub authentication/repository operations require manual testing with an external account.
- Firefox artifacts were structurally validated but not automatically launched.

## Explicitly not implemented

The following Phase 3+ functionality does not exist yet:

- GFG problem-page lifecycle detection
- SPA navigation handling
- Submit button or keyboard-submit detection
- submission-result monitoring
- Accepted-state detection
- code-editor extraction
- language extraction from the page/editor
- problem title, difficulty, statement, URL, or slug parsing
- GitHub upload trigger
- GFG repository folder/file naming policy
- GFG persistent stats upload format

## Exact Phase 3 recommendation

Start Phase 3 by implementing a small, independently testable GFG page lifecycle controller in `scripts/gfg/`:

1. Recognize supported `/problems/{slug}/...` routes from `location`, including initial load.
2. Observe SPA history/navigation and mount exactly one controller per problem route; cleanly unmount observers/listeners when the route changes.
3. Discover a stable Submit signal using current authenticated GFG markup or network behavior. Keep click and keyboard paths idempotent and avoid text-only/generated-class selectors where possible.
4. After Submit, monitor the smallest stable submission-result signal and emit an internal state transition only when the platform conclusively reports Accepted.
5. Add fixture-driven unit tests for route recognition, repeated mounts, SPA transitions, submit deduplication, timeout/rejected states, and accepted-state emission.
6. Stop at an internal `accepted` event. Do not extract editor code/metadata or call `uploadGit()` until those detection tests pass; code and metadata extraction should be the following phase.

This sequencing gives Phase 4 a trustworthy Accepted event to connect to editor/metadata extraction without coupling DOM churn directly to GitHub writes.
