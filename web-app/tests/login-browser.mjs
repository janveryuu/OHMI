import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startAuthFixture, seedSession, testSession, testUser, otherUser } from "./auth-fixture.mjs";

const base = "http://127.0.0.1:3115/app";
const out = new URL("../.impeccable/review/login/", import.meta.url);
await mkdir(out, { recursive: true });
const fixture = await startAuthFixture();
const browser = await chromium.launch({ headless: true });
const results = [], errors = [], violations = [];
try {
  const context = await browser.newContext({ colorScheme: "dark", hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  if (!process.argv.includes("--auth-only")) for (const [name, width, height] of [["desktop",1440,900],["tablet",768,1024],["mobile",390,844],["small",320,640],["landscape",844,390],["ultrawide",1920,1080]]) {
    await page.setViewportSize({width,height});
    for (const theme of ["light", "dark"]) {
      await page.addInitScript((theme) => localStorage.setItem("ohmi-preferences", JSON.stringify({theme})), theme);
      assert.equal((await page.goto(base + "/login/")).status(), 200);
      await page.getByRole("button", {name:"Continue with Google",exact:true}).waitFor();
      await page.waitForFunction(() => [...document.images].every((i) => i.complete));
      await page.waitForTimeout(700);
      assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),false);
      const button = page.getByRole("button",{name:"Continue with Google",exact:true});
      assert.equal(await button.isEnabled(),true);
      const box = await button.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
      assert.ok(box.y + box.height <= height, `${name}: primary action below viewport`);
      const audit = await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
      violations.push(...audit.violations.map(v=>({name,theme,id:v.id,targets:v.nodes.map(n=>n.target)})));
      if (["desktop","mobile","landscape"].includes(name)) await page.screenshot({path:fileURLToPath(new URL(`${name}-${theme}.png`,out)),fullPage:true});
    }
    results.push(`${name}: both themes, responsive layout, touch targets and axe`);
  }
  // A fresh device stays light even when its system prefers dark.
  const fresh = await browser.newContext({colorScheme:"dark", reducedMotion:"reduce"});
  const freshPage = await fresh.newPage();
  await freshPage.goto(base + "/login/");
  await freshPage.getByRole("button",{name:"Continue with Google"}).waitFor();
  assert.equal(await freshPage.locator("html").getAttribute("data-theme"),"light");
  await freshPage.getByRole("button",{name:"Use dark theme"}).click();
  await freshPage.reload();
  assert.equal(await freshPage.locator("html").getAttribute("data-theme"),"dark");
  await freshPage.getByRole("button",{name:"Continue with Google"}).focus();
  assert.equal(await freshPage.evaluate(()=>document.activeElement?.tagName),"BUTTON");
  assert.equal(await freshPage.locator(".login-mascot").evaluate(el=>getComputedStyle(el).opacity),"1");
  results.push("Light default, saved theme without flash, reduced motion and keyboard focus");
  for (const path of ["/", "/ask/", "/assignments/", "/checker/", "/guide/", "/library/", "/library/resistor/", "/progress/", "/settings/"]) {
    await page.goto(base + path);
    assert.equal(new URL(page.url()).pathname,"/app/login/");
    assert.equal(new URL(page.url()).searchParams.get("next"),path === "/" ? null : "/app"+path);
  }
  results.push("All private routes redirect before rendering and preserve safe intended destinations");
  const artwork = await page.request.get(base + "/library/resistor.webp");
  assert.equal(artwork.status(), 200);
  assert.match(artwork.headers()["content-type"], /image\/webp/);
  const forged = testSession();
  forged.access_token = forged.access_token.replace("test-signature", "forged-signature");
  await context.addCookies([{ name: "ohmi-web-auth", value: "base64-" + Buffer.from(JSON.stringify(forged)).toString("base64url"), domain: "127.0.0.1", path: "/app/" }]);
  const denied = await page.request.get(base + "/settings/", { maxRedirects: 0 });
  assert.equal(denied.status(), 307);
  assert.equal(new URL(denied.headers().location, base).pathname, "/app/login/");
  await context.clearCookies({ name: "ohmi-web-auth" });
  results.push("Public library art stays reachable; forged session cookies fail server verification");
  // Keep navigation pending long enough to inspect the actual SDK loading state.
  await page.goto(base + "/login/?next=/app/library/resistor/");
  await page.evaluate(() => {
    const button = document.querySelector(".google-signin");
    new MutationObserver(() => {
      if (button.getAttribute("aria-busy") === "true") sessionStorage.setItem("login-loading-check", JSON.stringify({busy: button.getAttribute("aria-busy"), disabled: button.disabled, text: button.textContent}));
    }).observe(button, {attributes:true,childList:true,subtree:true});
  });
  await page.getByRole("button", { name: "Continue with Google" }).tap();
  await page.waitForURL(base + "/library/resistor/");
  await page.getByRole("heading",{name:"Wiring & technical reference",exact:true}).waitFor();
  const loadingState = JSON.parse(await page.evaluate(() => sessionStorage.getItem("login-loading-check")));
  assert.deepEqual(loadingState, { busy: "true", disabled: true, text: "Connecting to Google\u2026" });
  assert.equal(fixture.state.authorizations,1);
  assert.equal(fixture.state.exchanges,1);
  assert.equal((await context.cookies()).some(c=>c.name === "ohmi-web-return"),false);
  results.push("Real Supabase SDK OAuth start, PKCE challenge/verifier exchange, cookie session and safe return (local Auth double)");
  await page.goto(base + "/login/");
  await page.waitForURL(base + "/");
  await page.reload();
  assert.equal(new URL(page.url()).pathname,"/app/");
  await page.goto(base + "/settings/");
  await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await page.waitForURL(base + "/login/");
  assert.equal((await context.cookies()).some(c=>c.name === "ohmi-web-auth"),false);
  await page.goto(base + "/settings/");
  await page.waitForURL(/\/app\/login\//);
  results.push("Existing session restoration, authenticated login bypass, logout and protected reload");
  for (const mode of ["cancel","error"]) {
    fixture.state.mode=mode;
    await page.goto(base + "/login/?next=/app/ask/");
    const google = page.getByRole("button", {name:"Continue with Google"});
    if (mode === "cancel") { await google.focus(); await page.keyboard.press("Enter"); }
    else await google.click();
    await page.waitForURL(url=>url.pathname==="/app/login/" && url.searchParams.has("auth"));
    await page.getByText(mode === "cancel" ? "Google sign-in was cancelled. Continue when you’re ready." : "Google sign-in did not finish. Try again in this browser.",{exact:true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("next"),"/app/ask/");
    assert.equal(await page.getByRole("button",{name:"Continue with Google"}).isEnabled(),true);
  }
  fixture.state.mode="success";
  await page.goto(base + "/login/");
  await context.setOffline(true);
  await page.getByRole("button",{name:"Continue with Google"}).click();
  await page.getByText("You’re offline. Reconnect and try again.",{exact:true}).waitFor();
  await context.setOffline(false);
  results.push("Consent cancellation, failed callback and offline recovery use clear retry states");
  for (const unsafe of ["https://attacker.invalid/", "//attacker.invalid/", "/app/login/", "/app/../admin/"]) {
    const response = await page.request.get(base + "/auth/callback/?next="+encodeURIComponent(unsafe),{maxRedirects:0});
    const location = new URL(response.headers().location);
    assert.equal(location.origin,new URL(base).origin);
    assert.equal(location.pathname,"/app/login/");
    assert.equal(location.searchParams.get("next"),null);
    assert.match(response.headers()["cache-control"],/private.*no-store/);
  }
  await seedSession(context, testUser, true);
  await page.goto(base + "/settings/");
  await page.getByRole("heading",{name:"Test Learner A",exact:true}).waitFor();
  assert.ok(fixture.state.refreshes>0);
  await seedSession(context,otherUser);
  await page.reload();
  await page.getByRole("heading",{name:"Test Learner B",exact:true}).waitFor();
  assert.equal(await page.getByText(testUser.email,{exact:true}).count(),0);
  results.push("Open redirects rejected; expired session refresh and synthetic account isolation pass");
  assert.deepEqual(errors,[]);
  assert.deepEqual(violations,[]);
  await context.close(); await fresh.close();
} finally {
  await writeFile(new URL(process.argv.includes("--auth-only") ? "auth-report.json" : "report.json",out),JSON.stringify({results,errors,violations},null,2));
  await browser.close(); await fixture.close();
}
console.log(JSON.stringify({results,errors,violations},null,2));
