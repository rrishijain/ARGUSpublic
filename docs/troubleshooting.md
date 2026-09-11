# Troubleshooting

Start with **npm run doctor**. It reports configuration, CLIs and local service status without printing credentials. Keep interview answers and completed configuration when a dependency fails.

| What you see | What to do |
| --- | --- |
| Node missing/old | Install Node.js 22.13+, reopen the terminal and run npm ci |
| Conversation cannot send | Choose a provider; verify its CLI is on PATH and the runner is started |
| CLI sign-in failure | Open codex or claude directly and complete your own sign-in |
| Unsupported CLI option | Update the CLI; do not remove tool restrictions |
| Account usage limit | Check your own provider limits; retry deliberately when access returns |
| First report failed | Setup is still complete; retry a report without repeating onboarding |
| Reply format error | Your answers are preserved; resend or narrow the message |
| Reply stays queued | Run npm start and check runner status; an active job finishes before the next turn |
| Interrupted reply | Reopen the saved conversation and send again; the late result is ignored |
| Port 3117 occupied | Stop your other ARGUS instance; the launcher does not kill unrelated processes |
| Voice downloading | Continue typing; model download is about 820 MB plus runtimes/dependencies |
| Voice download failed | Check network/free disk, then Retry; verified complete files are reused |
| Models fail checksum | Retry a fresh download; do not disable hash verification |
| Voice paused/skipped | Continue typing or choose Retry when ready |
| Folder moved or voice files changed | Retry installation to repair the managed environment |
| Missing global Python | None is required; setup prepares its own Python 3.12 |
| Port 3118 belongs to another folder | Stop that ARGUS instance/service before enabling this folder's voice |
| No sound | Unmute and use Preview voice through a click; browsers require a user gesture |
| Microphone denied/unavailable | Grant access in browser settings or keep typing |
| Conversation stops on tab switch | This releases the microphone intentionally; return and Start talking again |
| Speech is misheard | Use a quieter room/headset, speak a shorter turn or correct the text; English only |
| Feature build failed | One automatic repair was attempted; revise the request and explicitly retry |
| Feature preview cannot write a task/report | Preview is isolated; activate a version before workspace writes |
| Feature requests an unavailable source | Select an imported source explicitly and rebuild |
| Old feature does not show a new field | Rollback preserves records; reactivate the newer version to use its fields |
| Scanned PDF has no text | It needs OCR; do not treat the retained attachment as analysed |
| Metric unavailable | Confirm the source, column, units, aggregation and filtered input rows |
| Public page import fails | It may require login/JavaScript or block imports; provide an exported file |
| Configuration corrupt | Restore an appropriate .argus-local/backups copy; corrupt settings are not overwritten |
| Workspace change blocked | Copy/export existing student data deliberately; do not delete it to bypass the check |

Windows students can use PowerShell with the same npm commands. A CLI installed only inside WSL is unavailable to native Windows ARGUS; use one environment consistently. Local voice packages target macOS 13+ Intel/Apple Silicon, Windows x64 and Linux x64 with glibc 2.28+. Other systems retain typed operation where Node is supported.

Voice setup logs are under .argus-local/voice/install.log; service logs are alongside them. Review logs before sharing them, and do not share source files, full transcripts, account credentials or your entire personalised folder as a support attachment.

Configuration v1 backups preserve previous settings. Before manually restoring a backup, stop ARGUS and preserve the current configuration too. Source imports and preferences do not need a rebuild. Code changes require a new production build before restarting; CLI workspace changes require restarting the runner.
