import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {ROOT} from '../runtime/config.mjs';
const args=process.argv.slice(2),manual=args.includes('--python')?args[args.indexOf('--python')+1]:null;
const candidates=manual?[manual]:process.platform==='win32'?['python','python3']:['python3.12','python3.11','python3'];
const python=candidates.find(p=>{const r=spawnSync(p,['-c','import sys; exit(0 if (3,10) <= sys.version_info[:2] <= (3,12) else 1)'],{stdio:'ignore'});return r.status===0;});
if(!python){console.error('Install Python 3.10–3.12 (3.12 recommended), then retry. System speech already works without this upgrade.');process.exit(1);}
const run=(cmd,args)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd:ROOT,stdio:'inherit',shell:false});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(new Error('Voice setup command failed. System speech remains available.')));});
const folder=path.join(ROOT,'voice-server'),venv=path.join(folder,'.venv'),py=path.join(venv,process.platform==='win32'?'Scripts/python.exe':'bin/python');
const sha=file=>new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256'),r=fs.createReadStream(file);r.on('data',c=>hash.update(c));r.on('end',()=>resolve(hash.digest('hex')));r.on('error',reject);});
try {
  if(!fs.existsSync(py))await run(python,['-m','venv',venv]);
  await run(py,['-m','pip','install','-r',path.join(folder,'requirements.txt')]);
  const models=JSON.parse(fs.readFileSync(path.join(folder,'models.json'),'utf8'));fs.mkdirSync(path.join(folder,'models'),{recursive:true});
  for(const m of models){const file=path.join(folder,'models',m.name);if(fs.existsSync(file)&&await sha(file)===m.sha256){console.log(`${m.name} verified.`);continue;}console.log(`Downloading ${m.name} from the official release…`);const r=await fetch(m.url,{signal:AbortSignal.timeout(600000)});if(!r.ok||!r.body)throw new Error(`Model download failed (${r.status}). Retry later.`);await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(file+'.partial'));if(await sha(file+'.partial')!==m.sha256){fs.rmSync(file+'.partial');throw new Error('Model checksum mismatch. The file was not installed.');}fs.renameSync(file+'.partial',file);}
  console.log('Downloading the optional English transcription model…');
  await run(py,['-c',`from faster_whisper import WhisperModel; WhisperModel('tiny.en',device='cpu',compute_type='int8',download_root=${JSON.stringify(path.join(folder,'models/whisper'))})`]);
  console.log('Local voice is ready. Restart npm start, choose Kokoro in Voice settings, and preview a male or female voice.');
}catch(e){console.error(e.message);process.exitCode=1;}
