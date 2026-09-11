import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(process.cwd());
export const PANEL_TYPES = ['metrics','tasks','notes','reports','sources','actions'];
export const PRESETS = {
  business: {subtitle:'YOUR BUSINESS, IN FOCUS',goals:['Grow with intention','Deliver excellent work','Make informed decisions'],metricLabels:['Revenue','Active clients','Qualified leads']},
  creator: {subtitle:'IDEAS INTO IMPACT',goals:['Create something useful','Publish consistently','Learn from your audience'],metricLabels:['Published pieces','Subscribers','Engagement']},
  learning: {subtitle:'A LITTLE FURTHER, EVERY DAY',goals:['Understand the fundamentals','Practise deliberately','Finish a meaningful project'],metricLabels:['Lessons completed','Study hours','Projects shipped']},
};
export function readJSON(file, fallback=null) {
  try { return JSON.parse(fs.readFileSync(file,'utf8')); }
  catch(e) { if(e.code==='ENOENT') return fallback; throw new Error(`Cannot read ${path.basename(file)}. Restore or repair this file; it has not been overwritten.`); }
}
export function atomicJSON(file,data) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600}); fs.renameSync(tmp,file);
}
export function defaults() {
  return {version:2,onboarded:false,name:'Your space',title:'ARGUS',purpose:'Build a command centre around what matters to you.',preset:'business',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',currency:'USD',accent:'#ff6b5e',workspace:'workspace',provider:null,goals:[],panels:[{id:'notes',type:'notes',title:'Your next chapter',side:'left'},{id:'tasks',type:'tasks',title:'Today’s priorities',side:'left'},{id:'metrics',type:'metrics',title:'At a glance',side:'left'},{id:'actions',type:'actions',title:'Command Deck',side:'right'},{id:'sources',type:'sources',title:'Sources',side:'right'},{id:'reports',type:'reports',title:'Your work',side:'right'}],voice:{engine:'kokoro',voiceURI:'',kokoroVoice:'af_heart',speed:1,muted:false},metrics:[],businessProfile:{businessName:'',offering:'',audience:'',problem:'',firstResult:'',definitions:{}},appearance:{theme:'light',textSize:'standard',density:'comfortable',city:'prominent'},features:[],starterPack:null,firstResult:{status:'pending',reportId:null}};
}
const text=(x,max=300)=>typeof x==='string'&&x.length<=max;
export function validateConfig(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('Configuration must be an object.');
  if(input.version!==undefined&&![1,2].includes(input.version)) throw new Error('Unsupported configuration version.');
  const d=defaults(),c={...d,...input,version:2,voice:{...d.voice,...(input.version===1?{engine:'system'}:{}),...input.voice},businessProfile:{...d.businessProfile,...input.businessProfile},appearance:{...d.appearance,...input.appearance},firstResult:{...d.firstResult,...input.firstResult}};
  for(const k of ['name','title','purpose','workspace']) if(!text(c[k],k==='purpose'?2000:500)||!c[k].trim()) throw new Error(`Invalid ${k}.`);
  if(!PRESETS[c.preset]) throw new Error('Choose business, creator or learning.');
  try { new Intl.DateTimeFormat('en',{timeZone:c.timezone}).format(); } catch { throw new Error('Invalid IANA timezone.'); }
  if(!/^[A-Z]{3}$/.test(c.currency)||!/^#[a-f\d]{6}$/i.test(c.accent)) throw new Error('Invalid currency or accent colour.');
  if(![null,'claude','codex'].includes(c.provider)) throw new Error('Choose claude, codex or no AI provider.');
  if(typeof c.onboarded!=='boolean'||!Array.isArray(c.goals)||c.goals.length>3||c.goals.some(g=>!text(g,300))) throw new Error('Choose up to three goals.');
  if(!Array.isArray(c.panels)||c.panels.length<1||c.panels.length>12||new Set(c.panels.map(p=>p.id)).size!==c.panels.length||c.panels.some(p=>!p||!PANEL_TYPES.includes(p.type)||!['left','right'].includes(p.side)||!text(p.title,60)||!/^[-a-z0-9]{1,40}$/.test(p.id))) throw new Error('Invalid panel configuration.');
  if(!['system','kokoro'].includes(c.voice.engine)||!text(c.voice.voiceURI,300)||!['af_heart','am_michael','bf_emma','bm_george'].includes(c.voice.kokoroVoice)||!Number.isFinite(c.voice.speed)||c.voice.speed<0.5||c.voice.speed>2||typeof c.voice.muted!=='boolean') throw new Error('Invalid voice settings.');
  if(!Array.isArray(c.metrics)||c.metrics.length>12) throw new Error('Use at most 12 metrics.');
  for(const m of c.metrics) if(!m||!text(m.label,80)||!text(m.unit,40)||!text(m.period,100)||!text(m.sourceId,80)||!text(m.column,100)||!['sum','count','latest','average'].includes(m.aggregation)||m.confirmed!==true) throw new Error('Each metric needs a confirmed source, column, aggregation, unit and period.');
  for(const key of ['businessName','offering','audience','problem','firstResult'])if(!text(c.businessProfile[key],2000))throw new Error(`Invalid business profile ${key}.`);
  if(!c.businessProfile.definitions||typeof c.businessProfile.definitions!=='object'||Array.isArray(c.businessProfile.definitions)||Object.keys(c.businessProfile.definitions).length>40||Object.entries(c.businessProfile.definitions).some(([k,v])=>!text(k,100)||!text(v,1000)))throw new Error('Use up to 40 plain-language business definitions.');
  if(!['light','dark','system'].includes(c.appearance.theme)||!['standard','large'].includes(c.appearance.textSize)||!['comfortable','compact'].includes(c.appearance.density)||!['prominent','subtle','still'].includes(c.appearance.city))throw new Error('Invalid appearance preferences.');
  if(!Array.isArray(c.features)||c.features.length>30||new Set(c.features.map(f=>f?.id)).size!==c.features.length||c.features.some(f=>!f||!/^[-a-z0-9]{1,60}$/.test(f.id)||!text(f.activeVersion,80)||!/^[-a-zA-Z0-9.]{1,80}$/.test(f.activeVersion)))throw new Error('Invalid installed feature version.');
  if(![null,'sales','agency','content'].includes(c.starterPack))throw new Error('Unknown starter pack.');
  if(!['pending','ready'].includes(c.firstResult.status)||(c.firstResult.reportId!==null&&!/^[a-f0-9-]{36}$/.test(c.firstResult.reportId)))throw new Error('Invalid first-result state.');
  // Only known keys survive, including inside nested configuration objects.
  const pick=(value,keys)=>Object.fromEntries(keys.map(k=>[k,value[k]]));
  c.voice=pick(c.voice,Object.keys(defaults().voice));
  c.panels=c.panels.map(p=>pick(p,['id','type','title','side']));
  c.metrics=c.metrics.map(m=>pick(m,['label','unit','period','sourceId','column','aggregation','confirmed']));
  c.businessProfile=pick(c.businessProfile,Object.keys(d.businessProfile));
  c.appearance=pick(c.appearance,Object.keys(d.appearance));
  c.firstResult=pick(c.firstResult,Object.keys(d.firstResult));
  c.features=c.features.map(f=>pick(f,['id','activeVersion']));
  return Object.fromEntries(Object.keys(defaults()).map(k=>[k,c[k]]));
}
export function loadConfig(root=ROOT) {
  const file=path.join(root,'.argus-config.json'),old=readJSON(file),c=validateConfig(old||defaults());
  if(old&&old.version===1){atomicJSON(path.join(root,'.argus-local/backups',`config-v1-${Date.now()}.json`),old);atomicJSON(file,c);}
  return c;
}
export function saveConfig(input,root=ROOT) { const c=validateConfig(input),file=path.join(root,'.argus-config.json'),old=readJSON(file);if(old?.version===1)atomicJSON(path.join(root,'.argus-local/backups',`config-v1-${Date.now()}.json`),old);atomicJSON(file,c);return c; }
export function workspace(c=loadConfig(),root=ROOT) { return path.resolve(root,c.workspace); }
export function publicConfig(c) { const {workspace:_,metrics:__,...rest}=c; return rest; }
export function within(root,relative) {
  const dest=path.resolve(root,relative); if(dest!==root&&!dest.startsWith(root+path.sep)) throw new Error('Path is outside the workspace.');
  if(fs.existsSync(dest)) { const real=fs.realpathSync(dest),base=fs.realpathSync(root); if(real!==base&&!real.startsWith(base+path.sep)) throw new Error('Symlink leaves the workspace.'); }
  return dest;
}
