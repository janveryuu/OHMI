import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { startAuthFixture, seedSession, testUser, newUser, anotherNewUser } from './auth-fixture.mjs';
const base='http://127.0.0.1:3136/app/';
const output=new URL('../test-results/onboarding/',import.meta.url);
await mkdir(output,{recursive:true});
const fixture=await startAuthFixture(), browser=await chromium.launch();
const errors=[], forbidden=[], results=[];
async function context(user=testUser,options={}) {
 const c=await browser.newContext(options);await seedSession(c,user);
 await c.route('http://127.0.0.1:54329/**',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'http://127.0.0.1:3136'}})});
 c.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&/\/app\/api\/(ai|files|guide|playground)/.test(r.url()))forbidden.push(r.url())})});
 return c;
}
async function opened(c,path='') {const p=await c.newPage();await p.goto(base+path);await p.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});return p}
async function noInvite(p) {assert.equal(await p.getByRole('button',{name:'Start Tour',exact:true}).count(),0)}
async function shot(p,name) {await p.screenshot({path:new URL(name+'.png',output).pathname.replace(/^\/([A-Z]:)/,'$1').replaceAll('%20',' ')});}
try {
 const fresh=await context(newUser,{viewport:{width:1440,height:1000}}), page=await opened(fresh);
 await page.getByRole('button',{name:'Start Tour',exact:true}).waitFor();
 await shot(page,'invitation-light');
 await page.getByRole('button',{name:'Start Tour',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('heading',{name:'Your workspace, at a glance',exact:true}).waitFor();
 await page.waitForTimeout(550);await shot(page,'dashboard-light');
 await page.getByRole('button',{name:'Skip tour',exact:true}).click();
 await page.reload();await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});await noInvite(page);
 const device=await context(newUser), other=await opened(device);await noInvite(other);
 const account2=await context(anotherNewUser), second=await opened(account2);
 await second.getByRole('button',{name:'Maybe Later',exact:true}).click();await second.reload();await second.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});await noInvite(second);
 await seedSession(fresh,testUser);await page.reload();await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});await noInvite(page);
 await fresh.close();await device.close();await account2.close();
 results.push('new user once; skip; returning; other device; independent new account; maybe later; account switch');
 for(const [width,height,theme,reduced] of [[1440,1000,'light','no-preference'],[768,1024,'dark','reduce'],[390,844,'light','no-preference'],[320,640,'dark','reduce']]) {
  const c=await context(testUser,{viewport:{width,height},reducedMotion:reduced});
  await c.addInitScript(theme=>{if(location.origin==='http://127.0.0.1:3136')localStorage.setItem('ohmi-preferences',JSON.stringify({theme}))},theme);
  const p=await opened(c,'settings/');await noInvite(p);console.log('Testing width',width);
  await p.getByRole('button',{name:'Take a Tour',exact:true}).click();
  for(let step=0;step<10;step++) {
   const next=p.getByRole('button',{name:step===9?'Finish':'Next',exact:true});
   await next.waitFor({timeout:10000}).catch(async error=>{console.log('Failed stop',width,step,await p.url(),await p.locator('body').innerText());await shot(p,'failure');throw error;});await next.isEnabled().then(async enabled=>{if(!enabled)await p.waitForFunction(()=>!document.querySelector('.tour-controls button:last-child')?.disabled)});
   await p.waitForTimeout(550);await p.locator('.tour-avatar').evaluate(img=>img.decode());
   const card=p.locator('.tour-card');const rect=await card.boundingBox();
   assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1,`card offscreen ${width} ${step}`);
   assert.equal(await p.locator('.tour-count span').textContent(),`${step+1} of 10`);
   if(step===1||step===9)await shot(p,`${width}-${theme}-${step}`);
   if(step===1&&width===1440) {
    const a11y=await new AxeBuilder({page:p}).include('.tour-card').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(a11y.violations,[]);
    await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByRole('heading',{name:'Meet your circuit buddy',exact:true}).waitFor();await p.getByRole('button',{name:'Next',exact:true}).click();
   }
   if(reduced==='reduce')assert.equal(await p.locator('.tour-copy').evaluate(el=>getComputedStyle(el).animationName),'none');
   await next.click();
  }
  await p.locator('.tour-card').waitFor({state:'detached'});
  await p.getByRole('button',{name:'Take a Tour',exact:true}).click();await p.locator('.tour-card').waitFor();
  await p.keyboard.press('Tab');assert.equal(await p.locator('.tour-card').evaluate(el=>el.contains(document.activeElement)),true);
  await p.keyboard.press('Escape');await p.locator('.tour-card').waitFor({state:'detached'});
  await p.goto(base);await p.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});await noInvite(p);await c.close();
  results.push(`${width}x${height} ${theme} all ten routes, finish, replay, Escape, focus, motion`);
 }
 fixture.state.onboardingFail=true;
 const failure=await context(testUser), fp=await opened(failure);await noInvite(fp);await fp.goto(base+'settings/');await fp.getByRole('button',{name:'Take a Tour',exact:true}).click();
 await fp.getByText('The tour could not be prepared. Please try again.',{exact:true}).waitFor();assert.equal(await fp.locator('.tour-card').count(),0);
 await failure.close();
 fixture.state.onboardingFail=false;
 const api=await context(testUser);
 assert.equal((await api.request.post(base+'api/onboarding/')).status(),400);
 assert.equal((await api.request.post(base+'api/onboarding/',{headers:{Origin:'http://127.0.0.1:3136'}})).status(),200);
 assert.equal((await api.request.get(base+'api/onboarding/')).status(),405);
 await api.close();
 const signedOut=await browser.newContext(), visitor=await signedOut.newPage();await visitor.goto(base);await visitor.waitForURL('**/login/**');assert.equal(await visitor.locator('.tour-card').count(),0);await signedOut.close();
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 await writeFile(new URL('report.json',output),JSON.stringify({results,errors,forbidden,claims:fixture.state.onboardingClaims},null,2));
 console.log(JSON.stringify({results,errors,forbidden}));
} finally {await browser.close();await fixture.close()}
