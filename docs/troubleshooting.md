# Troubleshooting

**Start with `npm run doctor`.** It reports configuration, installed CLIs and local service status without printing credentials.

| What you see | What to do |
| --- | --- |
| Node is missing or too old | Install Node.js 22.13+; reopen your terminal and run `npm ci` |
| Workflow buttons are disabled | Complete the interview, select a provider and start the runner with `npm start` |
| CLI is not installed | Install your chosen provider's official CLI and make sure it is on PATH |
| AI task asks you to sign in | Open `claude` or `codex` directly in a terminal and complete your own sign-in |
| Unsupported CLI option | Update the CLI; do not remove the tool restrictions to make it run |
| Account limit | Check your own provider usage; ARGUS does not bypass limits or silently retry |
| Port 3117 is occupied | Stop your other ARGUS instance with `npm run stop`; the launcher will not kill unrelated processes |
| No sound | Open Voice settings, unmute and click Preview voice; browsers require a user gesture |
| No preferred male/female voice | Install the optional Kokoro upgrade; system voices differ by device |
| Kokoro installation fails | Verify Python 3.10–3.12 and internet access; system speech remains available |
| Local voice is unavailable | Restart after `npm run voice:setup`; check that port 3118 is free |
| Microphone denied | Allow access in browser settings or keep using typed commands |
| A scanned PDF has no text | It needs OCR; do not treat the attachment as analysed |
| Metrics show unavailable | Confirm table columns, units, aggregation and reporting period; clean a derived copy if needed |
| Public page import fails | The page may block requests, require login, need JavaScript rendering or exceed limits; provide an exported file instead |
| Configuration is corrupt | Restore a backup from `.argus-local/backups`; ARGUS does not overwrite corrupt settings |
| Your existing vault is selected | ARGUS uses its own `ARGUS` subfolder; your original notes are preserved |

On Windows, use PowerShell and the same npm commands. A CLI installed only inside WSL is not available to a native Windows ARGUS process: run the entire project inside WSL or install the native CLI. For Linux, install an available speech voice through your desktop environment or use the optional Kokoro upgrade.

After changing source code, stop the app, run `npm run build`, then start again. Preferences and source imports do not require a rebuild. After changing the workspace location, restart the runner deliberately.
