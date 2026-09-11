import fs from 'node:fs';
import path from 'node:path';
import {loadConfig,workspace,atomicJSON,readJSON} from '../runtime/config.mjs';
import {jobsFor,executeJob,jobFile,cancelJob,nextQueuedJob} from '../runtime/jobs.mjs';
import {conversationQueue,recoverConversationJob,cancelConversation} from '../runtime/conversations.mjs';

const root=process.cwd(),lock=path.join(root,'.argus-local/runner.lock');fs.mkdirSync(path.dirname(lock),{recursive:true});
try {fs.writeFileSync(lock,String(process.pid),{flag:'wx'});} catch {
  const pid=Number(fs.readFileSync(lock,'utf8'));let alive=false;try{process.kill(pid,0);alive=true;}catch{}
  if(alive){console.log('ARGUS runner is already running.');process.exit(0);}fs.unlinkSync(lock);fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
}
let stopping=false,busy=false,currentJob=null;
const beat=()=>atomicJSON(path.join(workspace(loadConfig()),'system/runner.json'),{ts:new Date().toISOString(),pid:process.pid,busy});
const interval=setInterval(beat,4000);beat();
for(const dir of [workspace(loadConfig()),conversationQueue(root)])for(const j of jobsFor(dir))if(j.status==='running'){atomicJSON(jobFile(dir,j.id),{...j,status:'failed',error:'Runner restarted during this task. Review before retrying.',finishedAt:new Date().toISOString()});if(j.workflow==='conversation')recoverConversationJob(j,loadConfig(),root);}
const stop=()=>{stopping=true;if(currentJob){if(currentJob.job.workflow==='conversation')cancelConversation(currentJob.job.sessionId,loadConfig(),root);else cancelJob(currentJob.dir,currentJob.job.id);}};process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log('ARGUS runner ready.');
try {while(!stopping){const next=nextQueuedJob([conversationQueue(root),workspace(loadConfig())]);if(next){currentJob=next;busy=true;beat();await executeJob(next.dir,loadConfig(),next.job,undefined,{root});currentJob=null;busy=false;beat();}else await new Promise(r=>setTimeout(r,700));}}
finally{clearInterval(interval);fs.rmSync(lock,{force:true});atomicJSON(path.join(workspace(loadConfig()),'system/runner.json'),{ts:null,pid:null,busy:false});}
