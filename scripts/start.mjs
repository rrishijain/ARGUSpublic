import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {ROOT,atomicJSON,readJSON} from '../runtime/config.mjs';

const sessionFile=path.join(ROOT,'.argus-local/session.json'),previous=readJSON(sessionFile),dev=process.argv.includes('--dev');
if(previous){try{const r=await fetch(`http://127.0.0.1:${previous.port}/health`,{headers:{Authorization:'Bearer '+previous.token},signal:AbortSignal.timeout(1000)});if(r.ok){console.log('ARGUS is already running at http://127.0.0.1:3117');process.exit(0);}}catch{}}
await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(new Error('Port 3117 is in use. Stop the other service first.')));probe.listen(3117,'127.0.0.1',()=>probe.close(resolve));}).catch(e=>{console.error(e.message);process.exit(1);});
if(!dev&&!fs.existsSync(path.join(ROOT,'.next/BUILD_ID'))){console.log('Building ARGUS for this computer…');const r=spawnSync(process.execPath,[path.join(ROOT,'node_modules/next/dist/bin/next'),'build'],{cwd:ROOT,stdio:'inherit'});if(r.status!==0)process.exit(1);}
const children=[],token=crypto.randomUUID();let stopping=false;
const stop=()=>{if(stopping)return;stopping=true;for(const child of children){if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true});else child.kill('SIGTERM');}server.close();fs.rmSync(sessionFile,{force:true});setTimeout(()=>process.exit(0),1500);};
const server=http.createServer((req,res)=>{if(req.headers.authorization!=='Bearer '+token){res.writeHead(403);res.end();return;}if(req.method==='POST'&&req.url==='/stop'){res.end('Stopping ARGUS');setTimeout(stop,50);}else if(req.url==='/health'){res.end('ARGUS');}else{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));atomicJSON(sessionFile,{port:server.address().port,token,pid:process.pid});
function launch(command,args){const p=spawn(command,args,{cwd:ROOT,stdio:'inherit',windowsHide:true});children.push(p);p.on('error',e=>{console.error(`Service failed to start: ${e.message}`);stop();});p.on('exit',code=>{if(!stopping){console.error(`A service stopped (${code}). Run npm run doctor.`);stop();}});return p;}
launch(process.execPath,[path.join(ROOT,'node_modules/next/dist/bin/next'),dev?'dev':'start','-H','127.0.0.1','-p','3117']);
launch(process.execPath,['runner/runner.mjs']);
const python=path.join(ROOT,'voice-server/.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
if(fs.existsSync(python)&&fs.existsSync(path.join(ROOT,'voice-server/models/kokoro-v1.0.onnx'))) {
  // Voice is optional: its failure must not close the console.
  const p=spawn(python,['voice-server/server.py'],{cwd:ROOT,stdio:'inherit',windowsHide:true});children.push(p);p.on('error',()=>console.log('Local voice unavailable; system speech remains available.'));p.on('exit',()=>{if(!stopping)console.log('Local voice stopped; system speech remains available.');});
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);console.log('ARGUS → http://127.0.0.1:3117 · Keep this terminal open. Stop with Ctrl+C or npm run stop.');
