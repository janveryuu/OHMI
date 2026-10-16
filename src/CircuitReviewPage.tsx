import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { request } from './bridge';
import { useAccount } from './useAccount';
import { isCircuitEditorUrl } from './editor-url';

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

  const overviewFileRef = useRef<HTMLInputElement>(null);
  const detailFileRef = useRef<HTMLInputElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);

  // Check URL parameters and hash on load
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('intro') === '1' || window.location.hash.includes('capture-intro')) {
      setShowIntro(true);
    }

    const hash = window.location.hash;
    const captureMatch = hash.match(/capture=([0-9a-f-]+)/i);

    if (captureMatch) {
      void (async () => {
        try {
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
        } catch (err: any) {
          setError(err.message || 'Could not claim capture. You can upload a screenshot manually.');
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, []);

  // Clear data on account change to protect privacy
  useEffect(() => {
    // If account switches, clear in-memory evidence
    clearAllEvidence();
  }, [account.state.user?.id]);

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
      setNotice(`Applied crop (${w} x ${h} px).`);
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
    setFullImageConfirmed(false);
    setNotice('');
    setError('');
  };

  const combinedPixels = (overviewImage ? overviewImage.width * overviewImage.height : 0) +
    (detailImage ? detailImage.width * detailImage.height : 0);
  const combinedBytes = (overviewImage ? overviewImage.sizeBytes : 0) +
    (detailImage ? detailImage.sizeBytes : 0);

  return (
    <div className="ohmi-root ohmi-account-root" style={{ minHeight: '100vh', padding: '24px 16px' }}>
      <main className="ohmi-account-card" style={{ maxWidth: '720px' }}>
        <header className="ohmi-account-brand">
          <strong>OHMI</strong>
          <p>Circuit Review & Check</p>
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
            M1 Preview · AI Disconnected
          </span>
        </header>

        <h1>Review Tinkercad Circuit</h1>
        <p className="ohmi-muted">
          Inspect your circuit evidence, verify code, and prepare notes before sending for analysis.
        </p>

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
              When you click the OHMI toolbar icon in Chrome while viewing a Tinkercad Circuits tab, OHMI captures only the visible canvas locally.
              The screenshot is stored only in your browser memory for review and crop. No images or circuit data are sent to Google or any server until you explicitly confirm and click Send.
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
            <label htmlFor="circuit-code-input" style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
              Arduino Code (.ino / C++)
            </label>
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

          <div>
            <label htmlFor="requirements-input" style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
              Assignment Requirements or Goal
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
            <strong>Privacy & Scope Disclosure:</strong> All screenshots, crops, code, and diagnostics shown on this page are stored temporarily in your local browser memory. No network analysis requests are sent until you explicitly submit.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              className="ohmi-button ohmi-primary"
              disabled={true}
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
              title="AI analysis is disconnected in Phase 5 Milestone 1"
            >
              Send for analysis (AI Disconnected in M1)
            </button>
            <button
              type="button"
              className="ohmi-button ohmi-secondary"
              onClick={clearAllEvidence}
            >
              Clear all evidence
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--ohmi-muted)', marginTop: '8px' }}>
            Phase 5 Milestone 1 verifies local screenshot capture, cropping, and preview with zero external AI calls. Analysis will be connected in Milestone 2 under explicit authorization.
          </p>
        </section>
      </main>
    </div>
  );
}
