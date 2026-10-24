import { describe, it, expect, vi } from "vitest";
import { handleLibraryRequest } from "./library.ts";
describe("curated guide enrollment", () => {
  it("rejects missing auth without creating a privileged client", async () => {
    const create = vi.fn();
    const response = await handleLibraryRequest(
      new Request("https://example.test", { method: "POST" }),
      {
        createClient: create,
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "public",
          SUPABASE_SERVICE_ROLE_KEY: "secret",
        },
      },
    );
    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });
  it("ignores user-supplied owner and uses verified Auth identity", async () => {
    const select = vi.fn().mockReturnThis(),
      eq = vi.fn().mockReturnThis();
    const row = { id: "67f2c464-c896-48ed-9a76-204b91220e28" };
    const user = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({
            data: { user: { id: "verified-user" } },
            error: null,
          }),
      },
    };
    const admin = {
      from: vi
        .fn()
        .mockReturnValue({
          select,
          eq,
          maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
        }),
    };
    const create = vi.fn().mockReturnValueOnce(user).mockReturnValueOnce(admin);
    const response = await handleLibraryRequest(
      new Request("https://example.test", {
        method: "POST",
        headers: { Authorization: "Bearer session" },
        body: JSON.stringify({ user_id: "other-user" }),
      }),
      {
        createClient: create,
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "public",
          SUPABASE_SERVICE_ROLE_KEY: "secret",
        },
      },
    );
    expect(response.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("user_id", "verified-user");
    expect((await response.json()).analysisId).toBe(row.id);
  });
});

import { curatedGuide } from "./guide.ts";
import { validateTutorialResult } from "../ohmi-ai/tutorial.ts";
it("curated enrollment is a real bounded tutorial, not AI accounting", () => {
  expect(validateTutorialResult(curatedGuide).valid).toBe(true);
  expect(curatedGuide.steps).toHaveLength(5);
});
it("does not report success when enrollment persistence fails", async () => {
  const query: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "unavailable" } }),
  };
  const create = vi
    .fn()
    .mockReturnValueOnce({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({
            data: { user: { id: "verified-user" } },
            error: null,
          }),
      },
    })
    .mockReturnValueOnce({ from: vi.fn().mockReturnValue(query) });
  const response = await handleLibraryRequest(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer session" },
    }),
    {
      createClient: create,
      env: {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "public",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    },
  );
  expect(response.status).toBe(503);
  expect((await response.json()).analysisId).toBeUndefined();
});
it("rejects expired sessions before privileged database access", async () => {
  const create = vi
    .fn()
    .mockReturnValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({
            data: { user: null },
            error: { message: "expired" },
          }),
      },
    });
  const response = await handleLibraryRequest(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer expired" },
    }),
    {
      createClient: create,
      env: {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "public",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    },
  );
  expect(response.status).toBe(401);
  expect(create).toHaveBeenCalledTimes(1);
});
