import path from 'node:path';
import {ROOT,readJSON} from '../runtime/config.mjs';
const state=readJSON(path.join(ROOT,'.argus-local/session.json'));
if(!state)console.log('No ARGUS launcher session found.');
else try {const r=await fetch(`http://127.0.0.1:${state.port}/stop`,{method:'POST',headers:{Authorization:'Bearer '+state.token},signal:AbortSignal.timeout(2000)});if(!r.ok)throw new Error();console.log('Stopping the services started by this ARGUS folder.');}catch{console.log('That launcher session is no longer responding. No unrelated processes were stopped.');}
