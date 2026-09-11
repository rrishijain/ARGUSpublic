import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'public/voice-assets');fs.mkdirSync(target,{recursive:true});
for(const [pkg,names] of [
  ['@ricky0123/vad-web',['vad.worklet.bundle.min.js','silero_vad_v5.onnx']],
  ['onnxruntime-web',['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']],
])for(const name of names)fs.copyFileSync(path.join(root,'node_modules',pkg,'dist',name),path.join(target,name));
console.log('Local listening assets prepared.');
