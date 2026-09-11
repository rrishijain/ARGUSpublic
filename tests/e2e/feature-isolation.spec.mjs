import {test,expect} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {build} from 'esbuild';
import nextConfig from '../../next.config.mjs';
import {defaults,saveConfig,loadConfig,workspace,readJSON} from '../../runtime/config.mjs';
import {enqueue,jobsFor} from '../../runtime/jobs.mjs';
import {executeFeatureBuild,featurePreview,featureCapability,activateFeature} from '../../runtime/features.mjs';

const formSource=`import React,{useState,useEffect} from 'react';import {argus} from '@argus/sdk';
export default function Feature(){const [rows,setRows]=useState([]),[name,setName]=useState(''),[error,setError]=useState('');const refresh=async()=>setRows((await argus.records.list()).rows);useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);return <section><h1>Lead tracker</h1><form onSubmit={async e=>{e.preventDefault();try{await argus.records.create({name});setName('');setError('');await refresh()}catch(e){setError(e.message)}}}><label>Lead name<input value={name} onChange={e=>setName(e.target.value)}/></label><button>Save lead</button></form>{error&&<p role="alert">{error}</p>}<p>{rows.length} records</p><ul>{rows.map(row=><li key={row.id}>{row.name}</li>)}</ul></section>}`;

async function harness({mode='preview',source=formSource}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'argus-frame-e2e-')),c=saveConfig({...defaults(),provider:'codex',onboarded:true},root),dir=workspace(c,root);
  const j=enqueue(dir,'build','Create the controlled browser fixture',{featureId:crypto.randomUUID(),sourceIds:[]});
  await executeFeatureBuild(dir,c,j,async()=>JSON.stringify({manifest:{name:'Lead tracker',description:'A controlled test fixture',kind:'workspace',capabilities:['records.read','records.write'],sourceIds:[],schema:{name:{label:'Name',type:'string',required:true}}},source,css:'',demoRecords:[{name:'Example lead'}]}),{root});
  const done=jobsFor(dir).find(job=>job.id===j.id);if(done.status!=='completed')throw new Error(done.error);
  if(mode==='active')activateFeature(dir,c,done.featureId,done.versionId,root);
  const preview=featurePreview(dir,loadConfig(root),done.versionId,mode,root);
  const host=(await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import FeatureFrame from './components/FeatureFrame';createRoot(document.getElementById('root')).render(React.createElement(FeatureFrame,{preview:${JSON.stringify(preview)}}));`,sourcefile:'harness.tsx',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})).outputFiles[0].text;
  const csp=(await nextConfig.headers()).flatMap(rule=>rule.headers).find(h=>h.key.toLowerCase()==='content-security-policy')?.value;
  if(!csp?.includes("frame-src 'none'"))throw new Error('The host response must deny URL frame navigation.');
  const server=http.createServer(async(req,res)=>{
    try{
      if(req.url==='/api/features/capability'){
        const chunks=[];for await(const chunk of req)chunks.push(chunk);const input=JSON.parse(Buffer.concat(chunks).toString());const data=featureCapability(dir,loadConfig(root),input,root);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
      }
      res.setHeader('Content-Type','text/html');res.setHeader('Content-Security-Policy',csp);
      res.end(`<!doctype html><html><body><div id="root"></div><output id="attempted"></output><script>window.addEventListener('message',e=>{if(e.data==='fixture attempted')document.getElementById('attempted').textContent='attempted'});${host.replace(/<\/script/gi,'<\\/script')}</script></body></html>`);
    }catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error.message}));}
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,root,dir,id:done.featureId,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}};
}

test('preview forms edit disposable samples and never production records',async({page})=>{
  const f=await harness();try{
    await page.goto(f.url);const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'Lead tracker'})).toBeVisible();await expect(frame.getByText('1 records')).toBeVisible();
    await frame.getByLabel('Lead name').fill('Try the form');await frame.getByRole('button',{name:'Save lead'}).click();await expect(frame.getByText('2 records')).toBeVisible();await expect(frame.getByText('Try the form',{exact:true})).toBeVisible();
    expect(fs.existsSync(path.join(f.dir,'features/data',f.id+'.json'))).toBe(false);await expect(page.getByText(/disposable example records/)).toBeVisible();
  }finally{await page.goto('about:blank');await f.close();}
});

test('active forms use one session permission, save normally and preserve data',async({page})=>{
  const f=await harness({mode:'active'});try{
    await page.goto(f.url);const frame=page.frameLocator('iframe');await expect(frame.getByText('0 records')).toBeVisible();await frame.getByLabel('Lead name').fill('Real local record');await frame.getByRole('button',{name:'Save lead'}).click();await expect(frame.getByRole('alert')).toContainText('Allow local changes');
    expect(fs.existsSync(path.join(f.dir,'features/data',f.id+'.json'))).toBe(false);await page.getByLabel('Allow local changes during this session').check();await frame.getByRole('button',{name:'Save lead'}).click();await expect(frame.getByText('1 records')).toBeVisible();
    await frame.getByLabel('Lead name').fill('Second local record');await frame.getByRole('button',{name:'Save lead'}).click();await expect(frame.getByText('2 records')).toBeVisible();expect(readJSON(path.join(f.dir,'features/data',f.id+'.json')).length).toBe(2);await expect(page.getByRole('button',{name:'Confirm',exact:true})).toHaveCount(0);
    await page.reload();await expect(page.getByLabel('Allow local changes during this session')).not.toBeChecked();await expect(page.frameLocator('iframe').getByText('2 records')).toBeVisible();
  }finally{await page.goto('about:blank');await f.close();}
});

test('host frame policy blocks generated self-navigation as well as resource requests',async({page})=>{
  let hits=0;const receiver=http.createServer((_req,res)=>{hits++;res.end('fictional receiver');});await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));const target=`http://127.0.0.1:${receiver.address().port}/fictional-data`;
  const source=`import React,{useEffect} from 'react';export default function Feature(){useEffect(()=>{parent.postMessage('fixture attempted','*');fetch(${JSON.stringify(target)}).catch(()=>{});new Image().src=${JSON.stringify(target)};setTimeout(()=>location.assign(${JSON.stringify(target)}),10)},[]);return <p>Controlled navigation probe</p>}`;
  const f=await harness({source});try{
    await page.goto(f.url);await expect(page.locator('#attempted')).toHaveText('attempted');await page.waitForTimeout(300);expect(hits).toBe(0);expect(page.url()).toBe(f.url+'/');
  }finally{await page.goto('about:blank');await f.close();receiver.closeAllConnections();await new Promise(resolve=>receiver.close(resolve));}
});

test('builder preserves selected sources on keyboard revision and retry, and reopens restored versions',async({page})=>{
  const id=crypto.randomUUID(),sourceId=crypto.randomUUID(),v1=crypto.randomUUID(),v2=crypto.randomUUID(),requests=[];
  const sources=[{id:sourceId,name:'Chosen sales CSV',status:'ready',capturedAt:new Date().toISOString(),columns:['name'],rowCount:1,stale:false}];
  const feature={id,name:'Sales tracker',description:'A chosen-source tracker',kind:'workspace',sourceIds:[sourceId],activeVersion:v2,versions:[{id:v2,createdAt:'2026-09-11T12:00:00Z'},{id:v1,createdAt:'2026-09-10T12:00:00Z'}]};
  const failed={id:crypto.randomUUID(),workflow:'build',featureId:id,sourceIds:[sourceId],question:'Add a useful deadline view',status:'failed',error:'A controlled failure',createdAt:'2026-09-11T13:00:00Z'};
  await page.route('**/api/features**',async route=>{
    const request=route.request(),url=new URL(request.url());let result={};
    if(url.pathname==='/api/features')result={features:[feature],builds:[failed]};
    if(url.pathname==='/api/features/build'){requests.push(request.postDataJSON());result={id:'retry-job',status:'queued'};}
    if(url.pathname==='/api/features/rollback'){const data=request.postDataJSON();feature.activeVersion=data.versionId;result={ok:true,id,activeVersion:data.versionId};}
    if(url.pathname==='/api/features/preview')result={id,versionId:url.searchParams.get('id'),name:'Sales tracker',description:'A chosen-source tracker',kind:'workspace',sourceIds:[sourceId],recordLabels:{},mode:url.searchParams.get('mode')||'preview',token:'fixture',channel:crypto.randomUUID(),permissions:[],html:`<p>Displayed version ${url.searchParams.get('id')}</p>`};
    await route.fulfill({json:result});
  });
  const script=(await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import BuildDesk from './components/BuildDesk';createRoot(document.getElementById('root')).render(React.createElement(BuildDesk,{sources:${JSON.stringify(sources)},onUpdated:()=>{},onNotice:()=>{}}));`,sourcefile:'desk.tsx',resolveDir:process.cwd(),loader:'tsx'},tsconfig:path.join(process.cwd(),'tsconfig.json'),bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})).outputFiles[0].text;
  const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.setHeader('Content-Security-Policy',"frame-src 'none'; object-src 'none'; base-uri 'self'");res.end(`<body><div id="root"></div><script>${script.replace(/<\/script/gi,'<\\/script')}</script></body>`);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}`);const improve=page.getByRole('button',{name:'Improve',exact:true});await improve.focus();await page.keyboard.press('Enter');await expect(page.getByLabel('Describe your changes')).toBeFocused();await page.getByText('Choose information this feature can use').click();await expect(page.getByRole('checkbox',{name:'Chosen sales CSV'})).toBeChecked();
    await page.getByRole('button',{name:'Review & retry'}).click();await expect(page.getByLabel('Describe your changes')).toHaveValue(failed.question);await expect(page.getByRole('checkbox',{name:'Chosen sales CSV'})).toBeChecked();await page.getByRole('button',{name:'Build a new version'}).click();await expect.poll(()=>requests.length).toBe(1);expect(requests[0]).toEqual({prompt:failed.question,featureId:id,sourceIds:[sourceId]});
    await page.getByRole('checkbox',{name:'Chosen sales CSV'}).uncheck();await page.getByRole('button',{name:'Open ↗',exact:true}).click();await expect(page.frameLocator('iframe').getByText(`Displayed version ${v2}`)).toBeVisible();await expect(page.getByRole('checkbox',{name:'Chosen sales CSV'})).toBeChecked();
    await page.getByText('Versions',{exact:true}).click();await page.getByRole('button',{name:'Restore',exact:true}).click();await expect(page.frameLocator('iframe').getByText(`Displayed version ${v1}`)).toBeVisible();await expect(page.getByText('ACTIVE FEATURE',{exact:true})).toBeVisible();
  }finally{await page.goto('about:blank');server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
