'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {api} from '@/lib/api';
import type {ConversationSession,StudentConfig} from '@/lib/types';
import {VoiceConversation} from '@/lib/conversation-audio';
const Markdown=dynamic(()=>import('react-markdown'),{ssr:false});

export default function ConversationPanel({config,onUpdated,onNotice,onReview,onBuild,initialText='',autoSend=false}:{
  config:StudentConfig;onUpdated:()=>void;onNotice:(message:string)=>void;onReview?:()=>void;
  onBuild?:(prompt:string)=>void;initialText?:string;autoSend?:boolean;
}) {
  const [session,setSession]=useState<ConversationSession|null>(null),[input,setInput]=useState(initialText);
  const [loading,setLoading]=useState(true),[sending,setSending]=useState(false),[error,setError]=useState('');
  const [audioState,setAudioState]=useState('idle'),[voiceReady,setVoiceReady]=useState(false),[startingVoice,setStartingVoice]=useState(false);
  const sessionRef=useRef<ConversationSession|null>(null),audioRef=useRef<VoiceConversation|null>(null);
  const submitRef=useRef<(text:string)=>Promise<void>>(async()=>{}),onNoticeRef=useRef(onNotice),onUpdatedRef=useRef(onUpdated);
  const lastRevision=useRef(-1),spoken=useRef(new Set<string>()),requesting=useRef(false);
  const bottom=useRef<HTMLDivElement>(null),textbox=useRef<HTMLTextAreaElement>(null);
  const seeded=useRef(false);
  const cancelling=useRef(false),voiceStarting=useRef(false);
  onNoticeRef.current=onNotice;onUpdatedRef.current=onUpdated;
  const kind=config.onboarded?'conversation':'onboarding';

  const receive=useCallback((next:ConversationSession,initial=false)=>{
    if(!initial&&(cancelling.current||sessionRef.current?.id!==next.id||next.revision<sessionRef.current.revision))return;
    if(initial)next.turns.forEach(t=>spoken.current.add(t.id));
    sessionRef.current=next;setSession(next);
    if(lastRevision.current!==next.revision){lastRevision.current=next.revision;onUpdatedRef.current();}
    const replies=next.turns.filter(t=>t.role==='assistant'&&!spoken.current.has(t.id));
    replies.forEach(t=>spoken.current.add(t.id));
    const latest=replies.at(-1);
    if(latest&&audioRef.current&&audioRef.current.state!=='idle')void audioRef.current.speakReply(latest.spokenText||latest.text);
    if(next.status==='error'){
      setError(next.error||'Your account could not answer. Your conversation is saved.');
      if(audioRef.current?.state==='thinking')audioRef.current.resume();
    }
  },[]);

  useEffect(()=>{
    let active=true,polling=false;
    setLoading(true);setError('');spoken.current.clear();lastRevision.current=-1;
    void api<{session:ConversationSession}>('/api/conversation',{kind}).then(r=>{if(active)receive(r.session,true);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    const poll=setInterval(async()=>{
      const current=sessionRef.current;if(!active||polling||!current)return;polling=true;
      try{const r=await api<{session:ConversationSession}>(`/api/conversation?id=${current.id}`);if(active)receive(r.session);}
      catch(e){if(active)setError((e as Error).message);}finally{polling=false;}
    },1000);
    const check=async()=>{try{const r=await api<{ok:boolean;stt:boolean}>('/api/voice/health');if(active)setVoiceReady(Boolean(r.ok&&r.stt));}catch{if(active)setVoiceReady(false);}};
    void check();const health=setInterval(check,5000);
    return()=>{active=false;clearInterval(poll);clearInterval(health);sessionRef.current=null;audioRef.current?.stop();};
  },[kind,receive]);

  useEffect(()=>{
    const controller=new VoiceConversation({
      onTranscript:async(text:string)=>{setInput(text);await submitRef.current(text);},
      onState:(state:string)=>setAudioState(state),onNotice:(message:string)=>onNoticeRef.current(message),
      onInterrupt:async()=>{const current=sessionRef.current;if(current?.pendingJobId){cancelling.current=true;try{const r=await api<{session:ConversationSession}>('/api/conversation/cancel',{id:current.id});cancelling.current=false;receive(r.session,true);}catch(e){onNoticeRef.current((e as Error).message);}finally{cancelling.current=false;}}},
    });
    audioRef.current=controller;
    return()=>{controller.stop();audioRef.current=null;};
  },[]);

  useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest',behavior:'instant'});},[session?.turns.length,session?.status]);
  const submit=async(text:string)=>{
    const current=sessionRef.current,q=text.trim();if(!current||!q||requesting.current)return;
    requesting.current=true;setSending(true);setError('');audioRef.current?.pauseForThinking();
    try{
      const r=await api<{session:ConversationSession}>('/api/conversation/turn',{id:current.id,text:q,requestId:crypto.randomUUID()});
      receive(r.session);setInput('');
    }catch(e){setError((e as Error).message);audioRef.current?.resume();}
    finally{requesting.current=false;setSending(false);}
  };
  submitRef.current=submit;
  useEffect(()=>{if(autoSend&&initialText&&session&&!loading&&config.provider&&!seeded.current){seeded.current=true;void submitRef.current(initialText);}},[autoSend,initialText,session,loading,config.provider]);
  const pending=sending||Boolean(session?.pendingJobId);
  const startVoice=async()=>{
    if(voiceStarting.current)return;voiceStarting.current=true;setStartingVoice(true);
    try{
      const controller=audioRef.current;if(!controller)return;
      await controller.start();
      setStartingVoice(false);
      const last=sessionRef.current?.turns.filter(t=>t.role==='assistant').at(-1);
      if(last)await controller.speakReply(last.spokenText||last.text);
    }catch(e){setError((e as Error).message);}finally{voiceStarting.current=false;setStartingVoice(false);}
  };
  const newSession=async()=>{
    audioRef.current?.stop();setError('');
    try{const r=await api<{session:ConversationSession}>('/api/conversation',{kind,fresh:true});receive(r.session,true);setInput('');}catch(e){setError((e as Error).message);}
  };
  return <section className="conversation-panel" aria-label={config.onboarded?'Conversation with ARGUS':'Onboarding conversation'}>
    <div className="conversation-heading"><div><span className="eyebrow">{config.onboarded?'YOUR THINKING PARTNER':'LET’S BUILD YOUR ARGUS'}</span><h2>{config.onboarded?'A little clarity. A next step.':'Tell me what you’re building.'}</h2></div><span className={`conversation-state state-${audioState}`} role="status">{audioState==='idle'?(pending?'Thinking…':'Ready to chat'):audioState}</span></div>
    <p className="conversation-intro">{config.onboarded?'Ask a follow-up, explore your information, or describe a useful new feature.':'We’ll work through your business, your first useful result, and how this space should feel. One question at a time.'}</p>
    <div className="conversation-messages" role="log" aria-live="polite" aria-relevant="additions">
      {loading&&<p className="student-copy">Opening your saved conversation…</p>}
      {!loading&&!session?.turns.length&&<div className="conversation-welcome"><span className="conversation-avatar">A</span><p>What does your business do, and what would you like ARGUS to help with first?</p></div>}
      {session?.turns.map(turn=><article key={turn.id} className={`conversation-turn turn-${turn.role}`}>
        <div className="turn-author">{turn.role==='assistant'?'ARGUS':'YOU'}</div>
        <div className="turn-content"><Markdown>{turn.text}</Markdown></div>
        {turn.actions?.map(action=><button className="proposal-button" key={action.id} disabled={action.status==='applied'||pending||!config.onboarded} onClick={()=>void api<{session:ConversationSession}>('/api/conversation/action',{id:session.id,turnId:turn.id,actionId:action.id}).then(r=>{receive(r.session);onUpdated();if(action.type==='build_feature')onBuild?.('');}).catch(e=>onNotice(e.message))}>{action.status==='applied'?'✓ Applied':String(action.title||action.label||action.type).replaceAll('_',' ')}</button>)}
        {turn.role==='user'&&turn.id===session.turns.filter(t=>t.role==='user').at(-1)?.id&&<button className="turn-correct" onClick={()=>{setInput(`Correction: ${turn.text}`);textbox.current?.focus();}}>Correct this</button>}
      </article>)}
      {pending&&<div className="thinking-indicator" role="status"><i/><i/><i/><span>Working on your answer…</span><button onClick={()=>{cancelling.current=true;void api<{session:ConversationSession}>('/api/conversation/cancel',{id:session?.id}).then(r=>{cancelling.current=false;receive(r.session,true);audioRef.current?.resume();}).catch(e=>onNotice(e.message)).finally(()=>{cancelling.current=false;});}}>Cancel</button></div>}
      <div ref={bottom}/>
    </div>
    {error&&<div className="inline-error" role="alert">{error}<button onClick={()=>{setError('');const last=session?.turns.filter(t=>t.role==='user').at(-1);if(last)setInput(last.text);textbox.current?.focus();}}>Retry</button></div>}
    {!config.provider&&<p className="inline-note">Choose your AI account above to start. Your account’s usage limits apply.</p>}
    <form className="conversation-compose" onSubmit={e=>{e.preventDefault();void submit(input);}}>
      <label className="sr-only" htmlFor="conversation-input">Your message to ARGUS</label>
      <textarea id="conversation-input" ref={textbox} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!pending&&config.provider)void submit(input);}}} maxLength={4000} rows={2} placeholder={config.onboarded?'Ask a follow-up or describe what you need…':'For example: I run a small agency and want to track client projects…'}/>
      <div className="conversation-compose-actions"><div className="voice-actions">
        {audioState==='idle'?<button type="button" className="talk-button" disabled={!voiceReady||!config.provider||loading||pending||startingVoice} onClick={()=>void startVoice()} title={voiceReady?'Start a spoken conversation':'Voice will be available when setup completes'}>{startingVoice?'Preparing microphone…':'◉ Start talking'}</button>:<><button type="button" className="talk-button active" disabled={startingVoice} onClick={()=>void audioRef.current?.interrupt()}>◉ Interrupt & speak</button><button type="button" onClick={()=>audioRef.current?.stop()}>End voice</button></>}
      </div><button className="student-primary" disabled={pending||loading||!input.trim()||!config.provider}>Send ↗</button></div>
    </form>
    <div className="conversation-footer"><span>Your conversation is saved on this computer.</span><div>{onReview&&<button onClick={onReview}>Review my setup ↗</button>}{onBuild&&<button onClick={()=>onBuild(input||session?.turns.filter(t=>t.role==='user').at(-1)?.text||'')}>Build a feature ↗</button>}{config.onboarded&&<button onClick={()=>void newSession()}>New conversation</button>}</div></div>
  </section>;
}
