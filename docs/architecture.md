# How ARGUS works

```text
Claude Code / Codex interview
          ↓
Local configuration + student-selected source imports
          ↓
Next.js console ← workspace files → single local runner
       ↓                             ↓
System speech or Kokoro       Claude / Codex CLI
       ↑                             ↓
Spoken summary ← report + completion record
```

The city scene and DAYBREAK styles are the supplied ARGUS design. Panel content is driven by configuration. One registry defines the five bundled workflows. Typed commands, buttons and reviewed microphone transcripts all enter the same queue.

The importer keeps original bytes and readable extraction notes. It does not execute imported instructions. Runtime AI context is limited to 70,000 characters total and 18,000 per source; truncation and omitted sources are explicitly described to the model. Sources are ranked by query terms and capture time. Confirmed metrics are included alongside source excerpts, with units, periods and errors. Reports are prompted to cite source IDs; citations still need human review. Student-provided metrics require confirmed mappings and are calculated deterministically from the selected table, not invented by the model.

The runner executes one job at a time. Active duplicates reuse the same job. A restarted in-flight task is marked failed rather than silently spending the student's account on a retry. Cancelling a job prevents its late result from being published as completed. AI output is rendered as Markdown without raw HTML execution.

No private skills, environment files, account keys or external agent projects are required. Config, imported data, reports, runtime sessions, caches and models are ignored by Git. A release checker scans the tracked distribution. CLI authentication stays with the student's provider and is never copied into the project.

The optional voice service exposes only health, speech and transcription on localhost. Models are fetched from pinned upstream URLs with SHA-256 checks for Kokoro. Transcription is English and CPU-based; microphone data is not written to disk by ARGUS.
