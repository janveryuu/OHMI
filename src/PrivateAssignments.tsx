import { useState } from 'react';
import { request } from './bridge';
import { Icon } from './Icon';
import type { AccountState, Assignment } from './backend/contracts';
import type { SavedAnalysis } from './ai/contracts';

export function PrivateAssignments({ state, loading, error, refresh, onGuide, onUpload, onAiGuide }: { state: AccountState; loading: boolean; error: string; refresh: () => Promise<void>; onGuide?: (assignment: Assignment) => void; onUpload?: () => void; onAiGuide?: (id:string)=>void }) {
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [retry,setRetry]=useState<{assignmentId:string;requestId:string}|null>(null);
  const analyze=async(assignmentId:string,retrying=false)=>{
    if(busy||loading||!state.user)return;setBusy(assignmentId);setNotice('');
    const requestId=retrying&&retry?.assignmentId===assignmentId?retry.requestId:crypto.randomUUID();
    try{const result=await request<SavedAnalysis>('ai.analyze',{accountId:state.user.id,assignmentId,requestId});setRetry(null);onAiGuide?.(result.id);}
    catch(failure){setRetry({assignmentId,requestId:(failure as {code?:string}).code==='AI_RETRY_NEW'?crypto.randomUUID():requestId});setNotice(failure instanceof Error?failure.message:'Analysis failed. Retry.');}
    finally{setBusy('');}
  };
  const act = async (action: 'files.open' | 'files.delete', id: string) => {
    if (busy || loading) return;
    if (action === 'files.delete' && !window.confirm('Permanently delete this assignment file and its saved steps?')) return;
    setBusy(id); setNotice('');
    try { await request(action, { id, accountId: state.user?.id }); await refresh(); }
    catch (failure) { setNotice(failure instanceof Error ? failure.message : 'Action failed. Retry.'); }
    finally { setBusy(''); }
  };
  return <section className="ohmi-private" aria-label="Private assignments">
    <div className="ohmi-private-heading"><h4>Your assignments</h4><button type="button" className="ohmi-text-button" onClick={() => { void refresh(); }} disabled={loading || !!busy}>Refresh files</button></div>
    {loading && <p className="ohmi-loading" role="status">Loading your account…</p>}
    {(error || notice) && <p className="ohmi-notice" role="alert">{notice || error}</p>}
    {retry&&<button type="button" className="ohmi-text-button" disabled={loading||!!busy} onClick={()=>{void analyze(retry.assignmentId,true);}}>Retry assignment analysis</button>}
    {!state.configured && <p className="ohmi-muted">Account setup is not connected yet. Local samples remain available.</p>}
    {!state.user ? <><p className="ohmi-muted">Sign in to save private PDF, PNG, and JPG assignments.</p><button type="button" className="ohmi-button ohmi-primary ohmi-full-width" onClick={() => { void request('account.open').catch((failure: Error) => setNotice(failure.message)); }} disabled={!state.configured}>Sign in to OHMI</button></> : <>
      <p className="ohmi-muted">Private to your account. Up to 10 MiB per file.</p>
      <button type="button" className="ohmi-button ohmi-primary ohmi-full-width" onClick={() => { if (onUpload) onUpload(); else void request('account.open', { view: 'upload' }).catch((failure: Error) => setNotice(failure.message)); }} disabled={loading || !!busy}><Icon name="upload" size={18} />Upload assignment</button>
      {!loading && state.assignments.length === 0 && !error && <p className="ohmi-empty-copy">No saved assignments yet. Upload your first project brief.</p>}
      <ul className="ohmi-file-list">{state.assignments.map((assignment) => <li key={assignment.id}>
        <strong>{assignment.original_name}</strong><p className="ohmi-muted">{(assignment.size_bytes / 1024).toFixed(1)} KiB · {assignment.status === 'ready' ? 'Saved privately' : 'Incomplete upload — delete and retry'}</p>
        {onAiGuide&&assignment.status==='ready'&&<><button type="button" className="ohmi-button ohmi-secondary" disabled={loading||!!busy} onClick={()=>{void analyze(assignment.id);}}>{assignment.mime_type==='application/pdf'?'Analyze PDF with OHMI':'Analyze with Gemini'}</button><p className="ohmi-muted">{assignment.mime_type==='application/pdf'?'PDF text and relevant page images are prepared locally and sent to Groq. No raw PDF is sent to the AI provider. Saved analysis is reused.':'Sends this assignment to Google, or Groq for images if Gemini is unavailable. Google free-tier inputs may improve its products. Saved analysis is reused.'}</p></>}
        <div className="ohmi-file-actions"><button type="button" className="ohmi-button ohmi-secondary" disabled={loading || !!busy || assignment.status !== 'ready'} onClick={() => { void act('files.open', assignment.id); }}>Open file</button>{onGuide && <button type="button" className="ohmi-button ohmi-secondary" disabled={loading || !!busy || assignment.status !== 'ready'} onClick={() => onGuide(assignment)}>Saved steps</button>}<button type="button" className="ohmi-text-button" disabled={loading || !!busy} onClick={() => { void act('files.delete', assignment.id); }}>Delete</button></div>
        {busy === assignment.id && <p role="status" className="ohmi-loading">Working…</p>}
      </li>)}</ul>
    </>}
  </section>;
}
