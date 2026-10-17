import { useEffect, useRef, useState } from 'react';
import { request } from './bridge';
import { useAccount } from './useAccount';
import { PrivateAssignments } from './PrivateAssignments';
import { AssignmentSteps } from './AssignmentSteps';
import { validateFile, type Action } from './backend/validation';
import type { Assignment, UploadAuthorization } from './backend/contracts';

type Mode = 'login' | 'signup' | 'confirm' | 'forgot' | 'recover' | 'reset';
const headings: Record<Mode, string> = { login: 'Your OHMI account', signup: 'Create your OHMI account', confirm: 'Confirm your email', forgot: 'Reset your password', recover: 'Verify your recovery code', reset: 'Choose a new password' };

export function AccountPage() {
  const account = useAccount();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadSequence = useRef(0);
  const showAccount = !!account.state.user && !['forgot', 'recover', 'reset'].includes(mode);
  const emailReady = import.meta.env.WXT_EMAIL_DELIVERY_READY === 'true';
  useEffect(() => { setName(account.state.profile?.display_name ?? ''); setSelected(null); if (account.state.recovery && emailReady) setMode('reset'); }, [account.state.user?.id, account.state.profile?.display_name, account.state.recovery]);
  useEffect(() => () => { uploadSequence.current++; xhrRef.current?.abort(); }, []);
  useEffect(() => { uploadSequence.current++; xhrRef.current?.abort(); setFile(null); if (fileRef.current) fileRef.current.value = ''; }, [account.state.user?.id]);
  const changeMode = (next: Mode) => { if (!emailReady && next !== 'login') return; setMode(next); setPassword(''); setToken(''); setError(''); setNotice(''); };
  const run = async (action: Action, payload: Record<string, unknown> = {}, success?: () => void) => {
    if (busy || uploading || account.loading) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request<{ message?: string }>(action, { ...payload, accountId: account.state.user?.id });
      setPassword(''); setToken('');
      if (result?.message) setNotice(result.message);
      await account.refresh(); success?.();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not complete this action.'); }
    finally { setBusy(false); }
  };
  const submit = () => {
    const payload = { email, password, token };
    const actions: Record<Mode, Action> = { login: 'auth.signIn', signup: 'auth.signUp', confirm: 'auth.confirm', forgot: 'auth.forgot', recover: 'auth.recover', reset: 'auth.password' };
    void run(actions[mode], payload, () => {
      if (mode === 'signup') setMode('confirm');
      else if (mode === 'forgot') setMode('recover');
      else if (mode === 'recover') setMode('reset');
      else setMode('login');
    });
  };
  const upload = async () => {
    if (!file || uploading || busy || account.loading || !account.state.user) return;
    const accountId = account.state.user.id;
    const sequence = ++uploadSequence.current;
    const checkAccount = () => { if (sequence !== uploadSequence.current) throw new Error('Account changed. Choose the file again after signing in.'); };
    setUploading(true); setPercent(0); setError(''); setNotice('');
    let id: string | undefined;
    try {
      const payload = { accountId, name: file.name, mime: file.type, size: file.size, signature: [...new Uint8Array(await file.slice(0, 16).arrayBuffer())] };
      checkAccount();
      validateFile(payload);
      const authorization = await request<UploadAuthorization>('files.prepare', payload);
      id = authorization.id;
      checkAccount();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhrRef.current = xhr;
        xhr.open('POST', authorization.url);
        xhr.setRequestHeader('apikey', authorization.key);
        xhr.setRequestHeader('Authorization', `Bearer ${authorization.token}`);
        xhr.setRequestHeader('Content-Type', authorization.mime);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.timeout = 120000;
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) setPercent(Math.min(99, Math.round(event.loaded / event.total * 100))); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed. Check your connection and try again.'));
        xhr.onerror = () => reject(new Error('Upload connection failed. Try again.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out. Try a smaller file or a faster connection.'));
        xhr.onabort = () => reject(new Error('Upload cancelled.'));
        xhr.send(file);
      });
      checkAccount();
      await request('files.finish', { id, accountId });
      setPercent(100); setNotice('Assignment saved privately. No AI analysis was performed.');
      setFile(null); if (fileRef.current) fileRef.current.value = '';
      await account.refresh();
    } catch (failure) {
      let message = failure instanceof Error ? failure.message : 'Upload failed.';
      if (id) { try { await request('files.delete', { id, accountId }); } catch { message += ' An incomplete item remains in the original account; sign in there to delete it and retry.'; } }
      setError(message); await account.refresh();
    } finally { xhrRef.current = null; setUploading(false); }
  };
  const isInitialLoading = account.loading && !account.state.user && !account.error && !error;

  return <div className="ohmi-root ohmi-account-root"><main className="ohmi-account-card">
    <header className="ohmi-account-brand"><img src="/assets/mascot/ohmi-pixel-front.png" alt="OHMI mascot" width={56} height={56} /><div><strong translate="no">OHMI</strong><p>Your circuit buddy</p></div></header>
    {isInitialLoading ? <>
      <h1>Loading your OHMI workspace…</h1>
      <p className="ohmi-muted">Connecting securely to your account.</p>
      <p className="ohmi-loading" role="status">Loading account…</p>
    </> : showAccount ? <>
      <h1>Your private workspace</h1>
      <p className="ohmi-muted">Manage your account and saved assignments.</p>
      {(error || account.error) && <div className="ohmi-notice" role="alert"><p>{error || account.error}</p><button type="button" className="ohmi-text-button" onClick={() => { setError(''); void account.refresh(); }}>Retry account</button></div>}
      {notice && <p className="ohmi-success" role="status">{notice}</p>}
      {account.loading && <p className="ohmi-loading" role="status">Refreshing workspace…</p>}
      <p className="ohmi-account-email">{account.state.user?.email}</p>
      <form className="ohmi-account-form" onSubmit={(event) => { event.preventDefault(); void run('profile.name', { name }, () => setNotice('Account name saved.')); }}><label htmlFor="ohmi-display-name">Display name</label><input id="ohmi-display-name" name="name" autoComplete="name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /><button type="submit" className="ohmi-button ohmi-secondary" disabled={busy || uploading || account.loading}>Save account name</button></form>
      <div className="ohmi-account-actions">{emailReady && <button type="button" className="ohmi-text-button" disabled={busy || uploading || account.loading} onClick={() => changeMode('forgot')}>Reset password</button>}<button type="button" className="ohmi-text-button" disabled={busy || uploading || account.loading} onClick={() => { void run('auth.signOut', {}, () => { changeMode('login'); setFile(null); setSelected(null); }); }}>Sign out</button></div>
      <section id="upload" className="ohmi-account-upload" aria-busy={account.loading}><h2>Upload an assignment</h2><p className="ohmi-muted">PDF, PNG, or JPG. Maximum 10 MiB. Private to your account.</p><label htmlFor="ohmi-assignment-file">Assignment file</label><input ref={fileRef} id="ohmi-assignment-file" type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" disabled={uploading || busy || account.loading} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPercent(null); setError(''); }} />{file && <p className="ohmi-muted">{file.name}</p>}<button type="button" className="ohmi-button ohmi-primary ohmi-full-width" disabled={!file || uploading || busy || account.loading} onClick={() => { void upload(); }}>{uploading ? 'Uploading assignment…' : 'Save private assignment'}</button>{percent !== null && <div className="ohmi-upload-progress"><progress aria-label="Assignment upload progress" value={percent} max={100} /><p role="status" className="ohmi-muted">{uploading ? percent >= 99 ? 'Verifying upload…' : `Uploading ${percent}%` : percent === 100 ? 'Upload complete' : 'Upload stopped'}</p></div>}{uploading && <button type="button" className="ohmi-text-button" onClick={() => xhrRef.current?.abort()} disabled={!xhrRef.current}>Cancel upload</button>}</section>
      {selected && account.state.user ? <AssignmentSteps key={account.state.user.id + selected.id} accountId={account.state.user.id} assignment={selected} onBack={() => setSelected(null)} /> : <PrivateAssignments {...account} refresh={account.refresh} onGuide={setSelected} onUpload={() => fileRef.current?.focus()} />}
    </> : <>
      <h1>{headings[mode]}</h1>
      <p className="ohmi-muted">Sign in securely in this extension-owned page.</p>
      {(error || account.error) && <div className="ohmi-notice" role="alert"><p>{error || account.error}</p><button type="button" className="ohmi-text-button" onClick={() => { setError(''); void account.refresh(); }}>Retry account</button></div>}
      {notice && <p className="ohmi-success" role="status">{notice}</p>}
      {account.loading && <p className="ohmi-loading" role="status">Loading account…</p>}
      {!account.state.configured && <p className="ohmi-notice">Supabase setup is not configured. Ask the project owner to connect OHMI.</p>}
      {!emailReady && <p className="ohmi-notice">Continue with Google. Email registration and password recovery are not available yet.</p>}
      {mode === 'login' && <button type="button" className="ohmi-button ohmi-secondary ohmi-full-width" disabled={busy || account.loading || !account.state.configured} onClick={() => { void run('auth.google'); }}>Continue with Google</button>}
      <form className="ohmi-account-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        {mode !== 'reset' && <><label htmlFor="ohmi-auth-email">Email</label><input id="ohmi-auth-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></>}
        {['login', 'signup', 'reset'].includes(mode) && <><label htmlFor="ohmi-auth-password">{mode === 'reset' ? 'New password' : 'Password'}</label><input id="ohmi-auth-password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 10} value={password} onChange={(event) => setPassword(event.target.value)} />{mode !== 'login' && <p className="ohmi-muted">At least 10 characters; password managers and paste are supported.</p>}</>}
        {['confirm', 'recover'].includes(mode) && <><label htmlFor="ohmi-auth-token">Email verification code</label><input id="ohmi-auth-token" name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,10}" maxLength={10} value={token} onChange={(event) => setToken(event.target.value)} /><p className="ohmi-muted">Paste the verification code from your OHMI email.</p></>}
        <button type="submit" className="ohmi-button ohmi-primary" disabled={busy || account.loading || !account.state.configured}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Register account' : mode === 'forgot' ? 'Send recovery code' : mode === 'reset' ? 'Save new password' : 'Verify email code'}</button>
      </form>
      <div className="ohmi-account-actions">{mode === 'login' ? <><button type="button" className="ohmi-text-button" disabled={!emailReady || busy} onClick={() => changeMode('signup')}>Create account</button><button type="button" className="ohmi-text-button" disabled={!emailReady || busy} onClick={() => changeMode('forgot')}>Forgot password?</button><button type="button" className="ohmi-text-button" disabled={!emailReady || busy} onClick={() => changeMode('confirm')}>Enter confirmation code</button></> : <><button type="button" className="ohmi-text-button" disabled={busy} onClick={() => changeMode('login')}>Back to sign in</button>{mode === 'confirm' && <button type="button" className="ohmi-text-button" disabled={busy || !email} onClick={() => { void run('auth.resend', { email }); }}>Resend confirmation code</button>}{mode === 'recover' && <button type="button" className="ohmi-text-button" disabled={busy || !email} onClick={() => { void run('auth.forgot', { email }); }}>Resend recovery code</button>}</>}</div>
    </>}
    <footer className="ohmi-account-footer">OHMI is an independent learning companion. AI and circuit checking remain sample previews.</footer>
  </main></div>;
}
