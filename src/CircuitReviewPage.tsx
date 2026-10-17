import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { request } from './bridge';
import { useAccount } from './useAccount';
import { Icon } from './Icon';
import type {
  CircuitCheckResult,
  CircuitFinding,
  CircuitComparison,
  CircuitStep,
  EvidenceReference,
  CircuitImageItem,
  CircuitResponseDataV2
} from './backend/contracts';

interface ImageItem {
  id: 'overview' | 'detail';
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  cropped?: boolean;
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PastCheckItem {
  id: string;
  title: string | null;
  created_at: string;
  artifact_kind: string;
}

export function CircuitReviewPage() {
  const account = useAccount();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showIntro, setShowIntro] = useState(false);

  // Images state
  const [overviewImage, setOverviewImage] = useState<ImageItem | null>(null);
  const [detailImage, setDetailImage] = useState<ImageItem | null>(null);
  const [activeCropId, setActiveCropId] = useState<'overview' | 'detail' | null>(null);
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, width: 100, height: 100 });
  const [fullImageConfirmed, setFullImageConfirmed] = useState(false);

  // Metadata & inputs
  const [captureTime, setCaptureTime] = useState<string | null>(null);
  const [documentGeneration, setDocumentGeneration] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [simulation, setSimulation] = useState('');
  const [board, setBoard] = useState<'unknown' | 'uno-r3'>('unknown');
  const [requirementText, setRequirementText] = useState('');

  // Assignments selection
  const [assignments, setAssignments] = useState<Array<{ id: string; original_name: string }>>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('none');
  const [requirementAnalyses, setRequirementAnalyses] = useState<Array<{ id: string; assignment_id: string; title: string; created_at: string }>>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('none');

  // AI Submission & Active Result state
  const [submitting, setSubmitting] = useState(false);
  const [activeResult, setActiveResult] = useState<CircuitCheckResult | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeResultTimestamp, setActiveResultTimestamp] = useState<string | null>(null);

  // Step-by-step guidance state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedStepIndices, setCompletedStepIndices] = useState<number[]>([]);

  // Code suggestion copy feedback
  const [codeCopied, setCodeCopied] = useState(false);

  // Follow-up query state
  const [followUpText, setFollowUpText] = useState('');
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  // History state
  const [pastChecks, setPastChecks] = useState<PastCheckItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // File input refs
  const overviewFileRef = useRef<HTMLInputElement>(null);
  const detailFileRef = useRef<HTMLInputElement>(null);
  const codeFileRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Check URL parameters and hash on load
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('intro') === '1' || window.location.hash.includes('capture-intro')) {
      setShowIntro(true);
    }

    const hash = window.location.hash;
    const captureMatch = hash.match(/capture=([0-9a-f-]+)/i);
    const analysisIdParam = searchParams.get('analysisId');
    const requestIdParam = searchParams.get('requestId');

    void (async () => {
      try {
        if (captureMatch) {
          const claimed = await request<{
            captureId: string;
            dataUrl: string;
            createdAt: number;
            documentGeneration: string;
          }>('capture.claim');

          if (claimed?.dataUrl) {
            await loadImageFromDataUrl('overview', claimed.dataUrl, claimed.createdAt, claimed.documentGeneration);
            setNotice('Circuit screenshot captured successfully. Crop to your circuit or use full image.');
          }
        } else if (analysisIdParam) {
          await loadCheckById(analysisIdParam);
        } else if (requestIdParam) {
          await restoreRequestById(requestIdParam);
        }
      } catch (err: any) {
        setError(err.message || 'Could not load requested circuit check.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch past checks & assignments when account signs in
  useEffect(() => {
    const userId = account.state.user?.id;
    if (userId) {
      void fetchPastChecks(userId);
      void fetchAssignments(userId);
    } else {
      setPastChecks([]);
      setAssignments([]);
    }
  }, [account.state.user?.id]);

  // Clear data on account change to protect privacy
  useEffect(() => {
    clearAllEvidence();
    setActiveResult(null);
    setActiveResultId(null);
    setActiveConversationId(null);
    setActiveRequestId(null);
  }, [account.state.user?.id]);

  const fetchPastChecks = async (userId: string) => {
    try {
      setLoadingHistory(true);
      const list = await request<any[]>('analyses.list', { accountId: userId });
      if (Array.isArray(list)) {
        const checks = list
          .filter((a) => a.artifact_kind === 'circuit_check')
          .map((a) => ({
            id: a.id,
            title: a.title || 'Circuit Check',
            created_at: a.created_at,
            artifact_kind: a.artifact_kind
          }));
        setPastChecks(checks);

        const reqs = list
          .filter((a) => a.artifact_kind === 'analysis')
          .map((a) => ({
            id: a.id,
            assignment_id: a.assignment_id,
            title: a.title || 'Requirement Analysis',
            created_at: a.created_at
          }));
        setRequirementAnalyses(reqs);
      }
    } catch {
      // non-blocking for page load
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedAssignmentId === 'none') {
      setSelectedAnalysisId('none');
    } else {
      const matching = requirementAnalyses.filter((a) => a.assignment_id === selectedAssignmentId);
      if (matching.length > 0 && matching[0]) {
        setSelectedAnalysisId(matching[0].id);
      } else {
        setSelectedAnalysisId('none');
      }
    }
  }, [selectedAssignmentId, requirementAnalyses]);

  const fetchAssignments = async (userId: string) => {
    try {
      const state = await request<any>('account.state');
      if (state?.assignments && Array.isArray(state.assignments)) {
        setAssignments(state.assignments.map((a: any) => ({
          id: a.id,
          original_name: a.original_name
        })));
      }
    } catch {
      // non-blocking
    }
  };

  const loadCheckById = async (id: string) => {
    const userId = account.state.user?.id;
    if (!userId) return;
    try {
      setNotice('Loading saved circuit check…');
      const analysis = await request<any>('analyses.get', { accountId: userId, id });
      if (analysis?.payload) {
        setActiveResult(analysis.payload as CircuitCheckResult);
        setActiveResultId(analysis.id);
        setActiveResultTimestamp(new Date(analysis.created_at).toLocaleTimeString());
        setCurrentStepIndex(0);

        // Load durable progress
        try {
          const prog = await request<any>('progress.get', { accountId: userId, analysisId: id });
          if (prog) {
            setCurrentStepIndex(prog.current_step || 0);
            setCompletedStepIndices(Array.isArray(prog.completed) ? prog.completed : []);
          }
        } catch {
          setCompletedStepIndices([]);
        }

        setNotice('Loaded saved circuit check.');
        setError('');
      }
    } catch (err: any) {
      setError(err.message || 'Could not load specified circuit check.');
    }
  };

  const restoreRequestById = async (requestId: string) => {
    const userId = account.state.user?.id;
    if (!userId) return;
    try {
      setNotice('Restoring circuit review status…');
      const reqState = await request<any>('ai.request.get', { accountId: userId, requestId });
      if (!reqState) {
        setError('No record found for this request.');
        return;
      }
      if (reqState.status === 'unavailable') {
        setError('This circuit check was deleted and is no longer available.');
        return;
      }
      if (reqState.status === 'completed' && reqState.result) {
        setActiveResult(reqState.result as CircuitCheckResult);
        setActiveResultId(reqState.resultId);
        setActiveRequestId(reqState.requestId);
        setActiveResultTimestamp(new Date(reqState.finishedAt || reqState.createdAt).toLocaleTimeString());
        setNotice('Restored completed circuit check.');
        setError('');
      } else if (reqState.status === 'pending') {
        setNotice('This circuit check is currently processing. Please check back in a few seconds.');
      } else if (reqState.status === 'failed') {
        setError('The requested circuit check failed. You may submit a new check.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to restore circuit request.');
    }
  };

  const loadImageFromDataUrl = (
    id: 'overview' | 'detail',
    dataUrl: string,
    timestamp?: number,
    docGen?: string
  ): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const approxSize = Math.round((dataUrl.length * 3) / 4);
        const item: ImageItem = {
          id,
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeBytes: approxSize,
          cropped: false,
        };
        if (id === 'overview') {
          setOverviewImage(item);
          setCaptureTime(timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString());
          if (docGen) setDocumentGeneration(docGen);
          setCropBox({ x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight });
        } else {
          setDetailImage(item);
        }
        setFullImageConfirmed(false);
        resolve();
      };
      img.onerror = () => {
        setError('Failed to load image format.');
        resolve();
      };
      img.src = dataUrl;
    });
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, id: 'overview' | 'detail') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setError('Please upload a PNG or JPEG screenshot.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Screenshot must be 4 MiB or less.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await loadImageFromDataUrl(id, dataUrl, Date.now());
      setNotice(`${id === 'overview' ? 'Overview' : 'Detail'} screenshot loaded. Crop or confirm to use.`);
      setError('');
    };
    reader.onerror = () => setError('Failed to read selected image file.');
    reader.readAsDataURL(file);
  };

  const handleCodeFileImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024) {
      setError('Code file is too large (maximum 8,000 characters).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const textContent = String(reader.result || '');
      if (textContent.length > 8000) {
        setError('Code exceeds 8,000 character limit.');
        return;
      }
      setCode(textContent);
      setNotice(`Imported Arduino code from "${file.name}" (${textContent.length} characters).`);
      setError('');
    };
    reader.onerror = () => setError('Failed to read code file.');
    reader.readAsText(file);
  };

  const applyCrop = (id: 'overview' | 'detail') => {
    const item = id === 'overview' ? overviewImage : detailImage;
    if (!item) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = Math.max(10, Math.min(cropBox.width, item.width - cropBox.x));
      const h = Math.max(10, Math.min(cropBox.height, item.height - cropBox.y));
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, cropBox.x, cropBox.y, w, h, 0, 0, w, h);
      const croppedDataUrl = canvas.toDataURL('image/png');
      const approxBytes = Math.round((croppedDataUrl.length * 3) / 4);

      const updated: ImageItem = {
        id,
        dataUrl: croppedDataUrl,
        width: w,
        height: h,
        sizeBytes: approxBytes,
        cropped: true,
      };

      if (id === 'overview') setOverviewImage(updated);
      else setDetailImage(updated);

      setActiveCropId(null);
      setNotice(`Applied crop (${w} × ${h} px).`);
    };
    img.src = item.dataUrl;
  };

  const clearAllEvidence = () => {
    setOverviewImage(null);
    setDetailImage(null);
    setActiveCropId(null);
    setCode('');
    setSimulation('');
    setRequirementText('');
    setSelectedAssignmentId('none');
    setFullImageConfirmed(false);
    setNotice('');
    setError('');
  };

  const handleSendCheck = async () => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId) {
      setError('Please sign in to OHMI before sending a circuit review.');
      return;
    }

    if (!overviewImage && !code.trim()) {
      setError('Provide at least a circuit screenshot or Arduino code.');
      return;
    }

    if (overviewImage && !overviewImage.cropped && !fullImageConfirmed) {
      setError('Please apply a crop to your screenshot or click "Use full image" to confirm.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('Submitting circuit for review…');

    try {
      const images: CircuitImageItem[] = [];
      if (overviewImage) {
        const rawBase64 = overviewImage.dataUrl.split(',')[1] || overviewImage.dataUrl;
        const mimeType = overviewImage.dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';
        images.push({
          id: 'overview',
          mimeType,
          data: rawBase64
        });
      }
      if (detailImage) {
        const rawBase64 = detailImage.dataUrl.split(',')[1] || detailImage.dataUrl;
        const mimeType = detailImage.dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';
        images.push({
          id: 'detail',
          mimeType,
          data: rawBase64
        });
      }

      const reqUuid = crypto.randomUUID();
      const language = account.state.profile?.language || 'english';

      const payload: any = {
        version: 2,
        operation: 'circuit_check',
        requestId: reqUuid,
        language,
        mode: 'check',
        message: 'Please review this circuit build, wiring connections, and code.',
        images,
        board,
        accountId: currentUserId
      };

      if (code.trim()) payload.code = code.trim();
      if (simulation.trim()) payload.simulation = simulation.trim();

      if (selectedAssignmentId !== 'none' && selectedAnalysisId !== 'none') {
        payload.assignmentId = selectedAssignmentId;
        payload.assignmentAnalysisId = selectedAnalysisId;
      } else if (requirementText.trim()) {
        payload.requirementText = requirementText.trim();
      }

      const response = await request<CircuitResponseDataV2>('ai.circuit', payload);

      if (response && response.ok && response.result) {
        setActiveResult(response.result);
        setActiveResultId(response.resultId);
        setActiveConversationId(response.conversationId || null);
        setActiveRequestId(response.requestId);
        setActiveResultTimestamp(new Date().toLocaleTimeString());
        setCurrentStepIndex(0);
        setCompletedStepIndices([]);
        setNotice('Circuit review completed.');
        setError('');

        // Refresh past checks list
        void fetchPastChecks(currentUserId);

        // Scroll to results
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        throw new Error('Circuit review failed to produce results.');
      }
    } catch (err: any) {
      setError(err.message || 'Circuit check failed. Please check connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFollowUp = async () => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId || !activeResultId) return;
    const text = followUpText.trim();
    if (!text) return;

    setFollowUpSubmitting(true);
    setError('');

    try {
      const reqUuid = crypto.randomUUID();
      const language = account.state.profile?.language || 'english';

      const payload: any = {
        version: 2,
        operation: 'circuit_check',
        requestId: reqUuid,
        language,
        mode: 'follow_up',
        message: text,
        images: [],
        board,
        previousCheckId: activeResultId,
        accountId: currentUserId,
        ...(activeConversationId ? { conversationId: activeConversationId } : {})
      };

      const response = await request<CircuitResponseDataV2>('ai.circuit', payload);
      if (response && response.ok && response.result) {
        setActiveResult(response.result);
        setActiveResultId(response.resultId);
        setActiveResultTimestamp(new Date().toLocaleTimeString());
        setFollowUpText('');
        setNotice('Follow-up review updated.');
      }
    } catch (err: any) {
      setError(err.message || 'Follow-up question failed.');
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  const handleStepDoneToggle = async (stepIdx: number) => {
    const nextCompleted = completedStepIndices.includes(stepIdx)
      ? completedStepIndices.filter((i) => i !== stepIdx)
      : [...completedStepIndices, stepIdx];
    setCompletedStepIndices(nextCompleted);

    const currentUserId = account.state.user?.id;
    if (currentUserId && activeResultId) {
      try {
        await request('progress.save', {
          accountId: currentUserId,
          analysisId: activeResultId,
          currentStep: currentStepIndex,
          completed: nextCompleted
        });
      } catch {
        // non-blocking
      }
    }
  };

  const handleStepNav = async (newStepIdx: number) => {
    setCurrentStepIndex(newStepIdx);
    const currentUserId = account.state.user?.id;
    if (currentUserId && activeResultId) {
      try {
        await request('progress.save', {
          accountId: currentUserId,
          analysisId: activeResultId,
          currentStep: newStepIdx,
          completed: completedStepIndices
        });
      } catch {
        // non-blocking
      }
    }
  };

  const handleDeleteCheck = async () => {
    const currentUserId = account.state.user?.id;
    if (!currentUserId || !activeResultId) return;

    if (!window.confirm('Are you sure you want to delete this circuit review? Saved guidance and progress will be removed.')) {
      return;
    }

    try {
      await request('analyses.delete', {
        accountId: currentUserId,
        id: activeResultId
      });
      setActiveResult(null);
      setActiveResultId(null);
      setActiveConversationId(null);
      setActiveRequestId(null);
      setNotice('Circuit check deleted.');
      void fetchPastChecks(currentUserId);
    } catch (err: any) {
      setError(err.message || 'Could not delete circuit check.');
    }
  };

  const handleCopyCode = (suggestedCode: string) => {
    navigator.clipboard.writeText(suggestedCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => {
      setError('Could not copy code to clipboard.');
    });
  };

  const renderEvidenceTag = (ref: EvidenceReference, idx: number) => {
    if (ref.kind === 'image') {
      return (
        <span key={idx} className="ohmi-badge" style={{ background: 'var(--ohmi-mint)', color: 'var(--ohmi-teal)', fontSize: '11px', marginRight: '6px' }}>
          📷 {ref.imageId === 'overview' ? 'Overview' : 'Detail'}: {ref.location}
        </span>
      );
    }
    if (ref.kind === 'code') {
      return (
        <span key={idx} className="ohmi-badge" style={{ background: '#f3e8ff', color: '#7e22ce', fontSize: '11px', marginRight: '6px' }}>
          💻 Code: L{ref.startLine}–L{ref.endLine}
        </span>
      );
    }
    if (ref.kind === 'requirement') {
      return (
        <span key={idx} className="ohmi-badge" style={{ background: 'var(--ohmi-gold)', color: 'var(--ohmi-on-gold)', fontSize: '11px', marginRight: '6px' }}>
          📋 Req: {ref.requirementId}
        </span>
      );
    }
    if (ref.kind === 'simulation') {
      return (
        <span key={idx} className="ohmi-badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: '11px', marginRight: '6px' }}>
          ⚡ Sim: "{ref.excerpt}"
        </span>
      );
    }
    if (ref.kind === 'prior_check') {
      return (
        <span key={idx} className="ohmi-badge" style={{ background: '#e2e8f0', color: '#334155', fontSize: '11px', marginRight: '6px' }}>
          🕒 Prior: {ref.findingId}
        </span>
      );
    }
    return null;
  };

  const combinedPixels = (overviewImage ? overviewImage.width * overviewImage.height : 0) +
    (detailImage ? detailImage.width * detailImage.height : 0);
  const combinedBytes = (overviewImage ? overviewImage.sizeBytes : 0) +
    (detailImage ? detailImage.sizeBytes : 0);

  const canSubmit = Boolean(
    account.state.user &&
    !submitting &&
    (
      (overviewImage && (overviewImage.cropped || fullImageConfirmed)) ||
      code.trim().length > 0
    )
  );

  return (
    <div className="ohmi-root ohmi-account-root" style={{ minHeight: '100vh', padding: '24px 16px' }}>
      <main className="ohmi-account-card" style={{ maxWidth: '780px' }}>
        <header className="ohmi-account-brand">
          <strong>OHMI</strong>
          <p>AI Circuit Checker</p>
          <span
            className="ohmi-badge"
            style={{
              marginLeft: 'auto',
              background: '#0d9488',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            Phase 5 · Circuit Checker
          </span>
        </header>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
          <h1>Review Tinkercad Circuit</h1>
          {account.state.user ? (
            <span style={{ fontSize: '12px', color: 'var(--ohmi-muted)' }}>
              Signed in as <strong>{account.state.user.email}</strong>
            </span>
          ) : (
            <button
              type="button"
              className="ohmi-text-button"
              onClick={() => { void request('account.open'); }}
              style={{ fontSize: '12px', color: 'var(--ohmi-teal)', fontWeight: 600 }}
            >
              Sign in to save reviews & progress →
            </button>
          )}
        </div>

        <p className="ohmi-muted" style={{ marginBottom: '16px' }}>
          Inspect breadboard wiring, check Arduino pin logic, compare assignment requirements, and get step-by-step guidance.
        </p>

        {pastChecks.length > 0 && (
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="ohmi-button ohmi-secondary"
              onClick={() => setShowHistory(!showHistory)}
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              {showHistory ? 'Hide review history' : `View past circuit reviews (${pastChecks.length})`}
            </button>
          </div>
        )}

        {showHistory && (
          <div
            role="region"
            aria-label="Past circuit reviews"
            style={{
              border: '1px solid var(--ohmi-border)',
              borderRadius: '12px',
              padding: '12px',
              background: 'var(--ohmi-card)',
              marginBottom: '20px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '13px' }}>Your Saved Circuit Reviews</h4>
            {loadingHistory ? (
              <p className="ohmi-muted">Loading history…</p>
            ) : pastChecks.length === 0 ? (
              <p className="ohmi-muted">No saved circuit reviews yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {pastChecks.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid var(--ohmi-border)',
                      fontSize: '12px'
                    }}
                  >
                    <div>
                      <strong>{item.title || 'Circuit Check'}</strong>
                      <span className="ohmi-muted" style={{ marginLeft: '8px' }}>
                        {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="ohmi-button ohmi-secondary"
                      onClick={() => void loadCheckById(item.id)}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {showIntro && (
          <div
            className="ohmi-tip"
            role="region"
            aria-label="Capture explanation"
            style={{
              background: 'rgba(13, 148, 136, 0.08)',
              border: '1px solid var(--ohmi-border)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '15px' }}>About Local Screenshot Capture</h4>
            <p style={{ fontSize: '13px', lineHeight: 1.5, margin: '0 0 10px' }}>
              When you click the OHMI extension toolbar icon in Chrome while viewing a Tinkercad Circuits tab, OHMI captures only the visible canvas locally.
              The screenshot is stored only in your browser memory for review and cropping. No circuit data is sent until you explicitly confirm and click Send.
            </p>
            <button
              type="button"
              className="ohmi-button ohmi-secondary"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => setShowIntro(false)}
            >
              Got it, continue to review
            </button>
          </div>
        )}

        {notice && <p className="ohmi-notice" role="status" style={{ marginBottom: '16px' }}>{notice}</p>}
        {error && <p className="ohmi-notice" role="alert" style={{ background: '#fee2e2', borderColor: '#f87171', color: '#991b1b', marginBottom: '16px' }}>{error}</p>}

        {/* Section 1: Visual Evidence (Overview & Detail Screenshots) */}
        <section aria-labelledby="heading-visual-evidence" style={{ marginBottom: '24px' }}>
          <h2 id="heading-visual-evidence" style={{ fontSize: '18px', marginBottom: '12px' }}>
            1. Visual Circuit Evidence
          </h2>

          {!overviewImage ? (
            <div
              className="ohmi-upload"
              style={{
                border: '2px dashed var(--ohmi-border)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                background: 'var(--ohmi-card)',
              }}
            >
              <p style={{ margin: '0 0 12px', fontWeight: 600 }}>No circuit screenshot captured yet</p>
              <p style={{ fontSize: '13px', color: 'var(--ohmi-muted)', margin: '0 0 16px' }}>
                Click the <strong>OHMI extension icon</strong> in your Chrome toolbar while in the Tinkercad editor, or upload a screenshot directly.
              </p>
              <input
                ref={overviewFileRef}
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e, 'overview')}
              />
              <button
                type="button"
                className="ohmi-button ohmi-primary"
                onClick={() => overviewFileRef.current?.click()}
              >
                Upload screenshot (PNG / JPEG)
              </button>
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--ohmi-border)',
                borderRadius: '12px',
                padding: '16px',
                background: 'var(--ohmi-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>
                  Primary Overview {overviewImage.cropped ? '(Cropped)' : '(Full Capture)'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ohmi-muted)' }}>
                  {overviewImage.width} × {overviewImage.height} px · {Math.round(overviewImage.sizeBytes / 1024)} KiB
                  {captureTime ? ` · Captured at ${captureTime}` : ''}
                </span>
              </div>

              {/* Preview image */}
              <div
                style={{
                  maxHeight: '360px',
                  overflow: 'hidden',
                  borderRadius: '8px',
                  background: '#0f172a',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <img
                  src={overviewImage.dataUrl}
                  alt="Captured circuit preview"
                  style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain' }}
                />
              </div>

              {/* Crop controls */}
              {activeCropId === 'overview' ? (
                <div style={{ background: 'var(--ohmi-surface)', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>Crop Boundaries (Pixels)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px' }}>
                      X:
                      <input
                        type="number"
                        min="0"
                        max={overviewImage.width}
                        value={cropBox.x}
                        onChange={(e) => setCropBox({ ...cropBox, x: Math.max(0, parseInt(e.target.value) || 0) })}
                        style={{ width: '100%', padding: '4px', fontSize: '13px' }}
                      />
                    </label>
                    <label style={{ fontSize: '12px' }}>
                      Y:
                      <input
                        type="number"
                        min="0"
                        max={overviewImage.height}
                        value={cropBox.y}
                        onChange={(e) => setCropBox({ ...cropBox, y: Math.max(0, parseInt(e.target.value) || 0) })}
                        style={{ width: '100%', padding: '4px', fontSize: '13px' }}
                      />
                    </label>
                    <label style={{ fontSize: '12px' }}>
                      Width:
                      <input
                        type="number"
                        min="10"
                        max={overviewImage.width - cropBox.x}
                        value={cropBox.width}
                        onChange={(e) => setCropBox({ ...cropBox, width: Math.max(10, parseInt(e.target.value) || 10) })}
                        style={{ width: '100%', padding: '4px', fontSize: '13px' }}
                      />
                    </label>
                    <label style={{ fontSize: '12px' }}>
                      Height:
                      <input
                        type="number"
                        min="10"
                        max={overviewImage.height - cropBox.y}
                        value={cropBox.height}
                        onChange={(e) => setCropBox({ ...cropBox, height: Math.max(10, parseInt(e.target.value) || 10) })}
                        style={{ width: '100%', padding: '4px', fontSize: '13px' }}
                      />
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="ohmi-button ohmi-primary"
                      onClick={() => applyCrop('overview')}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      Apply Crop
                    </button>
                    <button
                      type="button"
                      className="ohmi-button ohmi-secondary"
                      onClick={() => setActiveCropId(null)}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      Cancel Crop
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    type="button"
                    className="ohmi-button ohmi-secondary"
                    onClick={() => {
                      setActiveCropId('overview');
                      setCropBox({ x: 0, y: 0, width: overviewImage.width, height: overviewImage.height });
                    }}
                    style={{ fontSize: '13px', padding: '6px 12px' }}
                  >
                    Crop image
                  </button>
                  {!fullImageConfirmed && !overviewImage.cropped && (
                    <button
                      type="button"
                      className="ohmi-button ohmi-secondary"
                      onClick={() => {
                        setFullImageConfirmed(true);
                        setNotice('Confirmed using full uncropped image.');
                      }}
                      style={{ fontSize: '13px', padding: '6px 12px' }}
                    >
                      Use full image
                    </button>
                  )}
                  <button
                    type="button"
                    className="ohmi-text-button"
                    onClick={() => {
                      setOverviewImage(null);
                      setFullImageConfirmed(false);
                    }}
                    style={{ fontSize: '13px', marginLeft: 'auto' }}
                  >
                    Discard screenshot
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Optional Detail Image */}
          {overviewImage && !detailImage && (
            <div style={{ marginTop: '12px' }}>
              <input
                ref={detailFileRef}
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e, 'detail')}
              />
              <button
                type="button"
                className="ohmi-button ohmi-secondary"
                onClick={() => detailFileRef.current?.click()}
                style={{ fontSize: '13px', padding: '6px 12px' }}
              >
                + Attach optional close-up detail (PNG / JPEG)
              </button>
            </div>
          )}

          {detailImage && (
            <div
              style={{
                marginTop: '12px',
                border: '1px solid var(--ohmi-border)',
                borderRadius: '12px',
                padding: '12px',
                background: 'var(--ohmi-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Secondary Detail Close-up</span>
                <button
                  type="button"
                  className="ohmi-text-button"
                  onClick={() => setDetailImage(null)}
                  style={{ fontSize: '12px' }}
                >
                  Remove detail
                </button>
              </div>
              <div style={{ maxHeight: '200px', overflow: 'hidden', borderRadius: '6px', textAlign: 'center' }}>
                <img
                  src={detailImage.dataUrl}
                  alt="Detail close-up preview"
                  style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
          )}

          {(overviewImage || detailImage) && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--ohmi-muted)' }}>
              Combined size: {Math.round(combinedBytes / 1024)} KiB / 4,096 KiB max · Combined pixels: {combinedPixels.toLocaleString()} / 4,000,000 max
            </div>
          )}
        </section>

        {/* Section 2: Code & Diagnostics */}
        <section aria-labelledby="heading-code-diagnostics" style={{ marginBottom: '24px' }}>
          <h2 id="heading-code-diagnostics" style={{ fontSize: '18px', marginBottom: '12px' }}>
            2. Arduino Code & Simulation Diagnostics (Optional)
          </h2>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label htmlFor="circuit-code-input" style={{ fontWeight: 600, fontSize: '14px' }}>
                Arduino Code (.ino / C++)
              </label>
              <input
                ref={codeFileRef}
                type="file"
                accept=".ino,.txt"
                style={{ display: 'none' }}
                onChange={handleCodeFileImport}
              />
              <button
                type="button"
                className="ohmi-text-button"
                onClick={() => codeFileRef.current?.click()}
                style={{ fontSize: '12px' }}
              >
                Import .ino / .txt file
              </button>
            </div>
            <textarea
              id="circuit-code-input"
              rows={6}
              maxLength={8000}
              placeholder="Paste your Arduino sketch code here, or leave empty if your circuit uses discrete components only..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--ohmi-border)',
                fontFamily: 'monospace',
                fontSize: '13px',
                background: 'var(--ohmi-card)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--ohmi-muted)' }}>
              <span>Pasted source only. OHMI never extracts or injects code into Tinkercad.</span>
              <span>{code.length} / 8,000</span>
            </div>
          </div>

          <div>
            <label htmlFor="circuit-sim-input" style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
              Simulation Diagnostics & Serial Output
            </label>
            <textarea
              id="circuit-sim-input"
              rows={3}
              maxLength={2000}
              placeholder="Paste any simulation error messages, compiler warnings, or Serial Monitor output..."
              value={simulation}
              onChange={(e) => setSimulation(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--ohmi-border)',
                fontSize: '13px',
                background: 'var(--ohmi-card)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--ohmi-muted)' }}>
              <span>User-reported simulation observation.</span>
              <span>{simulation.length} / 2,000</span>
            </div>
          </div>
        </section>

        {/* Section 3: Target Board & Requirements */}
        <section aria-labelledby="heading-board-requirements" style={{ marginBottom: '24px' }}>
          <h2 id="heading-board-requirements" style={{ fontSize: '18px', marginBottom: '12px' }}>
            3. Target Board & Requirements
          </h2>

          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="board-select" style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
              Declared Microcontroller Board
            </label>
            <select
              id="board-select"
              value={board}
              onChange={(e) => setBoard(e.target.value as 'unknown' | 'uno-r3')}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--ohmi-border)',
                background: 'var(--ohmi-card)',
              }}
            >
              <option value="unknown">Unknown / Not sure (let OHMI inspect from image)</option>
              <option value="uno-r3">Arduino UNO R3</option>
            </select>
          </div>

          {assignments.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="assignment-select" style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                Compare Against Saved Assignment (Optional)
              </label>
              <select
                id="assignment-select"
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--ohmi-border)',
                  background: 'var(--ohmi-card)',
                }}
              >
                <option value="none">Manual requirements / Freeform check</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>{a.original_name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedAssignmentId !== 'none' && (
            <div style={{ marginBottom: '14px' }}>
              {requirementAnalyses.filter((a) => a.assignment_id === selectedAssignmentId).length > 0 ? (
                <div>
                  <label htmlFor="analysis-select" style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                    Select Requirement Analysis
                  </label>
                  <select
                    id="analysis-select"
                    value={selectedAnalysisId}
                    onChange={(e) => setSelectedAnalysisId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--ohmi-border)',
                      background: 'var(--ohmi-card)',
                      fontSize: '13px',
                    }}
                  >
                    {requirementAnalyses.filter((a) => a.assignment_id === selectedAssignmentId).map((m) => (
                      <option key={m.id} value={m.id}>{m.title} ({new Date(m.created_at).toLocaleDateString()})</option>
                    ))}
                    <option value="none">Proceed without analysis (requirements not supplied)</option>
                  </select>
                </div>
              ) : (
                <div style={{ padding: '8px 12px', background: 'var(--ohmi-tint)', borderRadius: '8px', fontSize: '13px', color: 'var(--ohmi-muted)' }}>
                  <p style={{ margin: 0 }}>
                    No requirement analysis found for this assignment. Proceeding with visual review only (requirements not supplied), or enter requirements manually below.
                  </p>
                </div>
              )}
            </div>
          )}

          {(selectedAssignmentId === 'none' || (selectedAssignmentId !== 'none' && selectedAnalysisId === 'none')) && (
            <div>
              <label htmlFor="requirements-input" style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                Assignment Requirements or Goal {selectedAssignmentId !== 'none' ? '(Manual Override)' : '(Optional)'}
              </label>
              <textarea
                id="requirements-input"
                rows={3}
                maxLength={4000}
                placeholder="Enter specific assignment requirements (e.g. 'Pushbutton on pin 2 toggles LED on pin 13 with debounce')..."
                value={requirementText}
                onChange={(e) => setRequirementText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--ohmi-border)',
                  fontSize: '13px',
                  background: 'var(--ohmi-card)',
                }}
              />
            </div>
          )}
        </section>

        {/* Section 4: Privacy Disclosure & Send Actions */}
        <section aria-labelledby="heading-send" style={{ paddingTop: '16px', borderTop: '1px solid var(--ohmi-border)' }}>
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.04)',
              fontSize: '12px',
              color: 'var(--ohmi-muted)',
              marginBottom: '16px',
              lineHeight: 1.5,
            }}
          >
            <strong>Privacy & Scope Disclosure:</strong> All screenshots, crops, and code on this page remain local until you submit. OHMI analyzes visual and textual evidence within low-voltage educational breadboard rules.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            {account.state.user ? (
              <button
                type="button"
                className="ohmi-button ohmi-primary"
                disabled={!canSubmit}
                onClick={handleSendCheck}
                style={{ minWidth: '180px' }}
              >
                {submitting ? 'Reviewing circuit evidence…' : 'Send for Circuit Review'}
              </button>
            ) : (
              <button
                type="button"
                className="ohmi-button ohmi-primary"
                onClick={() => { void request('account.open'); }}
              >
                Sign in to OHMI to Analyze
              </button>
            )}

            <button
              type="button"
              className="ohmi-button ohmi-secondary"
              onClick={clearAllEvidence}
              disabled={submitting}
            >
              Clear all evidence
            </button>
          </div>

          {!account.state.user && (
            <p style={{ fontSize: '12px', color: 'var(--ohmi-muted)', marginTop: '8px' }}>
              Sign in with your OHMI account to save circuit checks, restore history, and track step progress.
            </p>
          )}
        </section>

        {/* Section 5: Interactive Circuit Review Results */}
        {activeResult && (
          <div
            id="circuit-results"
            ref={resultsRef}
            role="region"
            aria-label="Circuit Review Results"
            style={{
              marginTop: '32px',
              paddingTop: '24px',
              borderTop: '2px solid var(--ohmi-teal)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  className="ohmi-badge"
                  style={{
                    fontSize: '13px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background:
                      activeResult.status === 'reviewed'
                        ? 'var(--ohmi-mint)'
                        : activeResult.status === 'needs_clarification'
                        ? 'var(--ohmi-gold)'
                        : '#fee2e2',
                    color:
                      activeResult.status === 'reviewed'
                        ? 'var(--ohmi-teal)'
                        : activeResult.status === 'needs_clarification'
                        ? 'var(--ohmi-on-gold)'
                        : '#991b1b',
                    fontWeight: 750,
                  }}
                >
                  {activeResult.status === 'reviewed' && 'Evidence Reviewed'}
                  {activeResult.status === 'needs_clarification' && 'Needs Clarification'}
                  {activeResult.status === 'unsupported' && 'Unsupported Circuit'}
                </span>
                {activeResultTimestamp && (
                  <span style={{ fontSize: '12px', color: 'var(--ohmi-muted)' }}>
                    Generated at {activeResultTimestamp}
                  </span>
                )}
              </div>

              {activeResultId && (
                <button
                  type="button"
                  className="ohmi-text-button"
                  onClick={handleDeleteCheck}
                  style={{ fontSize: '12px', color: '#991b1b' }}
                >
                  Delete this review
                </button>
              )}
            </div>

            {/* Summary */}
            <div
              style={{
                background: 'var(--ohmi-card)',
                border: '1px solid var(--ohmi-border)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Summary</h3>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
                {activeResult.summary}
              </p>
              <p
                style={{
                  margin: '12px 0 0',
                  fontSize: '11px',
                  color: 'var(--ohmi-muted)',
                  borderTop: '1px solid var(--ohmi-border)',
                  paddingTop: '8px'
                }}
              >
                ⚠️ <strong>Safety Notice:</strong> Review is based strictly on visible pixels and pasted code. Never energize hardware or assume electrical safety without physical verification.
              </p>
            </div>

            {/* Findings */}
            {activeResult.findings && activeResult.findings.length > 0 && (
              <section aria-label="Circuit Findings" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>
                  Circuit Findings ({activeResult.findings.length})
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {activeResult.findings.map((finding) => (
                    <div
                      key={finding.id}
                      style={{
                        border: '1px solid var(--ohmi-border)',
                        borderRadius: '10px',
                        padding: '14px',
                        background: 'var(--ohmi-card)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span
                            className="ohmi-badge"
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background:
                                finding.severity === 'stop'
                                  ? '#fee2e2'
                                  : finding.severity === 'warning'
                                  ? 'var(--ohmi-gold)'
                                  : 'var(--ohmi-mint)',
                              color:
                                finding.severity === 'stop'
                                  ? '#991b1b'
                                  : finding.severity === 'warning'
                                  ? 'var(--ohmi-on-gold)'
                                  : 'var(--ohmi-teal)',
                            }}
                          >
                            {finding.severity.toUpperCase()}
                          </span>
                          <span
                            className="ohmi-badge"
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#f1f5f9',
                              color: '#475569',
                            }}
                          >
                            {finding.certainty}
                          </span>
                        </div>
                      </div>

                      <p style={{ margin: '0 0 6px', fontSize: '13px', lineHeight: 1.4 }}>
                        <strong>Observation: </strong>{finding.observation}
                      </p>
                      <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--ohmi-muted)', lineHeight: 1.4 }}>
                        <strong>Why: </strong>{finding.why}
                      </p>
                      <p style={{ margin: '0 0 8px', fontSize: '13px', lineHeight: 1.4 }}>
                        <strong>Recommended Action: </strong>{finding.action}
                      </p>

                      {finding.evidence && finding.evidence.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                          {finding.evidence.map((ref, idx) => renderEvidenceTag(ref, idx))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Unknowns */}
            {activeResult.unknowns && activeResult.unknowns.length > 0 && (
              <div
                style={{
                  background: 'var(--ohmi-tint)',
                  border: '1px solid var(--ohmi-border)',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '20px',
                }}
              >
                <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>Unobserved or Uncertain Details</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                  {activeResult.unknowns.map((u, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Questions for clarification */}
            {activeResult.questions && activeResult.questions.length > 0 && (
              <div
                style={{
                  background: 'var(--ohmi-gold)',
                  color: 'var(--ohmi-on-gold)',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '20px',
                }}
              >
                <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>Questions to Verify on Your Breadboard</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                  {activeResult.questions.map((q, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Assignment Requirement Comparisons */}
            {activeResult.comparisons && activeResult.comparisons.length > 0 && (
              <section aria-label="Assignment Comparisons" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>
                  Assignment Requirements Comparison
                </h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {activeResult.comparisons.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        border: '1px solid var(--ohmi-border)',
                        borderRadius: '10px',
                        padding: '12px',
                        background: 'var(--ohmi-card)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.requirementId}</span>
                        <span
                          className="ohmi-badge"
                          style={{
                            fontSize: '11px',
                            background:
                              c.status === 'supported'
                                ? 'var(--ohmi-mint)'
                                : c.status === 'possible_mismatch'
                                ? 'var(--ohmi-gold)'
                                : '#e2e8f0',
                            color:
                              c.status === 'supported'
                                ? 'var(--ohmi-teal)'
                                : c.status === 'possible_mismatch'
                                ? 'var(--ohmi-on-gold)'
                                : '#475569',
                          }}
                        >
                          {c.status === 'supported' && 'Supported'}
                          {c.status === 'possible_mismatch' && 'Possible Mismatch'}
                          {c.status === 'not_observable' && 'Not Observable'}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: '13px' }}>{c.explanation}</p>
                      {c.evidence && c.evidence.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {c.evidence.map((ref, idx) => renderEvidenceTag(ref, idx))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Interactive Step-by-Step Guidance */}
            {activeResult.steps && activeResult.steps.length > 0 && (
              <section aria-label="Step-by-Step Guidance" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>
                  Step-by-Step Guidance
                </h3>
                <div
                  style={{
                    border: '1px solid var(--ohmi-border)',
                    borderRadius: '12px',
                    padding: '16px',
                    background: 'var(--ohmi-card)',
                  }}
                >
                  <div className="ohmi-guide-progress">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span>{completedStepIndices.length} of {activeResult.steps.length} steps completed</span>
                      <span>Step {currentStepIndex + 1} of {activeResult.steps.length}</span>
                    </div>
                    <progress
                      aria-label="Guidance progress"
                      value={completedStepIndices.length}
                      max={activeResult.steps.length}
                      style={{ width: '100%', height: '8px' }}
                    />
                  </div>

                  {activeResult.steps[currentStepIndex] && (
                    <div className="ohmi-guide-step" style={{ marginTop: '12px' }}>
                      <span className="ohmi-step-number" aria-hidden="true">
                        {activeResult.steps[currentStepIndex].step}
                      </span>
                      <h4 style={{ margin: '0 0 8px', fontSize: '15px' }}>
                        Step {activeResult.steps[currentStepIndex].step}: {activeResult.steps[currentStepIndex].instruction}
                      </h4>
                      <p style={{ fontSize: '13px', margin: '0 0 8px', color: 'var(--ohmi-muted)' }}>
                        <strong>Why: </strong>{activeResult.steps[currentStepIndex].why}
                      </p>
                      <div className="ohmi-tip" style={{ marginTop: '8px' }}>
                        <Icon name="spark" size={16} />
                        <p style={{ margin: 0, fontSize: '12px' }}>
                          <strong>Check: </strong>{activeResult.steps[currentStepIndex].check}
                        </p>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                    <button
                      type="button"
                      className={`ohmi-button ohmi-full-width ${completedStepIndices.includes(currentStepIndex) ? 'ohmi-secondary' : 'ohmi-primary'}`}
                      onClick={() => void handleStepDoneToggle(currentStepIndex)}
                    >
                      <Icon name="done" size={18} />
                      {completedStepIndices.includes(currentStepIndex) ? 'Undo completion' : 'Mark step done'}
                    </button>

                    <div className="ohmi-guide-nav" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <button
                        type="button"
                        className="ohmi-button ohmi-secondary"
                        disabled={currentStepIndex === 0}
                        onClick={() => void handleStepNav(Math.max(0, currentStepIndex - 1))}
                      >
                        <Icon name="back" size={16} /> Previous
                      </button>
                      <button
                        type="button"
                        className="ohmi-button ohmi-secondary"
                        disabled={currentStepIndex >= activeResult.steps.length - 1}
                        onClick={() => void handleStepNav(Math.min(activeResult.steps.length - 1, currentStepIndex + 1))}
                      >
                        Next step <Icon name="next" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Code Suggestion */}
            {activeResult.codeSuggestion && (
              <section aria-label="Arduino Code Suggestion" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>
                  Suggested Code Adjustment
                </h3>
                <div
                  style={{
                    border: '1px solid var(--ohmi-border)',
                    borderRadius: '12px',
                    padding: '16px',
                    background: 'var(--ohmi-card)',
                  }}
                >
                  <p style={{ fontSize: '13px', margin: '0 0 10px', lineHeight: 1.4 }}>
                    {activeResult.codeSuggestion.explanation}
                  </p>
                  <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <pre
                      style={{
                        background: '#0f172a',
                        color: '#f8fafc',
                        padding: '12px',
                        borderRadius: '8px',
                        overflowX: 'auto',
                        fontSize: '12px',
                        lineHeight: 1.4,
                        margin: 0,
                      }}
                    >
                      <code>{activeResult.codeSuggestion.code}</code>
                    </pre>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="ohmi-button ohmi-secondary"
                      onClick={() => handleCopyCode(activeResult.codeSuggestion!.code)}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      {codeCopied ? 'Copied to clipboard!' : 'Copy suggested code'}
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--ohmi-muted)' }}>
                      Code suggestion only · Not compiled or tested by compiler
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Limitations */}
            {activeResult.limitations && activeResult.limitations.length > 0 && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.03)',
                  border: '1px solid var(--ohmi-border)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '20px',
                  fontSize: '12px',
                  color: 'var(--ohmi-muted)',
                }}
              >
                <strong style={{ display: 'block', marginBottom: '4px' }}>Review Limitations:</strong>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  {activeResult.limitations.map((lim, idx) => (
                    <li key={idx} style={{ marginBottom: '2px' }}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-up question form */}
            <div
              style={{
                border: '1px solid var(--ohmi-border)',
                borderRadius: '12px',
                padding: '16px',
                background: 'var(--ohmi-surface)',
                marginBottom: '20px',
              }}
            >
              <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>Have a follow-up question about this review?</h4>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--ohmi-muted)' }}>
                Ask for clarification on specific findings or breadboard connections. No new images will be transmitted.
              </p>
              <textarea
                rows={2}
                maxLength={2000}
                placeholder="Ask about resistor values, pin connections, or step details…"
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--ohmi-border)',
                  fontSize: '13px',
                  background: 'var(--ohmi-card)',
                  marginBottom: '8px',
                }}
              />
              <button
                type="button"
                className="ohmi-button ohmi-primary"
                disabled={followUpSubmitting || !followUpText.trim()}
                onClick={handleFollowUp}
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                {followUpSubmitting ? 'Asking follow-up…' : 'Ask Follow-up'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
