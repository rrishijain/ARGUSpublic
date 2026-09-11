# Release validation

This is the ARGUS 2.0 beta validation guide. Separate automated coverage, current release evidence and participant testing: an available installer or a passing fixture does not establish microphone quality on every laptop.

## Recorded release evidence — 11 September 2026

- All 76 Node tests and all 9 Chromium browser tests pass. Type checking and the production build pass on the development Mac. The npm dependency audit reports zero known vulnerabilities at this checkpoint.
- Three real authenticated Codex calls used fictional Juniper Lantern business context. The first saved a target of 17 (14.8 seconds); the follow-up recalled that target (18.3 seconds). A subsequent build request produced a valid feature-build proposal and a compiled tracker with only records.read/records.write capabilities and three demonstration records (73.5 seconds). The build required no automatic repair.
- The installed Kokoro/faster-whisper stack completed a real generated-speech round trip: synthesis took 290 ms and transcription 779 ms for the test sentence. These are one-machine observations, not promised response times.
- A two-turn Chrome audio check exercised local voice-activity detection, submission and playback. The test reply played for 2.03 seconds before listening resumed. This controlled audio test does not establish human microphone or Indian-accent recognition quality.
- The production Next.js browser path also passed with real local speech/transcription and controlled AI replies: two automatic turns, no live microphone tracks during playback, tap interruption in 74 ms, all tracks released on exit, and typed fallback after simulated microphone denial. Repeat with `node scripts/voice-browser-check.mjs --production` while the app and local voice service are running.
- A clean GitHub commit ZIP installed with `npm ci` and passed all 75 Node tests, type checking and production build without Git metadata or copied personal/runtime state. This Mac still had global Git/Python available; the test does not claim those programs were physically absent.
- A human participant pilot, including Indian accents, has not been performed. Hosted platform installation results and physical device coverage remain separate release evidence.

## Automated coverage

The Node suites cover configuration v1 migration with backups; retained onboarding answers; combined answers and appearance defaults; workspace/vault preservation; first-report failure; malformed conversational output; deduplication; cancellation and stale replies; remembered context; explicit local actions; shared queue priority; demonstration packs; selected-source restrictions; feature compilation, permissions, preview isolation, activation and rollback; and voice installer failure/retry controls.

Existing extraction and workflow tests retain original bytes, selected-source boundaries, missing-data behavior and tool-free provider invocations. Provider responses in these tests are controlled fixtures and do not use a participant's account.

Browser tests run in Chromium with controlled responses. They exercise onboarding, appearance, conversation and relevant responsive/accessibility behavior. They do not prove natural conversational quality or physical microphone performance.

The regular GitHub Actions matrix runs npm installation, Node tests, type checking, production build, release checks and dependency auditing on Ubuntu, macOS and Windows. Ubuntu additionally runs Chromium browser checks.

## Real voice installation checks

The **Student edition checks** workflow runs the real voice installation matrix on pull requests before merge. It can also be triggered manually with the voice_smoke option. It installs the pinned uv/Python/dependency/model stack on hosted Ubuntu, macOS and Windows and performs real Kokoro synthesis plus faster-whisper transcription. It needs no AI account. Its generated speech round trip checks engine operation, not recognition of human accents. Hosted results for this release are pending until those jobs finish.

Voice artifact/platform verification covers macOS 13+ Intel/Apple Silicon, Windows x64 and Linux x64 with glibc 2.28+ as intended package targets. A passing latest-runner job is not evidence that the oldest supported OS or every physical architecture was tested. Record actual workflow results and device details before promising classroom compatibility.

Before publication, run the full application checks and the real voice workflow, inspect failures, and test a clean GitHub ZIP without copied configuration/models. Verify repeated setup, cancelled/corrupt downloads, moved folders, occupied ports and typed fallback. Store only non-secret status/timing output as CI artifacts.

## Participant pilot still required

Human onboarding quality and English recognition with Indian accents need a classroom pilot. Use business names, amounts, dates and ambiguous terminology; inspect corrections rather than treating a generated-audio round trip as an accent benchmark.

Have at least five participants with different business cases complete setup, get a useful result, ask a spoken follow-up, build and activate one small feature, interrupt a reply, and reopen the work the next day. Record OS/CPU, install duration, recognition errors, transcription/AI/playback latency and any assistance needed.

Also check real microphone permission/denial, headphones and laptop speakers, tab switching, larger text, contrast, keyboard navigation, narrow screens and reduced motion. Physical Mac/Windows/Linux audio validation and this human pilot must not be described as completed until performed.

## Practical limits

AI responses and citations need review. Context is bounded; selected sources may be truncated. Imported data is a snapshot, DEMO records are fictional, and source indicators do not imply account connections. Basic dashboard metric periods label imported rows and do not apply hidden date filters.

Typed conversation needs the student's installed, signed-in CLI and account access. Speech becomes local after installation, but provider responses remain online. This beta supports English and tap-to-interrupt, not automatic interruption during playback. Large or invalid feature builds may require a narrower request.

The release checker scans tracked files and requires Git metadata. A manually zipped working directory can include ignored personal data, so distribute the repository ZIP or a clean tracked-file export. Configuration, reports, recordings, caches and downloaded models are not public release assets.
