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
if(process.argv.includes('--production')){await checkProductionUI();process.exit(0);}
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

async function checkProductionUI(){
  const base='http://127.0.0.1:3117',state=await fetch(base+'/api/state').then(response=>response.json());
  state.config={...state.config,onboarded:false,provider:'codex',voice:{...state.config.voice,engine:'kokoro',muted:false,speed:1}};
  const installedChrome=process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':null;
  const browser=await chromium.launch({headless:true,...(installedChrome&&fs.existsSync(installedChrome)?{executablePath:installedChrome}:{}),args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${path.join(directory,'fixture.wav')}`,'--autoplay-policy=no-user-gesture-required']});
  let turns=[],cancelled=0;
  const prepare=async(context,deny=false)=>{
    await context.addInitScript(({deny})=>{
      window.__voiceCheck={tracks:[],media:[],states:[]};
      const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia=async(...args)=>{if(deny)throw new DOMException('Microphone permission denied.','NotAllowedError');const stream=await original(...args);window.__voiceCheck.tracks.push(...stream.getTracks());return stream;};
      const OriginalAudio=window.Audio;window.Audio=function(...args){const audio=new OriginalAudio(...args);for(const event of ['play','ended','pause','error'])audio.addEventListener(event,()=>window.__voiceCheck.media.push({event,time:performance.now(),liveTracks:window.__voiceCheck.tracks.filter(track=>track.readyState==='live').length}));return audio;};
      const observer=new MutationObserver(()=>{const state=document.querySelector('.conversation-state')?.textContent;const previous=window.__voiceCheck.states.at(-1);if(state&&previous?.state!==state)window.__voiceCheck.states.push({state,time:performance.now()});});observer.observe(document,{childList:true,subtree:true,characterData:true});
    },{deny});
    await context.route('**/api/state',route=>route.fulfill({json:state}));
    let session={id:'10000000-0000-4000-8000-000000000001',kind:'onboarding',status:'idle',revision:0,pendingJobId:null,turns:[{id:'welcome',role:'assistant',text:'Welcome. Tell me about your business.',spokenText:'Welcome. Tell me about your business.',createdAt:new Date().toISOString()}]};
    await context.route(/\/api\/conversation(?:\/[^?]*)?(?:\?.*)?$/,async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.pathname==='/api/conversation/turn'){
        const input=req.postDataJSON();turns.push(input.text);const index=turns.length;
        session={...session,revision:session.revision+2,turns:[...session.turns,{id:'user-'+index,role:'user',text:input.text,createdAt:new Date().toISOString()},{id:'assistant-'+index,role:'assistant',text:index===1?'Your first sales overview is ready.':'Your second sales overview is ready. We can review your leads and decide what deserves your attention next.',spokenText:index===1?'Your first sales overview is ready.':'Your second sales overview is ready. We can review your leads and decide what deserves your attention next.',actions:[],createdAt:new Date().toISOString()}]};
      }else if(url.pathname==='/api/conversation/cancel'){cancelled++;session={...session,revision:session.revision+1,status:'idle',pendingJobId:null};}
      await route.fulfill({json:{session}});
    });
    return context.newPage();
  };
  const errors=[];let inspectedPage;
  try{
    const context=await browser.newContext({permissions:['microphone']});const page=await prepare(context);inspectedPage=page;page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.url().includes('/api/voice/')&&!response.url().endsWith('/health'))console.log(JSON.stringify({voiceResponse:response.url(),status:response.status()}));});
    await page.goto(base);await page.getByRole('button',{name:'Start talking'}).click({timeout:15000});
    await page.waitForFunction(()=>window.__voiceCheck.media.some(event=>event.event==='ended'),{},{timeout:30000});
    const deadline=Date.now()+90000;while(turns.length<2&&Date.now()<deadline)await page.waitForTimeout(300);
    if(turns.length<2)throw new Error('Production UI did not submit two spoken turns.');
    await page.waitForFunction(()=>window.__voiceCheck.media.filter(event=>event.event==='play').length>=3,{},{timeout:20000});
    const interruptedAt=Date.now();await page.getByRole('button',{name:'Interrupt & speak'}).click();
    await page.waitForFunction(()=>document.querySelector('.conversation-state')?.textContent==='listening',{},{timeout:5000});
    const interruptMs=Date.now()-interruptedAt;await page.getByRole('button',{name:'End voice',exact:true}).click();
    await page.waitForFunction(()=>window.__voiceCheck.tracks.every(track=>track.readyState==='ended'));
    const result=await page.evaluate(()=>({media:window.__voiceCheck.media,states:window.__voiceCheck.states,tracks:window.__voiceCheck.tracks.map(track=>track.readyState),finalState:document.querySelector('.conversation-state')?.textContent}));
    if(errors.length)throw new Error(errors.join('\n'));
    if(turns.slice(0,2).some(text=>!text.toLowerCase().includes('sales')))throw new Error('Production transcription failed the sales fixture.');
    if(result.media.some(event=>event.event==='play'&&event.liveTracks!==0))throw new Error('Microphone was live during production reply playback.');
    await context.close();
    const denied=await browser.newContext(),deniedPage=await prepare(denied,true);deniedPage.on('pageerror',error=>errors.push(error.message));await deniedPage.goto(base);await deniedPage.getByRole('button',{name:'Start talking'}).click({timeout:15000});
    await deniedPage.getByRole('status').filter({hasText:'Microphone permission denied.'}).waitFor({timeout:15000});
    const denial=await deniedPage.evaluate(()=>({tracks:window.__voiceCheck.tracks.length,inputEnabled:!document.querySelector('#conversation-input').disabled,startVisible:Array.from(document.querySelectorAll('button')).some(button=>button.textContent.includes('Start talking'))}));
    if(denial.tracks||!denial.inputEnabled||!denial.startVisible)throw new Error('Denied microphone did not preserve typed operation.');
    if(errors.length)throw new Error(errors.join('\n'));
    console.log(JSON.stringify({ok:true,productionUI:true,turns,interruptMs,cancelled,denial,...result},null,2));
  }catch(error){const details=inspectedPage&&!inspectedPage.isClosed()?await inspectedPage.evaluate(()=>({body:document.body.innerText.slice(-4000),states:window.__voiceCheck.states,media:window.__voiceCheck.media,tracks:window.__voiceCheck.tracks.map(track=>track.readyState)})).catch(()=>null):null;console.error(JSON.stringify({productionUI:true,turns,errors,error:error.message,details}));throw error;}
  finally{await browser.close();}
}
