import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startAuthFixture, seedSession, otherUser } from "./auth-fixture.mjs";

const origin = process.env.OHMI_TEST_ORIGIN || "http://127.0.0.1:3140";
const evidence = new URL("../../docs/playground-upgrade/evidence/",import.meta.url);
await mkdir(evidence,{recursive:true});
const browser = await chromium.launch({headless:true});
let fixture;
const report = {checks:[],errors:[]};
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  page.on("pageerror",error=>report.errors.push(error.message));
  page.on("console",msg=>{if(msg.type()==="error") console.log("browser:",msg.text().slice(0,400));});
  await page.route(origin+"/app/engine-test/",route=>route.fulfill({contentType:"text/html",body:'<!doctype html><html lang="en"><title>Engine test harness</title><iframe title="Test editor" sandbox="allow-scripts allow-downloads" style="width:100%;height:900px" src="/app/vendor/design-electronics/index.html"></iframe></html>'}));
  await page.addInitScript(() => {
    window.engineReplies=[];
    window.addEventListener("DOMContentLoaded",()=>{
      const frame=document.querySelector("iframe"); if(!frame) return;
      frame.addEventListener("load",()=>{
        const channel=new MessageChannel(); window.enginePort=channel.port1; window.engineSequence=0;
        channel.port1.onmessage=({data})=>{window.engineReplies.push(data); if(data.kind==="ready") window.engineReady=data.result;};
        channel.port1.start();
        frame.contentWindow.postMessage({kind:"ohmi-engine-init",protocol:1,nonce:"a".repeat(32)},"*",[channel.port2]);
      });
    });
  });
  await page.goto(origin+"/app/engine-test/");
  await page.waitForFunction(()=>window.engineReady,{timeout:45000});
  report.status=await page.evaluate(()=>window.engineReady);
  assert.ok(report.status.catalogCount>=791);
  const call = request=>page.evaluate(async request=>{
    const id=++window.engineSequence;
    window.enginePort.postMessage({protocol:1,nonce:"a".repeat(32),id,request});
    const start=Date.now();
    while(Date.now()-start<15000){const result=window.engineReplies.find(item=>item.id===id);if(result){if(!result.ok)throw new Error(result.error);return result.result?.buffer instanceof ArrayBuffer ? {bytes:result.result.buffer.byteLength,signature:Array.from(new Uint8Array(result.result.buffer).slice(0,4))} : result.result;}await new Promise(resolve=>setTimeout(resolve,20));}
    throw new Error("Bridge timed out");
  },request);
  for (const name of ["uno-blink","uno-traffic-light"]) {
    const document=JSON.parse(await readFile(new URL(name+".dez",evidence),"utf8"));
    await call({operation:"open",document});
    const observed=await call({operation:"observe",seconds:4});
    report[name]=observed;
    assert.ok(observed.samples.every(sample=>!sample.errors.length&&!sample.damaged.length));
    const ledIds=document.parts.filter(part=>part.type.includes("led")).map(part=>String(part.id));
    const stateAt=time=>observed.samples.reduce((best,item)=>Math.abs(item.time-time)<Math.abs(best.time-time)?item:best).leds;
    if(name==="uno-blink") for(const [time,on]of [[.25,true],[.75,false],[1.25,true],[1.75,false]])assert.equal(stateAt(time)[ledIds[0]]>.1,on);
    else for(const [time,index]of [[.25,0],[1.25,1],[2.25,2],[3.25,0]])assert.deepEqual(ledIds.map(id=>stateAt(time)[id]>.1),ledIds.map((_,i)=>i===index));
    const snapshot=await call({operation:"snapshot"});
    assert.equal(snapshot.parts.length,document.parts.length); assert.equal(snapshot.wires.length,document.wires.length);
    assert.equal(snapshot.parts[0].code,document.parts[0].code);
    await call({operation:"open",document:snapshot});
    report.checks.push(name+" simulation and editable roundtrip");
  }
  const snapshot=await call({operation:"snapshot"});
  const moved=await call({operation:"tool",name:"move_part",arguments:{part:snapshot.parts[0].id,view:"breadboard",x:123,y:456}});
  assert.ok(moved);
  const afterMove=await call({operation:"snapshot"});
  assert.notDeepEqual(afterMove.parts[0].views,snapshot.parts[0].views);
  await call({operation:"undo"});
  assert.deepEqual((await call({operation:"snapshot"})).parts[0].views,snapshot.parts[0].views);
  await call({operation:"redo"});
  assert.deepEqual((await call({operation:"snapshot"})).parts[0].views,afterMove.parts[0].views);
  await call({operation:"open",document:snapshot});
  report.checks.push("native document edits, undo and redo");
  const bad=structuredClone(snapshot);bad.wires[0].from={part:9999,pin:"missing"};
  await assert.rejects(()=>call({operation:"open",document:bad}),/terminal/);
  assert.equal((await call({operation:"snapshot"})).wires.length,snapshot.wires.length);
  await assert.rejects(()=>call({operation:"tool",name:"open_design",arguments:{path:"/private"}}),/allowed/);
  await assert.rejects(()=>call({operation:"observe",seconds:6}),/Observation/);
  const invalid=structuredClone(snapshot);invalid.parts[0].code="void setup( { definitely invalid";
  await call({operation:"open",document:invalid});
  const errors=await call({operation:"observe",seconds:.1});
  assert.ok(errors.samples.some(sample=>sample.errors.length));
  await call({operation:"open",document:snapshot});
  report.checks.push("invalid sketch reports error and engine recovers; bad terminals and path tools rejected");
  for(const view of [0,1,2]) { await call({operation:"view",view}); }
  for(const format of ["svg","bom","netlist","spice","gerber"]) {
    if(format==="gerber") {
      await assert.rejects(()=>call({operation:"export",format,view:"pcb"}),/PCB board/);
      await call({operation:"tool",name:"add_part",arguments:{type:"pcb_board",properties:{width:"100",height:"80"}}});
    }
    const exported=await call({operation:"export",format,view:"breadboard"});
    assert.ok(exported); if(format==="gerber"){assert.ok(exported.bytes>0);assert.deepEqual(exported.signature,[80,75,3,4]);}
  }
  report.checks.push("three views and five export formats");
  const isolated=await page.frames()[1].evaluate(()=>{try{void parent.document;return false;}catch{return true;}});
  assert.equal(isolated,true);
  report.checks.push("opaque sandbox denies parent DOM access");
  // Full engine self-tests run in a separate runtime, without UI startup.
  const selftest=await context.newPage();
  await selftest.route(origin+"/app/engine-selftest/",route=>route.fulfill({contentType:"text/html",body:`<!doctype html><title>WASM selftest</title><canvas id="canvas"></canvas><script>window.auditLog=[];window.Module={canvas:document.getElementById('canvas'),locateFile:n=>'/app/vendor/design-electronics/'+n,print:t=>auditLog.push(t),printErr:t=>auditLog.push(t),onRuntimeInitialized(){try{window.auditCode=Module.callMain(['--selftest']);}catch(e){window.auditException=String(e);}finally{window.auditDone=true;}}};</script><script src="/app/vendor/design-electronics/designElectronics.js"></script>`}));
  await selftest.goto(origin+"/app/engine-selftest/");await selftest.waitForFunction(()=>window.auditDone,{timeout:60000});
  report.selftest=await selftest.evaluate(()=>({code:window.auditCode,exception:window.auditException,log:window.auditLog}));
  assert.equal(report.selftest.code,0,JSON.stringify(report.selftest).slice(-2000));
  await selftest.close();
  fixture=await startAuthFixture();
  const ui=await browser.newContext({viewport:{width:1440,height:1100}});
  await ui.route("http://127.0.0.1:54329/**",async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),"access-control-allow-origin":origin}});});
  await seedSession(ui);
  const app=await ui.newPage(); app.on("pageerror",error=>report.errors.push(error.message));
  await app.goto(origin+"/app/playground/electronics/");
  await app.getByRole("button",{name:"Download .dez",exact:true}).waitFor();
  await app.waitForFunction(()=>!Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="Download .dez")?.disabled,{timeout:45000});
  await app.getByRole("button",{name:"Schematic",exact:true}).click();
  await app.getByRole("button",{name:"Run",exact:true}).click();
  await app.getByRole("button",{name:"Stop",exact:true}).click();
  await app.getByRole("button",{name:"Undo",exact:true}).focus();
  await app.keyboard.press("Enter");
  const download=app.waitForEvent("download");await app.getByRole("button",{name:"Download .dez",exact:true}).click();assert.equal((await download).suggestedFilename(),"ohmi-circuit.dez");
  for(const [name,width,height]of [["desktop-light",1440,1100],["tablet-light",820,1180],["mobile-light",390,844],["desktop-dark",1440,1100]]) {
    await app.setViewportSize({width,height});
    if(name.endsWith("dark"))await app.evaluate(()=>document.documentElement.dataset.theme="dark");
    await app.screenshot({path:fileURLToPath(new URL("m1-"+name+".png",evidence)),fullPage:true});
    assert.ok(await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+" horizontal overflow");
  }
  report.checks.push("authenticated OHMI route, controls, download, desktop/tablet/mobile layouts, theme sync");
  const previousFrame=app.frames().find(frame=>frame.url().includes("vendor/design-electronics/index.html"));
  app.on("dialog",dialog=>dialog.accept());
  await ui.clearCookies(); await seedSession(ui,otherUser); await app.reload();
  await app.waitForFunction(()=>!Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="Download .dez")?.disabled,{timeout:45000});
  assert.equal(previousFrame.isDetached(),true);
  report.checks.push("account change reload destroys the previous engine runtime");
  app.removeAllListeners("dialog");
  app.once("dialog",dialog=>dialog.accept());
  await app.locator('input[type="file"]').setInputFiles(fileURLToPath(new URL("uno-blink.dez",evidence)));
  await app.getByRole("status").filter({hasText:"Circuit opened"}).waitFor();
  const retainedFrame=app.frames().find(frame=>frame.url().includes("vendor/design-electronics/index.html"));
  const retainedDocument=await retainedFrame.evaluate(()=>JSON.parse(Module.ccall("de_ohmi_dispatch","string",["string"],['{"operation":"snapshot"}'])).result);
  await app.getByRole("link",{name:"Ask OHMI",exact:true}).click();
  await app.getByRole("button",{name:"Keep building",exact:true}).click();
  await app.waitForTimeout(150);
  assert.equal(retainedFrame.isDetached(),false);
  assert.ok(app.url().endsWith("/playground/electronics/"));
  const afterCanceledLink=await retainedFrame.evaluate(()=>JSON.parse(Module.ccall("de_ohmi_dispatch","string",["string"],['{"operation":"snapshot"}'])).result);
  assert.deepEqual(afterCanceledLink.parts,retainedDocument.parts);assert.deepEqual(afterCanceledLink.wires,retainedDocument.wires);
  await app.evaluate(()=>history.back());
  await app.getByRole("button",{name:"Keep building",exact:true}).click();
  await app.waitForTimeout(150);
  assert.equal(retainedFrame.isDetached(),false);
  assert.ok(app.url().endsWith("/playground/electronics/"));
  await app.getByRole("link",{name:"Ask OHMI",exact:true}).click();
  await app.getByRole("button",{name:"Leave Playground",exact:true}).click();
  await app.waitForURL("**/app/ask/");
  await app.locator('iframe[title="designElectronics circuit editor"]').waitFor({state:"detached"});
  assert.equal(retainedFrame.isDetached(),true);
  await app.goto(origin+"/app/playground/electronics/");
  await app.waitForFunction(()=>!Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="Download .dez")?.disabled,{timeout:45000});
  await app.evaluate(()=>history.back());
  await app.getByRole("button",{name:"Leave Playground",exact:true}).click();
  await app.waitForURL("**/app/ask/");
  await app.locator('iframe[title="designElectronics circuit editor"]').waitFor({state:"detached"});
  report.checks.push("canceling internal navigation and browser Back retains runtime; confirmed exit succeeds");
  assert.deepEqual(report.errors,[]);
  console.log(JSON.stringify({status:report.status,checks:report.checks,selftest:report.selftest.log.slice(-4)}));
} finally {
  await writeFile(new URL("m1-browser.json",evidence),JSON.stringify(report,null,2));
  for(const context of browser.contexts())await context.unrouteAll({behavior:'wait'});
  await browser.close(); if(fixture)await fixture.close();
}
