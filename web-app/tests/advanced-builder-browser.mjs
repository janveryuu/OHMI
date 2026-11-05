import { chromium } from "playwright";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { generateCircuit, parseCircuitIntent } from "../src/lib/playground/circuit-generator.ts";

const origin = process.env.OHMI_TEST_ORIGIN || "http://127.0.0.1:3140";
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror",e=>console.log("ERROR",e.stack));
  await page.route(origin + "/app/advanced-engine/", r => r.fulfill({ contentType: "text/html", body: '<iframe style="width:100%;height:950px" sandbox="allow-scripts" src="/app/vendor/design-electronics/index.html"></iframe>' }));
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const frame = document.querySelector("iframe");
    frame?.addEventListener("load", () => {
      const ch = new MessageChannel(); window.port = ch.port1; window.seq = 0; window.results = [];
      ch.port1.onmessage = ({data}) => { window.results.push(data); if (data.kind === "ready") window.ready = true; };
      ch.port1.start(); frame.contentWindow.postMessage({kind:"ohmi-engine-init",protocol:1,nonce:"a".repeat(32)},"*",[ch.port2]);
    });
  }));
  await page.goto(origin + "/app/advanced-engine/");
  await page.waitForFunction(() => window.ready, { timeout: 45000 });
  const call = request => page.evaluate(async request => {
    const id = ++window.seq;
    window.port.postMessage({ protocol:1,nonce:"a".repeat(32),id,request });
    for (let i=0;i<1500;i++) { const r=window.results.find(r=>r.id===id); if(r){if(!r.ok)throw Error(r.error);return r.result;} await new Promise(r=>setTimeout(r,10)); }
    throw Error("Native operation timeout");
  }, request);
  const clean = result => {
    assert.equal(result.observations.samples.length, 80);
    for (const s of result.observations.samples) { assert.deepEqual(s.errors,[]); assert.deepEqual(s.warnings,[]); assert.deepEqual(s.damaged,[]); }
  };
  for (const prompt of [
    "Build Arduino with eight LEDs",
    "Build potentiometer-controlled LED brightness",
    "Build LDR automatic night light",
    "Build pushbutton-controlled alarm",
    "Build 74HC595 eight LED running lights",
  ]) {
    const c = generateCircuit(parseCircuitIntent(prompt));
    const prepared = await call({ operation:"prepare",document:c.document });
    clean(prepared);
    assert.ok(prepared.document.parts.some(p=>p.type==="breadboard"));
    assert.equal(prepared.mounted, prepared.document.parts.filter(p=>!["arduino_uno","breadboard","battery"].includes(p.type)).length);
    const leds = prepared.document.parts.filter(p=>p.type==="led");
    if (["standard_led","shift_register"].includes(c.intent.circuitType)) {
      for(const led of leds) assert.ok(prepared.observations.samples.some(s=>(s.leds[led.id]||0)>0.1), "LED never lit: "+led.id);
    }
    // Sensor endpoints and button contacts must change the actual solved output.
    for (const [type, property, values] of [["potentiometer","wiper",["0","100"]],["photocell","light",["0","100"]],["pushbutton","pressed",["no","yes"]]]) {
      const input = prepared.document.parts.find(p=>p.type===type); if(!input)continue;
      const observed=[];
      for(const value of values){
        const doc=structuredClone(prepared.document);doc.parts.find(p=>p.id===input.id).props[property]=value;
        // Observe saved geometry directly, without repacking or changing the student's document.
        await call({operation:"open",document:doc});
        const observation=await call({operation:"observe",seconds:4});clean({observations:observation});
        observed.push(Math.max(...observation.samples.slice(8).map(s=>Math.max(0,...Object.values(s.leds)))));
        if(type==="pushbutton") {
          const maxActivity=Math.max(...observation.samples.slice(8).map(s=>Math.max(0,...Object.values(s.activity))));
          assert.ok(value==="yes"?maxActivity>0.1:maxActivity===0,"Alarm state does not match button");
        }
      }
      assert.ok(observed[0]!==observed[1], type+" does not change LED output: "+observed);
      if(type==="photocell") assert.ok(observed[0]>observed[1],"Night light must illuminate in darkness");
    }
    await call({operation:"open",document:prepared.document}); await call({operation:"zoom",direction:"fit"});
    if(c.intent.circuitType==="shift_register")await page.screenshot({path:fileURLToPath(new URL("../../docs/playground-upgrade/evidence/advanced-breadboard.png",import.meta.url))});
    report.push({ prompt, parts:prepared.document.parts.length,mounted:prepared.mounted,samples:80,passed:true });
    console.log("PASS",prompt);
  }
  assert.throws(()=>generateCircuit(parseCircuitIntent("Build CpE 413 FMSS Uno two 7-segment displays two buttons four 1k resistors counting 00 to 99")),/four 1 kΩ/);
  report.push({benchmark:"FMSS",status:"blocked: unspecified display and insufficient conventional segment resistors; no substitute"});
  await writeFile(new URL("../../docs/playground-upgrade/evidence/advanced-builder.json",import.meta.url),JSON.stringify(report,null,2));
} finally { await browser.close(); }
