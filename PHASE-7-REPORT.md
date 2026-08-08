# Phase 7 — GFG Stats + Sync Status Popup

Date: 2026-08-08

## Changed Files

- `scripts/core/stats.js` — added unique GFG slug accounting.
- `scripts/core/storage.js` — added serialized stats writes, last-sync persistence, and stats-only reset.
- `scripts/core/github.js` — routed the existing SHA-cache update through the serialized stats writer.
- `scripts/gfg/sync.js` — records stats only after both GitHub file syncs succeed.
- `scripts/popup.js` — renders GFG stats/last sync and resets local GFG stats.
- `popup.html`, `css/popup.css` — added the simple GFG status view and removed visible LeetCode/LeetHub wording.
- `spec/gfgSync.spec.js`, `spec/gfgStats.spec.js` — added successful-sync, failure, uniqueness, difficulty, persistence, concurrency, and reset coverage.

## Storage Shape

The existing local `stats` key remains the single stats store:

```js
{
  shas: {},
  solvedSlugs: ["binary-search"],
  solved: 1,
  easy: 1,
  medium: 0,
  hard: 0
}
```

`shas` remains available to the existing GitHub pipeline. `solvedSlugs` provides stable unique identity using `problem.slug`. Unknown, School, and Basic difficulties increment `solved` only.

The latest successful sync is stored separately under `last_successful_sync`:

```js
{
  title: "Binary Search",
  slug: "binary-search",
  language: "java",
  repository: "owner/repository",
  syncedAt: 1786176000000
}
```

No source code is stored in this record.

Stats and SHA writes are serialized within the content-script context, so concurrent success callbacks cannot overwrite each other. The existing attempt-Promise memoization still prevents repeated delivery of one attempt from running the sync or stats update twice.

Reset clears counters, solved slugs, and last-sync display data. It preserves the GitHub token, selected repository, mode, and existing SHA cache, and does not modify GitHub files.

## Checks

- `npm run build`: **PASS**. Existing Semantic UI bundle-size warnings only.
- `npm test`: **PASS**. 59 specs, 0 failures.
- `npm run lint`: **UNAVAILABLE**. The declared command fails before linting because `eslint` is not installed (`sh: eslint: command not found`).
- Targeted Prettier write/check of Phase 7 files: **PASS**.
- `git diff --check`: **PASS**.

## Known Issues

- A live disposable GitHub repository was not mutated during automated verification.
- The popup retains the existing online GitHub `/user` validation behavior, so offline popup-state handling remains unchanged.
- The serialized storage queue coordinates this extension content-script instance; extension storage itself does not offer cross-context atomic transactions.

## Phase 8 Recommendation

Add user-visible failure/partial-sync status and a safe retry action for the latest failed Accepted attempt, then validate OAuth, private-repository permissions, offline behavior, and end-to-end popup refresh against a disposable live repository.

Phase 8 was not started.
