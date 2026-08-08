# Phase 3 — GFG Problem Detection and Submission Monitoring

Date: 2026-08-07

Phase 3 implements the GFG submission lifecycle only: problem-route detection,
route-scoped initialization and cleanup, actual Submit detection, judging/result
monitoring, normalized verdicts, and an internal event boundary. It does not read
editor contents or trigger GitHub uploads.

## 1. GFG URL Detection

`scripts/gfg/router.js` accepts only HTTPS URLs on these exact hosts:

- `www.geeksforgeeks.org`
- `geeksforgeeks.org`

The pathname must have exactly this shape:

```text
/problems/<slug>/<problem-type>
```

Trailing slashes, query strings, and hashes do not affect recognition. Routes such
as the homepage, articles, dashboards, incomplete `/problems/<slug>` paths,
additional path segments, HTTP pages, other subdomains, and LeetCode are rejected.

The stable route identity is `<slug>/<problem-type>`, for example:
`prerequisite-tasks/1`. This is lifecycle identity only, not problem metadata.

## 2. SPA Navigation

GFG's current problem page is a Next.js client-side route. The content script:

- checks the route immediately;
- reacts to `popstate` and `hashchange`;
- compares the current route once per second as a fallback for page-context
  `history.pushState()` and `history.replaceState()` calls.

The one-second comparison is intentional. An extension content script runs in an
isolated JavaScript world, so replacing `history` methods there is not a reliable
way to intercept calls made by the GFG page. A low-frequency URL comparison avoids
injecting a page bridge and avoids aggressive 100 ms polling.

Only a changed route identity invokes the lifecycle callback. Query-string or hash
changes on the same problem do not create duplicate monitors.

## 3. Submit Detection

All selectors and selector fallbacks are centralized in
`scripts/gfg/selectors.js`.

The current coding pane is scoped by the stable `#problem_right_section` ID. The
primary Submit lookup searches `#rightFooter` for one button whose normalized text
is exactly `Submit`. The fallback remains inside the coding pane and is valid only
when:

- exactly one exact-text `Submit` button exists; and
- the same coding pane contains an exact-text `Compile & Run` button.

This deliberately ignores the separate discussion/comment Submit control and does
not confuse Submit with Compile & Run, Custom Input, or Reset. It does not depend on
the generated `problems_submit_button__...` CSS-module class.

A single delegated capture listener is attached to the coding pane. Button
rerenders therefore do not accumulate listeners. A controlled, cancellable
MutationObserver waits up to 15 seconds for a delayed coding pane.

## 4. Result Monitoring

The current GFG UI presents results in the coding pane's bottom overlay/sidebar,
identified semantically by its `Output Window` label. A generated
`problems_output_window__...` class stem is retained only as a scoped last-resort
fallback.

A MutationObserver watches only the selected result container for child and text
changes. A second coding-pane observer exists only to discover a delayed or
replaced result container; it does not parse verdict text itself.

Submit clicks begin an explicit attempt. A judging transition or changed final
result can also begin an implicit `source: "result"` attempt, which leaves the
design compatible with keyboard-driven submission. A verdict that was already
visible when monitoring began is stored as a baseline and is not emitted as a new
submission.

## 5. Verdict Mapping

| Current GFG display | Internal verdict |
| --- | --- |
| `Problem Solved Successfully`, exact `Accepted`, exact `Correct Answer` | `accepted` |
| `Wrong Answer` | `wrong_answer` |
| `Compilation Error` | `compilation_error` |
| `Runtime Error` | `runtime_error` |
| `Time Limit Exceeded`, including TLE detail in a Runtime Error panel | `time_limit_exceeded` |
| Recognized generic processing failure | `unknown_error` |

Observed in-progress text includes `Queuing`, `Request Queued`, `Evaluating`,
`Processing Result`, `Test Cases Processed:`, and `Compilation Processing`.

TLE matching runs before Runtime Error matching because the current UI can show a
Runtime Error heading while the test-case detail says Time Limit Exceeded. Accepted
phrases are exact lines, so text such as `0 test cases accepted` is not treated as
success. Memory- and output-limit verdicts were not added because they were not
observed in the current GFG application.

## 6. Submission State Machine

```text
IDLE
  |
  | exact Submit activation or result-driven start
  v
SUBMITTED
  |
  | queue/evaluation/processing text
  v
JUDGING
  |
  | normalized final verdict
  v
COMPLETED
```

A pending attempt can also move to `CANCELLED` when a route changes, the page is
unloaded, or a newer submission supersedes it.

Each lifecycle record contains only the Phase 3 data boundary: `attemptId`,
`sequence`, `routeKey`, `source`, `phase`, `verdict`, `submittedAt`, and
`completedAt`. No source code or full problem content is captured.

## 7. Duplicate Protection

A content-script-wide monotonically increasing sequence gives each attempt an ID
such as `prerequisite-tasks/1:3`. `SubmissionTracker.complete()` returns a result
only once; later DOM mutations for that completed attempt return `null` and emit no
event.

A legitimate subsequent Submit always starts a new sequence. Therefore two valid
Accepted submissions produce two events, while repeated Accepted rerenders for one
attempt produce one event.

## 8. Cleanup

On every changed route, the entry point first invokes the previous problem cleanup.
Cleanup:

- cancels the delayed-element waiter;
- removes the delegated click listener;
- disconnects the coding-pane observer;
- disconnects the result observer; and
- cancels any pending submission attempt.

The same cleanup runs on `pagehide`, together with route-monitor cleanup. This
prevents results from Problem A being processed after navigation to Problem B and
prevents listener accumulation across multiple problems.

## 9. Files Added

- `scripts/gfg/router.js`
- `scripts/gfg/submission.js`
- `scripts/gfg/verdict.js`
- `scripts/gfg/selectors.js`
- `scripts/gfg/state.js`
- `scripts/gfg/events.js`
- `spec/gfgRouter.spec.js`
- `spec/gfgVerdict.spec.js`
- `spec/gfgState.spec.js`
- `spec/gfgEvents.spec.js`
- `PHASE-3-REPORT.md`

## 10. Files Modified

- `scripts/gfg/index.js`
  - starts/stops route-scoped submission monitoring;
  - provides a shared attempt sequence;
  - publishes concise namespaced lifecycle logs;
  - exports the internal event bus for later phases;
  - removes the GFG entry point's `uploadGit` import/reference.

Generated `dist/`, `dist/chrome/`, and `dist/firefox/` artifacts were rebuilt but
remain ignored build output. Earlier Phase 1 and Phase 2 changes were preserved.

## 11. Tests

Commands were run from the repository root.

- `npm run build`: **PASS**. Webpack 5.92.0 compiled successfully. The only output
  was two existing performance warnings for the copied 269 KiB Semantic UI asset.
- `npm test`: **PASS**. 20 specs, 0 failures.
- Targeted Prettier check for every Phase 3 source/spec: **PASS**.
- `git diff --check`: **PASS**.
- `npm run lint-test`: **FAIL before linting** because `eslint` is not installed
  (`sh: eslint: command not found`). `package.json` had this script before Phase 3,
  but its devDependencies still contain no ESLint package. This is a pre-existing
  toolchain gap; no lint diagnostics were produced.
- Repository-wide `npm run format-test`: **FAIL** on pre-existing formatting and
  missing-glob issues, including old vendor files and absent `jsx`, `ts`, and `tsx`
  files. All Phase 3 files pass the targeted formatter check.

Pure tests cover valid/invalid URLs, route identity, route change deduplication and
cleanup, all observed verdict mappings, false-positive Accepted protection,
judging text, state transitions, one-final-event semantics, resubmission, cancel,
and event unsubscription.

A controlled headless-Chrome smoke test injected the built
`dist/chrome/scripts/gfg.js` bundle into a GFG-shaped HTTPS problem page. It
confirmed:

- discussion Submit and Compile & Run were ignored;
- submission 1 emitted one judging event and one Accepted result;
- an unchanged repeated Accepted render emitted no duplicate;
- submission 2 emitted its own judging event and Accepted result;
- `history.pushState()` from Problem A to B produced one cleanup and one new
  detection after the fallback interval; and
- the first Submit on Problem B emitted only one start event.

## 12. Manual Test Results

Live current-site inspection was performed on
`https://www.geeksforgeeks.org/problems/prerequisite-tasks/1` in both the in-app
browser and Chrome.

Confirmed manually:

- the current `/problems/<slug>/<type>` URL shape;
- Next.js/client-side problem routing;
- stable coding-pane ID `#problem_right_section`;
- stable editor-footer ID `#rightFooter`;
- exact coding controls `Compile & Run` and `Submit`;
- a second unrelated discussion/comment Submit exists outside the coding pane;
- the `Output Window` bottom overlay/sidebar and its generated class fallback;
- current intermediate and final result strings from the loaded application
  bundles; and
- activating the real coding Submit while signed out opens GFG's login modal.

Both available browser sessions were signed out. Consequently, no real judged
Wrong Answer, Compilation Error, Runtime Error, TLE, Accepted, Accepted-twice, or
three-problem submission was completed. Those cases are **not** claimed as manual
passes. The rebuilt extension package was inspected and the built bundle was smoke
tested in controlled Chrome, but the extension was not installed into the signed-in
user profile.

## 13. Known Limitations

- Current GFG has no stable `data-*`, ARIA, or test attribute on the coding Submit
  or result drawer. Detection therefore combines stable container IDs, exact text,
  and structural validation.
- Exact English UI text is required. A localized or renamed GFG UI will require
  selector/verdict updates in the centralized modules.
- The result-panel class fallback contains a CSS-module stem and may change; the
  semantic `Output Window` strategy is primary.
- SPA push/replace navigation can take up to one second to be detected.
- A final verdict that changes without a preceding judging state is supported, but
  an identical final string cannot prove that a keyboard resubmission occurred
  unless an intermediate DOM transition is visible.
- Real authenticated submission outcomes remain to be exercised manually when a
  signed-in test session is available.
- The repository's ESLint command is currently non-runnable because ESLint is not
  installed.

## 14. Next Phase

Phase 4 should implement, in this order:

1. code-editor detection;
2. source-code extraction;
3. programming-language detection; and
4. a source/language snapshot at the Phase 3 `submission:start` boundary, keyed by
   `attemptId`.

The snapshot must represent the exact submitted attempt and later be paired with
its `submission:result` event. Phase 4 should continue to stop before GitHub upload
unless that phase explicitly expands the scope.
