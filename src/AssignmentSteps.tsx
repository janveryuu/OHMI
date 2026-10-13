import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './bridge';
import type { Assignment, AssignmentStep } from './backend/contracts';

export function AssignmentSteps({ assignment, accountId, onBack }: { assignment: Assignment; accountId: string; onBack: () => void }) {
  const [steps, setSteps] = useState<AssignmentStep[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    setBusy(true);
    try { const next = await request<AssignmentStep[]>('steps.list', { assignmentId: assignment.id, accountId }); if (current === sequence.current) { setSteps(next); setError(''); } }
    catch (failure) { if (current === sequence.current) setError(failure instanceof Error ? failure.message : 'Could not load steps.'); }
    finally { if (current === sequence.current) setBusy(false); }
  }, [assignment.id, accountId]);
  useEffect(() => { void refresh(); return () => { sequence.current++; }; }, [refresh]);
  const change = async (action: 'steps.add' | 'steps.update' | 'steps.delete', payload: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await request(action, { ...payload, accountId }); if (action === 'steps.add') setTitle(''); await refresh(); }
    catch (failure) { await refresh(); setError(failure instanceof Error ? failure.message : 'Could not save steps.'); }
  };
  const done = steps.filter((step) => step.completed).length;
  return <section className="ohmi-saved-steps" aria-label="Saved assignment steps">
    <button type="button" className="ohmi-text-button" onClick={onBack}>Back to assignments</button>
    <h4>{assignment.original_name}</h4><p className="ohmi-muted">Write your own steps. AI guidance is not connected yet.</p>
    {error && <div className="ohmi-notice" role="alert"><p>{error}</p><button type="button" className="ohmi-text-button" onClick={() => { void refresh(); }} disabled={busy}>Retry steps</button></div>}
    {busy && <p className="ohmi-loading" role="status">Updating saved steps…</p>}
    <div className="ohmi-guide-progress"><div><span>{done} of {steps.length} saved steps done</span></div><progress aria-label="Saved assignment progress" max={Math.max(1, steps.length)} value={done} /></div>
    <ul className="ohmi-step-list">{steps.map((step) => <li key={step.id}><label><input type="checkbox" checked={step.completed} disabled={busy} onChange={(event) => { const completed = event.target.checked; setSteps(current => current.map(item => item.id === step.id ? { ...item, completed } : item)); void change('steps.update', { id: step.id, completed }); }} /><span>{step.title}</span></label><button type="button" className="ohmi-text-button" disabled={busy} aria-label={`Delete step: ${step.title}`} onClick={() => { if (window.confirm('Delete this saved step?')) void change('steps.delete', { id: step.id }); }}>Delete</button></li>)}</ul>
    <form className="ohmi-step-form" onSubmit={(event) => { event.preventDefault(); void change('steps.add', { assignmentId: assignment.id, title }); }}><label htmlFor="ohmi-new-step">New assignment step</label><textarea id="ohmi-new-step" rows={2} maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Describe one action to complete…" /><button type="submit" className="ohmi-button ohmi-primary" disabled={busy || !title.trim()}>Add saved step</button></form>
  </section>;
}
