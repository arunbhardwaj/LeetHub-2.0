# Phase 6 — Accepted GFG → GitHub Auto Sync

Date: 2026-08-08

## Files Changed

Created:

- `scripts/gfg/sync.js`
- `spec/gfgSync.spec.js`
- `spec/githubSync.spec.js`
- `PHASE-6-REPORT.md`

Modified:

- `scripts/gfg/index.js`
- `scripts/core/github.js`

## GitHub Sync Architecture

The Phase 3 completed-verdict event now has an explicit Accepted gate in the GFG
entry point. Every other normalized verdict returns before invoking the sync
module.

`scripts/gfg/sync.js` validates the immutable Phase 4/5 completed attempt, builds
the safe GFG directory and filenames, generates the README, and delegates each
file to the shared GitHub layer. It never reads the live editor.

The resulting layout is:

```text
<sanitized-problem-slug>/
├── README.md
└── Solution.<captured-extension>
```

Different languages use separate stable filenames. A later Accepted submission in
the same language updates the same filename.

## Create, Update, and Unchanged Logic

`syncGitHubFile()` was added to the existing shared GitHub module. It reuses the
stored token/repository/mode, GitHub Contents API helpers, UTF-8 base64 encoding,
SHA writes, conflict handling, and stats storage.

For each file it:

1. reads the current GitHub file;
2. creates it when the GET returns 404;
3. returns `unchanged` when decoded content is identical;
4. updates it using the current SHA when content differs; and
5. re-reads and retries once after a 409/422 race.

Source content is encoded and uploaded exactly as captured at Submit time. No
formatting or mutation is applied.

README generation omits unavailable difficulty or statement sections. Commit
messages use `Add <title> solution` and `Update <title> solution` without
LeetCode/LeetHub wording.

## Duplicate Protection

The Phase 3 tracker already emits one final result per attempt. Phase 6 adds a
second guard: the sync module memoizes the Promise for each `attemptId`. Repeated
delivery of the same Accepted attempt therefore performs at most one two-file sync.

## Errors

Missing authentication/repository configuration, 401, 403/rate limit, 404, 409,
422, and network failures return concise failure results. They do not throw into
or interrupt GFG submission monitoring. Tokens, source code, and response bodies
are not logged.

A two-file GitHub Contents API operation is not atomic. If README succeeds and the
solution write fails, the result reports the successfully processed README and a
safe failure reason. A new Accepted attempt can retry normally.

## Tests and Build

- `npm run build`: **PASS**. Existing Semantic UI asset-size warnings only.
- `npm test`: **PASS**. 54 specs, 0 failures.
- Targeted Prettier check: **PASS**.
- `git diff --check`: **PASS**.
- `npm run lint-test`: **FAIL before linting** because ESLint remains absent from
  the repository (`sh: eslint: command not found`). This is pre-existing.

Automated coverage verifies:

- Wrong Answer, Compilation Error, TLE, and Runtime Error perform zero GitHub work;
- Accepted Java creates README and `Solution.java`;
- Accepted C++ creates `Solution.cpp` without replacing Java;
- later Java changes update `Solution.java`;
- identical README/source content creates no writes;
- different problems use separate directories;
- duplicate delivery of one attempt syncs once;
- the uploaded source is the submission-time snapshot, not later editor content;
- Accepted attempts with missing source snapshots perform zero GitHub writes;
- unsafe slugs are sanitized;
- create/update SHA behavior and 409/422 conflict retry work; and
- authentication, repository, API, rate-limit, and network failures are normalized.

No real GitHub repository was mutated during testing. Live OAuth, private-repo
permissions, and rate-limit behavior still require validation with a disposable
configured repository.

## Phase 7 Recommendation

Phase 7 should focus on user-visible sync status and operational hardening:

- show success, unchanged, partial, and failure status without exposing secrets;
- provide a safe retry path for failed Accepted attempts;
- validate the end-to-end flow against a disposable real repository;
- decide whether root README/statistics updates belong in the product; and
- complete remaining GFGHub branding and legacy storage-key migration only after
  live sync behavior is confirmed.

Phase 7 was not started.
