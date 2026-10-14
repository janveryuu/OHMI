import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { chromium } from 'playwright';

export async function testAiExtension(fixtures,saved) {
  const profile=await mkdtemp(join(tmpdir(),'ohmi-ai-ui-')); const extension=resolve('.output/chrome-mv3'); let context;
  try {
    context=await chromium.launchPersistentContext(profile,{headless:true,channel:process.env.OHMI_CHROMIUM_PATH?undefined:'chromium',executablePath:process.env.OHMI_CHROMIUM_PATH,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1280,height:800},reducedMotion:'reduce'});
    await context.route('https://www.tinkercad.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><h1>SIMULATED EDITOR · GEMINI TEST</h1>'}));
    const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'); const id=new URL(worker.url()).hostname;
    const account=await context.newPage(); await account.goto(`chrome-extension://${id}/account.html`);
    await account.getByLabel('Email',{exact:true}).fill(fixtures[0].email); await account.getByLabel('Password',{exact:true}).fill(fixtures[0].password); await account.getByRole('button',{name:'Sign in',exact:true}).click();
    await account.getByRole('heading',{name:'Your private workspace',exact:true}).waitFor();
    const editor=await context.newPage(); await editor.goto('https://www.tinkercad.com/things/ai-test/editel'); await editor.getByRole('button',{name:'Open OHMI assistant',exact:true}).click();
    await editor.getByRole('button',{name:'Open Settings',exact:true}).click(); await editor.getByText(fixtures[0].email,{exact:true}).waitFor();
    await editor.getByRole('button',{name:'Ask section',exact:true}).click();
    await editor.getByRole('log',{name:'AI conversation',exact:true}).waitFor();
    await editor.getByRole('button',{name:'Send to OHMI',exact:true}).waitFor();
    console.log('PASS signed-in AI chat entry replaces guest sample while preserving panel/navigation.');
    if(saved){
      await editor.getByLabel('Saved conversation',{exact:true}).selectOption(saved.conversationId);
      if(saved.hasCode!==false)await editor.getByRole('log',{name:'AI conversation'}).getByText(/setup\s*\(/).waitFor();
      await editor.reload();await editor.getByRole('button',{name:/^(Open|Minimize) OHMI assistant$/}).waitFor();if(await editor.getByRole('button',{name:'Open OHMI assistant',exact:true}).count())await editor.getByRole('button',{name:'Open OHMI assistant',exact:true}).click();await editor.getByRole('button',{name:'Ask section',exact:true}).click();
      await editor.getByRole('log',{name:'AI conversation'}).waitFor();await editor.getByLabel('Saved conversation',{exact:true}).selectOption(saved.conversationId);if(saved.hasCode!==false)await editor.getByRole('log',{name:'AI conversation'}).getByText(/setup\s*\(/).waitFor();
      await editor.getByRole('button',{name:'Guide section',exact:true}).click();await editor.getByRole('region',{name:'AI assignment tutor',exact:true}).waitFor();await editor.getByLabel('Saved AI tutorial',{exact:true}).selectOption(saved.analysisId);
      const guide=editor.getByRole('region',{name:'AI assignment tutor',exact:true});await guide.getByText('1 of ',{exact:false}).waitFor();
      await guide.getByRole('button',{name:'Complete AI step',exact:true}).click();await guide.getByRole('button',{name:'Undo AI step',exact:true}).waitFor();
      await editor.reload();await editor.getByRole('button',{name:/^(Open|Minimize) OHMI assistant$/}).waitFor();if(await editor.getByRole('button',{name:'Open OHMI assistant',exact:true}).count())await editor.getByRole('button',{name:'Open OHMI assistant',exact:true}).click();await editor.getByRole('button',{name:'Guide section',exact:true}).click();await editor.getByLabel('Saved AI tutorial',{exact:true}).selectOption(saved.analysisId);await guide.getByRole('button',{name:'Undo AI step',exact:true}).waitFor();
      await guide.getByRole('button',{name:'Ask about this step',exact:true}).click();await editor.getByText(/Assignment context · step/).waitFor();await editor.getByRole('button',{name:'General chat',exact:true}).click();await editor.getByText(/Assignment context · step/).waitFor({state:'hidden'});
      await editor.setViewportSize({width:360,height:740});await editor.getByRole('log',{name:'AI conversation'}).waitFor();await editor.getByText('OHMI is working…',{exact:true}).waitFor({state:'hidden'});
      const screenshots=resolve(process.env.OHMI_SCREENSHOT_DIR??'docs/screenshots');await mkdir(screenshots,{recursive:true});
      await editor.screenshot({path:join(screenshots,'phase-4-chat-small.png')});
      console.log('PASS real saved AI history across reload, tutor resume/completion, current-step chat, general chat and 360px layout.');
    }
  } finally { await context?.close(); assert.equal(dirname(profile),resolve(tmpdir())); assert.ok(basename(profile).startsWith('ohmi-ai-ui-')); await rm(profile,{recursive:true,force:true}); }
}
