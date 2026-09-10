# Configuration and extension guide

Run all commands from the downloaded project root. There is no required `.env` and no loader for global environment files. The generated `.argus-config.json` is intentionally ignored by Git.

## Supported settings

| Setting | Meaning |
| --- | --- |
| `version` | Currently `1` |
| `onboarded` | True only after the student confirms their setup |
| `name`, `title`, `purpose` | Their name, console name and its purpose |
| `preset` | `business`, `creator` or `learning`; a starting point, not a restriction on their use case |
| `timezone`, `currency` | IANA timezone and uppercase three-letter currency code |
| `accent` | Six-digit hex colour; keep `#ff6b5e` for the original look |
| `workspace` | `workspace` by default; for Obsidian use the configure command's `--vault` option |
| `provider` | `claude`, `codex` or `null`; uses that CLI's own saved authentication |
| `goals` | Up to three strings |
| `panels` | Entries with unique `id`, `type`, `title` and `side` (`left` or `right`) |
| `voice` | `engine` (`system`/`kokoro`), `voiceURI`, `kokoroVoice`, `speed` (0.5–2), `muted` |
| `metrics` | Confirmed bindings to imported CSV/JSON tables |

Panel types: `metrics`, `tasks`, `notes`, `reports`, `sources`, `actions`. The bundled defaults keep three panels on each side of the city. Change panels through configuration before rewriting the visual design.

To explore a fictional preset, run `npm run configure -- --from examples/learning.json`. It deliberately does not complete onboarding. Use personal settings and the confirmed interview to finish setup. Example metrics and notes are always fictional and are not auto-imported.

## Metric binding

After importing a table, its returned source ID and columns are available in Sources and the CLI output. A binding looks like:

```json
{
  "label": "Study hours",
  "sourceId": "the-imported-source-id",
  "column": "study_hours",
  "aggregation": "sum",
  "unit": "hours",
  "period": "The two weeks represented by this source",
  "confirmed": true
}
```

Aggregations are `sum`, `average`, `count` (rows), and `latest` (last row in the confirmed ordering). All rows in that imported table are included; `period` describes those rows and is **not** a date filter. Create a separate derived, date-filtered table before binding if necessary. Missing, non-numeric and ambiguous formatted values produce unavailable results. No automatic currency conversion occurs.

## Workspace and interfaces

The workspace contains `sources/<id>/` originals and extracted Markdown, `system/sources.json`, `system/tasks.json`, optional `system/notes.json`, job records and `reports/` Markdown. Notes use `{title,text}`. Task and source writes preserve unrelated entries; reports never overwrite originals.

- `GET /api/state`: display settings, sources, tasks, notes, jobs, metrics and available workflows. No credential fields or source filesystem locations.
- `POST /api/settings`: name, title, accent, provider and voice preferences. Workspace changes require the local configure command.
- `POST /api/import/file`: multipart file upload; `POST /api/import/url`: `{url}`.
- `POST /api/tasks`: `{title}` to add; `{id,done}` to toggle.
- `POST /api/queue`: `{workflow,question}`; omit workflow to route a typed request. Duplicate active requests reuse the same job.
- `POST /api/cancel`: `{id}`. Failed or interrupted work is not silently retried.
- `GET /api/report?id=...` and `/api/source?id=...`: read workspace-owned text by ID.
- Voice endpoints proxy only the fixed optional local service.

All API routes enforce localhost host/origin checks. API access is intended for the local student console, not a public server.

## Extending ARGUS

Add a workflow to `runtime/workflows.mjs`; buttons and routing use that registry. Bundled workflows are tool-free AI reports from selected excerpts. The runner writes the Markdown result. Adding external actions requires an explicit implementation with its own connection, authorisation and tests.

Both CLI adapters send prompts over stdin. Claude uses no tools and no MCP connections; Codex uses a read-only sandbox, disables shell tools/web search, and ignores user configuration while retaining saved CLI authentication. The starter does not force an expensive model; it uses the provider default. If a CLI rejects required flags, update it rather than weakening permissions.

Preserve the original city, typography, layout and reduced-motion behavior. Custom rendering can extend the panel registry; do not replace the console with a generic app dashboard unless the student asks.
