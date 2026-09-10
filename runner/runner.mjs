import fs from 'node:fs';
import path from 'node:path';
import {loadConfig,workspace,atomicJSON,readJSON} from '../runtime/config.mjs';
import {jobsFor,executeJob,jobFile,cancelJob} from '../runtime/jobs.mjs';

const c=loadConfig(),dir=workspace(c),lock=path.join(dir,'system/runner.lock');fs.mkdirSync(path.dirname(lock),{recursive:true});
try {fs.writeFileSync(lock,String(process.pid),{flag:'wx'});} catch {
  const pid=Number(fs.readFileSync(lock,'utf8'));let alive=false;try{process.kill(pid,0);alive=true;}catch{}
  if(alive){console.log('ARGUS runner is already running.');process.exit(0);}fs.unlinkSync(lock);fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
}
let stopping=false,busy=false,currentJob=null;
const beat=()=>atomicJSON(path.join(dir,'system/runner.json'),{ts:new Date().toISOString(),pid:process.pid,busy});
const interval=setInterval(beat,4000);beat();
for(const j of jobsFor(dir))if(j.status==='running')atomicJSON(jobFile(dir,j.id),{...j,status:'failed',error:'Runner restarted during this task. Review before retrying.',finishedAt:new Date().toISOString()});
const stop=()=>{stopping=true;if(currentJob)cancelJob(dir,currentJob);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log('ARGUS runner ready.');
try {while(!stopping){const next=jobsFor(dir).filter(j=>j.status==='queued').at(-1);if(next){currentJob=next.id;busy=true;beat();await executeJob(dir,loadConfig(),next);currentJob=null;busy=false;beat();}else await new Promise(r=>setTimeout(r,700));}}
finally{clearInterval(interval);fs.rmSync(lock,{force:true});atomicJSON(path.join(dir,'system/runner.json'),{ts:null,pid:null,busy:false});}
