# Phase 4 — GFG Source Code and Language Extraction

Date: 2026-08-07

Phase 4 extends the Phase 3 submission lifecycle with submission-time source and
language snapshots. It does not parse problem metadata, generate READMEs, update
statistics, or upload to GitHub.

## 1. Current GFG Editor Technology

Live inspection of
`https://www.geeksforgeeks.org/problems/prerequisite-tasks/1` confirmed that the
current GFG coding editor is Ace:

- editor root: `#ace-editor`
- editor class: `ace_editor ace_hidpi ...`
- code surface: `.ace_text-layer`
- hidden input: `.ace_text-input` (it contains only an input fragment and is not
  accepted as the primary source)
- CodeMirror and Monaco globals were not present in the inspected page
- selected language: a scoped `role="listbox"` language control, displaying
  `C++ (17)` in the inspected session

The old `ace.edit("ace-editor")` assumption is not used directly in the content
script. The current editor root was verified before implementing the adapter.

## 2. Extraction Strategy

`scripts/gfg/editor.js` exposes `getEditorSnapshot(document, options)` and keeps
editor-specific logic behind a small adapter boundary.

For the current Ace editor, extraction order is:

1. request the Ace model value through the page-context bridge;
2. if the bridge cannot read the model, use the complete `.ace_text-layer` as a
   clearly marked fallback;
3. do not use the hidden `.ace_text-input` fragment as source code.

A single usable non-reCAPTCHA textarea is supported as a generic fallback for a
future editor variant. Unknown editor states return `code: null` with an explicit
capture error.

The rendered Ace fallback is intentionally secondary. Rendered editor lines can be
virtualized, so model access remains the preferred source.

## 3. Page Context Strategy

A page-context bridge is necessary. The isolated content-script world cannot rely
on the page's Ace runtime (`window.ace` was not visible from the inspected content
context). The bridge is a minimal script installed once per page and listens only
for:

```text
gfghub:editor-request
gfghub:editor-response
```

Requests contain only a generated request ID and the fixed `ace-editor` ID. The
page-context handler calls Ace's `getValue()` when available and returns only the
request ID, an availability flag, and source text. Responses are accepted only for
the matching request ID and are bounded by a 500 ms timeout. No arbitrary page
execution API is exposed.

If the page's Content Security Policy prevents the inline bridge from installing,
the adapter falls back to the validated Ace text layer and records
`ace_bridge_unavailable_rendered_fallback` when that succeeds.

## 4. Language Detection

The adapter reads the selected language from the current coding pane's unique
`role="listbox"` control whose class identifies the GFG language dropdown. The
display text is normalized without guessing from code syntax. Examples include
`C++ (17)`, `Java 21`, `Python3`, and `Python 3`.

Language extraction is independent of code extraction. A missing language returns
`language: null`, preserves any captured code, and records
`language_not_detected` unless a stronger editor error already exists.

## 5. Language Normalization

`scripts/core/languages.js` is now the single source of truth. Supported normalized
IDs and extensions are:

| Display variants                    | Normalized ID | Extension |
| ----------------------------------- | ------------- | --------- |
| `C`                                 | `c`           | `.c`      |
| `C++`, `C++17`, `C++20`, `C++ (17)` | `cpp`         | `.cpp`    |
| `C#`                                | `csharp`      | `.cs`     |
| `Java`, `Java 21`                   | `java`        | `.java`   |
| `Python`, `Python3`, `Python 3`     | `python`      | `.py`     |
| `Javascript`, `JavaScript`          | `javascript`  | `.js`     |
| `Go`                                | `go`          | `.go`     |
| `Kotlin`                            | `kotlin`      | `.kt`     |
| `Rust`                              | `rust`        | `.rs`     |
| `Dart`                              | `dart`        | `.dart`   |
| `PHP`                               | `php`         | `.php`    |
| `Ruby`                              | `ruby`        | `.rb`     |
| `Scala`                             | `scala`       | `.scala`  |
| `Swift`                             | `swift`       | `.swift`  |
| `TypeScript`                        | `typescript`  | `.ts`     |

Unknown values return `null` and never receive a fabricated extension. The legacy
`LANGUAGE_EXTENSIONS` export remains available for Phase 2 consumers.

## 6. Submission Snapshot Lifecycle

The real coding Submit listener starts an asynchronous snapshot immediately during
the capture phase of the click event, before GFG's own handler can disable or
rerender the editor:

```text
Submit recognized
      ↓
getEditorSnapshot()
      ↓
create attempt + attach snapshot
      ↓
emit submission:start
      ↓
judge/result monitoring
```

The snapshot contains:

```javascript
{
  code, language, displayLanguage, extension, editorType, captureError, capturedAt;
}
```

The final attempt retains this exact snapshot even if the editor changes while GFG
is judging. Source is never read at Accepted time.

## 7. Attempt Association

`SubmissionTracker.start(source, snapshot)` attaches the snapshot to the existing
Phase 3 attempt ID. The attempt exposes both a `snapshot` object and convenient
top-level fields (`code`, `language`, `extension`, `editorType`, `captureError`, and
`capturedAt`). Existing route keys, sequence IDs, duplicate protection, verdict
normalization, and completed timestamps remain unchanged.

Thus two attempts on one problem receive independent snapshots, and changing the
language between attempts cannot overwrite the earlier attempt.

## 8. Failure Handling

Capture failures are explicit:

- `editor_not_found`
- `editor_capture_failed`
- `language_not_detected`
- `ace_bridge_unavailable_rendered_fallback` when the fallback succeeds

The submission attempt is still created and verdict monitoring continues. A later
Accepted result therefore emits an Accepted completed attempt with `code: null`
and the capture error instead of silently pretending source capture succeeded.

Logs show only safe metadata:

```text
[GFGHub] source captured
[GFGHub] language: java
```

or:

```text
[GFGHub] source capture failed: editor_not_found
```

Full source text is never logged.

## 9. Files Added

- `scripts/gfg/editor.js`
- `spec/gfgEditor.spec.js`
- `spec/gfgLanguage.spec.js`
- `spec/gfgSubmission.spec.js`
- `PHASE-4-REPORT.md`

## 10. Files Modified

- `scripts/core/languages.js`
  - adds normalized language definitions and `normalizeLanguage()`;
  - preserves the existing extension-map export.
- `scripts/gfg/state.js`
  - attaches immutable snapshot data and top-level snapshot fields to attempts.
- `scripts/gfg/submission.js`
  - captures source/language before emitting submission start;
  - handles asynchronous bridge failure without breaking verdict monitoring.
- `scripts/gfg/index.js`
  - logs safe capture/language metadata.

Phase 3 routing, selectors, verdict, event, and cleanup modules were preserved.

## 11. Automated Tests

- `npm run build`: **PASS**. Webpack compiled the Chrome/Firefox artifacts with
  the existing Semantic UI asset-size warnings.
- `npm test`: **PASS**. 28 specs, 0 failures.
- Targeted Prettier check for all Phase 4 source/spec files: **PASS**.
- `git diff --check`: **PASS**.
- `npm run lint-test`: **FAIL before linting** because ESLint is not installed
  (`sh: eslint: command not found`). This is the same pre-existing repository
  toolchain gap recorded in Phase 3.

Tests cover versioned language normalization, extension mapping, unknown-language
handling, Ace/text-area/failure extraction paths, attempt snapshot integrity when
the editor changes before a verdict, multiple-attempt isolation, and verdict
continuation when capture fails.

A controlled headless-Chrome smoke test injected the final built bundle into a
GFG-shaped HTTPS page with a mock page-context Ace model. It confirmed two
submission-time source captures, Java normalization, route cleanup, and a third
Accepted verdict after the editor was removed; the third attempt logged
`source capture failed: editor_not_found` while verdict monitoring still completed.

## 12. Manual Tests

Manual live-site inspection confirmed the current Ace DOM, the editor root and text
layer, the hidden textarea behavior, the current language listbox, and the actual
coding Submit/Run controls. Both available browser sessions were signed out, so no
real authenticated submission was made and no real Java/C++/Python judged outcome
is claimed.

The controlled browser smoke test covered Java-style selection, duplicate-safe
submissions, route navigation, and missing-editor failure. It did not claim a real
GFG judge result or prove code values from an authenticated account.

## 13. Known Limitations

- The Ace bridge depends on the page allowing the injected bridge script. The
  validated text-layer fallback is necessary but less robust than model access.
- The language selector currently has a generated CSS-module class stem; the
  adapter also requires `role="listbox"` and uniqueness to avoid broad matching.
- Normalization supports the languages and display variants observed or retained
  from the current shared registry. Newly added/localized GFG labels return null.
- A content-script click handler cannot guarantee a snapshot for a submission path
  that bypasses both the actual Submit control and a visible result transition.
- Real authenticated editor mutations during judging still need manual validation
  on a signed-in test account.
- ESLint remains unavailable until the repository adds an ESLint dependency.

## 14. Phase 5 Recommendation

Phase 5 should implement problem metadata only:

1. problem title;
2. canonical problem slug and URL;
3. difficulty;
4. problem statement; and
5. optional tags/company tags if stable current-page signals exist.

The Phase 5 metadata object should be associated with the existing `routeKey` and
paired with the Phase 4 completed attempt. GitHub upload, README generation, stats,
and repository writes should remain out of scope until explicitly introduced.
