'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import type {StudentConfig} from '@/lib/types';

interface Setup {application:string;provider:string|null;providers:Record<string,{installed:boolean;authentication:string}>;runner:{alive:boolean};voice:{status:string;stage:string;message:string;progress?:number;serviceReady?:boolean;speaking?:boolean;listening?:boolean}}
export default function SetupChecklist({config,onUpdated,onNotice}:{config:StudentConfig;onUpdated:()=>void;onNotice:(message:string)=>void}){
  const [setup,setSetup]=useState<Setup|null>(null),[busy,setBusy]=useState(false);
  useEffect(()=>{let live=true;const refresh=async()=>{try{const s=await api<Setup>('/api/setup');if(live)setSetup(s);}catch{}};void refresh();const timer=setInterval(refresh,3500);return()=>{live=false;clearInterval(timer);};},[]);
  const stage=(value:boolean|undefined)=>value&&setup?.voice.serviceReady?'ready':'waiting';
  const perform=async(fn:()=>Promise<unknown>)=>{setBusy(true);try{await fn();onUpdated();setSetup(await api<Setup>('/api/setup'));}catch(e){onNotice((e as Error).message);}finally{setBusy(false);}};
  const installing=setup?.voice.status==='installing';
  return <section className="setup-checklist" aria-label="Setup progress">
    <div className="setup-checklist-heading"><span className="eyebrow">GETTING YOUR SPACE READY</span><span className="local-badge">ON YOUR COMPUTER</span></div>
    <div className="setup-status-grid">
      <div><i className={`status-dot ${setup?'ready':'waiting'}`}/><span>Workspace</span><strong>{setup?'Ready':'Opening'}</strong></div>
      <div><i className={`status-dot ${config.provider&&setup?.runner.alive?'ready':'waiting'}`}/><span>AI account</span><strong>{config.provider?config.provider==='codex'?'Codex selected':'Claude selected':'Choose below'}</strong></div>
      <div><i className={`status-dot ${stage(setup?.voice.listening)}`}/><span>Listening</span><strong>{stage(setup?.voice.listening)==='ready'?'Ready':installing?'Preparing':'Not ready'}</strong></div>
      <div><i className={`status-dot ${stage(setup?.voice.speaking)}`}/><span>Speaking</span><strong>{stage(setup?.voice.speaking)==='ready'?'Ready':installing?'Preparing':'Not ready'}</strong></div>
    </div>
    <div className="setup-account"><label htmlFor="setup-provider">Your AI account</label><select id="setup-provider" value={config.provider||''} disabled={busy} onChange={e=>void perform(()=>api('/api/settings',{provider:e.target.value||null}))}><option value="">Choose your assistant</option><option value="codex">Codex{setup?.providers.codex?.installed?' · installed':' · CLI needed'}</option><option value="claude">Claude Code{setup?.providers.claude?.installed?' · installed':' · CLI needed'}</option></select><small>Sign-in is checked when you send a message. Your account’s usage limits apply.</small></div>
    <div className="voice-install-progress"><div><strong>{setup?.voice.status==='ready'?'Local voice is ready':setup?.voice.message||'Preparing local speech and listening.'}</strong>{installing&&<progress aria-label="Voice installation progress" max={100} value={typeof setup?.voice.progress==='number'?setup.voice.progress:undefined}/>}</div>
      {installing?<button disabled={busy} onClick={()=>void perform(()=>api('/api/voice/cancel',{}))}>Continue without voice</button>:setup?.voice.status!=='ready'&&<button disabled={busy} onClick={()=>void perform(()=>api('/api/voice/install',{retry:true}))}>{setup?.voice.status==='error'?'Retry voice setup':'Set up voice'}</button>}
    </div>
    {setup&&!setup.runner.alive&&<p className="inline-note">The background assistant is offline. Restart ARGUS with <code>npm start</code>; your progress is saved.</p>}
  </section>;
}
