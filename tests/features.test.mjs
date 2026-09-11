import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {defaults,saveConfig,loadConfig,workspace,atomicJSON,readJSON} from '../runtime/config.mjs';
import {importBuffer} from '../runtime/sources.mjs';
import {enqueue,jobsFor,cancelJob,executeJob} from '../runtime/jobs.mjs';
import {createConversation,submitTurn,conversationQueue,executeConversation,getConversation,applyConversationAction} from '../runtime/conversations.mjs';
import {validateFeatureBundle,compileFeature,executeFeatureBuild,featurePreview,featureCapability,activateFeature,queryRows,handleFeatureRequest,featuresFor} from '../runtime/features.mjs';

function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'argus-feature-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const c=saveConfig({...defaults(),onboarded:true,provider:'codex'},root),dir=workspace(c,root);fs.mkdirSync(dir,{recursive:true});return {root,c,dir};}
function bundle(overrides={}){return {manifest:{name:'Lead tracker',description:'Example lead tracker with forms and conversion counts.',kind:'workspace',capabilities:['records.read','records.write'],sourceIds:[],schema:{name:{type:'string',label:'Name',required:true},amount:{type:'number',label:'Amount',required:false}}},source:"import React,{useState} from 'react';import {argus} from '@argus/sdk';export default function Feature(){const [rows,setRows]=useState([]);return <section><h1>Lead tracker</h1><button onClick={async()=>setRows((await argus.records.list()).rows)}>Load</button><p>{rows.length} records</p></section>}",css:'h1{font-size:22px}',demoRecords:[{name:'Demonstration prospect',amount:40}],...overrides};}
async function makeVersion(f,input=bundle(),metadata={}){const j=enqueue(f.dir,'build','Create a useful tracker',{featureId:crypto.randomUUID(),sourceIds:[],...metadata});await executeFeatureBuild(f.dir,f.c,j,async()=>JSON.stringify(input),{root:f.root});const done=jobsFor(f.dir).find(x=>x.id===j.id);assert.equal(done.status,'completed',done.error);return done;}
function call(f,session,method,args={}){return featureCapability(f.dir,loadConfig(f.root),{token:session.token,method,args},f.root);}

test('compiles React TSX and the fixed SDK without permitting additional packages or files',async()=>{
  const b=validateFeatureBundle(bundle());assert.match(await compileFeature(b),/Lead tracker/);
  for(const specifier of ['node:fs','lodash','react-dom/client','../../runtime/config.mjs','https://example.com/evil.js']){
    await assert.rejects(()=>compileFeature({...b,source:`import value from ${JSON.stringify(specifier)};export default function Feature(){return <p>{String(value)}</p>}`}),/Unsupported import/);
  }
  await assert.rejects(()=>compileFeature({...b,source:'export default function Feature( { return <div>'}));
});
test('bundle validation rejects permission escalation, invalid fields and remote styles',()=>{
  const b=bundle();assert.throws(()=>validateFeatureBundle({...b,manifest:{...b.manifest,sourceIds:[crypto.randomUUID()]}}),/unselected source/);
  assert.throws(()=>validateFeatureBundle({...b,manifest:{...b.manifest,capabilities:['shell.execute']}}),/capability/);
  assert.throws(()=>validateFeatureBundle({...b,manifest:{...b.manifest,schema:{constructor:{type:'string',label:'x',required:false}}}}),/schema/);
  assert.throws(()=>validateFeatureBundle({...b,demoRecords:[{name:'x',amount:'$100'}]}),/amount/);
  assert.throws(()=>validateFeatureBundle({...b,css:'@import "https://evil.test/x.css";'}),/external/);
});
test('one repair attempt is allowed and broken or cancelled builds never replace active features',async t=>{
  const f=fixture(t),first=await makeVersion(f);activateFeature(f.dir,f.c,first.featureId,first.versionId,f.root);
  const j=enqueue(f.dir,'build','Repair me',{featureId:first.featureId,sourceIds:[]});let attempts=0;
  await executeFeatureBuild(f.dir,loadConfig(f.root),j,async(_p,prompt)=>{attempts++;if(attempts===1)return 'not json';assert.match(prompt,/previous result failed validation/);return JSON.stringify(bundle());},{root:f.root});assert.equal(attempts,2);assert.equal(jobsFor(f.dir).find(x=>x.id===j.id).status,'completed');assert.equal(loadConfig(f.root).features[0].activeVersion,first.versionId);
  const bad=enqueue(f.dir,'build','Broken source',{featureId:first.featureId,sourceIds:[]});attempts=0;await executeFeatureBuild(f.dir,loadConfig(f.root),bad,async()=>{attempts++;return 'bad';},{root:f.root});assert.equal(attempts,2);assert.equal(jobsFor(f.dir).find(x=>x.id===bad.id).status,'failed');
  const cancelled=enqueue(f.dir,'build','Cancel',{featureId:first.featureId,sourceIds:[]});await executeFeatureBuild(f.dir,f.c,cancelled,async()=>{cancelJob(f.dir,cancelled.id);return JSON.stringify(bundle());},{root:f.root});assert.equal(jobsFor(f.dir).find(x=>x.id===cancelled.id).status,'cancelled');assert.equal(loadConfig(f.root).features[0].activeVersion,first.versionId);
});
test('preview permits disposable sample form edits while rejecting workspace mutations',async t=>{
  const f=fixture(t),b=bundle();b.manifest.capabilities=['records.read','records.write','tasks.read','tasks.write','notes.read','notes.write','reports.run'];const built=await makeVersion(f,b),preview=featurePreview(f.dir,f.c,built.versionId,'preview',f.root);
  assert.equal(call(f,preview,'records.list').demonstration,true);assert.equal(call(f,preview,'records.list').rows[0].name,'Demonstration prospect');
  const added=call(f,preview,'records.create',{values:{name:'Test form submission',amount:12}});call(f,preview,'records.update',{id:added.id,values:{amount:18}});assert.equal(call(f,preview,'records.list').total,2);assert.equal(call(f,preview,'records.list').rows[1].amount,18);
  for(const method of ['tasks.add','tasks.toggle','notes.add','reports.run'])assert.throws(()=>call(f,preview,method),/cannot change your workspace/);
  assert.equal(fs.existsSync(path.join(f.dir,'features/data',built.featureId+'.json')),false);
  const separate=featurePreview(f.dir,f.c,built.versionId,'preview',f.root);assert.equal(call(f,separate,'records.list').total,1);assert.throws(()=>call(f,separate,'records.update',{id:added.id,values:{amount:0}}),/not found/);
  activateFeature(f.dir,f.c,built.featureId,built.versionId,f.root);const active=featurePreview(f.dir,loadConfig(f.root),built.versionId,'active',f.root);assert.equal(call(f,active,'records.list').total,0);
  assert.deepEqual(call(f,preview,'tasks.list').tasks,[]);assert.deepEqual(call(f,preview,'notes.list').notes,[]);
  assert.match(preview.html,/default-src 'none'/);assert.match(preview.html,/connect-src 'none'/);assert.match(preview.html,/form-action 'none'/);assert.doesNotMatch(preview.html,new RegExp(preview.token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
test('activation stores feature records separately, validates updates and rollback preserves later fields',async t=>{
  const f=fixture(t),first=await makeVersion(f);activateFeature(f.dir,f.c,first.featureId,first.versionId,f.root);let active=featurePreview(f.dir,loadConfig(f.root),first.versionId,'active',f.root);
  assert.equal(call(f,active,'records.list').total,0);const record=call(f,active,'records.create',{values:{name:'Real lead',amount:100}});assert.match(record.id,/^[a-f0-9-]+$/);assert.equal(call(f,active,'records.list').rows[0].name,'Real lead');
  assert.throws(()=>call(f,active,'records.create',{values:{name:'x',foreign:'field'}}),/unknown field/);assert.throws(()=>call(f,active,'records.create',{values:{amount:3}}),/required/);
  const next=bundle();next.manifest.schema.status={type:'string',label:'Status',required:false};const second=await makeVersion({...f,c:loadConfig(f.root)},next,{featureId:first.featureId});activateFeature(f.dir,loadConfig(f.root),first.featureId,second.versionId,f.root);
  assert.throws(()=>call(f,active,'records.list'),/no longer active/);active=featurePreview(f.dir,loadConfig(f.root),second.versionId,'active',f.root);call(f,active,'records.update',{id:record.id,values:{status:'qualified'}});
  activateFeature(f.dir,loadConfig(f.root),first.featureId,first.versionId,f.root);active=featurePreview(f.dir,loadConfig(f.root),first.versionId,'active',f.root);assert.equal(call(f,active,'records.list').rows[0].status,'qualified');call(f,active,'records.update',{id:record.id,values:{amount:200}});assert.equal(call(f,active,'records.list').rows[0].status,'qualified');
  const other=await makeVersion({...f,c:loadConfig(f.root)});activateFeature(f.dir,loadConfig(f.root),other.featureId,other.versionId,f.root);const otherSession=featurePreview(f.dir,loadConfig(f.root),other.versionId,'active',f.root);assert.equal(call(f,otherSession,'records.list').total,0);assert.throws(()=>call(f,otherSession,'records.update',{id:record.id,values:{amount:0}}),/not found/);
});
test('schema revisions are additive across all history, including a rollback',async t=>{
  const f=fixture(t),first=await makeVersion(f);activateFeature(f.dir,f.c,first.featureId,first.versionId,f.root);const next=bundle();next.manifest.schema.status={type:'string',label:'Status',required:false};await makeVersion({...f,c:loadConfig(f.root)},next,{featureId:first.featureId});
  const bad=enqueue(f.dir,'build','Remove historical fields',{featureId:first.featureId,sourceIds:[]});await executeFeatureBuild(f.dir,loadConfig(f.root),bad,async()=>JSON.stringify(bundle()),{root:f.root});assert.match(jobsFor(f.dir).find(j=>j.id===bad.id).error,/additive/);
});
test('selected source queries are scoped to signed tokens and return true snapshot metadata',async t=>{
  const f=fixture(t),s=await importBuffer(f.dir,Buffer.from('day,stage,value\n2026-01-01,new,10\n2026-02-01,won,20\n'),'leads.csv'),other=await importBuffer(f.dir,Buffer.from('private\nunknown\n'),'other.csv');
  const b=bundle();b.manifest.capabilities.push('sources.read');b.manifest.sourceIds=[s.id];const built=await makeVersion(f,b,{sourceIds:[s.id]}),preview=featurePreview(f.dir,f.c,built.versionId,'preview',f.root);
  const result=call(f,preview,'sources.query',{sourceId:s.id,query:{filters:[{column:'stage',operator:'eq',value:'won'}],aggregation:'sum',column:'value'}});assert.equal(result.value,20);assert.equal(result.capturedAt,s.capturedAt);assert.equal(result.demonstration,false);
  assert.throws(()=>call(f,preview,'sources.query',{sourceId:other.id}),/not selected/);assert.throws(()=>featureCapability(f.dir,f.c,{token:preview.token.slice(0,-5)+'forged',method:'records.list'},f.root),/Invalid feature session/);
  const second=fixture(t);assert.throws(()=>featureCapability(second.dir,second.c,{token:preview.token,method:'records.list'},f.root),/different workspace/);
  assert.throws(()=>call(f,preview,'notes.list'),/does not have/);assert.throws(()=>call(f,preview,'shell.execute'),/Unsupported/);
});
test('starter-pack sources retain demonstration identity in feature reads and build prompts',async t=>{
  const f=fixture(t),s=await importBuffer(f.dir,Buffer.from('amount\n10\n'),'DEMO - sales.csv','demo:pack:sales'),b=bundle();b.manifest.capabilities.push('sources.read');b.manifest.sourceIds=[s.id];const job=enqueue(f.dir,'build','Preview sales',{featureId:crypto.randomUUID(),sourceIds:[s.id]});
  await executeFeatureBuild(f.dir,f.c,job,async(_p,prompt)=>{assert.match(prompt,/"demonstration":true/);return JSON.stringify(b);},{root:f.root});const done=jobsFor(f.dir).find(j=>j.id===job.id),preview=featurePreview(f.dir,f.c,done.versionId,'preview',f.root);assert.equal(call(f,preview,'sources.query',{sourceId:s.id}).demonstration,true);assert.equal(call(f,preview,'sources.text',{sourceId:s.id}).demonstration,true);
});
test('deterministic calculations filter before aggregation, keep missing data missing and require latest ordering',()=>{
  const rows=[{stage:'won',amount:'10',day:'2026-01-01'},{stage:'new',amount:'20',day:'2026-03-01'},{stage:'won',amount:'30',day:'2026-02-01'}];
  assert.equal(queryRows(rows,{filters:[{column:'stage',operator:'eq',value:'won'}],aggregation:'count'}).value,2);
  assert.equal(queryRows(rows,{aggregation:'average',column:'amount'}).value,20);
  assert.equal(queryRows(rows,{aggregation:'sum',column:'amount',limit:1}).value,60);
  assert.equal(queryRows(rows,{aggregation:'latest',column:'amount',orderBy:{column:'day',direction:'asc'}}).value,'20');
  assert.throws(()=>queryRows(rows,{aggregation:'latest',column:'amount'}),/ordering/);
  assert.equal(queryRows([...rows,{amount:''}],{aggregation:'sum',column:'amount'}).value,null);
  assert.equal(queryRows([],{aggregation:'average',column:'amount'}).value,null);
  assert.throws(()=>queryRows(rows,{limit:501}),/limit/);
});
test('task, note and report capabilities use local APIs and preserve report source scope',async t=>{
  const f=fixture(t),b=bundle();b.manifest.capabilities.push('tasks.read','tasks.write','notes.read','notes.write','reports.run');const built=await makeVersion(f,b);activateFeature(f.dir,f.c,built.featureId,built.versionId,f.root);const session=featurePreview(f.dir,loadConfig(f.root),built.versionId,'active',f.root);
  const task=call(f,session,'tasks.add',{title:'Call customer'});call(f,session,'tasks.toggle',{id:task.id,done:true});assert.equal(call(f,session,'tasks.list').tasks[0].done,true);
  const note=call(f,session,'notes.add',{title:'Customer brief',text:'Selected facts'});assert.match(fs.readFileSync(path.join(f.dir,note.file),'utf8'),/Selected facts/);assert.equal(call(f,session,'notes.list').notes.length,1);
  const report=call(f,session,'reports.run',{workflow:'brief',question:'Summarise'});assert.equal(report.status,'queued');assert.deepEqual(report.sourceIds,[]);assert.equal(report.featureId,built.featureId);
  assert.throws(()=>call(f,session,'reports.run',{workflow:'build',question:'Escape'}),/bundled/);
});
test('API routes enforce IDs, version ownership, immutable artifacts and selected sources',async t=>{
  const f=fixture(t),first=await makeVersion(f),second=await makeVersion(f);const args={config:f.c,root:f.root,url:'http://localhost/api/features'};
  assert.equal((await handleFeatureRequest({...args,action:'features',method:'GET'})).features.length,2);
  await assert.rejects(()=>handleFeatureRequest({...args,action:'features/build',method:'POST',data:{prompt:'Use private data',sourceIds:[crypto.randomUUID()]}}),/available sources/);
  assert.throws(()=>activateFeature(f.dir,f.c,first.featureId,second.versionId,f.root),/does not belong/);
  assert.throws(()=>featurePreview(f.dir,f.c,'../../outside','preview',f.root),/Invalid/);
  const file=path.join(f.dir,'system/features/versions',first.versionId+'.json'),saved=readJSON(file);atomicJSON(file,{...saved,manifest:{...saved.manifest,capabilities:['notes.write']}});assert.throws(()=>featurePreview(f.dir,f.c,first.versionId,'preview',f.root),/artifact changed/);
  assert.equal(featuresFor(f.dir,f.c).length,2);
});
test('explicit retry keeps the feature identity and sources even before a first version exists',async t=>{
  const f=fixture(t),source=await importBuffer(f.dir,Buffer.from('name\nExample\n'),'chosen.csv'),featureId=crypto.randomUUID();const bad=enqueue(f.dir,'build','Retry this tracker',{featureId,sourceIds:[source.id]});await executeFeatureBuild(f.dir,f.c,bad,async()=>'{invalid',{root:f.root});
  const retry=await handleFeatureRequest({action:'features/build',method:'POST',config:f.c,root:f.root,data:{prompt:bad.question,featureId,sourceIds:[source.id]}});assert.notEqual(retry.id,bad.id);assert.equal(retry.featureId,featureId);assert.deepEqual(retry.sourceIds,[source.id]);
});
test('a conversational build proposal reaches a compiled feature through the shared runner',async t=>{
  const f=fixture(t),session=createConversation('conversation',f.c,f.root),submitted=submitTurn(session.id,'Build a lead tracker',crypto.randomUUID(),f.c,f.root);
  await executeConversation(conversationQueue(f.root),f.c,submitted.job,async()=>JSON.stringify({text:'I can build that tracker. Review this proposal.',spokenText:'Your tracker proposal is ready.',answers:{},actions:[{type:'build_feature',title:'Build a lead tracker',prompt:'Build a lead tracker with example records and a form.',sourceIds:[]}]}),{root:f.root});
  const turn=getConversation(session.id,f.c,f.root).turns.at(-1),applied=applyConversationAction(session.id,turn.id,turn.actions[0].id,f.c,f.root);assert.equal(applied.result.workflow,'build');
  await executeJob(f.dir,f.c,applied.result,async()=>JSON.stringify(bundle()),{root:f.root});
  const done=await handleFeatureRequest({action:'features/build',method:'GET',url:new URL(`http://localhost/?id=${applied.result.id}`),config:f.c,root:f.root});assert.equal(done.status,'completed',done.error);assert.equal(done.featureId,turn.actions[0].id);
  const preview=await handleFeatureRequest({action:'features/preview',method:'GET',url:new URL(`http://localhost/?id=${done.versionId}`),config:f.c,root:f.root});assert.match(preview.html,/Lead tracker/);assert.equal(loadConfig(f.root).features.length,0);
});
