export type StrandHealth = 'good'|'warn'|'bad'|'none';
export interface Strand {id:string;label:string;color:string;health:StrandHealth;stale:boolean;trend:number;activity:number;value:string;delta:number|null}
export interface CoreReadout {big:string;bigLabel:string;bigHealth:StrandHealth;sub:{label:string;value:string;health:StrandHealth}[]}
export function idleStrands():Strand[] {return [];}
