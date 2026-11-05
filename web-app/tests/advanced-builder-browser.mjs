import { chromium } from "playwright";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { writeFile, mkdir } from "node:fs/promises";
import { generateCircuit, parseCircuitIntent } from "../src/lib/playground/circuit-generator.ts";

const origin = process.env.OHMI_TEST_ORIGIN || "http://127.0.0.1:3140";
const browser = await chromium.launch({ headless: true });
const report = [];
const writeEvidence = process.env.OHMI_TEST_WRITE_EVIDENCE !== "0";
const projects = new URL("../../docs/playground-upgrade/real-projects/",import.meta.url);
if(writeEvidence) await mkdir(projects,{recursive:true});
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
    "Build Arduino with five LEDs",
    "Build Arduino with eight LEDs",
    "Build Arduino traffic light",
    "Build two-digit 7-segment decimal counter 00 to 99",
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
      const input = prepared.document.parts.find(p=>p.type===type); if(!input || c.intent.circuitType === "decimal_counter")continue;
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
    if(c.intent.circuitType === "traffic_light") {
      const result=await call({operation:"probe",document:prepared.document,seconds:14,sampleMs:50,events:[]});
      for(const led of leds) assert.ok(result.samples.some(s=>(s.leds[led.id]||0)>.1),"Traffic phase never lights");
      for(const s of result.samples){assert.deepEqual(s.errors,[]);assert.deepEqual(s.warnings,[]);assert.deepEqual(s.damaged,[]);}
    }
    if(c.intent.circuitType === "decimal_counter") {
      const buttons=prepared.document.parts.filter(p=>p.type==="pushbutton");
      const [add,subtract]=buttons.map(p=>p.id);
      const probe=async(events,seconds=1,sampleMs=50)=>{
        const result=await call({operation:"probe",document:prepared.document,seconds,sampleMs,events});
        for(const sample of result.samples){assert.deepEqual(sample.errors,[]);assert.deepEqual(sample.warnings,[]);assert.deepEqual(sample.damaged,[]);}
        return result.samples;
      };
      const counts=samples=>samples.flatMap(s=>Object.values(s.serial).flatMap(text=>text.trim().split(/\s+/).filter(Boolean).map(Number)));
      const bounce=await probe([{at:.1,pressed:[add]},{at:.105,pressed:[]},{at:.11,pressed:[add]},{at:.115,pressed:[]},{at:.12,pressed:[add]},{at:.5,pressed:[]}]);
      assert.deepEqual(counts(bounce),[0,1],"bounce/hold must increment once");
      const simultaneous=await probe([{at:.1,pressed:[add,subtract]},{at:.5,pressed:[]}]);assert.deepEqual(counts(simultaneous),[0]);
      const pulses=[];for(let i=0;i<105;i++){pulses.push({at:.1+i*.08,pressed:[add]},{at:.14+i*.08,pressed:[]});}
      const up=await probe(pulses,8.6);assert.deepEqual(counts(up),Array.from({length:100},(_,i)=>i));
      const downEvents=[...pulses];for(let i=0;i<105;i++)downEvents.push({at:8.6+i*.08,pressed:[subtract]},{at:8.64+i*.08,pressed:[]});
      const down=await probe(downEvents,17.2);const sequence=counts(down);assert.deepEqual(sequence,[...Array.from({length:100},(_,i)=>i),...Array.from({length:99},(_,i)=>98-i)]);
      const displays=prepared.document.parts.filter(p=>p.type==="seg7_cc");
      for(const display of displays){const levels=up.at(-1).segments[display.id];assert.equal(levels.reduce((mask,v,i)=>mask|(v>.01?1<<i:0),0),111,"99 segment mask");}
      const fast=await probe([],0.2,1);const lit=fast.map(s=>displays.map(d=>Math.max(...s.segments[d.id])>.01));
      assert.ok(lit.every(pair=>!pair.every(Boolean)),"both digits must not conduct simultaneously");
      const starts=lit.flatMap((pair,i)=>pair[0] && (i===0||!lit[i-1][0]) ? [fast[i].time] : []);
      assert.ok(starts.length>20,"display scan must refresh repeatedly");
      report.push({counter:{incrementTrace:counts(up),roundTripTrace:sequence,segmentLevelsAt99:up.at(-1).segments,countsUpTo99:true,clampsBothEnds:true,debounce:true,holdOnce:true,simultaneousIgnored:true,segment99:111,refreshStarts:starts.length,refreshHz:starts.length/.2,probeSamples:down.length}});
    }
    const slug=c.intent.circuitType+"-"+(c.intent.circuitType==="standard_led"?leds.length:"project");
    if(writeEvidence) await writeFile(new URL(slug+".dez",projects),JSON.stringify(prepared.document,null,2));
    if(writeEvidence) await writeFile(new URL(slug+".ino",projects),c.arduinoCode);
    await call({operation:"open",document:prepared.document}); await call({operation:"zoom",direction:"fit"});
    if(writeEvidence && c.intent.circuitType==="decimal_counter"){
      await call({operation:"running",running:true});await page.waitForTimeout(250);
      await page.screenshot({path:fileURLToPath(new URL("../../docs/playground-upgrade/evidence/real-counter.png",import.meta.url))});
      await call({operation:"running",running:false});
    }
    if(writeEvidence && c.intent.circuitType==="shift_register")await page.screenshot({path:fileURLToPath(new URL("../../docs/playground-upgrade/evidence/real-breadboard.png",import.meta.url))});
    report.push({ prompt, parts:prepared.document.parts.length,mounted:prepared.mounted,samples:80,passed:true });
    console.log("PASS",prompt);
  }

  console.log(JSON.stringify(report));
  if(writeEvidence) await writeFile(new URL("../../docs/playground-upgrade/evidence/real-builder.json",import.meta.url),JSON.stringify(report,null,2));
} finally { await browser.close(); }
