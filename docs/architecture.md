# How ARGUS works

    Coding assistant checks Node and the participant's own CLI
                         ↓
       Setup starts app and local voice preparation
                         ↓
        Typed or spoken adaptive business interview
                         ↓
        Editable brief → confirmed workspace/profile
                         ↓
          Conversation + dashboard + feature builder
                         ↓
             One local AI runner, tool-free
                 ↙          ↓          ↘
        Structured reply  Markdown   Browser feature bundle
                 ↓        report        ↓
       Validated local proposals    Sandboxed preview → activation

The original city and DAYBREAK styles are the defaults. Configuration controls content, panel ordering and supported appearance choices. The shared workflow registry contains five reports plus separate conversation/build capabilities. Provider credentials stay with the student's authenticated CLI; ARGUS does not copy credentials or read global environment files.

## State and conversation

Configuration v2 adds a business profile, appearance, selected starter pack, first-result status and active feature pointers. Loading v1 makes a local backup and preserves existing data, provider, voice and completed onboarding. Invalid JSON is reported without replacing the file.

Unfinished interviews and conversational queue records live under .argus-local, outside the unconfirmed workspace. Answers persist in .argus-onboarding.json. Acceptance preserves answers and copies transcripts into the chosen workspace. A failed first report does not undo onboarding.

Each conversation saves both roles, request IDs and a revision. Context includes the business profile, the latest 12 turns (bounded individually), an extractive summary of older turns (up to 14,000 characters), and relevant selected-source excerpts. The complete saved transcript remains available. Replies must match a validated JSON contract. Invalid output cannot partially update the interview or apply actions. Task, note, settings, report and feature-build proposals require application through local handlers.

The runner holds one root lock and executes one AI job at a time. Queued conversation takes priority over queued reports/builds; active work is not pre-empted. Duplicate request IDs reuse their original job. Cancellation changes the session revision and prevents stale replies from updating state. Interrupted work remains recoverable without silently retrying the account.

## Sources and features

The importer preserves original bytes and extracted text, IDs and dates. It never executes imported instructions. Report context is bounded to 70,000 source characters and 18,000 per source, ranked by query terms/capture time. Coverage limits are supplied to the model. Source citations and AI interpretation still need review. DEMO pack sources are explicitly marked as fictional.

Basic dashboard metrics calculate deterministically over their imported rows after confirmed bindings. Their period label does not itself filter rows. Feature source queries support explicit filters and deterministic aggregations; source IDs are limited by the selected feature permissions.

Generated browser features compile against bundled React and the fixed ARGUS SDK. They cannot import arbitrary packages or execute server code. A sandboxed frame, restrictive content policy and a channel-checked message bridge mediate capabilities. The server validates feature/version tokens, selected sources, record schema and preview permissions. Preview records are separate from active records; preview cannot write workspace tasks, notes or reports.

Validated artifacts are immutable and hash checked. Activation points to that exact version; rollback changes code without deleting feature records. Schema changes are additive, keeping previous fields/types and making new fields optional. Builds get one repair attempt for invalid/failed compilation, then an explicit retry. See [Feature SDK](feature-sdk.md).

## Local speech

Setup automatically manages a checksum-pinned uv bootstrap, Python 3.12, hashed binary dependencies and pinned speech models in .argus-local/voice. Verified downloads are reused; incomplete installations can retry and moved environments are repaired. Setup self-tests synthesis and English recognition separately and performs a speech-to-transcription round trip.

Locally served voice-activity assets detect turns. The browser stops listening while the provider thinks and audio plays, then resumes after playback. Tap interrupts; ending a session or losing the active tab releases microphone capture. A single tab owns the microphone. A 1.4-second ending silence and 45-second maximum turn are defaults.

The voice service binds to localhost:3118, uses instance ownership checks, preloads Kokoro and CPU INT8 faster-whisper small.en, and never downloads during a request. Recordings are processed in memory. Local speech does not make the CLI provider offline. Service readiness, account failures and audio errors are displayed separately; text remains usable.
