'use client';
import {useEffect,useRef,useState} from 'react';

export type FeaturePreview = {id:string;versionId:string;name:string;description:string;kind:'panel'|'workspace';permissions:string[];sourceIds:string[];recordLabels:Record<string,string>;mode:'preview'|'active';token:string;channel:string;html:string};
export default function FeatureFrame({preview,onNotice,height=440}:{preview:FeaturePreview;onNotice?:(message:string)=>void;height?:number}){
  const frame=useRef<HTMLIFrameElement>(null),notice=useRef(onNotice);notice.current=onNotice;
  const [error,setError]=useState('');
  const [allowChanges,setAllowChanges]=useState(false),allowChangesRef=useRef(false);
  const [actions,setActions]=useState<Array<{id:string;label:string;details:string;approve:()=>void;cancel:()=>void}>>([]);
  useEffect(()=>{
    setError('');setActions([]);setAllowChanges(false);allowChangesRef.current=false;let mounted=true,inflight=0;const seen=new Set<string>();const controllers=new Set<AbortController>();const confirmations=new Set<()=>void>();
    const receive=async(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin!=='null'||event.data?.type!=='argus:feature:request'||event.data.channel!==preview.channel)return;
      const {id,method,args}=event.data;if(typeof id!=='string'||id.length>80||seen.has(id)||typeof method!=='string')return;
      seen.add(id);if(seen.size>500)seen.delete(seen.values().next().value!);
      const reply=(result?:unknown,message?:string)=>{if(mounted)frame.current?.contentWindow?.postMessage({type:'argus:feature:result',channel:preview.channel,id,result,error:message},'*');};
      if(inflight>=10){reply(undefined,'Too many feature requests.');return;}inflight++;
      const controller=new AbortController();controllers.add(controller);
      try{
        const payload=JSON.stringify({token:preview.token,method,args});if(payload.length>250000)throw new Error('Feature request exceeds the size limit.');
        if(preview.mode==='active'&&['records.create','records.update','tasks.add','tasks.toggle','notes.add'].includes(method)&&!allowChangesRef.current)throw new Error('Enable “Allow local changes” above this feature, then save again.');
        if(preview.mode==='active'&&method==='reports.run'){
          // Account-using report requests require a trusted host click; generated UI cannot fake it.
          await new Promise<void>((resolve,reject)=>{
            const finish=(accepted:boolean)=>{clearTimeout(timer);confirmations.delete(cancel);if(mounted)setActions(items=>items.filter(a=>a.id!==id));accepted?resolve():reject(new Error('Change cancelled.'));};
            const cancel=()=>finish(false),timer=setTimeout(cancel,115000);confirmations.add(cancel);
            setActions(items=>[...items,{id,label:'Run this report using your AI account',details:String(args?.question||'Prepare a report from this feature’s selected sources.').slice(0,1200),approve:()=>finish(true),cancel}]);
          });
        }
        const response=await fetch('/api/features/capability',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:controller.signal});const result=await response.json();
        if(!response.ok||result.error&&result.value===undefined)throw new Error(result.error||'Feature request failed.');reply(result);
      }catch(e){if(controller.signal.aborted)return;const message=e instanceof Error?e.message:'Feature request failed.';reply(undefined,message);setError(message);notice.current?.(message);}finally{inflight--;controllers.delete(controller);}
    };
    window.addEventListener('message',receive);return()=>{mounted=false;window.removeEventListener('message',receive);controllers.forEach(c=>c.abort());confirmations.forEach(cancel=>cancel());};
  },[preview]);
  return <section aria-label={preview.name}>
    <p style={{fontSize:12,margin:'0 0 8px',opacity:.8}}>{preview.mode==='preview'?'Preview · Try forms using disposable example records. Your workspace and selected sources stay unchanged.':'Active feature · Changes save in your local workspace.'}</p>
    {preview.mode==='active'&&preview.permissions.some(p=>['records.write','tasks.write','notes.write'].includes(p))&&<label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,marginBottom:12}}><input type="checkbox" checked={allowChanges} onChange={e=>{allowChangesRef.current=e.target.checked;setAllowChanges(e.target.checked);setError('');}}/>Allow local changes during this session</label>}
    {actions.map(action=><div key={action.id} role="group" aria-label="Confirm feature change" style={{padding:12,marginBottom:8,border:'1px solid var(--accent, #d75b48)',borderRadius:8}}><strong>{action.label}?</strong><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12,maxHeight:100,overflow:'auto'}}>{action.details}</pre><button type="button" onClick={action.approve}>Confirm</button>{' '}<button type="button" onClick={action.cancel}>Cancel</button></div>)}
    {error&&<p role="status" style={{fontSize:12,color:'var(--accent, #b34f40)'}}>{error}</p>}
    <iframe key={preview.channel} ref={frame} title={preview.name} srcDoc={preview.html} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" style={{width:'100%',height,border:'1px solid rgba(100,100,80,.2)',borderRadius:12,background:'#fcfaf5'}} />
  </section>;
}
