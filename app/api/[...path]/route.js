import fs from 'node:fs';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {loadConfig,saveConfig,workspace,within,publicConfig} from '../../../runtime/config.mjs';
import {getState,addTask,toggleTask} from '../../../runtime/state.mjs';
import {sourcesFor,importBuffer,importURL,MAX_BYTES} from '../../../runtime/sources.mjs';
import {enqueue,cancelJob,jobsFor} from '../../../runtime/jobs.mjs';
import {routeText} from '../../../runtime/workflows.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
function guard(req) {
  const host=req.headers.get('host');
  if(!['127.0.0.1:3117','localhost:3117'].includes(host))throw new Error('Forbidden host.');
  const origin=req.headers.get('origin');if(origin&&!['http://127.0.0.1:3117','http://localhost:3117'].includes(origin))throw new Error('Forbidden origin.');
  if(req.headers.get('sec-fetch-site')==='cross-site')throw new Error('Forbidden origin.');
}
async function limited(req,max=MAX_BYTES+1024*1024) {
  let size=0;const chunks=[];if(!req.body)return Buffer.alloc(0);const reader=req.body.getReader();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('Request is too large.');}chunks.push(Buffer.from(value));}return Buffer.concat(chunks);
}
async function handle(req,ctx) {
  try {
    guard(req);const action=(await ctx.params).path.join('/'),c=loadConfig(),dir=workspace(c);
    if(req.method==='GET') {
      if(action==='state')return json(getState());
      if(action==='report') {
        const id=new URL(req.url).searchParams.get('id');const job=jobsFor(dir).find(j=>j.id===id&&j.status==='completed');if(!job)return json({error:'Report not found.'},404);
        return json({title:job.workflow,text:fs.readFileSync(within(dir,job.report),'utf8')});
      }
      if(action==='source') {
        const id=new URL(req.url).searchParams.get('id'),s=sourcesFor(dir).find(s=>s.id===id);if(!s)return json({error:'Source not found.'},404);
        return json({title:s.name,text:fs.readFileSync(within(dir,s.text),'utf8')});
      }
      if(action==='voice/health') {try{const r=await fetch('http://127.0.0.1:3118/health',{signal:AbortSignal.timeout(1000)});return json(await r.json());}catch{return json({ok:false,stt:false});}}
    }
    if(req.method==='POST') {
      if(action==='import/file') {
        const b=await limited(req);const clone=new Request(req.url,{method:'POST',headers:{'content-type':req.headers.get('content-type')||''},body:b});const form=await clone.formData();const f=form.get('file');if(!f||typeof f==='string')throw new Error('Choose a file.');
        return json(await importBuffer(dir,Buffer.from(await f.arrayBuffer()),f.name,'upload',f.type));
      }
      if(action==='voice/stt') {
        const b=await limited(req,15*1024*1024);const r=await fetch('http://127.0.0.1:3118/stt',{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||'audio/webm'},body:b,signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error('Local transcription is unavailable. Use typed commands or run npm run voice:setup.');return json(await r.json());
      }
      const data=JSON.parse((await limited(req,30000)).toString('utf8')||'{}');
      if(action==='settings') {const allowed={};for(const k of ['name','title','accent','voice','provider'])if(k in data)allowed[k]=data[k];return json(publicConfig(saveConfig({...c,...allowed})));}
      if(action==='tasks')return json(data.id?toggleTask(dir,data.id,data.done)||{ok:true}:addTask(dir,data.title));
      if(action==='import/url'){if(typeof data.url!=='string'||data.url.length>4000)throw new Error('Enter a public URL.');return json(await importURL(dir,data.url));}
      if(action==='queue') {const state=getState(),id=data.workflow||routeText(data.question||''),w=state.workflows.find(w=>w.id===id);if(!w?.enabled)throw new Error(w?.reason||'Workflow unavailable.');return json(enqueue(dir,id,data.question||''));}
      if(action==='cancel'){cancelJob(dir,data.id);return json({ok:true});}
      if(action==='voice/speak') {
        if(typeof data.text!=='string'||!data.text.trim()||data.text.length>2000)throw new Error('Speech text must be 1–2,000 characters.');
        const selected=data.voice??c.voice.kokoroVoice,speed=data.speed??c.voice.speed;
        if(!['af_heart','am_michael','bf_emma','bm_george'].includes(selected)||!Number.isFinite(speed)||speed<0.5||speed>2)throw new Error('Invalid voice preview settings.');
        const r=await fetch('http://127.0.0.1:3118/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:data.text,voice:selected,speed}),signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error('Local speech is unavailable.');return new Response(r.body,{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store'}});
      }
    }
    return json({error:'Not found.'},404);
  } catch(e) {return json({error:e.message||'Request failed.'},/Forbidden/.test(e.message)?403:400);}
}
export const GET=handle;
export const POST=handle;
