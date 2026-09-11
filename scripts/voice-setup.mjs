import {runVoiceInstall, startVoiceInstall} from '../runtime/voice-install.mjs';
if (process.argv.includes('--background')) console.log(startVoiceInstall({retry:process.argv.includes('--retry')}).message);
else try { await runVoiceInstall(); } catch (error) { console.error(error.message); process.exitCode=1; }
