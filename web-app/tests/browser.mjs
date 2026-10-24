import { startAuthFixture, seedSession } from "./auth-fixture.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const base = (process.env.OHMI_TEST_URL || "http://127.0.0.1:3115/app").replace(
  /\/$/,
  "",
);
const out = new URL("../test-results/", import.meta.url);
await mkdir(out, { recursive: true });
assert.equal(new URL(base).origin, "http://127.0.0.1:3115", "Use the isolated local auth test environment.");
const fixture = await startAuthFixture();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
  reducedMotion: "reduce",
  hasTouch: true,
});
await seedSession(context);
const page = await context.newPage(),
  errors = [],
  violations = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (
    r.status() >= 400 &&
    !r.url().includes("/api/") &&
    !r.url().includes("supabase.co")
  )
    errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
});
const routes = [
  "/",
  "/ask/",
  "/assignments/",
  "/checker/",
  "/guide/",
  "/progress/",
  "/settings/",
];
try {
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    for (const route of routes) {
      assert.equal((await page.goto(base + route)).status(), 200);
      await page.locator("h1").waitFor();
      assert.equal(
        await page.locator("html").getAttribute("data-theme"),
        "light",
        "New users start light even on dark devices",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${route} overflow ${size.width}`,
      );
    }
    await page.goto(base + "/ask/");
    if (size.width >= 768) {
      const profile = page.getByRole("link", {
        name: "Open account profile",
        exact: true,
      });
      const profileBox = await profile.boundingBox();
      assert.ok(profileBox && profileBox.width >= 44 && profileBox.height >= 44);
      if (size.width >= 1200) {
        const metrics = await profile.evaluate((anchor) => {
          const meta = anchor.querySelector(".profile-meta");
          const chevron = anchor.querySelector(".profile-chevron");
          anchor.querySelector("strong").textContent = "Test Learner A".repeat(5);
          anchor.querySelector("small").textContent =
            "learner-a@example.test";
          const metaBox = meta.getBoundingClientRect();
          const chevronBox = chevron.getBoundingClientRect();
          const rect = anchor.getBoundingClientRect();
          const hit = document.elementFromPoint(
            chevronBox.x + chevronBox.width / 2,
            chevronBox.y + chevronBox.height / 2,
          );
          return {
            contained: metaBox.left >= rect.left && chevronBox.right <= rect.right,
            separated: metaBox.right <= chevronBox.left - 8,
            ellipsis:
              getComputedStyle(anchor.querySelector("small")).textOverflow ===
                "ellipsis" &&
              getComputedStyle(anchor.querySelector("small")).whiteSpace ===
                "nowrap",
            chevronHit: hit?.closest("a") === anchor,
          };
        });
        assert.deepEqual(metrics, {
          contained: true,
          separated: true,
          ellipsis: true,
          chevronHit: true,
        });
      }
      await profile.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL((url) => url.pathname.endsWith("/app/settings/"));
      if (size.width >= 1200) {
        await page.goto(base + "/ask/");
        const currentProfile = page.getByRole("link", {
          name: "Open account profile",
          exact: true,
        });
        const currentBox = await currentProfile.boundingBox();
        await currentProfile.click({
          position: { x: currentBox.width - 22, y: currentBox.height / 2 },
        });
        await page.waitForURL((url) => url.pathname.endsWith("/app/settings/"));
      } else {
        await page.goto(base + "/ask/");
        await page.getByRole("link", {
          name: "Open account profile",
          exact: true,
        }).tap();
        await page.waitForURL((url) => url.pathname.endsWith("/app/settings/"));
      }
    } else {
      const profile = page.getByRole("link", {
        name: "Open profile",
        exact: true,
      });
      const profileBox = await profile.boundingBox();
      assert.ok(profileBox && profileBox.width >= 44 && profileBox.height >= 44);
      const avatarSize = await profile.evaluate((anchor) => {
        const avatar = getComputedStyle(anchor, "::before");
        return {
          width: Number.parseFloat(avatar.width),
          height: Number.parseFloat(avatar.height),
        };
      });
      assert.deepEqual(avatarSize, { width: 33, height: 33 });
      await profile.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL((url) => url.pathname.endsWith("/app/settings/"));
      await page.goto(base + "/ask/");
      await page.getByRole("link", {
        name: "Open profile",
        exact: true,
      }).tap();
      await page.waitForURL((url) => url.pathname.endsWith("/app/settings/"));
    }
    await page.goto(base + "/ask/");
    if (size.width < 768) {
      await page
        .getByRole("button", { name: "More navigation", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      const box = await dialog.boundingBox();
      assert.ok(
        box.x >= -1 &&
          box.y >= -1 &&
          box.x + box.width <= size.width + 1 &&
          box.y + box.height <= size.height + 1,
        JSON.stringify({ size, box }),
      );
      assert.equal(await page.locator(".bottom-nav .nav-item").count(), 5);
      await page.screenshot({
        path: fileURLToPath(new URL(`more-${size.width}.png`, out)),
      });
      await page.keyboard.press("Escape");
    }
    results.push(`Routes and navigation fit ${size.width}x${size.height}`);
    results.push(`Account profile target works at ${size.width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const theme of ["light", "dark"]) {
    await page.goto(base + "/settings/");
    await page
      .getByRole("button", {
        name: theme === "dark" ? "Dark" : "Light",
        exact: true,
      })
      .click();
    for (const route of routes) {
      await page.goto(base + route);
      await page.locator("h1").waitFor();
      if (route === "/" || route === "/ask/") {
        await page.screenshot({
          path: fileURLToPath(
            new URL(
              `${route === "/" ? "dashboard" : "ask"}-${theme}.png`,
              out,
            ),
          ),
          fullPage: true,
        });
      }
      const themeColor = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--background")
          .trim(),
      );
      await page.waitForFunction(
        (color) =>
          [...document.querySelectorAll('meta[name="theme-color"]')].every(
            (meta) => meta.getAttribute("content") === color,
          ),
        themeColor,
      );
      assert.ok(
        await page
          .locator('meta[name="theme-color"]')
          .evaluateAll(
            (metas, color) =>
              metas.every((meta) => meta.getAttribute("content") === color),
            themeColor,
          ),
        `${theme} browser chrome color matches the app surface`,
      );
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      violations.push(
        ...audit.violations.map((v) => ({
          theme,
          route,
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        })),
      );
    }
    if (theme === "dark") {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + "/");
      await page
        .getByRole("button", { name: "More navigation", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert.equal(
        await dialog.evaluate(
          (element) => {
            const probe = document.createElement("div");
            probe.style.backgroundColor = "var(--card)";
            document.body.append(probe);
            const expected = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return getComputedStyle(element).backgroundColor === expected;
          },
        ),
        true,
      );
      await page.screenshot({
        path: fileURLToPath(new URL("more-dark.png", out)),
      });
      const dialogAudit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      violations.push(
        ...dialogAudit.violations.map((v) => ({
          theme,
          route: "dialog",
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        })),
      );
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 1440, height: 1000 });
      results.push("Dark mobile navigation dialog matches charcoal surfaces and passes axe");
    }
  }
  await page.goto(base + "/ask/");
  const language = page.getByRole("combobox", {
    name: "Reply language",
    exact: true,
  });
  const languageBox = await language.boundingBox();
  assert.ok(languageBox && languageBox.width >= 44 && languageBox.height >= 44);
  await language.focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await language.inputValue(), "Filipino");
  const send = page.getByRole("button", { name: "Send message", exact: true });
  assert.equal(await send.isDisabled(), true);
  await page.getByLabel("Your question", { exact: true }).fill("A valid question");
  assert.equal(await send.isDisabled(), false);
  await page.getByLabel("Your question", { exact: true }).fill("");
  results.push("Authenticated language selector and valid/empty send states work");
  const guest = await browser.newContext();
  const id = "00000000-0000-4000-8000-000000000000";
  for (const [route, method] of [
    [`/api/files/${id}/`, "GET"],
    ["/api/files/", "POST"],
    ["/api/guide/", "POST"],
  ]) {
    const response = await guest.request.fetch(base + route, {
      method,
      headers: { Origin: new URL(base).origin },
      data: method === "POST" ? {} : undefined,
    });
    assert.equal(response.status(), 401);
    assert.match(response.headers()["cache-control"], /private.*no-store/);
  }
  const badOrigin = await guest.request.post(base + "/api/files/", {
    headers: { Origin: "https://attacker.invalid" },
    data: {},
  });
  assert.equal(badOrigin.status(), 400);
  await guest.close();
  results.push(
    "Signed-out private APIs reject access; foreign origins rejected; no demo answer",
  );
  await page.goto(base + "/checker/");
  await page
    .locator("input[type=file]")
    .setInputFiles(
      fileURLToPath(new URL("../public/icons/icon-512.png", import.meta.url)),
    );
  await page.getByLabel("Centered crop", { exact: false }).fill("60");
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  await page.getByRole("button", { name: "Crop applied" }).waitFor();
  results.push("Authenticated local crop preview works after the route guard");
  const interactionContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  try {
    const interactionPage = await interactionContext.newPage();
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "learner-a@example.test",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: { full_name: "Test Learner A" },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const session = {
      access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
        sub: user.id,
        aud: "authenticated",
        exp: expiresAt,
      })}.test-signature`,
      refresh_token: "test-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: expiresAt,
      user,
    };
    await interactionContext.addCookies([
      {
        name: "ohmi-web-auth",
        value: `base64-${encode(session)}`,
        domain: "127.0.0.1",
        path: "/app/",
        sameSite: "Lax",
        httpOnly: false,
        secure: false,
      },
    ]);
    await interactionPage.route("**/auth/v1/user*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      }),
    );
    let profile = {
        id: user.id,
        display_name: "Test Learner A",
        language: "english",
      },
      conversations = [];
    await interactionPage.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const table = new URL(request.url()).pathname.split("/").at(-1);
      if (table === "ohmi_profiles") {
        if (request.method() === "PATCH") {
          profile = { ...profile, ...(await request.postDataJSON()) };
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ id: user.id }),
          });
        }
        if (request.method() === "GET")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(profile),
          });
        return route.fulfill({ status: 204, body: "" });
      }
      if (table === "ohmi_conversations") {
        if (request.method() === "POST") {
          const row = {
            id: "22222222-2222-4222-8222-222222222222",
            title: (await request.postDataJSON()).title,
          };
          conversations = [row, ...conversations];
          return route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify(row),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(conversations),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    let releaseAi;
    const waitForAi = new Promise((resolve) => (releaseAi = resolve));
    let receivedPayload, markAiRequestReceived;
    const receivedAiRequest = new Promise(
      (resolve) => (markAiRequestReceived = resolve),
    );
    await interactionPage.route("**/app/api/ai/**", async (route) => {
        if (route.request().method() === "GET")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ enabled: true }),
          });
        receivedPayload = await route.request().postDataJSON();
        markAiRequestReceived();
        await waitForAi;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, result: { text: "Mocked reply." } }),
        });
    });
    await interactionPage.goto(base + "/ask/");
    await interactionPage.waitForFunction(() =>
      document
        .querySelector(".profile-link small")
        ?.textContent?.includes("learner-a@example.test"),
    );
    const language = interactionPage.getByRole("combobox", {
      name: "Reply language",
      exact: true,
    });
    const languageTarget = await language.boundingBox();
    assert.ok(
      languageTarget && languageTarget.width >= 44 && languageTarget.height >= 44,
    );
    await language.tap();
    await language.selectOption("Taglish");
    assert.equal(await language.inputValue(), "Taglish");
    const question = "Why does an LED need a resistor?";
    const textarea = interactionPage.getByLabel("Your question", {
      exact: true,
    });
    await textarea.fill(question);
    const send = interactionPage.getByRole("button", {
      name: "Send message",
      exact: true,
    });
    assert.equal(await send.isDisabled(), false);
    const sendTarget = await send.boundingBox();
    assert.ok(sendTarget && sendTarget.width >= 44 && sendTarget.height >= 44);
    await send.tap();
    await receivedAiRequest;
    assert.equal(receivedPayload.operation, "chat");
    assert.equal(receivedPayload.language, "taglish");
    assert.equal(receivedPayload.message, question);
    assert.equal(
      receivedPayload.conversationId,
      "22222222-2222-4222-8222-222222222222",
    );
    await interactionPage
      .getByRole("button", { name: "Stop waiting for OHMI", exact: true })
      .waitFor();
    assert.equal(await interactionPage.locator("form").getAttribute("aria-busy"), "true");
    await interactionPage.getByText("Waiting for OHMI…", { exact: true }).waitFor();
    releaseAi();
    await interactionPage.waitForFunction(
      () => document.querySelector("#message")?.value === "",
    );
    assert.equal(await interactionPage.locator("form").getAttribute("aria-busy"), "false");
    results.push(
      "Authenticated Ask OHMI submits through its existing chat payload; touch selector and send, pending, and completion states work",
    );
  } finally {
    await interactionContext.close();
  }
  await page.goto(base + "/settings/");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page
    .getByRole("switch", { name: "Reduce motion", exact: false })
    .check();
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(
    await page.locator("html").getAttribute("data-reduce-motion"),
    "true",
  );
  results.push("Saved theme and accessibility preferences survive refresh");
  const manifest = await (
    await page.request.get(base + "/manifest.webmanifest")
  ).json();
  assert.equal(manifest.scope, "/app/");
  assert.equal(manifest.start_url, "/app/");
  assert.equal(manifest.display, "standalone");
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    if (new URL(r.scope).pathname !== "/app/")
      throw Error("Worker scope escaped app");
  });
  const cachePaths = await page.evaluate(async () => {
    const paths = [];
    for (const key of await caches.keys())
      for (const request of await (await caches.open(key)).keys())
        paths.push(new URL(request.url).pathname);
    return paths;
  });
  const allowed = [
    "/app/offline.html",
    "/app/mascot.png",
    "/app/icons/icon-192.png",
    "/app/icons/icon-512.png",
    "/app/icons/icon-maskable-512.png",
    "/app/icons/apple-touch-icon.png",
  ];
  assert.ok(cachePaths.includes("/app/offline.html"));
  assert.ok(
    cachePaths.every((p) => allowed.includes(p)),
    JSON.stringify(cachePaths),
  );
  await context.setOffline(true);
  await page.goto(base + "/");
  await page
    .getByRole("heading", { name: "A little pause in the connection." })
    .waitFor();
  await context.setOffline(false);
  results.push(
    "Manifest, worker scope, public-only cache and offline fallback pass",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(violations, []);
} finally {
  await writeFile(
    new URL("report.json", out),
    JSON.stringify(
      {
        base,
        verifiedAt: new Date().toISOString(),
        results,
        errors,
        violations,
      },
      null,
      2,
    ),
  );
  await browser.close();
  await fixture.close();
}
console.log(JSON.stringify({ results, errors, violations }, null, 2));
