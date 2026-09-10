import type {VoiceSettings} from './types';

class Voice {
  settings:VoiceSettings={engine:'system',voiceURI:'',kokoroVoice:'af_heart',speed:1,muted:false};
  onSpeaking:(value:boolean)=>void=()=>{};
  onNotice:(message:string)=>void=()=>{};
  private audio:HTMLAudioElement|null=null;
  private abort:AbortController|null=null;
  private generation=0;
  private token=Math.random().toString(36).slice(2);
  private initialized=false;
  private beat:ReturnType<typeof setInterval>|null=null;
  private analyser:AnalyserNode|null=null;
  private context:AudioContext|null=null;
  private objectURL:string|null=null;
  init(){
    if(this.initialized)return;this.initialized=true;
    window.addEventListener('storage',e=>{if(e.key==='argus.student.stop'||e.key==='argus.student.speaker'&&e.newValue?.split(':')[0]!==this.token)this.stop(false);});
    window.addEventListener('pagehide',()=>this.stop(false));
  }
  stop(broadcast=true){this.generation++;this.abort?.abort();this.abort=null;this.audio?.pause();this.audio=null;if(this.objectURL)URL.revokeObjectURL(this.objectURL);this.objectURL=null;window.speechSynthesis?.cancel();this.onSpeaking(false);if(this.beat)clearInterval(this.beat);this.beat=null;this.context?.close().catch(()=>{});this.context=null;this.analyser=null;if(broadcast)try{localStorage.setItem('argus.student.stop',String(Date.now()));}catch{}}
  getLevel=()=>{if(!this.analyser)return null;const data=new Uint8Array(this.analyser.fftSize);this.analyser.getByteTimeDomainData(data);return Math.sqrt(data.reduce((s,x)=>s+((x-128)/128)**2,0)/data.length);};
  async speak(text:string,ambient=false){
    if(this.settings.muted||!text.trim())return;
    try{const lead=localStorage.getItem('argus.student.speaker')?.split(':');if(ambient&&lead&&lead[0]!==this.token&&Date.now()-Number(lead[1])<5000)return;}catch{}
    this.stop(false);const generation=this.generation;const claim=()=>{try{localStorage.setItem('argus.student.speaker',`${this.token}:${Date.now()}`);}catch{}};claim();this.beat=setInterval(claim,2000);
    const finish=()=>{if(generation!==this.generation)return;this.onSpeaking(false);if(this.beat)clearInterval(this.beat);this.beat=null;};
    text=text.replace(/https?:\/\/\S+/g,'').replace(/[#*_`]/g,'').slice(0,1800);
    if(this.settings.engine==='kokoro'){
      try {
        this.abort=new AbortController();const r=await fetch('/api/voice/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice:this.settings.kokoroVoice,speed:this.settings.speed}),signal:this.abort.signal});if(!r.ok)throw new Error('Local speech unavailable');const blob=await r.blob();if(generation!==this.generation)return;
        const url=URL.createObjectURL(blob),a=new Audio(url);this.objectURL=url;this.audio=a;this.context=new AudioContext();this.analyser=this.context.createAnalyser();const source=this.context.createMediaElementSource(a);source.connect(this.analyser);this.analyser.connect(this.context.destination);
        a.onended=()=>{URL.revokeObjectURL(url);finish();};a.onerror=()=>{URL.revokeObjectURL(url);finish();};await a.play();this.onSpeaking(true);return;
      }catch(e){if(generation!==this.generation)return;this.onNotice('Local voice unavailable; using system speech.');}
    }
    if(!('speechSynthesis' in window)){finish();this.onNotice('Speech is unavailable on this device. Your response is shown as text.');return;}
    const u=new SpeechSynthesisUtterance(text);u.rate=this.settings.speed;const chosen=window.speechSynthesis.getVoices().find(v=>v.voiceURI===this.settings.voiceURI);if(chosen)u.voice=chosen;
    u.onstart=()=>this.onSpeaking(true);u.onend=finish;u.onerror=()=>{finish();this.onNotice('Tap Preview voice to enable speech, or continue using text.');};window.speechSynthesis.speak(u);
  }
}
export const voice=new Voice();
