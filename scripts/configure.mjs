import fs from 'node:fs';
import path from 'node:path';
import {ROOT,loadConfig,saveConfig,validateConfig,PRESETS,workspace,atomicJSON,readJSON} from '../runtime/config.mjs';

const args=process.argv.slice(2),get=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
function hasSavedWork(dir,relative='') {
  if(!fs.existsSync(dir))return false;
  return fs.readdirSync(dir,{withFileTypes:true}).some(entry=>{
    const name=relative?relative+'/'+entry.name:entry.name;
    // Previewing the console creates only these runner bookkeeping files.
    if(['system/runner.json','system/runner.lock'].includes(name))return false;
    return entry.isDirectory()?hasSavedWork(path.join(dir,entry.name),name):true;
  });
}
try {
  const answer=get('--answers');
  if(answer){const incoming=readJSON(path.resolve(answer)),draftFile=path.join(ROOT,'.argus-onboarding.json'),draft=readJSON(draftFile,{answers:{}});const allowed=['purpose','preset','goals','sources','panels','name','title','timezone','branding','voice','provider','vault','businessProfile','appearance','starterPack','useDemo','sourcePreference','appearancePreference','workspace'];const answers={...draft.answers};for(const k of allowed)if(k in incoming)answers[k]=['businessProfile','appearance','voice'].includes(k)?{...answers[k],...incoming[k]}:incoming[k];atomicJSON(draftFile,{...draft,stage:'interview',answers,updatedAt:new Date().toISOString()});console.log('Interview progress saved.');process.exit(0);}
  const from=get('--from');if(!from)throw new Error('Use --answers <partial-answers.json>, or --from <config.json> [--confirmed] [--vault <existing-vault>].');
  const incoming=readJSON(path.resolve(from));if(!incoming)throw new Error('Configuration file not found.');
  const old=loadConfig(),next={...old,...incoming,voice:{...old.voice,...incoming.voice},appearance:{...old.appearance,...incoming.appearance},businessProfile:{...old.businessProfile,...incoming.businessProfile}};
  if(args.includes('--confirmed'))next.onboarded=true;
  if(get('--vault')){const vault=path.resolve(get('--vault'));if(!fs.existsSync(vault)||!fs.statSync(vault).isDirectory())throw new Error('Choose an existing vault folder.');next.workspace=path.join(fs.realpathSync(vault),'ARGUS');}
  const clean=validateConfig(next);
  if(old.workspace!==clean.workspace&&hasSavedWork(workspace(old)))throw new Error('This workspace already contains data. Export or copy it deliberately before changing workspace; no files were moved.');
  atomicJSON(path.join(ROOT,'.argus-local/backups',`config-${Date.now()}.json`),old);
  saveConfig(clean);fs.mkdirSync(workspace(clean),{recursive:true});
  if(clean.onboarded){const draftFile=path.join(ROOT,'.argus-onboarding.json'),draft=readJSON(draftFile,{answers:{}});atomicJSON(draftFile,{...draft,stage:'complete',completedAt:draft.completedAt||new Date().toISOString(),updatedAt:new Date().toISOString()});}
  console.log('Configuration saved. Existing notes and imported originals were preserved. Restart npm start if the workspace changed.');
}catch(e){console.error(e.message);process.exitCode=1;}
