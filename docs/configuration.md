# Configuration and extension guide

Run commands from the project root. There is no required .env and no global environment-file loader. Local preferences and data are ignored by Git.

## Settings and migration

| Setting | Meaning |
| --- | --- |
| version | 2; version 1 migrates with an exact local backup |
| onboarded | True after the participant accepts the brief |
| name, title, purpose | Identity and workspace purpose |
| preset | business, creator or learning |
| timezone, currency | IANA timezone and uppercase currency code |
| accent | Six-digit hex colour; DAYBREAK uses #ff6b5e |
| workspace | Local workspace by default; an existing vault uses its ARGUS subfolder |
| provider | claude, codex or null; own CLI authentication |
| goals | Up to three strings |
| panels | Unique id, type, title and side (left/right); order determines priority |
| voice | engine system/kokoro, voiceURI, kokoroVoice, speed 0.5–2, muted |
| businessProfile | businessName, offering, audience, problem, firstResult, definitions (term → explanation) |
| appearance | theme light/dark/system; textSize standard/large; density comfortable/compact; city prominent/subtle/still |
| starterPack | sales, agency, content or null |
| firstResult | status pending/ready and reportId; independent of onboarding |
| features | Installed pointers with id and activeVersion |
| metrics | Confirmed imported-table bindings |

Panel types remain metrics, tasks, notes, reports, sources and actions. Unknown configuration fields are discarded; invalid values fail validation. Existing configurations retain completed onboarding and choices. Backups live under .argus-local/backups. The browser settings API cannot change workspace paths.

Business definitions are participant-editable facts and terminology, not permission to read additional sources. Skipping personalisation retains existing appearance.

## Interview and metric definitions

The draft in .argus-onboarding.json preserves stage, answers, optional preview and session ID after completion. CLI partial answers merge through npm run configure -- --answers path/to/answers.json. The browser preview/complete flow accepts {answers:{...}} or the same fields directly; the confirmed brief is applied only by completion. Fields include businessProfile, appearance, starterPack, useDemo, name, purpose, goals, panels and explicitly selected workspace/vault.

A basic metric binding contains:

    {
      "label": "Study hours",
      "sourceId": "selected-source-id",
      "column": "study_hours",
      "aggregation": "sum",
      "unit": "hours",
      "period": "The two weeks represented by this source",
      "confirmed": true
    }

Aggregations are sum, average, count (rows) and latest (last row in the confirmed ordering). All imported rows are included; period is a label, **not a date filter**. Create a documented derived table first when the dashboard needs date/status filtering. Missing or non-numeric values remain unavailable. Currency conversion and cleanup are never inferred.

Generated feature queries can filter rows explicitly and aggregate deterministically. Their UI must show the selected source, filters, units and reporting period. A source sample is not an automatically confirmed business metric.

## Local interfaces

All routes enforce localhost host/origin checks. These are local console interfaces, not a public API.

| Interface | Contract |
| --- | --- |
| GET /api/state | Public settings, sources, tasks, notes, jobs, metrics, workflows and installed features |
| GET /api/setup | App, provider, runner and separate voice readiness |
| GET /api/voice/install | Persisted installation progress |
| POST /api/voice/install | {retry:true} to retry/start |
| POST /api/voice/cancel | Pause voice installation while retaining verified files |
| POST /api/conversation | {kind:"onboarding" or "conversation",fresh?:true}; otherwise resumes latest |
| GET /api/conversation?id=… | Saved session, both roles and progress |
| GET /api/conversation/events?id=… | Server-sent progress events and heartbeat; closes after 55 seconds so clients reconnect |
| POST /api/conversation/turn | {id,text,requestId}; idempotent request ID |
| POST /api/conversation/cancel | {id}; invalidates pending replies |
| POST /api/conversation/action | {id,turnId,actionId}; apply a validated proposal |
| GET /api/onboarding | Draft and starter packs |
| POST /api/onboarding/preview | {answers}; save/edit brief without completing |
| POST /api/onboarding/complete | {answers}; accept workspace/settings and optional demo import |
| GET /api/packs | Starter questions, commands, templates and examples |
| POST /api/packs/import | {id}; explicit demonstration import after setup |
| POST /api/settings | Name, title, accent, provider, voice, appearance, businessProfile and panels |
| POST /api/import/file or /api/import/url | Multipart file or {url}; bounded selected-source import |
| POST /api/tasks | {title} to add; {id,done} to toggle |
| POST /api/queue | {workflow,question}; existing report behavior retained |
| POST /api/cancel | {id}; cancel a queued/running report or build |
| GET /api/report?id=… or /api/source?id=… | Selected workspace text by ID |
| GET /api/features | Features, history and build jobs |
| POST /api/features/build | {prompt,sourceIds:[],featureId?}; create or revise |
| GET /api/features/preview?id=… | Version preview; optional mode=active |
| POST /api/features/activate or /api/features/rollback | {id,versionId}; activate exact validated artifact |
| POST /api/features/capability | Token-bound SDK message; capability/source/preview checks |

Voice speech/transcription endpoints proxy the owned local service. The browser currently polls saved conversation progress; an optional bounded server-sent event endpoint carries status/revision and the latest turn. It sends heartbeat comments and releases its timer when the client disconnects. UI request IDs prevent accidental repeated turns.

## Workspace and extension boundaries

Sources retain originals and extraction notes under sources/<id>. Workspace system files store tasks, notes, conversation transcripts, jobs and feature versions. Reports are Markdown. Feature records live separately from code under features/data. Local setup state, unfinished conversations, downloads and caches stay under .argus-local until appropriate workspace adoption.

Reports, conversation and builds use the shared registry in runtime/workflows.mjs. Both provider adapters send prompts through stdin with tools disabled. Updating a CLI is preferable to weakening the required restrictions.

The [Feature SDK](feature-sdk.md) is the supported generated extension surface: feature-owned records, selected sources, bounded tasks/notes and report generation. Only bundled React and @argus/sdk imports are allowed. The host/server owns capabilities; generated code cannot change installers, provider adapters or server controls. Preview/activation, artifact integrity, additive schemas and rollback protect existing work.

Live account connections, sending, publishing, arbitrary packages and generated server code require a separate explicit implementation. Do not add a working-looking button for an absent integration.
