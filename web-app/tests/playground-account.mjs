import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .filter((v) => v.includes("=") && !v.startsWith("#"))
    .map((v) => [v.slice(0, v.indexOf("=")), v.slice(v.indexOf("=") + 1)]),
);
const fixtures = JSON.parse(
    await readFile("../.superpowers/playground-fixtures.json", "utf8"),
  ),
  browser = await chromium.launch(),
  contexts = [],
  clients = [];
const base = "http://127.0.0.1:3120";
try {
  for (const f of fixtures) {
    assert.match(f.email, /^ohmi-playground-[a-z0-9-]+@example\.test$/, "Only disposable Playground test accounts may run this destructive fixture test");
    const jar = [];
    const client = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookieOptions: {
          name: "ohmi-web-auth",
          path: "/app/",
          sameSite: "lax",
          secure: false,
        },
        cookies: {
          getAll: () => jar,
          setAll: (values) => {
            for (const item of values) {
              const i = jar.findIndex((c) => c.name === item.name);
              if (i < 0) jar.push(item);
              else jar[i] = item;
            }
          },
        },
      },
    );
    const { data, error } = await client.auth.signInWithPassword({
      email: f.email,
      password: f.password,
    });
    assert.equal(error, null, error?.message);
    assert.equal(data.user?.id, f.id);
    assert.equal(data.user?.user_metadata.ohmi_playground_test, true, "Refuse cleanup outside a marked synthetic account");
    clients.push(client);
    await client.from("ohmi_playground_projects").delete().eq("user_id", f.id);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addCookies(
      jar.map((c) => ({
        name: c.name,
        value: c.value,
        domain: "127.0.0.1",
        path: "/app/",
        sameSite: "Lax",
      })),
    );
    contexts.push(context);
  }
  const page = await contexts[0].newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/app/playground/");
  await page
    .getByText("Ready to save to your account", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Missions", exact: true }).click();
  await page
    .locator(".pg-mission-picker button")
    .filter({ hasText: "Find the hidden issue" })
    .click();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page
    .getByText("Saved to your private account", { exact: true })
    .waitFor();
  let list = await contexts[0].request
    .get(base + "/app/api/playground/")
    .then((r) => r.json());
  assert.equal(list.projects.length, 1);
  const saved = list.projects[0];
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill("Edited saved circuit");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page
    .getByText("Saved to your private account", { exact: true })
    .waitFor();
  let response = await contexts[0].request.get(
    base + "/app/api/playground/?id=" + saved.id,
  );
  let stored = await response.json();
  assert.equal(stored.project.name, "Edited saved circuit");
  assert.equal(stored.revision, 2);
  assert.equal(stored.project.mission, "repair");
  await page.reload();
  await page.locator(".playground[data-ready=true]").waitFor();
  await page.getByText(/Saved projects/).click();
  await page
    .getByRole("button")
    .filter({ has: page.getByText("Edited saved circuit", { exact: true }) })
    .click();
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector("input[name=projectName]")?.value ===
      "Edited saved circuit",
  );
  assert.equal(await page.locator(".pg-wire").count(), 3);
  const mutate = {
    headers: { origin: base },
    data: { id: saved.id, revision: 1, project: stored.project },
  };
  assert.equal(
    (
      await contexts[0].request.post(base + "/app/api/playground/", mutate)
    ).status(),
    409,
    "stale save conflict",
  );
  assert.equal(
    (
      await contexts[1].request.get(
        base + "/app/api/playground/?id=" + saved.id,
      )
    ).status(),
    404,
    "cross-owner GET",
  );
  assert.equal(
    (
      await contexts[1].request.post(base + "/app/api/playground/", {
        ...mutate,
        data: { ...mutate.data, revision: 2 },
      })
    ).status(),
    409,
    "cross-owner update",
  );
  assert.equal(
    (
      await contexts[1].request.delete(
        base + `/app/api/playground/?id=${saved.id}&revision=2`,
        { headers: { origin: base } },
      )
    ).status(),
    409,
    "cross-owner delete",
  );
  assert.equal(
    (
      await contexts[0].request.post(base + "/app/api/playground/", {
        ...mutate,
        headers: { origin: "https://attacker.invalid" },
      })
    ).status(),
    400,
    "wrong-origin denied",
  );
  assert.equal(
    (
      await contexts[0].request.post(base + "/app/api/playground/", {
        ...mutate,
        data: { id: crypto.randomUUID(), revision: 0, project: {} },
      })
    ).status(),
    400,
    "invalid project denied",
  );
  const anon = await browser.newContext();
  assert.equal(
    (await anon.request.get(base + "/app/api/playground/")).status(),
    401,
  );
  await anon.close();
  const cross = await clients[1]
    .from("ohmi_playground_projects")
    .select("id")
    .eq("id", saved.id);
  assert.deepEqual(cross.data, []);
  await page
    .getByRole("button", {
      name: "Delete saved project Edited saved circuit",
      exact: true,
    })
    .click();
  await page
    .getByText("No saved projects yet. Save your first circuit above.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    (
      await contexts[0].request.get(
        base + "/app/api/playground/?id=" + saved.id,
      )
    ).status(),
    404,
  );
  await writeFile(
    "docs/playground-account-verification.json",
    JSON.stringify(
      {
        ownerSave: true,
        reopenAfterReload: true,
        editRevision: true,
        delete: true,
        staleConflict: true,
        crossOwnerReadWriteDeleteDenied: true,
        anonymousDenied: true,
        wrongOriginDenied: true,
        invalidProjectDenied: true,
        realSupabase: true,
        syntheticAccounts: 2,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS real authenticated browser save/reload/reopen/edit/delete, revision conflict, two-account API and RLS isolation, anonymous/origin/invalid input denial",
  );
} finally {
  for (const c of clients) await c.auth.signOut();
  for (const c of contexts) await c.close();
  await browser.close();
}
