# Building business features in ARGUS

Open **Build a feature**, describe the result, and select the imported sources it may read. ARGUS uses the existing authenticated Codex or Claude CLI and the same single-worker queue as conversations and reports. Conversations receive queue priority. Generated features can be panels or larger workspace views: forms, trackers, filtered tables, calculations and report controls. Model-selected packages, generated server code and external account actions are unavailable.

Every build produces an immutable version for preview. Review its name, purpose, data sources, capabilities and behaviour, then choose **Use this version**. Test forms by adding and editing disposable demonstration records; the activated feature begins with an empty record store. Selected imported sources remain read-only snapshots with capture dates. Preview cannot edit workspace tasks/notes or run reports. Active changes require enabling **Allow local changes during this session** in ARGUS outside the generated frame. This allows normal form submission without a second confirmation for each record. AI report requests retain an explicit host confirmation. A failed or cancelled build leaves the previous active version in place. The builder makes at most one automatic repair attempt.

## Bundle contract

The tool-free provider returns JSON containing `manifest`, `source` (TSX), `css`, and `demoRecords`. The fixed contract is bundled at `runtime/feature-sdk/contract.txt`. The manifest declares:

- `name`, `description`, and `kind` (`panel` or `workspace`).
- `capabilities`: selected from `records.read`, `records.write`, `sources.read`, `tasks.read`, `tasks.write`, `notes.read`, `notes.write`, and `reports.run`.
- `sourceIds`: a subset of the sources explicitly chosen for this build.
- `schema`: up to 30 named fields with `type` (`string`, `number`, `boolean`, or ISO `date`), `label`, and `required`.

TSX exports a default React component. It may import React hooks from `react` and `argus` from `@argus/sdk`. A fixed esbuild compiler bundles React and the local SDK; other imports fail validation. CSS cannot import files or reference URLs. Source length is limited to 80 KB; CSS to 20 KB. No generated code runs on Node.

## SDK

Every method is asynchronous. Catch errors and show a useful message. Use accessible labels, keyboard controls and short empty states. Mutations should originate from a deliberate user action after the student enables local changes for the current session. Closing or changing the frame resets that permission.

| Methods | Result and boundaries |
| --- | --- |
| `argus.records.list(query)` | `{rows,total,truncated,demonstration}`; feature-owned records, 200 rows by default, maximum 500 per response |
| `argus.records.create(values)` / `.update(id,values)` | Validated fields saved in this feature’s namespace, or isolated sample records in preview; up to 5,000 records; no deletion API |
| `argus.sources.query(sourceId,query)` / `.text(sourceId)` | Selected imported data only, with capture date and demonstration flag; text excerpts capped at 18,000 characters |
| `argus.calculate(rows,query)` / `.ratio(numerator,denominator)` | Deterministic calculations; zero denominator returns null |
| `argus.tasks.list()` / `.add(title)` / `.toggle(id,done)` | Local task list; preview shows no private task data |
| `argus.notes.list()` / `.add(title,text)` | Local notes plus Markdown files; existing notes remain intact |
| `argus.reports.run(workflow,question)` | Queues `brief`, `summarise`, `ask`, `plan` or `draft`; context is limited to this feature’s selected source IDs |

A query accepts `filters: [{column,operator,value}]`, `orderBy: {column,direction}`, `limit`, and optionally `aggregation` plus `column`. Operators are `eq`, `neq`, `contains`, `gt`, `gte`, `lt`, and `lte`. Up to 12 filters are ANDed together. Supported calculations are `count`, `sum`, `average`, and `latest`. Filtering precedes aggregation; the response row limit does not truncate calculations. `latest` requires explicit ordering and returns the final ordered row. Numeric calculations refuse blanks, booleans and non-numeric cells. Define source, filters, column, units and reporting period visibly; a period label never filters rows automatically.

## Isolation and version history

Features run in opaque sandboxed iframes permitting scripts and form events, without same-origin access, popups or top navigation. Form events let React intercept submit actions; `form-action 'none'` blocks actual form navigation. The frame’s Content Security Policy denies network connections, external resources, child frames and workers. The host response also sets `frame-src 'none'`: inline srcdoc features render, but their attempts to navigate themselves to URLs are blocked. The iframe receives a channel identifier but never the capability token. The trusted parent verifies the sending window and channel, holds a one-hour signed token, and mediates SDK requests. The server checks feature/version identity, artifact integrity, active version, workspace, mode, permissions and selected source IDs for every request. Preview record edits are restricted server-side to a unique disposable session store; all production writes and report generation are denied. Reopening preview restores its original examples. Expired preview stores are removed on a subsequent preview open. Any active write is bounded by the feature manifest and data schema.

Version artifacts live under workspace `system/features/versions`; feature records live separately under `features/data`. Activation saves an `{id,activeVersion}` pointer in the local configuration. Switching versions invalidates old active sessions. Rollback preserves all records and fields created afterwards. New builds must retain fields/types from every earlier version; new fields must be optional. Reopening a feature refreshes an expired session. Artifact integrity checks cover code, styles, metadata and demonstration records.

This protects data access and host capabilities. A generated UI can still contain misleading text or inefficient browser code, so preview its behaviour before activation. ARGUS does not promise a separate operating-system process or resource quota for each iframe.

## Local API

`GET /api/features` returns `{features,builds}`. `POST /api/features/build` takes `{prompt,featureId?,sourceIds?}` and returns a queue job. `GET /api/features/build?id=JOB_ID` exposes progress, errors and completed `featureId`/`versionId`. `GET /api/features/preview?id=VERSION_ID&mode=preview|active` returns frame HTML and the host-only token. `POST /api/features/activate` and `/rollback` take `{id,versionId}`. `POST /api/features/capability` is the trusted frame bridge. Localhost host/origin guards apply to all routes. The version artifact, not a newly compiled model response, is activated.
