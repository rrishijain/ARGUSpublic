import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { parse } from 'csv-parse/sync';
import { load } from 'cheerio';
import { atomicJSON, readJSON, within } from './config.mjs';

export const MAX_BYTES=10*1024*1024;
export const sourcesFor = dir => readJSON(path.join(dir,'system/sources.json'),[]);
export const forbiddenName = name => /(^\.|\.env($|\.)|^(auth|credentials|secrets|settings\.local)\.|\.(pem|key|p12|pfx)$)/i.test(path.basename(name));
export function publicAddress(ip) {
  if(ip.includes(':')) return /^[23][0-9a-f]{3}:/i.test(ip)&&!/^2001:(db8|0|10|20):/i.test(ip)&&!/^2002:/i.test(ip);
  const n=ip.split('.').map(Number); if(n.length!==4||n.some(x=>!Number.isInteger(x)||x<0||x>255)) return false;
  const [a,b]=n; return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0);
}
export async function fetchPublic(input, redirects=0) {
  const u=new URL(input); if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port)) throw new Error('Use a public HTTP or HTTPS page without credentials.');
  const hostname=u.hostname.replace(/^\[|\]$/g,'');
  const addresses=await dns.lookup(hostname,{all:true}); if(!addresses.length||addresses.some(a=>!publicAddress(a.address))) throw new Error('Private and local network URLs are not supported.');
  const addr=addresses[0];
  const result=await new Promise((resolve,reject)=>{
    const req=(u.protocol==='https:'?https:http).get(u,{headers:{'User-Agent':'ARGUS-Student/1.0','Accept':'text/html,text/plain,application/pdf'},lookup:(_h,options,cb)=>options.all?cb(null,[addr]):cb(null,addr.address,addr.family)},res=>{
      const chunks=[];let bytes=0;
      res.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX_BYTES){res.destroy();reject(new Error('Page exceeds the 10 MB limit.'));}else chunks.push(chunk);});
      res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,buffer:Buffer.concat(chunks)}));
    });req.setTimeout(15000,()=>req.destroy(new Error('Website timed out.')));req.on('error',reject);
  });
  if([301,302,303,307,308].includes(result.status)&&result.headers.location){if(redirects>=4)throw new Error('Too many redirects.');return fetchPublic(new URL(result.headers.location,u).href,redirects+1);}
  if(result.status!==200)throw new Error(`Website returned HTTP ${result.status}.`);
  return {...result,url:u.href};
}
export async function extract(buffer,name,mime='') {
  const ext=path.extname(name).toLowerCase();let content='',rows=null,status='ready';
  if(ext==='.csv') {rows=parse(buffer.toString('utf8'),{columns:true,bom:true,skip_empty_lines:true,relax_column_count:false});if(rows.length>50000)throw new Error('CSV exceeds 50,000 rows.');content=JSON.stringify(rows);}
  else if(ext==='.json') {const data=JSON.parse(buffer.toString('utf8'));rows=Array.isArray(data)&&data.every(x=>x&&typeof x==='object'&&!Array.isArray(x))?data:null;content=JSON.stringify(data,null,2);}
  else if(ext==='.pdf'||mime.includes('application/pdf')) {
    const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task=getDocument({data:new Uint8Array(buffer),useSystemFonts:true,isEvalSupported:false});const pdf=await task.promise;
    try {for(let i=1;i<=Math.min(pdf.numPages,200);i++){const page=await pdf.getPage(i);const t=await page.getTextContent();content+=`\n[Page ${i}]\n`+t.items.map(x=>x.str||'').join(' ');}if(pdf.numPages>200)status='partial';}finally{await task.destroy();}
    if(content.replace(/\[Page \d+\]/g,'').trim().length<30){status='attachment';content='This PDF needs OCR before its contents can be used.';}
  } else if(['.html','.htm'].includes(ext)||mime.includes('text/html')) {const $=load(buffer.toString('utf8'));$('script,style,noscript,svg,iframe,nav,footer').remove();content=$('body').text().replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim();}
  else if(['.txt','.md','.markdown'].includes(ext)||mime.includes('text/plain')) content=buffer.toString('utf8');
  else {status='attachment';content='Attachment retained. Text extraction is not configured for this format.';}
  if(content.length>500000){content=content.slice(0,500000)+'\n[Extraction truncated at 500,000 characters]';status='partial';}
  return {content,rows,status};
}
export async function importBuffer(dir,buffer,name,origin='upload',mime='') {
  if(!name||forbiddenName(name))throw new Error('Hidden files and credential files cannot be imported.');
  if(buffer.length>MAX_BYTES)throw new Error('File exceeds the 10 MB limit.');
  const hash=crypto.createHash('sha256').update(buffer).digest('hex');const list=sourcesFor(dir);const existing=list.find(s=>s.hash===hash&&s.origin===origin);if(existing)return {...existing,duplicate:true};
  const result=await extract(buffer,name,mime);const id=crypto.randomUUID();const folder=path.join(dir,'sources',id);fs.mkdirSync(folder,{recursive:true});
  const safeName=path.basename(name).replace(/[^\w. -]/g,'_');const original=`sources/${id}/original/${safeName}`;
  fs.mkdirSync(path.join(folder,'original'),{recursive:true});
  fs.writeFileSync(path.join(dir,original),buffer,{mode:0o600});
  fs.writeFileSync(path.join(folder,'extracted.md'),`# ${safeName}\n\nSource ID: ${id}\nCaptured: ${new Date().toISOString()}\n\n${result.content}`,{mode:0o600});
  if(result.rows)atomicJSON(path.join(folder,'rows.json'),result.rows);
  const record={id,name:safeName,origin,original,text:`sources/${id}/extracted.md`,hash,capturedAt:new Date().toISOString(),status:result.status,columns:result.rows?.length?Object.keys(result.rows[0]):[],rowCount:result.rows?.length??null};
  // Re-read after async extraction so simultaneous uploads cannot lose records.
  const current=sourcesFor(dir);const raced=current.find(s=>s.hash===hash&&s.origin===origin);if(raced)return {...raced,duplicate:true};
  atomicJSON(path.join(dir,'system/sources.json'),[...current,record]);return record;
}
export async function importFile(dir,file) {
  const p=path.resolve(file),s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isFile())throw new Error('Choose a regular file, not a symlink.');if(s.size>MAX_BYTES)throw new Error('File exceeds the 10 MB limit.');
  return importBuffer(dir,fs.readFileSync(p),path.basename(p),p);
}
export async function importURL(dir,url) {
  const r=await fetchPublic(url);const mime=String(r.headers['content-type']||'');
  if(!/text\/(html|plain)|application\/pdf/.test(mime))throw new Error('This URL must return HTML, plain text or a PDF.');
  const name=new URL(r.url).hostname+(mime.includes('pdf')?'.pdf':mime.includes('html')?'.html':'.txt');return importBuffer(dir,r.buffer,name,r.url,mime);
}
export function metricValue(dir,m) {
  const s=sourcesFor(dir).find(s=>s.id===m.sourceId);if(!s)return {value:null,error:'Source unavailable'};
  const rows=readJSON(within(dir,`sources/${s.id}/rows.json`),null);if(!rows)return {value:null,error:'Source is not tabular'};
  if(m.aggregation==='count')return {value:rows.length,error:null};
  const values=rows.map(r=>r[m.column]);if(values.some(v=>v===null||v===''||typeof v==='boolean'||!Number.isFinite(Number(v))))return {value:null,error:'Column contains missing or non-numeric values; confirm a cleaned column'};
  if(!values.length)return {value:null,error:'No rows'};
  const nums=values.map(Number),sum=nums.reduce((a,b)=>a+b,0);return {value:m.aggregation==='sum'?sum:m.aggregation==='average'?sum/nums.length:nums.at(-1),error:null};
}
