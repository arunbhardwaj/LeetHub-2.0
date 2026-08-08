# Phase 8 — GitHub Setup & Repository UX

Date: 2026-08-08

## Changed Files

- `scripts/core/githubSetup.js` — added testable GitHub connection, writable-repository listing, repository validation, creation, persistence, and setup-state helpers.
- `scripts/popup.js`, `popup.html`, `css/popup.css` — added explicit GitHub connection states, actionable repository setup, selected-repository display, Ready status, and repository-change access.
- `scripts/welcome.js`, `welcome.html`, `css/welcome.css` — replaced the legacy hook screen with GFGHub repository selection and creation UX.
- `scripts/oauth2.js`, `scripts/authorize.js`, `scripts/background.js` — persisted connecting/connected/failed authentication state and made OAuth failure handling visible to extension pages.
- `manifest-chrome.json`, `manifest-firefox.json` — changed the user-visible extension name to GFGHub and removed the obsolete LeetHub homepage.
- `spec/githubSetup.spec.js`, `spec/githubSync.spec.js`, `spec/gfgSync.spec.js` — added setup, validation, persistence, stats-preservation, and missing-setup coverage.

## Setup Flow

1. A fresh popup shows `GitHub: Not Connected` and a **Connect GitHub** action.
2. Starting OAuth persists `github_auth_status: "connecting"`; the popup and setup page show `Connecting`.
3. Successful OAuth stores the existing legacy token/username keys for compatibility and marks the state `connected`. Failed OAuth marks it `failed`; tokens are never rendered.
4. The setup page lists up to 100 existing repositories returned by GitHub where `push`, `maintain`, or `admin` permission is present. It does not preselect a repository.
5. Users can select from that list, enter `owner/name`, or create a new private repository.
6. Existing repository choices are fetched from GitHub and checked for write permission before the legacy `leethub_hook` and `mode_type` keys are updated.
7. A valid selection produces `GitHub: Connected`, the selected repository, and `Sync: Ready` in the popup.
8. **Change Repository** opens the same validated setup flow. The current working repository remains saved unless and until the replacement validates successfully.

Repository changes do not read, remove, replace, or reset the Phase 7 `stats` or `last_successful_sync` keys.

Accepted submissions with no token or repository continue to return a normalized failure from the existing sync boundary. Missing repository configuration performs no GitHub read/write and does not record solved stats.

## Checks

- `npm run build`: **PASS**. Existing Semantic UI bundle-size warnings only.
- `npm test`: **PASS**. 69 specs, 0 failures.
- `npm run lint`: **UNAVAILABLE**. The declared command fails before linting because `eslint` is not installed (`sh: eslint: command not found`).
- Targeted Prettier check: **PASS**.
- `git diff --check`: **PASS**.

## Known Issues

- Live OAuth and repository mutation were not exercised against a real GitHub account during automated tests.
- The writable-repository picker loads the first 100 recently updated repositories. Users with more repositories can still enter any valid `owner/name` manually.
- The existing OAuth architecture still completes through the GitHub-page content-script redirect; Phase 8 improved its state/error handling without replacing that established authorization pipeline.

## Phase 9 Recommendation

Add persistent user-visible sync outcomes for success, partial upload, failure, and retry, then validate the complete install-to-Accepted flow with Chrome and Firefox against a disposable private repository.

Phase 9 was not started.
