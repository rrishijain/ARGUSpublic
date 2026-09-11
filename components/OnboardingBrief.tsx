'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import type {StudentConfig,StarterPack} from '@/lib/types';
import AppearanceFields,{defaultAppearance} from './AppearanceFields';

export default function OnboardingBrief({config,onComplete,onNotice}:{config:StudentConfig;onComplete:()=>void;onNotice:(message:string)=>void}){
  const [edited,setEdited]=useState(config),[packs,setPacks]=useState<StarterPack[]>([]),[useDemo,setUseDemo]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(false);
  useEffect(()=>{let live=true;void Promise.all([api<{config:StudentConfig;draft:{answers:Record<string,unknown>}}>('/api/onboarding/preview',{}),api<{packs:StarterPack[]}>('/api/packs')]).then(([p,s])=>{if(live){setEdited(p.config);setUseDemo(p.draft.answers.useDemo===true);setPacks(s.packs);setReady(true);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
  const answers=()=>({name:edited.name,title:edited.title,purpose:edited.purpose,goals:edited.goals,accent:edited.accent,businessProfile:edited.businessProfile,appearance:edited.appearance,starterPack:edited.starterPack,panels:edited.panels,useDemo});
  const complete=async()=>{setBusy(true);setError('');try{const result=await api<{firstJob?:unknown;demoError?:string}>('/api/onboarding/complete',{answers:answers()});onNotice(result.demoError?`Your setup is saved, but demo import failed: ${result.demoError}`:result.firstJob?'Your ARGUS is ready. Your first result is being prepared.':'Your ARGUS is ready. Add information or build a tool to create your first result.');onComplete();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const setBusiness=(key:keyof StudentConfig['businessProfile'],value:string)=>setEdited(c=>({...c,businessProfile:{...c.businessProfile,[key]:value}}));
  return <form className="onboarding-brief" onSubmit={e=>{e.preventDefault();void complete();}}>
    <span className="eyebrow">YOUR SPACE, YOUR CHOICES</span><h2>Here’s what we’ll build around.</h2><p>Review what ARGUS learned. Edit anything that needs a little more precision.</p>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <div className="brief-columns"><div>
      <label className="student-field">Your name<input value={edited.name==='Your space'?'':edited.name} onChange={e=>setEdited({...edited,name:e.target.value})} required maxLength={100} placeholder="How should ARGUS address you?"/></label>
      <label className="student-field">Business or project<input value={edited.businessProfile?.businessName||''} onChange={e=>setBusiness('businessName',e.target.value)} maxLength={200}/></label>
      <label className="student-field">What ARGUS should help you accomplish<textarea value={edited.purpose} onChange={e=>setEdited({...edited,purpose:e.target.value})} rows={3} required maxLength={2000}/></label>
      <label className="student-field">Who you serve<input value={edited.businessProfile?.audience||''} onChange={e=>setBusiness('audience',e.target.value)} maxLength={2000}/></label>
      <label className="student-field">The recurring problem<textarea value={edited.businessProfile?.problem||''} onChange={e=>setBusiness('problem',e.target.value)} rows={2} maxLength={2000}/></label>
      <label className="student-field">Your first useful result<textarea value={edited.businessProfile?.firstResult||''} onChange={e=>setBusiness('firstResult',e.target.value)} rows={2} maxLength={2000}/></label>
      <label className="student-field">Up to three priorities, one per line<textarea value={edited.goals.join('\n')} onChange={e=>setEdited({...edited,goals:e.target.value.split('\n').slice(0,3)})} rows={3} maxLength={902}/></label>
    </div><div>
      <label className="student-field">A starting pack<select value={edited.starterPack||''} onChange={e=>setEdited({...edited,starterPack:(e.target.value||null) as StudentConfig['starterPack']})}><option value="">My own use case</option>{packs.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      {edited.starterPack&&<div className="demo-choice"><label><input type="checkbox" checked={useDemo} onChange={e=>setUseDemo(e.target.checked)}/><span>Try this pack with demonstration data</span></label><p>Fictional records let you explore immediately. Every demo source is labelled, and your own data can be added separately.</p></div>}
      <details className="brief-appearance" open><summary>Make it feel like yours</summary><AppearanceFields value={edited.appearance||defaultAppearance} onChange={appearance=>setEdited({...edited,appearance})} accent={edited.accent} onAccent={accent=>setEdited({...edited,accent})}/></details>
      <label className="student-field">Show first in my dashboard<select value={edited.panels[0]?.id||''} onChange={e=>{const selected=edited.panels.find(p=>p.id===e.target.value);if(selected)setEdited({...edited,panels:[{...selected,side:'left'},...edited.panels.filter(p=>p.id!==selected.id)]});}}>{edited.panels.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <div className={`style-preview preview-${edited.appearance?.theme==='dark'?'dark':'light'} text-${edited.appearance?.textSize}`} style={{'--preview-accent':edited.accent} as React.CSSProperties}><span>ARGUS / {edited.businessProfile?.businessName||edited.name}</span><strong>{edited.goals[0]||'Make room for what matters.'}</strong><p>{edited.appearance?.density==='compact'?'A focused, compact overview.':'A little room to think clearly.'}</p><div><i/><i/><i/></div><small>APPEARANCE PREVIEW · NO SAMPLE METRICS</small></div>
    </div></div>
    <div className="brief-complete"><p>Accepting uses your chosen workspace, or the local <code>workspace/</code> folder by default. To use an existing Obsidian vault, ask your coding assistant before accepting. Original files stay unchanged. A first result can be retried without repeating setup.</p><button className="student-primary" disabled={!ready||busy||!edited.name.trim()||!edited.purpose.trim()}>{busy?'Preparing your space…':'Create my ARGUS ↗'}</button></div>
  </form>;
}
