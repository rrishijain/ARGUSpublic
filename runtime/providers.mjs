import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function resolveCLI(provider) {
  if(!['claude','codex'].includes(provider))return null;
  const extensions=process.platform==='win32'?['.exe','.cmd','']:[''];
  for(const dir of (process.env.PATH||'').split(path.delimiter))for(const ext of extensions){const file=path.join(dir,provider+ext);try{fs.accessSync(file,process.platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);return file;}catch{}}
  return null;
}
let cached=null,until=0;
export function providers() {
  if(cached&&Date.now()<until)return cached;
  cached=Object.fromEntries(['claude','codex'].map(p=>[p,{installed:Boolean(resolveCLI(p)),authentication:'Checked when a task runs'}]));until=Date.now()+30000;return cached;
}
export function invocation(provider) {
  if(provider==='claude')return ['-p','--output-format','json','--tools','','--permission-mode','dontAsk','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','project'];
  if(provider==='codex')return ['exec','--sandbox','read-only','--ignore-user-config','--ephemeral','--skip-git-repo-check','--json','-c','features.shell_tool=false','-c','web_search="disabled"','-'];
  throw new Error('Choose Claude or Codex in setup.');
}
export function readableFailure(text) {
  if(/auth|login|sign.?in|401|credential/i.test(text))return 'Sign in to the selected CLI on this computer, then retry.';
  if(/quota|rate.limit|usage.limit|429|credit|billing/i.test(text))return 'Your AI account has reached a usage or billing limit. Check the provider before retrying.';
  if(/unknown.*(argument|option)|unrecognized.*(argument|option)/i.test(text))return 'Your CLI version does not support the required options. Update it and run npm run doctor.';
  return 'The AI provider could not finish this task. Run its CLI directly to check connectivity and access, then retry.';
}
export function parseOutput(provider,output) {
  if(provider==='claude') {const r=JSON.parse(output);if(r.is_error)throw new Error(readableFailure(r.result||''));return r.result;}
  const events=output.split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean);
  const errors=events.filter(e=>e.type==='turn.failed'||e.type==='error');if(errors.length)throw new Error(readableFailure(JSON.stringify(errors)));
  return events.filter(e=>e.type==='item.completed'&&e.item?.type==='agent_message').map(e=>e.item.text).join('\n\n');
}
export function runProvider(provider,prompt,cwd,{timeoutMs=180000,signal,bin=resolveCLI(provider)}={}) {
  if(!bin)return Promise.reject(new Error(`Install and sign in to ${provider||'Claude or Codex'}, then select it in setup.`));
  return new Promise((resolve,reject)=>{
    const args=invocation(provider);let stdout='',stderr='',finished=false;
    // Prompts only travel on stdin, never through a shell or command arguments.
    // Windows npm .cmd shims need cmd.exe; only fixed adapter arguments enter it.
    let command=bin,argv=args;
    if(process.platform==='win32'&&bin.endsWith('.cmd')) {
      if(/[\r\n%"!]/.test(bin))return reject(new Error('Unsupported CLI installation path.'));
      command=process.env.ComSpec||'cmd.exe';argv=['/d','/s','/c',`""${bin}" ${args.map(a=>'"'+a.replace(/"/g,'""')+'"').join(' ')}"`];
    }
    const child=spawn(command,argv,{cwd,stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false});
    const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
    const terminate=()=>{if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true});else child.kill('SIGKILL');};
    const abort=()=>{terminate();finish(new Error('Task cancelled.'));};
    const timer=setTimeout(()=>{terminate();finish(new Error('Task timed out after three minutes. Try fewer sources or a narrower question.'));},timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>2000000){terminate();finish(new Error('AI response exceeded the output limit.'));}});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-12000);});
    child.on('error',()=>finish(new Error('The selected CLI could not start. Run npm run doctor.')));
    child.on('close',code=>{if(finished)return;if(code!==0)return finish(new Error(readableFailure(stderr+' '+stdout)));try {const text=parseOutput(provider,stdout);if(typeof text!=='string'||!text.trim())throw new Error('The provider returned no usable answer.');finish(null,text);}catch(e){finish(e);}});
    child.stdin.on('error',()=>{});child.stdin.end(prompt);
  });
}
