# Release validation

Validated on macOS on 10 September 2026 using Node.js 24, Python 3.12 and Chromium. The automated core suite has 26 tests. The repository also runs installation, tests, type checking, production build, release checks and dependency auditing on macOS, Windows and Linux through GitHub Actions.

## Completed checks

- Previewing the console before onboarding does not prevent selecting a new Obsidian vault; runner bookkeeping is distinguished from student data.
- All three presets save, complete onboarding and accept later customisation. Interrupted interview answers merge without losing previous answers. Existing Obsidian notes and settings remain unchanged. Changing a populated workspace is blocked without deleting data.
- All five workflows execute through the job runner with controlled provider responses across business, creator and learning configurations. Real authenticated Claude and Codex CLI requests also completed. A real Claude briefing and Codex content draft used fictional course notes and returned source references.
- Markdown, text, CSV, JSON, HTML and text PDF extraction, attachment fallback, duplicate handling, simultaneous imports, original byte preservation, confirmed numeric metrics and missing data handling passed. Extracted output filenames cannot overwrite originals.
- A browser button was tested through the live HTTP queue, local runner and authenticated Codex CLI to a saved report; the report overlay displayed its source citation. Fictional test data was then removed.
- Local/private URLs and unsupported URL protocols are rejected. API host/origin checks reject unrelated sites. Unconfigured workflows remain disabled. Invalid configuration is reported without replacing saved preferences.
- Desktop at 1512 pixels, narrow screens at 390 and 320 pixels, native dialog focus and Escape, reduced motion, real WebGL rendering, and a deliberately disabled WebGL illustration fallback were exercised. There were no uncaught browser errors in the production interaction checks.
- Real Kokoro female (Heart) and male (Michael) synthesis succeeded with non-default speed. The local microphone transcription engine recovered the expected sentence from each generated WAV. Browser preview correctly requests the selected voice. Microphone denial retains typed input; Stop cancels playback.
- A clean source export started and stopped successfully with no AI CLI on PATH and no voice models. Missing capabilities were reported explicitly.
- A clean source export installed dependencies and passed type checking, the core tests and a production build without copied configuration, private skills or voice models.
- Controlled browser speech tests cover cross-tab cancellation, local-voice failure falling back to system speech, and speech unavailability falling back to text. These tests verify behavior, not the availability or sound quality of a particular device voice.
- Public HTML import and a real HTTP 404 were exercised.
- Production build, TypeScript checking and the core tests pass. npm dependency audit reports no known vulnerabilities at validation time.

## Practical limits

A conversation is guided by the included agent instructions; its wording and quality depend on the student's chosen assistant. Automated onboarding checks verify saved progress, configuration and preservation, rather than pretending to be a human student completing a live interview.

Windows and Linux are covered by the CI matrix for the Node application. Physical microphone capture, audio quality, GPU performance, device voice availability and optional local voice installation still vary by computer. Confirm them on the student's device. Browser speech uses the system's available voices; a voice present on one laptop is not guaranteed elsewhere.

AI output and citations need review. Context is bounded and may omit or truncate sources; imported data is a saved snapshot. The source health indicators do not imply live account connectivity. Private integrations and outbound actions are additional work.

Screenshots show the sanitised starter with no connected accounts or personal information. Optional voice models, local configuration, runtime data and reports are excluded from the release.
