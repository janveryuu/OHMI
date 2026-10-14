import { useEffect,useState } from 'react';
import { request } from '../bridge';
export function AiUsage({accountId}:{accountId:string}) {
  const [usage,setUsage]=useState<{status:string;input_tokens:number|null;output_tokens:number|null}[]>([]);const [error,setError]=useState('');
  useEffect(()=>{let alive=true;void request<typeof usage>('ai.usage',{accountId}).then(value=>{if(alive)setUsage(value);}).catch(failure=>{if(alive)setError(failure.message);});return()=>{alive=false;};},[accountId]);
  return <div className="ohmi-setting"><h4>AI usage</h4>{error?<p className="ohmi-notice">{error}</p>:<p>{usage.length} of 30 daily requests used · {usage.reduce((sum,row)=>sum+(row.input_tokens??0)+(row.output_tokens??0),0).toLocaleString()} recorded tokens.</p>}<p className="ohmi-muted">Daily reset: 00:00 UTC. Six requests per minute; project budget also applies. Failed requests count toward limits.</p></div>;
}
