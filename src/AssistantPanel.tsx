import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { Icon } from './Icon';
import { demoReply, GUIDE_STEPS, readPreferences, type Motion, type Preferences, type Section } from './preview';
import { PrivateAssignments } from './PrivateAssignments';
import { AssignmentSteps } from './AssignmentSteps';
import { MessageContent } from './MessageContent';
import { request } from './bridge';
import type { useAccount } from './useAccount';
import type { Assignment, ConversationHeader } from './backend/contracts';

type SampleState = 'empty' | 'loading' | 'ready';
type Message = { id: number; role: 'user' | 'ohmi'; text: string; attachment?: boolean; language?: Preferences['language']; mode?: 'live' | 'sample'; isAi?: boolean };

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
  kind?: 'tutorial' | 'circuit_check';
  objective?: string;
  components?: Array<{ name: string; quantity: number | string; notes?: string }>;
  steps: TutorialStepData[];
  clarificationQuestions?: string[];
  notes?: string;
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
  chatExpanded?: boolean;
  onChatExpandedChange?: (value: boolean) => void;
};

const titles: Record<Section, string> = {
  home: 'Hey, circuit builder.', chat: 'Ask OHMI', assignments: 'Assignments',
  guide: 'Guide Me', check: 'Check My Circuit', settings: 'Settings', progress: 'Learning Progress',
};
const subtitles: Record<Section, string> = {
  home: 'Pick a place to start.', chat: 'Try a question in a local demo.', assignments: 'Turn a brief into a build plan.',
  guide: 'Sample guide: light your first LED.', check: 'Explore an illustrative circuit review.', settings: 'Make your little buddy feel at home.', progress: 'Review your completed steps and saved guides.',
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

export function AssistantPanel({ imageUrl, preferences, onPreferencesChange, onMotion, onClose, closeRef, open, systemReducedMotion, preferenceError, account, chatExpanded = false, onChatExpandedChange }: Props) {
  const [section, setSection] = useState<Section>('home');
  const [more, setMore] = useState(false);
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingReply, setPendingReply] = useState<'sample' | 'live' | null>(null);
  const [assignment, setAssignment] = useState<SampleState>('empty');
  const [circuit, setCircuit] = useState<SampleState>('empty');
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [savedAssignment, setSavedAssignment] = useState<Assignment | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [activeTutorial, setActiveTutorial] = useState<ActiveTutorial | null>(null);
  const [activeAssignmentForTutorial, setActiveAssignmentForTutorial] = useState<Assignment | null>(null);
  const [clarificationDraft, setClarificationDraft] = useState('');
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialCompleted, setTutorialCompleted] = useState<number[]>([]);
  const [confirmedComponents, setConfirmedComponents] = useState<Record<string, boolean>>({});
  const [conversations, setConversations] = useState<ConversationHeader[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [recentChecks, setRecentChecks] = useState<Array<{ id: string; title: string | null; created_at: string }>>([]);
  const [recentActivities, setRecentActivities] = useState<Array<{ id: string; title: string | null; artifact_kind: string; created_at: string; stepCount?: number; completedCount?: number }>>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const lastUserId = useRef(account.state.user?.id);
  const messageId = useRef(0);
  const contentRef = useRef<HTMLElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const firstMoreRef = useRef<HTMLButtonElement>(null);
  const previousSection = useRef(section);
  const scrollSnapshot = useRef<{ pinnedToBottom: boolean; messageId: string | null; offset: number; scrollTop: number } | null>(null);
  const justSent = useRef(false);
  const previousExpanded = useRef(chatExpanded);

  const captureScroll = useCallback(() => {
    const el = chatLogRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinnedToBottom = distanceToBottom <= 48;
    if (pinnedToBottom) {
      scrollSnapshot.current = { pinnedToBottom: true, messageId: null, offset: 0, scrollTop: el.scrollTop };
      return;
    }
    const messageNodes = el.querySelectorAll<HTMLElement>('[data-message-id]');
    let firstVisibleId: string | null = null;
    let offset = 0;
    const containerRect = el.getBoundingClientRect();
    for (const node of messageNodes) {
      const rect = node.getBoundingClientRect();
      if (rect.bottom >= containerRect.top) {
        firstVisibleId = node.getAttribute('data-message-id');
        offset = rect.top - containerRect.top;
        break;
      }
    }
    scrollSnapshot.current = {
      pinnedToBottom: false,
      messageId: firstVisibleId,
      offset,
      scrollTop: el.scrollTop,
    };
  }, []);

  const restoreScroll = useCallback(() => {
    const el = chatLogRef.current;
    const snapshot = scrollSnapshot.current;
    if (!el || !snapshot) return;
    if (snapshot.pinnedToBottom) {
      el.scrollTop = el.scrollHeight;
    } else if (snapshot.messageId) {
      const target = el.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(snapshot.messageId)}"]`);
      if (target) {
        const containerRect = el.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const currentRel = targetRect.top - containerRect.top;
        el.scrollTop += (currentRel - snapshot.offset);
      } else {
        el.scrollTop = snapshot.scrollTop;
      }
    } else {
      el.scrollTop = snapshot.scrollTop;
    }
  }, []);

  const toggleExpanded = () => {
    captureScroll();
    const selStart = inputRef.current?.selectionStart;
    const selEnd = inputRef.current?.selectionEnd;
    onChatExpandedChange?.(!chatExpanded);
    requestAnimationFrame(() => {
      if (inputRef.current && selStart !== null && selEnd !== null && selStart !== undefined && selEnd !== undefined) {
        inputRef.current.setSelectionRange(selStart, selEnd);
      }
    });
  };

  const navigate = (next: Section) => {
    if (next !== 'chat' && chatExpanded) onChatExpandedChange?.(false);
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
    if (section !== 'chat' || !chatLogRef.current) return;
    const el = chatLogRef.current;
    if (justSent.current) {
      el.scrollTop = el.scrollHeight;
      justSent.current = false;
    } else {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceToBottom <= 48) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages, pendingReply, section]);

  useLayoutEffect(() => {
    if (previousExpanded.current !== chatExpanded) {
      previousExpanded.current = chatExpanded;
      restoreScroll();
    }
  }, [chatExpanded, restoreScroll]);

  useEffect(() => {
    const el = chatLogRef.current;
    if (!el) return;
    let frameId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        if (scrollSnapshot.current?.pinnedToBottom) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

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
      setActiveAssignmentForTutorial(null);
      setClarificationDraft('');
      setConversations([]);
      setShowHistory(false);
      setRecentChecks([]);
      setRecentActivities([]);
      setConfirmedComponents({});
    }
  }, [account.state.user?.id]);

  const loadRecentChecks = async () => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId) return;
    try {
      const list = await request<any[]>('analyses.list', { accountId: currentUserId });
      if (Array.isArray(list)) {
        setRecentChecks(
          list
            .filter((a) => a.artifact_kind === 'circuit_check')
            .slice(0, 5)
            .map((a) => ({ id: a.id, title: a.title, created_at: a.created_at }))
        );
      }
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    if (section === 'check' && account.state.user?.id) {
      void loadRecentChecks();
    }
  }, [section, account.state.user?.id]);

  const loadRecentActivities = async () => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId) return;
    setLoadingActivities(true);
    try {
      const list = await request<any[]>('analyses.list', { accountId: currentUserId });
      if (Array.isArray(list)) {
        const filtered = list.filter((a) => a.artifact_kind === 'tutorial' || a.artifact_kind === 'circuit_check').slice(0, 8);
        const mapped = await Promise.all(
          filtered.map(async (item) => {
            try {
              const [prog, full] = await Promise.all([
                request<any>('progress.get', { accountId: currentUserId, analysisId: item.id }).catch(() => null),
                request<any>('analyses.get', { accountId: currentUserId, id: item.id }).catch(() => null)
              ]);
              const stepCount = full?.payload?.steps?.length || 0;
              const completedCount = Array.isArray(prog?.completed) ? prog.completed.length : 0;
              return {
                id: item.id,
                title: item.title || full?.title || (item.artifact_kind === 'tutorial' ? 'Assignment Tutorial' : 'Circuit Check'),
                artifact_kind: item.artifact_kind,
                created_at: item.created_at,
                stepCount,
                completedCount
              };
            } catch {
              return {
                id: item.id,
                title: item.title,
                artifact_kind: item.artifact_kind,
                created_at: item.created_at
              };
            }
          })
        );
        setRecentActivities(mapped);
      }
    } catch {
      // non-blocking
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (section === 'progress' && account.state.user?.id) {
      void loadRecentActivities();
    }
  }, [section, account.state.user?.id]);

  const loadSavedTutorial = async (analysisId: string) => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId) return;
    try {
      const full = await request<any>('analyses.get', { accountId: currentUserId, id: analysisId });
      const prog = await request<any>('progress.get', { accountId: currentUserId, analysisId });
      if (full?.payload?.steps && Array.isArray(full.payload.steps) && full.payload.steps.length > 0) {
        setActiveTutorial({
          id: full.id,
          title: full.title || full.payload.title || 'Tutorial Guide',
          kind: full.artifact_kind === 'circuit_check' ? 'circuit_check' : 'tutorial',
          objective: full.payload.objective,
          components: full.payload.components,
          steps: full.payload.steps,
          clarificationQuestions: full.payload.clarificationQuestions,
          notes: full.payload.notes
        });
        setTutorialStep(prog?.current_step || 0);
        setTutorialCompleted(Array.isArray(prog?.completed) ? prog.completed : []);
        setSavedAssignment(null);
        navigate('guide');
      } else {
        setNotice('No steps found for this activity.');
      }
    } catch (err: any) {
      setNotice(err.message || 'Could not load tutorial.');
    }
  };

  const followCheckSteps = async (checkId: string) => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId) return;
    try {
      const full = await request<any>('analyses.get', { accountId: currentUserId, id: checkId });
      const prog = await request<any>('progress.get', { accountId: currentUserId, analysisId: checkId });
      if (full?.payload?.steps && Array.isArray(full.payload.steps) && full.payload.steps.length > 0) {
        setActiveTutorial({
          id: full.id,
          title: full.title || 'Circuit Check Guidance',
          kind: 'circuit_check',
          steps: full.payload.steps,
          notes: full.payload.summary || 'Corrective steps from circuit review'
        });
        setTutorialStep(prog?.current_step || 0);
        setTutorialCompleted(Array.isArray(prog?.completed) ? prog.completed : []);
        setSavedAssignment(null);
        navigate('guide');
      } else {
        setNotice('This circuit check has no steps to follow.');
      }
    } catch (err: any) {
      setNotice(err.message || 'Could not load check steps.');
    }
  };

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
        justSent.current = true;
        setMessages(res.messages.map((m) => ({
          id: ++messageId.current,
          role: m.role === 'user' ? 'user' : 'ohmi',
          text: m.content,
          mode: 'live',
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
    const isDemo = !currentUserId || attached;
    justSent.current = true;
    setMessages((current) => [...current, { id: ++messageId.current, role: 'user', text, attachment: attached, mode: isDemo ? 'sample' : 'live' }]);
    setDraft('');
    setAttached(false);
    setNotice('');
    setPendingReply(isDemo ? 'sample' : 'live');
    onMotion('thinking');

    if (isDemo) {
      window.setTimeout(() => {
        setMessages((current) => [...current, { id: ++messageId.current, role: 'ohmi', text: demoReply(preferences.language), language: preferences.language, mode: 'sample', isAi: false }]);
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
        } catch {
          setDraft(text);
          setNotice('Could not start conversation session. Please retry.');
          setPendingReply(null);
          onMotion('idle');
          return;
        }
      }

      const chatContext = messages
        .filter((m) => m.mode !== 'sample')
        .slice(-8)
        .map((m) => ({
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
        setMessages((current) => [...current, { id: ++messageId.current, role: 'ohmi', text: answer, language: preferences.language, mode: 'live', isAi: true }]);
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
    setPendingReply('live');
    onMotion('thinking');
    const isImg = item.mime_type.startsWith('image/');
    const op = isImg ? 'image' : 'pdf';
    setMessages((curr) => [...curr, {
      id: ++messageId.current,
      role: 'user',
      text: `Analyze my saved ${isImg ? 'circuit screenshot' : 'assignment'}: ${item.original_name}`,
      mode: 'live'
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
          mode: 'live',
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

  const openTutorialGuide = async (item: Assignment, clarificationAnswer?: string) => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId) return;
    setNotice('');
    setActiveAssignmentForTutorial(item);
    try {
      const analyses = await request<any[]>('analyses.list', {
        accountId: currentUserId,
        assignmentId: item.id
      });
      const tutorialAnalysis = analyses?.find((a) => a.artifact_kind === 'tutorial');

      if (tutorialAnalysis && !clarificationAnswer) {
        const full = await request<any>('analyses.get', {
          accountId: currentUserId,
          id: tutorialAnalysis.id
        });
        const progress = await request<any>('progress.get', {
          accountId: currentUserId,
          analysisId: tutorialAnalysis.id
        });
        const payload = full?.payload || {};
        setActiveTutorial({
          id: tutorialAnalysis.id,
          title: full?.title || payload.title || item.original_name,
          kind: 'tutorial',
          objective: payload.objective,
          components: Array.isArray(payload.components) ? payload.components : [],
          steps: Array.isArray(payload.steps) ? payload.steps : [],
          clarificationQuestions: Array.isArray(payload.clarificationQuestions) ? payload.clarificationQuestions : undefined,
          notes: payload.notes
        });
        setTutorialStep(progress?.current_step || 0);
        setTutorialCompleted(Array.isArray(progress?.completed) ? progress.completed : []);
        setSavedAssignment(null);
        navigate('guide');
      } else {
        setPendingReply('live');
        onMotion('thinking');
        const userMsg = clarificationAnswer
          ? `Clarification answer: ${clarificationAnswer.slice(0, 1000)}`
          : `Generate a step-by-step circuit assembly guide for ${item.original_name}.`;
        const res = await request<any>('ai.chat', {
          accountId: currentUserId,
          requestId: crypto.randomUUID(),
          operation: 'tutorial',
          assignmentId: item.id,
          language: preferences.language,
          message: userMsg
        });
        if (res?.result?.steps && res.result.steps.length > 0) {
          setActiveTutorial({
            id: res.resultId || res.requestId,
            title: res.result.title || item.original_name,
            kind: 'tutorial',
            objective: res.result.objective,
            components: Array.isArray(res.result.components) ? res.result.components : [],
            steps: res.result.steps,
            notes: res.result.notes
          });
          setTutorialStep(0);
          setTutorialCompleted([]);
          setSavedAssignment(null);
          navigate('guide');
        } else if (res?.result?.status === 'needs_clarification' || (Array.isArray(res?.result?.clarificationQuestions) && res.result.clarificationQuestions.length > 0)) {
          setActiveTutorial({
            id: res.resultId || res.requestId,
            title: res.result.title || item.original_name,
            kind: 'tutorial',
            objective: res.result.objective,
            components: Array.isArray(res.result.components) ? res.result.components : [],
            steps: [],
            clarificationQuestions: res.result.clarificationQuestions || [],
            notes: res.result.notes || res.result.answer
          });
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
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      if (more) {
        event.stopPropagation();
        setMore(false);
        moreRef.current?.focus();
      } else if (chatExpanded && section === 'chat') {
        event.stopPropagation();
        onChatExpandedChange?.(false);
      }
    }
  }}>
    <header className="ohmi-panel-header">
      <div className="ohmi-brand">
        <span className="ohmi-brand-avatar"><img src={imageUrl} alt="" width={32} height={32} /></span>
        <div><h2 id="ohmi-title" translate="no">OHMI</h2><p>Your circuit buddy</p></div>
      </div>
      <div className="ohmi-header-actions">
        {section === 'chat' && (
          <button
            type="button"
            className="ohmi-icon-button"
            aria-label={chatExpanded ? 'Restore chat size' : 'Expand chat'}
            title={chatExpanded ? 'Restore chat size' : 'Expand chat'}
            aria-expanded={chatExpanded}
            aria-controls="ohmi-panel"
            onClick={toggleExpanded}
          >
            <Icon name={chatExpanded ? 'restore' : 'expand'} />
          </button>
        )}
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
        <div ref={chatLogRef} className="ohmi-chat-log" role="log" aria-label={account.state.user && !attached ? "OHMI conversation" : "Local demo conversation"} aria-live="polite" tabIndex={0}>
          {messages.length === 0 && <div className="ohmi-chat-start"><span className="ohmi-feature-icon"><Icon name="chat" /></span><p>{account.state.user ? 'Ask OHMI anything about components, circuits, or Arduino code.' : 'What’s puzzling you? Try a question about the sample LED circuit.'}</p></div>}
          {messages.map((message) => <div key={message.id} data-message-id={message.id} className={`ohmi-message ohmi-message-${message.role}`}>
            <span className="ohmi-message-label">{message.role === 'user' ? 'You' : message.mode === 'live' || message.isAi ? 'OHMI' : 'Fixed sample reply'}</span>
            <div lang={message.language === 'filipino' ? 'fil' : message.language === 'english' ? 'en' : undefined}><MessageContent content={message.text} /></div>
            {message.attachment && <span className="ohmi-file-chip"><Icon name="assignments" size={14} />led-lab.pdf (sample)</span>}
          </div>)}
          {pendingReply !== null && <p className="ohmi-loading" role="status"><span className="ohmi-loading-dot" />{pendingReply === 'live' ? 'OHMI is thinking…' : 'Loading a sample reply…'}</p>}
        </div>
        {messages.length === 0 && <button type="button" className="ohmi-suggestion" onClick={() => { setDraft('What does a resistor do?'); inputRef.current?.focus(); }}>What does a resistor do?</button>}
        <form className="ohmi-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <label htmlFor="ohmi-question" className="ohmi-sr-only">Your demo question</label>
          {attached && <div className="ohmi-file-chip"><Icon name="assignments" size={16} /><span>led-lab.pdf (sample)</span><button type="button" className="ohmi-icon-button" aria-label="Remove sample attachment" onClick={() => setAttached(false)}><Icon name="close" size={14} /></button></div>}
          <textarea ref={inputRef} id="ohmi-question" name="question" autoComplete="off" rows={2} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about a component or concept…" aria-describedby="ohmi-chat-help" onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
          }} />
          <div className="ohmi-compose-actions">
            <button type="button" className="ohmi-icon-button" aria-label="Use sample attachment" title="Attach the built-in sample; real files unavailable" onClick={() => setAttached(true)} disabled={attached}><Icon name="attachment" /></button>
            <span>{account.state.user && !attached ? 'Ask OHMI' : 'Local demo'}</span>
            <button type="submit" className="ohmi-button ohmi-primary" disabled={!draft.trim() || pendingReply !== null}>
              <Icon name="send" size={16} />{account.state.user && !attached ? 'Send' : 'Send demo'}
            </button>
          </div>
          <p id="ohmi-chat-help">{attached ? 'Using sample attachment — local demo reply.' : account.state.user ? 'Ask OHMI about components, wiring, code, or concepts.' : 'Fixed sample replies. Sign in for private AI tutoring.'}</p>
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
          <button
            type="button"
            className="ohmi-text-button"
            onClick={() => {
              setActiveTutorial(null);
              if (activeTutorial.kind === 'circuit_check') {
                navigate('check');
              } else {
                navigate('assignments');
              }
            }}
          >
            {activeTutorial.kind === 'circuit_check' ? 'Back to circuit reviews' : 'Back to assignments'}
          </button>
          <h4>{activeTutorial.title}</h4>
          <p className="ohmi-muted">{activeTutorial.kind === 'circuit_check' ? 'Circuit corrective steps.' : 'AI-guided step-by-step assembly.'}</p>
          {activeTutorial.objective && (
            <p style={{ fontSize: '13px', margin: '4px 0 8px', fontStyle: 'italic', color: 'var(--ohmi-muted)' }}>
              {activeTutorial.objective}
            </p>
          )}

          {activeTutorial.components && activeTutorial.components.length > 0 && (
            <div className="ohmi-parts-list" style={{ margin: '8px 0 12px', padding: '8px 12px', background: 'var(--ohmi-tint)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '12px' }}>Required Components</strong>
                <span style={{ fontSize: '11px', color: 'var(--ohmi-muted)' }}>
                  {Object.values(confirmedComponents).filter(Boolean).length}/{activeTutorial.components.length} confirmed
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {activeTutorial.components.map((comp, idx) => {
                  const key = `${comp.name}-${idx}`;
                  const isChecked = !!confirmedComponents[key];
                  return (
                    <li key={idx} style={{ fontSize: '12px', padding: '3px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setConfirmedComponents((prev) => ({ ...prev, [key]: e.target.checked }))}
                          />
                          <span style={{ textDecoration: isChecked ? 'line-through' : 'none', color: isChecked ? 'var(--ohmi-muted)' : 'inherit' }}>
                            {comp.name} {comp.notes ? <span style={{ color: 'var(--ohmi-muted)', fontStyle: 'italic' }}>({comp.notes})</span> : null}
                          </span>
                        </span>
                        <span style={{ color: 'var(--ohmi-muted)', fontSize: '11px' }}>Qty: {comp.quantity}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {activeTutorial.clarificationQuestions && activeTutorial.clarificationQuestions.length > 0 && (
            <div className="ohmi-clarification-box" style={{ padding: '10px 12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', margin: '8px 0 12px' }}>
              <strong style={{ fontSize: '13px', color: '#b45309', display: 'block', marginBottom: '4px' }}>Clarification Needed</strong>
              <p style={{ fontSize: '12px', margin: '0 0 6px' }}>{activeTutorial.notes || 'Please provide additional details before assembling:'}</p>
              <ul style={{ paddingLeft: '18px', margin: '0 0 8px', fontSize: '12px' }}>
                {activeTutorial.clarificationQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Type your clarification (e.g. 5V supply, 20mA LED)..."
                  value={clarificationDraft}
                  onChange={(e) => setClarificationDraft(e.target.value)}
                  style={{ flex: 1, padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--ohmi-border)', background: 'var(--ohmi-card)' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && clarificationDraft.trim() && activeAssignmentForTutorial) {
                      e.preventDefault();
                      void openTutorialGuide(activeAssignmentForTutorial, clarificationDraft);
                      setClarificationDraft('');
                    }
                  }}
                />
                <button
                  type="button"
                  className="ohmi-button ohmi-primary"
                  disabled={!clarificationDraft.trim() || pendingReply !== null}
                  onClick={() => {
                    if (activeAssignmentForTutorial) {
                      void openTutorialGuide(activeAssignmentForTutorial, clarificationDraft);
                      setClarificationDraft('');
                    }
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {activeTutorial.steps.length > 0 && (
            <>
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
                  <div className="ohmi-step-instruction"><MessageContent content={activeTutorial.steps[tutorialStep].instruction} /></div>
                  <div style={{ marginTop: '8px' }}>
                    <strong style={{ fontSize: '12px' }}>Why: </strong>
                    <div style={{ fontSize: '13px', display: 'inline' }}><MessageContent content={activeTutorial.steps[tutorialStep].why} /></div>
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
              <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
                <button
                  type="button"
                  className="ohmi-button ohmi-secondary"
                  style={{ flex: 1, fontSize: '12px' }}
                  onClick={() => {
                    const curr = activeTutorial.steps[tutorialStep];
                    if (!curr) return;
                    setDraft(`Can you explain Step ${tutorialStep + 1} of "${activeTutorial.title}": "${curr.instruction}"? Why is this done?`);
                    navigate('chat');
                  }}
                >
                  Explain this step
                </button>
                <button
                  type="button"
                  className="ohmi-button ohmi-secondary"
                  style={{ flex: 1, fontSize: '12px' }}
                  onClick={() => {
                    const curr = activeTutorial.steps[tutorialStep];
                    if (!curr) return;
                    setDraft(`I tried Step ${tutorialStep + 1} of "${activeTutorial.title}": "${curr.instruction}", but it didn't work. The check was "${curr.check}". What should I check?`);
                    navigate('chat');
                  }}
                >
                  It didn't work
                </button>
              </div>
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
            </>
          )}
        </section>
      )}
      {section === 'guide' && !savedAssignment && !activeTutorial && <>
        {account.state.user && (account.state.assignments.length > 0 || recentChecks.length > 0) && (
          <div style={{ padding: '8px 12px', background: 'var(--ohmi-tint)', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
            <span style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>Choose Guide Work:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button
                type="button"
                className="ohmi-button ohmi-secondary"
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => navigate('assignments')}
              >
                From assignments ({account.state.assignments.length})
              </button>
              {recentChecks.length > 0 && (
                <button
                  type="button"
                  className="ohmi-button ohmi-secondary"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                  onClick={() => navigate('check')}
                >
                  Saved circuit checks ({recentChecks.length})
                </button>
              )}
              <button
                type="button"
                className="ohmi-button ohmi-secondary"
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => navigate('progress')}
              >
                Learning progress
              </button>
            </div>
          </div>
        )}
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
            Click the <strong>OHMI icon</strong> in your browser toolbar to capture your visible circuit, or open the review page to upload a screenshot. Opens your private review in an OHMI tab.
          </p>
          <button
            type="button"
            className="ohmi-button ohmi-primary ohmi-full-width"
            onClick={() => { void request('circuit.open').catch((err: Error) => setNotice(err.message)); }}
          >
            Open Circuit Review
          </button>
        </div>

        {account.state.user && recentChecks.length > 0 && (
          <div style={{ padding: '12px', background: 'var(--ohmi-tint)', borderRadius: '10px', marginBottom: '12px' }}>
            <strong style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>Saved Circuit Reviews</strong>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recentChecks.map((c) => (
                <li key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 0', borderBottom: '1px solid var(--ohmi-border)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{c.title || 'Circuit Check'}</span>
                  <span style={{ fontSize: '10px', color: 'var(--ohmi-muted)' }}>{new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString()}</span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                    <button
                      type="button"
                      className="ohmi-button ohmi-secondary"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => { void request('circuit.open', { analysisId: c.id }); }}
                    >
                      Open in tab
                    </button>
                    <button
                      type="button"
                      className="ohmi-button ohmi-secondary"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => void followCheckSteps(c.id)}
                    >
                      Follow in Guide
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="ohmi-sample-divider">Illustrative Example</p>
        {circuit !== 'ready' ? (
          <div style={{ padding: '12px', background: 'var(--ohmi-tint)', borderRadius: '8px', fontSize: '13px' }}>
            <strong style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Sample Diagnostic Notes</strong>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--ohmi-muted)', lineHeight: 1.4 }}>
              Explore an example of how OHMI highlights missing components and checks wiring connections.
            </p>
            <button
              type="button"
              className="ohmi-button ohmi-secondary ohmi-full-width"
              onClick={() => { setCircuit('loading'); setNotice(''); onMotion('thinking'); }}
              disabled={circuit === 'loading'}
            >
              {circuit === 'loading' ? 'Loading sample…' : 'Use sample circuit'}
            </button>
          </div>
        ) : <>
          <div className="ohmi-circuit-example" aria-label="Illustrative sample circuit"><div><span>5 V</span><span className="ohmi-example-wire" /><span>LED</span><span className="ohmi-example-wire" /><span>GND</span></div><p>Illustration only. No screenshot taken.</p></div>
          <div className="ohmi-result"><span className="ohmi-badge ohmi-warning-badge">Sample diagnostic notes</span><h4>Add a current-limiting resistor</h4><p>This illustrative circuit omits a series resistor. Choose one using the LED’s ratings and supply voltage.</p><h5>Also review</h5><ul><li>LED anode and cathode orientation.</li><li>Breadboard row connections.</li><li>Tinkercad simulation warnings.</li></ul><p className="ohmi-muted">No circuit was analyzed or electrically verified. These are predefined example notes.</p></div>
          <button type="button" className="ohmi-button ohmi-secondary ohmi-full-width" onClick={() => setCircuit('empty')}>Clear sample notes</button>
        </>}
        {circuit === 'loading' && <p className="ohmi-loading" role="status">Loading illustrative circuit notes…</p>}
      </>}

      {section === 'progress' && !account.state.user && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <h4>Track your builds</h4>
          <p style={{ fontSize: '13px', color: 'var(--ohmi-muted)', margin: '8px 0 16px' }}>
            Sign in to your OHMI account to save your progress, revisit completed steps, and track your builds.
          </p>
          <button
            type="button"
            className="ohmi-button ohmi-primary ohmi-full-width"
            onClick={() => { void request('account.open').catch((err: Error) => setNotice(err.message)); }}
          >
            Sign in to OHMI
          </button>
          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              className="ohmi-button ohmi-secondary ohmi-full-width"
              onClick={() => navigate('guide')}
            >
              Explore sample guide
            </button>
          </div>
        </div>
      )}

      {section === 'progress' && account.state.user && (
        <section className="ohmi-progress-section" aria-label="Learning progress">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0 }}>Recent Activity</h4>
            <button
              type="button"
              className="ohmi-text-button"
              disabled={loadingActivities}
              onClick={() => void loadRecentActivities()}
            >
              Refresh
            </button>
          </div>

          {loadingActivities && <p className="ohmi-loading" role="status">Loading your saved progress…</p>}

          {!loadingActivities && recentActivities.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--ohmi-muted)' }}>
                No saved activity yet. Practice a guide or run a circuit review to track your progress.
              </p>
              <button
                type="button"
                className="ohmi-button ohmi-primary"
                onClick={() => navigate('guide')}
              >
                Go to Guide Me
              </button>
            </div>
          )}

          {!loadingActivities && recentActivities.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentActivities.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--ohmi-card)',
                    border: '1px solid var(--ohmi-border)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '13px' }}>{item.title}</strong>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: item.artifact_kind === 'circuit_check' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: item.artifact_kind === 'circuit_check' ? '#2563eb' : '#059669',
                        fontWeight: 600
                      }}
                    >
                      {item.artifact_kind === 'circuit_check' ? 'Circuit Review' : 'Tutorial'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--ohmi-muted)' }}>
                      {item.stepCount !== undefined && item.stepCount > 0
                        ? `${item.completedCount ?? 0} of ${item.stepCount} steps completed`
                        : 'Not started'}
                    </span>
                    <button
                      type="button"
                      className="ohmi-button ohmi-secondary"
                      style={{ fontSize: '11px', padding: '2px 10px' }}
                      onClick={() => {
                        if (item.artifact_kind === 'circuit_check') {
                          void followCheckSteps(item.id);
                        } else {
                          void loadSavedTutorial(item.id);
                        }
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
      <button ref={firstMoreRef} type="button" onClick={() => navigate('progress')}><Icon name="progress" />Learning Progress</button>
      <button type="button" onClick={() => navigate('check')}><Icon name="check" />Check My Circuit</button>
      <button type="button" onClick={() => navigate('settings')}><Icon name="settings" />Settings</button>
    </div>}
    <nav className="ohmi-nav" aria-label="OHMI navigation">
      <button type="button" aria-current={['home', 'assignments'].includes(section) ? 'page' : undefined} aria-label="Home" onClick={() => navigate('home')}><Icon name="home" /><span>Home</span></button>
      <button type="button" aria-current={section === 'chat' ? 'page' : undefined} aria-label="Ask section" onClick={() => navigate('chat')}><Icon name="chat" /><span>Ask</span></button>
      <button type="button" aria-current={section === 'guide' ? 'page' : undefined} aria-label="Guide section" onClick={() => navigate('guide')}><Icon name="guide" /><span>Guide</span></button>
      <button ref={moreRef} type="button" aria-current={['progress', 'check', 'settings'].includes(section) ? 'page' : undefined} aria-label="More sections" aria-expanded={more} aria-controls="ohmi-more" onClick={() => setMore((current) => !current)}><Icon name="more" /><span>More</span></button>
    </nav>
    <footer className="ohmi-preview-note"><span className={`ohmi-status-dot${pendingReply !== null || assignment === 'loading' || circuit === 'loading' ? ' ohmi-status-busy' : ''}`} /><span>{account.state.user ? 'Private workspace. Ask questions, build circuits, and check reviews.' : 'Sign in for storage and saved progress. Sample mode active.'}</span></footer>
  </div>;
}
