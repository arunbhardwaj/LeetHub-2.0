# Phase 9 — Sync Notifications & Error Feedback

Date: 2026-08-08

## Changed Files

- `scripts/gfg/notification.js` — added the extension-owned, non-interactive toast UI.
- `scripts/gfg/feedback.js` — added Accepted-only feedback orchestration, outcome persistence, error copy, duplicate protection, and route-generation cleanup.
- `scripts/gfg/index.js` — connected the existing sync result to feedback and SPA/page cleanup.
- `scripts/gfg/sync.js` — split permission-denied and rate-limit normalization without changing upload behavior.
- `scripts/core/storage.js` — added source-free `last_sync_status` persistence and reset support.
- `scripts/popup.js`, `popup.html`, `css/popup.css` — render the latest success or failure even when setup is incomplete.
- `spec/gfgFeedback.spec.js`, `spec/gfgNotification.spec.js`, `spec/gfgSync.spec.js`, `spec/gfgStats.spec.js` — added notification, cleanup, error mapping, persistence, and reset coverage.

## Notification Behavior

Only Accepted attempts enter the feedback controller. It awaits the existing memoized GitHub sync result before displaying anything.

Success displays for six seconds:

```text
Synced to GitHub
Binary Search • Java
```

Failure displays the problem title beneath a short actionable message. The toast uses a namespaced extension-owned host, fixed positioning, text-only DOM writes, no event listeners, and `pointer-events: none`, so it cannot intercept the editor, Submit button, or judging UI.

The feedback controller memoizes each `attemptId`, producing one persisted outcome and one toast even if the result event is delivered repeatedly. SPA route cleanup removes the current toast and invalidates in-flight page notifications. The source-free outcome is still persisted for the popup if navigation occurs while sync is pending.

## Error Mapping

| Sync reason | User message |
| --- | --- |
| GitHub missing/not connected | GitHub connection required |
| Repository missing | Select a repository in the extension |
| HTTP 401 | GitHub authentication expired — connect again |
| HTTP 403 permission failure | GitHub permission denied |
| HTTP 403 with exhausted rate limit/retry header, or HTTP 429 | GitHub rate limit reached — try again later |
| Repository unavailable | Repository not found — select another repository |
| Network failure | Sync failed — check your connection |
| Other GitHub API failure | GitHub API failure — try again |

No token, source code, response body, stack trace, or raw API error is stored or rendered.

The popup reads `last_sync_status` with this shape:

```js
{
  title: "Binary Search",
  slug: "binary-search",
  language: "java",
  repository: "owner/gfg-solutions",
  status: "success" | "failed",
  reason: null | "repository_not_selected",
  message: "Synced to GitHub",
  syncedAt: 1786176000000
}
```

## Checks

- `npm run build`: **PASS**. Existing Semantic UI bundle-size warnings only.
- `npm test`: **PASS**. 75 specs, 0 failures.
- `npm run lint`: **UNAVAILABLE**. The declared command fails before linting because `eslint` is not installed (`sh: eslint: command not found`).
- Targeted Prettier check: **PASS**.
- `git diff --check`: **PASS**.

## Known Issues

- Toast appearance and live API failures were not manually validated on a real GFG submission during automated testing.
- The popup reflects the latest outcome when it is opened or reopened; it does not remain open during normal page submission flow.
- Retry was not added. A safe retry must retain the immutable captured attempt only in the active page lifecycle and define behavior after SPA navigation or reload; adding that policy would be significant enough for a later phase.

## Phase 10 Recommendation

Add an in-page retry affordance backed only by the immutable captured attempt, plus a small bounded sync history and end-to-end Chrome/Firefox testing against a disposable repository.

Phase 10 was not started.
