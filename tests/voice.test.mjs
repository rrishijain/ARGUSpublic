import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {verifiedDownload,platformArtifact,readVoiceInstall,cancelVoiceInstall,installationFingerprint} from '../runtime/voice-install.mjs';
import {getState} from '../runtime/state.mjs';

const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'argus-voice-test-'));
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
test('background report state excludes conversational and build jobs even without a kind field',()=>{
  const root=temp(),jobs=path.join(root,'workspace/system/jobs');try{fs.mkdirSync(jobs,{recursive:true});for(const workflow of ['brief','conversation','build']){const id=crypto.randomUUID();fs.writeFileSync(path.join(jobs,id+'.json'),JSON.stringify({id,workflow,status:'completed',createdAt:new Date().toISOString(),summary:'Ready'}));}assert.deepEqual(getState(root).jobs.map(job=>job.workflow),['brief']);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('verified downloads repair corrupt files, retry failures and reuse valid cached artifacts',async()=>{
  const root=temp(),file=path.join(root,'model.bin'),artifact={url:'https://example.com/model.bin',sha256:hash('valid model')};let calls=0;
  try{fs.writeFileSync(file,'broken');await verifiedDownload(artifact,file,{fetchImpl:async()=>{calls++;return calls===1?new Response('oops',{status:503}):new Response('valid model');}});assert.equal(calls,2);assert.equal(fs.readFileSync(file,'utf8'),'valid model');assert.equal(await verifiedDownload(artifact,file,{fetchImpl:()=>{throw new Error('must stay offline');}}),false);assert.equal(fs.existsSync(file+'.partial'),false);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('invalid checksum never replaces previously installed artifact',async()=>{
  const root=temp(),file=path.join(root,'model.bin');try{fs.writeFileSync(file,'old');await assert.rejects(verifiedDownload({url:'https://example.com/model',sha256:hash('expected')},file,{fetchImpl:async()=>new Response('tampered')}),/Checksum mismatch/);assert.equal(fs.readFileSync(file,'utf8'),'old');assert.equal(fs.existsSync(file+'.partial'),false);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('aborted download removes only its partial artifact',async()=>{
  const root=temp(),file=path.join(root,'model.bin'),controller=new AbortController();controller.abort();try{await assert.rejects(verifiedDownload({url:'https://example.com/model',sha256:hash('model')},file,{signal:controller.signal,fetchImpl:()=>{throw new Error('network should not start');}}));assert.equal(fs.existsSync(file),false);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('platform baseline and local paused install status are explicit',()=>{
  assert.match(platformArtifact(process.cwd(),'darwin','x64','22.0').archive,/x86_64-apple/);assert.throws(()=>platformArtifact(process.cwd(),'darwin','arm64','21.0'),/macOS 13/);assert.throws(()=>platformArtifact(process.cwd(),'win32','arm64'),/not packaged/);
  const root=temp();try{assert.equal(readVoiceInstall(root).status,'idle');assert.equal(cancelVoiceInstall({root}).status,'skipped');assert.equal(readVoiceInstall(root).stage,'paused');}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('installation identity changes when checkout moves',()=>{
  const root=temp();try{fs.mkdirSync(path.join(root,'voice-server'));for(const file of ['bootstrap.json','models.json','requirements.lock','server.py'])fs.copyFileSync(path.join('voice-server',file),path.join(root,'voice-server',file));assert.notEqual(installationFingerprint(root),installationFingerprint());}finally{fs.rmSync(root,{recursive:true,force:true});}
});

function audioHarness(){
  let currentVad,resolveSpeech;const notices=[],states=[],turns=[],tracks=[],storage=new Map();let mediaCalls=0;
  const voice={speak:()=>new Promise(resolve=>{resolveSpeech=resolve;}),stop:()=>{resolveSpeech?.();resolveSpeech=null;}};
  const vadModule={MicVAD:{new:async options=>currentVad={options,listening:false,async start(){this.stream=await(this.listening?options.resumeStream(this.stream):options.getStream());this.listening=true;},async pause(){this.listening=false;if(this.stream)await options.pauseStream(this.stream);},async destroy(){await this.pause();}}},utils:{encodeWAV:()=>new ArrayBuffer(44)}};
  const exports={},document={hidden:false,addEventListener(){},removeEventListener(){}},window={addEventListener(){},removeEventListener(){}};
  const context={exports,require:name=>name==='./voice'?{voice}:vadModule,crypto,console,document,window,AbortController,Float32Array,setTimeout,clearTimeout,setInterval,clearInterval,
    navigator:{mediaDevices:{getUserMedia:async()=>{mediaCalls++;const track={stopped:false,stop(){this.stopped=true;}};tracks.push(track);return {getTracks:()=>[track]};}}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    fetch:async url=>url.endsWith('/health')?{json:async()=>({stt:true})}:{ok:true,json:async()=>({text:'Show my sales'})}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/conversation-audio.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const controller=new exports.VoiceConversation({onTranscript:text=>turns.push(text),onState:state=>states.push(state),onNotice:text=>notices.push(text)});
  return {controller,states,turns,tracks,voice,document,get vad(){return currentVad;},get mediaCalls(){return mediaCalls;},finishSpeech:()=>resolveSpeech?.()};
}
test('conversation releases microphone while transcribing/thinking and waits for playback completion',async()=>{
  const h=audioHarness();try{await h.controller.start();assert.equal(h.controller.state,'listening');await h.controller.transcribe(new Float32Array([0.1]));assert.deepEqual(h.turns,['Show my sales']);assert.equal(h.controller.state,'thinking');assert.ok(h.tracks.every(track=>track.stopped));const speaking=h.controller.speakReply('Your sales are ready.');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.controller.state,'speaking');assert.equal(h.mediaCalls,1);h.finishSpeech();await speaking;assert.equal(h.controller.state,'listening');assert.equal(h.mediaCalls,2);}finally{h.controller.stop();}
});
test('interrupt cancels playback and obsolete completion cannot reopen the microphone',async()=>{
  const h=audioHarness();try{await h.controller.start();const pending=h.controller.speakReply('A long answer.');await new Promise(resolve=>setImmediate(resolve));await h.controller.interrupt();await pending;assert.equal(h.controller.state,'listening');assert.equal(h.mediaCalls,2);h.controller.stop();assert.ok(h.tracks.every(track=>track.stopped));h.finishSpeech();await Promise.resolve();assert.equal(h.controller.state,'idle');assert.equal(h.mediaCalls,2);}finally{h.controller.stop();}
});
test('hidden tabs release microphone capture and cannot start it again',async()=>{
  const h=audioHarness();try{await h.controller.start();h.document.hidden=true;h.controller.visibility();assert.equal(h.controller.state,'idle');assert.ok(h.tracks.every(track=>track.stopped));await h.controller.start();assert.equal(h.mediaCalls,1);}finally{h.controller.stop();}
});
test('system speech resolves on completion or stop, never immediately after queuing',async()=>{
  const exports={};let utterance;const storage=new Map();
  const context={exports,require:()=>({}),URL,console,setInterval,clearInterval,window:{speechSynthesis:{cancel(){},getVoices:()=>[],speak:value=>{utterance=value;}},addEventListener(){}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/voice.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const speaker=new exports.Voice();try{let finished=false;const first=speaker.speak('Welcome.').then(()=>{finished=true;});await Promise.resolve();assert.equal(finished,false);utterance.onend();await first;assert.equal(finished,true);finished=false;const second=speaker.speak('Another reply.').then(()=>{finished=true;});speaker.stop();await second;assert.equal(finished,true);}finally{speaker.stop();}
});
test('background report speech is suppressed during a conversation microphone session',async()=>{
  const exports={};let calls=0;const context={exports,require:()=>({}),URL,console,setInterval,clearInterval,window:{speechSynthesis:{cancel(){},getVoices:()=>[],speak(){calls++;}},addEventListener(){}},SpeechSynthesisUtterance:class{},localStorage:{getItem:key=>key==='argus.conversation.microphone'?JSON.stringify({token:'active',time:Date.now()}):null,setItem(){}}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/voice.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  await new exports.Voice().speak('Your background report is ready.',true);assert.equal(calls,0);
});
