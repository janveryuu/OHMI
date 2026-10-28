import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  startAuthFixture,
  seedSession,
  testUser,
  otherUser,
} from "./auth-fixture.mjs";
import { legacyFixture } from "./electronics-store-fixture.mjs";
import { convertLegacyProject } from "../src/lib/playground/legacy-conversion.ts";
import { validateElectronicsDocument } from "../src/lib/playground/electronics-document.ts";
const origin = process.env.OHMI_TEST_ORIGIN || "http://127.0.0.1:3140",
  base = origin + "/app/api/playground/projects/";
const evidence = new URL(
  "../../docs/playground-upgrade/evidence/",
  import.meta.url,
);
const document = JSON.parse(
  await readFile(new URL("uno-blink.dez", evidence), "utf8"),
);
const fixture = await startAuthFixture(),
  browser = await chromium.launch({ headless: true });
const report = { checks: [], errors: [] };
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
  const headers = { Origin: origin, "X-OHMI-Account": testUser.id };
  const call = (method, path = "", body, custom = headers) =>
    context.request.fetch(base + path, {
      method,
      headers: custom,
      ...(body ? { data: body } : {}),
    });
  assert.equal((await call("GET")).status(), 503);
  fixture.state.electronics = { projects: new Map(), legacy: new Map() };
  const store = fixture.state.electronics;
  const id = "10000000-0000-4000-8000-000000000001",
    legacyId = "20000000-0000-4000-8000-000000000001";
  const old = {
    id: legacyId,
    user_id: testUser.id,
    name: "Legacy switch",
    project: legacyFixture(),
    revision: 3,
    updated_at: "2026-10-28T00:00:00.000Z",
  };
  store.legacy.set(legacyId, old);
  const original = structuredClone(old);
  const created = await call("POST", "", {
    id,
    revision: 0,
    document,
    user_id: otherUser.id,
  });
  assert.equal(created.status(), 200);
  assert.equal((await created.json()).revision, 1);
  assert.equal(store.projects.get(id).user_id, testUser.id);
  assert.match(created.headers()["cache-control"], /no-store/);
  assert.equal(
    (await call("POST", "", { id, revision: 0, document })).status(),
    409,
  );
  const reopened = await call("GET", "?id=" + id);
  assert.deepEqual((await reopened.json()).document, document);
  assert.equal(
    (await call("POST", "", { id, revision: 1, document })).status(),
    200,
  );
  assert.equal(
    (await call("POST", "", { id, revision: 1, document })).status(),
    409,
  );
  const bad = structuredClone(document);
  bad.wires[0].from.pin = "unknown";
  assert.equal(
    (
      await call("POST", "", {
        id: crypto.randomUUID(),
        revision: 0,
        document: bad,
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await call(
        "POST",
        "",
        { id: crypto.randomUUID(), revision: 0, document },
        { ...headers, Origin: "https://untrusted.example" },
      )
    ).status(),
    400,
  );
  const converted = await call("POST", "", {
    id: crypto.randomUUID(),
    revision: 0,
    legacyId,
    legacyRevision: 3,
  });
  assert.equal(converted.status(), 200);
  const convertedId = (await converted.json()).id;
  assert.equal(store.projects.get(convertedId).source_legacy_id, legacyId);
  assert.deepEqual(
    store.projects.get(convertedId).legacy_snapshot,
    original.project,
  );
  assert.deepEqual(old, original);
  assert.equal(
    (
      await call("POST", "", {
        id: crypto.randomUUID(),
        revision: 0,
        legacyId,
        legacyRevision: 2,
      })
    ).status(),
    409,
  );
  const other = await browser.newContext();
  await seedSession(other, otherUser);
  const otherHeaders = { Origin: origin, "X-OHMI-Account": otherUser.id };
  assert.equal(
    (
      await other.request.get(base + "?id=" + id, { headers: otherHeaders })
    ).status(),
    404,
  );
  assert.equal(
    (
      await other.request.post(base, {
        headers: otherHeaders,
        data: { id, revision: 2, document },
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await other.request.delete(base + "?id=" + id + "&revision=2", {
        headers: otherHeaders,
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await other.request.post(base, {
        headers: otherHeaders,
        data: {
          id: crypto.randomUUID(),
          revision: 0,
          legacyId,
          legacyRevision: 3,
        },
      })
    ).status(),
    404,
  );
  assert.equal(
    (
      await other.request.post(base, {
        headers,
        data: { id: crypto.randomUUID(), revision: 0, document },
      })
    ).status(),
    400,
  );
  const unsigned = await browser.newContext();
  assert.equal((await unsigned.request.get(base, { headers })).status(), 401);
  await unsigned.close();
  await other.close();
  assert.equal(
    (await call("DELETE", "?id=" + id + "&revision=1")).status(),
    409,
  );
  assert.equal(
    (await call("DELETE", "?id=" + id + "&revision=2")).status(),
    200,
  );
  const added = [];
  for (let index = 0; index < 52; index++) {
    const key = "30000000-0000-4000-8000-" + String(index).padStart(12, "0");
    added.push(key);
    store.projects.set(key, {
      id: key,
      user_id: testUser.id,
      name: "Older " + index,
      document,
      engine_commit: store.projects.get(convertedId).engine_commit,
      revision: 1,
      updated_at: "2026-10-27T00:00:00.000Z",
    });
    store.legacy.set(key, {
      ...structuredClone(old),
      id: key,
      name: "Older legacy " + index,
      updated_at: "2026-10-27T00:00:00.000Z",
    });
  }
  for (const prefix of ["", "?legacy=1"]) {
    const first = await (await call("GET", prefix)).json();
    assert.equal(first.projects.length, 50);
    assert.equal(first.hasMore, true);
    const last = first.projects.at(-1),
      next = await (
        await call(
          "GET",
          prefix +
            (prefix ? "&" : "?") +
            "before=" +
            encodeURIComponent(last.updated_at + "|" + last.id),
        )
      ).json();
    assert.equal(
      new Set([...first.projects, ...next.projects].map((row) => row.id)).size,
      53,
    );
    assert.equal(next.hasMore, false);
  }
  for (const key of added) {
    store.projects.delete(key);
    store.legacy.delete(key);
  }
  report.checks.push(
    "authenticated private CRUD, no-store, 409 revisions/duplicate UUID, owner isolation, invalid pins, CSRF, expected-account binding, immutable legacy copy, unsigned denial, unavailable storage 503",
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(origin + "/app/playground/electronics/");
  await page.locator("details summary").click();
  await page.waitForFunction(
    () =>
      !Array.from(window.document.querySelectorAll("button")).find(
        (button) => button.textContent === "Save snapshot",
      )?.disabled,
    { timeout: 45000 },
  );
  let frame = page
    .frames()
    .find((frame) =>
      frame.url().includes("vendor/design-electronics/index.html"),
    );
  const native = (request) =>
    frame.evaluate((request) => {
      const result = JSON.parse(
        Module.ccall(
          "de_ohmi_dispatch",
          "string",
          ["string"],
          [JSON.stringify(request)],
        ),
      );
      if (!result.ok) throw new Error(result.error);
      return result.result;
    }, request);
  const idle = () =>
    page.waitForFunction(
      () =>
        !Array.from(window.document.querySelectorAll("button")).find(
          (button) => button.textContent === "Save snapshot",
        )?.disabled,
    );
  const catalog = JSON.parse(
    await readFile(
      new URL(
        "../src/lib/playground/electronics-catalog.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(await native({ operation: "catalog" }), catalog.entries);
  for (const closed of [false, true]) {
    const old = legacyFixture();
    old.parts[1].closed = closed;
    const copy = convertLegacyProject(old).document;
    await native({ operation: "open", document: copy });
    const observed = await native({ operation: "observe", seconds: 0.25 });
    assert.equal(observed.samples.at(-1).leds["4"] > 0.1, closed);
    assert.ok(
      observed.samples.every(
        (sample) => !sample.errors.length && !sample.damaged.length,
      ),
    );
  }
  for (const [type, props] of [
    ["header_male", { pins: "12" }],
    ["ic_dip", { pins: "7" }],
    ["breadboard", { size: "mini" }],
    ["breadboard", { size: "full+" }],
    [
      "connector",
      {
        rows: "2",
        "pins per row": "8",
        numbering: "Row letter first (A1)",
        extra: "Shield",
      },
    ],
  ]) {
    await native({ operation: "tool", name: "new_design", arguments: {} });
    await native({
      operation: "tool",
      name: "add_part",
      arguments: { type, properties: props },
    });
    const snapshot = await native({ operation: "snapshot" });
    validateElectronicsDocument(snapshot);
    const part = snapshot.parts[0];
    for (const pin of snapshot.library[0].pins) {
      const check = structuredClone(snapshot);
      check.wires = [
        {
          id: check.nextId++,
          view: "breadboard",
          points: [
            [0, 0],
            [100, 100],
          ],
          from: { part: part.id, pin: pin.id },
        },
      ];
      assert.doesNotThrow(
        () => validateElectronicsDocument(check),
        type + " " + pin.id + " " + JSON.stringify(part.props),
      );
    }
  }
  report.checks.push(
    "actual WASM converted switch open/closed behavior; dynamic DIP/header/connector/breadboard pin validation matches native definitions",
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL("uno-blink.dez", evidence)));
  await page
    .getByRole("status")
    .filter({ hasText: "Circuit opened" })
    .waitFor();
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Captured circuit saved as revision 1" })
    .waitFor();
  const saved = [...store.projects.values()].find(
    (row) => row.document.parts[0]?.type === "arduino_uno",
  );
  assert.ok(saved);
  await native({
    operation: "tool",
    name: "move_part",
    arguments: { part: 1, view: "breadboard", x: 500, y: 500 },
  });
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Captured circuit saved as revision 2" })
    .waitFor();
  await page
    .getByRole("button", { name: "Open " + saved.name, exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Opened " + saved.name })
    .waitFor();
  assert.deepEqual(
    (await native({ operation: "snapshot" })).parts[0].views,
    saved.document.parts[0].views,
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download .dez", exact: true })
    .click();
  assert.equal((await download).suggestedFilename(), "ohmi-circuit.dez");
  for (const [name, width, height] of [
    ["desktop-light", 1440, 1100],
    ["mobile-light", 390, 844],
    ["desktop-dark", 1440, 1100],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 0));
    if (name.endsWith("dark")) {
      await page
        .getByRole("button", { name: "Toggle appearance", exact: true })
        .click();
      await page.waitForFunction(
        () => window.document.documentElement.dataset.theme === "dark",
      );
    }
    assert.ok(
      await page.evaluate(
        () => window.document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: fileURLToPath(new URL("m2-" + name + ".png", evidence)),
      fullPage: false,
    });
    if (name === "mobile-light" || name === "desktop-dark") {
      await page
        .locator('iframe[title="designElectronics circuit editor"]')
        .scrollIntoViewIfNeeded();
      await frame.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await page.screenshot({
        path: fileURLToPath(
          new URL(
            name === "mobile-light"
              ? "m2-mobile-editor.png"
              : "m2-desktop-dark-editor.png",
            evidence,
          ),
        ),
        fullPage: false,
      });
    }
  }
  report.checks.push(
    "host save/edit/reopen/export, desktop/mobile/light/dark private project controls",
  );
  const privateA = structuredClone(store.projects.get(saved.id));
  const replacement = JSON.parse(
    await readFile(new URL("uno-traffic-light.dez", evidence), "utf8"),
  );
  await native({ operation: "open", document: replacement });
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await idle();
  await page
    .getByRole("status")
    .filter({
      hasText: "Native document changed; created a separate private project",
    })
    .waitFor();
  assert.deepEqual(store.projects.get(saved.id), privateA);
  const privateB = [...store.projects.values()].find(
    (row) => row.document.uid === replacement.uid,
  );
  assert.ok(privateB && privateB.id !== saved.id);
  await native({ operation: "tool", name: "new_design", arguments: {} });
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await idle();
  await page
    .getByRole("status")
    .filter({
      hasText: "Native document changed; created a separate private project",
    })
    .waitFor();
  assert.deepEqual(store.projects.get(saved.id), privateA);
  assert.equal(store.projects.get(privateB.id).revision, 1);
  const beforeExample = new Set(store.projects.keys());
  await native({
    operation: "tool",
    name: "load_example",
    arguments: { name: 0 },
  });
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await idle();
  await page
    .getByRole("status")
    .filter({
      hasText: "Native document changed; created a separate private project",
    })
    .waitFor();
  assert.equal(
    [...store.projects.keys()].filter((id) => !beforeExample.has(id)).length,
    1,
  );
  assert.deepEqual(store.projects.get(saved.id), privateA);
  await page
    .getByRole("button", { name: "Reload engine", exact: true })
    .click();
  await idle();
  frame = page
    .frames()
    .find((frame) =>
      frame.url().includes("vendor/design-electronics/index.html"),
    );
  await page
    .locator('iframe[title="designElectronics circuit editor"]')
    .scrollIntoViewIfNeeded();
  const empty = await native({ operation: "snapshot" });
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await idle();
  const cleanA = [...store.projects.values()].find(
      (row) => row.document.uid === empty.uid,
    ),
    beforeNativeOpen = structuredClone(cleanA);
  const sameUid = {
    ...structuredClone(replacement),
    uid: empty.uid,
    title: "Same UID native import",
  };
  await frame.evaluate((document) => {
    Module.FS.writeFile("/tmp/same-uid.dez", JSON.stringify(document));
    Module.ccall("de_web_opened", null, ["string"], ["/tmp/same-uid.dez"]);
  }, sameUid);
  await frame.waitForFunction(
    () =>
      JSON.parse(
        Module.ccall(
          "de_ohmi_dispatch",
          "string",
          ["string"],
          ['{"operation":"snapshot"}'],
        ),
      ).result.title === "Same UID native import",
  );
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await idle();
  assert.deepEqual(store.projects.get(cleanA.id), beforeNativeOpen);
  assert.ok(
    [...store.projects.values()].some(
      (row) => row.name === "Same UID native import" && row.id !== cleanA.id,
    ),
  );
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: fileURLToPath(new URL("m2-replacement-safe.png", evidence)),
    fullPage: false,
  });
  report.checks.push(
    "native document Open/New/example and actual native File Open with identical UID save separately without overwriting A; ordinary edits still update A",
  );
  store.delayMs = 500;
  await page
    .getByRole("button", { name: "Refresh private projects", exact: true })
    .click();
  await context.clearCookies();
  await seedSession(context, otherUser);
  await page.reload();
  await page.locator("details summary").click();
  await page.waitForFunction(
    () =>
      !Array.from(window.document.querySelectorAll("button")).find(
        (button) => button.textContent === "Save snapshot",
      )?.disabled,
    { timeout: 45000 },
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Open " + saved.name, exact: true })
      .count(),
    0,
  );
  report.checks.push(
    "pending private request/account reload leaves no previous-account project controls",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(old, original);
  console.log(JSON.stringify(report));
} finally {
  await writeFile(
    new URL("m2-browser.json", evidence),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  await fixture.close();
}
