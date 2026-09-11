// Integration check with synthesised test speech only. Never records a participant.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {ROOT} from '../runtime/config.mjs';
import {voiceInstance} from '../runtime/voice-install.mjs';

const directory=path.join(ROOT,'.argus-local','voice-browser-check');fs.mkdirSync(directory,{recursive:true});
const instance=voiceInstance();
const audio=await fetch('http://127.0.0.1:3118/speak',{method:'POST',headers:{'Content-Type':'application/json','x-argus-instance':instance},body:JSON.stringify({text:'Please show my business sales.',voice:'af_heart',speed:1})});
if(!audio.ok)throw new Error('Start this checkout’s verified voice service before this integration check.');
const wav=Buffer.from(await audio.arrayBuffer());let dataStart=0,dataLength=0,sampleRate=24000;
for(let offset=12;offset+8<=wav.length;){const size=wav.readUInt32LE(offset+4),tag=wav.toString('ascii',offset,offset+4);if(tag==='fmt ')sampleRate=wav.readUInt32LE(offset+12);if(tag==='data'){dataStart=offset+8;dataLength=size;break;}offset+=8+size+(size%2);}
if(!dataStart)throw new Error('Unexpected fixture audio format.');
const fixture=Buffer.concat([wav.subarray(0,dataStart),Buffer.alloc(sampleRate*2*2),wav.subarray(dataStart,dataStart+dataLength),Buffer.alloc(sampleRate*2*3)]);
fixture.writeUInt32LE(fixture.length-8,4);fixture.writeUInt32LE(fixture.length-dataStart,dataStart-4);fs.writeFileSync(path.join(directory,'fixture.wav'),fixture);
await build({stdin:{contents:`import {VoiceConversation} from './lib/conversation-audio';import {voice} from './lib/voice';window.results={states:[],turns:[],notices:[],tracks:[]};const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await original(...args);window.results.tracks.push(...stream.getTracks());return stream;};voice.settings.engine='kokoro';voice.init();window.controller=new VoiceConversation({onState:state=>window.results.states.push({state,time:performance.now(),liveTracks:window.results.tracks.filter(t=>t.readyState==='live').length}),onNotice:notice=>window.results.notices.push(notice),onTranscript:async text=>{window.results.turns.push(text);if(window.results.turns.length>=2){window.controller.stop();return;}await window.controller.speakReply('Your sales overview is ready.');}});document.querySelector('button').onclick=()=>window.controller.start();`,resolveDir:ROOT},bundle:true,format:'esm',platform:'browser',outfile:path.join(directory,'harness.js'),logLevel:'silent'});
const server=http.createServer(async(req,res)=>{
  try{
    if(req.url.startsWith('/api/voice/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const target=req.url.replace('/api/voice','');const upstream=await fetch('http://127.0.0.1:3118'+target,{method:req.method,headers:{'Content-Type':req.headers['content-type']||'application/json','x-argus-instance':instance},...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/json'});res.end(Buffer.from(await upstream.arrayBuffer()));return;}
    if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><button>Start test conversation</button><script type="module" src="/harness.js"></script>');return;}
    const name=path.basename(req.url),file=req.url.startsWith('/voice-assets/')?path.join(ROOT,'public/voice-assets',name):path.join(directory,name);
    res.setHeader('Content-Type',name.endsWith('.wasm')?'application/wasm':name.endsWith('.onnx')?'application/octet-stream':'text/javascript');res.end(fs.readFileSync(file));
  }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const installedChrome=process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':null;
const browser=await chromium.launch({headless:true,...(installedChrome&&fs.existsSync(installedChrome)?{executablePath:installedChrome}:{}),args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${path.join(directory,'fixture.wav')}`,'--autoplay-policy=no-user-gesture-required']});
try{
  const context=await browser.newContext({permissions:['microphone']});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button').click();
  await page.waitForFunction(()=>window.results?.turns.length>=2,{},{timeout:90000});
  const result=await page.evaluate(()=>({states:window.results.states,turns:window.results.turns,notices:window.results.notices,tracks:window.results.tracks.map(track=>track.readyState),state:window.controller.state}));
  if(errors.length)throw new Error(errors.join('\n'));
  if(result.turns.some(text=>!text.toLowerCase().includes('sales')))throw new Error('Synthesised sales fixture was not understood.');
  if(result.state!=='idle'||result.tracks.some(track=>track!=='ended'))throw new Error('Conversation leaked microphone tracks.');
  const speaking=result.states.find(entry=>entry.state==='speaking');if(!speaking||speaking.liveTracks!==0)throw new Error('Microphone remained live during reply playback.');
  const next=result.states.find(entry=>entry.state==='listening'&&entry.time>speaking.time);if(!next||next.time-speaking.time<500)throw new Error('Listening resumed before reply playback completed.');
  console.log(JSON.stringify({ok:true,...result},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
