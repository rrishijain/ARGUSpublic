import type {MicVAD} from '@ricky0123/vad-web';
import {voice} from './voice';

export type ConversationAudioState='idle'|'listening'|'transcribing'|'thinking'|'speaking';
type Callbacks={onTranscript:(text:string)=>void|Promise<void>;onState:(state:ConversationAudioState)=>void;onNotice:(message:string)=>void;onInterrupt?:()=>void|Promise<void>};
const OWNER='argus.conversation.microphone';
export class VoiceConversation {
  state:ConversationAudioState='idle';
  private active=false;
  private generation=0;
  private vad:MicVAD|null=null;
  private stream:MediaStream|null=null;
  private request:AbortController|null=null;
  private heartbeat:ReturnType<typeof setInterval>|null=null;
  private maxTurn:ReturnType<typeof setTimeout>|null=null;
  private token=typeof crypto!=='undefined'?crypto.randomUUID():String(Math.random());
  private releaseLock:(()=>void)|null=null;
  private recording=false;
  private samples:Float32Array[]=[];
  private events=false;
  constructor(private callbacks:Callbacks){}
  private setState(state:ConversationAudioState){this.state=state;this.callbacks.onState(state);}
  private visibility=()=>{if(document.hidden){this.stop();this.callbacks.onNotice('Conversation paused because this tab is no longer active.');}};
  private leave=()=>this.stop();
  private storage=(event:StorageEvent)=>{try{if(event.key===OWNER&&event.newValue&&JSON.parse(event.newValue).token!==this.token)this.stop();}catch{}};
  private async acquire(){
    // Web Locks prevents simultaneous acquisition; the heartbeat supports browsers without it.
    if(navigator.locks){const acquired=await new Promise<boolean>(resolve=>{void navigator.locks.request(OWNER,{ifAvailable:true},async lock=>{if(!lock){resolve(false);return;}await new Promise<void>(release=>{this.releaseLock=release;resolve(true);});});});if(!acquired)return false;}
    try{const owner=JSON.parse(localStorage.getItem(OWNER)||'null');if(owner&&owner.token!==this.token&&Date.now()-owner.time<5000){this.releaseLock?.();this.releaseLock=null;return false;}}catch{}
    const claim=()=>{try{localStorage.setItem(OWNER,JSON.stringify({token:this.token,time:Date.now()}));}catch{}};claim();this.heartbeat=setInterval(claim,1500);return true;
  }
  private releaseTracks(){this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;}
  private async getStream(){
    const generation=this.generation;
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    if(!this.active||generation!==this.generation||document.hidden){stream.getTracks().forEach(track=>track.stop());throw new Error('Conversation stopped.');}
    this.stream=stream;return stream;
  }
  async start(){
    if(this.active)return;
    if(document.hidden||!navigator.mediaDevices?.getUserMedia){this.callbacks.onNotice('Microphone access is unavailable here. Continue typing.');return;}
    if(!await this.acquire()){this.callbacks.onNotice('Another ARGUS tab is using the microphone. End that conversation first.');return;}
    this.active=true;const generation=++this.generation;
    if(!this.events){document.addEventListener('visibilitychange',this.visibility);window.addEventListener('pagehide',this.leave);window.addEventListener('storage',this.storage);this.events=true;}
    try{
      const health=await fetch('/api/voice/health').then(response=>response.json());
      if(!health.stt)throw new Error('Local listening is still preparing. You can continue typing.');
      if(!this.active||generation!==this.generation)return;
      const {MicVAD}=await import('@ricky0123/vad-web');
      const vad=await MicVAD.new({model:'v5',baseAssetPath:'/voice-assets/',onnxWASMBasePath:'/voice-assets/',startOnLoad:false,redemptionMs:1400,minSpeechMs:250,preSpeechPadMs:300,submitUserSpeechOnPause:false,
        ortConfig:ort=>{ort.env.wasm.numThreads=1;},
        getStream:()=>this.getStream(),pauseStream:async stream=>{stream.getTracks().forEach(track=>track.stop());if(this.stream===stream)this.stream=null;},resumeStream:()=>this.getStream(),
        onSpeechStart:()=>{if(this.state!=='listening')return;this.recording=true;this.samples=[];this.clearTimer();this.maxTurn=setTimeout(()=>void this.finishMaximum(),45000);},
        onFrameProcessed:(_probabilities,frame)=>{if(this.recording&&this.state==='listening')this.samples.push(frame.slice());},
        onVADMisfire:()=>{this.recording=false;this.samples=[];this.clearTimer();},
        onSpeechEnd:audio=>{this.recording=false;this.samples=[];this.clearTimer();void this.transcribe(audio);},
      });
      if(!this.active||generation!==this.generation){await vad.start().catch(()=>{});await vad.destroy().catch(()=>{});return;}
      this.vad=vad;this.setState('listening');await vad.start();
      this.callbacks.onNotice('Say a short sentence to check your microphone. Pause when finished; ARGUS will reply automatically.');
    }catch(error){if(generation!==this.generation)return;this.stop();this.callbacks.onNotice(error instanceof Error?error.message:'Microphone permission was denied. Continue typing.');}
  }
  private clearTimer(){if(this.maxTurn)clearTimeout(this.maxTurn);this.maxTurn=null;}
  private async finishMaximum(){const size=this.samples.reduce((sum,frame)=>sum+frame.length,0),audio=new Float32Array(Math.min(size,16000*45));let offset=0;for(const frame of this.samples){const count=Math.min(frame.length,audio.length-offset);if(count<=0)break;audio.set(frame.subarray(0,count),offset);offset+=count;}this.recording=false;this.samples=[];this.callbacks.onNotice('This turn reached 45 seconds. Sending what you said so far.');await this.transcribe(audio);}
  private async transcribe(audio:Float32Array){
    if(!this.active||this.state!=='listening'||!audio.length)return;
    const generation=this.generation;this.setState('transcribing');this.clearTimer();await this.vad?.pause();this.releaseTracks();
    if(!this.active||generation!==this.generation)return;
    try{
      const {utils}=await import('@ricky0123/vad-web');this.request=new AbortController();
      const response=await fetch('/api/voice/stt',{method:'POST',headers:{'Content-Type':'audio/wav'},body:utils.encodeWAV(audio),signal:this.request.signal});
      if(!response.ok)throw new Error('Could not transcribe this turn. Try a shorter sentence or type it.');
      const result=await response.json();if(!this.active||generation!==this.generation)return;
      if(!result.text?.trim()){this.callbacks.onNotice('No clear speech detected. Try again.');await this.resume();return;}
      this.setState('thinking');await this.callbacks.onTranscript(result.text.trim());
    }catch(error){if(!this.active||generation!==this.generation)return;this.callbacks.onNotice(error instanceof Error?error.message:'Transcription failed. Continue typing.');await this.resume();}
  }
  async pauseForThinking(){if(!this.active)return;this.setState('thinking');this.recording=false;this.samples=[];this.clearTimer();await this.vad?.pause();this.releaseTracks();}
  async speakReply(text:string){if(!this.active)return;const generation=this.generation;await this.pauseForThinking();if(!this.active||generation!==this.generation)return;this.setState('speaking');await voice.speak(text);if(this.active&&generation===this.generation)await this.resume();}
  async resume(){if(!this.active||document.hidden)return;this.setState('listening');try{await this.vad?.start();}catch{this.stop();this.callbacks.onNotice('Microphone could not resume. Click Start talking or continue typing.');}}
  async interrupt(){if(!this.active)return;++this.generation;this.request?.abort();voice.stop();this.recording=false;this.samples=[];this.clearTimer();await this.vad?.pause();this.releaseTracks();try{await this.callbacks.onInterrupt?.();}catch(error){this.callbacks.onNotice(error instanceof Error?error.message:'Could not cancel the previous answer.');}await this.resume();}
  stop(){this.active=false;++this.generation;this.request?.abort();this.request=null;voice.stop();this.recording=false;this.samples=[];this.clearTimer();this.releaseTracks();const vad=this.vad;this.vad=null;void vad?.destroy().catch(()=>{});if(this.heartbeat)clearInterval(this.heartbeat);this.heartbeat=null;this.releaseLock?.();this.releaseLock=null;try{if(JSON.parse(localStorage.getItem(OWNER)||'null')?.token===this.token)localStorage.removeItem(OWNER);}catch{}if(this.events){document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pagehide',this.leave);window.removeEventListener('storage',this.storage);this.events=false;}this.setState('idle');}
}
