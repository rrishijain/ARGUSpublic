import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,loadConfig,workspace} from '../runtime/config.mjs';
import {providers} from '../runtime/providers.mjs';
try {
  const c=loadConfig();console.log(`Node: ${process.versions.node} (22.13+ required)`);console.log(`Dependencies: ${fs.existsSync(path.join(ROOT,'node_modules'))?'installed':'run npm ci'}`);
  console.log(`Interview: ${c.onboarded?'complete':'not complete — read ONBOARD.md'}`);console.log(`Workspace: ${fs.existsSync(workspace(c))?'available':'will be created when needed'}`);
  for(const [p,s]of Object.entries(providers()))console.log(`${p}: ${s.installed?'installed; run it directly to verify sign-in':'not found on PATH'}`);
  console.log(`Selected provider: ${c.provider||'none'}`);
  for(const [name,port,endpoint]of [['Console',3117,'/api/state'],['Local voice',3118,'/health']])try{const r=await fetch(`http://127.0.0.1:${port}${endpoint}`,{signal:AbortSignal.timeout(1000)});console.log(`${name}: ${r.ok?'responding':'not ready'}`);}catch{console.log(`${name}: not running${name==='Local voice'?' (optional)':''}`);}
  console.log('System speech is checked in your browser: Voice settings → Preview voice. No credentials were read or printed.');
}catch(e){console.error(e.message);process.exitCode=1;}
