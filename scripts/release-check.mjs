import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from '../runtime/config.mjs';
const r=spawnSync('git',['ls-files','-z'],{cwd:ROOT,encoding:'utf8'});
if(r.status!==0||!r.stdout){console.error('Stage the reviewed public distribution in a fresh Git repository before checking it.');process.exit(1);}
const files=r.stdout.split('\0').filter(Boolean),errors=[];
const forbidden=/(^|\/)(\.env(?:\.|$)|\.argus-config\.json|\.argus-onboarding\.json|\.argus-local|workspace|node_modules|\.next|\.venv|__pycache__|models\/|settings\.local\.json)|\.(log|pid|pem|p12|onnx|bin|tsbuildinfo)$/;
const secrets=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{30,}/,/\bsk-(?:proj-|ant-)[A-Za-z0-9_-]{25,}/,/\bAIza[A-Za-z0-9_-]{30,}/,/\bAKIA[A-Z0-9]{16}\b/,/\bre_[A-Za-z0-9_]{25,}/];
const personal=[new RegExp('/Users/'+'rishi'+'jain','i'),new RegExp('rishi'+'@echo'+'vme.com','i'),new RegExp('digital'+'scholar.in','i'),new RegExp('eleven'+'labs|eleven'+'_labs','i')];
for(const name of files){const file=path.join(ROOT,name);if(forbidden.test(name)){errors.push(`${name}: excluded private/runtime file`);continue;}const stat=fs.lstatSync(file);if(stat.isSymbolicLink()){errors.push(`${name}: symlink`);continue;}if(stat.size>5*1024*1024){errors.push(`${name}: oversized release file`);continue;}if(/\.(png|jpg|jpeg|webp|woff2)$/.test(name))continue;const text=fs.readFileSync(file,'utf8');if(secrets.some(re=>re.test(text)))errors.push(`${name}: possible secret`);if(personal.some(re=>re.test(text)))errors.push(`${name}: personal dependency or excluded voice provider`);}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log(`Release check passed: ${files.length} reviewed files; no detected credentials, personal dependencies, env files, symlinks or runtime data.`);
