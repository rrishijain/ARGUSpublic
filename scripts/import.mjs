import fs from 'node:fs';
import path from 'node:path';
import {loadConfig,workspace} from '../runtime/config.mjs';
import {importFile,importURL,forbiddenName} from '../runtime/sources.mjs';
const args=process.argv.slice(2),dir=workspace(loadConfig()),get=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
try {
  if(get('--file'))console.log(JSON.stringify(await importFile(dir,get('--file')),null,2));
  else if(get('--url'))console.log(JSON.stringify(await importURL(dir,get('--url')),null,2));
  else if(get('--folder')) {
    const root=path.resolve(get('--folder'));if(fs.lstatSync(root).isSymbolicLink())throw new Error('Choose a real folder, not a symlink.');let count=0,skipped=0;
    async function walk(folder,depth=0){if(depth>5)return;for(const e of fs.readdirSync(folder,{withFileTypes:true})){if(forbiddenName(e.name)||e.isSymbolicLink()||['node_modules','workspace','ARGUS','venv','__pycache__'].includes(e.name)){skipped++;continue;}const p=path.join(folder,e.name);if(e.isDirectory())await walk(p,depth+1);else if(e.isFile()){if(++count>100)throw new Error('Folder limit is 100 files. Select a smaller folder.');try{const r=await importFile(dir,p);console.log(`${r.id} · ${r.name} · ${r.status}`);}catch(e){skipped++;console.log(`Skipped ${path.basename(p)}: ${e.message}`);}}}}
    await walk(root);console.log(`Finished. ${skipped} entries skipped. Originals at the source were not modified.`);
  }else throw new Error('Use --file <path>, --folder <selected-folder>, or --url <public-page>.');
}catch(e){console.error(e.message);process.exitCode=1;}
