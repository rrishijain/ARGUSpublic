'use client';
import type {Appearance} from '@/lib/types';

export const defaultAppearance: Appearance = {theme:'light',textSize:'standard',density:'comfortable',city:'prominent'};
export default function AppearanceFields({value,onChange,accent,onAccent}:{value:Appearance;onChange:(value:Appearance)=>void;accent:string;onAccent:(value:string)=>void}) {
  return <div className="appearance-fields">
    <label className="student-field">Appearance<select value={value.theme} onChange={e=>onChange({...value,theme:e.target.value as Appearance['theme']})}><option value="light">DAYBREAK · light</option><option value="dark">Evening · dark</option><option value="system">Follow my device</option></select></label>
    <label className="student-field">Text size<select value={value.textSize} onChange={e=>onChange({...value,textSize:e.target.value as Appearance['textSize']})}><option value="standard">Standard</option><option value="large">Larger and easier to read</option></select></label>
    <label className="student-field">Information density<select value={value.density} onChange={e=>onChange({...value,density:e.target.value as Appearance['density']})}><option value="comfortable">Comfortable overview</option><option value="compact">Compact command centre</option></select></label>
    <label className="student-field">City<select value={value.city} onChange={e=>onChange({...value,city:e.target.value as Appearance['city']})}><option value="prominent">Keep it prominent</option><option value="subtle">A subtle backdrop</option><option value="still">Still illustration</option></select></label>
    <label className="student-field accent-picker">Your accent colour<input type="color" value={accent} onChange={e=>onAccent(e.target.value)}/><span>{accent}</span></label>
  </div>;
}
