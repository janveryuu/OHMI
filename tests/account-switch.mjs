import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { chromium } from 'playwright';

const profile = await mkdtemp(join(tmpdir(), 'ohmi-account-switch-'));
const extension = resolve('.output/chrome-mv3');
let context;
try {
  context = await chromium.launchPersistentContext(profile, { headless: true, channel: process.env.OHMI_CHROMIUM_PATH ? undefined : 'chromium', executablePath: process.env.OHMI_CHROMIUM_PATH, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`], viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await context.route('https://www.tinkercad.com/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><h1>SIMULATED EDITOR · ACCOUNT PRIVACY TEST</h1>' }));
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;
  const editor = await context.newPage();
  await editor.goto('https://www.tinkercad.com/things/account-privacy-test/editel');
  await editor.getByRole('button', { name: 'Open OHMI assistant', exact: true }).click();
  const cdp = await context.newCDPSession(editor);
  const worlds = [];
  cdp.on('Runtime.executionContextCreated', event => worlds.push(event.context));
  await cdp.send('Runtime.enable');
  const isolated = worlds.find(world => world.origin === `chrome-extension://${extensionId}` && !world.auxData?.isDefault);
  assert.ok(isolated, 'Use the actual extension content-script world');
  const evaluate = async expression => {
    const result = await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression, awaitPromise: true, returnByValue: true });
    assert.equal(result.exceptionDetails, undefined, result.exceptionDetails?.text);
    return result.result.value;
  };
  // Replace only account/history responses; the actual extension components and messages remain in use.
  await evaluate(`(() => {
    const original = chrome.runtime.sendMessage.bind(chrome.runtime);
    globalThis.accountFixture = { owner: 'student-a', delayed: false, pending: [] };
    chrome.runtime.sendMessage = async (message, ...args) => {
      const fixture = globalThis.accountFixture;
      if (message?.channel !== 'ohmi') return original(message, ...args);
      if (message.action === 'account.state') {
        const owner = fixture.owner;
        const data = { configured: true, user: owner ? { id: owner, email: owner + '@example.test' } : null, profile: owner ? { id: owner, display_name: owner, language: 'english' } : null, assignments: [], recovery: false };
        if (fixture.delayed) return new Promise(resolve => fixture.pending.push(() => resolve({ ok: true, data })));
        return { ok: true, data };
      }
      if (message.action === 'ai.conversations') return { ok: true, data: [{ id: message.payload.accountId + '-conversation', title: 'Private circuit question', analysis_id: null, updated_at: '2026-10-14T00:00:00Z' }] };
      if (message.action === 'ai.messages') return { ok: true, data: [{ id: message.payload.accountId + '-reply', role: 'assistant', content: message.payload.accountId + ' private AI transcript', created_at: '2026-10-14T00:00:00Z', request_id: 'fictional-request' }] };
      if (message.action?.startsWith('ai.')) throw new Error('Provider calls are forbidden in this privacy test');
      return original(message, ...args);
    };
  })()`);
  const notify = async accountId => worker.evaluate(async accountId => {
    const tabs = await chrome.tabs.query({ url: 'https://www.tinkercad.com/*' });
    await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { channel: 'ohmi', event: 'account.changed', accountId })));
  }, accountId);
  const hold = async owner => evaluate(`Object.assign(accountFixture, { owner: ${JSON.stringify(owner)}, delayed: true })`);
  const pending = async (count = 1) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`accountFixture.pending.length >= ${count}`)) return;
      await editor.waitForTimeout(20);
    }
    assert.fail('Account refresh must reach the delayed response');
  };
  const release = async () => evaluate('accountFixture.delayed = false; accountFixture.pending.splice(0).forEach(resolve => resolve())');
  const privateText = owner => editor.getByText(`${owner} private AI transcript`, { exact: true });

  await notify('student-a');
  await editor.getByRole('button', { name: 'Ask section', exact: true }).click();
  await privateText('student-a').waitFor();
  await editor.getByRole('textbox', { name: 'Message OHMI', exact: true }).fill('Unsent private question');
  await hold('student-a');
  await notify('student-a');
  await pending();
  assert.equal(await privateText('student-a').isVisible(), false, 'Private transcript is concealed while refreshing without discarding its state');
  assert.equal(await editor.getByRole('textbox', { name: 'Message OHMI', exact: true, includeHidden:true }).inputValue(), 'Unsent private question', 'Same-owner notifications preserve drafts');

  await hold('student-b');
  await notify('student-b');
  await pending(2);
  await editor.waitForTimeout(50);
  assert.equal(await privateText('student-a').count(), 0, 'Previous owner private AI text disappears before replacement account.state resolves');
  await evaluate('accountFixture.pending.shift()()');
  await editor.waitForTimeout(50);
  assert.equal(await privateText('student-a').count(), 0, 'Late prior-owner account.state cannot restore private text while the replacement is pending');
  await release();
  await privateText('student-b').waitFor();
  assert.equal(await editor.getByRole('textbox', { name: 'Message OHMI', exact: true }).inputValue(), '', 'Replacement owner cannot inherit the prior draft');

  await hold(null);
  await notify(null);
  await pending();
  await editor.waitForTimeout(50);
  assert.equal(await privateText('student-b').count(), 0, 'Sign-out notification clears private AI text before account.state resolves');
  await release();
  await evaluate("accountFixture.owner = 'student-a'");
  await notify('student-a');
  await privateText('student-a').waitFor();
  await hold(null);
  await evaluate("window.dispatchEvent(new Event('focus'))");
  await pending();
  await editor.waitForTimeout(50);
  assert.equal(await privateText('student-a').isVisible(), false, 'Refocus hides private text while the current owner is unverified');
  await release();
  await editor.getByRole('log', { name: 'Local demo conversation', exact: true }).waitFor();
  await evaluate(`(() => {
    const original=chrome.runtime.sendMessage.bind(chrome.runtime);
    const analysis={id:'fictional-analysis',assignment_id:'fictional-assignment',language:'english',model:'fictional-ui-fixture',payload:{title:'Fictional LED tutorial',status:'ready',summary:'UI fixture, not provider output.',objectives:[],components:[],expectedResults:[],assumptions:[],uncertainties:[],steps:[{title:'Read ratings',instruction:'Read the LED ratings.',why:'Use safe current.',check:'Know the rating?',code:''},{title:'Add series resistor',instruction:'Use the assigned resistor.',why:'Limit current.',check:'Check the series path.',code:''}]}};
    globalThis.tutorialFixture={analysis,currentStep:0,completed:[]};
    chrome.runtime.sendMessage=async(message,...args)=>{
      if(message?.action==='ai.analyses')return{ok:true,data:[analysis]};
      if(message?.action==='ai.analysis')return{ok:true,data:JSON.parse(JSON.stringify(tutorialFixture))};
      if(message?.action==='ai.progress.save'){tutorialFixture.currentStep=message.payload.currentStep;tutorialFixture.completed=message.payload.completed;return{ok:true,data:null};}
      return original(message,...args);
    };
    accountFixture.owner='student-a';
  })()`);
  await notify('student-a');await privateText('student-a').waitFor();
  await editor.getByRole('button',{name:'Guide section',exact:true}).click();
  const guide=editor.getByRole('region',{name:'AI assignment tutor',exact:true});await guide.getByText('Read the LED ratings.',{exact:true}).waitFor();
  await guide.getByRole('button',{name:'Complete AI step',exact:true}).click();await guide.getByRole('button',{name:'Undo AI step',exact:true}).waitFor();
  await guide.getByRole('button',{name:'Next AI step',exact:true}).click();await guide.getByText('Use the assigned resistor.',{exact:true}).waitFor();
  assert.deepEqual(await evaluate('({currentStep:tutorialFixture.currentStep,completed:tutorialFixture.completed})'),{currentStep:1,completed:[0]});
  await guide.getByRole('button',{name:'Get a hint',exact:true}).click();await editor.getByText('Assignment context · step 2',{exact:false}).waitFor();
  assert.match(await editor.getByRole('textbox',{name:'Message OHMI',exact:true}).inputValue(),/small hint/);
  await editor.getByRole('button',{name:'General chat',exact:true}).click();await editor.getByText('Assignment context · step 2',{exact:false}).waitFor({state:'hidden'});
  await editor.getByRole('button',{name:'Guide section',exact:true}).click();await guide.getByText('Use the assigned resistor.',{exact:true}).waitFor();
  await editor.setViewportSize({width:360,height:740});await guide.screenshot({path:'.superpowers/sdd/2026-10-14-phase-4/screenshots/phase-4-tutor-fixture.png'});
  console.log('PASS AI tutor UI fixture: completion, next/current step, hint context, general chat, saved resume and 360px layout. Provider/backend calls mocked; no live AI claim.');
  await cdp.detach();
  console.log('PASS account lifecycle privacy: same-owner transcript/draft preserved; account switch, sign-out, and refocus clear private AI views before delayed state resolves. Fictional responses only; no provider or database changes.');
} finally {
  await context?.close();
  assert.equal(dirname(profile), resolve(tmpdir()));
  assert.ok(basename(profile).startsWith('ohmi-account-switch-'));
  await rm(profile, { recursive: true, force: true });
}
