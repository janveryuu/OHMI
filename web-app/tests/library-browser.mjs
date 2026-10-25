import { startAuthFixture, seedSession } from "./auth-fixture.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const base = process.env.OHMI_TEST_URL || "http://127.0.0.1:3115/app";
const entries = JSON.parse(await readFile(new URL("../src/lib/library.json", import.meta.url), "utf8"));
const output = new URL("../test-results/library/", import.meta.url);
await mkdir(output, { recursive: true });
assert.equal(new URL(base).origin, "http://127.0.0.1:3115", "Use the isolated local auth test environment.");
const fixture = await startAuthFixture();
const browser = await chromium.launch({ headless: true });
const errors = [], results = [], violations = [];
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await seedSession(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  for (const size of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844},{width:320,height:640}]) {
    await page.setViewportSize(size);
    for (const theme of ["light","dark"]) {
      await page.addInitScript((theme) => localStorage.setItem("ohmi-preferences", JSON.stringify({theme,reduceMotion:true})), theme);
      assert.equal((await page.goto(base + "/library/")).status(), 200);
      await page.getByRole("heading", {name:"Circuit Library",exact:true}).waitFor();
      await page.waitForFunction(() => document.querySelectorAll(".library-card").length === 20);
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.locator(".library-art img").first().waitFor();
      await page.waitForFunction(() => document.querySelector(".library-art img")?.naturalWidth > 0);
      await page.screenshot({path:fileURLToPath(new URL("home-"+size.width+"-"+theme+".png",output))});
      const axe = await new AxeBuilder({page}).include("#main").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
      violations.push(...axe.violations.map((v) => ({size,theme,id:v.id,nodes:v.nodes.map((n)=>n.target)})));
      await page.getByRole("button",{name:"Sensors",exact:true}).click();
      await page.waitForFunction((count) => document.querySelectorAll(".library-card").length === count, 3);
      assert.equal(await page.locator(".library-card").count(),3);
      assert.match(page.url(),/category=Sensors/);
      if(size.width===1440 && theme==="light") await page.screenshot({path:fileURLToPath(new URL("sensors-light.png",output))});
      await page.getByRole("button",{name:"All components",exact:true}).click();
      await page.getByLabel("Find a component").fill("RGB");
      await page.waitForFunction((count) => document.querySelectorAll(".library-card").length === count, 1);
      assert.equal(await page.locator(".library-card").count(),1);
      await page.reload();
      await page.getByRole("heading",{name:"RGB LED",exact:true}).waitFor();
      assert.equal(await page.getByLabel("Find a component").inputValue(),"RGB");
      await page.locator(".library-card").click();
      await page.getByRole("heading",{name:"Wiring & technical reference",exact:true}).waitFor();
      assert.equal(await page.locator(".library-reference>a").getAttribute("target"),"_blank");
      const detailAxe=await new AxeBuilder({page}).include("#main").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
      violations.push(...detailAxe.violations.map((v)=>({size,theme,detail:true,id:v.id,nodes:v.nodes.map((n)=>n.target)})));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({path:fileURLToPath(new URL("detail-"+size.width+"-"+theme+".png",output)),fullPage:true});
      await page.goBack();
      assert.equal(await page.getByLabel("Find a component").inputValue(),"RGB");
      await page.getByLabel("Find a component").fill("no-such-part");
      await page.getByRole("heading",{name:"No matching components"}).waitFor();
      await page.getByRole("button",{name:"Clear filters"}).click();
      await page.waitForFunction((count) => document.querySelectorAll(".library-card").length === count, 20);
      assert.equal(await page.locator(".library-card").count(),20);
      if(size.width<768) {
        assert.equal(await page.locator(".bottom-nav .nav-item").count(),5);
        await page.getByRole("button",{name:"More navigation",exact:true}).click();
        const dialog=page.getByRole("dialog");
        await dialog.getByRole("link",{name:"Library",exact:true}).waitFor();
        const box=await dialog.boundingBox();
        assert.ok(box.x>=-1 && box.x+box.width<=size.width+1);
        await page.keyboard.press("Escape");
      }
      results.push(size.width+"px "+theme+": search, categories, URL restore, details, empty state, accessibility and navigation");
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  for(const item of entries) {
    assert.equal((await page.goto(base+"/library/"+item.id+"/")).status(),200);
    await page.getByRole("heading",{name:item.name,exact:true,level:1}).waitFor();
    await page.waitForFunction(() => {
      const image=document.querySelector(".library-portrait img");
      return image?.complete && image.naturalWidth>0;
    });
    assert.equal(await page.locator(".library-reference>a").getAttribute("href"),item.wiringSource);
  }
  await page.goto(base+"/library/?q=red%20green&category=Outputs");
  await page.waitForFunction((count) => document.querySelectorAll(".library-card").length === count, 1);
      assert.equal(await page.locator(".library-card").count(),1);
  await page.goto(base+"/library/?category=unknown");
  await page.waitForFunction((count) => document.querySelectorAll(".library-card").length === count, 20);
      assert.equal(await page.locator(".library-card").count(),20);
  await page.goto(base+"/library/");
  for(const card of await page.locator(".library-card").all()){
    await card.scrollIntoViewIfNeeded();
    await card.locator("img").evaluate((img)=>img.decode());
  }
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:fileURLToPath(new URL("collection-desktop.png",output)),fullPage:true});
  await page.goto(base+"/library/led/");
  await page.getByRole("heading",{name:"LED",exact:true,level:1}).waitFor();
  await page.screenshot({path:fileURLToPath(new URL("led-schematic.png",output)),fullPage:true});
  await page.goto(base+"/library/");
  await page.getByLabel("Find a component").focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),"All components");
  results.push("All 20 detail routes and illustration decodes pass; multiword search and invalid-category fallback pass; keyboard flow passes");
  const failureContext=await browser.newContext();
  await seedSession(failureContext);
  const failurePage=await failureContext.newPage();
  await failurePage.route(/_next\/image.*(?:led|resistor)/,(route)=>route.abort());
  await failurePage.goto(base+"/library/led/");
  await failurePage.getByRole("img",{name:"LED illustration unavailable",exact:true}).waitFor();
  await failurePage.getByRole("heading",{name:"Use it with care"}).waitFor();
  results.push("Image failure keeps the full guide usable");
  await failureContext.close();
  assert.deepEqual(errors,[]);
  assert.deepEqual(violations,[]);
  await writeFile(new URL("report.json",output),JSON.stringify({results,errors,violations},null,2));
  console.log(results.join("\n"));
} finally { await browser.close(); await fixture.close(); }
