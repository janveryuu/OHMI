import { useEffect, useRef, useState } from 'react';
import { request } from '../bridge';
import { Icon } from '../Icon';
import { AiText } from './AiText';
import type { AiMessage, Conversation } from './contracts';
import type { Motion } from '../preview';
export type ChatContext = { analysisId: string; stepIndex: number; question: string };

export function AiChat({accountId,context,onMotion,onGeneral}:{accountId:string;context?:ChatContext;onMotion:(motion:Motion)=>void;onGeneral?:()=>void}) {
  const [conversations,setConversations]=useState<Conversation[]>([]); const [selected,setSelected]=useState('');
  const [messages,setMessages]=useState<AiMessage[]>([]); const [draft,setDraft]=useState(context?.question??''); const [busy,setBusy]=useState(true); const [error,setError]=useState('');
  const [failed,setFailed]=useState<{message:string;requestId:string;conversationId:string}|null>(null);
  const sequence=useRef(0); const mounted=useRef(true); const log=useRef<HTMLDivElement>(null);
  const loadMessages=async(id:string)=>{const current=++sequence.current;const rows=await request<AiMessage[]>('ai.messages',{accountId,conversationId:id});if(mounted.current&&current===sequence.current)setMessages(rows);};
  const refresh=async()=>{const rows=await request<Conversation[]>('ai.conversations',{accountId});if(mounted.current)setConversations(rows);return rows;};
  useEffect(()=>{mounted.current=true;void refresh().then(async rows=>{const first=rows.find(row=>context?row.analysis_id===context.analysisId:row.analysis_id===null);if(first&&mounted.current){setSelected(first.id);await loadMessages(first.id);}}).catch(failure=>{if(mounted.current)setError(failure.message);}).finally(()=>{if(mounted.current)setBusy(false);});return()=>{mounted.current=false;sequence.current++;};},[accountId,context?.analysisId]);
  useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,busy]);
  const choose=async(id:string)=>{if(busy)return;setSelected(id);setMessages([]);setFailed(null);setError('');if(!id)return;setBusy(true);try{await loadMessages(id);}catch(failure){setError(failure instanceof Error?failure.message:'Could not load conversation.');}finally{setBusy(false);}};
  const send=async(retry=false)=>{
    const message=retry&&failed?failed.message:draft.trim(); if(!message||busy)return;
    setBusy(true);setError('');onMotion('thinking');
    let conversationId=retry&&failed?failed.conversationId:selected; let requestId=retry&&failed?failed.requestId:crypto.randomUUID();
    try{
      if(!conversationId){const created=await request<Conversation>('ai.conversation.create',{accountId,...(context?{analysisId:context.analysisId}:{})});conversationId=created.id;if(mounted.current)setSelected(created.id);}
      await request<AiMessage>('ai.chat',{accountId,conversationId,requestId,message,...(context?{stepIndex:context.stepIndex}:{})});
      if(!mounted.current)return;
      setDraft('');setFailed(null);await loadMessages(conversationId);await refresh();onMotion('happy');
    }catch(failure){if(!mounted.current)return;const code=(failure as {code?:string}).code;if(code==='AI_RETRY_NEW')requestId=crypto.randomUUID();setFailed(conversationId?{message,requestId,conversationId}:null);setError(failure instanceof Error?failure.message:'AI request failed. Retry.');}
    finally{if(mounted.current){setBusy(false);onMotion('idle');}}
  };
  const remove=async()=>{if(!selected||busy||!window.confirm('Delete this conversation and its messages?'))return;setBusy(true);try{await request('ai.conversation.delete',{accountId,conversationId:selected});setSelected('');setMessages([]);setFailed(null);await refresh();}catch(failure){setError(failure instanceof Error?failure.message:'Could not delete conversation.');}finally{setBusy(false);}};
  return <div className="ohmi-chat-layout">
    <div className="ohmi-ai-history"><label htmlFor="ohmi-conversation">Saved conversation</label><select id="ohmi-conversation" value={selected} disabled={busy} onChange={event=>{void choose(event.target.value);}}><option value="">New {context?'assignment ':''}conversation</option>{conversations.filter(row=>context?row.analysis_id===context.analysisId:row.analysis_id===null).map(row=><option key={row.id} value={row.id}>{row.title}</option>)}</select><div className="ohmi-file-actions"><button type="button" className="ohmi-text-button" disabled={busy} onClick={()=>{void choose('');}}>New conversation</button><button type="button" className="ohmi-text-button" disabled={busy||!selected} onClick={()=>{void remove();}}>Delete conversation</button></div></div>
    {context&&<p className="ohmi-muted">Assignment context · step {context.stepIndex+1}{onGeneral&&<> · <button type="button" className="ohmi-text-button" disabled={busy} onClick={onGeneral}>General chat</button></>}</p>}
    {error&&<div className="ohmi-notice" role="alert"><p>{error}</p>{failed?<button type="button" className="ohmi-text-button" disabled={busy} onClick={()=>{void send(true);}}>Retry AI request</button>:<button type="button" className="ohmi-text-button" disabled={busy} onClick={()=>{setError('');void refresh().catch(failure=>setError(failure.message));}}>Refresh history</button>}</div>}
    <div ref={log} className="ohmi-chat-log" role="log" aria-label="AI conversation" aria-live="polite" tabIndex={0}>{!messages.length&&!busy&&<div className="ohmi-chat-start"><span className="ohmi-feature-icon"><Icon name="chat"/></span><p>Ask about electronics, breadboards, or Arduino code.</p></div>}{messages.map(message=><div key={message.id} className={`ohmi-message ohmi-message-${message.role==='assistant'?'ohmi':'user'}`}><AiText text={message.content}/><span className="ohmi-message-meta">{message.role==='assistant'?'OHMI · AI':'You'}</span></div>)}{busy&&<p className="ohmi-loading" role="status">OHMI is working…</p>}</div>
    <form className="ohmi-composer" onSubmit={event=>{event.preventDefault();void send();}}><label className="ohmi-sr-only" htmlFor="ohmi-ai-message">Message OHMI</label><textarea id="ohmi-ai-message" rows={3} maxLength={6000} value={draft} placeholder="Ask a question or paste Arduino code…" disabled={busy} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}}}/><div className="ohmi-compose-actions"><span>Saved privately · Google/Groq processing</span><button type="submit" className="ohmi-button ohmi-primary" disabled={busy||!draft.trim()}><Icon name="send" size={16}/>Send to OHMI</button></div><p className="ohmi-muted">AI may be mistaken. Code suggestions are untested. No live circuit is inspected.</p></form>
  </div>;
}
