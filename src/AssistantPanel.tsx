import { useEffect, useRef, useState, type Ref } from 'react';
import { Icon } from './Icon';
import { demoReply, GUIDE_STEPS, readPreferences, type Motion, type Preferences, type Section } from './preview';
import { PrivateAssignments } from './PrivateAssignments';
import { AssignmentSteps } from './AssignmentSteps';
import { request } from './bridge';
import type { useAccount } from './useAccount';
import type { Assignment, ConversationHeader } from './backend/contracts';

type SampleState = 'empty' | 'loading' | 'ready';
type Message = { id: number; role: 'user' | 'ohmi'; text: string; attachment?: boolean; language?: Preferences['language']; isAi?: boolean };

interface TutorialStepData {
  step: number;
  instruction: string;
  why: string;
  check: string;
  code?: string;
}

interface ActiveTutorial {
  id: string;
  title: string;
  steps: TutorialStepData[];
}

function renderMessageText(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const codeLines = part.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\r?\n/, '');
      return (
        <pre key={index} className="ohmi-code-block" style={{ background: 'rgba(0,0,0,0.06)', padding: '6px 8px', borderRadius: '4px', overflowX: 'auto', fontSize: '0.85em' }}>
          <code>{codeLines}</code>
        </pre>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
type Props = {
  imageUrl: string;
  preferences: Preferences;
  onPreferencesChange: (value: Preferences) => void;
  onMotion: (motion: Motion) => void;
  onClose: () => void;
  closeRef: Ref<HTMLButtonElement>;
  open: boolean;
  systemReducedMotion: boolean;
  preferenceError: boolean;
  account: ReturnType<typeof useAccount>;
};

const titles: Record<Section, string> = {
  home: 'Hey, circuit builder.', chat: 'Ask OHMI', assignments: 'Assignments',
  guide: 'Guide Me', check: 'Check My Circuit', settings: 'Settings',
};
const subtitles: Record<Section, string> = {
  home: 'Pick a place to start.', chat: 'Try a question in a local demo.', assignments: 'Turn a brief into a build plan.',
  guide: 'Sample guide: light your first LED.', check: 'Explore an illustrative circuit review.', settings: 'Make your little buddy feel at home.',
};
const shortcuts = [
  { section: 'chat', icon: 'chat', title: 'Ask OHMI', detail: 'Components, code, and little questions' },
  { section: 'assignments', icon: 'assignments', title: 'Assignments', detail: 'Explore a sample project brief' },
  { section: 'guide', icon: 'guide', title: 'Guide Me', detail: 'Practice one connection at a time' },
  { section: 'check', icon: 'check', title: 'Check My Circuit', detail: 'See sample troubleshooting notes' },
] as const;

function UploadPreview({ kind, state, onSample, onUnavailable }: { kind: 'assignment' | 'circuit'; state: SampleState; onSample: () => void; onUnavailable: () => void }) {
  return <div className="ohmi-upload" onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); onUnavailable(); }}>
    <span className="ohmi-upload-icon"><Icon name="upload" size={26} /></span>
    <strong>{kind === 'assignment' ? 'Your next circuit challenge' : 'Take a closer look at a circuit'}</strong>
    <p>{kind === 'assignment' ? 'PDF, PNG, or JPG assignment' : 'PNG or JPG circuit screenshot'}</p>
    <button type="button" className="ohmi-button ohmi-secondary" disabled>Analyze file — unavailable</button>
    <p>AI analysis is a demonstration. Save real files privately using Upload assignment in Your assignments.</p>
    <button type="button" className="ohmi-text-button" onClick={onUnavailable}>About sample analysis</button>
    <button type="button" className="ohmi-button ohmi-primary" onClick={onSample} disabled={state === 'loading'}>
      {state === 'loading' ? 'Loading saved example…' : kind === 'assignment' ? 'Use sample assignment' : 'Use sample circuit'}
    </button>
  </div>;
}

export function AssistantPanel({ imageUrl, preferences, onPreferencesChange, onMotion, onClose, closeRef, open, systemReducedMotion, preferenceError, account }: Props) {
  const [section, setSection] = useState<Section>('home');
  const [more, setMore] = useState(false);
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingReply, setPendingReply] = useState<Preferences['language'] | null>(null);
  const [assignment, setAssignment] = useState<SampleState>('empty');
  const [circuit, setCircuit] = useState<SampleState>('empty');
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [savedAssignment, setSavedAssignment] = useState<Assignment | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [activeTutorial, setActiveTutorial] = useState<ActiveTutorial | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialCompleted, setTutorialCompleted] = useState<number[]>([]);
  const [conversations, setConversations] = useState<ConversationHeader[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const lastUserId = useRef(account.state.user?.id);
  const messageId = useRef(0);
  const contentRef = useRef<HTMLElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const firstMoreRef = useRef<HTMLButtonElement>(null);
  const previousSection = useRef(section);

  const navigate = (next: Section) => {
    setSection(next);
    setMore(false);
    setNotice('');
  };

  useEffect(() => {
    if (previousSection.current !== section) {
      contentRef.current?.focus({ preventScroll: true });
      if (contentRef.current) contentRef.current.scrollTop = 0;
      previousSection.current = section;
    }
  }, [section]);

  useEffect(() => { if (more) firstMoreRef.current?.focus(); }, [more]);
  useEffect(() => { if (!open) setMore(false); }, [open]);

  useEffect(() => {
    if (assignment !== 'loading') return;
    const timer = window.setTimeout(() => { setAssignment('ready'); onMotion('happy'); }, 600);
    return () => window.clearTimeout(timer);
  }, [assignment, onMotion]);

  useEffect(() => {
    if (circuit !== 'loading') return;
    const timer = window.setTimeout(() => { setCircuit('ready'); onMotion('happy'); }, 600);
    return () => window.clearTimeout(timer);
  }, [circuit, onMotion]);

  useEffect(() => {
    if (section === 'chat' && chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [messages, pendingReply, section]);

  useEffect(() => {
    if (lastUserId.current !== account.state.user?.id) {
      lastUserId.current = account.state.user?.id;
      setMessages([]);
      setDraft('');
      setAttached(false);
      setNotice('');
      setCurrentConversationId(null);
      setSavedAssignment(null);
      setActiveTutorial(null);
      setConversations([]);
      setShowHistory(false);
    }
  }, [account.state.user?.id]);

  const loadConversations = async () => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId) return;
    try {
      const list = await request<ConversationHeader[]>('conversations.list', { accountId: currentUserId });
      setConversations(list || []);
      setShowHistory(true);
    } catch {
      setNotice('Could not load conversation history.');
    }
  };

  const openConversation = async (conv: ConversationHeader) => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId) return;
    try {
      const res = await request<{ conversation: ConversationHeader; messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; structured_result?: any }> }>('conversations.open', {
        id: conv.id,
        accountId: currentUserId
      });
      if (res?.messages) {
        setMessages(res.messages.map((m) => ({
          id: ++messageId.current,
          role: m.role === 'user' ? 'user' : 'ohmi',
          text: m.content,
          isAi: true
        })));
        setCurrentConversationId(conv.id);
        setShowHistory(false);
      }
    } catch {
      setNotice('Could not open conversation.');
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || pendingReply !== null) return;
    const currentUserId = account.state.user?.id;
    setMessages((current) => [...current, { id: ++messageId.current, role: 'user', text, attachment: attached }]);
    setDraft('');
    setAttached(false);
    setNotice('');
    setPendingReply(preferences.language);
    onMotion('thinking');

    if (!currentUserId || attached) {
      window.setTimeout(() => {
        setMessages((current) => [...current, { id: ++messageId.current, role: 'ohmi', text: demoReply(preferences.language), language: preferences.language, isAi: false }]);
        setPendingReply(null);
        onMotion('happy');
      }, 650);
      return;
    }

    try {
      let convId = currentConversationId;
      if (!convId) {
        try {
          const newConv = await request<ConversationHeader>('conversations.create', {
            accountId: currentUserId,
            title: text.slice(0, 100)
          });
          if (newConv?.id) {
            convId = newConv.id;
            setCurrentConversationId(convId);
          }
        } catch { /* proceed unlinked if create fails */ }
      }

      const chatContext = messages.slice(-4).map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        text: m.text
      }));

      const res = await request('ai.chat', {
        accountId: currentUserId,
        requestId: crypto.randomUUID(),
        message: text,
        language: preferences.language,
        context: chatContext,
        ...(convId ? { conversationId: convId } : {})
      }) as { ok?: boolean; result?: { answer?: string } } | null;

      if (account.state.user?.id !== currentUserId) return;

      const answer = res?.result?.answer;
      if (answer) {
        setMessages((current) => [...current, { id: ++messageId.current, role: 'ohmi', text: answer, language: preferences.language, isAi: true }]);
        onMotion('happy');
      } else {
        setNotice('No answer received from AI tutor.');
      }
    } catch (err: unknown) {
      if (account.state.user?.id !== currentUserId) return;
      const errMsg = err instanceof Error ? err.message : 'AI request failed.';
      setNotice(errMsg);
      onMotion('idle');
    } finally {
      if (account.state.user?.id === currentUserId) {
        setPendingReply(null);
      }
    }
  };

  const analyzeAssignment = async (item: Assignment) => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId || pendingReply !== null) return;
    navigate('chat');
    setNotice('');
    setPendingReply(preferences.language);
    onMotion('thinking');
    const isImg = item.mime_type.startsWith('image/');
    const op = isImg ? 'image' : 'pdf';
    setMessages((curr) => [...curr, {
      id: ++messageId.current,
      role: 'user',
      text: `Analyze my saved ${isImg ? 'circuit screenshot' : 'assignment'}: ${item.original_name}`
    }]);

    try {
      const res = await request('ai.chat', {
        accountId: currentUserId,
        requestId: crypto.randomUUID(),
        operation: op,
        assignmentId: item.id,
        message: `Please inspect this ${isImg ? 'circuit screenshot' : 'electronics assignment'}. Identify visible components, connections, and any potential issues or uncertainties.`,
        language: preferences.language
      }) as { ok?: boolean; result?: { answer?: string } } | null;

      if (account.state.user?.id !== currentUserId) return;
      const answer = res?.result?.answer;
      if (answer) {
        setMessages((curr) => [...curr, {
          id: ++messageId.current,
          role: 'ohmi',
          text: answer,
          language: preferences.language,
          isAi: true
        }]);
        onMotion('happy');
      } else {
        setNotice('No analysis response received.');
        onMotion('idle');
      }
    } catch (err: unknown) {
      if (account.state.user?.id !== currentUserId) return;
      setNotice(err instanceof Error ? err.message : 'Analysis failed.');
      onMotion('idle');
    } finally {
      if (account.state.user?.id === currentUserId) setPendingReply(null);
    }
  };

  const openTutorialGuide = async (item: Assignment) => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId) return;
    setNotice('');
    try {
      const analyses = await request<any[]>('analyses.list', {
        accountId: currentUserId,
        assignmentId: item.id
      });
      const tutorialAnalysis = analyses?.find((a) => a.artifact_kind === 'tutorial' || (a.payload?.steps && a.payload.steps.length > 0));

      if (tutorialAnalysis) {
        const full = await request<any>('analyses.get', {
          accountId: currentUserId,
          id: tutorialAnalysis.id
        });
        const progress = await request<any>('progress.get', {
          accountId: currentUserId,
          analysisId: tutorialAnalysis.id
        });
        setActiveTutorial({
          id: tutorialAnalysis.id,
          title: full?.title || full?.payload?.title || item.original_name,
          steps: full?.payload?.steps || []
        });
        setTutorialStep(progress?.current_step || 0);
        setTutorialCompleted(progress?.completed || []);
        setSavedAssignment(null);
        navigate('guide');
      } else {
        setPendingReply(preferences.language);
        onMotion('thinking');
        const res = await request<any>('ai.chat', {
          accountId: currentUserId,
          requestId: crypto.randomUUID(),
          operation: 'tutorial',
          assignmentId: item.id,
          language: preferences.language,
          message: `Generate a step-by-step circuit assembly guide for ${item.original_name}.`
        });
        if (res?.result?.steps && res.result.steps.length > 0) {
          setActiveTutorial({
            id: res.resultId || res.requestId,
            title: res.result.title || item.original_name,
            steps: res.result.steps
          });
          setTutorialStep(0);
          setTutorialCompleted([]);
          setSavedAssignment(null);
          navigate('guide');
        } else {
          setNotice(res?.result?.notes || 'Could not generate tutorial for this assignment.');
        }
      }
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Failed to load tutorial guide.');
    } finally {
      setPendingReply(null);
    }
  };

  const unavailable = () => setNotice('AI analysis is not connected. Use a built-in sample here, or save real files privately in Assignments.');
  const currentStep = GUIDE_STEPS[step]!;
  const motionAvailable = preferences.animations && !systemReducedMotion;

  return <div className="ohmi-assistant" onKeyDown={(event) => {
    if (event.key === 'Escape' && more) {
      event.stopPropagation();
      setMore(false);
      moreRef.current?.focus();
    }
  }}>
    <header className="ohmi-panel-header">
      <div className="ohmi-brand">
        <span className="ohmi-brand-avatar"><img src={imageUrl} alt="" width={32} height={32} /></span>
        <div><h2 id="ohmi-title" translate="no">OHMI</h2><p>Your circuit buddy</p></div>
      </div>
      <div className="ohmi-header-actions">
        <button type="button" className="ohmi-icon-button" aria-label="Open Settings" title="Settings" onClick={() => navigate('settings')}><Icon name="settings" /></button>
        <button ref={closeRef} type="button" className="ohmi-icon-button ohmi-close" aria-label="Minimize OHMI" title="Minimize OHMI" onClick={onClose}><Icon name="close" /></button>
      </div>
    </header>

    <main key={section} ref={contentRef} tabIndex={-1} className="ohmi-panel-content" data-section={section} aria-label={titles[section]}>
      <div className={`ohmi-screen-heading${section === 'home' ? ' ohmi-welcome' : ''}`}>
        <div><h3>{section === 'guide' && savedAssignment ? 'Saved assignment steps' : titles[section]}</h3><p>{section === 'guide' && savedAssignment ? savedAssignment.original_name : subtitles[section]}</p></div>
        {section === 'home' && <img src={imageUrl} alt="" width={64} height={64} />}
      </div>
      {notice && <div className="ohmi-notice" role="alert"><Icon name="info" /><p>{notice}</p><button type="button" className="ohmi-icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}><Icon name="close" size={16} /></button></div>}

      {section === 'home' && <div className="ohmi-home-actions">
        {shortcuts.map((item) => <button key={item.section} type="button" className={`ohmi-feature${item.section === 'chat' ? ' ohmi-feature-primary' : ''}`} aria-label={item.title} onClick={() => navigate(item.section)}>
          <span className="ohmi-feature-icon"><Icon name={item.icon} /></span>
          <span className="ohmi-feature-copy"><strong>{item.title}</strong><span>{item.section === 'guide' && completed.length > 0 ? `${completed.length} of 5 sample steps done — continue` : item.detail}</span></span>
          <Icon name="next" size={16} />
        </button>)}
      </div>}

      {section === 'chat' && <div className="ohmi-chat-layout">
        {account.state.user && (
          <div className="ohmi-chat-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--ohmi-muted)' }}>
              {currentConversationId ? 'Active chat' : 'New chat'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="ohmi-text-button"
                style={{ fontSize: '11px' }}
                onClick={() => { setMessages([]); setCurrentConversationId(null); setShowHistory(false); }}
              >
                New conversation
              </button>
              <button
                type="button"
                className="ohmi-text-button"
                style={{ fontSize: '11px' }}
                onClick={() => { if (showHistory) setShowHistory(false); else void loadConversations(); }}
              >
                {showHistory ? 'Close history' : 'History'}
              </button>
            </div>
          </div>
        )}
        {showHistory && (
          <div className="ohmi-conversation-history" style={{ padding: '8px', background: 'var(--ohmi-tint)', borderRadius: '10px', marginBottom: '8px', maxHeight: '140px', overflowY: 'auto' }}>
            <strong style={{ fontSize: '12px' }}>Past conversations</strong>
            {conversations.length === 0 ? (
              <p className="ohmi-muted" style={{ fontSize: '11px', margin: '4px 0 0' }}>No saved conversations yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                {conversations.map((c) => (
                  <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--ohmi-border)' }}>
                    <button
                      type="button"
                      className="ohmi-text-button"
                      style={{ fontSize: '11px', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}
                      onClick={() => void openConversation(c)}
                    >
                      {c.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div ref={chatLogRef} className="ohmi-chat-log" role="log" aria-label="Local demo conversation" aria-live="polite" tabIndex={0}>
          {messages.length === 0 && <div className="ohmi-chat-start"><span className="ohmi-feature-icon"><Icon name="chat" /></span><p>What’s puzzling you? Try a question about the sample LED circuit.</p></div>}
          {messages.map((message) => <div key={message.id} className={`ohmi-message ohmi-message-${message.role}`}>
            <span className="ohmi-message-label">{message.role === 'user' ? 'You' : message.isAi ? 'OHMI' : 'Fixed sample reply'}</span>
            <div lang={message.language === 'filipino' ? 'fil' : message.language === 'english' ? 'en' : undefined}>{renderMessageText(message.text)}</div>
            {message.attachment && <span className="ohmi-file-chip"><Icon name="assignments" size={14} />led-lab.pdf (sample)</span>}
          </div>)}
          {pendingReply !== null && <p className="ohmi-loading" role="status"><span className="ohmi-loading-dot" />Loading a sample reply…</p>}
        </div>
        {messages.length === 0 && <button type="button" className="ohmi-suggestion" onClick={() => { setDraft('What does a resistor do?'); inputRef.current?.focus(); }}>What does a resistor do?</button>}
        <form className="ohmi-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <label htmlFor="ohmi-question" className="ohmi-sr-only">Your demo question</label>
          {attached && <div className="ohmi-file-chip"><Icon name="assignments" size={16} /><span>led-lab.pdf (sample)</span><button type="button" className="ohmi-icon-button" aria-label="Remove sample attachment" onClick={() => setAttached(false)}><Icon name="close" size={14} /></button></div>}
          <textarea ref={inputRef} id="ohmi-question" name="question" autoComplete="off" rows={2} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about a component or concept…" aria-describedby="ohmi-chat-help" onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
          }} />
          <div className="ohmi-compose-actions"><button type="button" className="ohmi-icon-button" aria-label="Use sample attachment" title="Attach the built-in sample; real files unavailable" onClick={() => setAttached(true)} disabled={attached}><Icon name="attachment" /></button><span>Local demo</span><button type="submit" className="ohmi-button ohmi-primary" disabled={!draft.trim() || pendingReply !== null}><Icon name="send" size={16} />Send demo</button></div>
          <p id="ohmi-chat-help">Fixed sample replies. Real file attachments are unavailable.</p>
        </form>
      </div>}

      {section === 'assignments' && <>
        <PrivateAssignments {...account} refresh={account.refresh} onAnalyze={analyzeAssignment} onGuide={(item) => { setSavedAssignment(item); setActiveTutorial(null); navigate('guide'); }} onTutorial={openTutorialGuide} />
        <p className="ohmi-sample-divider">Local demonstration — separate from your saved files</p>
        {assignment !== 'ready' ? <UploadPreview kind="assignment" state={assignment} onUnavailable={unavailable} onSample={() => { setAssignment('loading'); setNotice(''); onMotion('thinking'); }} /> : <>
          <div className="ohmi-sample-file"><span className="ohmi-feature-icon"><Icon name="assignments" /></span><div><strong>led-lab.pdf</strong><p>Built-in sample assignment</p></div><button type="button" className="ohmi-icon-button" aria-label="Remove sample assignment" onClick={() => setAssignment('empty')}><Icon name="close" size={16} /></button></div>
          <div className="ohmi-result"><span className="ohmi-badge">Sample analysis</span><h4>Light your first LED</h4><p>Build a simple series circuit and explain how the resistor controls current.</p><h5>What you’ll need</h5><div className="ohmi-parts"><span>LED</span><span>220 Ω resistor</span><span>Breadboard</span><span>5 V source</span></div><h5>Your learning goals</h5><ul><li>Trace a complete current path.</li><li>Identify LED polarity.</li><li>Explain why the resistor matters.</li></ul><p className="ohmi-muted">This example is predefined. No PDF was read.</p></div>
          <button type="button" className="ohmi-button ohmi-primary ohmi-full-width" onClick={() => { setSavedAssignment(null); setActiveTutorial(null); navigate('guide'); }}><Icon name="guide" size={18} />Open sample guide</button>
        </>}
        {assignment === 'loading' && <p className="ohmi-loading" role="status">Loading the built-in assignment preview…</p>}
      </>}

      {section === 'guide' && savedAssignment && account.state.user && <AssignmentSteps key={account.state.user.id + savedAssignment.id} accountId={account.state.user.id} assignment={savedAssignment} onBack={() => navigate('assignments')} />}
      {section === 'guide' && !savedAssignment && activeTutorial && account.state.user && (
        <section className="ohmi-saved-steps" aria-label="Tutorial guide">
          <button type="button" className="ohmi-text-button" onClick={() => { setActiveTutorial(null); navigate('assignments'); }}>Back to assignments</button>
          <h4>{activeTutorial.title}</h4>
          <p className="ohmi-muted">AI-guided step-by-step assembly.</p>
          <div className="ohmi-guide-progress">
            <div>
              <span>{tutorialCompleted.length} of {activeTutorial.steps.length} steps done</span>
              <span>Step {tutorialStep + 1} of {activeTutorial.steps.length}</span>
            </div>
            <progress aria-label="Tutorial guide progress" value={tutorialCompleted.length} max={activeTutorial.steps.length} />
          </div>
          {activeTutorial.steps[tutorialStep] && (
            <div className="ohmi-guide-step">
              <span className="ohmi-step-number" aria-hidden="true">{tutorialStep + 1}</span>
              <h4>Step {tutorialStep + 1}</h4>
              <p>{activeTutorial.steps[tutorialStep].instruction}</p>
              <div style={{ marginTop: '8px' }}>
                <strong style={{ fontSize: '12px' }}>Why: </strong>
                <span style={{ fontSize: '13px' }}>{activeTutorial.steps[tutorialStep].why}</span>
              </div>
              <div className="ohmi-tip">
                <Icon name="spark" size={18} />
                <p><strong>Check: </strong>{activeTutorial.steps[tutorialStep].check}</p>
              </div>
              {activeTutorial.steps[tutorialStep].code && (
                <pre className="ohmi-code-block" style={{ background: 'rgba(0,0,0,0.06)', padding: '6px 8px', borderRadius: '4px', overflowX: 'auto', fontSize: '0.85em', marginTop: '8px' }}>
                  <code>{activeTutorial.steps[tutorialStep].code}</code>
                </pre>
              )}
            </div>
          )}
          <button
            type="button"
            className={`ohmi-button ohmi-full-width ${tutorialCompleted.includes(tutorialStep) ? 'ohmi-secondary' : 'ohmi-primary'}`}
            onClick={async () => {
              const nextCompleted = tutorialCompleted.includes(tutorialStep)
                ? tutorialCompleted.filter((i) => i !== tutorialStep)
                : [...tutorialCompleted, tutorialStep];
              setTutorialCompleted(nextCompleted);
              if (!tutorialCompleted.includes(tutorialStep)) onMotion('happy');
              if (account.state.user) {
                try {
                  await request('progress.save', {
                    accountId: account.state.user.id,
                    analysisId: activeTutorial.id,
                    currentStep: tutorialStep,
                    completed: nextCompleted
                  });
                } catch { /* non-blocking */ }
              }
            }}
          >
            <Icon name="done" size={18} />
            {tutorialCompleted.includes(tutorialStep) ? 'Undo completion' : 'Mark step done'}
          </button>
          <div className="ohmi-guide-nav">
            <button
              type="button"
              className="ohmi-button ohmi-secondary"
              disabled={tutorialStep === 0}
              onClick={() => setTutorialStep((current) => Math.max(0, current - 1))}
            >
              <Icon name="back" size={16} />Previous
            </button>
            <button
              type="button"
              className="ohmi-button ohmi-secondary"
              disabled={tutorialStep >= activeTutorial.steps.length - 1}
              onClick={() => setTutorialStep((current) => Math.min(activeTutorial.steps.length - 1, current + 1))}
            >
              Next step<Icon name="next" size={16} />
            </button>
          </div>
          {tutorialCompleted.length === activeTutorial.steps.length && (
            <div className="ohmi-success" role="status">
              <Icon name="done" />
              <p>Tutorial guide complete! You practiced each connection and verification step.</p>
            </div>
          )}
          <button type="button" className="ohmi-text-button" onClick={() => { setTutorialCompleted([]); setTutorialStep(0); }}>Restart tutorial guide</button>
        </section>
      )}
      {section === 'guide' && !savedAssignment && !activeTutorial && <>
        <div className="ohmi-guide-progress"><div><span>{completed.length} of 5 done</span><span>Step {step + 1} of 5</span></div><progress aria-label="Sample guide progress" value={completed.length} max={5} /></div>
        <div className="ohmi-guide-step"><span className="ohmi-step-number" aria-hidden="true">{step + 1}</span><h4>{currentStep.title}</h4><p>{currentStep.text}</p><div className="ohmi-tip"><Icon name="spark" size={18} /><p>{currentStep.tip}</p></div></div>
        <button type="button" className={`ohmi-button ohmi-full-width ${completed.includes(step) ? 'ohmi-secondary' : 'ohmi-primary'}`} onClick={() => {
          setCompleted((current) => current.includes(step) ? current.filter((index) => index !== step) : [...current, step]);
          if (!completed.includes(step)) onMotion('happy');
        }}><Icon name="done" size={18} />{completed.includes(step) ? 'Undo completion' : 'Mark step done'}</button>
        <div className="ohmi-guide-nav"><button type="button" className="ohmi-button ohmi-secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}><Icon name="back" size={16} />Previous</button><button type="button" className="ohmi-button ohmi-secondary" disabled={step === 4} onClick={() => setStep((current) => Math.min(4, current + 1))}>Next step<Icon name="next" size={16} /></button></div>
        {completed.length === 5 && <div className="ohmi-success" role="status"><Icon name="done" /><p>Sample guide complete. You practiced explaining each connection.</p></div>}
        <button type="button" className="ohmi-text-button" onClick={() => { setCompleted([]); setStep(0); }}>Restart sample guide</button>
      </>}

      {section === 'check' && <>
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.04)', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Tinkercad Screenshot Review</p>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--ohmi-muted)', lineHeight: 1.4 }}>
            Click the <strong>OHMI icon</strong> in your browser toolbar to capture your visible circuit, or open the review page to upload a screenshot.
          </p>
          <button
            type="button"
            className="ohmi-button ohmi-primary ohmi-full-width"
            onClick={() => { void request('circuit.open').catch((err: Error) => setNotice(err.message)); }}
          >
            Open Circuit Review
          </button>
        </div>
        {circuit !== 'ready' ? <UploadPreview kind="circuit" state={circuit} onUnavailable={unavailable} onSample={() => { setCircuit('loading'); setNotice(''); onMotion('thinking'); }} /> : <>
          <div className="ohmi-circuit-example" aria-label="Illustrative sample circuit"><div><span>5 V</span><span className="ohmi-example-wire" /><span>LED</span><span className="ohmi-example-wire" /><span>GND</span></div><p>Illustration only. No screenshot taken.</p></div>
          <div className="ohmi-result"><span className="ohmi-badge ohmi-warning-badge">Sample diagnostic notes</span><h4>Add a current-limiting resistor</h4><p>This illustrative circuit omits a series resistor. Choose one using the LED’s ratings and supply voltage.</p><h5>Also review</h5><ul><li>LED anode and cathode orientation.</li><li>Breadboard row connections.</li><li>Tinkercad simulation warnings.</li></ul><p className="ohmi-muted">No circuit was analyzed or electrically verified. These are predefined example notes.</p></div>
          <button type="button" className="ohmi-button ohmi-secondary ohmi-full-width" onClick={() => setCircuit('empty')}>Clear sample notes</button>
        </>}
        {circuit === 'loading' && <p className="ohmi-loading" role="status">Loading illustrative circuit notes…</p>}
      </>}

      {section === 'settings' && <div className="ohmi-settings">
        <div className="ohmi-setting"><h4>Account</h4><p>{account.loading ? 'Loading account…' : account.state.user ? account.state.user.email : 'Sign in for private assignments and saved progress.'}</p>{account.error && <p className="ohmi-notice" role="alert">{account.error}</p>}<button type="button" className="ohmi-button ohmi-secondary ohmi-full-width" onClick={() => { void request('account.open').catch((failure: Error) => setNotice(failure.message)); }}>{account.state.user ? 'Manage OHMI account' : 'Sign in to OHMI'}</button></div>
        <div className="ohmi-setting"><label htmlFor="ohmi-language">Explanation language</label><select id="ohmi-language" disabled={account.loading} value={preferences.language} onChange={(event) => onPreferencesChange(readPreferences({ ...preferences, language: event.target.value }))}><option value="english">English</option><option value="filipino">Filipino</option><option value="taglish">Taglish</option></select><p>Used by local sample replies. Interface labels stay in English.</p></div>
        <div className="ohmi-setting"><label htmlFor="ohmi-appearance">Appearance</label><select id="ohmi-appearance" value={preferences.appearance} onChange={(event) => onPreferencesChange(readPreferences({ ...preferences, appearance: event.target.value }))}><option value="light">Warm light</option><option value="dark">Deep teal</option></select></div>
        <div className="ohmi-setting"><label className="ohmi-motion-toggle" htmlFor="ohmi-animations"><span>Animate OHMI</span><input id="ohmi-animations" type="checkbox" checked={preferences.animations} onChange={(event) => onPreferencesChange({ ...preferences, animations: event.target.checked })} /></label><p>Gentle idle movement and brief reactions. Turn off anytime.</p>{systemReducedMotion && <p className="ohmi-preference-note">Your system requests reduced motion. OHMI stays still.</p>}</div>
        <div className="ohmi-setting"><h4>Preview a reaction</h4><div className="ohmi-motion-previews"><button type="button" className="ohmi-button ohmi-secondary" disabled={!motionAvailable} onClick={() => onMotion('happy')}>Happy</button><button type="button" className="ohmi-button ohmi-secondary" disabled={!motionAvailable} onClick={() => onMotion('thinking')}>Thinking</button><button type="button" className="ohmi-button ohmi-secondary" disabled={!motionAvailable} onClick={() => onMotion('idle')}>Idle</button></div></div>
        <p className="ohmi-muted">{account.state.user ? 'Language is saved to your account. Appearance and motion stay on this device.' : 'Preferences stay on this device until you sign in.'} Sample conversations and sample guide progress last for this page session.</p>
        {preferenceError && <p className="ohmi-notice" role="alert">Couldn’t save preferences. Change the setting again to retry.</p>}
      </div>}
    </main>

    {more && <div id="ohmi-more" className="ohmi-more" role="region" aria-label="More OHMI sections">
      <button ref={firstMoreRef} type="button" onClick={() => navigate('assignments')}><Icon name="assignments" />Assignments</button>
      <button type="button" onClick={() => navigate('check')}><Icon name="check" />Check My Circuit</button>
      <button type="button" onClick={() => navigate('settings')}><Icon name="settings" />Settings</button>
    </div>}
    <nav className="ohmi-nav" aria-label="OHMI navigation">
      <button type="button" aria-current={section === 'home' ? 'page' : undefined} aria-label="Home" onClick={() => navigate('home')}><Icon name="home" /><span>Home</span></button>
      <button type="button" aria-current={section === 'chat' ? 'page' : undefined} aria-label="Ask section" onClick={() => navigate('chat')}><Icon name="chat" /><span>Ask</span></button>
      <button type="button" aria-current={section === 'guide' ? 'page' : undefined} aria-label="Guide section" onClick={() => navigate('guide')}><Icon name="guide" /><span>Guide</span></button>
      <button ref={moreRef} type="button" aria-current={['assignments', 'check', 'settings'].includes(section) ? 'page' : undefined} aria-label="More sections" aria-expanded={more} aria-controls="ohmi-more" onClick={() => setMore((current) => !current)}><Icon name="more" /><span>More</span></button>
    </nav>
    <footer className="ohmi-preview-note"><span className={`ohmi-status-dot${pendingReply !== null || assignment === 'loading' || circuit === 'loading' ? ' ohmi-status-busy' : ''}`} /><span>{account.state.user ? 'Private account. AI features remain samples.' : 'Sign in for storage. AI features remain samples.'}</span></footer>
  </div>;
}
