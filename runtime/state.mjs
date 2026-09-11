import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadConfig,workspace,publicConfig,readJSON,atomicJSON,ROOT} from './config.mjs';
import {sourcesFor,metricValue} from './sources.mjs';
import {jobsFor} from './jobs.mjs';
import {providers} from './providers.mjs';
import {WORKFLOWS} from './workflows.mjs';
export function getState(root=ROOT) {
  const c=loadConfig(root),dir=workspace(c,root),available=providers(),heartbeat=readJSON(path.join(dir,'system/runner.json'),{});
  const runner={alive:Date.now()-Date.parse(heartbeat.ts||'')<15000,busy:heartbeat.busy||false};
  return {config:publicConfig(c),sources:sourcesFor(dir).map(({id,name,status,capturedAt,columns,rowCount,origin})=>({id,name,status,capturedAt,columns,rowCount,demo:String(origin).startsWith('demo:'),stale:Date.now()-Date.parse(capturedAt)>86400000})),tasks:readJSON(path.join(dir,'system/tasks.json'),[]),notes:readJSON(path.join(dir,'system/notes.json'),[]),jobs:jobsFor(dir).filter(j=>!['conversation','build'].includes(j.workflow)).slice(0,30),metrics:c.metrics.map(m=>({...m,...metricValue(dir,m)})),providers:available,runner,workflows:WORKFLOWS.filter(w=>!w.kind||w.kind==='report').map(({instruction,...w})=>({...w,enabled:Boolean(c.onboarded&&c.provider&&available[c.provider]?.installed&&runner.alive),reason:!c.onboarded?'Complete the interview first.':!c.provider?'Select your AI provider.':!available[c.provider]?.installed?'Install and sign in to the selected CLI.':!runner.alive?'Start the runner with npm start.':null}))};
}
export function addTask(dir,title) {
  if(typeof title!=='string'||!title.trim()||title.length>300)throw new Error('Use a task between 1 and 300 characters.');
  const file=path.join(dir,'system/tasks.json'),tasks=readJSON(file,[]);if(tasks.length>=200)throw new Error('The task list is full.');
  const task={id:crypto.randomUUID(),title:title.trim(),done:false};atomicJSON(file,[...tasks,task]);return task;
}
export function toggleTask(dir,id,done) {
  const file=path.join(dir,'system/tasks.json'),tasks=readJSON(file,[]);if(typeof done!=='boolean'||!tasks.some(t=>t.id===id))throw new Error('Task not found.');atomicJSON(file,tasks.map(t=>t.id===id?{...t,done}:t));
}
