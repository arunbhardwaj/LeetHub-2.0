# Phase 5 — GFG Problem Metadata Extraction

Date: 2026-08-08

Phase 5 adds route-scoped problem metadata to the Phase 4 source snapshot and the
Phase 3 verdict lifecycle. It does not generate files, update statistics, or upload
anything to GitHub.

## 1. Metadata Sources

The primary source is GFG's structured Next.js page state in
`script#__NEXT_DATA__`. The current page contains the fulfilled RTK Query
`getProblemDetails` response under:

```text
props.pageProps.initialState.problemApi.queries
```

The response currently exposes:

- `problem_name`
- `slug`
- `id`
- `difficulty` and `problem_level_text`
- `problem_question` as structured HTML
- `tags.topic_tags`

The structured response is accepted only when its sanitized slug matches the
active URL-derived slug. This is critical because `#__NEXT_DATA__` can represent
the initial page after a client-side route transition.

The fallback source is the visible problem DOM. It is accepted only when the
page's `link[rel="canonical"]` slug matches the active route. It reads:

- the scoped `#scrollableDiv` heading;
- the semantic `Difficulty:` span; and
- the scoped problem-content element.

The DOM fallback's generated class stem is a last resort, not the primary source.

## 2. Title Extraction

Structured extraction uses `problem_name`, normalizes internal whitespace, and
preserves capitalization. The fallback uses the first non-empty `h1`, `h2`, or
`h3` inside the route-validated problem container.

This returns `Prerequisite Tasks`, for example, rather than the document title
`Prerequisite Tasks | Practice | GeeksforGeeks` or a concatenated header string.

Missing titles remain `null` and add `title_not_found` to `metadataErrors`.

## 3. Slug Strategy

The repository-safe slug always comes from the problem URL, never from the title.
For example:

```text
/problems/missing-number-in-array1416/1
→ missing-number-in-array1416
```

The route key remains separate:

```text
missing-number-in-array1416/1
```

`sanitizeSlug()` lowercases, converts separators to hyphens, removes query/hash
content, strips unsafe characters and repeated dots, and prevents `/`, `\`, and
`..` path components. It preserves GFG's unique numeric suffixes.

## 4. Canonical URL

`getCanonicalProblemUrl()` first validates the existing GFG problem route and then
rebuilds only its origin and three required path components:

```text
https://www.geeksforgeeks.org/problems/<slug>/<type>
```

Query parameters, tracking values, and hash fragments are discarded. Invalid,
insecure, foreign, article, or incomplete routes return `null`.

## 5. Difficulty

Live inspection confirmed current `Easy`, `Medium`, and `Hard` values:

- Missing in Array — Easy
- Prerequisite Tasks — Medium
- Boolean Parenthesization — Hard

`normalizeDifficulty()` also safely recognizes GFG's established `School` and
`Basic` labels. Normalized values are lowercase. Unknown values such as `Expert`
return `null`; no value defaults to Easy.

Missing or unknown difficulty adds `difficulty_not_found` but does not make the
rest of the metadata unusable.

## 6. Problem Statement

Structured extraction converts only `problem_question`; it never touches the
editorial, official solutions, comments, related articles, company sections, or
other page UI.

The lightweight converter supports:

- paragraphs and controlled blank lines;
- headings;
- lists;
- inline code, strong and emphasized text;
- line breaks;
- superscript/subscript notation;
- fenced preformatted example blocks;
- tables/cells at a basic readable level;
- safe HTTP(S) problem illustrations; and
- named and numeric HTML entities.

Examples remain separated into readable fenced blocks, constraints preserve `<`,
`>`, `<=`, and `>=`, and more than two consecutive blank lines are collapsed.
Leading indentation inside preformatted blocks is preserved.

The visible fallback sends only the scoped problem-content HTML through the same
converter, excluding Expected Complexities, Company Tags, Topic Tags, Related
Articles, discussions, editor controls, and report/login UI.

## 7. Metadata Lifecycle

When a valid problem route becomes active:

```text
route detected
      ↓
capture structured metadata or route-validated DOM fallback
      ↓
cache one immutable metadata object for the route
```

If required metadata is not ready, a controlled MutationObserver watches until
the route-validated metadata appears. Mutation processing is throttled to one
capture per 50 ms and ends on success or after 15 seconds. A timeout produces a
partial snapshot containing `metadata_timeout`.

Metadata is not reparsed on submission result mutations. Route cleanup disconnects
the observer, clears scheduled work, and replaces the active cache before the next
problem's submission monitor starts.

## 8. Submission Association

At submission start, the Phase 4 source/language snapshot receives the current
immutable metadata snapshot under `problem`. `SubmissionTracker` exposes both the
nested form and backward-compatible top-level fields.

The completed object now has this logical structure:

```javascript
{
  attemptId,
  routeKey,
  problem: {
    title,
    slug,
    routeKey,
    url,
    difficulty,
    statement,
    problemId,
    tags,
    capturedAt,
    metadataErrors
  },
  solution: {
    code,
    language,
    extension,
    editorType,
    captureError,
    capturedAt
  },
  verdict,
  submittedAt,
  completedAt
}
```

Existing fields such as `attempt.code`, `attempt.language`, `attempt.title`, and
`attempt.slug` remain available. Multiple attempts on the same route share the
same immutable problem snapshot while retaining separate source snapshots.

## 9. Failure Handling

Supported metadata errors are:

- `invalid_problem_url`
- `title_not_found`
- `statement_not_found`
- `difficulty_not_found`
- `metadata_timeout`
- `metadata_not_available` when no metadata snapshot can be supplied to the state
  tracker

A missing metadata field never cancels source capture or verdict monitoring. A
submission can still complete as Accepted or a failure verdict with partial
metadata. Logs contain only the title, normalized difficulty, statement character
count, and concise error names; the full statement is never logged.

## 10. Files Created

- `scripts/gfg/metadata.js`
- `spec/gfgMetadata.spec.js`
- `PHASE-5-REPORT.md`

## 11. Files Modified

- `scripts/gfg/index.js`
  - starts and cleans up the route metadata monitor;
  - logs safe metadata status;
  - passes the route cache into submission monitoring.
- `scripts/gfg/submission.js`
  - copies the current problem snapshot into each submission snapshot;
  - isolates metadata callback failure from the submission lifecycle.
- `scripts/gfg/state.js`
  - provides nested `problem` and `solution` objects;
  - preserves backward-compatible flat fields.
- `spec/gfgSubmission.spec.js`
  - verifies completed attempts contain source plus problem metadata.
- `spec/gfgState.spec.js`
  - verifies multiple attempts retain separate solutions and the correct shared
    immutable problem snapshot.

Generated Chrome and Firefox distributions were rebuilt but remain ignored build
artifacts. Earlier phase changes were preserved.

## 12. Automated Tests

- `npm run build`: **PASS**. Webpack 5.92.0 generated the GFG Chrome and Firefox
  bundles. The only warnings are the existing 269 KiB Semantic UI asset-size
  warnings.
- `npm test`: **PASS**. 37 specs, 0 failures.
- Targeted Prettier check for Phase 5 source and tests: **PASS**.
- `git diff --check`: **PASS**.
- `npm run lint-test`: **FAIL before linting** because the repository still does
  not install ESLint (`sh: eslint: command not found`). This is the same
  pre-existing toolchain gap recorded in Phases 3 and 4; no lint diagnostics were
  produced.

Tests cover difficulty normalization, URL-derived slug stability and path safety,
canonical URL cleaning, HTML entities, examples, constraints, Markdown formatting,
structured extraction, UI-noise exclusion, stale structured-state rejection,
route-validated DOM fallback, metadata caching, route isolation, multiple attempts,
and complete source-plus-problem attempt objects.

A controlled headless-Chrome smoke test injected the final built content bundle
into a GFG-shaped HTTPS page. It confirmed:

- Problem A metadata was captured once from structured state;
- an Accepted attempt used Problem A's route lifecycle;
- SPA navigation produced one Problem A cleanup;
- stale Problem A `#__NEXT_DATA__` was rejected on Problem B;
- Problem B metadata was captured once through the canonical-validated DOM
  fallback;
- Problem B normalized as Hard; and
- its separate attempt completed as Wrong Answer with no metadata warnings.

## 13. Manual Tests

Live current-site inspection was performed against these real GFG pages:

- Missing in Array (`missing-number-in-array1416/1`) — title, Easy difficulty,
  slug, ID, examples, constraints, and array topic tags matched the visible page.
- Prerequisite Tasks (`prerequisite-tasks/1`) — title, Medium difficulty, two
  examples, constraints, and Graph tag matched the visible page.
- Maximum Path Sum (`maximum-path-sum-from-any-node/1`) — tree-oriented statement,
  Medium difficulty, examples, and embedded problem illustration were present in
  the structured statement.
- Boolean Parenthesization (`boolean-parenthesization5610/1`) — title, Hard
  difficulty, operator formatting, examples, and constraints matched the visible
  page.

The current page also confirmed the canonical link and the separation between the
problem-content container and Expected Complexities/tags/articles UI.

Both available browser sessions remain signed out. Therefore no authenticated
real submission or rapid-submit-before-render case is claimed as a manual pass.
Attempt association and SPA isolation were exercised in automated integration
tests and the controlled built-bundle browser smoke test.

## 14. Known Limitations

- `#__NEXT_DATA__` is an implementation detail of GFG's current Next.js app. Slug
  validation prevents stale association, but a future state-shape change will use
  the DOM fallback until the structured adapter is updated.
- The final DOM statement selector uses a generated class stem as a scoped last
  resort because the current content element lacks a stable ID, role, or data
  attribute.
- The lightweight HTML converter intentionally handles the common current GFG
  statement tags; unusual nested tables or bespoke widgets may produce simpler
  Markdown.
- Image-based examples depend on their current external media URLs remaining
  available.
- A submission made before required metadata arrives receives an explicit partial
  immutable snapshot; it is not retroactively mutated after completion.
- Real authenticated submissions across SPA navigation remain to be manually
  exercised with a signed-in test account.
- ESLint remains unavailable until the repository adds the dependency and a
  runnable configuration.

## 15. Exact Phase 6 Recommendation

Phase 6 should consume only completed Accepted attempts and implement:

```text
Accepted completed attempt
        ↓
validate safe repository slug and source extension
        ↓
prepare one problem directory
        ↓
generate README.md from Phase 5 metadata
        ↓
generate the source filename from Phase 4 language data
        ↓
invoke the existing shared GitHub uploader
        ↓
commit automatically with duplicate/update handling
```

Phase 6 should reject uploads when required source or path fields are missing,
avoid uploading non-Accepted attempts, preserve the submitted snapshot, and keep
GitHub credentials out of logs. Root repository README and statistics can remain a
separate later concern if that keeps upload correctness focused.
