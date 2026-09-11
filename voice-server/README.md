# Local conversational speech

Normal `npm run setup` and `npm start` prepare local voice in the background. The interface remains usable with text throughout. The installer uses a checksum-pinned uv release and managed CPython 3.12.14; it does not require global Python, modify PATH, or write shell configuration. `npm run voice:setup` runs the same verified preparation in the foreground for diagnostics.

All installed files, models, logs and caches live under `.argus-local/voice/`, which is excluded from releases. Speech recordings stay in browser/server memory and are never written to disk. Existing verified Kokoro downloads from older versions are reused. Model downloads total approximately 814 MiB; allow additional space for Python, dependencies, and installation caches.

## Runtime contract

The supervisor checks every three seconds and starts the voice service as soon as installation succeeds. No application restart is required. A paused installation stays paused until Retry. Changed or moved installations are repaired on the next launch; their previous virtual environment is retained in a dated local directory.

`GET /health` reports synthesis and recognition readiness independently. `ok` is true only after both models load and pass inference checks. A per-checkout `instance` prevents accidental reuse of another running ARGUS folder. Application proxies include this instance in `x-argus-instance` on `POST /speak` and `POST /stt`. The service only listens on localhost:3118 and accepts the ARGUS localhost origin.

Both models preload at startup. Inference only uses explicit local model paths with offline mode enabled; user requests never initiate model downloads. Recognition uses English `small.en` on CPU with INT8 and up to four threads. The setup smoke test recognises synthesised speech containing “business workspace”, rather than marking an import or a model filename as proof of working recognition.

The browser controller uses local Silero V5 assets, waits for 1.4 seconds of ending silence, and caps a turn at 45 seconds. It releases microphone tracks during transcription, AI work and reply playback. A click can interrupt replies. A backgrounded/closed tab ends the session; a Web Lock plus heartbeat limits the microphone to one tab. It resumes listening only after playback completes. This release uses tap interruption, not microphone-based interruption while the speaker is active.

The AI provider remains the participant's authenticated Codex or Claude account; local speech does not make AI responses offline or remove provider account limits. Speech downloads require an internet connection initially.

## Pinned releases and verification

- Bootstrap releases and SHA-256 hashes: `bootstrap.json`.
- Kokoro and exact `small.en` revision/artifact hashes: `models.json`.
- Direct dependency pins: `requirements.txt`.
- Universal transitive dependency lock with hashes: `requirements.lock`.

The intended baseline is macOS 13+ on Intel and Apple Silicon, Windows x64, and Linux x64 with glibc 2.28+. ONNX Runtime 1.20.1 supplies a macOS 13 universal2 wheel; CTranslate2 4.6 and AV 15 retain Intel/macOS 13 compatibility. Other architectures fall back to typed interaction with a clear explanation.

On 11 September 2026, a clean local managed runtime and real synthesis/recognition round trip passed on Apple Silicon. Binary-only lock resolution passed for Intel macOS, Windows x64 and Linux x64/glibc 2.28. Those resolution checks do not establish successful device-level execution on every platform. CI should run the real smoke test on the published supported runners. Recognition of Indian accents requires participant pilot recordings; synthesised test speech is not evidence of accent accuracy.

Run `node --test tests/voice.test.mjs` for interrupted/corrupt downloads, immutable cache reuse, moved checkout identity, and mocked browser state/track-release tests. After installing, run the local venv Python with `voice-server/server.py --self-test` for real offline model inference. `npm run doctor` reports installation, speaking, listening and service errors separately.

To intentionally refresh dependency pins, update `requirements.txt` and use the pinned uv executable with `pip compile voice-server/requirements.txt --python-version 3.12 --universal --generate-hashes --no-header -o voice-server/requirements.lock`. Check binary-only lock resolution for each baseline and repeat real inference tests before publishing.
