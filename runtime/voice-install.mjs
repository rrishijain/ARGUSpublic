import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {ROOT,atomicJSON,readJSON} from './config.mjs';

const local=root=>path.join(root,'.argus-local','voice');
const stateFile=root=>path.join(local(root),'install.json');
const now=()=>new Date().toISOString();
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
export const voiceInstance=(root=ROOT)=>crypto.createHash('sha256').update(path.resolve(root)).digest('hex').slice(0,24);
export const voicePython=(root=ROOT)=>path.join(local(root),'venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
export function installationFingerprint(root=ROOT) {
  const hash=crypto.createHash('sha256');
  for(const name of ['bootstrap.json','models.json','requirements.lock','server.py'])hash.update(fs.readFileSync(path.join(root,'voice-server',name)));
  return hash.update(path.resolve(root)).digest('hex');
}
export function readVoiceInstall(root=ROOT) {
  const state=readJSON(stateFile(root),{status:'idle',stage:'waiting',message:'Local speech will prepare in the background.',progress:0,speaking:false,listening:false});
  if(state.status==='installing'&&state.pid&&!alive(state.pid))return {...state,status:'error',message:'Voice preparation was interrupted. Retry to reuse verified downloads.'};
  if(state.status==='ready'&&(!fs.existsSync(voicePython(root))||state.fingerprint!==installationFingerprint(root)||readJSON(path.join(root,'voice-server/models.json'),[]).some(model=>!fs.existsSync(path.join(local(root),'models',model.name)))))return {...state,status:'error',repairNeeded:true,message:'Voice files changed or moved. Retry to repair this installation.',speaking:false,listening:false};
  const {pid,root:privateRoot,...publicState}=state;
  return publicState;
}
function update(root,patch) { const state={...readJSON(stateFile(root),{}),...patch,updatedAt:now()};atomicJSON(stateFile(root),state);return state; }
function endTree(pid) {
  if(!pid||pid===process.pid)return;
  if(process.platform==='win32')spawnSync('taskkill',['/pid',String(pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});
  else try{process.kill(-pid,'SIGTERM');}catch{try{process.kill(pid,'SIGTERM');}catch{}}
}
export function cancelVoiceInstall({root=ROOT}={}) {
  const state=readJSON(stateFile(root),{});if(state.status==='installing')endTree(state.pid);
  update(root,{status:'skipped',stage:'paused',message:'Voice setup paused. Continue with text or retry when ready.',pid:null});return readVoiceInstall(root);
}
export function startVoiceInstall({root=ROOT,retry=false}={}) {
  const previous=readVoiceInstall(root);
  if(previous.status==='installing'||previous.status==='ready'||previous.status==='skipped'&&!retry||previous.status==='error'&&!previous.repairNeeded&&!retry)return previous;
  fs.mkdirSync(local(root),{recursive:true});
  const log=fs.openSync(path.join(local(root),'install.log'),'a',0o600);
  const child=spawn(process.execPath,[path.join(root,'scripts/voice-setup.mjs'),'--worker'],{cwd:root,detached:true,stdio:['ignore',log,log],windowsHide:true});
  child.on('error',error=>update(root,{status:'error',message:error.message,pid:null}));
  update(root,{status:'installing',stage:'starting',progress:0,message:'Preparing local voice. You can continue typing.',pid:child.pid});
  fs.closeSync(log);child.unref();return readVoiceInstall(root);
}
export async function sha256(file) {const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export async function verifiedDownload(artifact,file,{signal,onProgress=()=>{},fetchImpl=fetch}={}) {
  if(fs.existsSync(file)&&await sha256(file)===artifact.sha256)return false;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  for(let attempt=0;attempt<3;attempt++) {
    try {
      signal?.throwIfAborted();
      const response=await fetchImpl(artifact.url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(600000)]):AbortSignal.timeout(600000)});
      if(!response.ok||!response.body)throw new Error(`Download failed (${response.status}).`);
      let bytes=0;const total=Number(response.headers.get('content-length'))||0;
      const stream=Readable.fromWeb(response.body);stream.on('data',chunk=>{bytes+=chunk.length;onProgress(bytes,total);});
      await pipeline(stream,fs.createWriteStream(file+'.partial',{mode:0o600}),{signal});
      if(await sha256(file+'.partial')!==artifact.sha256)throw new Error(`Checksum mismatch for ${path.basename(file)}. The download was not installed.`);
      fs.renameSync(file+'.partial',file);return true;
    } catch(error) {
      fs.rmSync(file+'.partial',{force:true});if(signal?.aborted||attempt===2)throw error;
      await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
    }
  }
}
export function platformArtifact(root=ROOT,platform=process.platform,arch=process.arch,release=os.release()) {
  const manifest=readJSON(path.join(root,'voice-server/bootstrap.json'));
  if(platform==='darwin'&&Number(release.split('.')[0])<22)throw new Error('Local voice requires macOS 13 or later. Typed conversation remains available.');
  const asset=manifest.platforms[`${platform}-${arch}`];
  if(!asset)throw new Error(`Local voice is not packaged for ${platform}/${arch}. Supported: macOS 13+ Intel/Apple Silicon, Windows x64, Linux x64 (glibc 2.28+).`);
  return {...asset,...manifest,url:`https://github.com/astral-sh/uv/releases/download/${manifest.uvVersion}/${asset.archive}`};
}
const run=(command,args,options={})=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],...options});let output='';
  for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>{output=(output+chunk).slice(-10000);process.stdout.write(chunk);});
  child.on('error',reject);child.on('exit',code=>code===0?resolve(output):reject(new Error(`Voice setup command failed (${code}): ${output.slice(-2000)}`)));
});
export async function prepareVoiceRuntime({root=ROOT,signal}={}) {
  const artifact=platformArtifact(root),base=local(root),uvFolder=path.join(base,'uv',artifact.uvVersion),uvName=process.platform==='win32'?'uv.exe':'uv';
  const archive=path.join(base,'downloads',artifact.archive);
  update(root,{stage:'runtime',message:'Preparing the verified local Python runtime…',progress:5});
  await verifiedDownload(artifact,archive,{signal});fs.mkdirSync(uvFolder,{recursive:true});
  await run('tar',['-xf',archive,'-C',uvFolder],{cwd:root,signal});
  const uv=path.join(uvFolder,artifact.archive.endsWith('.zip')?'':artifact.archive.replace(/\.tar\.gz$/,''),uvName);
  const env={...process.env,UV_PYTHON_INSTALL_DIR:path.join(base,'python'),UV_PYTHON_BIN_DIR:path.join(base,'bin'),UV_CACHE_DIR:path.join(base,'cache'),UV_NO_MODIFY_PATH:'1',UV_PYTHON_PREFERENCE:'only-managed',UV_NO_CONFIG:'1'};
  await run(uv,['python','install',artifact.pythonVersion,'--no-bin','--no-registry'],{cwd:root,env,signal});
  const python=(await run(uv,['python','find',artifact.pythonVersion],{cwd:root,env,signal})).trim().split(/\r?\n/).at(-1);
  const current=readJSON(path.join(base,'runtime.json'),{}),venv=path.join(base,'venv');
  if(!fs.existsSync(voicePython(root))||current.root!==root||current.python!==python) {
    if(fs.existsSync(venv))fs.renameSync(venv,path.join(base,`venv-before-repair-${Date.now()}`));
    await run(uv,['venv','--python',python,venv],{cwd:root,env,signal});
  }
  atomicJSON(path.join(base,'runtime.json'),{root,python,uv,version:artifact.pythonVersion});return {uv,python:voicePython(root),env};
}
export async function runVoiceInstall({root=ROOT}={}) {
  const abort=new AbortController(),cancel=()=>abort.abort(new Error('Voice setup cancelled.'));
  process.once('SIGTERM',cancel);process.once('SIGINT',cancel);fs.mkdirSync(local(root),{recursive:true});
  const lock=path.join(local(root),'install.lock');let lockFd;
  try {
    try{lockFd=fs.openSync(lock,'wx',0o600);}catch(error){if(error.code!=='EEXIST')throw error;const owner=readJSON(lock,{});if(owner.pid&&alive(owner.pid))return readVoiceInstall(root);fs.rmSync(lock,{force:true});lockFd=fs.openSync(lock,'wx',0o600);}
    fs.writeFileSync(lockFd,JSON.stringify({pid:process.pid}));
    stopVoiceService({root});
    update(root,{status:'installing',stage:'runtime',pid:process.pid,progress:1,message:'Preparing local voice…',speaking:false,listening:false});
    const {uv,python,env}=await prepareVoiceRuntime({root,signal:abort.signal});
    update(root,{stage:'dependencies',message:'Installing verified speech dependencies…',progress:15});
    await run(uv,['pip','sync','--python',python,'--require-hashes','--only-binary',':all:',path.join(root,'voice-server/requirements.lock')],{cwd:root,env,signal:abort.signal});
    const models=readJSON(path.join(root,'voice-server/models.json'));
    for(let index=0;index<models.length;index++) {
      const artifact=models[index];update(root,{stage:'models',message:`Preparing ${artifact.name} (${index+1}/${models.length})…`,progress:30+Math.round(index/models.length*55)});
      const target=path.join(local(root),'models',artifact.name),legacy=path.join(root,'voice-server/models',artifact.name);
      if(!fs.existsSync(target)&&fs.existsSync(legacy)&&await sha256(legacy)===artifact.sha256){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(legacy,target);}
      let last=0;
      await verifiedDownload(artifact,target,{signal:abort.signal,onProgress:(bytes,total)=>{if(Date.now()-last<1200)return;last=Date.now();update(root,{downloadedBytes:bytes,totalBytes:total,progress:30+Math.round((index+(total?bytes/total:0))/models.length*55)});}});
    }
    update(root,{stage:'testing',message:'Testing speech synthesis and English recognition…',progress:90});
    const output=await run(python,[path.join(root,'voice-server/server.py'),'--self-test'],{cwd:root,env:{...env,HF_HUB_OFFLINE:'1'},signal:abort.signal});
    const result=JSON.parse(output.trim().split(/\r?\n/).at(-1));if(!result.speaking||!result.listening)throw new Error('Local speech self-test did not pass.');
    update(root,{status:'ready',stage:'complete',progress:100,message:'Local speaking and listening are ready.',speaking:true,listening:true,selfTest:result,fingerprint:installationFingerprint(root),pid:null});
    console.log('Local voice is ready. ARGUS starts it automatically; no restart is needed.');return readVoiceInstall(root);
  }catch(error){update(root,{status:abort.signal.aborted?'skipped':'error',stage:abort.signal.aborted?'paused':'failed',message:abort.signal.aborted?'Voice setup paused; verified downloads are retained.':error.message,pid:null});throw error;}
  finally{process.removeListener('SIGTERM',cancel);process.removeListener('SIGINT',cancel);if(lockFd!==undefined){fs.closeSync(lockFd);fs.rmSync(lock,{force:true});}}
}
export async function ensureVoiceService({root=ROOT}={}) {
  if(readVoiceInstall(root).status!=='ready')return false;
  const serviceFile=path.join(local(root),'service.json'),previous=readJSON(serviceFile,{});
  try {
    const response=await fetch('http://127.0.0.1:3118/health',{signal:AbortSignal.timeout(1200)}),health=await response.json();
    if(health.instance!==voiceInstance(root)){update(root,{serviceError:'Port 3118 belongs to another application or ARGUS folder. Stop it to enable this voice service.'});return false;}
    if(health.errors&&Object.keys(health.errors).length){update(root,{status:'error',stage:'failed',message:'A local speech model could not start. Retry voice setup to verify and repair its files.',serviceError:Object.values(health.errors).join(' '),serviceReady:false,speaking:health.speaking===true,listening:health.listening===true});return false;}
    update(root,{serviceError:null,serviceReady:health.ok===true,speaking:health.speaking===true,listening:health.listening===true});return health.ok===true;
  }catch{}
  if(previous.pid&&alive(previous.pid))return false;
  const log=fs.openSync(path.join(local(root),'service.log'),'a',0o600);
  const child=spawn(voicePython(root),[path.join(root,'voice-server/server.py')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,HF_HUB_OFFLINE:'1',ARGUS_VOICE_INSTANCE:voiceInstance(root)}});
  child.on('error',error=>update(root,{serviceError:error.message,serviceReady:false}));
  atomicJSON(serviceFile,{pid:child.pid,instance:voiceInstance(root)});fs.closeSync(log);child.unref();return false;
}
export function stopVoiceService({root=ROOT}={}) {const file=path.join(local(root),'service.json'),state=readJSON(file,{});if(state.instance===voiceInstance(root))endTree(state.pid);fs.rmSync(file,{force:true});}
