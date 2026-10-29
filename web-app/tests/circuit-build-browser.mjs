import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
  startAuthFixture,
  seedSession,
  testUser,
  otherUser,
} from "./auth-fixture.mjs";
import { buildFixture } from "./circuit-build-fixtures.mjs";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
const origin = process.env.OHMI_TEST_ORIGIN || "http://127.0.0.1:3140",
  evidence = new URL(
    "../../docs/playground-upgrade/evidence/",
    import.meta.url,
  );
const fixture = await startAuthFixture(),
  browser = await chromium.launch({ headless: true }),
  report = { checks: [], errors: [] };
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  await seedSession(context);
  await context.route("http://127.0.0.1:54329/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "access-control-allow-origin": origin },
    });
  });
  const conversationId = "22222222-2222-4222-8222-222222222222";
  fixture.state.ai = {
    conversationId,
    messages: [],
    jobs: [],
    posts: [],
    buildSpec: await buildFixture(),
  };
  fixture.state.electronics = { projects: new Map(), legacy: new Map() };
  const headers = { Origin: origin, "X-OHMI-Account": testUser.id };
  const api = (method, path = "", data, custom = headers) =>
    context.request.fetch(origin + "/app/api/playground/build/" + path, {
      method,
      headers: custom,
      ...(data ? { data } : {}),
    });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(origin + "/app/ask/");
  await page
    .locator('textarea[name="message"]')
    .fill("Keep my unrelated chat draft.");
  await page.getByText("Build a circuit with OHMI", { exact: true }).click();
  await page
    .getByLabel("Describe your circuit")
    .fill("Build Uno LED blink 500 ms on and 500 ms off.");
  await page
    .getByRole("button", { name: "Build new draft", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open new editable draft", exact: true })
    .waitFor({ timeout: 40000 });
  assert.equal(fixture.state.ai.providerCalls, 1);
  assert.equal(
    await page.getByRole("list", { name: "Planner caveats" }).innerText(),
    "Use the stated series resistor. Simulator results do not verify hardware.",
  );
  assert.equal(
    await page.locator('textarea[name="message"]').inputValue(),
    "Keep my unrelated chat draft.",
  );
  assert.equal(fixture.state.ai.providerBody.model, "openai/gpt-oss-120b");
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(350);
  await page.screenshot({
    path: fileURLToPath(new URL("m3-ask-light.png", evidence)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Toggle appearance", exact: true })
    .click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: fileURLToPath(new URL("m3-ask-mobile-dark.png", evidence)),
    fullPage: true,
  });
  await page
    .locator("summary")
    .filter({ hasText: "Build a circuit with OHMI" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL("m3-build-mobile-viewport.png", evidence)),
  });
  const accessibility = await new AxeBuilder({ page })
    .include("details:has(#circuit-build-prompt)")
    .analyze();
  assert.deepEqual(accessibility.violations, []);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  const first = fixture.state.ai.posts[0],
    firstId = first.requestId;
  const replay = await api("POST", "", {
    requestId: firstId,
    conversationId,
    language: first.language,
    message: first.message,
  });
  assert.equal(replay.status(), 200);
  assert.equal(fixture.state.ai.providerCalls, 1);
  assert.equal(
    (
      await api("POST", "", {
        requestId: firstId,
        conversationId,
        language: "english",
        message: "different",
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await api(
        "POST",
        "",
        {
          requestId: crypto.randomUUID(),
          conversationId,
          language: "english",
          message: "test",
        },
        { ...headers, Origin: "https://evil.test" },
      )
    ).status(),
    400,
  );
  assert.equal(
    (
      await api("GET", "?id=" + firstId, undefined, {
        ...headers,
        "X-OHMI-Account": otherUser.id,
      })
    ).status(),
    400,
  );
  report.checks.push(
    "explicit Ask Build, fixed strict120B mock, single call/replay, CSRF and account binding",
  );
  await page
    .getByRole("link", { name: "Open new editable draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Open requested AI draft" }).waitFor();
  await page
    .waitForFunction(() => !document.querySelector("button")?.disabled)
    .catch(() => {});
  page.on("dialog", (d) => {
    if (d.message().includes("Open a new AI draft?"))
      assert.ok(
        d.message().includes("Planner caveat: Use the stated series resistor."),
      );
    return d.accept();
  });
  await page
    .getByRole("button", { name: "Open requested AI draft" })
    .click({ timeout: 45000 });
  await page
    .getByRole("status")
    .filter({ hasText: "New editable draft opened" })
    .waitFor({ timeout: 45000 });
  await page
    .getByText("Engine observations from the opened draft", { exact: true })
    .click();
  assert.equal(await page.getByRole("table").getByRole("row").count(), 81);
  await page
    .getByText("Engine observations from the opened draft", { exact: true })
    .click();
  const download = async (name) => {
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const file = await event;
    return readFile(await file.path(), "utf8");
  };
  const dez = JSON.parse(await download("Download .dez")),
    ino = await download("Download .ino");
  assert.equal(ino, fixture.state.ai.buildSpec.parts[0].sketch);
  assert.equal(dez.parts.length, 3);
  assert.equal(dez.wires.length, 9);
  await page.getByText("Private projects", { exact: true }).click();
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: /Captured circuit saved/ })
    .waitFor({ timeout: 10000 });
  const saved = [...fixture.state.electronics.projects.values()][0];
  assert.equal(saved.document.parts[0].code, ino);
  await page
    .getByRole("button", { name: "Open " + saved.name, exact: true })
    .click();
  assert.equal(await download("Download .ino"), ino);
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.waitForTimeout(350);
  await page.screenshot({
    path: fileURLToPath(new URL("m3-workspace-dark.png", evidence)),
    fullPage: true,
  });
  report.checks.push(
    "Ask handoff, scratch compile, actual4s observations, editable native draft, private save/reopen, exact .ino/.dez",
  );
  // A/B compile and observations use the same shipped WASM, through the production protocol.
  await page.route(origin + "/app/m3-engine/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<iframe title="engine" sandbox="allow-scripts allow-downloads" src="/app/vendor/design-electronics/index.html"></iframe>',
    }),
  );
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const frame = document.querySelector("iframe");
      if (!frame) return;
      frame.addEventListener("load", () => {
        const ch = new MessageChannel();
        window.replies = [];
        window.seq = 0;
        window.port = ch.port1;
        ch.port1.onmessage = ({ data }) => {
          window.replies.push(data);
          if (data.kind === "ready") window.ready = true;
        };
        ch.port1.start();
        frame.contentWindow.postMessage(
          { kind: "ohmi-engine-init", protocol: 1, nonce: "a".repeat(32) },
          "*",
          [ch.port2],
        );
      });
    });
  });
  await page.goto(origin + "/app/m3-engine/");
  await page.waitForFunction(() => window.ready, { timeout: 45000 });
  const call = (request) =>
    page.evaluate(async (request) => {
      const id = ++window.seq;
      window.port.postMessage({
        protocol: 1,
        nonce: "a".repeat(32),
        id,
        request,
      });
      for (let i = 0; i < 1500; i++) {
        const result = window.replies.find((r) => r.id === id);
        if (result) {
          if (!result.ok) throw Error(result.error);
          return result.result;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      throw Error("timeout");
    }, request);
  for (const name of ["uno-blink", "uno-traffic-light"]) {
    fixture.state.ai.buildSpec = await buildFixture(name);
    const id = crypto.randomUUID(),
      response = await api("POST", "", {
        requestId: id,
        conversationId,
        language: "english",
        message: "Synthetic " + name,
      });
    assert.equal(response.status(), 200);
    const result = (await response.json()).result;
    const before = await call({ operation: "capture" }),
      compiled = await call({ operation: "compile", spec: result.circuitSpec });
    const after = await call({ operation: "capture" });
    delete before.document.saved;
    delete after.document.saved;
    assert.deepEqual(after, before);
    const samples = compiled.observations.samples;
    assert.equal(samples.length, 80);
    assert.ok(
      samples.every(
        (s) => !s.errors.length && !s.warnings.length && !s.damaged.length,
      ),
    );
    const leds = compiled.document.parts
      .filter((p) => p.type === "led")
      .map((p) => String(p.id));
    const at = (time) =>
      samples.reduce((best, s) =>
        Math.abs(s.time - time) < Math.abs(best.time - time) ? s : best,
      ).leds;
    if (name === "uno-blink")
      for (const [time, on] of [
        [0.25, true],
        [0.75, false],
        [1.25, true],
        [1.75, false],
      ])
        assert.equal(at(time)[leds[0]] > 0.1, on);
    else
      for (const [time, index] of [
        [0.25, 0],
        [1.25, 1],
        [2.25, 2],
        [3.25, 0],
      ])
        assert.deepEqual(
          leds.map((id) => at(time)[id] > 0.1),
          leds.map((_, i) => i === index),
        );
    await call({ operation: "open", document: compiled.document });
    let snapshot = await call({ operation: "snapshot" });
    assert.equal(snapshot.parts[0].code, result.circuitSpec.parts[0].sketch);
    await call({
      operation: "tool",
      name: "move_part",
      arguments: {
        part: snapshot.parts[0].id,
        x: 200,
        y: 300,
        view: "breadboard",
      },
    });
    snapshot = await call({ operation: "snapshot" });
    await call({ operation: "open", document: snapshot });
    assert.equal(
      (await call({ operation: "snapshot" })).parts[0].code,
      result.circuitSpec.parts[0].sketch,
    );
    const saveId = crypto.randomUUID();
    const save = await context.request.post(
      origin + "/app/api/playground/projects/",
      { headers, data: { id: saveId, revision: 0, document: snapshot } },
    );
    assert.equal(save.status(), 200);
    const reopened = await context.request.get(
      origin + "/app/api/playground/projects/?id=" + saveId,
      { headers },
    );
    assert.equal(reopened.status(), 200);
    await call({
      operation: "open",
      document: (await reopened.json()).document,
    });
    assert.equal(
      (await call({ operation: "snapshot" })).parts[0].code,
      result.circuitSpec.parts[0].sketch,
    );
    report[name] = {
      samples,
      parts: snapshot.parts.length,
      wires: snapshot.wires.length,
      sketch: snapshot.parts[0].code,
    };
  }
  report.checks.push(
    "A/B mocked planner to actual WASM, scratch isolation, timing, all3view wiring, edit/reopen, exact sketch",
  );
  const other = await browser.newContext();
  await seedSession(other, otherUser);
  assert.equal(
    (
      await other.request.get(
        origin + "/app/api/playground/build/?id=" + firstId,
        { headers: { "X-OHMI-Account": otherUser.id } },
      )
    ).status(),
    404,
  );
  const anon = await browser.newContext();
  assert.equal(
    (
      await anon.request.get(
        origin + "/app/api/playground/build/?id=" + firstId,
        { headers },
      )
    ).status(),
    401,
  );
  report.checks.push("second account404 and anonymous401");
  // Cancel only stops waiting. Recover the same UUID after refresh, without another provider call.
  await page.goto(origin + "/app/ask/");
  await page.getByText("Build a circuit with OHMI", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByLabel("Describe your circuit")
    .fill("Synthetic pending request");
  fixture.state.ai.providerDelay = 700;
  const count = fixture.state.ai.providerCalls;
  await page
    .getByRole("button", { name: "Build new draft", exact: true })
    .click();
  while (fixture.state.ai.providerCalls === count)
    await new Promise((r) => setTimeout(r, 20));
  await page.getByRole("button", { name: "Stop waiting", exact: true }).click();
  await page
    .getByText(
      "Stopped waiting. The server may finish; check status before starting another build.",
    )
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Build new draft", exact: true })
      .isDisabled(),
    true,
  );
  await page.reload();
  await page.getByText("Build a circuit with OHMI", { exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Build new draft", exact: true })
      .isDisabled(),
    true,
  );
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Check build status" }).click();
  await page
    .getByRole("link", { name: "Open new editable draft", exact: true })
    .waitFor();
  assert.equal(fixture.state.ai.providerCalls, count + 1);
  fixture.state.ai.providerDelay = 700;
  await page.getByLabel("Describe your circuit").fill("Pending account switch");
  await page
    .getByRole("button", { name: "Build new draft", exact: true })
    .click();
  await context.clearCookies();
  await seedSession(context, otherUser);
  await page.reload();
  await page.getByText("Build a circuit with OHMI", { exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Check build status" }).count(),
    0,
  );
  assert.equal(await page.getByLabel("Describe your circuit").inputValue(), "");
  report.checks.push(
    "keyboard build disclosure, preserved unrelated draft, cancellation, refresh recovery with no second call, account switch clears private build UI",
  );
  assert.deepEqual(report.errors, []);
  await writeFile(
    new URL("m3-browser.json", evidence),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({ checks: report.checks, errors: report.errors }, null, 2),
  );
} finally {
  for (const context of browser.contexts())
    await context.unrouteAll({ behavior: "wait" });
  await browser.close();
  await fixture.close();
}
