# ARGUS

### Your business, built through conversation.

Describe what you do, decide what would help, and build a workspace around it. ARGUS combines a guided business interview, a personal dashboard, conversation, local speech and a browser feature builder. The original DAYBREAK design and 3D city remain the starting point.

![ARGUS student command centre](docs/images/command-centre.png)

## Start here

1. Choose **Code → Download ZIP** on GitHub and unzip it, or clone the repository.
2. Open that folder in your own **Codex or Claude coding assistant**.
3. Paste:

> Help me start ARGUS. Check this computer, set up the app and local voice, then help me describe my business and build my first useful result. Ask one question at a time, reuse my answers, and let me choose the appearance.

Your assistant follows [ONBOARD.md](ONBOARD.md), checks Node.js **22.13+** and your chosen CLI, and starts ARGUS. AI replies need your own supported account and a separately installed, signed-in codex or claude command. A desktop assistant being open does not establish CLI access.

If Node is already available, these commands work on macOS, Windows PowerShell and Linux:

    npm ci
    npm run setup
    npm start

Open **http://127.0.0.1:3117**. Keep the terminal open. Setup prepares local voice in the background; typed onboarding is available while downloads finish. The first start builds the app. No .env, purchased voice API, global Python installation or copied account credentials are required.

Choose **Start talking** once local listening and speaking are ready. Grant microphone access, speak, and pause to submit a turn. Tap interrupt to stop a reply and speak again. Typed conversation is always available. Stop with npm run stop or Ctrl+C.

## Build your first useful result

The interview asks about your business, customers, recurring problem, desired first result and selected information. It remembers combined answers and recommends a starting point when you say “you decide.” Review and edit the business/design brief before accepting it. A failed AI request keeps your interview and completed setup intact.

| Starter pack | First result | Next things to build |
| --- | --- | --- |
| Sales Pipeline | Pipeline review with definitions and follow-up priorities | Weekly targets, lead-source comparison, follow-up tracker |
| Agency Delivery | Review of client commitments and outstanding work | Project tracker, team capacity, client reports |
| Content Planning | A practical plan grounded in your business | Editorial calendar, approval tracker, campaign reviews |

Each pack includes questions, empty CSV templates, fictional records, commands and a first-result example under [examples/packs](examples/packs). Importing a pack is optional. **DEMO records remain labelled as demonstration data; they are never live account results.**

## Make it yours

Choose light, dark or device appearance; accent colour; standard or larger text; comfortable or compact density; panel priorities; and a prominent, subtle or still city. Keep DAYBREAK by skipping personalisation. Preferences and business definitions can be edited later.

Then ask for a feature:

> Build a lead follow-up tracker with a form, owner, next contact date and status. Start with demonstration records.

ARGUS generates dashboards, trackers, forms, tables, calculations and report workflows against a fixed browser SDK. It proposes the build, creates a sandboxed preview, and lets you activate the validated version. Previous versions remain available for rollback. The builder does not install arbitrary dependencies, execute generated server code or connect private accounts. See [Configuration and extensions](docs/configuration.md).

## Bring your information

Use **Sources → Add a source**, or ask your coding assistant to run:

    npm run import -- --file "path/to/your-notes.md"
    npm run import -- --folder "path/to/a-folder-you-selected"
    npm run import -- --url "https://example.com/public-page"

Markdown, text, CSV, JSON, text PDFs and public HTML pages are supported. Originals, source IDs and capture dates are retained. Hidden files, known credential filenames and symlinks are skipped. Limits are 10 MB per file/page, 100 files per folder import and 200 pages per PDF. Scanned PDFs need OCR; unsupported attachments are marked accordingly.

Metrics need confirmed source, column, aggregation, units and period. Missing data stays missing. Basic dashboard bindings aggregate all imported rows; filter a derived table first when needed. Generated feature tables support explicit row filters. Neither a source badge nor an installed CLI means an external account is connected.

An existing Obsidian vault is optional. ARGUS uses its own ARGUS subfolder and preserves existing notes. Your profile, conversation, records and reports survive reopening the app.

## Local conversation audio

Setup prepares a checksum-verified uv runtime, managed Python 3.12, Kokoro speech and faster-whisper small.en transcription. Model downloads are approximately **820 MB**, plus Python, dependencies and caches. Allow several GB of free storage. Installation progress, retry and skip controls are in the console; verified downloads are reused and the voice service starts without a manual restart.

Voice options include Heart, Emma, Michael and George at normal speed by default. A conversation listens, transcribes, asks your AI provider, speaks a short reply, then resumes after playback finishes. The complete answer stays in the transcript. Tap-to-interrupt is supported; automatic interruption while ARGUS is speaking is not part of this release. Switching tabs ends microphone capture.

For a foreground installation or repair:

    npm run voice:setup

Packaged local voice targets macOS 13+ Intel/Apple Silicon, Windows x64 and Linux x64 with glibc 2.28+. Exact device performance and microphone quality vary. See [validation status](docs/validation.md) before treating a platform as physically tested. English is the supported transcription language.

Kokoro and transcription operate locally after installation. AI replies still use your provider, network connection and account limits. Device/system voices remain an alternative and may use the operating-system vendor’s services.

## Development and sharing

    npm start -- --dev
    npm test
    npm run typecheck
    npm run build
    npm run test:e2e
    npm run release:check

Share the clean GitHub download, not a ZIP of your personalised working folder. Git ignores configuration, student work, recordings, models and caches, but that does not remove them from a manually created ZIP. The release checker inspects tracked files and requires a Git checkout.

ARGUS runs on localhost (3117 for the console; 3118 for voice). It is not configured for public hosting. Sending, publishing, private-account integrations and paid voice services are outside this release. See [Architecture](docs/architecture.md), [Troubleshooting](docs/troubleshooting.md) and [Validation](docs/validation.md).

## Licence

MIT. You may modify, share and commercially use your version while retaining the licence notice. Third-party components retain their own licences; see [Third-party notices](THIRD_PARTY_NOTICES.md).
