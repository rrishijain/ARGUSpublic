export const WORKFLOWS = [
  {id:'brief',label:'Brief Me',group:'Understand',description:'A source-backed overview and three useful next steps.',instruction:'Prepare a concise briefing around the user’s goals. Separate observed facts, uncertainties and suggested next steps.'},
  {id:'summarise',label:'Summarise Sources',group:'Understand',description:'Find the important ideas across your selected information.',instruction:'Summarise the supplied sources, highlight agreements and contradictions, and link each finding to its source ID.'},
  {id:'ask',label:'Ask My Knowledge',group:'Understand',description:'Ask a question grounded in your own information.',instruction:'Answer the question using the supplied sources. If the sources do not answer it, say so. Label general suggestions separately.'},
  {id:'plan',label:'Plan Today',group:'Create',description:'Turn your goals and tasks into a realistic daily plan.',instruction:'Draft a realistic plan for today based on the supplied goals and tasks. Do not claim to know calendar events or deadlines that were not supplied.'},
  {id:'draft',label:'Draft Content',group:'Create',description:'Turn verified knowledge into a useful first draft.',instruction:'Write the requested content as a draft. Use supported claims, preserve qualifications, and list the source IDs used. Do not invent testimonials, prices or results.'},
];
export const workflow = id => WORKFLOWS.find(w=>w.id===id);
export function routeText(text) {
  if(/^\s*(brief me|morning briefing|give me a briefing)[.!]?\s*$/i.test(text)) return 'brief';
  if(/^\s*(plan (my )?today|plan my day)[.!]?\s*$/i.test(text)) return 'plan';
  if(/^\s*summari[sz]e (my )?sources[.!]?\s*$/i.test(text)) return 'summarise';
  if(/^\s*(draft|write|create a draft)\b/i.test(text)) return 'draft';
  return 'ask';
}
