# Make ARGUS yours

This interview is run by the student's Claude Code or Codex session. It creates a working personalised console while retaining the supplied UI and UX.

## Before asking

Detect the operating system, Node version and available AI CLIs without reading credentials. Node.js 22.13+ is required; if absent, explain how to install a supported Node LTS release for that OS. Check whether the student wants to use the current assistant for background work; a desktop assistant does not guarantee its CLI is installed.

Run `npm ci` if dependencies are missing, then `npm run setup`. Installation does not mark onboarding complete. Read `.argus-onboarding.json` if it exists and resume the unanswered questions. These files are local and ignored by Git.

## Interview — one question at a time

1. **Outcome:** What do you want this command centre to help you accomplish? Explain that its interface is already built and will stay recognisably ARGUS.
2. **Context:** What business, project or area of life is it for? Choose the closest starting preset: business, creator or learning. A custom use case uses the closest preset plus custom labels, panels and workflows.
3. **Priorities:** What are your three most important outcomes? Accept fewer than three. Do not replace a supplied goal with a generic one.
4. **Information:** Which files, selected folder or public URLs should ARGUS use? Explain that selected excerpts are sent to their chosen AI provider when they run an AI task. Do not scan the rest of their computer. Ask separately if they want an existing Obsidian vault; otherwise use the new `workspace` folder.
5. **Console:** What should they see and do each day? Recommend panels from metrics, tasks, notes, reports, sources and actions. Recommend the five bundled commands before suggesting additional integrations.
6. **Identity:** Confirm name, detected timezone and currency where needed. Keep ARGUS branding and the existing design by default. Ask about optional visual changes only if the student expresses a preference.
7. **Voice and AI:** Use available system voices first. Let the student preview voices in the browser. Offer the optional free Kokoro male/female voices and microphone upgrade. Confirm Claude or Codex for background tasks, and explain that their own account limits apply.

Reuse answers already supplied. Save partial answers after each response using an ignored JSON file under `.argus-local/` and `npm run configure -- --answers .argus-local/answers.json`. Allowed answer keys are purpose, preset, goals, sources, panels, name, timezone, branding, voice, provider and vault. Never put API keys in an answer file. This command merges progress; it does not reset earlier answers.

## Confirm, configure and populate

Present one concise build brief covering goals, data access, panels, voice and provider. Ask the student to confirm before importing their selected information or applying the customisation. Do not ask again for choices already authorised.

Write the intended non-secret settings to `.argus-local/proposed-config.json`. Follow `docs/configuration.md`. Run:

```sh
npm run configure -- --from .argus-local/proposed-config.json --confirmed
```

For an existing Obsidian vault add `--vault "the selected vault path"`. If the preview is running, first use `npm run stop`, then configure and restart it. The command uses the vault's `ARGUS` subfolder. It never overwrites existing notes. Preview-only runner bookkeeping does not count as student data. Changing a workspace containing student data is blocked until that data is deliberately copied or exported; do not bypass this by deleting data.

Import selected files with `npm run import -- --file "path"`, folders with `--folder "path"`, and public pages with `--url "https://example.com"`. Originals and source references are retained. Report skipped files and extraction limits. Unsupported attachments are not analysed until an extraction capability exists.

Read the imported source metadata, then propose metric bindings if requested. Confirm column, aggregation, units, date range and row ordering for `latest`. Currency symbols, commas, blanks or mixed currencies must be normalised in a separate derived table with documented rules before calculating metrics. Never silently clean or overwrite original data.

Use the existing panel registry and design tokens. Rename, reorder, add or remove panels according to the confirmed brief. If new functionality is needed, implement and test it; do not display a working-looking button for a missing integration. Save any context that should guide future assistants inside the student's workspace.

## Voice upgrade

System speech has no installation step. Open Voice settings and let the student preview available voices. If they selected the local upgrade, ensure Python 3.10–3.12 (3.12 recommended), run `npm run voice:setup`, restart ARGUS, select Kokoro and preview a male or female voice. Model downloads are approximately 450 MB plus Python dependencies. Runtime voices work locally after downloads. Do not claim all AI processing is offline.

## Finish

Run `npm test`, `npm run typecheck`, `npm run build` and `npm run doctor`. Start with `npm start` and open http://127.0.0.1:3117. Confirm their name, goals, panels and source status match the brief, test one appropriate bundled workflow with their permission to use their AI account, and show the resulting report. Test voice preview through a browser gesture. If a dependency is unavailable, clearly distinguish the working features from what still needs setup.

Explain `npm run stop`, how to restart, where their workspace lives, and how to ask for future changes. Never publish their personalised workspace or configuration to the public repository.
