import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,defaults,saveConfig,workspace,atomicJSON,readJSON} from '../runtime/config.mjs';
import {startVoiceInstall} from '../runtime/voice-install.mjs';

const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||major===22&&minor<13){console.error('Install Node.js 22.13 or later first.');process.exit(1);}
if(!fs.existsSync(path.join(ROOT,'node_modules'))){const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['ci'],{cwd:ROOT,stdio:'inherit',shell:process.platform==='win32'});if(r.status!==0)process.exit(1);}
if(!fs.existsSync(path.join(ROOT,'.argus-config.json')))saveConfig(defaults());
const draft=path.join(ROOT,'.argus-onboarding.json');if(!fs.existsSync(draft))atomicJSON(draft,{stage:'interview',answers:{},updatedAt:new Date().toISOString()});
console.log('ARGUS is ready for your interview. Open this folder in Claude Code or Codex and say:');
console.log('“Make ARGUS my own. Ask me questions one at a time. Keep the existing design unless I ask you to change it.”');
console.log('To preview the console now: npm start');
console.log(startVoiceInstall().message);
