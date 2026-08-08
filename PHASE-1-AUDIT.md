# Phase 1 — Audit and Stabilize LeetHub 2.0

Audit date: 2026-08-07  
Baseline commit: `d170701` (`main`)  
Scope: inspection, build verification, and documentation only. No Phase 2 conversion was implemented.

## Executive summary

The checked-out project installs and builds successfully without source changes. Webpack produces loadable Chrome and Firefox directory trees, and an automated clean-profile Chrome smoke test successfully started the Manifest V3 service worker and opened both the popup and onboarding page without page errors.

The existing LeetCode implementation is a webpack bundle containing both LeetCode scraping/API logic and otherwise reusable GitHub, storage, encoding, and statistics logic. The existing GFG implementation is copied directly rather than bundled. It is not operational in the present architecture: the manifest only injects it on the legacy `practice.geeksforgeeks.org` host, while current public problem pages use `www.geeksforgeeks.org/problems/...`, and the script references `languages` and `uploadGit` globals that are not defined in its content-script world.

No source fix was needed to establish a build baseline. The lint command is broken because `eslint` is not declared or installed. This and the runtime defects below are documented rather than repaired, in accordance with the Phase 1 limits.

## 1. Project architecture

### Source layout

| Component | Responsibility |
| --- | --- |
| `manifest-chrome.json` | Chrome Manifest V3 definition; service worker, popup, LeetCode/GitHub/GFG content scripts. |
| `manifest-firefox.json` | Firefox Manifest V3 definition; uses `background.scripts` and a Gecko extension ID. |
| `webpack.config.js` | Bundles `leetcode`, `welcome`, and `popup`; copies static scripts/assets; creates root, Chrome, and Firefox outputs. |
| `scripts/background.js` | Installation initialization, OAuth completion, tab handling, and LeetCode submission-ID navigation listener. |
| `scripts/oauth2.js` | Starts GitHub OAuth from the popup. |
| `scripts/authorize.js` | Runs on GitHub, exchanges the OAuth code for a token, retrieves the username, and reports completion to the background script. |
| `scripts/welcome.js` | Creates or links a GitHub repository, syncs persistent stats, unlinks a repository, and drives onboarding UI. |
| `scripts/popup.js` | Validates the GitHub token, selects popup mode, shows repository/stats, and resets local stats. |
| `scripts/leetcode/leetcode.js` | Main LeetCode submission orchestration plus GitHub upload, SHA, README, and stats logic. |
| `scripts/leetcode/versions.js` | Old and current LeetCode adapters: accepted-state detection, GraphQL/DOM extraction, formatting, and progress UI. |
| `scripts/leetcode/submitBtn.js` | Adds the manual “Sync w/ LeetHub” control on submission detail pages. |
| `scripts/leetcode/readmeTopics.js` | Adds and sorts LeetCode topic tables in the repository README. |
| `scripts/leetcode/util.js` | Browser selection, language mapping, difficulty normalization, encoding-adjacent helpers, debounce/delay, errors, and stats merging. |
| `scripts/gfg.js` | Legacy, standalone GFG DOM monitor and attempted uploader. |
| `popup.html`, `welcome.html`, `css/*` | Popup/onboarding markup and styles. |
| `spec/*` | Eight Jasmine specs covering stats merging and README topic insertion. |

### Runtime surfaces

```text
Popup (popup.html + bundled popup.js)
  ├─ no token → OAuth starter (oauth2.js)
  ├─ valid token + no repo → onboarding (welcome.html + bundled welcome.js)
  └─ valid token + linked repo → repository link and local stats

GitHub page content script (authorize.js)
  └─ OAuth redirect/code exchange → background.js → local storage + onboarding tab

LeetCode content script (bundled scripts/leetcode.js)
  └─ submission detection/extraction → GitHub Contents API → stats + repository README

Legacy GFG content script (copied scripts/gfg.js)
  └─ old DOM polling → attempts to call unavailable upload globals
```

### Chrome/Firefox compatibility

- `getBrowser()` in `scripts/leetcode/util.js` returns `chrome` or `browser`; the bundled LeetCode, popup, and welcome code uses it.
- `scripts/background.js` independently chooses `chrome` or `browser`.
- `scripts/gfg.js`, `scripts/oauth2.js`, and `scripts/authorize.js` hard-code `chrome`, so the advertised Firefox build is not fully browser-neutral.
- Chrome uses `background.service_worker`; Firefox uses `background.scripts` and declares `browser_specific_settings.gecko`.

## 2. Current submission flow

### LeetCode V2 automatic flow

```text
LeetCode problem page
  → MutationObserver finds the submit button and editor textarea
  → click or Ctrl/Cmd+Enter calls v2SubmissionHandler()
  → content script sends LEETCODE_SUBMISSION to background.js
  → background webNavigation listener waits for a /submissions/{id}/ history URL
  → submission ID returns to the content script
  → loader() polls for the submission-result element
  → LeetCodeV2.init() issues two authenticated LeetCode GraphQL requests
      1. submission details: code, language, runtime, memory, question data
      2. question details: frontend problem ID
  → adapters format slug, README HTML, difficulty, stats text, and filename
  → uploadGitWith409Retry() uploads problem README and solution
  → updateReadmeTopicTagsWithProblem() updates repository-level topic tables
  → incrementStats() updates local counts for a newly completed problem
  → setPersistentStats() attempts to write repository-root stats.json
  → popup/welcome read local stats and display totals
```

Detection is implemented in `scripts/leetcode/leetcode.js` (`submitBtnObserver`, `v2SubmissionHandler`, and `loader`) with submission-ID assistance from `scripts/background.js`. `LeetCodeV2.init()` in `versions.js` extracts code and most metadata from `https://leetcode.com/graphql/`; it does not read submitted code directly from the editor. `LeetCodeV2.getSuccessStateAndUpdate()` decides success from the presence of `[data-e2e-locator="submission-result"]`.

### Other LeetCode paths

- V1: a click on `[data-cy="submit-code-btn"]` starts `loader()`. The adapter scrapes old LeetCode class names and may fetch/parse a submission HTML page containing `pageData`.
- Manual upload: `submitBtn.js` inserts a “Sync w/ LeetHub” button on `/submissions/{id}` pages; clicking it reads the ID from the URL and uses the V2 flow.
- Notes: implemented only in the V1 adapter. V2 `getNotesIfAny()` is empty.
- Discussion links: a document-wide click handler attempts to prepend new LeetCode discussion URLs to a problem README.

### Upload call chain

The current code does not define an `uploadGit(...)` function. The active LeetCode equivalent is:

```text
loader()
  → uploadGitWith409Retry(encodedContent, directory, filename, message, options)
      → read leethub_token, mode_type, leethub_hook, stats
      → choose cached SHA from stats.shas[directory][filename]
      → upload(token, hook, content, directory, filename, sha, message)
          → PUT /repos/{owner}/{repo}/contents/{path}
          → save returned content.sha in local stats
      → on HTTP 409 only:
          → getGitHubFile() fetches current SHA
          → retry upload() with current SHA
```

Problem README, notes, solution, and repository topic README operations are launched together with `Promise.all`. Persistent stats are written afterward only for a problem not already marked complete.

## 3. GitHub integration

### Authentication

1. Popup `oauth2.js` sets `pipe_leethub = true` and opens GitHub's OAuth authorize endpoint with `repo` scope.
2. The `authorize.js` content script runs on GitHub. While the pipe is open it parses the returned `code`.
3. It POSTs the code, client ID, and client secret to GitHub's access-token endpoint.
4. It calls `GET https://api.github.com/user` to obtain the login.
5. It sends `{closeWebPage, isSuccess, token, username}` to `background.js`.
6. The background script writes `leethub_token`, `leethub_username`, closes the pipe, closes an active tab, and opens `welcome.html`.

Important: the OAuth client ID and client secret are committed in both browser-delivered scripts. A browser extension cannot keep a client secret confidential. Their literal values are intentionally omitted from this report. The constructed authorization URL also lacks `=` after `redirect_uri`, so GitHub receives a malformed parameter name; the configured OAuth callback may be masking this.

### Repository selection

- Create: `POST https://api.github.com/user/repos` with `private: true`, `auto_init: true`, and the LeetHub description. On success it stores `mode_type = "commit"`, stores `leethub_hook = full_name`, and removes old stats.
- Link: `GET https://api.github.com/repos/{owner}/{repo}`. The UI only accepts a repository name and prefixes the authenticated username, so it cannot select an arbitrary organization/other-owner repository through the current form. On success it stores `mode_type`, `repo`, and `leethub_hook`.
- Unlink: resets `mode_type` to `hook`, clears `leethub_hook`/`stats`, and enables a future persistent-stats sync.

### GitHub API endpoints

| Endpoint | Method | Use |
| --- | --- | --- |
| `github.com/login/oauth/authorize` | browser navigation | Ask for OAuth `repo` authorization. |
| `github.com/login/oauth/access_token` | POST | Exchange code for token in `authorize.js`. |
| `api.github.com/user` | GET | Validate token and obtain username. |
| `api.github.com/user/repos` | POST | Create a private, auto-initialized repository. |
| `api.github.com/repos/{owner}/{repo}` | GET | Validate/link a repository. |
| `api.github.com/repos/{owner}/{repo}/contents/{path}` | GET | Fetch content and current SHA. |
| Same Contents endpoint | PUT | Create/update README, solution, notes, and `stats.json`. |

### File creation, updates, and SHA handling

- Content is UTF-8-to-base64 encoded before a Contents API PUT.
- Repository paths are `{problemSlug}/{filename}`. Root files are represented by passing the root filename as `problem` and an empty `filename`.
- Returned `body.content.sha` is cached at `stats.shas[problem][filename]`.
- An update normally uses the cached SHA. A 409 response triggers a GET and one retry with the remote SHA.
- Commit messages are generated from fixed strings or LeetCode runtime/memory text. Examples: `Create README - LeetHub`, runtime/memory details ending in `- LeetHub`, `Update README - Topic Tags`, and `Updated stats`.
- Repository statistics persist as root `stats.json` with shape `{ "leetcode": <local stats> }`.

### Generic/reusable versus LeetCode-specific

| Area | Classification | Notes |
| --- | --- | --- |
| `getBrowser`, `delay`, error type, base64 helpers | GENERIC / REUSABLE | Encoding helpers currently live in `leetcode.js`; browser/delay/error helpers live in `leetcode/util.js`. |
| GitHub Contents GET/PUT and 409 retry | GENERIC / REUSABLE | Currently private to the LeetCode bundle and coupled to LeetCode-named storage keys/stats updates. |
| OAuth, token validation, repo creation/link/unlink | GENERIC / REUSABLE | Branding, scope, storage names, and browser-global use need later separation/hardening. |
| SHA map and storage access | GENERIC / REUSABLE | Data model can support another platform, but the persistent JSON is currently `leetcode`-only. |
| Popup repository display and aggregate counters | GENERIC / REUSABLE | Labels/branding are LeetCode-specific; mechanics are reusable. |
| `mergeStats`, difficulty enum/normalization | GENERIC / REUSABLE | Located under `scripts/leetcode`; language map is partly reusable but platform labels differ. |
| Submission observers, background `LEETCODE_SUBMISSION`, GraphQL, DOM selectors | LEETCODE SPECIFIC | Replace for a GFG-only architecture later. |
| V1/V2 adapters, slug numbering, runtime message formatting | LEETCODE SPECIFIC | Based on LeetCode APIs, DOM, and semantics. |
| Topic README section and `master` links | LEETCODE SPECIFIC | Markers, heading, URLs, and sorting assume numbered LeetCode slugs. |
| Notes/discussion integration and progress UI anchors | LEETCODE SPECIFIC | Bound to LeetCode DOM and routes. |

## 4. Storage keys

All current runtime writes use `storage.local`. A one-time migration in `leetcode.js` reads several legacy values from `storage.sync`, but current code does not write them back to sync storage.

| Key | Purpose and shape | Written by | Read by | Phase 2 disposition |
| --- | --- | --- | --- | --- |
| `leethub_token` | GitHub OAuth access token. | `background.js`; popup sets `null` after a 401; legacy sync migration. | Popup, welcome, LeetCode uploader. | Reuse concept; secure and centralize. |
| `leethub_username` | GitHub login. | `background.js`; migration. | Welcome when forming `owner/repo`. | Reuse. |
| `pipe_leethub` | Boolean guard indicating an OAuth redirect is expected. | `oauth2.js`, `background.js`, migration. | `authorize.js`. | Reuse concept, preferably with state/PKCE. |
| `leethub_hook` | Selected repository as `owner/repo`; `null` when unlinked. | Welcome, migration. | Popup, welcome, uploader. | Reuse. |
| `mode_type` | UI/repository mode: `hook` or `commit`. | Welcome, migration. | Popup, welcome, uploader. | Reuse or replace with explicit connection state. |
| `stats` | `{solved,easy,medium,hard,shas}`; each problem SHA map also carries `difficulty`. | Uploader/stats logic, welcome sync/unlink, popup reset, migration. | Popup, welcome, LeetCode, GFG. | Reuse data concepts; namespace platform data. |
| `sync_stats` | Whether linking should pull repository `stats.json`. | Install handler; welcome sync/unlink. | Welcome. | Reuse. |
| `repo` | Full GitHub HTML URL for a linked repository. | Welcome link flow only. | No current reader found. | Remove later if confirmed obsolete. |
| `isSync` | One-time flag for migration from `storage.sync` to `storage.local`. | LeetCode bundle. | LeetCode bundle. | Treat as migration-only legacy state. |

Popup behavior: token absent/invalid shows authentication; valid token plus `mode_type === "commit"` shows repository and counters; otherwise it shows repository setup. Reset sets `stats` to `null` and zeros the displayed counters. Welcome drives create/link/unlink and displays the same counters.

## 5. LeetCode-specific components

- Both adapters and every selector/API query in `scripts/leetcode/versions.js`.
- Submit detection, accepted polling, submission-ID acquisition, manual submit UI, notes/discussion behavior, slug construction, and topic tagging.
- `LEETCODE_SUBMISSION` and the LeetCode `/submissions/` web-navigation listener in `background.js`.
- LeetCode content-script match in both manifests.
- Repository README copy, LeetCode topic markers/heading, runtime/memory commit messages, and `stats.json.leetcode` namespace.
- LeetCode-specific popup/onboarding text and outbound links (retain during Phase 1).

These are candidates for replacement, not deletion, during Phase 2 planning.

## 6. Reusable components hidden inside LeetCode

- `scripts/leetcode/leetcode.js`: `getPath`, UTF-8/base64 `encode`/`decode`, `upload`, `getGitHubFile`, retry logic, SHA caching, stats initialization/increment, and persistent stats synchronization.
- `scripts/leetcode/util.js`: `getBrowser`, `LeetHubError`, `debounce`, `delay`, object helpers, difficulty normalization, language extension map, and `mergeStats`.
- `scripts/welcome.js`: GitHub repository create/link verification, persistent-stat pull, and connection-state transitions.
- `scripts/popup.js`: authentication validation and stats/repository display mechanics.
- `scripts/oauth2.js`, `scripts/authorize.js`, `scripts/background.js`: the OAuth lifecycle is conceptually reusable, although its current security and browser-compatibility problems must be addressed.

The GFG script cannot reuse any of these today because it is copied as an independent classic content script. Webpack keeps bundled functions module-scoped, and the manifests inject LeetCode and GFG scripts on different hosts.

## 7. Existing GFG implementation

`scripts/gfg.js` is a 1-second polling script intended for URLs containing `practice.geeksforgeeks.org/problems`.

1. It locates a button whose exact visible text is `Submit` using XPath and adds a click handler.
2. After a click it polls the first `[class^="problems_content"]` element every second.
3. It treats text containing `Problem Solved Successfully` as accepted; `Compilation Error` stops polling.
4. It reads the title from `[class^="problems_header_content__title"] > h3`.
5. It reads difficulty from the first child of `[class^="problems_header_description"]`, mapping `Basic` and `School` to `Easy`.
6. It serializes `[class^="problems_problem_content"]` as the problem statement.
7. It expects an Ace editor at `ace-editor`. An injected inline page script calls `ace.edit(...).getValue()` and bridges the code back through a temporary `<pre>`.
8. It reads language text from `.divider.text`, then expects a global `languages` lookup.
9. It builds a directory named `${title} - GFG`, a README, and a kebab-cased solution filename.
10. It reads a cached SHA from `stats`, but never passes that SHA to the uploader. It attempts two calls to a global `uploadGit(...)` separated by one second.

The script does not extract or preserve the problem URL. It does not increment statistics or persist a GFG stats namespace.

## 8. Existing GFG problems

### Confirmed blockers

- **Host no longer matches current problem pages.** Both manifests only match `https://practice.geeksforgeeks.org/*`; current public problems resolve under `https://www.geeksforgeeks.org/problems/...`. Consequently `gfg.js` is not injected on the current route.
- **`languages` is undefined.** It is exported by `scripts/leetcode/util.js`, but `gfg.js` has no import and is not bundled with that module.
- **`uploadGit` is undefined.** No source file defines that name. The LeetCode bundle exposes `uploadGitWith409Retry` only inside webpack/module scope, on a different host.
- **Firefox compatibility is incomplete.** The script calls `chrome.storage` directly.

### Brittle or obsolete assumptions

- Hash-prefixed selectors (`problems_header_*`, `problems_content`, `problems_problem_content`) are build-generated class-name assumptions from an older GFG UI.
- The exact XPath `button[text()='Submit']` misses nested labels, whitespace changes, alternate controls, and keyboard submission.
- Ace and the fixed `ace-editor` ID are assumed. The script neither detects another editor nor handles editor/API evolution.
- Inline page-script injection can be restricted by page CSP and leaves duplicate `tmpScript` elements; there is no robust isolated-world bridge.
- A missing submit button or output element causes a null/undefined dereference. No `try/catch` protects the polling callback.
- The outer interval attaches another click listener every second to the same button; one click can create many submission pollers and duplicate uploads.
- The outer loader is permanently cleared after the first accepted result, which is incompatible with continued SPA navigation.
- Only compilation errors are handled explicitly. Other rejected states, network failures, and upload rejections are ignored.
- README is attempted on every success without its existing SHA; the computed solution SHA and `filePath` are unused. Re-submissions are therefore not update-safe.
- `UPDATE_MSG` is unused; upload promises are neither awaited nor caught; no success/failure UI is shown.

### Current-site verification boundary

A current official GFG problem page confirms the active `/problems/...` route and exposes title/difficulty/problem content to normal page readers. The editor and authenticated submission-result DOM require a logged-in interactive session, so exact replacement selectors/editor APIs must be captured during Phase 2 rather than guessed in Phase 1.

## 9. Existing bugs and architectural risks

### High priority

1. **OAuth secret shipped to every user.** `CLIENT_SECRET` is committed and copied to `dist`; it cannot be confidential. The flow also has no OAuth `state` validation or PKCE.
2. **Persistent stats update uses the wrong SHA lookup.** `setPersistentStats()` reads `stats.shas['README.md']['']`, while uploading `stats.json` records its SHA at `stats.shas['stats.json']['']`. Subsequent `stats.json` updates can be sent without the required SHA; only 409 is retried, while GitHub commonly reports missing-SHA updates as 422.
3. **V2 accepted detection does not inspect accepted status.** Any element matching `[data-e2e-locator="submission-result"]` is treated as success, so a rejected result may proceed to upload.
4. **Concurrent uploads can lose SHA state.** README, code, notes, and root README updates run concurrently. Each successful `upload()` reads and rewrites the entire local `stats` object, allowing last-writer-wins loss of another upload's SHA.
5. **Background submission listener is global and under-filtered.** Each request adds a navigation listener not scoped to the sender tab. Its URL filter has separate broad alternatives, and its regex dereferences an assumed match. Concurrent tabs or unrelated history changes can return the wrong ID or throw.
6. **GFG is nonfunctional** for the confirmed host/global-dependency reasons in section 8.

### Medium priority

- OAuth authorization URL has malformed `redirect_uri` syntax. The completion flow closes whichever tab is active in the last-focused window instead of `sender.tab`, which can close the wrong tab.
- The background service worker calls `alert()` on OAuth failure; `alert` is not available in a service-worker context.
- OAuth and authorization scripts hard-code Chrome APIs, undermining Firefox support.
- Repository-root README recovery creates a missing README and then unconditionally rethrows the original 404, failing the surrounding submission.
- Topic links hard-code the `master` branch. Repositories whose default branch is `main` get broken links.
- Existing-repository selection assumes the authenticated user's namespace and does not verify push permission beyond a successful repository GET.
- `upload()` includes an empty `sha` property for creates instead of omitting it and only retries 409, making API error handling narrow.
- Error handling often only marks UI failure or logs; it does not expose actionable GitHub response details to the user.
- The legacy V1 adapter uses many obsolete hashed LeetCode classes and contains an undeclared loop variable in notes parsing.
- `isSync` migrates potentially undefined legacy sync values over local values once; there is no versioned migration.
- Popup reset changes local stats only. The old repository `stats.json` can later be pulled again after unlink/relink.

### Tooling/test gaps

- `npm run lint-test` cannot run because `eslint` is absent from `devDependencies`.
- Tests cover only `mergeStats` and part of README topic insertion. The topic-sort suite is commented out.
- There are no tests for GitHub API behavior, OAuth, storage migrations, submission state detection, GFG, manifests, or popup/onboarding flows.
- The package does not declare a Node/npm engine. This audit used Node 24.12.0 and npm 11.6.2.

## 10. Webpack and build output

### Entry points and copying

Webpack entries are:

- `leetcode` → `scripts/leetcode/leetcode.js` and its imported modules
- `welcome` → `scripts/welcome.js` plus `leetcode/util.js`
- `popup` → `scripts/popup.js` plus `leetcode/util.js`

Webpack emits these at the root, then FileManagerPlugin moves them to `dist/scripts/{leetcode,welcome,popup}.js`. CopyWebpackPlugin copies other scripts directly, including `background.js`, `authorize.js`, `oauth2.js`, vendor scripts, and `gfg.js`. It excludes the entire source `scripts/leetcode/` tree because that code is already bundled.

It transforms source manifests by removing `//` comment lines, parsing JSON, and replacing the manifest version with npm package version `2.0.9`. It creates:

- `dist/manifest.json` plus a complete root Chrome-style build
- `dist/chrome/manifest.json` plus a complete Chrome build
- `dist/firefox/manifest.json` plus a complete Firefox build

The directory to load unpacked in Chrome is **`dist/chrome`**. `dist` also contains a Chrome manifest, but `dist/chrome` is the explicit platform output and avoids ambiguity.

`gfg.js` has no imports or webpack entry and is simply copied. It therefore shares no module scope with `leetcode.js`. Later removal of LeetCode must account for popup/welcome imports from `scripts/leetcode/util.js`, not merely delete the LeetCode entry/directory.

### Artifact verification

All three generated manifests parse as JSON with version `2.0.9`. For both platform directories, the declared popup, background entry, content scripts, and icon files exist. The HTML-referenced `scripts/oauth2.js`, `scripts/popup.js`, `scripts/welcome.js`, jQuery, Semantic UI JS, and CSS files also exist.

## 11. Build/test status

| Check | Result | Evidence/notes |
| --- | --- | --- |
| `npm install` | **PASS** | Added 360 packages. Warnings only for deprecated transitive `rimraf@3` and `glob@7`. npm rewrote lock metadata locally; that incidental diff was reverted. |
| `npm run build` | **PASS** | webpack 5.92.0 completed; only asset-size/performance warnings for the 269 KiB Semantic UI bundle. |
| `npm run lint-test` | **FAIL** | Exit 127: `eslint: command not found`; package script exists but ESLint is not declared. |
| `npm test` | **PASS** | 8 specs, 0 failures; randomized seed `98659`. |
| Chrome build generated | **PASS** | `dist/chrome` exists with complete artifact tree. |
| Firefox build generated | **PASS** | `dist/firefox` exists with complete artifact tree. |
| Generated manifests valid | **PASS** | JSON parsed; referenced files exist. |
| Chrome service worker starts | **PASS** | Headless Chrome loaded `dist/chrome` and registered `scripts/background.js`. |
| Popup loads | **PASS (smoke)** | Clean-profile headless Chrome showed `LeetHub v2`, displayed auth mode, and reported no page errors. |
| Welcome page loads | **PASS (smoke)** | Clean-profile headless Chrome displayed hook mode and reported no page errors. |
| GitHub auth flow | **IDENTIFIED, NOT LIVE-EXECUTED** | Requires interactive external account consent; security issues above should be considered first. |
| Repository flow | **IDENTIFIED, NOT LIVE-EXECUTED** | Would create/link or mutate a real GitHub repository. |
| LeetCode upload flow | **IDENTIFIED, NOT LIVE-EXECUTED** | Requires authenticated LeetCode submission and GitHub mutation. |
| Existing GFG implementation | **ANALYZED; RUNTIME FAIL EXPECTED** | Current host is unmatched and required globals are absent. |
| Firefox runtime | **NOT EXECUTED** | Artifact presence verified only. |

No source code was changed to obtain these results.

## 12. Manual verification checklist

Use a test GitHub account/repository because the current OAuth design exposes its client secret and requests full `repo` scope.

1. Run `npm install` and `npm run build` from the project root.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the absolute `dist/chrome` directory from this repository.
5. Confirm LeetHub v2 appears and that its service worker console has no startup error.
6. Open the popup. Confirm the Authenticate mode appears on a clean profile.
7. If proceeding with OAuth, authenticate and confirm the browser returns to GitHub, the redirect tab closes, and `welcome.html` opens. Watch for the malformed redirect/tab-closing issues noted above.
8. In welcome, first link a disposable existing repository, then verify the popup shows its `owner/repo`. Separately test private repository creation only if a new repository is intended.
9. On a LeetCode problem, submit an accepted solution by button and keyboard. Confirm the repository receives `{number}-{slug}/README.md`, the solution file, root README topic updates, and root `stats.json`.
10. Resubmit the same problem and verify files update rather than duplicate/fail. Inspect the extension/content-script console and GitHub commits for 409/422 or lost-SHA behavior.
11. Submit a rejected solution and confirm whether it is incorrectly uploaded due to the V2 result-element check.
12. Open a current GFG URL such as `https://www.geeksforgeeks.org/problems/prerequisite-tasks/1`. Confirm the current Phase 1 extension does not inject `gfg.js`; this is an expected documented defect, not a Phase 1 fix.
13. For Firefox, load `dist/firefox/manifest.json` via `about:debugging` → **This Firefox** → **Load Temporary Add-on**, then repeat popup/onboarding checks. Expect Chrome-global limitations in GFG/OAuth scripts.

## 13. Recommended Phase 2 starting point

Recommendations only; none are implemented here.

1. Capture the current authenticated GFG problem/editor/submission DOM and network behavior before choosing selectors or an extraction API.
2. Extract a shared core for browser API selection, storage, UTF-8/base64 conversion, GitHub Contents API, SHA conflict handling, repository state, and platform-namespaced stats.
3. Replace the browser-shipped OAuth secret flow with an extension-appropriate design (for example, a trusted backend or a supported public-client flow with state/PKCE where applicable), and rotate/revoke the exposed credential.
4. Build a bundled GFG adapter that explicitly imports shared dependencies; do not rely on globals or cross-content-script scope.
5. Update manifest matches to the verified current GFG routes and add only the minimum permissions required.
6. Make submission detection idempotent and SPA-safe, and derive accepted state from a stable response/state signal rather than display text alone.
7. Serialize or atomically merge GitHub uploads/SHA state; fix persistent `stats.json` SHA ownership and broaden structured API error handling.
8. Add fixture/unit tests for GFG extraction and integration tests for create/update/retry/stats flows before removing LeetCode code.
9. Add ESLint as a pinned development dependency or remove the nonfunctional lint scripts after deciding the intended lint configuration.

## Files inspected

- Root/build: `.gitignore`, `.prettierrc`, `README.md`, `package.json`, `package-lock.json`, `webpack.config.js`, `manifest-chrome.json`, `manifest-firefox.json`
- UI: `popup.html`, `welcome.html`, `css/popup.css`, `css/welcome.css`
- Runtime: `scripts/background.js`, `scripts/popup.js`, `scripts/welcome.js`, `scripts/oauth2.js`, `scripts/authorize.js`, `scripts/gfg.js`
- LeetCode: every file in `scripts/leetcode/`
- Tests: `spec/util.spec.js`, `spec/readmeTopics.spec.js`, `spec/support/jasmine.json`
- Generated output: complete file inventory under `dist`, with explicit manifest/reference validation for `dist`, `dist/chrome`, and `dist/firefox`
- Static assets/vendor files: inventoried and verified as copied where applicable; minified vendor internals and binary image pixels were not source-audited.

## Files modified

- `PHASE-1-AUDIT.md` — added this requested audit report.

No application source, manifest, package definition, or repository structure was changed.
